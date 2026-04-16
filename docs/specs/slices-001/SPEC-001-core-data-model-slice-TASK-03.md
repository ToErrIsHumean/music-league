# Slice: TASK-03 — Implement normalization utility

> **Depends-on:** (none)
> **Universal:** SPEC-001-core-data-model-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

#### §4d-1. `normalize(input: string): string`

File: `src/lib/normalize.js`

```
normalize(input: string): string

Contract:
  - Pure function (INV-02)
  - Applies in order:
      1. Decode smart quotes: \u2018 \u2019 → '   |   \u201c \u201d → "
      2. Lowercase
      3. Strip characters in the strip set: . , ' "
      4. Collapse runs of whitespace (including tabs) to a single space
      5. Trim leading and trailing whitespace
  - Characters NOT stripped: - ! ? ( ) & + / and all alphanumerics
  - Non-ASCII characters (accents, diacritics) are preserved as-is.
  - Empty output (after step 5) throws:
      Error(`normalize: empty output for input: "${input}"`)

Test cases (must pass):
  normalize("Mr. Brightside")       → "mr brightside"
  normalize("  The Weeknd  ")       → "the weeknd"
  normalize("It\u2019s a Trap")     → "its a trap"
  normalize("wake  up,   mr  crow") → "wake up mr crow"
  normalize("JANE DOE")             → "jane doe"
  normalize("Beyoncé")              → "beyoncé"
  normalize(normalize(x)) === normalize(x)   (idempotent)
```

**Export:** `module.exports = { normalize };`

---

| ID | Condition | Verification |
|---|---|---|
| AC-07 | `normalize()` passes all test cases in §4d-1, including idempotency | `test` |

---

4. **[TASK-03] Implement normalization utility** — Write `src/lib/normalize.js`
   per §4d-1. Write `src/lib/normalize.test.js` using `node:test` with the test
   cases from §4d-1. Run with `node --test src/lib/normalize.test.js`.
   `contracts: §4d-1` · `preserves: INV-02` · `validates: AC-07`

---
