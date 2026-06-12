export function preserveMcpCatalogValueIfUnchanged(
  original: string | undefined,
  current: string | undefined,
  translate: (key: string) => string
): string | undefined {
  const trimmed = current?.trim();
  if (!original) return trimmed || undefined;
  return trimmed === translate(original) ? original : trimmed || undefined;
}
