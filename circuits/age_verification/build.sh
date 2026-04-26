#!/usr/bin/env bash
# Build script for the age_verification circuit.
#
# Produces a self-contained circuit_bundle/ with:
#   - circuit.wasm
#   - circuit_final.zkey
#   - verification_key.json
#   - verifier.sol
#   - metadata.json
#
# Requirements (must be on PATH):
#   - circom        (>= 2.1.x; install from https://docs.circom.io/)
#   - node + npx    (snarkjs is invoked via `npx snarkjs`)
#   - curl          (to download Powers of Tau on first run)
#
# On Windows: run via git-bash or WSL.

set -euo pipefail

CIRCUIT_NAME="age_verification"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

BUILD_DIR="$SCRIPT_DIR/build"
BUNDLE_DIR="$SCRIPT_DIR/circuit_bundle"
PTAU_CACHE_DIR="$REPO_ROOT/.cache/ptau"
PTAU_FILE="powersOfTau28_hez_final_12.ptau"
PTAU_PATH="$PTAU_CACHE_DIR/$PTAU_FILE"
# Polygon zkEVM mirror (Hermez S3 bucket was decommissioned).
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/$PTAU_FILE"
# Official blake2b hash from the snarkjs README.
PTAU_BLAKE2B="ded2694169b7b08e898f736d5de95af87c3f1a64594013351b1a796dbee393bd825f88f9468c84505ddd11eb0b1465ac9b43b9064aa8ec97f2b73e04758b8a4a"

# Where circomlib lives. Root devDeps -> root node_modules.
CIRCOMLIB_INCLUDE="$REPO_ROOT/node_modules"

if ! command -v circom >/dev/null 2>&1; then
  echo "error: circom is not installed or not on PATH." >&2
  echo "       Install it from https://docs.circom.io/getting-started/installation/" >&2
  exit 1
fi

if [ ! -d "$CIRCOMLIB_INCLUDE/circomlib" ]; then
  echo "error: circomlib not found at $CIRCOMLIB_INCLUDE/circomlib" >&2
  echo "       Run 'pnpm install' from the repo root first." >&2
  exit 1
fi

mkdir -p "$BUILD_DIR" "$BUNDLE_DIR" "$PTAU_CACHE_DIR"

echo "==> [1/6] Compiling $CIRCUIT_NAME.circom"
circom "$SCRIPT_DIR/$CIRCUIT_NAME.circom" \
  --r1cs --wasm --sym \
  -l "$CIRCOMLIB_INCLUDE" \
  -o "$BUILD_DIR"

R1CS="$BUILD_DIR/$CIRCUIT_NAME.r1cs"
WASM="$BUILD_DIR/${CIRCUIT_NAME}_js/$CIRCUIT_NAME.wasm"

if [ ! -f "$PTAU_PATH" ]; then
  echo "==> [2/6] Downloading Powers of Tau ($PTAU_FILE, ~4.6 MB)"
  TMP_PTAU="$PTAU_PATH.partial"
  if ! curl -fSL --output "$TMP_PTAU" "$PTAU_URL"; then
    rm -f "$TMP_PTAU"
    echo "error: failed to download Powers of Tau from $PTAU_URL" >&2
    exit 1
  fi
  mv "$TMP_PTAU" "$PTAU_PATH"
else
  echo "==> [2/6] Powers of Tau cache hit: $PTAU_PATH"
fi

# Verify integrity if b2sum is available; warn (don't fail) otherwise.
if command -v b2sum >/dev/null 2>&1; then
  ACTUAL_HASH="$(b2sum "$PTAU_PATH" | awk '{print $1}')"
  if [ "$ACTUAL_HASH" != "$PTAU_BLAKE2B" ]; then
    echo "error: Powers of Tau hash mismatch!" >&2
    echo "       expected: $PTAU_BLAKE2B" >&2
    echo "       actual:   $ACTUAL_HASH" >&2
    echo "       Delete $PTAU_PATH and re-run." >&2
    exit 1
  fi
  echo "    integrity: blake2b OK"
else
  echo "    warning: b2sum not installed; skipping ptau integrity check"
fi

echo "==> [3/6] Groth16 setup"
npx --yes snarkjs groth16 setup "$R1CS" "$PTAU_PATH" "$BUILD_DIR/circuit_0000.zkey"

echo "==> [4/6] Contributing to the zkey (non-interactive)"
ENTROPY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
npx --yes snarkjs zkey contribute \
  "$BUILD_DIR/circuit_0000.zkey" \
  "$BUILD_DIR/circuit_final.zkey" \
  --name="0gzk-bootstrap" \
  -v -e="$ENTROPY"

echo "==> [5/6] Exporting verification key + Solidity verifier"
npx --yes snarkjs zkey export verificationkey \
  "$BUILD_DIR/circuit_final.zkey" \
  "$BUILD_DIR/verification_key.json"

npx --yes snarkjs zkey export solidityverifier \
  "$BUILD_DIR/circuit_final.zkey" \
  "$BUILD_DIR/verifier.sol"

echo "==> [6/6] Assembling circuit_bundle/"
cp "$WASM"                                "$BUNDLE_DIR/circuit.wasm"
cp "$BUILD_DIR/circuit_final.zkey"        "$BUNDLE_DIR/circuit_final.zkey"
cp "$BUILD_DIR/verification_key.json"     "$BUNDLE_DIR/verification_key.json"
cp "$BUILD_DIR/verifier.sol"              "$BUNDLE_DIR/verifier.sol"
cp "$SCRIPT_DIR/metadata.json"            "$BUNDLE_DIR/metadata.json"

echo ""
echo "Done. Bundle ready at:"
echo "  $BUNDLE_DIR"
ls -la "$BUNDLE_DIR"
