# Milestone 5 — Song Modal (Source of Truth)

## 🎯 Purpose

Provide a fast, low-friction way for users to check whether a song has appeared in the league before and view its full history.

---

## 🧭 Guiding Principles

1. Utility first (quick answers)
2. Context-rich, not just yes/no
3. Consistent modal interaction
4. Support exploration loops

---

## 🧩 User Story Alignment

> A user searches for or clicks on a song and quickly sees whether it has appeared before, including who submitted it, when, and how it performed.

---

## 🧱 Core Concept

A **Song Modal** represents:
- identity (song + artist)
- history (all submissions)
- context (who, when, performance)

It is the primary **memory + lookup layer**.

---

## 🧭 Interaction Model

- Opens from:
  - clicking a song anywhere
  - (later) search results
- Displays as modal
- Closes instantly (click outside / ESC)
- Does not disrupt background state

---

## 🧩 Modal Structure

### 1. Header (Identity)

- Song name  
- Artist name  

---

### 2. Summary (Quick Insight)

Display:
- number of times submitted  
- most recent appearance  
- best placement (if available)

Purpose:
- immediate understanding

---

### 3. Submission History (Core)

List of all instances:

Each row:
- player (submitter)  
- round  
- rank or score  

---

## 🔗 Interaction Links

Within modal:

- clicking player → opens Player Modal  
- clicking round → navigates to Round Page  

---

## 🧠 Data Requirements

Song must have:

- associated submissions  
- linked players and rounds  

---

## ⚡ UX Expectations

- Modal opens instantly (<100ms perceived)
- Core info visible without scrolling
- History list is clean and readable
- Supports rapid navigation between entities

---

## ❌ Non-Goals (v1)

Do NOT include:
- recommendation engine  
- similarity matching  
- external metadata (Spotify, etc.)  
- charts or graphs  

---

## ✅ Acceptance Criteria

- Clicking a song opens modal
- Modal shows:
  - song + artist  
  - submission count  
  - submission history  
- User can navigate:
  - to Player modal  
  - to Round page  
- Modal closes instantly without losing context

---

## 🧭 Open Questions (for architect)

1. Should submission history be:
   - ordered by date  
   - ordered by score  

2. How should duplicate submissions (same song, same round) be handled?

---

## 🔗 Dependencies

- Requires Milestone 1 (data model)
- Uses data from Milestone 2 (import pipeline)
- Integrates with:
  - Milestone 3 (round page)
  - Milestone 4 (player modal)

---

## 🚀 Next

Milestone 6 — League Overview (landing experience)
