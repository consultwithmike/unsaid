import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import type { Answer } from "../shared/types";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface EncryptedValue {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export function parseMasterKey(encoded: string): Buffer {
  if (
    typeof encoded !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4}){10}[A-Za-z0-9+/]{2}==$/.test(encoded)
  ) {
    throw new Error("ANSWER_MASTER_KEY must be standard Base64 encoding 32 bytes");
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_BYTES || key.toString("base64") !== encoded) {
    throw new Error("ANSWER_MASTER_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export function getAnswerMasterKey(
  value: string | undefined = process.env.ANSWER_MASTER_KEY,
): Buffer {
  if (!value) throw new Error("ANSWER_MASTER_KEY is required");
  return parseMasterKey(value);
}

export function generateDek(): Buffer {
  return randomBytes(KEY_BYTES);
}

function validateKey(key: Buffer, name: string): void {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new RangeError(`${name} must be exactly 32 bytes`);
  }
}

function encryptBytes(plaintext: Buffer, key: Buffer): EncryptedValue {
  validateKey(key, "Encryption key");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

function decryptBytes(value: EncryptedValue, key: Buffer): Buffer {
  validateKey(key, "Encryption key");
  if (value.iv.length !== IV_BYTES || value.authTag.length !== TAG_BYTES) {
    throw new RangeError("AES-GCM IV/tag must be 12/16 bytes");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, value.iv);
  decipher.setAuthTag(value.authTag);
  return Buffer.concat([
    decipher.update(value.ciphertext),
    decipher.final(),
  ]);
}

/** Wrap a DEK as iv(12) | tag(16) | ciphertext(32). */
export function wrapDek(dek: Buffer, masterKey: Buffer): Buffer {
  validateKey(dek, "DEK");
  validateKey(masterKey, "Master key");
  const encrypted = encryptBytes(dek, masterKey);
  return Buffer.concat([
    encrypted.iv,
    encrypted.authTag,
    encrypted.ciphertext,
  ]);
}

export function unwrapDek(wrapped: Buffer, masterKey: Buffer): Buffer {
  validateKey(masterKey, "Master key");
  if (!Buffer.isBuffer(wrapped) || wrapped.length !== IV_BYTES + TAG_BYTES + KEY_BYTES) {
    throw new RangeError("Wrapped DEK must use iv(12)|tag(16)|ciphertext(32)");
  }
  return decryptBytes(
    {
      iv: wrapped.subarray(0, IV_BYTES),
      authTag: wrapped.subarray(IV_BYTES, IV_BYTES + TAG_BYTES),
      ciphertext: wrapped.subarray(IV_BYTES + TAG_BYTES),
    },
    masterKey,
  );
}

/** Encrypt exactly the UTF-8 JSON payload `{answer}`. */
export function encryptAnswer(answer: Answer, dek: Buffer): EncryptedValue {
  const payload = Buffer.from(JSON.stringify({ answer }), "utf8");
  return encryptBytes(payload, dek);
}

export function decryptAnswer(value: EncryptedValue, dek: Buffer): Answer {
  const parsed: unknown = JSON.parse(decryptBytes(value, dek).toString("utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    !Object.prototype.hasOwnProperty.call(parsed, "answer") ||
    Object.keys(parsed).length !== 1
  ) {
    throw new Error("Decrypted response payload is invalid");
  }
  return (parsed as { answer: Answer }).answer;
}

export const encryptDek = wrapDek;
export const decryptDek = unwrapDek;
export const generateDEK = generateDek;
