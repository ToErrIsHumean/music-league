# Music League App — Post-v1 Backlog & Iteration Roadmap

## 🎯 Purpose

Define the prioritized backlog after the weekend v1 build, ensuring focused iteration without scope creep.

---

## 🧭 Guiding Philosophy

- Protect the core loop (overview → player → song → round)
- Prioritize features that increase **fun + social engagement**
- Defer complexity until real usage demands it
- Maintain “beautiful by default, deep if needed”

---

# 🔥 Tier 1 — High Impact (Build Soon)

## 1. Insight Engine (Enhanced)

### Description
Expand from simple templates to richer, more varied, and higher-confidence insights.

### Why it matters
Core driver of engagement and shareability.

### Scope
- More pattern types
- Template variety
- Confidence thresholds

### Trigger
Users revisit overview multiple times OR insights feel repetitive

---

## 2. Search (Global Entry Point)

### Description
Add a global search bar for songs and artists.

### Why it matters
Unlocks core utility: “has this been picked?”

### Scope
- Fuzzy matching
- Instant results dropdown
- Song modal integration

### Trigger
Users ask for lookup directly or dataset grows beyond memory

---

## 3. Deduplication Layer

### Description
Improve data quality via fuzzy matching and merge tools.

### Why it matters
Prevents dataset degradation over time.

### Scope
- duplicate detection
- merge UI (lightweight)

### Trigger
Duplicate songs/artists appear in real usage

---

## 4. Round Highlights

### Description
Add richer, dynamic highlights to round pages.

### Why it matters
Makes rounds feel like events, not lists.

### Scope
- most divisive song
- biggest upset
- lowest scoring

### Trigger
Users engage with round pages frequently

---

# 🧠 Tier 2 — Structural Depth

## 5. Deep Link / Nerd Views

### Description
Expose raw/expanded data views via URL parameters.

### Why it matters
Supports power users without cluttering UI.

### Scope
- raw tables
- compact views
- query params

### Trigger
You or advanced users want deeper inspection

---

## 6. Player Comparison

### Description
Compare two players’ taste and behavior.

### Why it matters
Highly social and engaging.

### Scope
- overlapping artists
- voting similarity

### Trigger
Users start discussing “who has better taste”

---

## 7. League Evolution

### Description
Show trends over time.

### Why it matters
Adds narrative and history.

### Scope
- timeline
- trend summaries

### Trigger
Sufficient historical data accumulated

---

# 🎨 Tier 3 — Presentation Enhancements

## 8. Visualizations

### Description
Add richer charts and visuals.

### Why it matters
Improves shareability and clarity.

### Scope
- artist distributions
- taste maps

### Trigger
Core product stable and data clean

---

## 9. UI Polish

### Description
Refine spacing, animation, responsiveness.

### Why it matters
Elevates perceived quality.

### Scope
- transitions
- mobile optimization

### Trigger
Before sharing with broader audience

---

# ⚙️ Tier 4 — Admin & Automation

## 10. Scraping Integration

### Description
Automate data ingestion.

### Why it matters
Reduces manual work.

### Scope
- browser automation
- login handling

### Trigger
Manual CSV flow becomes annoying

---

## 11. Import History & Rollback

### Description
Track and undo imports.

### Why it matters
Adds safety and confidence.

### Scope
- history logs
- rollback option

### Trigger
Data mistakes occur

---

## 12. Background Processing

### Description
Move heavy computation off request path.

### Why it matters
Scalability and performance.

### Scope
- async jobs
- caching

### Trigger
Performance degrades with scale

---

# 🚫 Sprint Protection Rules

DO NOT build during weekend sprint:
- search
- visualizations
- scraping
- advanced analytics

---

# 🧭 Iteration Strategy

1. Launch with friends
2. Observe behavior
3. Promote only features with clear demand
4. Keep UI clean as features grow

---

# 🚀 Outcome

A focused roadmap that:
- protects v1 simplicity
- guides high-impact iteration
- prevents overbuilding
