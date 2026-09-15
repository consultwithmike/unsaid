# Unsaid — Scoring Spec (v1.0.0)

`algorithm_version`: **1.0.0**  
`question_set_version`: **2026.09**

Historical results must remain reproducible. Never silently recalculate old checks with a new algorithm.

## Inputs per question

- Answer A, Answer B (typed)
- Importance `iA`, `iB` ∈ {1..5}
- Hard line flags `hA`, `hB` (only meaningful when importance ≥ 4 in UI)

## Distance `d(q)` ∈ [0, 1]

| Type | Formula |
| --- | --- |
| AG5 | `abs(A - B) / 4` |
| YN3 | `abs(A - B) / 2` |
| ORD | `abs(indexA - indexB) / (optionCount - 1)` |
| CAT | Lookup in question metadata matrix (0 / 0.25 / 0.50 / 0.75 / 1.00) |
| MULTI | Jaccard: `1 - \|∩\| / \|∪\|` (empty∪empty → 0) |

### Special cases

**CP02 — ideal number of children**  
If either answer is “I genuinely don’t care”, distance is low vs any concrete count **unless** that participant set importance ≥ 4 (then treat as normal ORD including the don’t-care index, or clamp: prefer `d = min(normalOrd, 0.25)` when don’t-care and importance ≤ 3). Document exact rule in code comments + tests.

**MO02 — finances**  
Despite CAT label, use ordered distance across the five continuum options.

**HL02 — where to live**  
Custom matrix (city/suburb closer than city/rural, “no preference” low distance to all unless high importance).

## Weights & scores

```
w(q) = sqrt(iA * iB)
Q(q) = 100 * (1 - d(q))
AlignmentIndex = 100 * (1 - Σ(d*w) / Σw)
```

Same Alignment Index formula per category section.

## Hard-line collision

```
collision = (d >= 0.75) AND (hA OR hB)
```

- Counted separately from Alignment Index  
- Classification overridden to **Major conversation**  
- `impact = d * sqrt(iA * iB) * (collision ? 2 : 1)`

## Classification

| Condition | Label |
| --- | --- |
| collision | Major conversation |
| d < 0.25 | Aligned |
| 0.25–0.49 | Slight difference |
| 0.50–0.74 | Conversation |
| d ≥ 0.75 | Major difference |

Headline counts map:

- aligned → Aligned  
- slight → small / minor differences  
- conversation → conversations  
- major + major_conversation → major conversations (and hard-line collisions called out)

## Copy bands for Alignment Index

| Range | Label |
| --- | --- |
| 85–100 | Mostly aligned |
| 70–84 | Some important differences |
| 55–69 | Several important differences |
| &lt; 55 | Major differences worth understanding |

Never say “N% compatible.”
