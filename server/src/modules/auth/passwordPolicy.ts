export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a new password meets minimum complexity requirements
 * before being forwarded to Supabase Auth.
 */
export function validateStrongPassword(password: string): PasswordValidationResult {
  if (typeof password !== 'string' || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must include at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must include at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must include at least one number.' };
  }
  if (!/[^A-Za-z0-9\s]/.test(password)) {
    return { valid: false, error: 'Password must include at least one special character.' };
  }
  return { valid: true };
}

