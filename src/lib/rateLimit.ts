// Per-IP sliding-window rate limiter (in-memory).
// Serverless note: state is per warm instance, so this is burst protection,
// not a global quota — sufficient for protecting the Claude API budget from abuse.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

const hits = new Map<string, number[]>();

export function rateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const list = (hits.get(ip) || []).filter((t) => t > windowStart);
  if (list.length >= MAX_REQUESTS) {
    hits.set(ip, list);
    return { allowed: false, remaining: 0 };
  }
  list.push(now);
  hits.set(ip, list);
  // occasional cleanup so the map doesn't grow unbounded
  if (hits.size > 5000) {
    hits.forEach((v, k) => {
      if (!v.some((t) => t > windowStart)) hits.delete(k);
    });
  }
  return { allowed: true, remaining: MAX_REQUESTS - list.length };
}
