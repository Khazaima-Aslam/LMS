import test from "node:test";
import assert from "node:assert/strict";

import {
  hashManagedPassword,
  normalizeManagedUsername,
  validateManagedPassword,
  verifyManagedPassword,
} from "../lib/userSecurity.ts";

test("normalizes managed usernames consistently", () => {
  assert.equal(normalizeManagedUsername("  John.Doe_7  "), "john.doe_7");
});

test("rejects invalid managed usernames", () => {
  assert.throws(() => normalizeManagedUsername("ab"), /3-50/);
  assert.throws(() => normalizeManagedUsername("john doe"), /letters/);
});

test("requires a reasonably strong managed password length", () => {
  assert.throws(() => validateManagedPassword("short"), /8 characters/);
  assert.equal(validateManagedPassword("long-enough-password"), "long-enough-password");
});

test("hashes and verifies passwords without storing the password itself", () => {
  const first = hashManagedPassword("ExamplePassword123!");
  const second = hashManagedPassword("ExamplePassword123!");

  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(verifyManagedPassword("ExamplePassword123!", first.salt, first.hash), true);
  assert.equal(verifyManagedPassword("wrong-password", first.salt, first.hash), false);
});
