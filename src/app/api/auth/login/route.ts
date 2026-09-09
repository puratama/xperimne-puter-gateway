import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;
    // Normalize before lookup & rate-limit key — "User@X.com " and "user@x.com" are the same account
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !password) {
      return NextResponse.json({ error: "email and password required" }, { status: 400 });
    }

    // Anti brute-force: 5 percobaan / 15 menit per IP+email
    const rl = rateLimit(request, `login:${email}`, { limit: 5, windowMs: 15 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(rl.retryAfterSec / 60)} menit.` },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { apiKeys: true, wallet: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.passwordHash) {
      return NextResponse.json({ error: "Akun ini menggunakan login Google. Silakan login dengan Google." }, { status: 400 });
    }

    const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (user.status !== "active") {
      return NextResponse.json({ error: "Akun tidak aktif" }, { status: 403 });
    }

    // Email verification gate — account must be verified before login
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Email belum diverifikasi. Cek inbox email kamu untuk link verifikasi." },
        { status: 403 }
      );
    }

    // Upgrade legacy SHA-256 hash to bcrypt on successful login
    if (needsRehash) {
      const { hashPassword } = await import("@/lib/password");
      const newHash = await hashPassword(password);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
    }

    const role = user.role === "superadmin" ? "superadmin" : "user";
    await createSession({ sub: user.id, email: user.email, role, status: user.status as "active" | "suspended" | "banned" });

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role, status: user.status },
      apiKey: null,
      wallet: user.wallet ? { balance: Number(user.wallet.balance) } : null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
