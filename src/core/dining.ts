export type DiningChoice = { mode: 'dine-in'; guests: number } | { mode: 'takeaway' };

export function validGuests(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function parseDining(search: string): DiningChoice | undefined {
  const params = new URLSearchParams(search);
  if (params.get('mode') === 'takeaway') return { mode: 'takeaway' };
  const guests = Number(params.get('guests'));
  if (params.get('mode') === 'dine-in' && validGuests(guests)) return { mode: 'dine-in', guests };
}

export function diningLabel(dining: DiningChoice): string {
  return dining.mode === 'takeaway' ? '打包自取' : `堂食 · ${dining.guests} 位`;
}
