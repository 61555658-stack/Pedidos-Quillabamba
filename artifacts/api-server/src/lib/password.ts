import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPasswordHash(password: string, hash: string) {
  const [scheme,salt,expected]=hash.split("$");
  if(scheme!=="scrypt"||!salt||!expected||expected.length!==128)return false;
  const actual=scryptSync(password,salt,64),stored=Buffer.from(expected,"hex");
  return stored.length===actual.length&&timingSafeEqual(actual,stored);
}
