---
name: quizquiz-nextjs
description: Develop QuizQuiz Next.js and React screens, route handlers, and feature boundaries. Use for this repository's quiz web app; use its PostgreSQL persistence boundary.
---

# QuizQuiz Next.js

Use this skill for work inside the QuizQuiz repository. Read `AGENTS.md` and the relevant part of `docs/architecture.md` from the repository root.

- Keep routes and layouts in `src/app`, quiz UI in `src/features/quiz/components`, business rules in `domain`, and orchestration in `application`.
- Default to Server Components; use Client Components for interactive controls. Client code can use public quiz types but must not import AI adapters, secrets, or server orchestration.
- The current UI is a problem preview, not a complete quiz game. Preserve that distinction until gameplay is explicitly implemented.
- UI requests go through route handlers. Public previews exclude correct answers and explanations; future grading belongs on the server.
- Derive quiz ownership from the server session, never client input. Authenticate and scope history reads by user ID. Production previews allow authenticated Mock requests with a shared database quota; paid AI remains gated.
- Keep the mobile web layout readable, with Korean labels, keyboard-accessible controls, and explicit loading, empty, and error states. No design system has been selected yet.
- PostgreSQL is selected. Use `QuizRepository` with the adapter in `src/server/db`, keep SQL migrations in `db/migrations`, and read `docs/database.md` for setup. Apply new migrations instead of editing applied files. AI output remains an unreviewed draft. Auth uses Better Auth with PostgreSQL sessions; production hosting is undecided. Read `docs/auth.md` and `docs/deployment.md` for account and Docker work.

Check changes with the relevant `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` commands. Use fixtures for automated verification. Read `docs/ai.md` and the `quizquiz-ai` skill when changing model calls or generated data contracts.
