import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { pool } from "./db.js";

const WEBSITE_ID = 10;
const configuredSecret = process.env.SESSION_SECRET;
if (!configuredSecret || configuredSecret.length < 32) {
  throw new Error("SESSION_SECRET is required and must be at least 32 characters");
}
const SECRET: string = configuredSecret;
const EXPIRES_IN = "7d";

export interface TokenPayload {
  userId: number;
  userType: "admin" | "customer";
  username: string;
  websiteId: number;
  preAuth?: boolean;
  onboarding?: boolean;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function signPreAuthToken(payload: Omit<TokenPayload, "preAuth">): string {
  return jwt.sign({ ...payload, preAuth: true }, SECRET, { expiresIn: "5m" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as unknown as TokenPayload;
}

export function verifyPreAuthToken(token: string): TokenPayload {
  const payload = verifyToken(token);
  if (payload.userType !== "admin" || payload.preAuth !== true || payload.websiteId !== WEBSITE_ID) {
    throw new Error("Invalid pre-auth token");
  }
  return payload;
}

export function extractToken(authorization?: string): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req.headers.authorization);
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  let payload: TokenPayload;
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (payload.userType !== "admin" || payload.preAuth === true || payload.websiteId !== WEBSITE_ID) { res.status(403).json({ error: "Forbidden" }); return; }
  void pool.query("SELECT role,status FROM admins WHERE id=$1 LIMIT 1", [payload.userId]).then((result: { rows: Array<{ role: string; status: string }> }) => {
    const { rows } = result;
    const admin = rows[0];
    if (!admin || admin.status !== "active" || admin.role === "owner") { res.status(403).json({ error: "Forbidden" }); return; }
    if (req.method !== "GET" && !["admin", "support"].includes(String(admin.role))) {
      res.status(403).json({ error: "Read-only administrator" });
      return;
    }
    (req as any).admin = { ...payload, role: admin.role };
    next();
  }).catch(next);
}

export function requireCustomer(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req.headers.authorization);
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const payload = verifyToken(token);
    if (payload.userType !== "customer" || payload.websiteId !== WEBSITE_ID) { res.status(403).json({ error: "Forbidden" }); return; }
    if (payload.onboarding && !(req.method === "POST" && req.path === "/customer/auth/onboarding/profile")
        && !req.path.startsWith("/customer/kyc")) {
      res.status(403).json({ error: "Complete profile onboarding before accessing this feature" });
      return;
    }
    (req as any).customer = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
