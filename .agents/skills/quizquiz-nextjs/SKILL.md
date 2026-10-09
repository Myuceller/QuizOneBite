---
name: quizquiz-nextjs
description: Develop QuizQuiz Next.js and React screens, route handlers, and feature boundaries. Use for this repository's quiz web app; use its PostgreSQL persistence boundary.
---

# QuizQuiz Next.js

Use this skill for work inside the QuizQuiz repository. Read `AGENTS.md` and the relevant part of `docs/architecture/overview.md` from the repository root.

- Keep routes and layouts in `src/app`, quiz UI in `src/features/quiz/components` and gameplay UI in `src/features/play/components`, business rules in `domain`, and orchestration in `application`.
- Default to Server Components; use Client Components for interactive controls. Client code can use public quiz types but must not import AI adapters, secrets, or server orchestration.
- The home page starts bank-backed gameplay; legacy generation previews remain at `/preview`. Read `docs/quiz/bank.md` for selection, ratings, reports, and operator workflows.
- UI requests go through route handlers. Previews exclude answers and explanations. Gameplay grades on the server and only exposes the submitted question’s result. Bank-backed play and feedback must not call paid AI.
- Derive quiz ownership from the server session, never client input. Authenticate and scope history reads by user ID. Production previews allow authenticated Mock requests with a shared database quota; paid AI remains gated.
- Keep the mobile web layout readable, with Korean labels, keyboard-accessible controls, and explicit loading, empty, and error states. No design system has been selected yet.
- PostgreSQL is selected. Use `QuizRepository` / `PlayRepository` with the adapter in `src/server/db`, keep SQL migrations in `db/migrations`, and read `docs/operations/database.md` for setup. Apply new migrations instead of editing applied files. AI output remains an unreviewed draft. Auth uses Better Auth with PostgreSQL sessions; Render Docker + Render Postgres staging is deployed; production resources are not created. Read `docs/architecture/auth.md` and `docs/operations/docker.md` for account and Docker work.

Check changes with the relevant `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` commands. Use fixtures for automated verification. Read `docs/ai/integration.md` and the `quizquiz-ai` skill when changing model calls or generated data contracts.
