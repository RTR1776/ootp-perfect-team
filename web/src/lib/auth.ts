/**
 * Single-user auth.
 *
 * The app holds no secrets beyond one person's card collection, and there is
 * exactly one user, so a full auth provider would be more moving parts than the
 * problem deserves. This is a signed JWT in an httpOnly cookie, verified in
 * middleware — enough to sit safely on the public web.
 *
 * If this ever becomes multi-user, replace this file with Auth.js and add a
 * `users` table; nothing else in the app reads the cookie directly.
 */

import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "ootp_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set to a random string of at least 32 characters. Generate one with: openssl rand -base64 32",
    );
  }
  return new TextEncoder().encode(value);
}

/**
 * Constant-time-ish comparison. Not a perfect defence against timing analysis
 * over the network, but it costs nothing and removes the easy version.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD is not set.");
  return safeEqual(candidate, expected);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
