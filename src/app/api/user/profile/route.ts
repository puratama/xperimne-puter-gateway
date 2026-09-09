import { NextRequest, NextResponse } from "next/server";
import { resolvePublicUser } from "@/lib/public-api";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const identity = await resolvePublicUser(request);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: identity.user.id },
    select: { id: true, email: true, name: true, role: true, provider: true, providerId: true, avatar: true, passwordHash: true, createdAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { passwordHash, providerId, ...rest } = user;
  return NextResponse.json({ user: { ...rest, hasPassword: !!passwordHash, hasGoogle: !!providerId } });
}

export async function PUT(request: NextRequest) {
  const identity = await resolvePublicUser(request);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name } = body as { name?: string };

    const trimmedName = name?.trim();
    if (!trimmedName) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: identity.user.id },
      data: { name: trimmedName },
      select: { id: true, email: true, name: true, role: true, provider: true, avatar: true, createdAt: true },
    });

    return NextResponse.json({ user });
  } catch (error: unknown) {
    // Prisma unique constraint violation
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    console.error("[profile-update]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
