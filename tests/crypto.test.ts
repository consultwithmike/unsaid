import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptAnswer,
  encryptAnswer,
  generateDek,
  parseMasterKey,
  unwrapDek,
  wrapDek,
} from "../lib/crypto";

describe("answer encryption", () => {
  it("round trips scalar and array answers", () => {
    const dek = generateDek();
    for (const answer of [4, "fully_combined", ["public", "private"]]) {
      const encrypted = encryptAnswer(answer, dek);
      expect(encrypted.iv).toHaveLength(12);
      expect(encrypted.authTag).toHaveLength(16);
      expect(decryptAnswer(encrypted, dek)).toEqual(answer);
    }
  });

  it("authenticates ciphertext", () => {
    const dek = generateDek();
    const encrypted = encryptAnswer(5, dek);
    encrypted.ciphertext[0] ^= 1;
    expect(() => decryptAnswer(encrypted, dek)).toThrow();
  });
});

describe("DEK wrapping and master key validation", () => {
  it("uses iv(12)|tag(16)|ciphertext layout", () => {
    const masterKey = randomBytes(32);
    const dek = generateDek();
    const wrapped = wrapDek(dek, masterKey);
    expect(wrapped).toHaveLength(60);
    expect(unwrapDek(wrapped, masterKey)).toEqual(dek);
  });

  it("accepts only canonical standard Base64 containing 32 bytes", () => {
    const encoded = randomBytes(32).toString("base64");
    expect(parseMasterKey(encoded)).toHaveLength(32);
    expect(() => parseMasterKey(randomBytes(31).toString("base64"))).toThrow();
    expect(() => parseMasterKey(encoded.replace(/\+/g, "-").replace(/\//g, "_"))).toThrow();
  });
});
