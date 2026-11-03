/** A table code is 1–12 ASCII letters/digits, optionally separated by hyphens. */
export function parseTable(search: string): string | null {
  const values = new URLSearchParams(search).getAll('table');
  if (values.length !== 1) return null;
  const table = values[0]!;
  return /^(?=.{1,12}$)[a-z\d]+(?:-[a-z\d]+)*$/i.test(table) ? table.toUpperCase() : null;
}
