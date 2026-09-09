-- Google OAuth support on User
-- passwordHash becomes nullable: Google-registered users have no password until they set one
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'email';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "providerId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_providerId_key" ON "User"("providerId");
