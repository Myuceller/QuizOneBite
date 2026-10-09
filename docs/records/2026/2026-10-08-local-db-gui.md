# 로컬 DB 관리 GUI 추가 — 2026-10-08

## 목적과 적용 환경

CLI 대신 브라우저에서 문제·보기·정답·해설을 확인하도록 로컬 Docker에 [Adminer 공식 이미지](https://hub.docker.com/_/adminer/) `6.1.1-standalone`을 추가했다. Render 배포 구성에는 반영하지 않았다.

## 변경 사항

- `compose.yaml`의 `tools` 프로필에 `adminer` 서비스를 추가하고 `127.0.0.1:8080`에 연결했다.
- Docker 내부 DB 주소는 `db`이며 기존 PostgreSQL 계정으로 로그인한다. DB 비밀번호를 GUI 설정 파일이나 URL에 넣지 않는다.
- DB 준비 이후 GUI가 시작되며 HTTP 상태 검사와 `unless-stopped` 재시작 정책을 적용했다. DB에도 같은 재시작 정책을 적용했다.
- `npm run db:gui`는 DB와 GUI를 실행하고 `npm run db:gui:stop`은 GUI만 중지한다.
- `npm run docker:up` / `docker:down`에 `tools` 프로필을 포함했다. CI의 기존 `app` 프로필은 GUI를 켜지 않는다.
- `.dockerignore`에 `.local`을 추가해 비공개 문제 원본과 DB 스냅샷이 Docker 빌드 컨텍스트에 들어가지 않도록 했다.
- [로그인·문제 조회 안내](../../operations/inspect-db.md)를 GUI 중심으로 갱신했다.

## 검증 결과

Compose 설정 검사 통과 후 실제 이미지를 받아 DB·GUI를 실행했다. 두 컨테이너는 healthy이며 Adminer 포트는 로컬 루프백에만 바인딩되어 있다.

브라우저 조작 없이 HTTP 클라이언트로 로그인 폼의 토큰과 세션을 받아 실제 DB 로그인 및 `quizquiz.bank_questions` 조회를 확인했다. 문제·보기·정답 인덱스·해설 열이 응답에 포함되어 있다. 비밀번호는 환경 파일에서 메모리로만 읽었고 로그에 출력하지 않았다.

DB 재생성 후에도 게시 264개·중지 25개가 유지된다. 앱의 DB 준비 상태 API도 HTTP 200이다. 문제 생성 API 호출이나 문제 수정은 없었다.

## 사용

Docker Desktop에서 `quizquiz` 컨테이너 그룹을 시작하고 <http://127.0.0.1:8080>에 접속한다. 컨테이너를 삭제했다면 `npm run db:gui`로 다시 생성한다. 세부 로그인 값과 문제 테이블 바로가기는 조회 안내를 따른다.
