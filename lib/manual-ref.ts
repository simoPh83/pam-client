const REF_PATTERN = /^[A-Z0-9][A-Z0-9./-]{2,49}$/;

/** Mirrors the server normalisation in resolve_review_with_ref. */
export function normaliseManualRef(input: string): string {
  return input
    .trim()
    .replace(/^ref(?:erence)?\.?(?:\s*no\.?)?\s*[:.]?\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .toUpperCase();
}

export function validateManualRef(ref: string): string | null {
  if (!REF_PATTERN.test(ref) || !/\d/.test(ref)) {
    return "That doesn't look like a planning reference (3–50 characters of letters, digits, / . -, with at least one digit).";
  }
  return null;
}
