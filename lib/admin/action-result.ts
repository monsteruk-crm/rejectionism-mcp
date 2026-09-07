export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

export function actionSuccess<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function actionFailure(
  error: string,
  code?: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error, code, fieldErrors };
}
