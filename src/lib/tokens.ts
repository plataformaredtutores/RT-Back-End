import crypto from 'crypto'
import argon2 from 'argon2'

export function randomToken(bytes = 64) {
  return crypto.randomBytes(bytes).toString('base64url')
}
export async function hashToken(token: string) {
  return argon2.hash(token)
}
export async function verifyTokenHash(hash: string, token: string) {
  return argon2.verify(hash, token)
}
