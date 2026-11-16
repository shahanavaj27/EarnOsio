export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 15;

export interface UsernameValidationResult {
  valid: boolean;
  normalized: string;
  error: string | null;
}

export function sanitizeUsernameInput(raw: string): string {
  return raw.replace(/[\r\n]+/g, '').slice(0, MAX_USERNAME_LENGTH);
}

export function validateUsername(raw: string): UsernameValidationResult {
  const normalized = raw.trim();

  if (normalized.length === 0) {
    return {
      valid: false,
      normalized,
      error: 'Please enter your username before playing.',
    };
  }

  if (normalized.length < MIN_USERNAME_LENGTH) {
    return {
      valid: false,
      normalized,
      error: `Username must be at least ${MIN_USERNAME_LENGTH} characters long.`,
    };
  }

  if (normalized.length > MAX_USERNAME_LENGTH) {
    return {
      valid: false,
      normalized,
      error: `Username cannot exceed ${MAX_USERNAME_LENGTH} characters.`,
    };
  }

  return {
    valid: true,
    normalized,
    error: null,
  };
}
