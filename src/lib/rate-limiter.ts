import { NextRequest } from 'next/server';

// Simple per-IP rate limiter (process-local, best-effort)
const globalAny = globalThis as any;
type WindowCounter = { count: number; resetAt: number };

if (!globalAny.__rateLimit) {
  globalAny.__rateLimit = new Map<string, WindowCounter>();
}

const RATE_MAP: Map<string, WindowCounter> = globalAny.__rateLimit;

function getClientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

export function isRateLimited(
  req: NextRequest,
  routeKey: string,
  limit: number,
  windowMs: number,
): boolean {
  try {
    const ip = getClientIp(req);
    const key = `${routeKey}:${ip}`;
    const now = Date.now();
    const entry = RATE_MAP.get(key);
    
    if (!entry || now > entry.resetAt) {
      RATE_MAP.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    
    if (entry.count >= limit) return true;
    
    entry.count += 1;
    return false;
  } catch {
    return false;
  }
}
