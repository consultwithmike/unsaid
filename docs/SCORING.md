# Unsaid — Scoring Spec (v1.0.0)

`algorithm_version`: **1.0.0**  
`question_set_version`: **2026.09**  
Bank file: [`content/questions/2026.09.json`](../content/questions/2026.09.json)

Historical results must remain reproducible. Never silently recalculate old checks with a new algorithm.

## Inputs per question

- Answer A, Answer B (typed)
- Importance `iA`, `iB` ∈ {1..5} — UI labels: 1 Not much · 2 Somewhat · 3 Important · 4 Very important · 5 Essential
- Hard line flags `hA`, `hB` — UI only when importance ≥ 4; question: “Could a major difference here stop you from moving forward with marriage?”; toggle: “This is a hard line for me.”

## Distance `d(q)` ∈ [0, 1]

| Type / mode | Formula |
| --- | --- |
| AG5 | `abs(A - B) / 4` |
| YN3 | `abs(A - B) / 2` (reserved; unused in 2026.09) |
| ORD | `abs(indexA - indexB) / (optionCount - 1)` |
| CAT + matrix | Lookup in `compatibilityMatrix` (0 / 0.25 / 0.50 / 0.75 / 1.00) |
| CAT as ordered (`mo02_ordered`) | ORD across option list order |
| MULTI | Jaccard: `1 - \|∩\| / \|∪\|` (empty∪empty → 0) |

### Locked specials

**CP02 (`ord_cp02_dont_care`)**  
If either answer is `dont_care` **and** that participant’s importance ≤ 3:  
`d = min(normalOrdDistance, 0.25)`.  
If that participant’s importance ≥ 4: use normal ORD (including the `dont_care` index).  
If both are `dont_care`: `d = 0`.

**MO02 (`mo02_ordered`)**  
Despite CAT label, use ordered distance across the five continuum options.

**HL02 (`hl02_matrix`)**  
Use bank `compatibilityMatrix`. `no_preference` ↔ any other = 0.25; identical = 0; city↔rural = 0.75, etc.

**Follow-ups**  
- `CP07F` scored when parent `CP07` answer ≥ 4 (MULTI Jaccard). If parent &lt; 4, exclude `CP07F` from Σ.  
- `MO04F` scored when parent `MO04` answer ≥ 3. Otherwise exclude.

## Weights & scores

```
w(q) = sqrt(iA * iB)
Q(q) = 100 * (1 - d(q))
AlignmentIndex = round(100 * (1 - Σ(d*w) / Σw))
```

Same formula per category section → `category_scores`.

## Hard-line collision

```
collision = (d >= 0.75) AND (hA OR hB)
```

- Counted separately from Alignment Index  
- Classification overridden to **Major conversation**  
- `impact = d * sqrt(iA * iB) * (collision ? 2 : 1)`  
- Results copy never names who set the hard line

## Classification

| Condition | Label |
| --- | --- |
| collision | Major conversation |
| d &lt; 0.25 | Aligned |
| 0.25–0.49 | Slight difference |
| 0.50–0.74 | Conversation |
| d ≥ 0.75 | Major difference |

Headline counts: aligned · small/minor differences · conversations · major conversations (+ hard-line collisions called out).

## Alignment Index bands

| Range | Key | Label |
| --- | --- | --- |
| 85–100 | mostly_aligned | Mostly aligned |
| 70–84 | some_important_differences | Some important differences |
| 55–69 | several_important_differences | Several important differences |
| &lt; 55 | major_differences | Major differences worth understanding |

Never say “N% compatible.”

## Primary result language

The numerical score is secondary. Primary:

> You have N conversations worth having.
