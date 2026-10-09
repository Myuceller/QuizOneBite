# 문서 안내

현재 구조와 운영 방법은 주제별 가이드에서 확인하고, 특정 날짜에 수행한 생성·검수·배포 결과는 작업 기록에서 확인한다. 아래 경로는 `docs/` 기준이다.

## 폴더별 문서

| 폴더 | 역할 | 문서 |
| --- | --- | --- |
| `architecture/` | 앱 구조·구현 경계·인증 | [전체 구조](architecture/overview.md), [가입·인증·세션](architecture/auth.md) |
| `quiz/` | 문제 은행·분류·출제 기준·사용자 제안 | [문제 은행](quiz/bank.md), [대분류·소분류](quiz/taxonomy.md), [출제 품질 기준](quiz/quality.md), [사용자 문제 제출](quiz/community-submissions.md) |
| `ai/` | AI 연결 계약·운영자 생성·비용 제한 | [AI 연결](ai/integration.md), [생성 운영 가이드](ai/generation.md) |
| `operations/` | DB·Docker·호스팅 운영 | [PostgreSQL](operations/database.md), [DB 직접 조회](operations/inspect-db.md), [Docker 실행·배포](operations/docker.md), [Render](operations/render.md) |
| `records/연도/` | 날짜별 작업 결과·검증·비용·적용 환경 | [작업 기록 목록](records/README.md) |
| `examples/` | 생성에 사용하는 공개 참고 자료 JSON | [지구·기후 예시](examples/general-knowledge-earth.json), [자료 사용법](ai/generation.md) |

## 문제 내용은 어디에 있는가?

실제 출제 데이터의 기준은 PostgreSQL의 `quizquiz.bank_questions`다. 문서는 운영 방식과 검수 결과를 설명한다. 전체 문제를 조회·내보내는 명령은 [운영자 도구](quiz/bank.md#운영자-도구)를 따른다.

정답을 포함한 로컬 초안·스냅샷은 저장소 루트의 `.local/quiz-generation/`에 보관하며 Git에서 제외한다. `examples/`는 공개 참고 자료용이다. 비밀값, DB 덤프, 전체 문제의 정답 파일은 이 폴더에 넣지 않는다.

## 앞으로 문서 추가하기

1. 현재 정책·구조·명령이 달라지면 해당 주제의 기존 가이드를 갱신한다. 같은 내용을 여러 문서에 복사하지 않고 원문에 링크한다.
2. 특정 작업의 실행 결과는 `records/YYYY/YYYY-MM-DD-짧은-주제.md`로 작성한다. 파일명 주제는 영문 소문자와 하이픈을 사용한다. 같은 날 같은 작업을 이어 했다면 기존 기록에 보완한다.
3. 작업 기록에는 목적, 적용 환경(로컬·테스트·운영), 변경 수량, 검증 결과, 비용 발생 여부, 남은 작업을 적는다. 과거 결과를 현재 상태처럼 표현하지 않는다.
4. 새 가이드는 이 목록에, 새 작업 기록은 [기록 목록](records/README.md)에 추가한다. 가이드에 이미 남아 있는 과거 이력은 날짜가 있는 기존 절을 보존하고, 새 기록부터 별도 파일로 작성한다.
5. 문서 링크는 해당 파일 기준 상대 경로로 작성한다. 파일을 옮길 때 README, `AGENTS.md`, 프로젝트 스킬과 명령 예제의 경로도 확인한다.

문서만 바꾼 경우에는 링크 대상, 기존 경로 참조, `git diff --check`를 확인한다.
