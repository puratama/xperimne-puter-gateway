"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Coins, Hash, RefreshCw } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton, ChartSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { UsageBarChart } from "@/components/ui/usage-bar-chart";
import { Tabs } from "@/components/ui/tabs";
import { formatCurrency } from "@/components/ui/format-currency";
import { formatDateTime } from "@/components/ui/format-date";

interface ModelUsage {
  model: string;
  tokens: number;
  cost: number;
  requests: number;
}

interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
  requests: number;
}

interface UsageRecord {
  datetime: string;
  apiKeyId: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

interface UsageResponse {
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  range: string;
  byModel: ModelUsage[];
  byDay: DailyUsage[];
  records: UsageRecord[];
}

type RangeFilter = "week" | "month";
type UsageTab = "daily" | "recent" | "models";

const RANGE_OPTIONS: { key: RangeFilter; label: string }[] = [
  { key: "week", label: "1 Minggu" },
  { key: "month", label: "1 Bulan" },
];

const RANGE_LABEL: Record<RangeFilter, string> = {
  week: "1 minggu terakhir",
  month: "1 bulan terakhir",
};

const RANGE_DAYS: Record<RangeFilter, number> = {
  week: 7,
  month: 30,
};

const RECORDS_PER_PAGE = 10;

const number = new Intl.NumberFormat("id-ID");

/** Generate ISO dates (UTC) for the full range, back-filling usage data */
function fillDays(range: RangeFilter, byDay: DailyUsage[]): DailyUsage[] {
  const count = RANGE_DAYS[range];
  const now = new Date();
  // Use UTC midnight to match API's dayKey() which uses toISOString (always UTC)
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const map = new Map(byDay.map((d) => [d.date, d]));
  const result: DailyUsage[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push(map.get(key) ?? { date: key, tokens: 0, cost: 0, requests: 0 });
  }
  return result;
}

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<RangeFilter>("month");
  const [activeTab, setActiveTab] = useState<UsageTab>("daily");
  const [recordsPage, setRecordsPage] = useState(1);

  const loadUsage = useCallback(async (r: RangeFilter) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/user/usage?range=${r}`);
      if (!response.ok) throw new Error("Gagal memuat data penggunaan");
      setUsage((await response.json()) as UsageResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data penggunaan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsage(range);
  }, [range, loadUsage]);

  useEffect(() => {
    setRecordsPage(1);
  }, [range]);

  const recordPageCount = Math.max(1, Math.ceil((usage?.records.length ?? 0) / RECORDS_PER_PAGE));
  const visibleRecords = usage?.records.slice((recordsPage - 1) * RECORDS_PER_PAGE, recordsPage * RECORDS_PER_PAGE) ?? [];

  const days = useMemo(() => usage ? fillDays(range, usage.byDay) : [], [usage, range]);

  return (
    <AppShell variant="user">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4 text-primary" /> Usage
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Riwayat Penggunaan</h1>
              <p className="text-sm text-muted-foreground">Lihat penggunaan model dan token Anda</p>
            </div>
            <div className="flex items-center gap-2">
              <Tabs
                items={RANGE_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label, disabled: loading }))}
                value={range}
                onValueChange={(value) => setRange(value as RangeFilter)}
                ariaLabel="Usage range"
              />
              <Button
                variant="outline"
                size="icon-lg"
                onClick={() => loadUsage(range)}
                disabled={loading}
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </Button>
            </div>
          </header>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="mt-3 h-9 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <ChartSkeleton />
              <TableSkeleton rows={4} cols={5} />
            </div>
          ) : usage ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Hash className="h-4 w-4 text-info" /> Request - {RANGE_LABEL[range]}
                    </div>
                    <div className="mt-3 text-3xl font-semibold">{number.format(usage.totalRequests)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BarChart3 className="h-4 w-4 text-success" /> Token - {RANGE_LABEL[range]}
                    </div>
                    <div className="mt-3 text-3xl font-semibold">{number.format(usage.totalTokens)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Coins className="h-4 w-4 text-warning" /> Biaya - {RANGE_LABEL[range]}
                    </div>
                    <div className="mt-3 text-3xl font-semibold">{formatCurrency(usage.totalCost)}</div>
                  </CardContent>
                </Card>
              </div>

              <Tabs
                items={[
                  { value: "daily", label: "Penggunaan Harian" },
                  { value: "recent", label: "Penggunaan Terakhir" },
                  { value: "models", label: "Per-model" },
                ]}
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as UsageTab)}
                ariaLabel="Usage views"
              />

              {activeTab === "daily" && <Card>
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Penggunaan Harian</h2>
                    <span className="text-xs text-muted-foreground">{RANGE_LABEL[range]} · {days.filter((d) => d.tokens > 0).length} hari aktif</span>
                  </div>
                  {days.some((day) => day.tokens > 0) ? (
                    <UsageBarChart data={days} />
                  ) : (
                    <EmptyState icon={BarChart3} title="Tidak ada penggunaan dalam periode ini." />
                  )}
                </CardContent>
              </Card>}

              {activeTab === "recent" && <Card>
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Penggunaan Terakhir</h2>
                    <span className="text-xs text-muted-foreground">Waktu lokal</span>
                  </div>
                  <div className="overflow-x-auto">
                    <Table className="w-full text-sm">
                      <TableHeader className="border-b border-border text-left text-xs text-muted-foreground">
                        <TableRow>
                          <TableHead className="py-2 font-medium">Tanggal</TableHead>
                          <TableHead className="py-2 font-medium">Model</TableHead>
                          <TableHead className="py-2 text-center font-medium">Input</TableHead>
                          <TableHead className="py-2 text-center font-medium">Output</TableHead>
                          <TableHead className="py-2 text-center font-medium">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y">
                        {usage.records.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Tidak ada catatan penggunaan.</TableCell></TableRow>
                        ) : visibleRecords.map((record, index) => (
                          <TableRow key={`${record.datetime}-${index}`} className="border-b border-border/50">
                            <TableCell className="py-3 text-muted-foreground">{formatDateTime(record.datetime)}</TableCell>
                            <TableCell className="py-3 font-medium">{record.model}</TableCell>
                            <TableCell className="py-3 text-center tabular-nums">{number.format(record.promptTokens)}</TableCell>
                            <TableCell className="py-3 text-center tabular-nums">{number.format(record.completionTokens)}</TableCell>
                            <TableCell className="py-3 text-center font-medium tabular-nums">{number.format(record.totalTokens)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Pagination page={recordsPage} pageCount={recordPageCount} onPageChange={setRecordsPage} />
                </CardContent>
              </Card>}

              {activeTab === "models" && <Card>
                <CardContent className="p-5">
                  <h2 className="mb-4 text-sm font-semibold">Penggunaan Per-model</h2>
                  <div className="overflow-x-auto">
                    <Table className="w-full text-sm">
                      <TableHeader className="border-b border-border text-left text-xs text-muted-foreground">
                        <TableRow>
                          <TableHead className="py-2 font-medium">Model</TableHead>
                          <TableHead className="py-2 text-center font-medium">Tokens</TableHead>
                          <TableHead className="py-2 text-center font-medium">Cost</TableHead>
                          <TableHead className="py-2 text-center font-medium">Requests</TableHead>
                          <TableHead className="py-2 text-center font-medium">% Tokens</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y">
                        {usage.byModel.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Tidak ada penggunaan model dalam periode ini.</TableCell></TableRow>
                        ) : usage.byModel.map((model) => (
                          <TableRow key={model.model} className="border-b border-border/50">
                            <TableCell className="py-3 font-medium">{model.model}</TableCell>
                            <TableCell className="py-3 text-center tabular-nums">{number.format(model.tokens)}</TableCell>
                            <TableCell className="py-3 text-center tabular-nums">{formatCurrency(model.cost)}</TableCell>
                            <TableCell className="py-3 text-center tabular-nums">{number.format(model.requests)}</TableCell>
                            <TableCell className="py-3 text-center tabular-nums">{usage.totalTokens ? ((model.tokens / usage.totalTokens) * 100).toFixed(1) : "0.0"}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>}
            </>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
