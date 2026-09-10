"use client";

import { cn } from "@/lib/utils";

export type PasswordCriteria = {
  id: string;
  label: string;
  test: (pw: string) => boolean;
};

export const PASSWORD_CRITERIA: PasswordCriteria[] = [
  { id: "length", label: "Paling sedikit 8 karakter", test: (pw) => pw.length >= 8 },
  { id: "uppercase", label: "Satu huruf besar (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { id: "lowercase", label: "Satu huruf kecil (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { id: "number", label: "Satu angka (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { id: "special", label: "Satu karakter khusus (!@#$%^&*...)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function evaluatePassword(pw: string) {
  return PASSWORD_CRITERIA.map((c) => ({ ...c, met: c.test(pw) }));
}

export function PasswordStrengthMeter({ score }: { score: number }) {
  const levels = [
    { label: "Sangat lemah", color: "bg-destructive" },
    { label: "Lemah", color: "bg-destructive" },
    { label: "Cukup", color: "bg-warning" },
    { label: "Cukup kuat", color: "bg-success" },
    { label: "Sangat kuat", color: "bg-success" },
  ];
  const level = levels[Math.min(score, levels.length) - 1] ?? levels[0];
  const activeSlots = Math.max(1, score);

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {levels.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              i < activeSlots ? level.color : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Kekuatan: <span className="font-medium text-foreground">{level.label}</span>
      </p>
    </div>
  );
}
