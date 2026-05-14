#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { Command } from "commander";
import chalk from "chalk";

import { runPublish } from "./commands/publish.js";
import { runFetch } from "./commands/fetch.js";
import { runProve } from "./commands/prove.js";
import {
  runRegistryGet,
  runRegistryList,
  runRegistryRegister,
  runRegistryResolve,
} from "./commands/registry.js";

loadEnv();

// Read the version from our own package.json so `0gzk --version` can never
// drift from the published manifest.
const pkg = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
    "utf8",
  ),
) as { version: string };

const program = new Command();

program
  .name("0gzk")
  .description("0gzk CLI: publish circuit bundles to 0G Storage, register them on 0G Chain, and prove locally.")
  .version(pkg.version);

program
  .command("publish")
  .description("Pack a circuit bundle, upload it to 0G Storage, and optionally register it on-chain.")
  .argument("<bundleDir>", "Path to the circuit_bundle/ directory to upload")
  .option("--network <network>", "Override network (testnet | mainnet)")
  .option("--rpc-url <url>", "Override EVM RPC URL")
  .option("--indexer-url <url>", "Override 0G Storage indexer URL")
  .option("--key <hex>", "Override OG_PRIVATE_KEY (0x-prefixed)")
  .option("--no-receipt", "Do not write .published.json into the bundle directory")
  .option("--register", "Also call CircuitRegistry.publishVersion after upload")
  .option("--registry <address>", "Override the on-chain CircuitRegistry address")
  .option("--metadata-uri <uri>", "Optional human-readable metadata URI to record on-chain")
  .option("--verifier-address <address>", "On-chain Groth16 verifier address (defaults to address(0))")
  .option(
    "--wait <duration>",
    "How long to wait for 0G Storage finalization (e.g. 30s, 5m, 1h, forever). Default 5m.",
  )
  .option(
    "--no-wait",
    "Submit the upload and return as soon as the rootHash is known; --register still fires.",
  )
  .action(async (bundleDir: string, opts) => {
    await runPublish(bundleDir, {
      network: opts.network,
      rpcUrl: opts.rpcUrl,
      indexerUrl: opts.indexerUrl,
      privateKey: opts.key,
      writeReceipt: opts.receipt !== false,
      register: Boolean(opts.register),
      registry: opts.registry,
      metadataUri: opts.metadataUri,
      verifierAddress: opts.verifierAddress,
      wait: opts.wait,
      noWait: opts.wait === false,
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
    "Generate a Groth16 proof for an input.json against a circuit bundle (local dir, 0G root hash, or registry name).",
  )
  .argument("<inputFile>", "Path to a JSON file with the circuit inputs")
  .option("--bundle <dir>", "Use a local circuit_bundle/ directory")
  .option("--root-hash <hex>", "Fetch the bundle from 0G Storage by root hash")
  .option("--name <spec>", "Resolve via the on-chain registry, e.g. age_verification@0.1.0")
  .option("--registry <address>", "Override the CircuitRegistry address (used with --name)")
  .option("--rpc-url <url>", "Override the EVM RPC URL (used with --name)")
  .option("--out <dir>", "Write proof.json/public.json/result.json to this directory")
  .option("--no-verify", "Skip local verification after proving")
  .option("--network <network>", "Override network (testnet | mainnet)")
  .option("--indexer-url <url>", "Override 0G Storage indexer URL")
  .action(async (inputFile: string, opts) => {
    await runProve(inputFile, {
      bundle: opts.bundle,
      rootHash: opts.rootHash,
      name: opts.name,
      registry: opts.registry,
      rpcUrl: opts.rpcUrl,
      out: opts.out,
      verify: opts.verify !== false,
      network: opts.network,
      indexerUrl: opts.indexerUrl,
    });
  });

const registry = program
  .command("registry")
  .description("Browse and resolve circuits via the on-chain CircuitRegistry.");

registry
  .command("register")
  .description(
    "Register an already-uploaded bundle on-chain. Use when 0G Storage finalization " +
      "timed out during `0gzk publish --register` and you have the rootHash on hand.",
  )
  .argument("<rootHash>", "0x-prefixed rootHash returned by `0gzk publish`")
  .requiredOption(
    "--bundle <dir>",
    "Local circuit_bundle/ directory whose metadata.json + verification_key.json " +
      "are used to compute (name, version, vkeyHash).",
  )
  .option("--metadata-uri <uri>", "Optional human-readable metadata URI to record on-chain")
  .option("--verifier-address <address>", "On-chain Groth16 verifier address (defaults to address(0))")
  .option("--network <network>", "Override network (testnet | mainnet)")
  .option("--rpc-url <url>", "Override the EVM RPC URL")
  .option("--key <hex>", "Override OG_PRIVATE_KEY (0x-prefixed)")
  .option("--registry <address>", "Override the CircuitRegistry address")
  .action(async (rootHash: string, opts) => {
    await runRegistryRegister(rootHash, {
      bundle: opts.bundle,
      metadataUri: opts.metadataUri,
      verifierAddress: opts.verifierAddress,
      network: opts.network,
      rpcUrl: opts.rpcUrl,
      privateKey: opts.key,
      registry: opts.registry,
    });
  });

registry
  .command("list")
  .description("Page through registered circuits.")
  .option("--offset <n>", "Pagination offset (default 0)")
  .option("--limit <n>", "Page size (default 50)")
  .option("--network <network>", "Override network (testnet | mainnet)")
  .option("--rpc-url <url>", "Override the EVM RPC URL")
  .option("--registry <address>", "Override the CircuitRegistry address")
  .action(async (opts) => {
    await runRegistryList({
      offset: opts.offset,
      limit: opts.limit,
      network: opts.network,
      rpcUrl: opts.rpcUrl,
      registry: opts.registry,
    });
  });

registry
  .command("get")
  .description("Show metadata for <name> (latest) or <name>@<version>.")
  .argument("<spec>", "Circuit name, optionally with @<version>")
  .option("--network <network>", "Override network (testnet | mainnet)")
  .option("--rpc-url <url>", "Override the EVM RPC URL")
  .option("--registry <address>", "Override the CircuitRegistry address")
  .action(async (spec: string, opts) => {
    await runRegistryGet(spec, {
      network: opts.network,
      rpcUrl: opts.rpcUrl,
      registry: opts.registry,
    });
  });

registry
  .command("resolve")
  .description("Resolve <name>@<version> via registry and download the bundle.")
  .argument("<spec>", "Circuit name@version")
  .argument("[outputDir]", "Where to extract the bundle (default: ~/.0gzk/bundles/<rootHash>/)")
  .option("--network <network>", "Override network (testnet | mainnet)")
  .option("--rpc-url <url>", "Override the EVM RPC URL")
  .option("--registry <address>", "Override the CircuitRegistry address")
  .action(async (spec: string, outputDir: string | undefined, opts) => {
    await runRegistryResolve(spec, {
      network: opts.network,
      rpcUrl: opts.rpcUrl,
      registry: opts.registry,
      outputDir,
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
