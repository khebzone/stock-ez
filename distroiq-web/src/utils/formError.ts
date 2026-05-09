import type { FormInstance } from 'antd';

/**
 * Handles API errors professionally:
 * - If error has field-level data (VALIDATION_ERROR / DUPLICATE_ENTRY),
 *   sets errors directly on the form fields.
 * - Otherwise shows the message on a target field or returns the message string.
 */
export function applyApiErrorToForm(
  err: any,
  form: FormInstance,
  fallbackField?: string,
): string | null {
  const errorData = err?.data;
  if (!errorData) return err?.error || err?.message || 'Something went wrong. Please check your connection and try again.';

  // Field-level errors from backend (validation or duplicate)
  if (
    (errorData.errorCode === 'VALIDATION_ERROR' || errorData.errorCode === 'DUPLICATE_ENTRY') &&
    errorData.data &&
    typeof errorData.data === 'object'
  ) {
    const fields = Object.entries(errorData.data).map(([name, errors]) => ({
      name,
      errors: [errors as string],
    }));
    form.setFields(fields);

    // Scroll to the first errored field
    const firstField = fields[0]?.name;
    if (firstField) form.scrollToField(firstField);

    return null; // already shown on field
  }

  // Generic backend error message — show on fallback field or return string
  const message = errorData.message || 'Something went wrong. Please try again.';
  if (fallbackField) {
    form.setFields([{ name: fallbackField, errors: [message] }]);
    return null;
  }
  return message;
}
