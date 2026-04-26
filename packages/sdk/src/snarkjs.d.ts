declare module "snarkjs" {
  export interface Groth16Proof {
    pi_a: [string, string, string];
    pi_b: [[string, string], [string, string], [string, string]];
    pi_c: [string, string, string];
    protocol: "groth16";
    curve: string;
  }

  export type WasmInput =
    | string
    | Uint8Array
    | { type: "mem"; data: Uint8Array };

  export type ZkeyInput = WasmInput;

  export interface Groth16FullProveResult {
    proof: Groth16Proof;
    publicSignals: string[];
  }

  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasm: WasmInput,
      zkey: ZkeyInput,
      logger?: unknown,
    ): Promise<Groth16FullProveResult>;
    verify(
      vkey: unknown,
      publicSignals: string[],
      proof: Groth16Proof,
      logger?: unknown,
    ): Promise<boolean>;
  };
}
