import type { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

export function rateLimit(limit: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();
  return (request: Request, response: Response, next: NextFunction) => {
    const key = request.ip || 'unknown';
    const now = Date.now();
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, limit - bucket.count));
    if (bucket.count > limit) return response.status(429).json({ error: 'Too many requests', retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) });
    return next();
  };
}
