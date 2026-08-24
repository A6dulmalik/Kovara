export function normalizeStellarAddress(address: string): string {
  if (!address) return '';
  return address.trim().toUpperCase();
}

export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}
