# Unsaid — Copy Deck

Source of truth for product language. Brand name is always **Unsaid** (never `UNSAID`, `unsaid.`, `UnSaid`).

Tagline (permanent): **Before you wed. Check Unsaid.**

---

## 1. Product principles (always true)

1. Private by default.
2. No answer is visible to the partner without consent.
3. No fake psychology.
4. No AI deciding whether people belong together.
5. Differences are conversations, not failures.
6. One severe disagreement cannot be buried beneath 50 trivial agreements.
7. Users determine what matters to them.
8. Unsaid explains every flag.
9. No ads.
10. Relationship answers are never sold or used for advertising.

---

## 2. Tone

Never judge an answer. Never diagnose. Never recommend marry / separate.

| Bad | Good |
| --- | --- |
| Your views on money are unhealthy. | Your expectations about money differ substantially. |
| Andrea has unrealistic expectations. | You appear to expect different approaches to household spending. |
| Incompatible | Worth discussing |
| 96% compatible | Alignment Index: 82 |

Hard-line collisions never name who marked the hard line:

> This is a major difference, and at least one of you considers this especially important.

Acknowledge inference honestly when relevant:

> Unsaid reveals differences—not private answers. On some topics, a large difference may let you infer your partner’s direction. Exact answers stay private until you both choose to reveal them.

Legal (footer / settings / results):

> Unsaid identifies differences between the answers you provide. It cannot determine whether a relationship will succeed or what decisions you should make. Unsaid is a structured communication tool—not therapy, counseling, diagnosis, or medical advice. You must be 18 or older.

---

## 3. Importance & hard-line UI

**How much does this matter to you?**

Scale 1–5 with labels:

| Value | Label |
| --- | --- |
| 1 | Not much |
| 2 | Somewhat |
| 3 | Important |
| 4 | Very important |
| 5 | Essential |

When importance is **4 or 5**, show:

> Could a major difference here stop you from moving forward with marriage?

Toggle:

> This is a hard line for me.

Hard-line status is private. Partner is never told who set it.

---

## 4. Landing

**Hero brand:** Unsaid  
**Hero line:** Before you wed. Check Unsaid.  
**Support:** Privately answer the questions couples often avoid. Unsaid compares what both of you actually expect from marriage and finds the differences worth talking about—before they become surprises.  
**Primary CTA:** Start your check  
**Secondary:** See how it works  
**Price:** $29 per couple · No subscription

**Problem headline:** Love doesn’t automatically answer the hard questions.  
List: Children. Money. Sex. Faith. Family. Careers. Where you’ll live. What marriage actually means.  
**Close:** You may love each other deeply and still be assuming completely different futures.

**How it works**

1. Answer privately. — You each complete the same questions independently.
2. Unsaid compares. — Your individual answers remain private.
3. See the gaps. — Unsaid identifies where expectations meaningfully differ.
4. Talk before you wed. — Because discovering it now beats discovering it five years from now.

**Privacy block**

Your answers belong to you.  
Your partner cannot browse your responses.  
Unsaid reveals differences—not private answers.  
Exact answers are only revealed when you both choose to reveal them.

**Final CTA**

You don’t need to agree on everything.  
You should know what you’re disagreeing about.  
Before you wed. Check Unsaid.  
Start your check

---

## 5. Auth & onboarding

**Sign-in headline:** Check Unsaid  
**Support:** Email a one-time code. No password.  
**Fields (Clerk):** Email → OTP  
**CTA:** Continue

### Onboarding gate (`/onboarding`)

Required before creating or joining a check:

**Headline:** What should we call you?  
**Fields:** First name (required) · I confirm I am 18 or older (required)  
**Optional:** Preferred name · Pronouns  
**CTA:** Save and continue  

Incomplete profile attempting create/join → redirect here with return path.

---

## 6. Create check

**Title:** Check Unsaid together  
**Stage prompt:** What stage are you in?

- Seriously dating
- Discussing engagement
- Engaged
- Wedding scheduled
- Other

**Optional:** Wedding date (never required)  
**Partner:** Who are you checking with? — Partner first name  
**CTA:** Create our check

---

## 7. Invite

**Title:** Now invite {PartnerName}.  
**Body:** Your answers stay private. {PartnerName} will answer the same questions independently. Neither of you will see the other’s individual answers unless you both choose to reveal one later.  
**Buttons:** Share invitation · Copy private link  

**Native share / paste message:**

```
Before we wed, I want us to Check Unsaid together.
Answer privately and we’ll see what conversations we should have before marriage.
{inviteUrl}
```

---

## 8. Partner invite landing (`/invite/[token]`)

**Headline:** {InviterName} invited you to check Unsaid together.  
**Body:** You’ll both answer the same questions independently. Your answers stay yours. When you’re finished, you’ll see the conversations worth having before marriage—not a score that tells you what to do.  
**CTA (signed out):** Join {InviterName} → stores invite cookie, Clerk OTP, then `/invite/continue`  
**CTA (signed in):** Join {InviterName} → accept immediately  
Expired: This invitation has expired. Ask {InviterName} to create a new invitation.  
Missing cookie on continue: Open your invitation link again.

---

## 9. Assessment chrome

**Progress:** `{Section} · {n} of 8`  
**Continue:** Continue  
**Section done interstitial:**

> **{Section} done.**  
> Your answers have been saved privately.  
> CTA: Continue to {NextSection}

**No scores** before both complete.  
**Offline banner:** You’re offline. We’ll save this answer when your connection returns.

### Section intros

| Section | One-liner |
| --- | --- |
| Marriage & commitment | What marriage means to you—commitment, decisions, openness, and priority. |
| Children & parenting | Whether you want children, when, how many, and how you’d raise them. |
| Money | Money disagreements are rarely just about dollars. These questions compare how you expect earning, spending, saving, debt, and generosity to work. |
| Faith & values | Faith, spiritual practice, moral frameworks, and how much shared belief matters. |
| Sex & affection | These questions are private. Their purpose is not to define a “normal” relationship. They identify whether your expectations differ. |
| Communication & conflict | How you want to fight, apologize, cool down, and ask for help. |
| Family & boundaries | In-laws, holidays, caregiving, friendships, and where the marriage sits relative to family. |
| Career & ambition | Work identity, relocation, hours, risk, and income versus time. |
| Home & lifestyle | Where you live, how you live, pets, travel, and the feel of home. |
| Roles & responsibilities | Who does what—chores, childcare, money admin, and mental load. |
| Health & habits | Substances, health, sleep, and habits that affect a shared life. |
| Future & adversity | Marriage includes situations neither person can predict. These questions explore expectations about how you would face them. |

Each intro also shows: `8 questions · about 90 seconds`

---

## 10. Waiting

**Headline:** You’ve said your part.  
**Body:** {PartnerName} is still completing theirs. Your answers remain private while you wait.  
**Progress:** {You} ✓ Complete · {Partner} — {pct}%  
**CTA:** Send reminder  
**Throttle copy:** You can send another reminder in {hours} hours.  
**Partner absent:** Still waiting on {PartnerName}. Your invitation remains active for {days} days.

---

## 11. Ready (paywall)

**Headline:** Your Unsaid is ready.  
**Body:** You both answered all 96 questions independently.  
**Find line:** Unsaid found: **{n} conversations worth having**  
**Lock:** Detailed results remain locked.  
**Offer:** Unlock for both · $29 · One payment. No subscription.  
**CTA:** See our Unsaid  

Alternate beat (product moment):

> Some differences are small. Some matter a lot. Neither person’s private answers will be shown. See what you’ve left unsaid.

---

## 12. Results summary

**Header:** Unsaid · {NameA} + {NameB}  
**Primary:** You have {n} conversations worth having.  
**Support:** You’re aligned on a lot. These are the places where your expectations deserve a real conversation before marriage.  
**Alignment Index:** {score} — never as a percent.  
**Band line:** use scoring bands (Mostly aligned / Some important differences / …).  
**Count cards:** {aligned} aligned · {minor} small differences · {conversations} conversations · {major} major conversation(s)  
**Hard-line callout (if any):** {k} major hard-line difference(s) — counted separately from the Alignment Index.  

**By topic** (from `categoryScores`, weakest first):

> **Alignment by topic**  
> {Section label} · Alignment Index {n}  

**List header:** Start with what matters most  

**Item card example:**

> **Children** · Major conversation  
> Your expectations about having children differ significantly, and this topic is highly important to at least one of you.  
> Talk about this →

**Retake:** Things changed? Check again. — Creates a new $29 assessment; never overwrites.  
**Viral:** Know someone getting serious? · Send them Unsaid  

Share copy:

```
You don’t have to agree about everything before marriage. But you should know where you don’t.
Before you wed. Check Unsaid.
{siteUrl}
```

---

## 13. Result detail

**Pattern:**

> **{Topic}** · {Classification}  
> You answered this very differently. / Your answers are largely aligned. / …  
> At least one of you considers this extremely important. *(if hard-line collision or high impact)*  
> Neither person’s private answer has been revealed.

**Own answer:** Control **See my answer** expands only the viewer’s answer. Never shows partner’s.  
**Talk about:** 3–4 deterministic prompts from question bank.  
**Buttons:** Request mutual reveal · Mark discussed  

**Reveal request (viewer):** Your answer will not be revealed unless {Partner} independently agrees to reveal theirs.  
**CTA:** Request mutual reveal  
**Warning:** Revealing cannot be undone.

**Partner notification (in-app / email):** {Name} would like to reveal both of your answers to this question.  
**Options:** Reveal together · Keep private  

**After mutual:**

> You: {label}  
> {Partner}: {label}

---

## 14. Dashboard

**Title:** Your Unsaid  
**Row:** {NameA} + {NameB} · {Status} · {Date} · Alignment Index {n} · {k} conversations  
**Primary:** View results  
**Secondary:** Delete this check  
No partner swap. New comparison = new $29 check.

---

## 15. Emails (subjects never include sensitive topics)

### Partner invitation
**Subject:** {Name} wants to Check Unsaid with you  
**Body:** {Name} invited you to privately answer Unsaid together. You’ll both answer the same questions independently. Your answers stay yours. When you’re finished, you’ll see the conversations worth having before marriage.  
**CTA:** Join {Name}

### Partner finished
**Subject:** {Name} finished Unsaid  
**Body:** {Name} has completed their side. Your answers remain private. When you finish yours, your comparison can be created.  
**CTA:** Continue Unsaid

### Results ready
**Subject:** Your Unsaid is ready  
**Body:** You’ve both finished. There are conversations worth having.  
**CTA:** See your Unsaid

### Reveal request
**Subject:** {Name} requested a mutual reveal  
**Body:** {Name} would like both of you to reveal your answers to one flagged topic. Nothing will be revealed unless you agree.  
**CTA:** Review request

### Reminder
**Subject:** Reminder: your Unsaid invitation  
**Body:** {Name} is waiting to Check Unsaid with you. Your answers stay private.  
**CTA:** Continue Unsaid

---

## 16. Empty & error states

| State | Copy |
| --- | --- |
| Partner hasn’t joined | Still waiting on {Partner}. Your invitation remains active for {days} days. · Send reminder |
| Payment failed | That payment didn’t go through. Nothing has been charged by Unsaid. · Try again |
| Checkout cancelled | Checkout was cancelled. Nothing has been charged. |
| Confirming payment | Confirming payment… |
| Payment timeout | We’re still confirming your payment. If you were charged, refresh in a minute or contact support. |
| Refunded / re-locked | This Unsaid was refunded. Detailed results are locked again. |
| Connection lost | You’re offline. We’ll save this answer when your connection returns. |
| Saving | Saving… |
| Invitation expired | This invitation has expired. Ask {Name} to create a new invitation. |
| Self-join blocked | You can’t accept your own invitation. Share the link with your partner. |
| Check deleted | This Unsaid is no longer available. |
| Rate limited | Please wait before trying again. |
| Profile incomplete | Tell us your first name and confirm you’re 18+ to continue. |

---

## 17. Account deletion

**Settings:** Delete my account  
**Explain:** Deleting removes your account, personal identifiers, assessment answers, active invitations, and accessible results. If you delete a shared check, it becomes unavailable to both of you.  
**Confirm:** Type DELETE  
**CTA:** Delete forever

---

## 18. SEO pages (each ends with Check Unsaid together)

Full briefs: [SEO_BRIEFS.md](./SEO_BRIEFS.md).

- `/questions-before-marriage`
- `/premarital-compatibility`
- `/money-before-marriage`
- `/questions-about-kids-before-marriage`
- `/sex-before-marriage-conversations`
- `/faith-and-marriage`
- `/questions-for-engaged-couples`

---

## 19. Legal routes

- `/privacy`
- `/terms`
- `/disclaimer` (short form of legal positioning; also inline on results)

---

## 20. Support

**Support email:** `support@unsaid.app` (or `SUPPORT_EMAIL` env)  
**Settings link:** Contact support  
**Footer:** Questions? support@unsaid.app  

Never ask users to paste assessment answers into email.

**Export:** Settings → Download my data  
**Confirm download started:** Your export is downloading. It includes only your information and your answers—not your partner’s.

---

## 21. Campaign / marketing lines

Use on landing, ads, SEO closers—not in product chrome.

- You know their favorite food. Do you know whether they expect a parent to live with you someday?
- You’ve picked a wedding venue. Have you picked how money works?
- You know how many guests are coming. Do you know how many children you want?
- You’ve talked about forever. Have you talked about debt?
- Love answers a lot of questions. Not all of them.
- Some things are better discovered before “I do.”
- Always close with: **Before you wed. Check Unsaid.**

---

## 22. Unlock return screen

**Confirming:** Confirming payment…  
**Success transition:** Opening your Unsaid…  
**Cancelled:** Checkout was cancelled. Nothing has been charged. · Return to ready screen  
