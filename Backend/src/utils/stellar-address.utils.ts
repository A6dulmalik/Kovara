export function normalizeStellarAddress(address: string): string {
  if (!address) return '';
  return address.trim().toUpperCase();
}

export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}

export function validateAdminList(admins: string[]): boolean {
  if (!Array.isArray(admins) || admins.length === 0) return false;
  const seen = new Set<string>();
  for (const admin of admins) {
    const normalized = normalizeStellarAddress(admin);
    if (!normalized || !isValidStellarAddress(normalized)) return false;
    if (seen.has(normalized)) return false;
    seen.add(normalized);
  }
  return true;
}

export function validateThreshold(threshold: number, adminCount: number): boolean {
  return Number.isInteger(threshold) && threshold >= 1 && threshold <= adminCount;
}
