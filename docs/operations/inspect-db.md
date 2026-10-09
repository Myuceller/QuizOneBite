# 로컬 DB에서 문제 확인하기

이 안내는 Docker Compose의 **로컬 PostgreSQL**을 조회하는 방법이다. 로컬에서 추가한 문제는 배포 서버 DB로 자동 복사되지 않는다.

## 브라우저 관리 화면 — Adminer

로컬 Docker에 Adminer를 추가했다. Docker Desktop의 **Containers → quizquiz → 시작(▶)**으로 `db`와 `adminer`가 실행되면 [문제 테이블 열기](http://127.0.0.1:8080/?pgsql=db&username=quizquiz&db=quizquiz&ns=quizquiz&select=bank_questions)를 누른다.

로그인 화면에서는 다음 값을 사용한다. 위 링크로 열면 PostgreSQL 연결 정보가 미리 선택된다.

| 항목 | 값 |
| --- | --- |
| 시스템 | PostgreSQL |
| 서버 | `db` |
| 사용자 | `quizquiz` |
| 비밀번호 | 저장소 루트 `.env.local`의 `POSTGRES_PASSWORD` 값 |
| 데이터베이스 | `quizquiz` |

로그인 후 `quizquiz` 스키마의 `bank_questions`에서 **데이터 선택 / Select data**를 누르면 문제를 표로 볼 수 있다. `question`은 문제, `options`는 보기, `explanation`은 해설, `status`는 게시 상태다. 검색 조건과 정렬, 페이지 이동도 GUI에서 할 수 있다. `correct_answer_index`는 0부터 시작하므로 0이면 첫 번째 보기가 정답이다.

Adminer는 Docker 내부에서 DB에 연결하므로 서버가 `db`다. PC에 설치한 다른 DB 프로그램에서 사용하는 `127.0.0.1:5433`과 구별한다. Adminer는 `127.0.0.1:8080`에만 열고 DB 비밀번호로 로그인한다. Render에는 추가하지 않는다.

컨테이너가 아직 없거나 삭제됐다면 최초에 한 번 실행한다.

```sh
npm run db:gui
```

이 명령은 DB와 관리 화면만 실행한다. 앱까지 켜는 `npm run docker:up`에도 관리 화면을 포함했다. Docker Desktop을 다시 시작하면 실행 중이던 DB와 Adminer는 자동 재시작하고, 직접 중지한 컨테이너는 시작 버튼을 눌러야 한다. `npm run docker:down`으로 컨테이너를 삭제했다면 위 명령으로 다시 만든다. 데이터 볼륨은 유지된다.

관리 화면만 끄려면 Docker Desktop에서 `adminer`를 중지하거나 `npm run db:gui:stop`을 실행한다.

이미지와 설정은 [Adminer 공식 Docker 이미지 안내](https://hub.docker.com/_/adminer/)를 기준으로 한다.

## 다른 DB 프로그램으로 접속

PostgreSQL을 지원하는 DB 프로그램에서 새 PostgreSQL 연결을 만들고 아래 값을 입력한다.

| 항목 | 로컬 값 |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `5433` |
| Database | `quizquiz` |
| User | `quizquiz` |
| Password | 프로젝트 루트 `.env.local`의 `POSTGRES_PASSWORD` 값 |
| SSL | 로컬 Compose 연결에서는 사용하지 않음 |

접속 후 **Schemas → quizquiz → Tables → bank_questions**를 연다. 비밀번호는 문서나 채팅에 복사하지 않는다. Docker DB가 꺼져 있다면 저장소 루트에서 `npm run db:up`으로 시작한다.

## 터미널에서 접속

저장소 루트에서 다음 명령을 실행한다. 컨테이너 안의 `psql`을 쓰므로 PC에 PostgreSQL 클라이언트를 별도로 설치할 필요가 없다.

```sh
docker compose --env-file .env.local exec db psql -U quizquiz -d quizquiz
```

`psql`에서 `\x auto`를 입력하면 긴 행을 읽기 쉽게 표시하고, `\q`로 종료한다. 조회하는 동안 실수로 값을 수정하지 않으려면 SQL 실행 전에 `BEGIN READ ONLY;`를 입력하고 마칠 때 `ROLLBACK;`을 입력한다.

## 문제·보기·정답·해설 조회

```sql
SELECT
  id,
  provenance->'taxonomy'->>'major' AS 대분류,
  provenance->'taxonomy'->>'minor' AS 소분류,
  difficulty AS 난이도,
  status AS 상태,
  question AS 문제,
  options AS 보기,
  correct_answer_index + 1 AS 정답번호,
  options[correct_answer_index + 1] AS 정답,
  explanation AS 해설,
  sources AS 출처
FROM quizquiz.bank_questions
ORDER BY created_at DESC, id
LIMIT 50;
```

`LIMIT 50`을 제거하면 전체 문제를 조회한다. 게시 중인 문제만 보려면 `ORDER BY` 앞에 `WHERE status = 'published'`를 추가한다. 정답 인덱스는 0부터, PostgreSQL 배열의 위치는 1부터 시작하므로 위 쿼리는 1을 더해 읽는다. 앱은 보기 순서를 다시 섞기 때문에 DB의 정답 번호와 플레이 화면 번호는 다를 수 있다.

| 상태 | 뜻 |
| --- | --- |
| `draft` | 게시 전 초안 |
| `published` | 새 플레이에 출제 가능 |
| `paused` | 검토 등을 위해 출제 중지 |
| `retired` | 사용 종료한 버전 |

## 소분류·난이도별 게시 수량

```sql
SELECT
  COALESCE(provenance->'taxonomy'->>'major', '미분류') AS 대분류,
  COALESCE(provenance->'taxonomy'->>'minor', '미분류') AS 소분류,
  count(*) FILTER (WHERE difficulty = 'easy') AS 쉬움,
  count(*) FILTER (WHERE difficulty = 'medium') AS 보통,
  count(*) FILTER (WHERE difficulty = 'hard') AS 어려움,
  count(*) AS 합계
FROM quizquiz.bank_questions
WHERE status = 'published'
GROUP BY 1, 2
ORDER BY 1, 2;
```

이 집계는 DB에 있는 게시 문항의 분류를 기준으로 한다. 문항이 전혀 없는 소분류는 행이 나타나지 않으므로, 전체 분류의 누락 여부는 [49개 소분류 목록](../quiz/taxonomy.md)과 비교한다. 소분류 합계 5개와 난이도마다 5개는 서로 다른 기준이다.

## 관련 테이블과 편집

- `quizquiz.bank_questions`: 문제 원본·정답·출처·검수 상태.
- `quizquiz.play_sessions`, `quizquiz.play_items`: 사용자 풀이와 출제 당시 문항 스냅샷.
- `quizquiz.question_ratings`, `quizquiz.question_reports`: 평가와 신고.

게시 문제를 직접 덮어쓰면 기존 풀이와 문제 원본의 내용이 달라질 수 있다. 내용 수정·게시에는 [문제 은행 운영자 도구](../quiz/bank.md#운영자-도구)를 사용한다. 정답이 있는 조회 결과나 내보낸 파일은 `.local/quiz-generation/`에 보관하고 Git에 올리지 않는다.
