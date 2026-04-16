# Milestone 4 — Player Modal (Source of Truth)

## 🎯 Purpose

Introduce the core social exploration feature by allowing users to view a player’s music identity, tendencies, and history in a lightweight, engaging modal.

---

## 🧭 Guiding Principles

1. Personality over raw data  
2. Fast, low-friction exploration  
3. Humor grounded in real patterns  
4. Consistency with modal interaction system  

---

## 🧩 User Story Alignment

> A user clicks on a player’s name and sees a playful, data-backed summary of their music taste, along with their submission history.

---

## 🧱 Core Concept

A **Player Modal** represents:
- identity (who they are musically)
- tendencies (patterns in behavior)
- history (what they submitted)

It is the primary **social lens** of the app.

---

## 🧭 Interaction Model

- Opens from clicking a player name anywhere
- Displays as a modal (not full page)
- Can be closed instantly (click outside / ESC)
- Does not disrupt background state

---

## 🧩 Modal Structure

### 1. Header (Identity)

- Player name

---

### 2. Summary Traits (Core Feature)

Display 2–3 short, playful insights:

Examples:
- “Has a concerning love for sad indie tracks”
- “Thinks long songs are a personality trait”

These must:
- be based on real data
- feel humorous, not analytical

---

### 3. Notable Picks (Lightweight)

Show 1–2:
- best performing submission
- lowest scoring submission

Purpose:
- connect traits to actual songs

---

### 4. Submission History (Core Data)

List of:
- song  
- artist  
- round  
- rank or score  

---

## 🔗 Interaction Links

Within modal:

- clicking a song → opens Song Modal  
- clicking a round → navigates to Round Page  

---

## 🧠 Data Requirements

Player must have:

- associated submissions  
- derived metrics (basic):
  - most common genre (optional v1)
  - average song length (optional v1)

---

## ⚡ UX Expectations

- Modal opens instantly (<100ms perceived)
- Content is readable at a glance
- No scrolling required for basic insight
- Smooth exploration between entities

---

## ❌ Non-Goals (v1)

Do NOT include:
- advanced analytics
- charts or graphs
- comparisons between players
- editable profiles

---

## ✅ Acceptance Criteria

- Clicking player name opens modal
- Modal shows:
  - name  
  - at least 2 summary insights  
  - submission history  
- User can navigate:
  - to Song modal  
  - to Round page  
- Modal closes instantly without losing context

---

## 🧭 Open Questions (for architect)

1. Should summary traits be:
   - precomputed on import  
   - computed on request?

2. How should empty or low-data players be handled?

---

## 🔗 Dependencies

- Requires Milestone 1 (data model)
- Uses data from Milestone 2 (import pipeline)
- Builds on navigation from Milestone 3 (round page)

---

## 🚀 Next

Milestone 5 — Song Modal (history + lookup utility)
