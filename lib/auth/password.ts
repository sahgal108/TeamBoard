import bcrypt from "bcryptjs";

const COST = 10;

// A real hash computed once per process, used so that a login for an unknown email still
// spends one bcrypt comparison. Keeps "user exists" from leaking through response timing.
const DUMMY_HASH = bcrypt.hashSync("teamboard-unknown-user-placeholder", COST);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH);
}
