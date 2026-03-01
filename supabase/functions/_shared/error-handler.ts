/**
 * SEC-05: Centralized error handling with sanitized responses.
 * ISO 27001 A.12.4 — Logging and monitoring.
 * Prevents internal implementation details from leaking to clients.
 */

import { getCorsHeaders } from "./cors.ts";

interface ErrorResponseOptions {
  status?: number;
  corsHeaders?: Record<string, string>;
  logPrefix?: string;
}

/** Safe error messages exposed to clients — no stack traces or internal details */
const SAFE_MESSAGES: Record<number, string> = {
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  409: "Conflict",
  422: "Unprocessable entity",
  429: "Too many requests",
  500: "Internal server error",
};

/**
 * Create a sanitized error JSON response.
 * Logs the full error server-side, returns only a safe message to the client.
 */
export function createErrorResponse(
  error: unknown,
  req: Request,
  options: ErrorResponseOptions = {},
): Response {
  const { status = 500, logPrefix = "Edge function error" } = options;
  const headers = options.corsHeaders ?? getCorsHeaders(req);

  // Log full error server-side
  console.error(`${logPrefix}:`, error);

  // Client gets sanitized message only
  const safeMessage =
    status < 500 && error instanceof Error
      ? error.message
      : SAFE_MESSAGES[status] || SAFE_MESSAGES[500];

  return new Response(
    JSON.stringify({ error: safeMessage }),
    {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    },
  );
}

/** Create a typed JSON success response with CORS + security headers */
export function createJsonResponse(
  data: unknown,
  req: Request,
  status = 200,
): Response {
  const headers = getCorsHeaders(req);
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
