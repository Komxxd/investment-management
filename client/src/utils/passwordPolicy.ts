export interface PasswordRule {
  id: 'length' | 'upper' | 'lower' | 'number' | 'special';
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: '8+ characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'Uppercase (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Lowercase (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'Number (0–9)', test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'Special (!@#$…)', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

export type PasswordStrengthTier = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordEvaluation {
  results: Array<{ id: PasswordRule['id']; label: string; met: boolean }>;
  metCount: number;
  allMet: boolean;
  tier: PasswordStrengthTier;
  tierLabel: string;
  firstError: string | null;
}

const RULE_ERROR_MESSAGES: Record<PasswordRule['id'], string> = {
  length: 'Password must be at least 8 characters long.',
  upper: 'Password must include at least one uppercase letter.',
  lower: 'Password must include at least one lowercase letter.',
  number: 'Password must include at least one number.',
  special: 'Password must include at least one special character.',
};

/**
 * Evaluates a candidate password against all required complexity rules
 * and computes a discrete strength tier for UI feedback.
 */
export function evaluatePassword(password: string): PasswordEvaluation {
  const results = PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(password),
  }));

  const metCount = results.filter((r) => r.met).length;
  const allMet = metCount === PASSWORD_RULES.length;
  const firstUnmet = results.find((r) => !r.met);

  let tier: PasswordStrengthTier = 'empty';
  let tierLabel = '';

  if (password.length > 0) {
    if (allMet && password.length >= 10) {
      tier = 'strong';
      tierLabel = 'Strong';
    } else if (allMet || metCount >= 4) {
      tier = allMet ? 'strong' : 'good';
      tierLabel = allMet ? 'Strong' : 'Good';
    } else if (metCount >= 2) {
      tier = 'fair';
      tierLabel = 'Fair';
    } else {
      tier = 'weak';
      tierLabel = 'Weak';
    }
  }

  return {
    results,
    metCount,
    allMet,
    tier,
    tierLabel,
    firstError: firstUnmet ? RULE_ERROR_MESSAGES[firstUnmet.id] : null,
  };
}

