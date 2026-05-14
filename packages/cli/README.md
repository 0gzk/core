# @0gzk/cli

Command-line tool for the [0gzk](https://github.com/0gzk/core) ZK Proof-as-a-Service platform on 0G Storage. Publish a circuit bundle to 0G, fetch it back by root hash, and generate Groth16 proofs locally — witness data never leaves your machine.

## Install

```bash
npm install -g @0gzk/cli
```

Provides the `0gzk` binary.

## Configuration

Uploads require a funded wallet on the chosen 0G network. Defaults target **0G mainnet** (chain ID 16661):

```bash
export OG_PRIVATE_KEY=0x...                 # required for `0gzk publish`
export OG_NETWORK=mainnet                   # default; set to "testnet" for Galileo
# Optional overrides:
# export OG_RPC_URL=https://evmrpc.0g.ai
# export OG_INDEXER_URL=https://indexer-storage-turbo.0g.ai
# export OGZK_CACHE_DIR=$HOME/.0gzk/bundles # bundle cache for `0gzk prove --root-hash`
```

Downloads do not require a key.

### Galileo testnet

```bash
export OG_NETWORK=testnet
# Defaults flip to:
#   OG_RPC_URL=https://evmrpc-testnet.0g.ai
#   OG_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
```

Get testnet 0G from the [official faucet](https://faucet.0g.ai).

## Commands

### `0gzk publish <bundleDir>`

Pack a `circuit_bundle/` directory and upload it to 0G Storage.

```bash
0gzk publish ./circuit_bundle
# -> rootHash, txHash, txSeq, explorer link
# -> writes .published.json receipt into the bundle dir (suppress with --no-receipt)
```

### `0gzk fetch <rootHash> [outputDir]`

Download a bundle by root hash and untar it.

```bash
0gzk fetch 0x5aa4e2... /tmp/0gzk-fetched
```

### `0gzk prove <inputFile>`

Validate inputs against the circuit's `metadata.inputs`, run `snarkjs.groth16.fullProve` in-process, then verify locally. Writes `proof.json`, `public.json`, and a `result.json` summary.

```bash
# Local bundle
0gzk prove --bundle ./circuit_bundle ./example_input.json

# Remote bundle (cached on first run, reused after)
0gzk prove --root-hash 0x5aa4e2... ./example_input.json
```

Useful flags:

- `--out <dir>` — output dir (default `./proof-<timestamp>/`).
- `--no-verify` — skip local verification.
- `--network <mainnet|testnet>` — override the 0G network for `--root-hash`.
- `--indexer-url <url>` — override the indexer endpoint.

The emitted `proof.json` and `public.json` are byte-compatible with the standalone `snarkjs` CLI, so any third party can verify them with `snarkjs groth16 verify`.

## License

[MIT](./LICENSE)
