# 🎯 BM25 Field-Level Weighting Guide

## Overview

BM25 (Best Matching 25) uses field-level weights (boosting) to prioritize certain fields. **MongoDB Atlas calculates ALL BM25 scoring internally** - your code just provides the weight multipliers.

## 🔢 How It Works

### What MongoDB Does Automatically:
✅ **Term Frequency (TF)**: Counts keyword occurrences  
✅ **Inverse Document Frequency (IDF)**: Scores rare terms higher  
✅ **Field Length Normalization**: Penalizes long fields  
✅ **Base BM25 Score Calculation**: `TF × IDF × normalization`

### What You Control:
🎚️ **Field Boost Multipliers**: `Final_Score = BM25_base × your_weight`

---

## 📊 Default Field Weights

```javascript
{
  id: 10.0,              // Exact ID match (TC_027) = 10x boost
  title: 5.0,            // Title match = 5x boost
  module: 3.0,           // Module match = 3x boost
  description: 2.0,      // Description match = 2x boost
  expectedResults: 1.5,  // Expected results = 1.5x boost
  steps: 1.0,            // Steps = 1x boost (baseline)
  preRequisites: 0.8     // Prerequisites = 0.8x boost
}
```

### Why These Weights?

1. **ID (10x)**: Users searching "TC_027" want THAT exact test
2. **Title (5x)**: Concise summaries = highly relevant
3. **Module (3x)**: Category filtering (Registration, Admin)
4. **Description (2x)**: Important but can be verbose
5. **Steps (1x)**: Baseline - detailed but lengthy
6. **Prerequisites (0.8x)**: Context, not primary target

---

## 🧮 Score Calculation Example

### Query: "merge UHID"

**Document with Title Match:**
```json
{
  "title": "Merge UHID",         // ← MATCHES HERE
  "steps": "Click merge button..."
}
```

**MongoDB Calculates:**
```javascript
// Title field:
TF = 2 (both "merge" and "UHID" appear)
IDF = 3.2 (moderate rarity)
field_length_norm = 0.9 (short title)
BM25_base = TF × IDF × norm = 2 × 3.2 × 0.9 = 5.76

// Your boost:
title_score = 5.76 × 5.0 (weight) = 28.8

// Steps field:
BM25_base = 0.8
steps_score = 0.8 × 1.0 (weight) = 0.8

// TOTAL SCORE = 28.8 + 0.8 = 29.6
```

**Document with Only Steps Match:**
```json
{
  "title": "Patient Registration",
  "steps": "...merge the records..."  // ← MATCHES HERE
}
```

**Score:**
```javascript
steps_score = BM25_base(2.1) × 1.0 = 2.1

// TOTAL SCORE = 2.1
```

**Result:** Title match scores **14x higher** (29.6 vs 2.1)!

---

## 🎨 Adaptive Weight Strategies

### Strategy 1: ID Search
**Query:** `"TC_027"`

```javascript
{
  id: 20.0,         // Massive boost for exact ID
  title: 2.0,
  module: 1.0,
  description: 0.5,
  steps: 0.3
}
```
**Why?** User wants exact ID - everything else is noise.

---

### Strategy 2: Short Keywords
**Query:** `"merge UHID"` (2-3 words)

```javascript
{
  id: 10.0,
  title: 8.0,       // Title mentions are key
  module: 5.0,
  description: 2.0,
  steps: 1.0
}
```
**Why?** Short queries = key concepts in titles.

---

### Strategy 3: Natural Language
**Query:** `"How do I combine patient records?"` (5+ words)

```javascript
{
  id: 5.0,
  title: 4.0,
  description: 3.0,  // Detailed explanations
  steps: 2.0,        // Step-by-step process
  module: 1.5
}
```
**Why?** Long queries need detailed context.

---

## 💡 Key Insights

### 1. Term Frequency is Automatic
MongoDB counts occurrences - you don't need to!

**Example:**
```
Steps: "merge...merge...merge..." (3 occurrences)
```
MongoDB calculates higher TF automatically, then multiplies by your weight.

---

### 2. Multiple Occurrences Matter
```javascript
// Document A:
title: "Merge" (1×)
steps: "merge" (1×)
Score = (BM25_title × 5.0) + (BM25_steps × 1.0)

// Document B:
title: "Merge Merge" (2×)
steps: "merge merge merge" (3×)
Score = (BM25_title × 5.0) + (BM25_steps × 1.0)
// Higher TF in B = higher base score!
```

---

### 3. Phrase Matching Gets Extra Boost
```javascript
{
  phrase: {
    query: "merge UHID",
    score: { boost: { value: 2.0 } }  // 2x bonus for exact phrase
  }
}
```

**Example:**
- "Merge UHID" (exact phrase) → 2x bonus
- "Merge patient UHID" (words scattered) → no bonus

---

## 🧪 Testing Weights

### Run Basic Search:
```bash
node src/scripts/search/bm25-search.js "merge UHID"
```

**Output Shows:**
```
📊 BM25 Score: 29.6543
🎯 Matched in: title, description
💡 Highlights:
   title: "Merge UHID"
   
📊 Top Contributing Fields:
   title: 2 matches (avg weight: 5.0x)
   description: 1 matches (avg weight: 2.0x)
```

### Compare Strategies:
```bash
node src/scripts/search/compare-field-weights.js "merge UHID"
```

**Output:**
```
Configuration 1: Balanced (Default)
   Top Result: TC_027 (score: 29.45)
   
Configuration 2: Title Heavy
   Top Result: TC_027 (score: 45.80)
   
Configuration 3: ID Focused
   Top Result: TC_027 (score: 25.12)
```

---

## 📐 Mathematical Breakdown

### Full BM25 Formula:
```
BM25(D, Q) = Σ IDF(qi) × (f(qi, D) × (k1 + 1)) / (f(qi, D) + k1 × (1 - b + b × |D|/avgdl))
```

Where:
- **IDF(qi)**: How rare is query term qi?
- **f(qi, D)**: How many times qi appears in doc D?
- **k1**: Saturation parameter (typically 1.2)
- **b**: Length normalization (typically 0.75)
- **|D|**: Document field length
- **avgdl**: Average field length

### With Your Weights:
```
Final_Score = Σ (BM25(field) × field_weight)
```

**MongoDB handles the BM25 math** → You just multiply!

---

## 🎯 Real-World Scenarios

### Scenario 1: Finding Exact Test
```bash
Query: "TC_027"
Expected: TC_027 as #1

Weights: { id: 20.0, title: 2.0, ... }
Result: ✅ TC_027 scores 150.4
```

### Scenario 2: Feature Search
```bash
Query: "merge patient records"
Expected: All merge tests

Weights: { title: 8.0, description: 3.0, module: 5.0 }
Result: ✅ 5/5 top results are merge-related
```

### Scenario 3: Workflow Query
```bash
Query: "how to perform registration"
Expected: Registration with detailed steps

Weights: { description: 3.0, steps: 2.5, title: 3.0 }
Result: ✅ Detailed registration workflows on top
```

---

## 🚀 Quick Reference

| Query Type | Recommended Weights |
|------------|-------------------|
| **ID** (`TC_027`) | `id:20x, title:2x` |
| **Short** (`merge`) | `title:8x, module:5x` |
| **Medium** (`merge UHID`) | `title:5x, module:3x, description:2x` |
| **Long** (`how to merge?`) | `description:3x, steps:2x` |

---

## 🔍 Usage Examples

### Auto-Weighted Search (Recommended):
```bash
node src/scripts/search/bm25-search.js "merge UHID"
```
Automatically selects optimal weights based on query!

### Manual Weights:
```bash
node src/scripts/search/bm25-search.js "merge" 10 --manual-weights
```
Uses default balanced weights.

### With Filters:
```bash
node src/scripts/search/bm25-search.js "merge" 10 --module=Registration --priority=P1
```

---

## 📝 Summary

| Concept | Handled By | Your Control |
|---------|-----------|--------------|
| Term Frequency | ✅ MongoDB | ❌ Automatic |
| IDF Calculation | ✅ MongoDB | ❌ Automatic |
| Field Normalization | ✅ MongoDB | ❌ Automatic |
| **Field Weights** | ❌ You Define | ✅ **Full Control** |
| Phrase Matching | ✅ MongoDB | ✅ Boost value |

**Bottom Line:** MongoDB does the heavy BM25 math. You just tell it which fields matter more! 🎯
