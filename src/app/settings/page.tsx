"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  User,
  Shield,
  Settings as SettingsIcon,
  Loader2,
  KeyRound,
  Mail,
  UserCircle,
  Check,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api-error";
import { Tabs } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { evaluatePassword, PasswordStrengthMeter } from "@/components/ui/password-validation";
import { Badge } from "@/components/ui/badge";
import GoogleIcon from "@/components/auth/GoogleIcon";
import { toast } from "sonner";

type Tab = "profile" | "security";

/* ------------------------------------------------------------------ */
/*  PROFILE TAB                                                        */
/* ------------------------------------------------------------------ */

function ProfileTab({ onProvider }: { onProvider?: (p: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("email");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setName(data.user.name ?? "");
          setEmail(data.user.email ?? "");
          setProvider(data.user.provider ?? "email");
          onProvider?.(data.user.provider ?? "email");
        }
      })
      .finally(() => setLoading(false));
  }, [onProvider]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        toast.success("Profil berhasil diperbarui.");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(getApiErrorMessage(data, "Gagal memperbarui profil."));
      }
    } catch {
      toast.error("Kesalahan jaringan. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-9 w-28" />
      </div>
    );
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* User identity header */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-semibold ring-2 ring-primary/20">
          {initials || <UserCircle className="h-8 w-8" />}
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold truncate">{name || "Pengguna tanpa nama"}</p>
          <p className="text-sm text-muted-foreground truncate">{email}</p>
          <div className="mt-1.5">
            {provider === "google" ? (
              <Badge variant="default" size="sm">
                <GoogleIcon className="w-3 h-3" />
                Google
              </Badge>
            ) : (
              <Badge variant="secondary" size="sm">
                <Mail className="w-3 h-3" />
                Email
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Editable fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-name">Nama</Label>
          <Input
            id="settings-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Masukkan nama"
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-email">Email</Label>
          <div className="relative">
            <Input
              id="settings-email"
              type="email"
              value={email}
              disabled
              className="bg-muted/50 text-muted-foreground cursor-not-allowed pr-10"
              placeholder="you@example.com"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                Locked
              </span>
            </div>
          </div>
          {/* <p className="text-xs text-muted-foreground">Contact support to change your email address.</p> */}
        </div>

        {/* Google link hint */}
        {provider === "email" && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
            <GoogleIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Link akun Google Anda</span> — masuk dengan akun Google Anda untuk mengakses akun Anda.
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
          Simpan Perubahan
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SECURITY TAB                                                       */
/* ------------------------------------------------------------------ */

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  error?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn("bg-background pr-10", error && "border-destructive/50 focus-visible:ring-destructive/50")}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function SecurityTab({ provider }: { provider: string }) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPwError, setCurrentPwError] = useState(false);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setHasPassword(data.user.hasPassword ?? false);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const isSettingPassword = provider === "google" && hasPassword === false;

  const criteria = evaluatePassword(newPassword);
  const allCriteriaMet = criteria.every((c) => c.met);
  const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const hasInput = newPassword.length > 0;
  const showRequirements = hasInput;
  const showStrength = hasInput;

  // Button is enabled only when all criteria are met + passwords match + current password is filled (when required)
  const currentPwValid = isSettingPassword || currentPassword.length > 0;
  const canSubmit = allCriteriaMet && passwordsMatch && currentPwValid && !saving;

  const handleSave = useCallback(async () => {
    setCurrentPwError(false);

    if (!newPassword) {
      toast.error("Kata sandi baru tidak boleh kosong.");
      return;
    }
    if (!allCriteriaMet) {
      toast.error("Kata sandi tidak memenuhi semua persyaratan keamanan.");
      return;
    }
    if (!passwordsMatch) {
      toast.error("Kata sandi baru tidak cocok.");
      return;
    }
    if (!currentPwValid) {
      setCurrentPwError(true);
      toast.error("Masukkan kata sandi saat ini.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = { newPassword };
      if (!isSettingPassword) {
        body.currentPassword = currentPassword;
      }
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        if (isSettingPassword) {
          toast.success("Kata sandi berhasil diatur. Anda dapat masuk menggunakan email dan kata sandi.");
          setHasPassword(true);
        } else {
          toast.success("Kata sandi diperbarui. Silakan masuk lagi.");
          window.location.href = "/login";
          return;
        }
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = getApiErrorMessage(data, "Gagal mengubah kata sandi.");
        if (msg.toLowerCase().includes("current password")) {
          setCurrentPwError(true);
        }
        toast.error(msg);
      }
      } catch {
        toast.error("Kesalahan jaringan. Silakan coba lagi.");
      } finally {
        setSaving(false);
    }
  }, [isSettingPassword, currentPassword, newPassword, confirmPassword, allCriteriaMet, passwordsMatch, currentPwValid]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-9 w-28" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">
            {isSettingPassword ? "Atur Kata Sandi" : "Ganti Kata Sandi"}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {isSettingPassword
            ? "Tambahkan kata sandi untuk mengaktifkan login menggunakan email/kata sandi sebagai alternatif selain Google."
            : "Anda akan diminta untuk masuk kembali setelah mengubah kata sandi."}
        </p>
      </div>

      {/* Current password — only for change */}
      {!isSettingPassword && (
        <PasswordInput
          id="settings-current-pw"
          label="Kata Sandi Saat Ini"
          value={currentPassword}
          onChange={(v) => { setCurrentPassword(v); setCurrentPwError(false); }}
          placeholder="Masukkan kata sandi saat ini"
          autoComplete="current-password"
          error={currentPwError}
        />
      )}

      {/* New password */}
      <PasswordInput
        id="settings-new-pw"
        label={isSettingPassword ? "Buat Kata Sandi" : "Kata Sandi Baru"}
        value={newPassword}
        onChange={setNewPassword}
        placeholder={isSettingPassword ? "Buat kata sandi yang kuat" : "Masukkan kata sandi baru"}
        autoComplete="new-password"
      />

      {/* Strength meter */}
      {showStrength && (
        <PasswordStrengthMeter score={criteria.filter((c) => c.met).length} />
      )}

      {/* Confirm password */}
      <div className="space-y-2">
        <Label htmlFor="settings-confirm-pw">{isSettingPassword ? "Konfirmasi Kata Sandi" : "Konfirmasi Kata Sandi Baru"}</Label>
        <div className="relative">
          <Input
            id="settings-confirm-pw"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={isSettingPassword ? "Ulangi kata sandi" : "Ulangi kata sandi baru"}
            className={cn(
              "bg-background",
              confirmPassword && !passwordsMatch && "border-destructive/50 focus-visible:ring-destructive/50"
            )}
            autoComplete="new-password"
          />
        </div>
        {confirmPassword && !passwordsMatch && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <X className="h-3 w-3 shrink-0" />
            {isSettingPassword ? "Kata sandi tidak cocok." : "Kata sandi baru tidak cocok."}
          </p>
        )}
        {confirmPassword && passwordsMatch && (
          <p className="text-xs text-success flex items-center gap-1">
            <Check className="h-3 w-3 shrink-0" />
            Kata sandi cocok.
          </p>
        )}
      </div>

      {/* Requirements checklist */}
      {showRequirements && (
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3.5 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2.5">
            Persyaratan Keamanan
          </p>
          {criteria.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5 text-xs">
              <div className="relative h-4 w-4 shrink-0">
                <Check
                  className={cn(
                    "h-4 w-4 transition-all duration-200",
                    c.met ? "text-success scale-100 opacity-100" : "scale-75 opacity-0"
                  )}
                />
                <X
                  className={cn(
                    "absolute inset-0 h-4 w-4 transition-all duration-200",
                    !c.met ? "text-muted-foreground/40 scale-100 opacity-100" : "scale-75 opacity-0"
                  )}
                />
              </div>
              <span
                className={cn(
                  "transition-colors duration-200",
                  c.met ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {c.label}
              </span>
            </div>
          ))}
          {/* Separator line */}
          <div className="border-t border-border/40 my-2" />
          <div className="flex items-center gap-1.5 text-xs">
            <div className="relative h-4 w-4 shrink-0">
              <Check
                className={cn(
                  "h-4 w-4 transition-all duration-200",
                  passwordsMatch ? "text-success scale-100 opacity-100" : "scale-75 opacity-0"
                )}
              />
              <X
                className={cn(
                  "absolute inset-0 h-4 w-4 transition-all duration-200",
                  !passwordsMatch ? "text-muted-foreground/40 scale-100 opacity-100" : "scale-75 opacity-0"
                )}
              />
            </div>
            <span
              className={cn(
                "transition-colors duration-200",
                passwordsMatch ? "text-foreground" : "text-muted-foreground"
              )}
              >
              Kata sandi cocok
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      {!canSubmit && hasInput && (
        <p className="text-xs text-muted-foreground mb-3">
          {!allCriteriaMet
            ? isSettingPassword ? "Kata sandi harus memenuhi semua persyaratan keamanan di atas." : "Kata sandi baru harus memenuhi semua persyaratan keamanan di atas."
            : !passwordsMatch
            ? isSettingPassword ? "Kata sandi tidak cocok." : "Kata sandi baru tidak cocok."
            : isSettingPassword ? "Masukkan kata sandi saat ini untuk melanjutkan." : "Masukkan kata sandi baru untuk melanjutkan."}
        </p>
      )}
      <Button onClick={handleSave} disabled={!canSubmit}>
        {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
        {isSettingPassword ? "Atur Kata Sandi" : "Perbarui Kata Sandi"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [provider, setProvider] = useState("email");

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "profile", label: "Profil Akun", icon: User },
    { id: "security", label: "Keamanan", icon: Shield },
  ];

  return (
    <AppShell variant="user">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <SettingsIcon className="h-4 w-4 text-primary" /> Setting
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Pengaturan</h1>
              <p className="text-sm text-muted-foreground">Pengaturan akun dan keamanan Anda.</p>
            </div>
          </header>

          <Tabs
            items={tabs.map((t) => ({ value: t.id, label: t.label, icon: t.icon }))}
            value={tab}
            onValueChange={(value) => setTab(value as Tab)}
            ariaLabel="Settings sections"
          />

          <Card>
            <CardContent className="p-6">
              <div className="max-w-md">
                {tab === "profile" && <ProfileTab onProvider={setProvider} />}
                {tab === "security" && <SecurityTab provider={provider} />}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
