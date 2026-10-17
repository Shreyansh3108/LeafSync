# LeafSync — Architecture & Engineering Write-Up



**Author:** Shreyansh Dwivedi  

**Project:** BookLeaf Publishing — Author Support & Operations Portal  



---



## 1. How I Approached the Problem



BookLeaf handles 1,200+ books a month across a 22,000-title catalog. At that volume, support tickets are rarely generic questions—an author writing in wants to know why *their* specific book has ₹850 pending, why *their* Amazon listing shows the wrong ISBN, or why *their* manuscript is still in Typesetting.



When designing LeafSync, I focused on four practical engineering goals:



**Let code do the math, and let the LLM handle the writing:** LLMs are great at writing empathetic replies, but they are unreliable at date math and threshold comparisons. Before calling Gemini, my backend (`buildContext.js`) calculates the exact facts in JavaScript: whether pending royalties are below the ₹1,000 minimum threshold, whether a payout is overdue (>135 days), and the exact next quarterly payout window (10th–15th of Feb, May, Aug, or Nov). Those verified facts are injected into the prompt so the AI never guesses numbers.
2. **Never block an author because an external AI API is slow or down:** When an author submits a ticket, it saves to PostgreSQL immediately and returns `201 Created`. AI classification and draft generation run asynchronously in the background. If the LLM hits a rate limit or a `503` spike, the system falls back to a deterministic keyword classifier and pre-built Knowledge Base templates so operations never stop.

3. **Keep internal operations data strictly separated from author views:** Admin internal notes live in their own table (`ticket_internal_notes`) rather than as a boolean flag on regular messages. This makes it impossible to accidentally leak internal ops discussions to an author or into an AI prompt.

4. **Human-in-the-loop by default:** AI drafts are generated and waiting in the reply box when an admin opens a ticket, but nothing is ever sent to an author without an admin reviewing and clicking **Approve & Send**.



---



## 2. System Architecture & End-to-End Flow



~~~mermaid

flowchart LR

    subgraph Client["React + Vite + TanStack Query v5"]

        AuthorUI["Author Portal\n(/books, /tickets)"]

        AdminUI["Admin Workspace\n(/admin/queue, /admin/tickets/:id)"]

    end



    subgraph Server["Node.js + Express REST API (/api/v1)"]

        AuthMW["JWT Cookie Auth + RBAC\n(requireAuth / requireRole)"]

        Controllers["REST Controllers + Zod Validation"]

        Orchestrator["Async AI Orchestrator\n+ 60s Retry Sweeper"]

        SSEHub["SSE Real-Time Hub\n(/api/v1/events)"]

    end



    subgraph AILayer["Resilient AI Pipeline"]

        Context["Zero-PII Context Builder\n+ Modular KB Loader"]

        Gemini["Gemini Multi-Model Failover\n(2.5-flash-lite -> 2.5-flash)"]

        Guardrails["Priority Guardrails +\nKeyword Fallback + Circuit Breaker"]

    end



    DB[("PostgreSQL\n(Neon Serverless)")]



    AuthorUI <-->|"REST + Credentials"| AuthMW

    AdminUI <-->|"REST + Credentials"| AuthMW

    SSEHub -.->|"Live Push Events"| AuthorUI

    SSEHub -.->|"Live Push Events"| AdminUI

    AuthMW --> Controllers

    Controllers <--> DB

    Controllers --> Orchestrator

    Orchestrator --> Context --> Gemini --> Guardrails

    Guardrails --> DB

    Guardrails -.-> SSEHub

~~~



---



## 3. Mapping Architecture Decisions to BookLeaf's Requirements



| Requirement Area | How It Is Built in LeafSync | Why This Approach Works |

| :--- | :--- | :--- |

| **1. AI Integration & Cost Control (25%)** | **Modular KB Injection:** Instead of sending the entire BookLeaf Knowledge Base on every call, `kbLoader.js` loads `core.md` (company & tone rules) + only the single category `.md` file (`royalty.md`, `isbn.md`, etc.) matched to the ticket. | Cuts prompt token usage by **~60%** while keeping every policy rule (80/20 split, ₹1,000 rollover, 48h ISBN SLA, Repro India reprint rules) sharp in the context window. |

| **2. AI Resilience & Fallbacks (25%)** | **Multi-Layer Defense:**<br>1. Multi-model failover (`gemini-2.5-flash-lite` -> `gemini-2.5-flash` -> `gemini-flash-latest`).<br>2. 3-strike Circuit Breaker (`circuitBreaker.js`).<br>3. Deterministic Keyword Classifier (`6/6` accuracy on canonical cases) + 1-click Canned KB Templates. | Even if Google's API throws `429`/`503` errors or the API key is removed, tickets are still classified, prioritised, and ready for admin reply without downtime. |

| **3. Priority Accuracy & Guardrails** | **Hybrid AI + Rule Guardrails (`priorityGuardrails.js`):** Wraps the LLM output with hard business rules. | Guarantees that ISBN mismatches, print defects, and overdue royalties (>4 months, >=₹1,000) are **always floored at High/Critical**, while bio/description edits are **capped at Low**. |

| **4. Privacy & Security (15%)** | **Zero-PII Prompt Sanitization:** `buildContext.js` strips the author's email, phone number, and street/city before calling Gemini. Auth uses `httpOnly` JWT cookies, Zod validation, and SQL ownership checks (`WHERE author_id = req.user.id`). | Protects author PII from third-party LLM logs while keeping full contact details visible to human admins in the sidebar. |

| **5. Dataset Edge Cases (15%)** | **Explicit Handling of All 18 Seeded Books:**<br>• **In Production (`BK013`, `BK015`):** Shows active stage (`Cover Design`, `Typesetting`) and clean `—` placeholders for sales columns.<br>• **Below Threshold & Zero Paid (`BK016`):** Flags `₹850 < ₹1,000` with a rollover badge and `Not yet paid` status. | Prevents misleading `₹0` sales displays on unreleased books and immediately explains to both the author and the AI why `BK016` hasn't been paid out yet. |

| **6. Real-Time Sync (15%)** | **Server-Sent Events (`sseHub.js`) + TanStack Query:** Pushes `ticket.created`, `ticket.updated`, `message.created`, and `ai.draft_ready` events scoped by user role, backed by a 20s polling fallback. | When an admin sends a reply or overrides a priority, the author's ticket page and the admin queue update automatically without refreshing the browser. |



---



## 4. Key Trade-Offs I Made



**Modular Markdown Files vs. Vector Database (RAG):** BookLeaf's support policies map cleanly to 6 fixed operational categories. Loading `core.md` + one category `.md` file gives 100% policy recall with zero vector-search latency or embedding costs. Setting up pgvector/Pinecone for a 3-page policy document would have been unnecessary complexity.
**Server-Sent Events (SSE) vs. WebSockets:** Support portals need server-to-client push notifications (new replies, AI completion, status changes), while client-to-server actions (creating a ticket, changing status) are standard REST mutations that benefit from HTTP status codes and Zod validation. SSE over standard HTTP is lighter and more reliable behind cloud proxies than bidirectional WebSockets.
**In-Process Async Worker + 60s Sweeper vs. Redis/BullMQ:** To keep local setup simple (`npm run migrate && npm run seed && npm start` with only PostgreSQL required), AI jobs run asynchronously in-process with a 60-second PostgreSQL sweeper that retries any ticket stuck in `pending` state.


---



## 5. How I Would Scale This for Production



If we rolled LeafSync out to BookLeaf's full 22,000-title catalog and operations team, here are the four upgrades I would make next:



**BullMQ + Redis Job Queue:** Move the in-process AI orchestrator into dedicated BullMQ worker processes with exponential backoff and dead-letter queues to handle traffic spikes during quarterly royalty payout weeks.
2. **Redis Pub/Sub for Multi-Instance SSE:** Connect `sseHub.js` to Redis Pub/Sub so real-time events broadcast across multiple load-balanced Node.js containers.

3. **Pre-Signed S3 / Cloudflare R2 Uploads:** Upgrade the attachment metadata flow to upload defective book photos directly to object storage with pre-signed URLs so the print team can inspect damaged copies inside the workspace.

4. **AI Edit-Distance Feedback Loop:** Compare the initial `ai_draft` against the final message the admin actually sends (`ticket_messages.body`). Tracking which categories get heavily edited by humans would show us exactly which Knowledge Base `.md` file needs better policy wording.
