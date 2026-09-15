/**
 * Answer encryption helpers — E2E_LOCKS §6.
 *
 * TODO(slice C): this module is owned by the scoring/crypto slice. The API
 * below is what the route handlers depend on; replace the bodies freely as
 * long as the exported signatures stay compatible.
 *
 * ANSWER_MASTER_KEY is 32 raw bytes, standard Base64. Wrong lengths are
 * rejected at first use.
 *
 * Wrapped DEK layout: iv(12) || tag(16) || ciphertext.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { readEnv } from "./env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export interface AnswerPayload {
  answer: unknown;
}

export interface SealedAnswer {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export type EncryptedValue = SealedAnswer;

let masterKeyCache: Buffer | undefined;

export function parseMasterKey(encoded: string): Buffer {
  if (
    typeof encoded !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4}){10}[A-Za-z0-9+/]{3}=$/.test(encoded)
  ) {
    throw new Error("ANSWER_MASTER_KEY must be standard Base64 encoding 32 bytes");
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_BYTES || key.toString("base64") !== encoded) {
    throw new Error("ANSWER_MASTER_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export function getAnswerMasterKey(value = readEnv("ANSWER_MASTER_KEY")): Buffer {
  if (!value) throw new Error("Missing required environment variable: ANSWER_MASTER_KEY");
  return parseMasterKey(value);
}

export function masterKey(): Buffer {
  if (masterKeyCache) return masterKeyCache;
  masterKeyCache = getAnswerMasterKey();
  return masterKeyCache;
}

export function generateDek(): Buffer {
  return randomBytes(KEY_BYTES);
}

function validateKey(key: Buffer, name: string): void {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new RangeError(`${name} must be exactly 32 bytes`);
  }
}

/** Encrypts a DEK with the master key into the iv||tag||ciphertext layout. */
export function wrapDek(dek: Buffer, key = masterKey()): Buffer {
  validateKey(dek, "DEK");
  validateKey(key, "Master key");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function unwrapDek(
  wrapped: Buffer | Uint8Array,
  key = masterKey(),
): Buffer {
  validateKey(key, "Master key");
  const buf = Buffer.from(wrapped);
  if (buf.length !== IV_BYTES + TAG_BYTES + KEY_BYTES) {
    throw new Error("Wrapped DEK must use iv(12)|tag(16)|ciphertext(32)");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Encrypts `{ answer }` JSON with the per-check DEK. */
export function encryptAnswer(dek: Buffer, answer: unknown): SealedAnswer;
export function encryptAnswer(answer: unknown, dek: Buffer): SealedAnswer;
export function encryptAnswer(first: unknown, second: unknown): SealedAnswer {
  const [dek, answer] = Buffer.isBuffer(first)
    ? [first, second]
    : [second as Buffer, first];
  validateKey(dek, "DEK");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, dek, iv);
  const plaintext = Buffer.from(
    JSON.stringify({ answer } satisfies AnswerPayload),
    "utf8",
  );
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function decryptAnswer(dek: Buffer, sealed: SealedAnswer): unknown;
export function decryptAnswer(sealed: SealedAnswer, dek: Buffer): unknown;
export function decryptAnswer(
  first: Buffer | SealedAnswer,
  second: Buffer | SealedAnswer,
): unknown {
  const [dek, sealed] = Buffer.isBuffer(first)
    ? [first, second as SealedAnswer]
    : [second as Buffer, first];
  validateKey(dek, "DEK");
  if (sealed.iv.length !== IV_BYTES || sealed.authTag.length !== TAG_BYTES) {
    throw new RangeError("AES-GCM IV/tag must be 12/16 bytes");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    dek,
    Buffer.from(sealed.iv),
  );
  decipher.setAuthTag(Buffer.from(sealed.authTag));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext)),
    decipher.final(),
  ]);
  const parsed = JSON.parse(plaintext.toString("utf8")) as AnswerPayload;
  return parsed.answer;
}

/** Invite tokens: raw token is returned to the caller once; only the hash is stored. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export const encryptDek = wrapDek;
export const decryptDek = unwrapDek;
export const generateDEK = generateDek;
