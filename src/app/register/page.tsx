"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, RefreshCw, User } from "lucide-react";
import GoogleIcon from "@/components/auth/GoogleIcon";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import AuthBrand from "@/components/auth/AuthBrand";
import { getApiErrorMessage } from "@/lib/api-error";
import { evaluatePassword, PasswordStrengthMeter } from "@/components/ui/password-validation";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleResend() {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Gagal kirim ulang email"));
      toast.success(data.message || "Email verifikasi sudah dikirim ulang.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal kirim ulang email");
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const criteria = evaluatePassword(password);
    if (!criteria.every((c) => c.met)) {
      setError("Kata sandi belum memenuhi semua kriteria");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Pendaftaran gagal"));

      // Don't auto-login — user must verify email first
      setRegistered(true);
      toast.success(data.message || "Pendaftaran berhasil. Cek email untuk verifikasi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pendaftaran gagal");
      toast.error(err instanceof Error ? err.message : "Pendaftaran gagal");
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,color-mix(in_oklch,var(--color-primary)_18%,transparent),transparent_30rem),linear-gradient(180deg,var(--color-background),color-mix(in_oklch,var(--color-background)_78%,var(--color-card)))] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
        <AuthBrand />

        <Card className="border-border bg-card/95 shadow-2xl shadow-primary/10">
          <CardContent className="pt-8 text-center">
              <div className="w-14 h-14 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Mail className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Cek email kamu</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Kami sudah mengirim link verifikasi ke <span className="font-medium text-foreground">{email}</span>.
                Klik link itu untuk mengaktifkan akun kamu, lalu login.
              </p>
              <Link href="/login" className={buttonVariants({ variant: "default", className: "h-11 w-full" })}>
                Masuk sekarang
              </Link>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 mt-3"
                onClick={handleResend}
                disabled={resending}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${resending ? "animate-spin" : ""}`} />
                {resending ? "Mengirim ulang..." : "Kirim ulang email verifikasi"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,color-mix(in_oklch,var(--color-primary)_18%,transparent),transparent_30rem),linear-gradient(180deg,var(--color-background),color-mix(in_oklch,var(--color-background)_78%,var(--color-card)))] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <AuthBrand />

        <Card className="bg-card ring-1 ring-border/40">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">Buat akun</CardTitle>
            <p className="text-sm text-muted-foreground">Gateway AI satu pintu untuk semua model</p>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => window.location.href = "/api/auth/google"}
            >
              <GoogleIcon className="w-5 h-5 mr-2" />
              Daftar dengan Google
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">atau</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Nama</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama kamu"
                    className="pl-9 h-11 bg-background"
                    required
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-9 bg-background"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Kata sandi</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-10 bg-background"
                    required
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {password && (
                  <>
                    <PasswordStrengthMeter score={evaluatePassword(password).filter((c) => c.met).length} />
                    <div className="space-y-1">
                      {evaluatePassword(password).map((c) => (
                        <p key={c.id} className={`text-xs ${c.met ? "text-success" : "text-muted-foreground"}`}>
                          {c.met ? "✓" : "○"} {c.label}
                        </p>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Membuat akun..." : "Buat Akun"}
                {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground text-center mt-6">
              Sudah punya akun?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Masuk
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
