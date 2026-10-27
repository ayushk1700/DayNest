/** Normalize user-entered web links and reject non-web protocols. */
export function normalizeShortcutUrl(input: string): string {
  const value = input.trim();
  if (!value) throw new Error('Add a web address for this shortcut.');
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value);
  const hostWithPort = /^[^/?#\s]+:\d+(?:[/?#]|$)/.test(value) && !value.includes('://');
  let parsed: URL;
  try {
    parsed = new URL(hasScheme && !hostWithPort ? value : `https://${value}`);
  } catch {
    throw new Error('Enter a valid website address.');
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password
  )
    throw new Error('Use an http or https web address.');
  if (parsed.href.length > 2048) throw new Error('That web address is too long.');
  return parsed.href;
}

export function isNormalizedShortcutUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return (
      ['http:', 'https:'].includes(parsed.protocol) &&
      !!parsed.hostname &&
      !parsed.username &&
      !parsed.password &&
      parsed.href === value
    );
  } catch {
    return false;
  }
}
