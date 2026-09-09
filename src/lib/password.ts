// Password hashing helper using bcryptjs
// Replaces SHA-256 with salt fallback

import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 * Returns bcrypt hash string (includes salt and cost)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash
 * Handles migration: if hash is legacy SHA-256 (64 hex chars), verify with old method
 * and return { valid: true, needsRehash: true } to trigger upgrade
 */
export async function verifyPassword(password: string, storedHash: string): Promise<{
  valid: boolean;
  needsRehash: boolean;
}> {
  // Check if stored hash is bcrypt format (starts with $2a$, $2b$, $2y$)
  if (storedHash.startsWith("$2")) {
    const valid = await bcrypt.compare(password, storedHash);
    return { valid, needsRehash: false };
  }

  // Legacy SHA-256 hash: 64 hex characters
  if (/^[0-9a-f]{64}$/i.test(storedHash)) {
    // Verify using old method (for migration)
    const { legacyHashPassword } = await import("./auth");
    const legacyHash = legacyHashPassword(password);
    // Timing-safe comparison to prevent timing attacks on legacy hashes
    const { timingSafeEqual } = await import("crypto");
    const valid = timingSafeEqual(
      Buffer.from(legacyHash, "hex"),
      Buffer.from(storedHash, "hex")
    );
    return { valid, needsRehash: valid };
  }

  // Unknown format
  return { valid: false, needsRehash: false };
}