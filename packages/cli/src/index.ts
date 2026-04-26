#!/usr/bin/env node

import { config as loadEnv } from "dotenv";
import { Command } from "commander";
import chalk from "chalk";

import { runPublish } from "./commands/publish.js";
import { runFetch } from "./commands/fetch.js";
import { runProve } from "./commands/prove.js";

loadEnv();

const program = new Command();

program
  .name("0gzk")
  .description("0gzk CLI: publish circuit bundles to 0G Storage, fetch them back, and prove locally.")
  .version("0.1.0");

program
  .command("publish")
  .description("Pack a circuit bundle directory and upload it to 0G Storage.")
  .argument("<bundleDir>", "Path to the circuit_bundle/ directory to upload")
  .option("--network <network>", "Override network (testnet | mainnet)")
  .option("--rpc-url <url>", "Override EVM RPC URL")
  .option("--indexer-url <url>", "Override 0G Storage indexer URL")
  .option("--key <hex>", "Override OG_PRIVATE_KEY (0x-prefixed)")
  .option("--no-receipt", "Do not write .published.json into the bundle directory")
  .action(async (bundleDir: string, opts) => {
    await runPublish(bundleDir, {
      network: opts.network,
      rpcUrl: opts.rpcUrl,
      indexerUrl: opts.indexerUrl,
      privateKey: opts.key,
      writeReceipt: opts.receipt !== false,
    });
  });

program
  .command("fetch")
  .description("Download a circuit bundle from 0G Storage by root hash and untar it.")
  .argument("<rootHash>", "0x-prefixed root hash returned by `0gzk publish`")
  .argument("[outputDir]", "Where to extract the bundle (default: a temp directory)")
  .option("--network <network>", "Override network (testnet | mainnet)")
  .option("--indexer-url <url>", "Override 0G Storage indexer URL")
  .action(async (rootHash: string, outputDir: string | undefined, opts) => {
    await runFetch(rootHash, outputDir, {
      network: opts.network,
      indexerUrl: opts.indexerUrl,
    });
  });

program
  .command("prove")
  .description(
    "Generate a Groth16 proof for an input.json against a circuit bundle (local dir or 0G root hash).",
  )
  .argument("<inputFile>", "Path to a JSON file with the circuit inputs")
  .option("--bundle <dir>", "Use a local circuit_bundle/ directory")
  .option("--root-hash <hex>", "Fetch the bundle from 0G Storage by root hash")
  .option("--out <dir>", "Write proof.json/public.json/result.json to this directory")
  .option("--no-verify", "Skip local verification after proving")
  .option("--network <network>", "Override network (testnet | mainnet)")
  .option("--indexer-url <url>", "Override 0G Storage indexer URL")
  .action(async (inputFile: string, opts) => {
    await runProve(inputFile, {
      bundle: opts.bundle,
      rootHash: opts.rootHash,
      out: opts.out,
      verify: opts.verify !== false,
      network: opts.network,
      indexerUrl: opts.indexerUrl,
    });
  });

program
  .parseAsync(process.argv)
  .then(() => {
    // snarkjs leaves background workers/wasm threads alive after groth16.fullProve,
    // which keeps Node's event loop pinned. Force-exit once the command resolves.
    process.exit(process.exitCode ?? 0);
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`error: ${message}`));
    process.exit(1);
  });
