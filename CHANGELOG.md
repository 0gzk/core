# Changelog

All notable changes to this project will be documented in this file. The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 0.1.0 - 2026-04-26

### Added

- `@0gzk/sdk` — initial publishable SDK with two surfaces:
  - **Isomorphic** (`@0gzk/sdk`): `generateProof`, `verifyLocal`, `validateInputs`, `InputValidationError`, and circuit/bundle types. Wraps `snarkjs.groth16` with metadata-driven input validation.
  - **Node-only** (`@0gzk/sdk/node`): `uploadBundle`/`fetchBundle` against 0G Storage via `@0gfoundation/0g-ts-sdk`, plus `loadConfig`, `readBundleFromDir`, and the network preset table.
- `@0gzk/cli` — the `0gzk` binary with `publish`, `fetch`, and `prove` commands. Bundle disk cache at `~/.0gzk/bundles/<rootHash>/`, override via `OGZK_CACHE_DIR`.
- Reference circuit `age_verification` plus a one-shot `build.sh` that handles `circom` compilation, Powers of Tau download with integrity check, `snarkjs` trusted setup, and tarball-friendly bundle layout.
- README entries for SDK and CLI; MIT LICENSE.

### Changed

- Renamed CLI binary and identifier from `zkpipe` to `0gzk`. Cache env var renamed `ZKPIPE_CACHE_DIR` -> `OGZK_CACHE_DIR`. Cache dir on disk renamed `~/.zkpipe/bundles` -> `~/.0gzk/bundles`.
- Internal package `@0gzk/core` extracted/renamed to publishable `@0gzk/sdk` and split into isomorphic + Node-only surfaces.
- `snarkjs`, `@0gfoundation/0g-ts-sdk`, and `ethers` are now `peerDependencies` of `@0gzk/sdk` (latter two optional). The CLI carries them as direct dependencies so `npm i -g @0gzk/cli` is one command.
