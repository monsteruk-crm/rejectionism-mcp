/**
 * Whitelisted field extraction and normalization for admin form actions.
 */

export interface CleanFormOptions {
  nullableFields?: string[];
  emptyStringFields?: string[];
  numberFields?: string[];
  isoDateFields?: string[];
}

export function extractWhitelistedFormFields(
  formData: FormData,
  allowedFields: string[],
  options: CleanFormOptions = {},
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const nullableSet = new Set(options.nullableFields || []);
  const emptyStringSet = new Set(options.emptyStringFields || []);
  const numberSet = new Set(options.numberFields || []);
  const isoDateSet = new Set(options.isoDateFields || []);

  for (const field of allowedFields) {
    if (!formData.has(field)) {
      continue;
    }

    const rawVal = formData.get(field);

    if (rawVal === null || rawVal === undefined) {
      if (nullableSet.has(field)) {
        result[field] = null;
      }
      continue;
    }

    if (typeof rawVal === "string") {
      const trimmed = rawVal.trim();

      if (trimmed === "") {
        if (emptyStringSet.has(field)) {
          result[field] = "";
        } else if (nullableSet.has(field)) {
          result[field] = null;
        }
        continue;
      }

      if (numberSet.has(field)) {
        const num = Number(trimmed);
        result[field] = isNaN(num) ? rawVal : num;
        continue;
      }

      if (isoDateSet.has(field)) {
        const date = new Date(trimmed);
        result[field] = isNaN(date.getTime()) ? rawVal : date.toISOString();
        continue;
      }

      result[field] = trimmed;
    } else {
      result[field] = rawVal;
    }
  }

  return result;
}
