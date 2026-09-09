"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { UsageBarChart } from "@/components/ui/usage-bar-chart";
import { useSiteConfig } from "@/lib/use-site-config";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  Copy,
  CreditCard,
  Key,
  Rocket,
  Settings,
  Terminal,
  Wallet,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardGridSkeleton, CardRowSkeleton, ChartSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/components/ui/format-currency";
type UsageData = {
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  byDay: Array<{ date: string; tokens: number; cost: number; requests: number }>;
};

type UserData = {
  name?: string;
  email?: string;
};

type ApiKeyRow = {
  displayKey: string;
  isActive: boolean;
};

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("id-ID");
}

function lastSevenDays(byDay: UsageData["byDay"]) {
  const today = new Date();
  const usageMap = new Map(byDay.map((day) => [day.date, day]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return usageMap.get(key) ?? { date: key, tokens: 0, cost: 0, requests: 0 };
  });
}

export default function DashboardPage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [keysLoaded, setKeysLoaded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const siteCfg = useSiteConfig();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (active) setUser(data.user);
        }
      } catch {}
      // Ambil key aktif dari DB (session auth, tanpa Bearer)
      let key = "";
      try {
        const res = await fetch("/api/user/keys");
        if (res.ok) {
          const data = await res.json();
          const keys: ApiKeyRow[] = data.keys ?? [];
          const activeKey = keys.find((k) => k.isActive) ?? keys[0];
          key = activeKey?.displayKey || "";
        }
      } catch {}

      if (!active) return;
      setApiKey(key);
      setKeysLoaded(true);

      try {
        const res = await fetch("/api/user/usage?range=week");
        if (res.ok && active) setUsage(await res.json());
      } catch {}
      if (active) setLoading(false);
    })();

    return () => { active = false; };
  }, []);

  const dailyUsage = useMemo(() => lastSevenDays(usage?.byDay || []), [usage]);

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  }

  const displayName = user?.name || "Builder";
  const maskedKey = apiKey ? `${apiKey.slice(0, 10)}••••${apiKey.slice(-6)}` : "Belum ada API key";

  return (
    <AppShell variant="user">
      <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--color-primary)_16%,transparent),transparent_32rem),radial-gradient(circle_at_bottom_right,color-mix(in_oklch,var(--color-primary)_10%,transparent),transparent_28rem)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-8">
          <section className="overflow-hidden rounded-3xl border border-border/80 bg-card/80 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="grid items-center gap-6 p-6 md:grid-cols-[1.2fr_.8fr] md:p-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Rocket className="h-3.5 w-3.5" /> Dashboard Hub
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                    {user ? (
                      <>Selamat datang, {displayName}</>
                    ) : (
                      <Skeleton className="inline-block h-10 w-72" />
                    )}
                  </h1>
                  <div className="mt-3 max-w-2xl space-y-2 text-sm leading-6 text-muted-foreground md:text-base">
                    {siteCfg.loaded ? (
                      siteCfg.tagline || "Akses Base URL, API key, dan pantau usage dalam satu dashboard."
                    ) : (
                      <>
                        <Skeleton className="h-4 w-full max-w-md" />
                        <Skeleton className="h-4 w-2/3" />
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/keys">
                    <Button size="lg" className="w-full gap-2 sm:w-auto">
                      <Key className="h-4 w-4" /> Kelola API Key
                    </Button>
                  </Link>
                  <Link href="/models">
                    <Button size="lg" variant="outline" className="w-full gap-2 sm:w-auto">
                      <CreditCard className="h-4 w-4" /> Lihat Model
                    </Button>
                  </Link>
                </div>
              </div>

              <Card className="border-primary/20 bg-background/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Terminal className="h-4 w-4 text-primary" /> Konfigurasi cepat
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Base URL", value: siteCfg.baseUrl, id: "base" },
                    { label: "API Key", value: apiKey || "Generate key dari halaman API Keys", id: "key", masked: maskedKey },
                  ].map((item) => (
                    <div key={item.id} className="rounded-xl border border-border bg-muted/30 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        <span>{item.label}</span>
                        {item.id === "base" && (
                          <Button variant="ghost" size="xs" className="uppercase" onClick={() => copy(item.value, item.id)}>
                            {copied === item.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied === item.id ? "Disalin" : "Salin"}
                          </Button>
                        )}
                      </div>
                      {(item.id === "base" && !siteCfg.loaded) || (item.id === "key" && !keysLoaded) ? (
                        <Skeleton className="h-4 w-full" />
                      ) : (
                        <code className="break-all text-sm text-foreground/90">{item.masked || item.value}</code>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            {loading ? (
              <div className="md:col-span-4">
                <CardGridSkeleton count={4} />
              </div>
            ) : (
              [
                { label: "Total Request", value: formatNumber(usage?.totalRequests || 0), icon: BarChart3 },
                { label: "Total Token", value: formatNumber(usage?.totalTokens || 0), icon: Bot },
                { label: "Total Biaya", value: formatCurrency(usage?.totalCost || 0), icon: Wallet },
                { label: "API Key", value: apiKey ? "Aktif" : "Belum ada", icon: Key },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.label} className="bg-card/75 backdrop-blur">
                    <CardContent className="p-5">
                      <Icon className="mb-4 h-5 w-5 text-primary" />
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
            <Card className="bg-card/75 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-base">Langkah selanjutnya</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? <CardRowSkeleton count={3} /> : [
                  { href: "/keys", title: "Generate API key", desc: "Buat key untuk app, server, atau IDE kamu.", icon: Key },
                  { href: "/models", title: "Pilih model dan harga", desc: "Bandingkan model dan biaya.", icon: CreditCard },
                  { href: "/settings", title: "Atur akun", desc: "Ubah profil dan preferensi aplikasi.", icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className="group flex items-center gap-4 rounded-xl border border-border bg-muted/20 p-4 transition hover:border-primary/40 hover:bg-primary/5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                    </Link>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="bg-card/75 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-base">Penggunaan 7 hari terakhir</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <ChartSkeleton />
                ) : dailyUsage.some((day) => day.tokens > 0) ? (
                  <UsageBarChart data={dailyUsage} />
                ) : (
                  <EmptyState
                    icon={BarChart3}
                    title="Belum ada penggunaan"
                    description="Panggil API pertama kamu."
                  />
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
