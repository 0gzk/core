# @0gzk/sdk

ZK Groth16 prover and 0G Storage helpers for the [0gzk](https://github.com/0gzk/0gzk) ZK Proof-as-a-Service platform. Two surfaces:

- **`@0gzk/sdk`** — isomorphic (Node + browser): `generateProof`, `verifyLocal`, `validateInputs`, and circuit/bundle types. Wraps `snarkjs.groth16` with input validation against the bundle's `metadata.json`.
- **`@0gzk/sdk/node`** — Node-only: `uploadBundle` and `fetchBundle` for 0G Storage round-trips, plus `loadConfig`/`readBundleFromDir` helpers.

Witness data never leaves the process — proofs are generated client-side and only `proof + publicSignals` go anywhere else.

## Install

```bash
npm i @0gzk/sdk snarkjs
# or, for Node uploads/downloads:
npm i @0gzk/sdk snarkjs @0gfoundation/0g-ts-sdk ethers
```

`snarkjs` is a hard peer. `@0gfoundation/0g-ts-sdk` and `ethers` are optional peers — only required if you import from `@0gzk/sdk/node`.

## Generate a proof (isomorphic)

```ts
import { generateProof, verifyLocal, type BundleFiles } from "@0gzk/sdk";

// Get bundle bytes however you like - fetch them from 0G, embed at build
// time, or load from disk via @0gzk/sdk/node's `readBundleFromDir`.
const bundle: BundleFiles = {
  wasm,            // Uint8Array of circuit.wasm
  zkey,            // Uint8Array of circuit_final.zkey
  vkey,            // parsed verification_key.json
  metadata,        // parsed metadata.json (CircuitMetadata)
};

const inputs = { birthYear: 1990, currentYear: 2026, minAge: 18 };
const { proof, publicSignals } = await generateProof(bundle, inputs);
const ok = await verifyLocal(bundle, { proof, publicSignals });
```

`generateProof` validates `inputs` against `metadata.inputs` (`uint`/`bool` coercion, missing/unknown key detection) before calling `snarkjs.groth16.fullProve`. Bad input throws `InputValidationError` with a list of all problems.

## Fetch a bundle from 0G Storage (Node-only)

```ts
import { fetchBundle, loadConfig } from "@0gzk/sdk/node";

const config = loadConfig();   // reads OG_NETWORK / OG_RPC_URL / OG_INDEXER_URL
const bundle = await fetchBundle(rootHash, config, "/tmp/my-bundle");
```

Set `OG_PRIVATE_KEY` in your environment if you also need to `uploadBundle`. `loadConfig` is a thin wrapper over `process.env`; load `.env` yourself with `dotenv` if you want.

## Browser usage

In Next.js or another bundler, import only from `@0gzk/sdk` (not `/node`). You'll likely also want webpack fallbacks for snarkjs:

```js
// next.config.js
config.resolve.fallback = { ...config.resolve.fallback, fs: false, readline: false };
```

## License

[MIT](./LICENSE)
