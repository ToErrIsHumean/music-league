# Milestone 3 — Round Page (Source of Truth)

## 🎯 Purpose

Introduce the first user-facing surface that makes the dataset tangible by presenting each round as a cohesive, scrollable “moment” in the league.

---

## 🧭 Guiding Principles

1. Treat rounds as experiences, not containers  
2. Optimize for readability and flow  
3. Support exploration via lightweight interactions  
4. Keep presentation clean and minimal (artifact-first)

---

## 🧩 User Story Alignment

> A user can browse past rounds and view each round as a cohesive moment—its theme, submissions, and results—allowing them to revisit the league’s history.

---

## 🧱 Core Concept

A **Round** represents:
- a theme  
- a set of submissions  
- an outcome  

It is the primary structural unit of the dataset.

---

## 🧭 Navigation Entry Points

Users can access a round via:
- direct URL (`/round/:id`)
- links from overview
- links from submissions elsewhere in the app

---

## 🧩 Page Structure

### 1. Header (Identity)

- Round name / theme  
- Optional: date  
- Optional: winner (player + song)

---

### 2. Highlights (Lightweight)

Show 2–3:
- winner  
- lowest scoring song  
- notable anomaly (optional)

Purpose: quick scan, not deep analytics

---

### 3. Submissions List (Core Content)

Each row displays:
- song name  
- artist  
- player (submitter)  
- score or rank  

---

## 🔗 Interaction Model

From each submission:

- clicking **song** → opens Song Modal  
- clicking **player** → opens Player Modal  

No full navigation required for these actions.

---

## 🧠 Data Requirements

Each submission must include:
- song_id  
- player_id  
- round_id  
- score or rank  

Round must include:
- name (theme)  
- unique identifier  

---

## ⚡ UX Expectations

- Page loads quickly (<1s perceived)  
- Layout is clean and vertically scrollable  
- Content is immediately understandable  
- No learning curve required  

---

## ❌ Non-Goals (v1)

Do NOT include:
- voting breakdowns  
- charts or visualizations  
- advanced filters  
- comparisons across rounds  

---

## ✅ Acceptance Criteria

- User can access a round via URL  
- Page displays:
  - round name  
  - full submission list  
- Each submission links to:
  - Song modal  
  - Player modal  
- Page is readable and scrollable  
- No errors with partial data (graceful handling)

---

## 🧭 Open Questions (for architect)

1. Should rounds be ordered by:
   - date  
   - insertion order  
   - explicit sequence index?

2. How should missing scores be handled visually?

---

## 🔗 Dependencies

- Requires Milestone 1 (data model)  
- Uses data from Milestone 2 (import pipeline)  

---

## 🚀 Next

Milestone 4 — Player Modal (social identity layer)
