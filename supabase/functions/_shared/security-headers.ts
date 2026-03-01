/**
 * SEC-06: Security response headers.
 * ISO 27001 A.14.1 — Security requirements of information systems.
 */

export const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/** Merge security headers into an existing headers object */
export function withSecurityHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  return { ...headers, ...securityHeaders };
}
