import "server-only";
import { z } from "zod";

export type ServiceErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "TEST_MODE_DISABLED"
  | "ALREADY_EXISTS"
  | "DATABASE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface ServiceError {
  code: ServiceErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError };

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function fail(
  code: ServiceErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ServiceResult<never> {
  const err: ServiceError = { code, message };
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    err.fieldErrors = fieldErrors;
  }
  return { ok: false, error: err };
}

export function testModeDisabledResult(): ServiceResult<never> {
  return fail(
    "TEST_MODE_DISABLED",
    "Unauthenticated test mode is disabled. All campaign operations are blocked.",
  );
}

export function handleZodError(error: z.ZodError): ServiceResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(issue.message);
  }
  return fail("VALIDATION_ERROR", "Validation failed for the provided input.", fieldErrors);
}

export function handleServiceError(error: unknown): ServiceResult<never> {
  if (error instanceof z.ZodError) {
    return handleZodError(error);
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("DATABASE_URL") || message.includes("connect") || message.includes("Can't reach database")) {
    return fail("DATABASE_UNAVAILABLE", "The database is currently unreachable.");
  }

  return fail("INTERNAL_ERROR", "An unexpected error occurred processing the request.");
}
