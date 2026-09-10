"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { HealthBadge } from "@/components/HealthBadge";
import { ModelCard } from "@/components/ModelCard";
import { PricingCard } from "@/components/PricingCard";
import { useSiteConfig } from "@/lib/use-site-config";
import { siteConfig } from "@/lib/site-config";
import { planToTier, type PricingTier } from "@/lib/pricing-tiers";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionMark } from "@/components/ui/section-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ----------------------------------- data ---------------------------------- */

const steps = [
  {
    n: "01",
    title: "Daftar & isi wallet",
    desc: "Buat akun dan isi saldo prabayar dengan metode pembayaran yang tersedia. Tanpa langganan bulanan, tanpa biaya tersembunyi.",
  },
  {
    n: "02",
    title: "Terbitkan API key",
    desc: "Satu key untuk seluruh katalog model. Disimpan sebagai hash kriptografis dan hanya tampil sekali saat dibuat.",
  },
  {
    n: "03",
    title: "Kirim request pertama",
    desc: "Arahkan SDK OpenAI ke base URL gateway. Ubah satu baris kode — aplikasi yang sudah ada tetap berjalan.",
  },
];

const faqs = [
  {
    q: "Apa itu AI gateway?",
    a: "Gateway adalah perantara antara aplikasi Anda dan penyedia model AI. Alih-alih mendaftar dan mengelola banyak layanan, Anda cukup satu akun, satu API key, dan satu titik masuk untuk semua model.",
  },
  {
    q: "Bagaimana cara pembayarannya?",
    a: "Semuanya prabayar. Isi saldo wallet lewat transfer bank, e-wallet, atau QRIS, lalu beli paket token atau biarkan pemakaian dipotong langsung dari saldo. Tidak ada langganan dan tidak ada biaya bulanan.",
  },
  {
    q: "Apa yang terjadi jika saldo habis di tengah pemakaian?",
    a: "Paket token aktif akan dipakai lebih dulu; sisanya otomatis fallback ke saldo wallet. Jika keduanya tidak cukup, permintaan ditolak dengan jelas — tidak ada tagihan mengejutkan.",
  },
  {
    q: "Apakah API key saya aman?",
    a: "Key disimpan dalam bentuk yang tidak dapat dibaca dan hanya ditampilkan sekali saat dibuat. Anda bisa membatasi model yang boleh diakses, mengatur masa berlaku, dan me-regenerate kapan saja.",
  },
  {
    q: "Apakah kode saya harus diubah untuk pindah ke sini?",
    a: "Hampir tidak. Gateway menggunakan format API standar industri — umumnya cukup mengganti base URL dan API key pada SDK yang sudah ada.",
  },
  {
    q: "Model apa saja yang tersedia?",
    a: "Katalog mencakup puluhan hingga ratusan model dari berbagai penyedia besar. Daftar lengkap beserta tarif per model dapat dilihat pada bagian Model di halaman ini atau halaman katalog.",
  },
];

/* --------------------------------- component -------------------------------- */

function MarqueeTicker({ models }: { models: { name: string }[] }) {
  // SSR-safe fixed count so initial HTML matches client render
  const reps = Math.max(2, Math.ceil(1920 / (models.length * 120)) + 1);
  const half = Array.from({ length: reps }, () => models).flat();
  const items = [...half, ...half];

  const [duration, setDuration] = useState(`${Math.min(60, items.length * 5)}s`);
  useEffect(() => {
    const clientReps = Math.max(2, Math.ceil(window.innerWidth / (models.length * 120)) + 1);
    setDuration(`${Math.min(60, clientReps * 5)}s`);
  }, [models.length]);

  return (
    <section aria-hidden className="motion-reduce:hidden overflow-hidden border-y border-border py-5">
      <div className="flex w-max animate-[marquee_10s_linear_infinite] whitespace-nowrap" style={{ animationDuration: duration }}>
        {items.map((m, i) => (
          <span key={i} className="flex items-center text-sm text-muted-foreground">
            <span className="px-6">{m.name}</span>
            <span className="text-primary/60">·</span>
          </span>
        ))}
      </div>
    </section>
  );
}

export default function LandingPage() {
  const siteCfg = useSiteConfig();
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.plans?.length > 0) setPricingTiers(data.plans.map(planToTier));
      })
      .catch(() => {});
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIsAuthenticated(Boolean(data?.authenticated)))
      .catch(() => setIsAuthenticated(false));
  }, []);

  // Reveal-on-scroll untuk elemen .reveal
  // Dipicu ulang saat data asinkron termuat agar elemen yang baru dirender ikut diobservasi.
  const revealKey = `${siteCfg.loaded}-${pricingTiers.length}-${siteCfg.models.length}`;
  useEffect(() => {
    const els = document.querySelectorAll(".reveal:not(.is-visible)");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-visible")),
      { threshold: 0.05, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealKey]);

  const ctaHref = isAuthenticated ? "/dashboard" : "/register";

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: no-preference) { .rise { opacity: 0; animation: rise .8s cubic-bezier(.22,.61,.36,1) forwards; } }
        @media (prefers-reduced-motion: reduce) { .rise { opacity: 1; animation: none; } }
        @keyframes marquee { to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { .animate-\\[marquee_10s_linear_infinite\\] { animation: none !important; } }
        /* Reveal on scroll */
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity .7s cubic-bezier(.22,.61,.36,1), transform .7s cubic-bezier(.22,.61,.36,1); }
        .reveal.is-visible { opacity: 1; transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } }
        /* Hero: pola grid halus pada background */
        .hero-grid {
          background-image:
            radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklch, var(--color-primary) 12%, transparent), transparent),
            linear-gradient(to right, color-mix(in oklch, var(--color-foreground) 4%, transparent) 1px, transparent 1px),
            linear-gradient(to bottom, color-mix(in oklch, var(--color-foreground) 4%, transparent) 1px, transparent 1px);
          background-size: 100% 100%, 48px 48px, 48px 48px;
        }
      `}</style>

      {/* ============================== Navigation ============================== */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" aria-label="Beranda" className="flex items-center gap-2.5 transition-colors">
            {siteCfg.loaded ? (
              <>
                {siteCfg.logoMode !== "name" && <BrandLogo siteCfg={siteCfg} />}
                {siteCfg.logoMode !== "logo" && <span className="text-base font-bold">{siteCfg.siteName || siteConfig.brandName}</span>}
              </>
            ) : (
              <>
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-4 w-24" />
              </>
            )}
          </Link>

          <nav aria-label="Navigasi utama" className="hidden items-center gap-8 md:flex">
            {[
              ["Cara kerja", "#cara-kerja"],
              ...(siteCfg.models.length > 0 ? [["Model", "#model"]] : []),
              ...(pricingTiers.length > 0 ? [["Harga", "#harga"]] : []),
              ["FAQ", "#faq"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 px-4")}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden h-9 px-4 sm:inline-flex")}>
                  Masuk
                </Link>
                <Link href="/register" className={cn(buttonVariants({ size: "sm" }), "h-9 px-4")}>
                  Daftar <ArrowRight />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ================================= Hero ================================= */}
      <section className="hero-grid relative overflow-hidden px-6 pb-20 pt-44">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-background via-background/70 to-transparent" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
          <HealthBadge className="rise gap-3 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium" />

          <h1 className="rise mx-auto mt-8 max-w-3xl text-balance text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl" style={{ animationDelay: "80ms" }}>
            Satu endpoint, <span className="text-primary">semua model.</span>
            <br />
            Harga lokal.
          </h1>

          {siteCfg.loaded ? (
            <p className="rise mx-auto mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground" style={{ animationDelay: "160ms" }}>
              {siteCfg.description}
            </p>
          ) : (
            <div className="rise mx-auto mt-10 max-w-xl space-y-2" style={{ animationDelay: "160ms" }}>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="mx-auto h-5 w-3/4" />
            </div>
          )}

          <div className="rise mt-10 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "240ms" }}>
            <Link href={ctaHref} className={cn(buttonVariants({ size: "lg" }), "h-11 px-6")}>
              {isAuthenticated ? "Buka Dashboard" : "Mulai Gratis"}
              <ArrowRight />
            </Link>
            <Link href="#harga" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-6")}>
              Lihat harga
            </Link>
          </div>
        </div>
      </section>

      {/* ============================ Ticker model ============================= */}
      {siteCfg.models.length > 0 && (
        <MarqueeTicker models={siteCfg.models} />
      )}

      {/* ============================== Cara kerja ============================== */}
      <section id="cara-kerja" aria-labelledby="cara-kerja-title" className="reveal scroll-mt-24 px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <SectionMark label="Cara kerja" />
          <h2 id="cara-kerja-title" className="mt-4 max-w-xl text-3xl font-bold tracking-tight md:text-4xl">
            Integrasi dalam <span className="text-primary">tiga langkah</span>
          </h2>

          <ol className="mt-16 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.n} className="reveal rounded-xl bg-card p-8 ring-1 ring-border/40 transition-all duration-200 hover:-translate-y-0.5 hover:ring-primary/50 hover:bg-card/80 hover:shadow-[0_8px_30px_-12px_color-mix(in_oklch,var(--color-primary)_25%,transparent)]" style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary">{s.n}</span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================================= Model ================================ */}
      {siteCfg.models.length > 0 && (
        <section id="model" aria-labelledby="model-title" className="reveal scroll-mt-24 border-t border-border px-6 py-28">
          <div className="mx-auto max-w-6xl">
          <SectionMark label="Model" />
            <h2 id="model-title" className="mt-4 max-w-xl text-3xl font-bold tracking-tight md:text-4xl">
              Katalog <span className="text-primary">{siteCfg.models.length} model</span>
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Semua model aktif beserta tarifnya. Harga dalam rupiah per 1.000 token.
            </p>

            <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {siteCfg.models.map((m, i) => (
                <ModelCard key={m.modelId} model={m} className="reveal" style={{ transitionDelay: `${(i % 3) * 80}ms` }} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================================= Harga ================================ */}
      {pricingTiers.length > 0 && (
        <section id="harga" aria-labelledby="harga-title" className="reveal scroll-mt-24 border-t border-border px-6 py-28">
          <div className="mx-auto max-w-6xl">
          <SectionMark label="Harga" />
            <h2 id="harga-title" className="mt-4 max-w-xl text-3xl font-bold tracking-tight md:text-4xl">
              Prabayar. <span className="text-primary">Tanpa langganan.</span>
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Isi wallet, beli paket token, atau bayar per pemakaian. Setiap paket berlaku 30 hari.
            </p>

            <ul className="mt-16 grid gap-4 md:grid-cols-3">
              {pricingTiers.map((t, i) => (
                <PricingCard key={t.name} tier={t} isAuthenticated={isAuthenticated} className="reveal" style={{ transitionDelay: `${i * 90}ms` }} />
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ================================== FAQ ================================= */}
      <section id="faq" className="reveal scroll-mt-24 border-t border-border px-6 py-28">
        <div className="mx-auto grid max-w-6xl gap-16 md:grid-cols-[1fr_1.6fr]">
          <div>
          <SectionMark label="FAQ" />
            <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              Pertanyaan yang <span className="text-primary">sering diajukan</span>
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Ada pertanyaan lain?{" "}
              <Link href="/support" className="text-primary underline-offset-4 hover:underline">
                Hubungi tim dukungan
              </Link>
              .
            </p>
          </div>

          <dl className="divide-y divide-border/60 border-y border-border/60">
            {faqs.map((f) => (
              <div key={f.q}>
                <dt>
                  <button
                    onClick={() => setOpenFaq(openFaq === f.q ? null : f.q)}
                    aria-expanded={openFaq === f.q}
                    className="group -mx-2 flex w-full items-center justify-between gap-6 rounded-md px-2 py-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span className="font-medium transition-colors group-hover:text-primary">{f.q}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300", openFaq === f.q && "rotate-180")} />
                  </button>
                </dt>
                {openFaq === f.q && <dd className="pb-6 pr-10 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>}
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* =============================== CTA akhir =============================== */}
      <section className="reveal border-t border-border px-6 py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            Request pertama Anda <span className="text-primary">lima menit</span> dari sekarang.
          </h2>
          <div className="mt-12">
            <Link href={ctaHref} className={cn(buttonVariants({ size: "lg" }), "h-11 px-8")}>
              {isAuthenticated ? "Buka Dashboard" : "Daftar Sekarang"}
              <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================ Footer ================================ */}
      <footer className="border-t border-border bg-muted/40 px-6">
        <div className="mx-auto grid max-w-6xl gap-12 py-16 md:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="Beranda" className="inline-flex items-center gap-2.5 transition-colors">
              {siteCfg.loaded ? (
                <>
                  {siteCfg.logoMode !== "name" && <BrandLogo size="lg" siteCfg={siteCfg} />}
                  {siteCfg.logoMode !== "logo" && <span className="text-base font-bold">{siteCfg.siteName || siteConfig.brandName}</span>}
                </>
              ) : (
                <>
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-4 w-24" />
                </>
              )}
            </Link>
            {siteCfg.loaded && <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted-foreground">{siteCfg.tagline}</p>}

            <p className="mt-6">
              <HealthBadge withBorder />
            </p>
          </div>

          <nav aria-label="Produk">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Produk</h3>
            <ul className="mt-5 space-y-3 text-sm">
              {[
                ...(siteCfg.models.length > 0 ? [["Model AI", "#model"]] : []),
                ...(pricingTiers.length > 0 ? [["Paket & Harga", "#harga"]] : []),
                ["Masuk", "/login"],
                ["Daftar", "/register"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-muted-foreground transition-colors hover:text-foreground">{label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Dukungan">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Dukungan</h3>
            <ul className="mt-5 space-y-3 text-sm">
              {[
                ["Pusat Bantuan", "/support"],
                ["Usage & Tagihan", "/usage"],
              ].map(([label, href]) => (
                <li key={label}>
                  {href.startsWith("mailto:") ? (
                    <a href={href} className="text-muted-foreground transition-colors hover:text-foreground">{label}</a>
                  ) : (
                    <Link href={href} className="text-muted-foreground transition-colors hover:text-foreground">{label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-border py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>&copy; {new Date().getFullYear()} {siteCfg.siteName || siteConfig.brandName}. Semua hak dilindungi.</p>
          <p className="font-mono uppercase tracking-wider">OpenAI-compatible&nbsp;·&nbsp;API v1</p>
        </div>
      </footer>
    </div>
  );
}
