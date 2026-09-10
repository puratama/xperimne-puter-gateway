"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import AuthBrand from "@/components/auth/AuthBrand";
import { getApiErrorMessage } from "@/lib/api-error";
import { evaluatePassword, PasswordStrengthMeter } from "@/components/ui/password-validation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter");
      return;
    }
    const criteria = evaluatePassword(password);
    if (!criteria.every((c) => c.met)) {
      setError("Kata sandi belum memenuhi semua kriteria");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi kata sandi tidak cocok");
      return;
    }
    if (!token) {
      setError("Token tidak ditemukan. Buka link reset dari email kamu.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "Gagal reset kata sandi"));
      }
      toast.success(data.message || "Kata sandi berhasil diubah.");
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal reset kata sandi");
      toast.error(err instanceof Error ? err.message : "Gagal reset kata sandi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,color-mix(in_oklch,var(--color-primary)_18%,transparent),transparent_30rem),linear-gradient(180deg,var(--color-background),color-mix(in_oklch,var(--color-background)_78%,var(--color-card)))] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <AuthBrand />

        <Card className="border-border bg-card/95 shadow-2xl shadow-primary/10">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl">Reset kata sandi</CardTitle>
            <p className="text-sm text-muted-foreground">Buat kata sandi baru untuk akun kamu</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Kata sandi baru</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-10 h-11 bg-background"
                    required
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

              <div className="space-y-2">
                <Label htmlFor="confirm">Konfirmasi kata sandi</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={show ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-10 bg-background"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Menyimpan..." : "Reset kata sandi"}
                {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground text-center mt-6">
              <Link href="/login" className="text-primary hover:underline font-medium">
                Kembali ke login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
