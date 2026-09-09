"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

import { useMemo, useState, useEffect } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  Gauge,
  Layers,
  Search,
  Sparkles,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FormSelect } from "@/components/ui/form-select";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { fetchPricingFromDB } from "@/lib/pricing-db";
import { priceLabel } from "@/lib/pricing-tiers";
import type { ModelPricing } from "@/types";

function getProviders(models: ModelPricing[]) { return Array.from(new Set(models.map((m) => m.provider))); }
function formatPrice(n: number) { return n === 0 ? "Gratis" : `Rp ${n.toLocaleString("id-ID")}`; }
function getMinPrice(models: ModelPricing[]) { return models.reduce((min, m) => Math.min(min, m.pricing.prompt), Infinity); }
function getMaxPrice(models: ModelPricing[]) { return models.reduce((max, m) => Math.max(max, m.pricing.prompt), 0); }

const speedColor = (speed: string) =>
  speed === "fast" ? "text-success" : speed === "balanced" ? "text-warning" : speed === "slow" ? "text-destructive" : "text-muted-foreground";
const speedBg = (speed: string) =>
  speed === "fast" ? "bg-success/10 border-success/20" : speed === "balanced" ? "bg-warning/10 border-warning/20" : speed === "slow" ? "bg-destructive/10 border-destructive/20" : "bg-muted/20 border-border";
const speedLabel = (speed: string) =>
  speed === "fast" ? "Fast" : speed === "balanced" ? "Balanced" : speed === "slow" ? "Slow" : speed;


export default function ModelsPage() {
  const [pricingData, setPricingData] = useState<ModelPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("all");

  const [sortBy, setSortBy] = useState<"default" | "name" | "prompt" | "completion">("default");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [compareMode, setCompareMode] = useState(false);
  const [compareList, setCompareList] = useState<string[]>([]);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  useEffect(() => {
    fetchPricingFromDB().then((data) => { setPricingData(data); setLoading(false); });
  }, []);

  const providers = useMemo(() => getProviders(pricingData), [pricingData]);

  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pricingData.forEach((m) => { counts[m.provider] = (counts[m.provider] || 0) + 1; });
    return counts;
  }, [pricingData]);

  const filteredModels = useMemo(() => {
    let result = [...pricingData];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q));
    }
    if (selectedProvider !== "all") result = result.filter((m) => m.provider === selectedProvider);
    if (sortBy !== "default") {
      result.sort((a, b) => {
        const cmp = sortBy === "name"
          ? a.name.localeCompare(b.name)
          : sortBy === "prompt"
            ? a.pricing.prompt - b.pricing.prompt
            : sortBy === "completion"
              ? a.pricing.completion - b.pricing.completion
              : 0;
        return sortOrder === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [pricingData, search, selectedProvider, sortBy, sortOrder]);

  const toggleCompare = (modelId: string) => {
    setCompareList((prev) => prev.includes(modelId) ? prev.filter((id) => id !== modelId) : prev.length < 4 ? [...prev, modelId] : prev);
  };

  const toggleSort = (field: "default" | "name" | "prompt" | "completion") => {
    if (sortBy === field) setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortOrder("asc"); }
  };

  const renderPriceBadge = (value: number, label: string) => (
    <div className="text-center">
      <p className="text-xs text-muted-foreground/70">{label}</p>
      <p className="text-sm font-semibold tabular-nums tracking-tight text-foreground">{formatPrice(value)}</p>
    </div>
  );

  const SortArrow = ({ field }: { field: "default" | "name" | "prompt" | "completion" }) =>
    sortBy === field ? (
      sortOrder === "asc" ? <ChevronUp className="ml-0.5 h-3 w-3" /> : <ChevronDown className="ml-0.5 h-3 w-3" />
    ) : null;

  return (
    <AppShell variant="user">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
          {/* Hero header */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> Model
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Daftar Model</h1>
              <p className="text-sm text-muted-foreground">Daftar model AI yang tersedia di platform kami.</p>
            </div>
            <Button
              variant={compareMode ? "destructive" : "outline"}
              onClick={() => setCompareMode(!compareMode)}
              className={cn(compareMode && "shadow-lg shadow-destructive/20")}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              {compareMode ? "Tutup Perbandingan" : "Bandingkan Model"}
            </Button>
          </header>

          {/* Stats bar */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Total Model", value: pricingData.length, icon: Layers, tone: "text-info" },
              // { label: "Total Provider", value: providers.length, icon: Layers, tone: "text-primary" },
              { label: "Harga Termurah", value: `${formatPrice(getMinPrice(pricingData) * 1000)} / 1M`, icon: Coins, tone: "text-success" },
              { label: "Harga Termahal", value: `${formatPrice(getMaxPrice(pricingData) * 1000)} / 1M`, icon: Coins, tone: "text-warning" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon className={cn("h-4 w-4", stat.tone)} /> {stat.label}
                    </div>
                    <div className={cn("mt-3 text-2xl font-semibold", loading && "animate-pulse text-muted-foreground")}>{stat.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Search + filters */}
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari model berdasarkan nama atau model id"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-10"
              />
            </div>
            {/* <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium text-muted-foreground">Provider</span>
              <FormSelect
                options={[
                  { value: "all", label: `All (${pricingData.length})` },
                  ...providers.map((p) => ({ value: p, label: `${p} (${providerCounts[p] || 0})` })),
                ]}
                value={
                  selectedProvider === "all"
                    ? { value: "all", label: `All (${pricingData.length})` }
                    : {
                        value: selectedProvider,
                        label: `${selectedProvider} (${providerCounts[selectedProvider] || 0})`,
                      }
                }
                onChange={(v) => setSelectedProvider(v ?? "all")}
                isSearchable={false}
                isClearable={false}
                className="w-40"
              />
            </div> */}
          </div>

          {/* Sort bar */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {loading ? "Memuat model..." : `Menampilkan ${filteredModels.length} of ${pricingData.length} model`}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Urutkan:</span>
              {(["default", "name", "prompt", "completion"] as const).map((field) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  key={field}
                  onClick={() => toggleSort(field)}
                  className={cn(
                    "flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                    sortBy === field
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {field === "default" ? "Default" : field === "name" ? "Nama" : field === "prompt" ? "Harga Input" : "Harga Output"}
                  <SortArrow field={field} />
                </Button>
              ))}
            </div>
          </div>

          {/* Compare bar */}
          {compareMode && compareList.length > 0 && (
            <Card className="border-primary/20">
              <CardContent className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                    {compareList.length}
                  </div>
                  <span className="text-xs text-primary">
                    model dipilih
                    {compareList.length < 2 ? " — pilih minimal 2 untuk dibandingkan" : ""}
                  </span>
                </div>
                {compareList.length >= 2 && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setCompareList([])} className="h-7 text-xs">
                      Hapus
                    </Button>
                    <Button size="sm" onClick={() => setExpandedModel("compare")} className="h-7 gap-1 text-xs">
                      <ArrowLeftRight className="h-3 w-3" /> Bandingkan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Comparison table modal */}
          <Dialog open={expandedModel === "compare" && compareList.length >= 2} onOpenChange={(open) => { if (!open) setExpandedModel(null); }}>
            <DialogContent className="sm:max-w-5xl border-primary/20">
              <DialogHeader className="border-b border-border bg-muted/20 px-6 py-4">
                <DialogTitle className="text-base font-semibold">Perbandingan Model</DialogTitle>
              </DialogHeader>
              <DialogBody className="overflow-x-auto">
                <Table className="w-full text-sm">
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead className="sticky left-0 bg-card px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fitur</TableHead>
                      {compareList.map((id) => {
                        const m = pricingData.find((m) => m.id === id);
                        return (
                          <TableHead key={id} className="px-4 py-3 text-left text-xs font-semibold">{m?.name || id}</TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { key: "speed", label: "Kecepatan", render: (m: ModelPricing) => speedLabel(m.speed) },
                      { key: "quality", label: "Kualitas" },
                    ].map((row) => (
                      <TableRow key={row.key} className="border-b border-border last:border-b-0">
                        <TableCell className="sticky left-0 bg-card px-4 py-3 text-xs text-muted-foreground">{row.label}</TableCell>
                        {compareList.map((id) => {
                          const m = pricingData.find((m) => m.id === id);
                          if (!m) return <TableCell key={id} className="px-4 py-3 text-xs" />;
                          const val = row.render ? row.render(m) : String(m[row.key as keyof ModelPricing] ?? "");
                          return <TableCell key={id} className="px-4 py-3 text-xs">{val}</TableCell>;
                        })}
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-primary/20 bg-primary/5">
                      <TableCell className="sticky left-0 bg-primary/5 px-4 py-3 text-xs font-medium text-primary">Input / 1M</TableCell>
                      {compareList.map((id) => {
                        const m = pricingData.find((m) => m.id === id);
                        return <TableCell key={id} className="px-4 py-3 text-xs font-semibold tabular-nums">{m ? formatPrice(m.pricing.prompt * 1000) : "-"}</TableCell>;
                      })}
                    </TableRow>
                    <TableRow className="bg-primary/5">
                      <TableCell className="sticky left-0 bg-primary/5 px-4 py-3 text-xs font-medium text-primary">Output / 1M</TableCell>
                      {compareList.map((id) => {
                        const m = pricingData.find((m) => m.id === id);
                        return <TableCell key={id} className="px-4 py-3 text-xs font-semibold tabular-nums">{m ? formatPrice(m.pricing.completion * 1000) : "-"}</TableCell>;
                      })}
                    </TableRow>
                  </TableBody>
                </Table>
              </DialogBody>
            </DialogContent>
          </Dialog>

          {/* Model grid */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse shadow-none">
                  <CardContent className="p-5">
                    <div className="mb-3 h-4 w-3/4 rounded bg-muted" />
                    <div className="mb-2 h-3 w-1/2 rounded bg-muted" />
                    <div className="mb-4 h-3 w-2/3 rounded bg-muted" />
                    <div className="flex gap-2">
                      <div className="h-8 flex-1 rounded-lg bg-muted" />
                      <div className="h-8 flex-1 rounded-lg bg-muted" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredModels.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Tidak ada model yang cocok"
              description="Coba cari model yang lain"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSearch(""); setSelectedProvider("all"); }}
                >
                  Reset Pencarian
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredModels.map((model, idx) => {
                const isCompared = compareList.includes(model.id);
                return (
                  <div
                    key={model.id}
                    style={{ animationDelay: `${idx * 30}ms` }}
                    className="group relative animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <Card
                      interactive
                      className={cn(
                        "p-0 overflow-hidden",
                        isCompared && "ring-2 ring-primary"
                      )}
                    >
                      <div className="flex flex-col gap-4 p-6">
                        {/* Compare checkbox */}
                        {compareMode && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-pressed={isCompared}
                            onClick={() => toggleCompare(model.id)}
                            className={cn(
                              "absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded border transition-all",
                              isCompared
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:border-primary/50"
                            )}
                          >
                            {isCompared && <Check className="h-3 w-3" />}
                          </Button>
                        )}

                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-semibold leading-snug tracking-tight">{model.name}</h3>
                          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold", speedBg(model.speed), speedColor(model.speed))}>
                            <Gauge className="h-2.5 w-2.5" /> {speedLabel(model.speed)}
                          </span>
                        </div>
                        <p className="-mt-2 truncate font-mono text-xs text-muted-foreground">{model.id}</p>

                        <dl className="space-y-2 border-t border-border/40 pt-4 text-sm">
                          <div className="flex items-baseline justify-between gap-4">
                            <dt className="text-muted-foreground">Input / 1M</dt>
                            <dd className="font-mono text-sm font-medium tabular-nums">{priceLabel(model.pricing.prompt * 1000)}</dd>
                          </div>
                          <div className="flex items-baseline justify-between gap-4">
                            <dt className="text-muted-foreground">Output / 1M</dt>
                            <dd className="font-mono text-sm font-medium tabular-nums">{priceLabel(model.pricing.completion * 1000)}</dd>
                          </div>
                        </dl>

                        {/* Quality + availability */}
                        {model.quality && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                            <div className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              model.quality === "Best" ? "bg-warning" : model.quality === "Excellent" ? "bg-success" : "bg-info"
                            )} />
                            {model.quality} quality tier
                            {model.available ? (
                              <Badge variant="success" size="sm" className="ml-auto flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Available
                              </Badge>
                            ) : (
                              <Badge variant="destructive" size="sm" className="ml-auto flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Unavailable
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
