import test from "node:test";
import assert from "node:assert/strict";

import {
  decryptUserConnectionConfig,
  encryptUserConnectionConfig,
  normalizeGoogleCredentialInput,
  normalizeSpreadsheetId,
  profileKeyForSession,
} from "../lib/userConnections.ts";

const secret = "test-secret-value-with-sufficient-entropy";

test("normalizes a Google Sheet URL into its spreadsheet ID", () => {
  assert.equal(
    normalizeSpreadsheetId(
      "https://docs.google.com/spreadsheets/d/abcDEF_123-xy/edit#gid=0"
    ),
    "abcDEF_123-xy"
  );
});

test("accepts raw service-account JSON", () => {
  const raw = JSON.stringify({
    type: "service_account",
    client_email: "leadflow@example.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
  });

  const normalized = normalizeGoogleCredentialInput(raw);
  assert.equal(normalized.clientEmail, "leadflow@example.iam.gserviceaccount.com");
  assert.equal(JSON.parse(normalized.json).type, "service_account");
});

test("accepts base64 service-account JSON", () => {
  const raw = JSON.stringify({
    type: "service_account",
    client_email: "leadflow@example.iam.gserviceaccount.com",
    private_key: "key",
  });
  const encoded = Buffer.from(raw, "utf8").toString("base64");

  const normalized = normalizeGoogleCredentialInput(encoded);
  assert.equal(normalized.clientEmail, "leadflow@example.iam.gserviceaccount.com");
  assert.equal(JSON.parse(normalized.json).private_key, "key");
});

test("encrypts and decrypts a per-user connection configuration", () => {
  const config = {
    apifyToken: "apify_api_secret",
    apifyActorId: "compass/crawler-google-places",
    googleSpreadsheetId: "sheet123",
    googleSheetTab: "Leads",
    googleServiceAccountJson: JSON.stringify({
      type: "service_account",
      client_email: "leadflow@example.iam.gserviceaccount.com",
      private_key: "key",
    }),
  };

  const encrypted = encryptUserConnectionConfig(config, secret);
  assert.notEqual(encrypted, JSON.stringify(config));
  assert.equal(encrypted.includes("apify_api_secret"), false);

  const decrypted = decryptUserConnectionConfig(encrypted, secret);
  assert.deepEqual(decrypted, config);
});

test("different account sources get distinct profile keys", () => {
  assert.equal(
    profileKeyForSession({ username: "admin", source: "master" }),
    "master:admin"
  );
  assert.equal(
    profileKeyForSession({ username: "admin", source: "managed" }),
    "managed:admin"
  );
});
