---
name: quizquiz-ai
description: Implement or review QuizQuiz Astra quiz generation, prompts, output schemas, and AI adapters. Use for the server AI pipeline and its tests, not general UI-only edits.
---

# QuizQuiz AI

Read `docs/ai.md` and the current quiz domain and generator port from the repository root. Astra is the user's selected model; the configured default is `gpt-6-astra`.

- Keep model-specific code in `src/server/ai` behind `QuizGenerator`. Use lazy server configuration so Mock mode, builds, and tests do not require API credentials.
- Check official OpenAI documentation when changing model IDs or API parameters. The current adapter uses Responses API, Structured Outputs, and low reasoning effort. Do not silently switch the selected model.
- Keep remote JSON-schema constraints compatible with the API and independently validate business rules locally: requested count, four distinct options, valid answer index, nonempty explanation, and duplicate questions.
- Version prompts and retain provider/model/prompt metadata on internal drafts. Generated content remains `unreviewed`; schema validation is not fact checking. Prefer stable general knowledge and avoid invented citations or time-sensitive trivia without evidence.
- Keep secrets and answer keys on the server. Construct public DTOs by selecting allowed fields, not by serializing drafts.
- Bound generation time, output tokens, and retries. Treat model refusal, incomplete output, invalid output, and provider errors as explicit failures; do not silently replace failed real AI calls with sample data.
- Mock fixtures are deterministic structural examples. Do not represent their difficulty labels as calibrated educational content.
- Automated tests and builds use mocks. A change to the provider should be verified against simulated SDK responses before any separately intended paid model check.

The preview API is development-only. When adding production generation, implement the concrete access and quota requirements together with the persistence/session design described in `docs/architecture.md`.
