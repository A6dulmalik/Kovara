export interface PoolValidationResult { valid: boolean; errors: string[]; }

export function validatePoolAdmins(admins: unknown): PoolValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(admins)) {
    errors.push("admins must be an array");
    return { valid: false, errors };
  }
  if (admins.length === 0) errors.push("admins must not be empty");
  const seen = new Set<string>();
  for (const [i, a] of admins.entries()) {
    if (typeof a !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(a)) {
      errors.push(`invalid address at ${i}`);
    } else {
      const k = a.toLowerCase();
      if (seen.has(k)) errors.push(`duplicate address at ${i}`);
      seen.add(k);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validatePoolThreshold(threshold: unknown, adminCount: number): PoolValidationResult {
  const errors: string[] = [];
  if (typeof threshold !== "number" || !Number.isInteger(threshold)) {
    errors.push("threshold must be an integer");
    return { valid: false, errors };
  }
  if (threshold < 1) errors.push("threshold must be at least 1");
  if (threshold > adminCount) errors.push("threshold cannot exceed admin count");
  return { valid: errors.length === 0, errors };
}
