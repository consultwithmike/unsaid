# Unsaid — Privacy & Security Notes

Relationship answers are unusually sensitive. Treat them as such.

**Auth:** Clerk sessions verified server-side (`auth()`).  
**Storage:** Netlify Database; encrypted answer payloads; no browser DB access.

## Invariants

1. The client never receives partner answers except after **mutual reveal** for that question.
2. Results APIs return differences, severity, prompts, hard-line-collision **boolean**—never raw partner values (see [API_CONTRACT.md](./API_CONTRACT.md)).
3. Encryption keys never ship to the browser (`ANSWER_MASTER_KEY` only in Netlify env / server).
4. Email subjects / push / SMS never include sensitive topics (“children”, “sex”, faith specifics, etc.).
5. Analytics never include answers, importance, hard lines, or mismatch topics (first-party allowlist only).
6. Admin cannot casually browse plaintext answers.
7. Clerk user ids are the only auth foreign keys; do not trust client-supplied identity fields.
8. **Hard-line authorship is private.** Results may say “at least one of you considers this especially important.” Never “Andrea marked a hard line.”
9. Participants may always read **their own** answers (assessment + `?include=own` on results). That is not a reveal.
10. Self-join is forbidden: the check creator cannot accept their own invitation token.
11. **Account export** (`GET /api/account/export`) returns only the caller’s data and answers—never the partner’s.
12. Full Stripe refunds **re-lock** results to the teaser payload; encrypted answers remain until account/check deletion.

## Acknowledge inference

For binary-ish topics, users may infer partners’ positions from a “major difference” flag. Product copy should acknowledge this rather than pretend impossible privacy ([COPY.md](./COPY.md)).

## Mutual reveal

States: `none` → `requested_by_a` | `requested_by_b` → `mutual`.  
Only `mutual` decrypts and returns both answers. Irreversible.

## Encryption

- AES-256-GCM for answer JSON `{ answer }` per question row (follow-ups are separate rows)
- Per-check DEK stored wrapped in `checks.encrypted_dek`
- Master key: `ANSWER_MASTER_KEY` in Netlify env

## Retention (MVP)

| Data | Policy |
| --- | --- |
| Unfinished checks | Delete after 90 days inactivity |
| Active completed | Retain while check active |
| Deleted checks | Queue encrypted answers for permanent deletion |
| Payments | Retain accounting-required fields only |
| Clerk `user.deleted` webhook | Enqueue same purge path as `DELETE /api/account` |
| User export | On-demand JSON; not retained as a server file after download |

## Legal positioning (surface in UI + `/privacy` `/terms` `/disclaimer`)

Unsaid is a structured communication tool—not therapy, counseling, diagnosis, medical advice, or a predictor of divorce/success. Minimum age 18. Support: `SUPPORT_EMAIL`.

Full disclaimer text: [COPY.md](./COPY.md) §2.
