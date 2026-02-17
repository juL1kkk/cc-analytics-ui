const UUID_V4_OR_COMPAT_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return UUID_V4_OR_COMPAT_REGEX.test(value.trim());
}

