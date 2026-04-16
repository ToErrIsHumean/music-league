const test = require("node:test");
const assert = require("node:assert/strict");

const { normalize } = require("./normalize");

test("normalizes representative spec cases", async (t) => {
  const cases = [
    ["Mr. Brightside", "mr brightside"],
    ["  The Weeknd  ", "the weeknd"],
    ["It\u2019s a Trap", "its a trap"],
    ["wake  up,   mr  crow", "wake up mr crow"],
    ["JANE DOE", "jane doe"],
    ["Beyoncé", "beyoncé"],
  ];

  for (const [input, expected] of cases) {
    await t.test(input, () => {
      assert.equal(normalize(input), expected);
    });
  }
});

test("preserves characters outside the strip set", () => {
  assert.equal(normalize("AC/DC & Friends!?"), "ac/dc & friends!?");
  assert.equal(normalize("re-entry + bonus"), "re-entry + bonus");
});

test("is idempotent", () => {
  const input = "  It\u2019s   Mr. Brightside  ";
  const once = normalize(input);

  assert.equal(normalize(once), once);
});

test("throws when normalization produces empty output", () => {
  assert.throws(() => normalize("  . , '\t\"  "), {
    message: 'normalize: empty output for input: "  . , \'\t"  "',
  });
});
