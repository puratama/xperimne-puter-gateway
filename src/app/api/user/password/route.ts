import { NextRequest, NextResponse } from "next/server";
import { getSession, destroySession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/db";

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!newPassword) {
      return NextResponse.json({ error: "newPassword required" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { passwordHash: true, provider: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.passwordHash) {
      // Existing password: require currentPassword to change
      if (!currentPassword) {
        return NextResponse.json({ error: "currentPassword required" }, { status: 400 });
      }
      const { valid } = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
      }
    }
    // No passwordHash yet (Google-only user setting password for first time) — skip currentPassword check

    const newHash = await hashPassword(newPassword);
    const isFirstTimeSet = !user.passwordHash;

    await prisma.user.update({
      where: { id: session.sub },
      data: { passwordHash: newHash },
    });

    // Only invalidate sessions when changing an existing password,
    // not when Google user sets password for the first time
    if (!isFirstTimeSet) {
      await destroySession();
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[password-change]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
