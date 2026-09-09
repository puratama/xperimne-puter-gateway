"use client";

import { useEffect, useState } from "react";
import {
  Crown, Coins, RefreshCw, Wallet, Check, X, ArrowUpRight,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/components/ui/format-currency";

interface CatalogPlan {
  id: string;
  name: string;
  description: string | null;
  billingPeriod: string;
  price: number;
  features: {
    maxTokensPerMonth: number;
    allowedModels: string[];
    allModels: boolean;
    allowedProviders: string[];
    allProviders: boolean;
    streaming: boolean;
    imageGeneration: boolean;
    highlights: string[];
  };
}

const billingLabel = (period: string) => {
  switch (period) {
    case "daily":
      return "1 hari";
    case "weekly":
      return "1 minggu";
    case "yearly":
      return "1 tahun";
    default:
      return "1 bulan";
  }
};

export default function PlanPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<CatalogPlan[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<CatalogPlan | null>(null);
  const [error, setError] = useState("");

  const loadBalance = async () => {
    try {
      const res = await fetch("/api/user/plans");
      if (res.ok) {
        const json = (await res.json()) as { balance?: number };
        setBalance(json.balance ?? 0);
      }
    } catch {
      // balance tidak kritis; halaman tetap berfungsi
    }
  };

  const loadCatalog = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Gagal memuat paket");
      const json = (await res.json()) as { plans?: CatalogPlan[] };
      setPlans(json.plans ?? []);
    } catch {
      setError("Gagal memuat paket");
    }
    setLoading(false);
  };

  const buy = async (planId: string) => {
    setBuying(planId);
    setError("");
    try {
      const res = await fetch("/api/packages/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string | { message?: string };
        } | null;
        throw new Error(getApiErrorMessage(err, "Gagal membeli paket"));

      }
      toast.success("Berhasil membeli paket");
      await loadBalance();
      router.push("/my/plan");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membeli paket");
    } finally {
      setBuying(null);
    }
  };

  useEffect(() => { void loadBalance(); void loadCatalog(); }, []);

  return (
    <AppShell variant="user">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Crown className="h-4 w-4 text-primary" /> Package
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Paket Token</h1>
              <p className="text-sm text-muted-foreground">Pilih paket token, bayar dari saldo wallet.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" /> Saldo: {formatCurrency(balance)}
              </span>
              <Link href="/my/wallet">
                <Button variant="outline" size="sm">Isi saldo</Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => void loadCatalog()}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
          </header>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          {/* Katalog */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="space-y-3 p-5">
                    <div className="h-4 w-2/3 rounded bg-muted" />
                    <div className="h-2 w-full rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : plans.length === 0 ? (
            <EmptyState
              icon={Coins}
              title="Belum ada paket tersedia"
              description="Belum ada paket token. Admin sedang menyiapkan paket — coba lagi nanti."
              action={
                <Button variant="outline" size="sm" onClick={() => void loadCatalog()}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const popular = plan.name.toLowerCase().includes("pro");
                return (
                  <Card
                    key={plan.id}
                    style={{ "--card-spacing": "0px" } as React.CSSProperties}
                    className={cn(
                      "p-0 transition-all duration-200",
                      popular
                        ? "ring-2 ring-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-primary)_10%,transparent)]"
                        : "hover:-translate-y-0.5 hover:ring-primary/50 hover:bg-card/80 hover:shadow-[0_8px_30px_-12px_color-mix(in_oklch,var(--color-primary)_25%,transparent)]"
                    )}
                  >
                    <div className="flex h-full flex-col gap-6 p-8">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
                        {popular && <Badge>Populer</Badge>}
                      </div>

                      {plan.description && (
                        <p className="text-sm leading-relaxed text-muted-foreground">{plan.description}</p>
                      )}

                      <div>
                        <div className="text-4xl font-bold tracking-tight lg:text-4xl">
                          {plan.price === 0 ? "Gratis" : formatCurrency(plan.price)}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">Berlaku {billingLabel(plan.billingPeriod)}</p>
                      </div>

                      {plan.features.highlights.length > 0 && (
                        <ul className="space-y-3 border-t border-border/40 pt-5 text-sm">
                          {plan.features.highlights.map((h) => (
                            <li key={h} className="flex items-start gap-2.5">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <span className="text-muted-foreground">{h}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <Button
                        className="mt-auto w-full"
                        disabled={buying !== null}
                        onClick={() => setConfirmPlan(plan)}
                      >
                        Pilih Paket <ArrowUpRight />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Konfirmasi pembelian */}
      <Dialog open={!!confirmPlan} onOpenChange={(o) => { if (!o) setConfirmPlan(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembelian</DialogTitle>
            {/* <DialogDescription>
              Beli paket <span className="font-medium text-foreground">{confirmPlan?.name}</span> seharga{" "}
              <span className="font-medium text-foreground">
                {confirmPlan?.price === 0 ? "Gratis" : formatCurrency(confirmPlan?.price ?? 0)}
              </span>
              ? Biaya akan dipotong langsung dari saldo wallet kamu (saldo saat ini: {formatCurrency(balance)}).
            </DialogDescription> */}
          </DialogHeader>
          <div className="px-6 py-4">
            <p>
              Beli paket{" "}
              <span>{confirmPlan?.name}</span>{" "}
              seharga{" "}
              <span>{formatCurrency(confirmPlan?.price ?? 0)}</span>
              ? Biaya akan dipotong langsung dari saldo wallet kamu (saldo saat ini: {formatCurrency(balance)}).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPlan(null)}>Batal</Button>
            <Button
              disabled={buying !== null}
              onClick={() => {
                const plan = confirmPlan;
                setConfirmPlan(null);
                if (plan) void buy(plan.id);
              }}
            >
              <Coins className="h-3.5 w-3.5" /> {buying !== null ? "Memproses..." : "Ya, Beli"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
