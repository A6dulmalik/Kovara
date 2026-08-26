export const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'kovara',
  'support',
  'api',
  'system',
  'root',
  'moderator',
];

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateUsername(username: string): ValidationResult {
  if (!username) {
    return { isValid: false, error: 'Username is required.' };
  }

  // Length check: 3 to 20 characters
  if (username.length < 3 || username.length > 20) {
    return { isValid: false, error: 'Username must be between 3 and 20 characters long.' };
  }

  // Character check: Alphanumeric and underscores only (no spaces or special symbols)
  const regex = /^[a-zA-Z0-9_]+$/;
  if (!regex.test(username)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, and underscores.' };
  }

  // Reserved name check
  if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
    return { isValid: false, error: 'This username is reserved and cannot be used.' };
  }

  return { isValid: true };
}