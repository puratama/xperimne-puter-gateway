"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

import { useCallback, useEffect, useState, startTransition } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Edit3,
  Globe,
  Key,
  Plus,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { useSiteConfig } from "@/lib/use-site-config";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { FormPanel, FormSection } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDateTime } from "@/components/ui/format-date";

interface ApiKeyItem {
  id: string;
  key: string;
  name: string;
  createdAt: string;
  lastUsed: string | null;
  isActive: boolean;
  usageCount: number;
  totalTokens: number;
  expiresAt: string | null;
  allModels: boolean;
  allowedModels: string[];
}

interface AvailableModel {
  modelId: string;
  name: string;
  provider: string;
}

const formatTokens = (tokens: number) => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toLocaleString();
};

const formatDate = (timestamp: string) => formatDateTime(timestamp);

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyActive, setNewKeyActive] = useState(true);
  const [newHasExpiry, setNewHasExpiry] = useState(false);
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [newAllModels, setNewAllModels] = useState(true);
  const [newAllowedModels, setNewAllowedModels] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editHasExpiry, setEditHasExpiry] = useState(false);
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editAllModels, setEditAllModels] = useState(true);
  const [editAllowedModels, setEditAllowedModels] = useState<string[]>([]);

  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [models, setModels] = useState<AvailableModel[]>([]);
  const siteConfig = useSiteConfig();

  const fetchKeys = useCallback(async () => {
    startTransition(() => setLoading(true));

    try {
      const response = await fetch("/api/user/keys");
      if (response.ok) {
        const data = await response.json();
        setKeys(data.keys || []);
      }
    } catch {
      setError("Gagal memuat API key");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKeys();
    fetch("/api/models")
      .then((response) => (response.ok ? response.json() : []))
      .then(setModels)
      .catch(() => setModels([]));
  }, [fetchKeys]);

  const handleCreate = useCallback(async () => {
    if (!newKeyName.trim()) return;

    try {
      const response = await fetch("/api/user/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: newKeyName.trim(),
          isActive: newKeyActive,
          expiresAt: newHasExpiry && newExpiresAt ? new Date(newExpiresAt).toISOString() : null,
          allModels: newAllModels,
          allowedModels: newAllModels ? [] : newAllowedModels,
        }),
      });

      if (!response.ok) {
        toast.error("Gagal membuat API key");
        return;
      }

      const data = await response.json();
      setNewSecret(data.key?.secret ?? data.secret ?? null);
      setShowCreate(false);
      setShowSecret(true);
      setNewKeyName("");
      await fetchKeys();
      toast.success("Berhasil membuat API key");
    } catch {
      toast.error("Gagal membuat API key");
    }
  }, [fetchKeys, newAllModels, newAllowedModels, newExpiresAt, newKeyActive, newKeyName]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/user/keys?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        toast.error("Gagal menghapus API key");
        return;
      }

      setConfirmRevoke(null);
      await fetchKeys();
      toast.success("Berhasil menghapus API key");
    } catch {
      toast.error("Gagal menghapus API key");
    }
  }, [fetchKeys]);

  const handleUpdate = useCallback(
    async (id: string, updates: Record<string, unknown>) => {
      try {
        const response = await fetch("/api/user/keys", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...updates }),
        });

        if (!response.ok) {
          toast.error("Gagal memperbarui API key");
          return;
        }

        await fetchKeys();
        if (updates.name !== undefined) setEditingId(null);
        toast.success(
          updates.isActive === false ? "API key dihentikan" : "API key diperbarui"
        );
      } catch {
        toast.error("Gagal memperbarui API key");
      }
    },
    [fetchKeys]
  );

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openCreateDialog = () => {
    setShowCreate(true);
    setNewKeyName("");
    setNewKeyActive(true);
    setNewHasExpiry(false);
    setNewExpiresAt("");
    setNewAllModels(true);
    setNewAllowedModels([]);
    setNewSecret(null);
    setShowSecret(false);
  };

  const openEditDialog = (key: ApiKeyItem) => {
    setEditingId(key.id);
    setEditName(key.name);
    setEditActive(key.isActive);
    setEditHasExpiry(!!key.expiresAt);
    setEditExpiresAt(key.expiresAt ? key.expiresAt.slice(0, 16) : "");
    setEditAllModels(key.allModels);
    setEditAllowedModels(key.allowedModels);
  };

  return (
    <AppShell variant="user">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
          <PageHeader onCreate={openCreateDialog} />

          {error && (
            <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
              <Button variant="ghost" size="xs" onClick={() => setError("")}>
                Tutup
              </Button>
            </div>
          )}

          <BaseUrlCard
            baseUrl={siteConfig.baseUrl}
            loaded={siteConfig.loaded}
            copied={copiedId === "baseurl"}
            onCopy={() => copyToClipboard(siteConfig.baseUrl, "baseurl")}
          />

          <KeysTable
            keys={keys}
            loading={loading}
            onCreate={openCreateDialog}
            onEdit={openEditDialog}
            onRevoke={setConfirmRevoke}
          />

          <QuickStartCard
            keys={keys}
            baseUrl={siteConfig.baseUrl}
          />
        </div>
      </div>

      <CreateKeyDialog
        open={showCreate}
        keyName={newKeyName}
        isActive={newKeyActive}
        expiresAt={newExpiresAt}
        hasExpiry={newHasExpiry}
        allModels={newAllModels}
        allowedModels={newAllowedModels}
        models={models}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) {
            setNewSecret(null);
            setShowSecret(false);
          }
        }}
        onKeyNameChange={setNewKeyName}
        onStatusChange={setNewKeyActive}
        onHasExpiryChange={setNewHasExpiry}
        onExpiresAtChange={setNewExpiresAt}
        onAllModelsChange={setNewAllModels}
        onAllowedModelsChange={setNewAllowedModels}
        onCreate={handleCreate}
      />

      <GeneratedKeyDialog
        open={showSecret}
        secret={newSecret}
        copied={copiedId === "new-secret"}
        onOpenChange={(open) => {
          setShowSecret(open);
          if (!open) setNewSecret(null);
        }}
        onCopy={() => newSecret && copyToClipboard(newSecret, "new-secret")}
      />

      <EditKeyDialog
        open={!!editingId}
        keyName={editName}
        isActive={editActive}
        expiresAt={editExpiresAt}
        hasExpiry={editHasExpiry}
        allModels={editAllModels}
        allowedModels={editAllowedModels}
        models={models}
        onOpenChange={(open) => !open && setEditingId(null)}
        onKeyNameChange={setEditName}
        onStatusChange={setEditActive}
        onHasExpiryChange={setEditHasExpiry}
        onExpiresAtChange={setEditExpiresAt}

        onAllModelsChange={setEditAllModels}
        onAllowedModelsChange={setEditAllowedModels}
        onSave={() =>
          editingId &&
          handleUpdate(editingId, {
            name: editName,
            isActive: editActive,
            expiresAt: editHasExpiry && editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
            allModels: editAllModels,
            allowedModels: editAllModels ? [] : editAllowedModels,
          })
        }
      />

      <RevokeKeyDialog
        open={!!confirmRevoke}
        onOpenChange={(open) => !open && setConfirmRevoke(null)}
        onConfirm={() => {
          if (confirmRevoke) {
            handleDelete(confirmRevoke);
          }
        }}
      />
    </AppShell>
  );
}

function PageHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Key className="h-4 w-4 text-primary" /> API Key
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">API Key</h1>
        <p className="text-sm text-muted-foreground">
          Manajemen API key untuk layanan AI Gateway.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="h-3.5 w-3.5" /> Buat API Key
      </Button>
    </header>
  );
}

function BaseUrlCard({
  baseUrl,
  loaded,
  copied,
  onCopy,
}: {
  baseUrl: string;
  loaded: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Base URL</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Gunakan base URL ini dengan SDK yang kompatibel dengan OpenAI:
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/30 p-3">
              {loaded ? (
                <>
                  <code className="flex-1 font-mono text-sm text-primary">
                    {baseUrl}
                  </code>
                  <Button variant="ghost" size="icon-sm" onClick={onCopy}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KeysTable({
  keys,
  loading,
  onCreate,
  onEdit,
  onRevoke,
}: {
  keys: ApiKeyItem[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (key: ApiKeyItem) => void;
  onRevoke: (id: string) => void;
}) {
  if (loading) return <TableSkeleton rows={5} cols={6} />;

  if (keys.length === 0) {
    return (
      <EmptyState
        icon={Key}
        title="Belum ada API key yang dibuat"
        description="Buat API key pertama untuk mulai menggunakan layanan AI Gateway"
        action={
          <Button onClick={onCreate}>Buat API Key</Button>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <Table className="w-full text-sm">
          <TableHeader className="bg-muted/50 text-left text-muted-foreground">
            <TableRow>
              <TableHead className="px-4 py-3 font-medium">Nama</TableHead>
              <TableHead className="px-4 py-3 font-medium">API Key</TableHead>
              <TableHead className="px-4 py-3 text-center font-medium">Status</TableHead>
              <TableHead className="px-4 py-3 text-right font-medium">Request</TableHead>
              <TableHead className="px-4 py-3 text-right font-medium">Penggunaan</TableHead>
              <TableHead className="px-4 py-3 font-medium">Terakhir Digunakan</TableHead>
              <TableHead className="w-24 px-4 py-3" />
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {keys.map((key) => (
              <TableRow key={key.id} className="hover:bg-muted/40">
                <TableCell className="px-4 py-3">
                  <span className="font-medium">{key.name}</span>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <code className="font-mono text-xs text-muted-foreground">
                    {key.key}
                  </code>
                </TableCell>
                <TableCell className="px-4 py-3 text-center">
                  <StatusBadge isActive={key.isActive} />
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-xs tabular-nums">
                  {formatTokens(key.usageCount)}
                </TableCell>
                <TableCell className="px-4 py-3 text-right text-xs tabular-nums">
                  {formatTokens(key.totalTokens)} token
                </TableCell>
                <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                  {key.lastUsed ? formatDate(key.lastUsed) : "—"}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(key)}
                      title="Ubah nama dan status"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground/50 hover:text-destructive"
                      onClick={() => onRevoke(key.id)}
                      title="Hapus API key"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? "success" : "secondary"} size="sm">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "bg-success" : "bg-muted-foreground"
        )}
        />
      {isActive ? "Aktif" : "Nonaktif"}
    </Badge>
  );
}

function QuickStartCard({
  keys,
  baseUrl,
}: {
  keys: ApiKeyItem[];
  baseUrl: string;
}) {
  const activeKey = keys.find((key) => key.isActive);
  if (!activeKey || !baseUrl) return null;

  return (
    <details className="group rounded-xl border border-border bg-card p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <Terminal className="h-3.5 w-3.5" /> Mulai Cepat — Salin &amp; Paste
        <ChevronDown className="ml-auto h-3 w-3 transition-transform group-open:rotate-180" />
      </summary>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-muted/30 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
        {`import OpenAI from "openai";

        const client = new OpenAI({
          baseURL: "${baseUrl}",
          apiKey: "${activeKey.key}",
        });`}
      </pre>
    </details>
  );
}

interface CreateKeyDialogProps {
  open: boolean;
  keyName: string;
  isActive: boolean;
  onOpenChange: (open: boolean) => void;
  onKeyNameChange: (value: string) => void;
  onStatusChange: (value: boolean) => void;
  onHasExpiryChange: (value: boolean) => void;
  hasExpiry: boolean;
  expiresAt: string;
  allModels: boolean;
  allowedModels: string[];
  models: AvailableModel[];
  onExpiresAtChange: (value: string) => void;
  onAllModelsChange: (value: boolean) => void;
  onAllowedModelsChange: (value: string[]) => void;
  onCreate: () => void;
}

function CreateKeyDialog({
  open,
  keyName,
  isActive,
  onOpenChange,
  onKeyNameChange,
  onStatusChange,
  onHasExpiryChange,
  hasExpiry,
  expiresAt,
  allModels,
  allowedModels,
  models,
  onExpiresAtChange,
  onAllModelsChange,
  onAllowedModelsChange,
  onCreate,
}: CreateKeyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">Buat API Key</DialogTitle>
          <DialogDescription className="text-xs">
            Buat API key. Kunci rahasia hanya ditampilkan sekali.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
            <section>
              <FormSection>Informasi Umum</FormSection>
              <FormPanel className="space-y-3">
                <div>
                  <Label htmlFor="new-key-name">Nama</Label>
                  <Input
                    id="new-key-name"
                    value={keyName}
                    onChange={(event) => onKeyNameChange(event.target.value)}
                    placeholder="Cth: My API Key"
                    autoFocus
                    className="bg-background"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <Label htmlFor="new-key-expiry-toggle">Atur masa berlaku</Label>
                      <p className="text-xs text-muted-foreground">Masa berlaku API key ini akan diaktifkan setelah tanggal dipilih</p>
                    </div>
                    <Switch checked={hasExpiry} onChange={onHasExpiryChange} />
                  </div>
                  {hasExpiry && (
                    <div>
                      <Label htmlFor="new-key-expiry">Berlaku hingga</Label>
                      <Input id="new-key-expiry" type="datetime-local" value={expiresAt} onChange={(event) => onExpiresAtChange(event.target.value)} className="bg-background" />
                    </div>
                  )}
                </div>
                <ModelAccessField
                  allModels={allModels}
                  allowedModels={allowedModels}
                  models={models}
                  onAllModelsChange={onAllModelsChange}
                  onAllowedModelsChange={onAllowedModelsChange}
                  idPrefix="new-key"
                />
              </FormPanel>
            </section>

            <section>
              <FormSection>Status</FormSection>
              <FormPanel>
                <StatusField isActive={isActive} onChange={onStatusChange} />
              </FormPanel>
            </section>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button onClick={onCreate} disabled={!keyName.trim()}>
              <Sparkles className="h-3.5 w-3.5" /> Buat
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditKeyDialogProps {
  open: boolean;
  keyName: string;
  isActive: boolean;
  hasExpiry: boolean;
  expiresAt: string;
  allModels: boolean;
  allowedModels: string[];
  models: AvailableModel[];
  onOpenChange: (open: boolean) => void;
  onKeyNameChange: (value: string) => void;
  onStatusChange: (value: boolean) => void;
  onHasExpiryChange: (value: boolean) => void;
  onExpiresAtChange: (value: string) => void;
  onAllModelsChange: (value: boolean) => void;
  onAllowedModelsChange: (value: string[]) => void;
  onSave: () => void;
}

interface GeneratedKeyDialogProps {
  open: boolean;
  secret: string | null;
  copied: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: () => void;
}

function GeneratedKeyDialog({
  open,
  secret,
  copied,
  onOpenChange,
  onCopy,
}: GeneratedKeyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API Key Berhasil Dibuat</DialogTitle>
          <DialogDescription>
            Kunci rahasia ini hanya ditampilkan sekali. Jangan lupa untuk menyimpannya di tempat aman.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all font-mono">{secret}</code>
              <Button size="icon-sm" variant="ghost" onClick={onCopy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Oke</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditKeyDialog({
  open,
  keyName,
  isActive,
  hasExpiry,
  expiresAt,
  allModels,
  allowedModels,
  models,
  onOpenChange,
  onKeyNameChange,
  onStatusChange,
  onHasExpiryChange,
  onExpiresAtChange,
  onAllModelsChange,
  onAllowedModelsChange,
  onSave,
}: EditKeyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">Ubah API Key</DialogTitle>
          <DialogDescription className="text-xs">
            Perbarui nama dan status API key.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogBody className="space-y-5">
            <section>
              <FormSection>Informasi Umum</FormSection>
              <FormPanel className="space-y-3">
                <div>
                  <Label htmlFor="edit-key-name">Nama</Label>
                  <Input
                    id="edit-key-name"
                    value={keyName}
                    onChange={(event) => onKeyNameChange(event.target.value)}
                    placeholder="Cth: My API Key"
                    autoFocus
                    className="bg-background"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <Label htmlFor="edit-key-expiry-toggle">Atur masa berlaku</Label>
                      <p className="text-xs text-muted-foreground">Masa berlaku API key ini akan diaktifkan setelah tanggal dipilih</p>
                    </div>
                    <Switch checked={hasExpiry} onChange={onHasExpiryChange} />
                  </div>
                  {hasExpiry && (
                    <div>
                      <Label htmlFor="edit-key-expiry">Berlaku hingga</Label>
                      <Input id="edit-key-expiry" type="datetime-local" value={expiresAt} onChange={(event) => onExpiresAtChange(event.target.value)} className="bg-background" />
                    </div>
                  )}
                </div>
                <ModelAccessField
                  allModels={allModels}
                  allowedModels={allowedModels}
                  models={models}
                  onAllModelsChange={onAllModelsChange}
                  onAllowedModelsChange={onAllowedModelsChange}
                  idPrefix="edit-key"
                />
              </FormPanel>
            </section>

            <section>
              <FormSection>Status</FormSection>
              <FormPanel>
                <StatusField isActive={isActive} onChange={onStatusChange} />
              </FormPanel>
            </section>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={!keyName.trim()}>
              <Check className="h-3.5 w-3.5" /> Simpan Perubahan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModelAccessField({
  allModels,
  allowedModels,
  models,
  onAllModelsChange,
  onAllowedModelsChange,
  idPrefix,
}: {
  allModels: boolean;
  allowedModels: string[];
  models: AvailableModel[];
  onAllModelsChange: (value: boolean) => void;
  onAllowedModelsChange: (value: string[]) => void;
  idPrefix: string;
}) {
  const toggleModel = (modelId: string) => {
    const nextModels = allowedModels.includes(modelId)
      ? allowedModels.filter((id) => id !== modelId)
      : [...allowedModels, modelId];
    onAllowedModelsChange(nextModels);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Akses Model</Label>
        <p className="text-xs text-muted-foreground">
          Pilih model yang boleh digunakan oleh API Key.
        </p>
      </div>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
        <input
          type="checkbox"
          checked={allModels}
          onChange={(event) => onAllModelsChange(event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <span className="text-sm font-medium">Semua Model diizinkan</span>
      </label>
      {!allModels && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Pilih model yang boleh digunakan oleh API key
          </p>
          {models.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tidak ada model yang aktif.</p>
          ) : (
            models.map((model) => (
              <label
                key={model.modelId}
                htmlFor={`${idPrefix}-${model.modelId}`}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/50"
              >
                <input
                  id={`${idPrefix}-${model.modelId}`}
                  type="checkbox"
                  checked={allowedModels.includes(model.modelId)}
                  onChange={() => toggleModel(model.modelId)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block truncate">{model.name}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {model.modelId}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function StatusField({
  isActive,
  onChange,
}: {
  isActive: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label>Status</Label>
        <p className="text-xs text-muted-foreground">
          Izinkan API Key ini memanggil model.
        </p>
      </div>
      <Switch checked={isActive} onChange={onChange} />
    </div>
  );
}

function RevokeKeyDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <DialogTitle>Hapus API Key</DialogTitle>
          </div>
          <DialogDescription>
            Hapus API Key ini akan menghapus semua data penggunaan dan layanan yang menggunakan API Key ini akan berhenti.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            <Trash2 className="h-3.5 w-3.5" /> Hapus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
