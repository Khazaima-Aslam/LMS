import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeManagedRole,
  privateUserFromRow,
  publicUserFromPrivate,
  userToRow,
} from "../lib/managedUsers.ts";

test("normalizes allowed roles and rejects invalid roles", () => {
  assert.equal(normalizeManagedRole("Admin"), "admin");
  assert.equal(normalizeManagedRole(" user "), "user");
  assert.throws(() => normalizeManagedRole("owner"), /Role must/);
});

test("converts spreadsheet rows into typed private users", () => {
  const user = privateUserFromRow([
    "john.doe",
    "John Doe",
    "admin",
    "salt-value",
    "hash-value",
    "TRUE",
    "2026-09-25T00:00:00.000Z",
    "2026-09-25T01:00:00.000Z",
  ]);

  assert.equal(user.username, "john.doe");
  assert.equal(user.role, "admin");
  assert.equal(user.active, true);
  assert.equal(user.passwordHash, "hash-value");
});

test("never exposes password material in public user objects", () => {
  const privateUser = privateUserFromRow([
    "jane",
    "Jane",
    "user",
    "secret-salt",
    "secret-hash",
    "FALSE",
    "",
    "",
  ]);

  const publicUser = publicUserFromPrivate(privateUser);
  assert.deepEqual(publicUser, {
    username: "jane",
    displayName: "Jane",
    role: "user",
    active: false,
    createdAt: "",
    updatedAt: "",
  });
  assert.equal("passwordHash" in publicUser, false);
  assert.equal("passwordSalt" in publicUser, false);
});

test("writes private users to the expected sheet column order", () => {
  const row = userToRow({
    username: "jane",
    displayName: "Jane",
    role: "user",
    passwordSalt: "salt",
    passwordHash: "hash",
    active: true,
    createdAt: "created",
    updatedAt: "updated",
  });

  assert.deepEqual(row, [
    "jane",
    "Jane",
    "user",
    "salt",
    "hash",
    "TRUE",
    "created",
    "updated",
  ]);
});
