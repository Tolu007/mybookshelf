export const BOOK_FILE_ERRORS = {
  drive_reconnect: { status: 403, message: "Your Google Drive connection needs to be renewed. Reconnect Google Drive, then try opening this book again.", reconnect: true },
  drive_configuration: { status: 500, message: "Book downloads aren't configured correctly on the server. Please contact the app owner.", reconnect: false },
  token_store_unavailable: { status: 503, message: "We couldn't retrieve your Google Drive connection. Please try again in a moment.", reconnect: false },
  file_missing: { status: 404, message: "This book's file is no longer available. Check Google Drive, or upload a fresh copy from your library.", reconnect: false },
  drive_rate_limit: { status: 429, message: "Google Drive is receiving too many requests. Please wait a moment and try again.", reconnect: false },
  drive_unavailable: { status: 503, message: "We couldn't reach Google Drive to download this book. Please try again in a moment.", reconnect: false },
} as const;

export type BookFileErrorCode = keyof typeof BOOK_FILE_ERRORS;

export class DriveAccessError extends Error {
  constructor(public readonly code: BookFileErrorCode) {
    super(BOOK_FILE_ERRORS[code].message);
  }
}

export function isBookFileErrorCode(value: unknown): value is BookFileErrorCode {
  return typeof value === "string" && Object.hasOwn(BOOK_FILE_ERRORS, value);
}

export function classifyBookFileError(error: unknown) {
  const upstream = error as {
    response?: { status?: number; data?: { error?: string | { errors?: { reason?: string }[] } } };
    code?: string;
    message?: string;
  } | null;
  const upstreamStatus = typeof upstream?.response?.status === "number" ? upstream.response.status : null;
  const googleError = upstream?.response?.data?.error;
  const reason = typeof googleError === "object" ? googleError?.errors?.[0]?.reason : null;
  const oauthError = typeof googleError === "string" ? googleError : null;
  let code: BookFileErrorCode = "drive_unavailable";
  if (error instanceof DriveAccessError) code = error.code;
  else if (oauthError === "invalid_client" || oauthError === "unauthorized_client" || /^invalid_client\b/.test(upstream?.message ?? "")) code = "drive_configuration";
  else if (oauthError === "invalid_grant" || /^invalid_grant\b/.test(upstream?.message ?? "") || upstreamStatus === 401) code = "drive_reconnect";
  else if (upstreamStatus === 429 || reason === "rateLimitExceeded" || reason === "userRateLimitExceeded" || reason === "downloadQuotaExceeded") code = "drive_rate_limit";
  else if (upstreamStatus === 403) code = "drive_reconnect";
  else if (upstreamStatus === 404) code = "file_missing";

  // Never log the SDK error itself: it can contain Authorization headers,
  // OAuth client secrets, refresh tokens, or a full request body.
  const transportCode = ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"].includes(upstream?.code ?? "") ? upstream!.code : null;
  return { code, upstreamStatus, transportCode, ...BOOK_FILE_ERRORS[code] };
}
