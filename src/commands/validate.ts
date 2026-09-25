// Minimal JSON Schema validator covering the subset our tool schemas use.
import type { JSONSchema } from "./definitions";

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number" && Number.isInteger(value)) return "integer";
  return typeof value;
}

function matchesType(value: unknown, type: string): boolean {
  const actual = typeOf(value);
  if (type === "number") return actual === "number" || actual === "integer";
  return actual === type;
}

/** Returns an error message, or null when `value` satisfies `schema`. */
export function validate(value: unknown, schema: JSONSchema, path = "params"): string | null {
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) return `${path} must be ${types.join(" or ")}, got ${typeOf(value)}`;
  }
  if (schema.enum && !schema.enum.includes(value)) return `${path} must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}`;
  if (typeof value === "string" && schema.minLength !== undefined && value.length < schema.minLength)
    return `${path} must not be empty`;
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) return `${path} must be >= ${schema.minimum}`;
    if (schema.maximum !== undefined && value > schema.maximum) return `${path} must be <= ${schema.maximum}`;
  }
  if (typeOf(value) === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (obj[key] === undefined) return `${path}.${key} is required`;
    for (const [key, v] of Object.entries(obj)) {
      const sub = schema.properties?.[key];
      if (!sub) {
        if (schema.additionalProperties === false) return `${path}.${key} is not a known parameter`;
        continue;
      }
      if (v === undefined) continue;
      const err = validate(v, sub, `${path}.${key}`);
      if (err) return err;
    }
  }
  if (Array.isArray(value) && schema.items) {
    for (let i = 0; i < value.length; i++) {
      const err = validate(value[i], schema.items, `${path}[${i}]`);
      if (err) return err;
    }
  }
  return null;
}
