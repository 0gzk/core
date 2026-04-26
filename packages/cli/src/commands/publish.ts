import { promises as fs } from "node:fs";
import * as path from "node:path";

import { loadConfig, uploadBundle } from "@0gzk/sdk/node";
import chalk from "chalk";
import ora from "ora";

export interface PublishOptions {
  network?: "testnet" | "mainnet";
  rpcUrl?: string;
  indexerUrl?: string;
  privateKey?: string;
  writeReceipt?: boolean;
}

export async function runPublish(
  bundleDir: string,
  options: PublishOptions = {},
): Promise<void> {
  const config = loadConfig({
    network: options.network,
    rpcUrl: options.rpcUrl,
    indexerUrl: options.indexerUrl,
    privateKey: options.privateKey,
  });

  console.log(chalk.dim(`network:  ${config.network}`));
  console.log(chalk.dim(`indexer:  ${config.indexerUrl}`));
  console.log(chalk.dim(`bundle:   ${path.resolve(bundleDir)}`));
  console.log();

  const spinner = ora("Uploading bundle to 0G Storage").start();
  let result;
  try {
    result = await uploadBundle(bundleDir, config);
    spinner.succeed("Uploaded to 0G Storage");
  } catch (err) {
    spinner.fail("Upload failed");
    throw err;
  }

  console.log();
  console.log(chalk.bold("rootHash:"), chalk.green(result.rootHash));
  console.log(chalk.bold("txHash:  "), chalk.green(result.txHash));
  console.log(chalk.bold("txSeq:   "), chalk.green(String(result.txSeq)));
  console.log(
    chalk.dim(`explorer: ${config.explorer}/tx/${result.txHash}`),
  );

  if (options.writeReceipt !== false) {
    const receiptPath = path.join(path.resolve(bundleDir), ".published.json");
    await fs.writeFile(
      receiptPath,
      `${JSON.stringify(
        {
          rootHash: result.rootHash,
          txHash: result.txHash,
          txSeq: result.txSeq,
          network: config.network,
          publishedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    );
    console.log(chalk.dim(`receipt:  ${receiptPath}`));
  }
}
