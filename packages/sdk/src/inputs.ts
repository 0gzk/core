import type { CircuitMetadata } from "./types.js";

export type ValidatedScalar = string | number | bigint;
export type ValidatedValue = ValidatedScalar | ValidatedScalar[];
export type ValidatedInputs = Record<string, ValidatedValue>;

export class InputValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Input validation failed:\n  - ${issues.join("\n  - ")}`);
    this.name = "InputValidationError";
    this.issues = issues;
  }
}

function coerceUint(name: string, value: unknown, issues: string[]): bigint | null {
  if (typeof value === "bigint") {
    if (value < 0n) {
      issues.push(`${name}: uint cannot be negative (got ${value.toString()})`);
      return null;
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      issues.push(`${name}: uint must be a finite integer (got ${value})`);
      return null;
    }
    if (value < 0) {
      issues.push(`${name}: uint cannot be negative (got ${value})`);
      return null;
    }
    return BigInt(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      issues.push(`${name}: uint string must be digits only (got "${value}")`);
      return null;
    }
    return BigInt(trimmed);
  }
  issues.push(
    `${name}: expected uint (number | bigint | digit string), got ${typeof value}`,
  );
  return null;
}

function coerceBool(name: string, value: unknown, issues: string[]): bigint | null {
  if (typeof value === "boolean") return value ? 1n : 0n;
  if (value === 0 || value === 1) return BigInt(value);
  if (value === "0" || value === "1") return BigInt(value);
  issues.push(`${name}: expected bool (true/false/0/1), got ${JSON.stringify(value)}`);
  return null;
}

export function validateInputs(
  raw: Record<string, unknown>,
  metadata: CircuitMetadata,
): ValidatedInputs {
  const issues: string[] = [];
  const result: ValidatedInputs = {};
  const expectedKeys = new Set(Object.keys(metadata.inputs));
  const providedKeys = new Set(Object.keys(raw));

  for (const key of expectedKeys) {
    if (!providedKeys.has(key)) {
      issues.push(`Missing required input: ${key}`);
    }
  }

  for (const key of providedKeys) {
    if (!expectedKeys.has(key)) {
      issues.push(`Unknown input: ${key} (not in circuit schema)`);
    }
  }

  for (const [key, spec] of Object.entries(metadata.inputs)) {
    if (!providedKeys.has(key)) continue;
    const value = raw[key];

    switch (spec.type) {
      case "uint": {
        const coerced = coerceUint(key, value, issues);
        if (coerced !== null) result[key] = coerced.toString();
        break;
      }
      case "bool": {
        const coerced = coerceBool(key, value, issues);
        if (coerced !== null) result[key] = coerced.toString();
        break;
      }
      default: {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "bigint"
        ) {
          result[key] = value as ValidatedScalar;
        } else {
          issues.push(
            `${key}: unsupported type "${spec.type}" with non-scalar value`,
          );
        }
      }
    }
  }

  if (issues.length > 0) throw new InputValidationError(issues);
  return result;
}
