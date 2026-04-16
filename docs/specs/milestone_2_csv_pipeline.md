# Milestone 2 — CSV Import Pipeline (Source of Truth)

## 🎯 Purpose

Enable fast, repeatable ingestion of Music League data via CSV, optimized for low-friction, post-round updates.

---

## 🧭 Guiding Principles

1. Speed over perfection  
2. Import is a workflow, not a one-off  
3. Trust but verify  
4. Staging before commit  

---

## 🧩 User Story Alignment

> An admin can upload a CSV after a round, quickly review flagged issues, and commit clean data to the database in a fast, repeatable workflow.

---

## 🧱 System Overview

Pipeline stages:
1. Upload  
2. Parse  
3. Normalize  
4. Match  
5. Validate  
6. Commit  

---

## 📥 Input Expectations

Expected fields:
- song  
- artist  
- submitter  
- round  
- score or rank  

Flexible format tolerated.

---

## 🔄 Stage 1 — Upload

- Accept CSV via UI or CLI  
- Immediate processing  

---

## 🧪 Stage 2 — Parsing

Output structure:
{
  song_name,
  artist_name,
  player_name,
  round_name,
  score,
  rank
}

---

## 🧼 Stage 3 — Normalization

- lowercase  
- trim  
- remove punctuation  

---

## 🔗 Stage 4 — Matching

Match rules:
- Songs: song + artist  
- Artists: artist  
- Players: player  
- Rounds: round  

Outcomes:
- matched  
- new  
- ambiguous  

---

## ⚠️ Stage 5 — Validation

Only surface issues.

Clean example:
32 submissions parsed  
2 new songs  
0 issues  

Admin actions:
- confirm  
- create  
- edit  

---

## ✅ Stage 6 — Commit

Insert:
- songs  
- artists  
- players  
- rounds  
- submissions  

---

## 🧠 Data Contracts

Required:
- song_id  
- player_id  
- round_id  

---

## 🗂️ Staging Layer

Temporary storage before commit.

---

## 📊 Import Summary

Display:
- submissions count  
- new entities  
- issues  

---

## 🧾 Import History

Track:
- timestamp  
- rows  
- entities created  

---

## ⚡ Performance

- parse <2s  
- commit <2s  

---

## ❌ Non-Goals

- fuzzy matching UI  
- scraping  
- AI cleaning  

---

## ✅ Acceptance Criteria

- upload works  
- clean import = zero interaction  
- issues resolvable quickly  
- correct relationships created  

---

## 🚀 Next

Milestone 3 — Round Page

---

## Appendix D: Discoveries Log

### D-001 — 2026-04-17T00:00:00Z

- **Trigger:** Loading the runtime-authoritative `spec_universal_path` and `spec_task_slice_path` for `TASK-02`.
- **Nature:** `gap`
- **Affected sections:** Dispatch package for Milestone 2 / `TASK-02` (no approved dispatchable spec or task slice present in the worktree).
- **Agent assessment:** Implementation should wait for an approved `SPEC-002` universal file plus a `TASK-02` slice, or an approved full spec with task annotations and contract references.
- **Escalation required:** `yes`
- **Resolution:** Pending orchestrator/spec update.
