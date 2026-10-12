---
name: quizquiz-qa
description: Review QuizQuiz question-bank quality, correctness, concise options, general-knowledge relevance, difficulty, and duplicates. Use when the user asks for quiz QA, question review, or a pre-publication content audit; not for general UI tests.
---

# QuizQuiz question QA

Read `docs/quiz/qa.md` and `docs/quiz/quality.md` from the repository root.

1. Confirm the target environment and IDs/statuses. Take a read-only bank-only snapshot into ignored `.local/quiz-generation/qa-YYYY-MM-DD/` with private file permissions. Never pass credentials, user rows, or player history to reviewers. Record immutable content hashes and input counts.
2. Check schema, four distinct options, answer index, duplicate normalized question text, category/difficulty, and coverage mechanically. Report long/sentence options as signals, not automatic failures. Schema success is not factual verification.
3. Use independent `quiz-fact-reviewer` and `quiz-editorial-reviewer` roles for their documented responsibilities. When the user invokes this QA workflow, independent review delegation is part of it. Bound batches and concurrency; preserve the parent model unless explicitly requested otherwise. If custom roles are unavailable, pass the same role instructions to available agents and disclose this fallback. No paid API calls.
4. Every input ID must have a matching hash and explicit verdict. Reviewers return structured results; the coordinator alone saves them under the private directory. Mark partial runs incomplete. Do not turn skipped/uncertain entries into passes.
5. Adjudicate blockers using evidence. Retain `not_independently_verified` where no primary-source check was made. Report per-role coverage, source-verification count, warnings, holds, and duplicate pairs. Different AI agents are not independent human review.
6. QA itself never changes DB content or status. Publication/synchronization is a separate authorized operation: exclude unresolved blockers, preserve remote moderation, compare existing IDs/content, back up, transact, and verify. Do not rewrite published rows; pause and create a new revision when a correction is separately applied.
7. Save an answer-free dated summary under `docs/records/YYYY/`, link it in the records index, and give the user the actual result and limitations. Do not add private reports, question originals, or answer keys to Git.
