# QuizQuiz 작업 규칙

Next.js App Router, React, TypeScript 기반 상식 퀴즈 웹앱이다. DB는 PostgreSQL, 인증은 Better Auth이며 현재 원격 호스팅은 Render Web Service(Docker)와 Render Postgres다. 사용자는 장기 DB를 직접 운영하는 PostgreSQL로 정했으며 호스트 선정과 실제 이전은 후속 작업이다. 테스트 서버는 배포되었으며 운영 Blueprint는 아직 생성하지 않았다. 기본 AI 제공자는 Mock이고 OpenAI Astra 연결은 서버 어댑터로 분리한다.

## 관련 자료

- [문서 목록·폴더 분류·작성 기준](docs/README.md)
- [프로젝트 구조](docs/architecture/overview.md)
- [문제 은행·출제·평가](docs/quiz/bank.md)
- [운영자 AI 생성·예산](docs/ai/generation.md)
- [AI 연결 규칙](docs/ai/integration.md)
- [PostgreSQL 실행과 마이그레이션](docs/operations/database.md)
- [인증과 세션](docs/architecture/auth.md)
- [Docker 실행과 출시 계획](docs/operations/docker.md)
- [Render 테스트·운영 배포](docs/operations/render.md)
- [Next.js 프로젝트 스킬](.agents/skills/quizquiz-nextjs/SKILL.md)
- [AI 프로젝트 스킬](.agents/skills/quizquiz-ai/SKILL.md)

## 구현 경계

- `src/app`은 화면과 HTTP 입출력, `src/features/quiz`와 `src/features/play`는 도메인·유스케이스·포트를 담당한다.
- 도메인에서 Next.js, OpenAI SDK, DB 구현을 import하지 않는다. 서버에서 어댑터를 선택하고 포트로 주입한다.
- API 키와 AI SDK는 `src/server` 등 서버 전용 코드에 둔다. 클라이언트 번들에 비밀값을 포함하지 않는다.
- PostgreSQL 어댑터는 `src/server/db`, SQL 마이그레이션은 `db/migrations`에 둔다. 도메인은 `QuizRepository` 계약만 참조한다. 현재 연결은 `pg` 드라이버를 사용한다.
- 사용자 인증은 `src/server/auth`의 Better Auth와 DB 세션으로 확인한다. 퀴즈 소유자는 서버 세션에서 얻고 기록 조회는 소유자로 제한한다.
- 적용한 마이그레이션 파일은 수정하지 않고 새 파일을 추가한다. 퀴즈 묶음과 문제는 같은 트랜잭션에서 저장한다.
- AI 생성 결과는 검토 전 초안이다. 스키마 통과를 사실 검증으로 간주하지 않는다.
- 미리보기에는 정답과 해설을 포함하지 않는다. 플레이는 서버에서 채점하고 제출한 문제의 정답·해설만 반환한다. 문제 은행 출제와 사용자 평가는 AI를 호출하지 않는다.
- 범위를 넓히기 전에 기존 구조와 사용자 요청을 확인하고, 현재 구현과 후속 계획을 문서에서 구분한다.

## 문서 관리

현재 구조·정책·운영 방법은 `docs/`의 주제별 가이드를 갱신한다. 날짜별 실행 결과는 `docs/records/YYYY/YYYY-MM-DD-topic.md`에 작성하고 `docs/records/README.md` 목록에 추가한다. 새 문서를 만들기 전에 `docs/README.md`의 분류와 작성 기준을 따른다. 정답을 포함한 문제 원본·DB 덤프·비밀값은 문서 폴더나 Git에 추가하지 않는다. 문서를 이동하면 내부 링크와 프로젝트 스킬의 참조 경로도 함께 수정한다.

## 확인 명령

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:db
```

변경에 필요한 검증을 수행하고 결과를 기록한다. 자동 테스트와 빌드는 Mock AI를 사용하며 실제 유료 API 요청을 보내지 않는다. 일반 테스트는 DB가 필요 없고, `test:db`는 로컬 PostgreSQL에 임시 DB를 생성해 검증한 뒤 그 임시 DB만 제거한다. 생성 계약이나 서버·클라이언트 경계를 변경할 때에는 관련 문서와 의미 있는 테스트를 함께 확인한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
