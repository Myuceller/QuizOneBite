# QuizOneBite · 퀴즈퀴즈

QuizOneBite는 가끔 멍청해졌다고 느낄때 들여다보는 나의 상식 저장고입니다.

Next.js App Router · React · TypeScript · PostgreSQL 기반 상식 퀴즈 앱의 초기 구조입니다. 이메일 회원가입·로그인·로그아웃, 환영 페이지, 사용자별 문제 모음과 Docker 실행을 구현했습니다. 샘플 문제 미리보기와 Astra 개발용 어댑터를 유지합니다. 정답 제출·채점, 이메일 인증·비밀번호 복구, 공개 배포는 다음 단계입니다.

## 실행

Node.js 24 LTS, npm 11 이상과 실행 중인 Docker가 필요합니다. 권장 Node 버전은 `.node-version`에 기록했습니다.

```sh
npm ci
npm run db:setup
npm run dev
```

`db:setup`은 로컬 DB 접속 정보와 인증 비밀값을 `.env.local`에 만들고 PostgreSQL 컨테이너, 스키마, 샘플 데이터를 준비합니다. 기존 접속 정보는 덮어쓰지 않습니다. 브라우저에서 <http://127.0.0.1:3000>을 엽니다. 기본 `AI_PROVIDER=mock`에서는 API 키 없이 샘플 문제를 생성·저장합니다. 샘플의 난이도는 교육적으로 보정된 등급이 아닙니다.

## Astra 연결

`.env.local`에 다음 서버 환경변수를 설정하고 개발 서버를 다시 시작합니다.

```dotenv
AI_PROVIDER=openai
OPENAI_MODEL=gpt-6-astra
OPENAI_API_KEY=발급받은_API_키
```

이후 미리보기 버튼을 누르면 실제 API 요청이 발생합니다. 계정의 API 사용 권한과 모델 접근 권한이 필요합니다. 키를 브라우저 코드나 `NEXT_PUBLIC_` 변수에 넣지 마세요. 모델 ID와 Structured Outputs 지원은 [OpenAI 공식 모델 문서](https://developers.openai.com/api/docs/models/gpt-6-astra)를 기준으로 구성했습니다.

실제 유료 API 호출은 초기 설정 검증에 포함하지 않았습니다. 자동 테스트와 빌드는 Mock을 사용합니다.

## 구조

```text
src/
  app/                         화면·레이아웃·API 라우트
  features/auth/               가입·로그인·로그아웃 화면과 인증 클라이언트
  components/                  로고·공통 헤더·푸터
  features/quiz/
    components/                React 퀴즈 화면
    domain/                    입력·출력 스키마와 타입
    application/               생성 흐름과 공개 응답 변환
    ports/                     AI 생성기·저장소 인터페이스
  server/
    auth/                      Better Auth 설정·서버 세션 확인
    ai/                        Mock·Astra 어댑터와 프롬프트
    config/                    서버 환경변수 검증
    db/                        PostgreSQL 풀·저장소 구현
db/migrations/                 SQL 마이그레이션
scripts/                       DB 설정·마이그레이션·시드 명령
.agents/skills/                 프로젝트 전용 개발 스킬
docs/                          구조와 AI 설계 결정
```

`UI → API → 퀴즈 생성 → PostgreSQL 저장 → 공개 미리보기` 순서로 실행합니다. `QuizGenerator`와 `QuizRepository`를 통해 AI와 DB 구현을 도메인에서 분리합니다. 서버의 `DATABASE_URL`로 접속하며 운영 호스팅 제공자는 아직 정하지 않았습니다.

- `GET /api/health`: 앱 상태 확인.
- `GET /api/health/ready`: DB·필수 스키마 연결 확인.
- `/api/auth/*`: Better Auth 인증 엔드포인트.
- `POST /api/quiz/preview`: 저장 후 정답 없는 미리보기 반환. 운영 모드에서는 로그인한 사용자의 `mock` 요청만 허용하며 계정당 분당 10회로 제한합니다. Astra 공개 호출은 아직 차단됩니다.
- `/signup` → `/welcome` → `/`: 가입 후 첫 진입 흐름.
- `/history`, `/history/[id]`: 로그인 사용자 본인의 최근 문제 30개 및 상세.

## 개발 스킬

- [`quizquiz-nextjs`](.agents/skills/quizquiz-nextjs/SKILL.md): 화면, 라우트, 클라이언트·서버 경계.
- [`quizquiz-ai`](.agents/skills/quizquiz-ai/SKILL.md): Astra, 프롬프트, 출력 검증, Mock 테스트.
- [`AGENTS.md`](AGENTS.md): 저장소 공통 개발 지침.

이 저장소의 `.agents/skills`에 스킬을 등록했습니다. 스킬 목록이 갱신되지 않으면 프로젝트 세션을 다시 열어 사용할 수 있습니다.

## 확인

```sh
npm run check
npm run test:db
```

`check`는 DB 없이 Lint, 타입 검사, 단위 테스트, 프로덕션 빌드를 실행합니다. `test:db`는 실행 중인 로컬 PostgreSQL에서 별도의 임시 DB로 저장·조회·트랜잭션 롤백, 인증·로그아웃·접근 권한·동시 요청 제한을 검증합니다.

DB 확인은 `npm run db:status`, 중지는 `npm run db:down`입니다. 중지해도 데이터 볼륨은 유지됩니다. 상세한 명령과 테이블 구조는 [DB 문서](docs/database.md)를 참고하세요.

다음 단계와 DB 경계는 [구조 문서](docs/architecture.md), 출력 계약과 모델 설정은 [AI 문서](docs/ai.md)에 정리했습니다.

## 앱까지 Docker로 실행

```sh
npm run db:env
npm run docker:up
```

<http://127.0.0.1:3001>에서 가입 → 환영 화면 → 문제 생성 → 내 문제 모음 → 로그아웃을 확인할 수 있습니다. 기본 개발 서버(3000)와 Docker 앱(3001)은 같은 로컬 DB를 사용합니다. 로그인 없이 보는 개발용 샘플은 3000에서 유지됩니다.

`db`가 준비되면 `migrate` 컨테이너가 새 SQL을 적용하고, 성공한 뒤에만 `app`이 시작합니다. `npm run docker:logs`로 앱 로그를, `npm run docker:down`으로 앱과 DB 중지를 수행합니다. 데이터 볼륨은 보존합니다. 일반 `npm run db:down`도 같은 Compose 프로젝트이므로 Docker 앱 실행 중에는 사용하지 마세요.

인증 상세는 [auth.md](docs/auth.md), 이미지 구성과 공개 출시 계획은 [deployment.md](docs/deployment.md)를 참고하세요.
