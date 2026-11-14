export interface RegistrationLookupEntry {
  id: string;
  email: string;
}

export function findRegistrationById<T extends RegistrationLookupEntry>(entries: readonly T[], voterId: string): T | null {
  const id = typeof voterId === "string" ? voterId.trim() : "";
  if (!id) return null;
  return entries.find(entry => entry.id.trim() === id) ?? null;
}

export function findRegistrationByEmail<T extends RegistrationLookupEntry>(entries: readonly T[], email: string): T | null {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail) return null;
  return entries.find(entry => entry.email.trim().toLowerCase() === normalizedEmail) ?? null;
}
