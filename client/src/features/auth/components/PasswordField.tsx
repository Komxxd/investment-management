import React, { useState } from 'react';
import { Check, Circle, Eye, EyeOff } from 'lucide-react';
import { evaluatePassword, type PasswordStrengthTier } from '../../../utils/passwordPolicy';

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  rightLabelAction?: React.ReactNode;
}

/**
 * Password input with built-in accessible visibility toggle (Eye / EyeOff)
 * and optional top-right action slot (e.g. Forgot password).
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete,
  required = true,
  minLength,
  rightLabelAction,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label htmlFor={id} className="block text-xs font-medium text-secondary">
          {label}
        </label>
        {rightLabelAction}
      </div>

      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className="w-full bg-background border border-divider rounded-xl pl-3 pr-10 py-2 text-xs sm:text-sm text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          title={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-tertiary hover:text-primary transition-colors cursor-pointer"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

const TIER_SEGMENT_STYLE: Record<PasswordStrengthTier, { activeBars: number; colorClass: string; textClass: string }> = {
  empty: { activeBars: 0, colorClass: 'bg-divider', textClass: 'text-tertiary' },
  weak: { activeBars: 1, colorClass: 'bg-danger', textClass: 'text-danger' },
  fair: { activeBars: 2, colorClass: 'bg-amber-500', textClass: 'text-amber-500' },
  good: { activeBars: 3, colorClass: 'bg-emerald-500/80', textClass: 'text-emerald-500' },
  strong: { activeBars: 4, colorClass: 'bg-success', textClass: 'text-success' },
};

/**
 * Displays a 4-segment password strength indicator and live 5-rule checklist.
 */
export function PasswordRequirements({ password }: { password: string }) {
  const evaluation = evaluatePassword(password);
  const style = TIER_SEGMENT_STYLE[evaluation.tier];

  return (
    <div className="p-3 rounded-xl bg-background border border-divider space-y-2.5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-secondary font-medium">Password requirements</span>
          {evaluation.tierLabel && (
            <span className={`font-mono font-semibold ${style.textClass}`}>
              {evaluation.tierLabel}
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((bar) => (
            <span
              key={bar}
              className={`h-1 rounded-full transition-colors ${
                bar <= style.activeBars ? style.colorClass : 'bg-divider'
              }`}
            />
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {evaluation.results.map((rule) => (
          <li
            key={rule.id}
            className={`flex items-center gap-1.5 text-[11px] transition-colors ${
              rule.met ? 'text-success font-medium' : 'text-secondary'
            }`}
          >
            {rule.met ? (
              <Check className="w-3 h-3 shrink-0 text-success" />
            ) : (
              <Circle className="w-2.5 h-2.5 shrink-0 text-tertiary" />
            )}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
