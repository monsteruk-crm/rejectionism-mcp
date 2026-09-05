import { ServiceResult } from "@/lib/campaign/results";

export function toMcpToolResult<T extends Record<string, unknown>>(
  result: ServiceResult<T>,
  successSummary?: (data: T) => string,
) {
  if (!result.ok) {
    const fieldDetails = result.error.fieldErrors
      ? ` Errors: ${JSON.stringify(result.error.fieldErrors)}`
      : "";
    const errorText = `[${result.error.code}] ${result.error.message}${fieldDetails}`;

    return {
      content: [{ type: "text" as const, text: errorText }],
      isError: true,
    };
  }

  const summary = successSummary
    ? successSummary(result.data)
    : "Operation completed successfully.";

  return {
    content: [{ type: "text" as const, text: summary }],
    structuredContent: result.data,
  };
}
