# LeafSync — BookLeaf Publishing Author Support & Operations Portal

**Author:** Shreyansh Dwivedi  
**Architecture Deep Dive:** [View `ARCHITECTURE_WRITEUP.md`](./ARCHITECTURE_WRITEUP.md)

LeafSync is a full-stack, AI-assisted author support and operations portal built for **BookLeaf Publishing**. BookLeaf manages over 1,200 book launches per month across a 22,000+ title catalog, where support tickets almost always depend on a specific book's state—whether an author is asking about a ₹850 pending royalty balance, an Amazon ISBN mismatch, a manuscript stuck in Typesetting, or defective physical copies from a print batch.

Instead of treating support tickets as generic chat messages, LeafSync connects the author's live catalog and royalty ledger directly to an asynchronous AI triage and response pipeline. It gives authors a transparent self-service portal and gives BookLeaf's operations team a real-time workspace where tickets arrive pre-classified, priority-scored, and pre-drafted against official company policies.

---

## Live Deployment Links

* **Live Frontend Application (React + Vite on Vercel):** [https://leaf-sync.vercel.app/](https://leaf-sync.vercel.app/)
* **Live Backend API Base URL (Node.js + Express on Render):** [https://leafsync-backend.onrender.com](https://leafsync-backend.onrender.com)
* **Interactive OpenAPI 3.0 / Swagger Docs:** [https://leafsync-backend.onrender.com/api/docs](https://leafsync-backend.onrender.com/api/docs)

> **Note on Render Free Tier Cold Starts:** The backend is hosted on Render's free tier, which spins down after 15 minutes of inactivity. Your very first login request may take ~30–40 seconds while the container wakes up; all subsequent requests and live SSE streams run at full speed.

---

## Test Login Credentials & Demo Accounts

Here are the exact email addresses and passwords for testing and logging into LeafSync. You can either type them in or click the **`⚡ Quick-Switch Demo Accounts (For Evaluators) ▼`** toggle on the `/login` page to auto-fill credentials in one click.

* **Universal Password for all accounts:** `Password123`

### Demo Account Emails by Role

#### Admin Account (Operations Queue)
* **Email:** `admin1@bookleaf.demo`
* **Password:** `Password123`
* **What to test:** Full operations queue (`/admin/queue`), SLA breach indicators, AI classification & confidence inspection, category/priority overrides, ticket assignment, private internal ops notes, human-in-the-loop draft approval, and AI telemetry (`/admin/stats`).

#### Author Accounts
* **Kavita Deshmukh** *(Features the ₹850 rollover & Typesetting edge cases)*
  * **Email:** `kavita.deshmukh@email.com`
  * **Password:** `Password123`
  * **Dataset Coverage:** Owns `BK015` (*In Production — Typesetting stage* with clean `—` sales placeholders) and `BK016` (*₹850 pending royalty*, below the ₹1,000 minimum threshold with an automatic quarterly rollover notice and `Not yet paid` status).
* **Priya Sharma** *(Standard multi-book author catalog)*
  * **Email:** `priya.sharma@email.com`
  * **Password:** `Password123`
  * **Dataset Coverage:** Multi-title published catalog (`BK001`, `BK002`, `BK017`) with active sales across Amazon, Flipkart, and BookLeaf Store, plus existing ticket threads (`TKT-0001`).
* **Meera Nair** *(Print quality defect & reprint request)*
  * **Email:** `meera.nair@email.com`
  * **Password:** `Password123`
  * **Dataset Coverage:** Owns `BK008` and ticket `TKT-0004` regarding physical print defects and free Repro India replacement criteria.
* **Vikram Singh** *(ISBN metadata mismatch)*
  * **Email:** `vikram.singh@email.com`
  * **Password:** `Password123`
  * **Dataset Coverage:** Owns `BK011` and high-priority ticket `TKT-0003` covering an ISBN listing error escalated under BookLeaf's 48-hour metadata SLA.
* **Ananya Roy** *(Overdue pending royalty inquiry)*
  * **Email:** `ananya.roy@email.com`
  * **Password:** `Password123`
  * **Dataset Coverage:** Owns `BK005` with overdue pending royalty disbursements and payout window tracking.

*(Additional seeded author accounts available in the database and quick-switch menu include `sneha.kulkarni@email.com`, `ananya.reddy@email.com`, `arjun.mehta@email.com`, and `admin2@bookleaf.demo` — all using `Password123`.)*

---

## Core Platform Capabilities

### 1. Author Self-Service Portal (`/books`, `/tickets`, `/tickets/new`)
* **Catalog & Royalty Ledger (`/books`):** Displays every book linked to the logged-in author alongside ISBN, MRP, publication date, active distribution channels, total copies sold, royalty earned, royalty paid, and pending balance.
* **Built-In Edge Case Handling:**
  * **In-Production Manuscripts (`BK013`, `BK015`):** Clearly badges the active production stage (`Cover Design`, `Typesetting`) and renders `—` for post-publication sales columns instead of misleading `₹0` figures.
  * **Below-Threshold Rollover (`BK016`):** Flags pending balances under ₹1,000 (`₹850 < ₹1,000 threshold`) and explains that the amount rolls over to the next quarterly payout window (10th–15th of Feb, May, Aug, or Nov).
* **Ticket Submission & Threading (`/tickets/new`, `/tickets/:id`):** Authors can raise tickets linked to a specific book (or a General Inquiry), attach file metadata (`name`, `size`, `type`), track live status transitions (`Open` -> `In Progress` -> `Resolved` -> `Closed`), and reply to support threads. Replying to a `Resolved` ticket automatically re-opens it to `In Progress`.

### 2. Admin Operations Workspace (`/admin/queue`, `/admin/tickets/:id`, `/admin/stats`)
* **Urgency-First Queue (`/admin/queue`):** Automatically orders unresolved tickets by priority (`Critical` -> `High` -> `Medium` -> `Low`) and ticket age, with multi-filter support (status, priority, category, assignee, search) and visual **SLA Breach** badges for open tickets older than 24 hours.
* **AI Triage & Human Override Panel:** Shows the AI's predicted category, priority, confidence percentage, and 1-sentence reasoning. Admins can override the category or priority at any time; every override is logged in an immutable audit trail (`ticket_events`) and sets `classified_by = 'admin'`.
* **Human-in-the-Loop Draft Editor:** Pre-fills the reply composer with a Knowledge Base–grounded AI draft. Admins can edit the text, insert a **1-Click Canned KB Template**, or regenerate the AI draft before clicking **Approve & Send**.
* **Physically Isolated Internal Notes:** Admins can record private operational notes (`ticket_internal_notes` table) that are never exposed to author API responses or third-party AI prompts.
* **Operations & AI Telemetry (`/admin/stats`):** Tracks SLA health, category distribution, AI vs. fallback rates, average classification/drafting latency, and token consumption.

### 3. Real-Time Synchronization (Server-Sent Events)
* Both portals subscribe to `/api/v1/events` via **Server-Sent Events (SSE)** with role-scoped channels (`admin` vs. `author:{id}`), backed by automatic 20-second polling fallback in TanStack Query. When an admin replies, changes a status, or when background AI triage completes, both screens update live without refreshing the browser.

---

## Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, React Router v7 | Fast SPA with role-protected routes and responsive layout |
| **State & Data Fetching** | TanStack React Query v5 + EventSource (SSE) | Cache invalidation, optimistic updates, and real-time push sync |
| **Backend Runtime** | Node.js, Express 5 | RESTful API (`/api/v1`), auth middleware, async AI orchestration |
| **Database & Migrations** | PostgreSQL (Neon Serverless), `pg`, `node-pg-migrate` | Normalized relational storage, JSONB attachments, versioned SQL schema |
| **AI & LLM Layer** | Google Gemini (`gemini-2.5-flash-lite` / `gemini-2.5-flash`) | Structured JSON classification, priority scoring, and KB-grounded drafting |
| **Validation & Security** | Zod, `jsonwebtoken` (`httpOnly` cookies), `bcryptjs`, Helmet, CORS | Input validation, stateless RBAC auth, and SQL ownership checks |
| **Testing & Docs** | Node Test Runner (`node --test`), Supertest, OpenAPI 3.0 / Swagger UI | Automated unit/integration tests, 6-case AI evaluation suite, live API docs |

---

## Local Setup & Running Instructions

### Prerequisites
* **Node.js** v18+ (tested up to Node v24)
* **PostgreSQL** (Local PostgreSQL database or a free [Neon](https://neon.tech) Serverless Postgres connection string)
* **Google AI Studio API Key** (Optional for local testing — if omitted or rate-limited, the server automatically falls back to the deterministic keyword classifier and canned KB templates)

### 1. Clone the Repository
~~~bash
git clone https://github.com/Shreyansh3108/LeafSync.git
cd LeafSync
~~~

### 2. Backend Setup (Terminal 1)
Move into the `server` folder, install dependencies, and configure your `.env` file:
~~~bash
cd server
npm install
cp .env.example .env
~~~

Open `server/.env` and set your PostgreSQL connection string and Gemini API key:
~~~env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://username:password@localhost:5432/leafsync
JWT_SECRET=your-secret-jwt-key-here
CORS_ORIGIN=http://localhost:5173

AI_PROVIDER=gemini
AI_API_KEY=your_google_ai_studio_api_key
AI_MODEL_CLASSIFY=gemini-2.5-flash-lite
AI_MODEL_DRAFT=gemini-2.5-flash-lite
~~~

Run the database migrations, seed the 10 authors / 18 books / sample tickets, run the test suites, and start the backend server:
~~~bash
# 1. Create tables and indexes in PostgreSQL
npm run migrate

# 2. Seed all BookLeaf authors, 18 books, and canonical support tickets
npm run seed

# 3. Run unit & guardrail tests + the 6-case AI classification evaluation suite
npm test
npm run eval

# 4. Start the Express backend server (runs on http://localhost:3000)
npm run start
~~~

### 3. React + Vite Frontend Setup (Terminal 2)
Open a second terminal window, navigate into the `client` directory, install dependencies, and start the Vite development server:
~~~bash
cd client
npm install
npm run dev
~~~

* **Frontend URL:** Open **`http://localhost:5173/login`** in your browser (Vite automatically proxies `/api` requests to `http://localhost:3000` during local development).
* **Swagger API Docs:** Open **`http://localhost:3000/api/docs`** to inspect and test all REST endpoints interactively.

---

## How the AI Pipeline Works (25% Rubric Focus)

1. **Deterministic Math Before Prompting (`buildContext.js`):** LLMs should not do financial math or calendar comparisons in their heads. Before calling Gemini, the backend calculates exact booleans and dates in JavaScript:
   * `belowMinimumThreshold`: `true` when `0 < royalty_pending < 1000` (triggers the ₹1,000 quarterly rollover explanation).
   * `overdueRoyalty`: `true` when `royalty_pending >= 1000` and more than 135 days have passed since the last payout or publication date.
   * `nextPayoutWindow`: Computes the exact upcoming quarterly payout window (10th–15th of Feb, May, Aug, or Nov).
2. **Zero-PII Context Sanitization:** Author email addresses, phone numbers, and street addresses are stripped out before building the LLM prompt so personal data is never sent to external model providers.
3. **Modular Knowledge Base Injection (~60% Token Savings):** Instead of stuffing the entire BookLeaf policy manual into every prompt, `kbLoader.js` loads `core.md` (tone and company overview) plus **only the single category `.md` file** (`royalty.md`, `isbn.md`, `printing.md`, `production.md`, `distribution.md`, or `general.md`) matching the ticket.
4. **Hard Priority Guardrails (`priorityGuardrails.js`):** Wraps the AI's raw priority output with deterministic business rules so critical operational issues are never under-prioritized:
   * **ISBN Mismatches & Defective Print Copies:** Always floored at **`High` / `Critical`**.
   * **Overdue Royalties (>4 months & >=₹1,000):** Always floored at **`High`**.
   * **Routine Bio / Description Edits:** Capped at **`Low`**.
5. **Multi-Model Failover & 3-Strike Circuit Breaker:** If `gemini-2.5-flash-lite` hits a `429` or `503` error, the client automatically fails over to `gemini-2.5-flash`. If 3 consecutive failures occur, `circuitBreaker.js` trips open and routes tickets through the deterministic `keywordClassifier.js` (`6/6` accuracy on canonical test cases) and pre-built KB templates so support operations never stall.

---

## REST API Overview (`/api/v1`)

Full request/response schemas are documented in Swagger UI at [`/api/docs`](https://leafsync-backend.onrender.com/api/docs).

| Method & Endpoint | Access | Description |
| :--- | :--- | :--- |
| `POST /api/v1/auth/login` | Public | Authenticates email/password and sets `httpOnly` JWT cookie |
| `POST /api/v1/auth/logout` | Authenticated | Clears session cookie |
| `GET /api/v1/auth/me` | Authenticated | Returns current logged-in user profile and role |
| `GET /api/v1/books` | Author | Returns the author's books, production stages, and royalty summary |
| `GET /api/v1/books/:id` | Author | Returns single book details (enforces SQL ownership check) |
| `GET /api/v1/tickets` | Author | Lists all support tickets created by the logged-in author |
| `POST /api/v1/tickets` | Author | Creates a ticket (`201 Created`) and dispatches async AI triage |
| `GET /api/v1/tickets/:id` | Author | Returns ticket details and public message thread (excludes internal notes) |
| `POST /api/v1/tickets/:id/messages` | Author | Posts an author reply (re-opens `Resolved` tickets to `In Progress`) |
| `GET /api/v1/admin/tickets` | Admin | Lists all tickets sorted by unresolved urgency with filter support |
| `GET /api/v1/admin/tickets/:id` | Admin | Returns full workspace payload (thread, internal notes, book ledger, audit log) |
| `PATCH /api/v1/admin/tickets/:id/status` | Admin | Updates ticket status (`Open` -> `In Progress` -> `Resolved` -> `Closed`) |
| `PATCH /api/v1/admin/tickets/:id/triage` | Admin | Overrides category and/or priority and logs an audit event |
| `PATCH /api/v1/admin/tickets/:id/assign` | Admin | Assigns ticket ownership to an admin user |
| `POST /api/v1/admin/tickets/:id/messages` | Admin | Approves and sends a reply to the author (`Approve & Send`) |
| `POST /api/v1/admin/tickets/:id/notes` | Admin | Adds a private internal operations note (`ticket_internal_notes`) |
| `POST /api/v1/admin/tickets/:id/ai-retry` | Admin | Manually re-runs AI classification and draft generation |
| `GET /api/v1/admin/kb-templates` | Admin | Returns canned Knowledge Base response templates by category |
| `GET /api/v1/admin/stats` | Admin | Returns queue SLA metrics and AI latency/token telemetry |
| `GET /api/v1/events` | Authenticated | Role-scoped Server-Sent Events (SSE) real-time push stream |

---

## Project Structure

~~~text
LeafSync/
├── ARCHITECTURE_WRITEUP.md          # Detailed system design, trade-offs & scaling roadmap
├── README.md                        # Setup guide, live links, test credentials & API overview
├── client/                          # React 19 + Vite Frontend (Deployed on Vercel)
│   ├── src/
│   │   ├── api/                     # Fetch client & TanStack Query v5 hooks
│   │   ├── auth/                    # Auth context & role-based route guards
│   │   ├── components/              # Layout, badges, status pills & shared UI
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx        # Login screen with collapsible evaluator demo drawer
│   │   │   ├── author/              # Author Books, Tickets List, New Ticket, Ticket Detail
│   │   │   └── admin/               # Admin Queue, Ticket Workspace, Telemetry Dashboard
│   │   └── realtime/                # SSE EventSource listener + query cache invalidation
│   └── vite.config.js               # Vite config with local /api proxy
└── server/                          # Node.js + Express Backend (Deployed on Render)
    ├── migrations/                  # Versioned PostgreSQL schema migrations
    ├── src/
    │   ├── ai/                      # Gemini client, modular KB (.md), guardrails, circuit breaker
    │   ├── config/                  # Env loader & OpenAPI 3.0 / Swagger specification
    │   ├── controllers/             # Auth, Books, Author Tickets, and Admin Ops controllers
    │   ├── db/                      # PostgreSQL pool & deterministic dataset seeders
    │   ├── middleware/              # JWT auth, RBAC guards, Zod validation, error handler
    │   ├── realtime/                # Role-scoped SSE broadcast hub (sseHub.js)
    │   └── routes/                  # Express v1 routers
    └── tests/                       # Automated unit tests & 6-case AI evaluation runner
~~~

---

## Known Limitations & Production Next Steps

* **Attachment Storage:** File attachments currently store metadata (`name`, `size`, `type`) in a PostgreSQL `JSONB` column as scoped in the assignment brief. In production, this would use pre-signed AWS S3 or Cloudflare R2 upload URLs so authors can upload defective book photos directly.
* **Background Queue Scaling:** The asynchronous AI orchestrator and 60-second recovery sweeper run in-process so local setup only requires PostgreSQL. For production traffic spikes during quarterly royalty payout weeks, I would move the worker queue to **BullMQ + Redis** and connect the SSE hub to **Redis Pub/Sub**.
