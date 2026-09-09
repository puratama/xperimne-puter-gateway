"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Wallet,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { SectionMark } from "@/components/ui/section-mark";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/components/ui/format-currency";
import { formatDate } from "@/components/ui/format-date";

type UserPackage = {
  id: string;
  status: string;
  tokensRemaining: number;
  tokensTotal: number;
  expiresAt: string;
  createdAt: string;
  plan: PlanSummary;
};

type PlanSummary = {
  id: string;
  name: string;
  description: string | null;
  billingPeriod: string;
  price: number;
  maxTokensPerPeriod: number;
};

type MyPlanData = {
  packages: UserPackage[];
  balance: number;
};

const fmtNumber = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const fmtDate = (d: string) => formatDate(d);

const TOKEN_BAR_CONFIG = {
  ok: {
    label: "Kuota aman",
    bar: "bg-primary",
    text: "text-success",
    ring: "ring-success/20 bg-success/10",
  },
  warn: {
    label: "Kuota menipis",
    bar: "bg-warning",
    text: "text-warning",
    ring: "ring-warning/20 bg-warning/10",
  },
  danger: {
    label: "Kuota hampir habis",
    bar: "bg-destructive",
    text: "text-destructive",
    ring: "ring-destructive/20 bg-destructive/10",
  },
} as const;

function TokenBar({ used, max }: { used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const remaining = max - used;
  const tone = pct >= 90 ? "danger" : pct >= 70 ? "warn" : "ok";
  const config = TOKEN_BAR_CONFIG[tone];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Penggunaan token
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset",
            config.text,
            config.ring
          )}
        >
          {config.label}<span className="mx-1">·</span>{pct}%
        </span>
      </div>

      <Progress
        value={pct}
        indicatorClassName={config.bar}
        className="h-2.5"
        aria-label={config.label}
      />

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          Terpakai <span className="font-medium tabular-nums text-foreground">{fmtNumber(used)}</span> token
        </span>
        <span className="text-muted-foreground">
          Sisa <span className="font-semibold tabular-nums text-foreground">{fmtNumber(remaining)}</span> token
        </span>
      </div>
    </div>
  );
}

const STATUS_CONFIG: Record<string, { variant: "success" | "warning" | "secondary"; icon: typeof CheckCircle2; label: string }> = {
  active: { variant: "success", icon: CheckCircle2, label: "Aktif" },
  expired: { variant: "secondary", icon: Clock, label: "Kedaluwarsa" },
  depleted: { variant: "warning", icon: AlertTriangle, label: "Habis" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? {
    variant: "secondary" as const,
    icon: Clock,
    label: status,
  };
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} size="sm">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export default function MyPlanPage() {
  const [data, setData] = useState<MyPlanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/user/plans");
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Gagal memuat data");
        const json = (await res.json()) as MyPlanData;
        setData({ packages: json.packages ?? [], balance: json.balance ?? 0 });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat data paket token");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppShell variant="user">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Coins className="h-4 w-4 text-primary" /> My Package
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Paket Saya</h1>
              <p className="text-sm text-muted-foreground">Paket token dan saldo Anda.</p>
            </div>
            <Link href="/plan" className={cn(buttonVariants(), "gap-2")}>
              <CreditCard className="h-4 w-4" /> Beli Paket
            </Link>
          </header>

          {loading ? (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="mt-3 h-9 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-44" />
                        </div>
                        <Skeleton className="h-5 w-16" />
                      </div>
                      <Skeleton className="h-2 w-full" />
                      <Skeleton className="h-3 w-28" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : error ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-destructive">{error}</CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Ringkasan */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wallet className="h-4 w-4 text-info" /> Saldo Wallet
                    </div>
                    <div className="mt-3 text-3xl font-semibold tabular-nums">{formatCurrency(data!.balance)}</div>
                    <Link href="/my/wallet" className={cn(buttonVariants({ variant: "link", size: "sm" }), "gap-1 px-0 text-xs")}>
                      Isi saldo <ArrowRight className="h-3 w-3" />
                    </Link>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Coins className="h-4 w-4 text-success" /> Paket Aktif
                    </div>
                    <div className="mt-3 text-3xl font-semibold tabular-nums">{data!.packages.length}</div>
                    <p className="mt-1 text-xs text-muted-foreground">total paket token Anda</p>
                  </CardContent>
                </Card>
              </div>

              {/* Packages */}
              <section className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <SectionMark label="Paket Token" />
                  <span className="text-xs text-muted-foreground">
                    {data!.packages.length} paket
                  </span>
                </div>
                {data!.packages.length === 0 ? (
                  <EmptyState
                    icon={Coins}
                    title="Belum ada paket token"
                    description="Beli paket token dari halaman daftar paket untuk mulai memakai langganan token."
                    action={
                      <Link href="/plan" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
                        <Coins className="h-3.5 w-3.5" /> Beli Paket
                      </Link>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {data!.packages.map((p) => {
                      const used = p.tokensTotal - p.tokensRemaining;
                      return (
                        <Card key={p.id}>
                          <CardHeader>
                            <CardTitle>{p.plan.name}</CardTitle>
                            <CardDescription>
                              {formatCurrency(p.plan.price)} · berlaku hingga {fmtDate(p.expiresAt)}
                            </CardDescription>
                            <CardAction>
                              <StatusBadge status={p.status} />
                            </CardAction>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <TokenBar used={used} max={p.tokensTotal} />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
