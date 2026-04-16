# Slice: TASK-00 — Initialize project

> **Depends-on:** (none)
> **Universal:** SPEC-001-core-data-model-universal.md (§1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries)

---

### 4e. Dependencies

| Package | Purpose | Rationale |
|---|---|---|
| `prisma` | Schema management, migrations, Prisma CLI | ORM for SQLite; manages schema and migration files |
| `@prisma/client` | Type-safe DB query client | Generated from schema; used by seed script and all downstream consumers |

**Language:** JavaScript (CommonJS). All source files use `.js` extensions and
`require` / `module.exports`. No TypeScript in this milestone.

**Test runner:** `node:test` (Node.js built-in, v18+). No additional test
dependency.

---

---

0. **[TASK-00] Initialize project** — Run `npm init -y` at the repo root. Install
   dependencies: `npm install prisma @prisma/client`. Run `npx prisma init` to
   generate `prisma/schema.prisma` (stub) and `.env`. Set
   `DATABASE_URL="file:./dev.db"` in `.env`. Add `.env` to `.gitignore`.
   `contracts: §4e` · `preserves: INV-04`

---
