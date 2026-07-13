/**
 * Privacy helpers for how a player is shown to OTHER users.
 *
 * Players give their full first name, last name, and exact age at onboarding
 * (and see their own full details), but everyone else only sees a first name +
 * last initial and a 5-year age bracket.
 */

/** "Jill" + "White" → "Jill W." · missing last name → just the first name. */
export function displayName(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (!first) return "Player";
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

/** Exact age → a 5-year bracket aligned to multiples of 5. 46 → "45 - 50". */
export function ageBracket(age?: number | null): string | undefined {
  if (age == null || !Number.isFinite(age) || age <= 0) return undefined;
  const low = Math.floor(age / 5) * 5;
  return `${low} - ${low + 5}`;
}
