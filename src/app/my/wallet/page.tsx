"use client";

import { getApiErrorMessage } from "@/lib/api-error";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Download, Image as ImageIcon, Plus, QrCode, ReceiptText, RefreshCw, Wallet } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatCurrency } from "@/components/ui/format-currency";
import { formatDateTime } from "@/components/ui/format-date";

type BalanceResponse = { balance: number };
type TopupResponse = {
  transaction?: {
    token: string;
    redirectUrl?: string;
    provider?: string;
    orderId?: string;
    kind?: "redirect" | "qris";
    qrDataUrl?: string;
    maskedPayload?: string;
    merchantName?: string;
    expiresAt?: string;
  };
  billing?: Record<string, unknown>;
};
type BillingRecord = {
  id?: string;
  type?: string;
  amount: number;
  status: string;
  midtransOrderId?: string;
  createdAt: string;
};
type BillingResponse = BillingRecord[] | { data?: BillingRecord[]; billing?: BillingRecord[]; records?: BillingRecord[] };

type SnapCallbacks = {
  onSuccess: () => void;
  onPending: () => void;
  onError: () => void;
  onClose: () => void;
};

declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks: SnapCallbacks) => void };
  }
}

const presets = [10000, 25000, 50000, 100000, 250000];

const BILLING_TYPE_LABELS: Record<string, string> = {
  topup: "Isi saldo",
  package_purchase: "Pembelian paket",
};


function parseBilling(input: BillingResponse): BillingRecord[] {
  if (Array.isArray(input)) return input;
  return input.data ?? input.billing ?? input.records ?? [];
}

export default function WalletPage() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("25000");
  const [loading, setLoading] = useState(true);
  const [billingLoading, setBillingLoading] = useState(true);
  const [topupLoading, setTopupLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [billing, setBilling] = useState<BillingRecord[]>([]);
  const [snapReady, setSnapReady] = useState(false);
  const [qrisPayment, setQrisPayment] = useState<{
    orderId: string;
    qrDataUrl: string;
    amount: number;
    maskedPayload?: string;
    merchantName?: string;
    expiresAt: string;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [proofNote, setProofNote] = useState("");
  const [proofImage, setProofImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => Date.now());

  const numericAmount = useMemo(() => Number(amount), [amount]);

  // QRIS countdown clock (repo qrisdinamis: 15 menit masa berlaku)
  useEffect(() => {
    if (!qrisPayment) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [qrisPayment]);

  const qrisExpired = qrisPayment
    ? now >= new Date(qrisPayment.expiresAt).getTime()
    : false;
  const qrisRemainingMs = qrisPayment
    ? Math.max(0, new Date(qrisPayment.expiresAt).getTime() - now)
    : 0;
  const qrisRemaining = `${Math.floor(qrisRemainingMs / 60000)
    .toString()
    .padStart(2, "0")}:${Math.floor((qrisRemainingMs % 60000) / 1000)
    .toString()
    .padStart(2, "0")}`;

  // Load Midtrans Snap script once
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.snap) { setSnapReady(true); return; }

    const script = document.createElement("script");
    script.src = "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key", "");
    script.async = true;
    script.onload = () => setSnapReady(true);
    script.onerror = () => console.warn("[wallet] Failed to load Midtrans Snap script");
    document.body.appendChild(script);

    return () => {
      // only remove if we added it
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  const loadBalance = useCallback(async () => {
    const response = await fetch("/api/wallet/balance");
    if (!response.ok) throw new Error("Gagal memuat saldo wallet.");
    const data = (await response.json()) as BalanceResponse;
    setBalance(data.balance);
  }, []);

  const loadBilling = useCallback(async () => {
    setBillingLoading(true);
    try {
      const response = await fetch("/api/v1/billing");
      if (!response.ok) {
        setBilling([]);
        return;
      }
      const data = (await response.json()) as BillingResponse;
      setBilling(parseBilling(data));
    } catch {
      setBilling([]);
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        await loadBalance();
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Gagal memuat saldo wallet.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    loadBilling();

    return () => {
      active = false;
    };
  }, [loadBalance, loadBilling]);

  function goToCallback(status: string, orderId?: string, provider = "midtrans") {
    const params = new URLSearchParams({ status, provider });
    if (orderId) params.set("orderId", orderId);
    router.push(`/payment/callback?${params.toString()}`);
  }

  async function handleTopup() {
    if (!Number.isFinite(numericAmount) || numericAmount < 10000) {
      setMessage("Pilih jumlah pembayaran minimal Rp10.000.");
      return;
    }

    setTopupLoading(true);
    setMessage("");
    setError(""); 

    try {
      const response = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numericAmount }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(getApiErrorMessage(err, "Gagal memulai isi saldo."));
      }

      const data = (await response.json()) as TopupResponse;

      if (!data.transaction) {
        toast.error("Tidak ada sesi pembayaran. Silakan coba lagi.");
        return;
      }

      const { token, redirectUrl, provider, orderId, kind, qrDataUrl, maskedPayload, merchantName, expiresAt } = data.transaction;

      if (kind === "qris" && qrDataUrl && orderId) {
        setQrisPayment({
          orderId,
          qrDataUrl,
          amount: numericAmount,
          maskedPayload,
          merchantName,
          expiresAt: expiresAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });
        setMessage("Scan QRIS lalu bayar. Setelah membayar, klik tombol konfirmasi di bawah.");
        return;
      }

      if (provider === "xendit") {
        if (!redirectUrl) throw new Error("Gagal memuat URL Xendit checkout.");
        window.location.href = redirectUrl;
        return;
      }

      // Midtrans Snap
      if (!window.snap || !snapReady) {
        setMessage("Jendela pembayaran masih loading. Silakan tunggu sebentar dan coba lagi.");
        return;
      }

      window.snap.pay(token, {
        onSuccess: () => goToCallback("success", orderId, "midtrans"),
        onPending: () => goToCallback("pending", orderId, "midtrans"),
        onError: () => goToCallback("failed", orderId, "midtrans"),
        onClose: () => goToCallback("cancelled", orderId, "midtrans"),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memulai isi saldo.");
    } finally {
      setTopupLoading(false);
    }
  }

  async function handleRefresh() {
    setError("");
    setLoading(true);
    try {
      await Promise.all([loadBalance(), loadBilling()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat saldo wallet.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadProof(file: File) {
    if (uploading) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const res = await fetch("/api/wallet/topup/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(getApiErrorMessage(data, "Gagal upload bukti pembayaran"));
      setProofImage(data.url);
      toast.success("Bukti pembayaran diupload.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal upload bukti pembayaran.");
    }
    setUploading(false);
  }

  async function handleQrisConfirm() {
    if (!qrisPayment) return;
    setConfirmLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/wallet/topup/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: qrisPayment.orderId,
          ...(proofNote ? { proofNote } : {}),
          ...(proofImage ? { proofImage } : {}),
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(getApiErrorMessage(err, "Gagal konfirmasi."));
      }
      const data = await response.json();
      if (data.status === "paid") {
        toast.success("Saldo Anda telah diperbarui.");
        setBalance(data.balance ?? balance);
        setQrisPayment(null);
        await loadBilling();
      } else if (data.status === "pending_confirmation") {
        setSubmitted(true);
        setMessage("Pembayaran diterima. Saldo akan masuk setelah admin memverifikasi bukti pembayaran Anda.");
      } else {
        setMessage("Pembayaran belum terkonfirmasi. Jika sudah membayar, coba lagi dalam beberapa saat.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal konfirmasi pembayaran.");
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <AppShell variant="user">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4 text-primary" /> My Wallet
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Wallet Saya</h1>
              <p className="text-sm text-muted-foreground">Wallet Anda untuk mengelola saldo dan transaksi.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="cursor-pointer">
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
            </Button>
          </header>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4 text-info" /> Saldo saat ini
              </div>
              {loading ? (
                <div className="mt-3">
                  <Skeleton className="h-9 w-44" />
                </div>
              ) : (
                <div className="mt-3 text-3xl font-semibold tabular-nums">{formatCurrency(balance)}</div>
              )}
              {error && <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              {message && <p className="mt-4 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">{message}</p>}
            </CardContent>
          </Card>

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardContent className="p-5">
                <h2 className="text-lg font-semibold">Pilih jumlah pembayaran</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {presets.map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={numericAmount === value ? "default" : "outline"}
                      className="h-11 animate-button"
                      onClick={() => {
                        setAmount(String(value));
                        setQrisPayment(null);
                      }}
                    >
                      {formatCurrency(value)}
                    </Button>
                  ))}
                </div>
                <Label htmlFor="custom-amount" className="mt-5">Jumlah pembayaran kustom</Label>
                <Input
                  id="custom-amount"
                  inputMode="numeric"
                  min={10000}
                  type="number"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setQrisPayment(null);
                  }}
                  className="mt-2 h-11 bg-input"
                />
                <Button className="mt-5 h-11 w-full" onClick={handleTopup} disabled={topupLoading || loading}>
                  <Plus className="h-4 w-4" />
                  {topupLoading ? "Memulai pembayaran..." : "Isi saldo"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="text-lg font-bold tracking-tight">Riwayat Transaksi</h2>
                <div className="mt-4 space-y-3">
                  {billingLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-4">
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-40" />
                          </div>
                          <div className="space-y-2 text-right">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-3 w-12 ml-auto" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {!billingLoading && billing.length === 0 ? (
                    <EmptyState icon={ReceiptText} title="Tidak ada transaksi." />
                  ) : null}
                  {billing.slice(0, 5).map((item, index) => (
                    <div key={item.id ?? item.midtransOrderId ?? `${item.createdAt}-${index}`} className="rounded-lg border border-border bg-muted/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{item.type ? (BILLING_TYPE_LABELS[item.type] ?? "Lainnya") : "Isi saldo"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(item.amount)}</p>
                          <p className="mt-1 text-xs uppercase text-muted-foreground">{item.status}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <Dialog
            open={Boolean(qrisPayment)}
            onOpenChange={(open) => {
              if (!open) {
                setQrisPayment(null);
                setProofNote("");
                setProofImage("");
                setSubmitted(false);
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader className="flex-row items-center gap-3 space-y-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <QrCode className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-base">Bayar lewat QRIS</DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Scan QR lalu bayar sebelum masa berlaku habis. Setelah membayar, klik konfirmasi.
                  </DialogDescription>
                </div>
              </DialogHeader>
              <DialogBody className="p-6">
              {qrisPayment && submitted ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                    <CheckCircle2 className="h-7 w-7 text-success" />
                  </div>
                  <h3 className="text-base font-semibold">Konfirmasi Pembayaran</h3>
                  <p className="text-sm text-muted-foreground">
                    {message ||
                      "Bukti pembayaran diterima. Admin akan memverifikasi bukti pembayaran Anda. Saldo masuk setelah disetujui."}
                  </p>
                  <Button className="mt-2 w-full" onClick={() => setQrisPayment(null)}>
                    Tutup
                  </Button>
                </div>
              ) : qrisPayment && (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex w-full items-center justify-between text-xs">
                    <span className="font-medium">{qrisPayment.merchantName ?? "Pembayaran Merchant"}</span>
                    <Badge variant={qrisExpired ? "destructive" : "secondary"} size="sm">
                      <Clock className="h-3 w-3" />
                      {qrisExpired ? "Kedaluwarsa" : qrisRemaining}
                    </Badge>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrisPayment.qrDataUrl}
                    alt="QRIS payment QR"
                    className={
                      "h-56 w-56 rounded-lg bg-white" + (qrisExpired ? " opacity-40" : "")
                    }
                  />
                  <div className="text-center">
                    <p className="text-sm font-medium">{formatCurrency(qrisPayment.amount)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Order: {qrisPayment.orderId}</p>
                  </div>
                  <a
                    href={qrisPayment.qrDataUrl}
                    download={`QRIS-${(qrisPayment.merchantName ?? "Pembayaran Merchant").replace(/\s+/g, "-")}-${qrisPayment.amount}.png`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    <Download className="h-4 w-4" /> Download
                  </a>
                  {qrisExpired ? (
                    <p className="text-xs text-destructive">
                      QR telah kedaluwarsa. Tutup lalu buat ulang isi saldo.
                    </p>
                  ) : (
                    <>
                      <div className="w-full space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-left">
                        <Label className="text-xs">Bukti pembayaran (opsional)</Label>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => proofInputRef.current?.click()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") proofInputRef.current?.click();
                          }}
                          className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/40 hover:border-primary/50"
                        >
                          {proofImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={proofImage} alt="Bukti transfer" className="max-h-14 max-w-full object-contain" />
                          ) : (
                            <>
                              <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
                              <span className="text-xs text-muted-foreground">
                                {uploading ? "Mengupload..." : "Upload bukti pembayaran"}
                              </span>
                            </>
                          )}
                        </div>
                        <input
                          ref={proofInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (proofInputRef.current) proofInputRef.current.value = "";
                            if (file) uploadProof(file);
                          }}
                        />
                        <Textarea
                          value={proofNote}
                          onChange={(e) => setProofNote(e.target.value)}
                          placeholder="Catatan (contoh: sudah transfer via bank)"
                          rows={2}
                          className="h-auto min-h-0 text-xs"
                        />
                      </div>
                      <p className="w-full text-center text-xs text-muted-foreground">
                        Pastikan pembayaran Anda telah dilakukan sebelum mengirim konfirmasi.
                      </p>
                      <Button className="w-full" onClick={handleQrisConfirm} disabled={confirmLoading}>
                        {confirmLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Memverifikasi...
                          </>
                        ) : (
                          "Konfirmasi Pembayaran"
                        )}
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => setQrisPayment(null)}
                  >
                    Batal
                  </Button>
                </div>
              )}
              </DialogBody>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AppShell>
  );
}
