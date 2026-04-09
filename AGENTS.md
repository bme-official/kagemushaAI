# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is **Kagemusha AI (影武者AI)** — an AI-powered customer inquiry chatbot built with Next.js 15, TypeScript, and Supabase. The only required service is the Next.js dev server; all external APIs (OpenAI, Supabase, ElevenLabs, Resend) degrade gracefully when not configured.

### Quick start

See `README.md` for setup details. Key commands:

- **Install:** `npm install`
- **Dev server:** `npm run dev` (port 3000)
- **Lint:** `npm run lint`
- **Build:** `npm run build`

### Environment variables

Copy `.env.example` to `.env.local`. For local development without external services, set `NOTIFICATION_PROVIDER=console`. All other env vars are optional; the app uses in-memory storage and rule-based chat fallback when Supabase/OpenAI keys are absent.

### Key pages for testing

- `/contact` — contact form with "チャットで相談する" chat launcher button
- `/embed/chat` — embeddable chat widget (includes VRM avatar panel)
- `/admin/inquiries` — admin panel (protected by Basic Auth if `ADMIN_BASIC_AUTH_USER`/`ADMIN_BASIC_AUTH_PASS` are set)
- `/` — landing page with avatar demo

### Notes

- The chatbot works in rule-based fallback mode without `OPENAI_API_KEY`. It still collects structured inquiry data (name, email, budget, etc.).
- No automated test framework is configured; verification is done via lint, build, and manual testing.
- `package-lock.json` is used — use `npm` (not pnpm/yarn) as the package manager.
