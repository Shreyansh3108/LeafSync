# LeafSync — Project Notes & Assumptions

**Author:** Shreyansh Dwivedi  
**Project:** BookLeaf Publishing — Author Support & Operations Portal  
**Live Frontend (Vercel):** [https://leaf-sync.vercel.app/login](https://leaf-sync.vercel.app/login)  
**Live Backend API & Swagger Docs (Render):** [https://leafsync-backend.onrender.com/api/docs](https://leafsync-backend.onrender.com/api/docs)  

---

## 1. How I Built This Project (Development Notes)

Rather than starting with the UI, I built LeafSync from the data and domain rules outward:

1. **Database & Seed Fidelity First:** I started by modeling the 6 PostgreSQL tables (`users`, `books`, `tickets`, `ticket_messages`, `ticket_internal_notes`, `ticket_events`) and writing deterministic seeders for all 10 authors and 18 books from the assignment brief. I wanted every edge case—such as Kavita Deshmukh's ₹850 below-threshold balance (`BK016`) and her in-production manuscript (`BK015`)—to work with real SQL data from day one.
2. **Deterministic Domain Logic Before AI:** While testing prompts with Gemini, I noticed that LLMs occasionally miscalculate date gaps or royalty thresholds when left to do arithmetic on raw JSON. To fix this permanently, I wrote `buildContext.js` to calculate exact flags (`belowMinimumThreshold`, `overdueRoyalty`, `nextPayoutWindow`) in JavaScript first, and then passed those verified facts into the prompt.
3. **Resilience for Real-World API Limits:** Free-tier LLM keys can hit `429` rate limits or `503` spikes when an evaluator tests multiple tickets rapidly. I added a multi-model failover chain (`gemini-2.5-flash-lite` -> `gemini-2.5-flash`), a 3-strike circuit breaker, and a deterministic keyword classifier (`6/6` accuracy on the evaluation suite) so the app never crashes or blocks ticket creation.
4. **Two Focused Portals (React + Vite):** Finally, I built the Author Portal around clarity (seeing exact book stages, royalty breakdowns, and ticket history) and the Admin Workspace around speed (urgency-sorted queue, SLA badges, 1-click canned templates, and pre-filled AI drafts).

---

## 2. Key Product & Domain Assumptions Made

While completing the assignment, I made the following practical assumptions where the brief left room for product judgment:

### Authentication & Evaluator Experience
* **Pre-Seeded Demo Accounts:** Since the assignment specifies simple email-based login without a public sign-up flow, I assumed all authors and admins are provisioned by BookLeaf's internal publishing system. All seeded accounts use the universal password `Password123`.
* **Collapsible Evaluator Switcher:** To make testing fast without cluttering the production login UI, I added a collapsible **`⚡ Quick-Switch Demo Accounts (For Evaluators)`** drawer on `/login` that auto-fills key author and admin personas in one click.

### Royalty & Production Edge Cases
* **Minimum Payout Threshold (`₹1,000`):** I assumed the ₹1,000 minimum payout rule is evaluated against the pending royalty balance. When `0 < royalty_pending < 1000` (e.g., `BK016` at ₹850), both the UI and the AI assistant explicitly inform the author that the balance is valid and will automatically roll over to the next quarterly cycle.
* **Overdue Royalty Definition (`>135 Days`):** Since royalties are paid quarterly (10th–15th of Feb, May, Aug, and Nov), I assumed a pending balance of `>= ₹1,000` is officially "overdue" if more than 135 days (~4.5 months, i.e., one full quarter plus the 15-day disbursement window) have elapsed since the last payout or publication date.
* **Unreleased / In-Production Books (`BK013`, `BK015`):** For manuscripts still in `Cover Design` or `Typesetting`, displaying `0 copies sold` and `₹0 royalty` looks like a bug or poor sales to an author. I assumed post-publication metrics should display clean `—` placeholders alongside an active production stage badge until the book's status reaches `Published`.

### Ticket Lifecycle & Operations Workflow
* **Author Reply Auto-Reopen:** I assumed that if an admin marks a ticket `Resolved` and the author replies with a follow-up question, the ticket should automatically transition back to `In Progress` so it re-surfaces in the active admin queue. Once a ticket is marked `Closed`, it is treated as terminal.
* **Human-in-the-Loop AI Approval:** Because support replies involve financial figures, ISBN escalations, and free reprint commitments, I assumed AI responses should **never** be auto-sent to authors. AI drafts are saved to `tickets.ai_draft` and pre-loaded into the admin composer, requiring an admin to review and click **Approve & Send**.
* **Strict Physical Separation of Internal Notes:** I assumed internal admin notes (`ticket_internal_notes`) must be stored in a separate database table rather than inside `ticket_messages` with a boolean flag, ensuring internal ops discussions can never be leaked to authors or sent into LLM prompts.
* **Attachment Handling:** For local and cloud demo portability without requiring evaluators to configure AWS S3 buckets, I assumed storing attachment metadata (`name`, `size`, `type`) in a PostgreSQL `JSONB` column fulfills the workflow requirement while keeping setup zero-config.

---

## 3. Deployment & Testing Notes for Evaluators

* **Render Free-Tier Cold Start (~30s on First Request):** The Node.js + Express backend is hosted on Render's free tier, which sleeps after 15 minutes of idle time. The very first sign-in request may take ~30–40 seconds while the container wakes up. After that initial wake-up, API responses and live Server-Sent Events (`● Live SSE`) respond in milliseconds.
* **Cross-Domain Cookie Support:** Because the frontend runs on `vercel.app` and the backend runs on `onrender.com`, the backend automatically configures `httpOnly` JWT cookies with `SameSite=None; Secure` in production so session persistence works seamlessly across domains.
