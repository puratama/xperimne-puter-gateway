"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  Server,
  BarChart3,
  GripVertical,
  Search,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSection, FormPanel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormDialog } from "@/components/ui/form-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProviderItem {
  id: string;
  name: string;
  baseUrl: string;
  hasApiKey: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TestResult {
  ok: boolean;
  status: number;
  latency: number;
  modelCount?: number | null;
  error?: string;
}

interface UsageDetail {
  provider: string;
  model: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface UsageStats {
  aggregatorId: string;
  aggregatorName: string;
  totalTokens: number;
  totalRequests: number;
  modelCount: number;
  details: UsageDetail[];
}

// Susun ulang elemen array secara immutabel (dipakai untuk drag & drop provider).
function reorderList<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function AdminProvidersPageContent() {
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ProviderItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [usageProvider, setUsageProvider] = useState<ProviderItem | null>(null);
  const [usageData, setUsageData] = useState<UsageStats | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [search, setSearch] = useState("");

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/aggregators");
      if (res.ok) setProviders(await res.json());
    } catch {
      setError("Failed to load providers");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const filteredProviders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return providers;
    return providers.filter((p) =>
      [p.name, p.baseUrl].some((v) => (v ?? "").toLowerCase().includes(term))
    );
  }, [providers, search]);

  // Pindahkan provider dari `from` ke `to` secara lokal (belum disimpan).
  const moveProvider = (from: number, to: number) => {
    setProviders((prev) => reorderList(prev, from, to));
  };

  // Simpan urutan provider ke backend berdasarkan id array saat ini.
  const persistReorder = async (ids: string[]) => {
    setReordering(true);
    try {
      const res = await fetch("/api/admin/aggregators/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Reorder failed" }));
        throw new Error(err?.error || "Reorder failed");
      }
      toast.success("Provider order updated");
      fetchProviders();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to reorder providers");
      // Kembalikan urutan ke kondisi server (belum berubah karena PATCH gagal).
      fetchProviders();
    } finally {
      setReordering(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await fetch(`/api/admin/aggregators?id=${deletingId}`, { method: "DELETE" });
      setDeletingId(null);
      setError(""); // Reset error setelah operasi berhasil
      fetchProviders();
    } catch {
      setError("Failed to delete provider");
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch("/api/admin/aggregators/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
        // Beri ruang lebih dari timeout server (20s + 1 retry) agar pesan server yang tampil.
        signal: AbortSignal.timeout(60_000),
      });
      const data: TestResult = await res.json();
      setTestResults((prev) => ({ ...prev, [id]: data }));
      if (!data.ok && data.error) toast.error(data.error);
    } catch (e) {
      const error =
        e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
          ? "Test dibatalkan: server tidak merespons dalam 60s"
          : "Request failed";
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, status: 0, latency: 0, error } }));
      toast.error(error);
    }
    setTestingId(null);
  };

  const handleShowUsage = async (provider: ProviderItem) => {
    setUsageProvider(provider);
    setUsageLoading(true);
    try {
      const res = await fetch(`/api/admin/aggregators/usage?id=${provider.id}`);
      if (res.ok) setUsageData(await res.json());
    } catch {
      setUsageData(null);
    }
    setUsageLoading(false);
  };

  return (
    <AppShell variant="admin">
      <div className="h-full overflow-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Providers</h1>
            <p className="text-sm text-muted-foreground">
              Manage API provider connections and credentials.
            </p>
          </div>
          <Button onClick={() => { setShowCreate(true); setEditing(null); }}>
            <Plus className="w-4 h-4" /> Add Provider
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search providers..."
            className="pl-9"
          />
        </div>

        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : filteredProviders.length === 0 ? (
          <EmptyState
            icon={Server}
            title="Belum ada provider"
            description={search.trim() ? "Tidak ada provider yang cocok dengan pencarian." : "Tambahkan koneksi API provider untuk mulai merutekan permintaan model."}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader className="bg-muted/50 text-left text-muted-foreground">
                  <TableRow>
                    <TableHead className="w-10 px-3 py-3" aria-label="Urutan" />
                    <TableHead className="px-4 py-3 font-medium">Nama</TableHead>
                    <TableHead className="px-4 py-3 font-medium">Base URL</TableHead>
                    <TableHead className="px-4 py-3 font-medium">API Key</TableHead>
                    <TableHead className="px-4 py-3 text-center font-medium">Status</TableHead>
                    <TableHead className="w-40 px-4 py-3" />
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {filteredProviders.map((p) => {
                    const i = providers.findIndex((x) => x.id === p.id);
                    return (
                      <TableRow
                        key={p.id}
                        className={cn(
                          "hover:bg-muted/40",
                          dragIndex === i && "opacity-50"
                        )}
                      >
                        <TableCell className="px-3 py-3">
                          <span
                            draggable={!reordering}
                            onDragStart={() => setDragIndex(i)}
                            onDragEnd={() => setDragIndex(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (dragIndex === null) return;
                              const from = dragIndex;
                              const to = i;
                              moveProvider(from, to);
                              setDragIndex(null);
                              persistReorder(reorderList(providers, from, to).map((x) => x.id));
                            }}
                            className={cn(
                              "flex cursor-grab items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing",
                              reordering && "cursor-wait opacity-50"
                            )}
                            title="Seret untuk urut ulang"
                            aria-label={`Seret provider ${p.name} untuk mengurutkan`}
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 font-medium">{p.name}</TableCell>
                        <TableCell className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {p.baseUrl}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <span className={cn(
                            p.hasApiKey
                              ? "text-success text-xs"
                              : "text-muted-foreground text-xs"
                          )}>
                            {p.hasApiKey ? "••••••••" : "None"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            p.isActive
                              ? "bg-success/10 text-success"
                              : "bg-muted text-muted-foreground"
                          )}>
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              p.isActive ? "bg-success" : "bg-muted-foreground"
                            )} />
                            {p.isActive ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleShowUsage(p)}
                              title="Lihat Penggunaan"
                            >
                              <BarChart3 className="h-3.5 w-3.5" />
                            </Button>
                            {testResults[p.id] && (
                              <span className={cn(
                                "text-xs mr-1",
                                testResults[p.id].ok
                                  ? "text-success"
                                  : "text-destructive"
                              )}>
                                {testResults[p.id].ok
                                  ? `${testResults[p.id].latency}ms`
                                  : "Fail"}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleTestConnection(p.id)}
                              disabled={testingId === p.id}
                              aria-label="Test provider connection"
                              title="Test connection"
                            >
                              <RefreshCw className={cn(
                                "h-3.5 w-3.5",
                                testingId === p.id && "animate-spin motion-reduce:animate-none"
                              )} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => { setEditing(p); setShowCreate(true); }}
                              aria-label="Edit provider"
                              title="Edit provider"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingId(p.id)}
                              aria-label="Delete provider"
                              title="Delete provider"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Provider Create/Edit Dialog */}
        <ProviderForm
          open={showCreate}
          onOpenChange={(open) => {
            if (!open) { setShowCreate(false); setEditing(null); }
          }}
          provider={editing}
          onSave={async (data) => {
            const res = editing
              ? await fetch("/api/admin/aggregators", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: editing.id, ...data }),
                })
              : await fetch("/api/admin/aggregators", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(data),
                });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err?.error || "Save failed");
            }
            setShowCreate(false);
            setEditing(null);
            fetchProviders();
            toast.success(editing ? "Provider updated" : "Provider created");
          }}
          onClose={() => { setShowCreate(false); setEditing(null); }}
        />

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deletingId}
          onOpenChange={(open) => { if (!open) setDeletingId(null); }}
          title="Delete Provider"
          description="Ini akan menghapus konfigurasi provider secara permanen."
          confirmLabel={
            <>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
            </>
          }
          onConfirm={handleDelete}
        />

        {/* Usage Modal */}
        <Dialog
          open={!!usageProvider}
          onOpenChange={(open) => { if (!open) { setUsageProvider(null); setUsageData(null); } }}
        >
          <DialogContent showCloseButton={false}>
            <DialogHeader className="flex-row items-center gap-3 space-y-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base">Usage: {usageProvider?.name}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">Penggunaan API melalui provider ini.</DialogDescription>
              </div>
            </DialogHeader>
            <DialogBody>
                {usageLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                  </div>
                ) : usageData ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold">{usageData.totalTokens.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Total Tokens</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold">{usageData.totalRequests.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Total Requests</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold">{usageData.modelCount}</p>
                          <p className="text-xs text-muted-foreground">Models Used</p>
                        </CardContent>
                      </Card>
                    </div>
                    {usageData.details.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <div className="overflow-x-auto">
                          <Table className="w-full text-sm">
                            <TableHeader className="bg-muted/50 text-left text-muted-foreground">
                              <TableRow>
                                <TableHead className="px-4 py-3 font-medium">Model</TableHead>
                                <TableHead className="px-4 py-3 font-medium">Provider</TableHead>
                                <TableHead className="px-4 py-3 text-right font-medium">Requests</TableHead>
                                <TableHead className="px-4 py-3 text-right font-medium">Tokens</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-border">
                              {usageData.details.map((d, i) => (
                                <TableRow key={i} className="hover:bg-muted/40">
                                  <TableCell className="px-4 py-3 font-medium">{d.model}</TableCell>
                                  <TableCell className="px-4 py-3 text-muted-foreground">{d.provider}</TableCell>
                                  <TableCell className="px-4 py-3 text-right">{d.requests.toLocaleString()}</TableCell>
                                  <TableCell className="px-4 py-3 text-right">{d.totalTokens.toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Tidak ada data penggunaan model.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Tidak ada data penggunaan.
                  </p>
                )}
              </DialogBody>
              <DialogFooter>
                <DialogClose render={<Button variant="outline">Close</Button>} />
              </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function ProviderForm({
  open,
  onOpenChange,
  provider,
  onSave,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderItem | null;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  // State persisten — di-reset otomatis saat `provider` berubah
  const [form, setForm] = useState({
    name: "",
    baseUrl: "",
    apiKey: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  // Sinkronkan form tiap kali modal dibuka / provider berubah (pre-population akurat)
  useEffect(() => {
    if (!open) return;
    setForm({
      name: provider?.name || "",
      baseUrl: provider?.baseUrl || "",
      apiKey: "", // Selalu reset — jangan tampilkan API key lama
      isActive: provider?.isActive ?? true,
    });
  }, [open, provider]);

  const handleSave = async () => {
    setSaving(true);
    const data: Record<string, unknown> = {
      name: form.name,
      baseUrl: form.baseUrl,
      isActive: form.isActive,
    };
    if (form.apiKey) data.apiKey = form.apiKey;
    try {
      await onSave(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<Server className="h-4 w-4 text-primary" />}
      title={provider ? "Edit Provider" : "Add Provider"}
      description={
        provider
          ? "Update connection details and credentials."
          : "Register a new API provider connection."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name || !form.baseUrl || (!provider && !form.apiKey)}>
            {saving ? "Menyimpan..." : provider ? "Update" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ── General ── */}
        <section>
          <FormSection>General</FormSection>
          <FormPanel className="space-y-3">
            <div>
              <Label>Nama</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g., My Provider"
                className="bg-background"
              />
            </div>
            <div>
              <Label>Base URL</Label>
              <Input
                value={form.baseUrl}
                onChange={(e) => setForm((p) => ({ ...p, baseUrl: e.target.value }))}
                placeholder="https://api.provider.com/v1"
                className="bg-background"
              />
            </div>
          </FormPanel>
        </section>

        {/* ── Credentials ── */}
        <section>
          <FormSection>Credentials</FormSection>
          <FormPanel>
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
                placeholder={provider ? "Kosongkan untuk tidak mengubah" : "sk-..."}
                className="bg-background"
              />
            </div>
          </FormPanel>
        </section>

        {/* ── Status ── */}
        <section>
          <FormSection>Status</FormSection>
          <FormPanel>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Provider Active</p>
                <p className="text-xs text-muted-foreground/60">
                  Saat nonaktif, koneksi ini tidak dipakai.
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
              />
            </div>
          </FormPanel>
        </section>
      </div>
    </FormDialog>
  );
}

export default function AdminProvidersPage() {
  return (
    <Suspense
      fallback={
        <AppShell variant="admin">
          <div className="h-full overflow-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-8 w-28 animate-pulse rounded bg-muted" />
                <div className="h-4 w-56 animate-pulse rounded bg-muted mt-2" />
              </div>
            </div>
            <TableSkeleton rows={5} cols={5} />
          </div>
        </AppShell>
      }
    >
      <AdminProvidersPageContent />
    </Suspense>
  );
}