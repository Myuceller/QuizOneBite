# 운영자용 AI 문제 생성

일반 사용자는 저장된 문제를 풀고, 운영자가 필요한 만큼 생성해 검수 후 게시한다. 생성 명령은 로컬 Node.js 24에서 실행한다. 웹 API·스케줄러·배포 빌드가 생성 명령을 자동 실행하지 않는다.

## 키와 예산 준비

[OpenAI API 키](https://platform.openai.com/api-keys)를 발급한 뒤 프로젝트의 `.env.local`에 직접 넣는다. 채팅·Git·스크린샷·브라우저 코드에 키를 공유하지 않는다. 환경변수 방식은 [공식 Quickstart](https://developers.openai.com/api/docs/quickstart)를 따른다. 계정의 API 결제 설정과 `gpt-6-astra` 접근 권한이 필요하며 실제 접근 가능 여부는 유료 호출 없이 확인하지 않았다.

```dotenv
OPENAI_API_KEY=발급받은_키
OPENAI_MODEL=gpt-6-astra
AI_MONTHLY_BUDGET_USD=1
AI_PROVIDER=mock
```

위 예시는 월 $1 설정이다. `.env.example`의 기본 예산은 0이며 실제 호출을 차단한다. 사용자가 금액을 정해 설정해야 한다. `AI_PROVIDER=mock`은 기존 웹 미리보기 설정이며, 운영자 생성 명령은 별도로 Astra를 사용한다. Render 웹 서비스에 생성 키를 넣을 필요는 없다.

`DATABASE_URL`은 결과를 저장할 DB다. `.env.local`의 기본값이면 **로컬 DB에만 저장**된다. 원격 문제 은행을 채우려면 [Render 문서](render.md)에 따라 외부 접속을 제한적으로 허용하고 해당 DB의 주소를 로컬 생성 프로세스에 제공한다. 명령 시작 시 비밀번호 없이 DB 호스트·이름을 표시한다. 여러 DB에서 생성하면 각 DB가 별도 예산을 집계하므로 생성용 DB 하나를 기준으로 운영한다.

## 실행 순서

```sh
# 새 생성 이력 테이블 적용
npm run db:migrate

# 키나 DB 없이도 실행 가능. API를 호출하지 않는 실행 계획
npm run bank:generate

# 위 출력의 jobId를 복사한다. 실제 유료 요청 1회를 실행하는 명령
npm run bank:generate -- --execute --job <jobId>

# 결과·실패·예약 상태 조회
npm run bank:generate -- --status <jobId>

# 생성된 문항 ID로 정답·보기·해설·출처를 검토
npm run bank -- show <문제UUID>

# 출처를 직접 확인하고 정답이 유일한지 검토한 뒤 게시
npm run bank -- publish <문제UUID> <검수자> "정답·보기·해설을 출처와 대조함"
```

기본은 과학·보통 난이도 3문제다. 최대 5문제이며, 한 실행에서 요청을 1번만 보낸다. 출력 형식 오류·중복 때문에 목표 수를 채우지 못해도 추가 호출하지 않는다.

```sh
npm run bank:generate -- --category history --difficulty hard --count 5 --evidence /private/history-facts.json
npm run bank:generate -- --category history --difficulty hard --count 5 --evidence /private/history-facts.json --execute --job <앞서_확인한_jobId>
```

같은 jobId로 재실행하면 저장된 상태만 반환한다. 입력·자료·모델이 달라졌다면 거부한다. 실패하거나 `reserved`에 남은 작업을 새 ID로 무심코 재실행하면 또 비용이 들 수 있다. 상태와 OpenAI 사용량을 확인한 뒤 의도적으로 새 작업을 시작한다.

## 참고 자료와 검수

[기본 과학 자료](examples/science-evidence.json)는 2026-10-06에 NASA의 목성·화성·수성 자료를 대조해 작성한 짧은 사실 요약이다. 자동 크롤링이나 유료 웹 검색은 하지 않는다. 다른 주제는 운영자가 확인한 자료를 같은 형식으로 제공한다.

```json
[
  {
    "id": "reference-1",
    "title": "자료 제목",
    "url": "https://example.com/reference",
    "facts": "출처에서 확인한 사실을 짧게 요약한다. 정답과 해설이 여기서 뒷받침될 수 있어야 한다."
  }
]
```

AI는 자료 ID만 반환하고 서버가 원본 출처 URL을 연결한다. 알 수 없는 출처 ID, 겹치는 보기, 유효하지 않은 정답, 중복 문항, 요청 수 불일치는 거부한다. 최근 같은 주제의 문제 10개를 프롬프트에 넣어 재생성을 줄이며, DB의 정확한 문장 중복도 건너뛴다. 의미가 같은 다른 문장과 오답의 사실성·모호함은 사람이 검토해야 한다.

생성 결과는 항상 `draft`다. 출처가 연결되어도 내용의 사실성이 자동 보증되는 것은 아니다. 검수 중 수정은 `bank export`로 가져온 문항을 편집해 `bank import`로 같은 draft ID에 반영한다. 내보낸 파일에는 정답이 들어 있으므로 Git이나 공개 경로에 두지 않는다. 게시된 문제의 내용 변경은 기존 문항을 퇴역시키고 새 버전을 만든다.

## 비용 제한과 정확한 범위

- 선택된 모델은 `gpt-6-astra`로 유지한다. 다른 모델은 가격표 검토 없이 실행되지 않는다.
- 요청은 Standard(`service_tier=default`), reasoning low, 저장 끔, 출력 최대 4,000토큰, 60초 타임아웃, SDK 자동 재시도 0회다. 도구·웹 검색을 사용하지 않는다.
- API 호출 전에 DB에서 **$0.50를 예약**한다. 이것은 예상 실결제액이 아니라 동시 실행을 위한 보수적 예산 예약액이다. 월 잔액이 예약액보다 적으면 호출하지 않는다.
- 요청 본문은 UTF-8 16KB 이하다. 예약 산정은 입력을 바이트 수와 추가 여유로 제한하고 최대 출력량을 반영한다.
- 응답 토큰 사용량을 받으면 입력 100만 토큰당 $12.50, 출력 $50 기준의 보수적 추정 사용액으로 갱신한다. 입력을 캐시 쓰기 단가로 계산하므로 실제 청구보다 클 수 있다. 이 단가는 [2026-10-06 Astra 공식 가격](https://developers.openai.com/api/docs/models/gpt-6-astra)을 기준으로 한다.
- 월 집계는 **해당 DB의 작업 시작 시각, UTC 달력월** 기준이다. 동시 프로세스도 DB 잠금으로 예약한다. 타임아웃·중단 등 사용량을 모르면 예약을 그대로 유지하며, 실패한 응답의 토큰도 집계한다.
- 이는 이 생성 명령의 **앱 내부 추정 예산 제한**이다. 계정 전체 청구 상한·다른 프로그램의 호출·다른 DB의 생성·세금·환율·향후 가격 변경까지 보장하지 않는다. 다른 유료 개발 미리보기는 이 원장에 포함되지 않으므로 `AI_PROVIDER=mock`을 유지한다.

월 한도는 환경변수로 명시적으로 변경할 수 있다. 작업 이력은 `quizquiz.generation_jobs`에 보관하며 예약·성공·실패, 토큰, 추정 사용액, 출처 요약, 모델·프롬프트·가격 버전과 생성 문항 ID를 기록한다. API 키는 기록하지 않는다. 프로세스 종료/DB 저장 실패로 남은 예약을 자동 해제하거나 자동 재시도하지 않는다.

현재는 작은 동기 요청을 사용한다. 1,000개 자동 생성, Batch API, 관리자 웹 UI, 자동 사실 검증은 포함하지 않는다. 소량 결과의 품질과 실제 토큰 사용량을 확인한 뒤 확장한다.
