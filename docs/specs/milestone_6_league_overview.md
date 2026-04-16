# Milestone 6 — League Overview (Source of Truth)

## 🎯 Purpose

Create the primary landing experience that presents the league as a polished, shareable artifact—combining a curated snapshot of key stats with a small set of playful, data-backed insights.

---

## 🧭 Guiding Principles

1. Beauty first (artifact over dashboard)  
2. High signal, low clutter (5–8 elements max)  
3. Social + playful tone (roasty, but grounded)  
4. Fast comprehension (no learning curve)  
5. Optional depth via links (modals / pages)

---

## 🧩 User Story Alignment

> A user opens the app and immediately sees a lively, shared overview of their Music League—surfacing funny patterns, memorable picks, and social dynamics within the group.

---

## 🧱 Core Concept

The **League Overview** is a hybrid:
- **Snapshot**: curated, visually clean summary
- **Insights**: a small set of humorous, data-backed callouts

It should feel like “Spotify Wrapped for your league”.

---

## 🧭 Entry Point

- Default route: `/`
- No login required
- Loads immediately with existing data

---

## 🧩 Page Structure

### 1. Header

- League name (or generic title)
- Optional: subtitle / timeframe

---

### 2. Snapshot (Top Section)

Display 3–5 high-signal items:

Examples:
- Most submitted artist  
- Most active player  
- Longest average song picker  
- Total rounds / submissions (optional)

Presentation:
- clean cards or simple visual blocks
- designed to be screenshot-friendly

---

### 3. Primary Visual (Optional v1-lite)

- Simple representation of top artists or players
- Can be a list or basic bar-style layout (no heavy charts required)

---

### 4. Insight Cards (Core Personality Layer)

Display 3–5 insights:

Examples:
- “Has a *concerning* love for sad music”  
- “Single-handedly keeping [artist] relevant”  
- “Thinks long songs are a personality trait”

Requirements:
- grounded in real data
- short, punchy, readable
- reference real players/songs

---

### 5. Navigation Hooks

Subtle links to:
- recent rounds  
- player names  
- songs  

These should lead into:
- Player Modal  
- Song Modal  
- Round Page  

---

## 🔗 Interaction Model

- Clicking player → Player Modal  
- Clicking song → Song Modal  
- Clicking round → Round Page  

No heavy navigation UI required.

---

## 🧠 Data Requirements

Requires aggregated data:

- per-player stats  
- per-artist counts  
- submission totals  

Insights should be derived from:
- simple heuristics (v1)
- no complex ML required

---

## ⚡ UX Expectations

- Page loads quickly (<1s perceived)
- Content understandable in <5 seconds
- Visually clean and spaced
- Encourages clicking and exploration

---

## ❌ Non-Goals (v1)

Do NOT include:
- large dashboards  
- dense tables  
- advanced filtering  
- complex visualizations  
- infinite scrolling feeds  

---

## ✅ Acceptance Criteria

- User can open `/` and see:
  - league title  
  - 3–5 stats  
  - 3–5 insights  
- At least one element feels “funny/true”
- Elements link to deeper exploration:
  - Player modal  
  - Song modal  
  - Round page  
- Page is visually clean and not cluttered

---

## 🧭 Open Questions (for architect)

1. Should insights be:
   - computed on page load  
   - precomputed after import?

2. How should missing or low-volume data be handled?

---

## 🔗 Dependencies

- Requires Milestone 1 (data model)
- Uses data from Milestone 2 (import pipeline)
- Integrates with:
  - Milestone 3 (round page)
  - Milestone 4 (player modal)
  - Milestone 5 (song modal)

---

## 🚀 Next

Backlog & Feature Expansion (post-v1 iteration)
