export type InputVisibility = "public" | "private";

export interface InputSpec {
  type: string;
  visibility: InputVisibility;
  description?: string;
}

export interface OutputSpec {
  type: string;
  description?: string;
}

export interface CircuitMetadata {
  name: string;
  version: string;
  description?: string;
  protocol: "groth16" | "plonk" | "fflonk";
  curve: "bn128" | "bls12-381";
  inputs: Record<string, InputSpec>;
  outputs: Record<string, OutputSpec>;
  files: {
    wasm: string;
    zkey: string;
    vkey: string;
    verifier?: string;
  };
}

export interface BundleFiles {
  wasm: Uint8Array;
  zkey: Uint8Array;
  vkey: unknown;
  metadata: CircuitMetadata;
  verifier?: string;
}
