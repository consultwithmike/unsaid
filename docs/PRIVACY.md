# Unsaid — Privacy & Security Notes

Relationship answers are unusually sensitive. Treat them as such.

**Auth:** Clerk sessions verified server-side (`auth()`).  
**Storage:** Netlify Database; encrypted answer payloads; no browser DB access.

## Invariants

1. The client never receives partner answers except after **mutual reveal** for that question.
2. Results APIs return differences, severity, prompts, hard-line-collision **boolean**—never raw partner values.
3. Encryption keys never ship to the browser (`ANSWER_MASTER_KEY` only in Netlify env / server).
4. Email subjects / push / SMS never include sensitive topics (“children”, “sex”, faith specifics, etc.).
5. Analytics never include answers, importance, hard lines, or mismatch topics.
6. Admin cannot casually browse plaintext answers.
7. Clerk user ids are the only auth foreign keys; do not trust client-supplied identity fields.

## Acknowledge inference

For binary-ish topics, users may infer partners’ positions from a “major difference” flag. Product copy should acknowledge this rather than pretend impossible privacy.

## Mutual reveal

States: `none` → `requested_by_a` | `requested_by_b` → `mutual`.  
Only `mutual` decrypts and returns both answers. Irreversible.

## Retention (MVP)

| Data | Policy |
| --- | --- |
| Unfinished checks | Delete after 90 days inactivity |
| Active completed | Retain while check active |
| Deleted checks | Queue encrypted answers for permanent deletion |
| Payments | Retain accounting-required fields only |

## Legal positioning (surface in UI)

Unsaid is a structured communication tool—not therapy, counseling, diagnosis, medical advice, or a predictor of divorce/success. Minimum age 18.
