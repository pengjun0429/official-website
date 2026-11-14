import assert from "node:assert/strict";
import test from "node:test";
import { findRegistrationByEmail, findRegistrationById } from "../src/registrationRoster.ts";

const roster = [
  { id: " 123456789012345678 ", email: "member@example.org" },
  { id: "fumo-42", email: "another@example.org" },
];

test("registration ID matching uses only the official roster and ignores surrounding whitespace", () => {
  assert.equal(findRegistrationById(roster, "123456789012345678"), roster[0]);
  assert.equal(findRegistrationById(roster, "  fumo-42  "), roster[1]);
  assert.equal(findRegistrationById(roster, "not-in-roster"), null);
  assert.equal(findRegistrationById(roster, ""), null);
});

test("registration Email matching trims and ignores letter case", () => {
  assert.equal(findRegistrationByEmail(roster, " MEMBER@EXAMPLE.ORG "), roster[0]);
  assert.equal(findRegistrationByEmail(roster, "unlisted@example.org"), null);
  assert.equal(findRegistrationByEmail(roster, " "), null);
});
