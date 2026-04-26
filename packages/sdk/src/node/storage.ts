import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

import { Indexer, ZgFile } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import * as tar from "tar";

import type { StorageConfig } from "./config.js";
import { requireSigningConfig } from "./config.js";
import type { BundleFiles, CircuitMetadata } from "../types.js";

export interface UploadResult {
  rootHash: string;
  txHash: string;
  txSeq: number;
}

const REQUIRED_FILES = [
  "metadata.json",
  "circuit.wasm",
  "circuit_final.zkey",
  "verification_key.json",
] as const;

const TAR_NAME = "bundle.tar.gz";

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function listBundleFiles(bundleDir: string): Promise<string[]> {
  const entries = await fs.readdir(bundleDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name !== TAR_NAME)
    .map((e) => e.name)
    .sort();
}

async function packBundle(bundleDir: string): Promise<string> {
  for (const required of REQUIRED_FILES) {
    if (!(await pathExists(path.join(bundleDir, required)))) {
      throw new Error(`Bundle is missing required file: ${required}`);
    }
  }

  const files = await listBundleFiles(bundleDir);
  const tmpDir = await makeTempDir("0gzk-pack-");
  const tarPath = path.join(tmpDir, TAR_NAME);

  await tar.create(
    {
      gzip: true,
      file: tarPath,
      cwd: bundleDir,
      portable: true,
    },
    files,
  );

  return tarPath;
}

export async function readBundleFromDir(bundleDir: string): Promise<BundleFiles> {
  const metadataRaw = await fs.readFile(path.join(bundleDir, "metadata.json"), "utf8");
  const metadata = JSON.parse(metadataRaw) as CircuitMetadata;

  const wasm = await fs.readFile(path.join(bundleDir, metadata.files.wasm));
  const zkey = await fs.readFile(path.join(bundleDir, metadata.files.zkey));
  const vkeyRaw = await fs.readFile(path.join(bundleDir, metadata.files.vkey), "utf8");
  const vkey = JSON.parse(vkeyRaw) as unknown;

  let verifier: string | undefined;
  if (metadata.files.verifier) {
    const verifierPath = path.join(bundleDir, metadata.files.verifier);
    if (await pathExists(verifierPath)) {
      verifier = await fs.readFile(verifierPath, "utf8");
    }
  }

  return {
    wasm: new Uint8Array(wasm.buffer, wasm.byteOffset, wasm.byteLength),
    zkey: new Uint8Array(zkey.buffer, zkey.byteOffset, zkey.byteLength),
    vkey,
    metadata,
    verifier,
  };
}

export async function uploadBundle(
  bundleDir: string,
  config: StorageConfig,
): Promise<UploadResult> {
  requireSigningConfig(config);

  const absBundleDir = path.resolve(bundleDir);
  if (!(await pathExists(absBundleDir))) {
    throw new Error(`Bundle directory does not exist: ${absBundleDir}`);
  }

  const tarPath = await packBundle(absBundleDir);
  const tarTmpDir = path.dirname(tarPath);

  let file: ZgFile | null = null;
  try {
    file = await ZgFile.fromFilePath(tarPath);

    const [, treeErr] = await file.merkleTree();
    if (treeErr) {
      throw new Error(`Merkle tree generation failed: ${treeErr.message}`);
    }

    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const signer = new ethers.Wallet(config.privateKey, provider);
    const indexer = new Indexer(config.indexerUrl);

    // Cast: @0gfoundation/0g-ts-sdk ships CJS-resolved ethers types while our
    // package resolves the ESM ones. Runtime types are identical; TS treats
    // them as distinct because ethers uses private fields.
    const [tx, uploadErr] = await indexer.upload(
      file,
      config.rpcUrl,
      signer as unknown as Parameters<typeof indexer.upload>[2],
    );
    if (uploadErr) {
      throw new Error(`0G upload failed: ${uploadErr.message}`);
    }

    if ("rootHash" in tx) {
      return { rootHash: tx.rootHash, txHash: tx.txHash, txSeq: tx.txSeq };
    }

    if (tx.rootHashes.length === 0) {
      throw new Error("0G upload returned no root hashes");
    }
    return {
      rootHash: tx.rootHashes[0]!,
      txHash: tx.txHashes[0]!,
      txSeq: tx.txSeqs[0]!,
    };
  } finally {
    if (file) {
      await file.close().catch(() => undefined);
    }
    await fs.rm(tarTmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function fetchBundle(
  rootHash: string,
  config: Pick<StorageConfig, "indexerUrl">,
  outputDir?: string,
): Promise<BundleFiles> {
  const targetDir =
    outputDir !== undefined
      ? path.resolve(outputDir)
      : await makeTempDir(`0gzk-fetch-${randomUUID().slice(0, 8)}-`);

  await fs.mkdir(targetDir, { recursive: true });

  const tarPath = path.join(targetDir, TAR_NAME);
  if (await pathExists(tarPath)) {
    await fs.rm(tarPath, { force: true });
  }

  const indexer = new Indexer(config.indexerUrl);
  const downloadErr = await indexer.download(rootHash, tarPath, true);
  if (downloadErr) {
    throw new Error(`0G download failed: ${downloadErr.message}`);
  }

  await tar.extract({
    file: tarPath,
    cwd: targetDir,
  });

  return readBundleFromDir(targetDir);
}
