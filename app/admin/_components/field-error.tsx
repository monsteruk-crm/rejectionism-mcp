"use client";

export function FieldError({
  id,
  errors,
}: {
  id?: string;
  errors?: string[] | string | null;
}) {
  if (!errors) return null;

  const errorList = Array.isArray(errors) ? errors : [errors];
  if (errorList.length === 0) return null;

  return (
    <p id={id} className="mt-1 text-xs font-semibold text-rejection-red" role="alert">
      {errorList.join(", ")}
    </p>
  );
}
