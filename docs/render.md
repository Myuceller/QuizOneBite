# Render 배포 시작하기

호스팅은 Render Web Service(Docker)와 Render Postgres로 결정했다. 이 문서는 배포 설정과 진행 순서이며 실제 Render 리소스 생성·원격 DB 연결은 아직 수행하지 않았다. 먼저 staging만 만들고, 운영은 별도 Blueprint로 생성한다.

## 환경 구성

| 환경 | 코드 | 앱 | DB |
| --- | --- | --- | --- |
| local | 작업 브랜치 | 개발 서버 또는 Docker | 로컬 Compose PostgreSQL 18 |
| staging | `develop` | `quizonebite-staging` | `quizonebite-staging-db` |
| production | `main` | `quizonebite-production` | `quizonebite-production-db` |

로컬 계정·문제 데이터는 원격 DB로 복사하지 않는다. 두 원격 DB와 인증 비밀값은 각각 생성된다. 앱과 DB는 같은 Singapore 리전에 둔다. DB 외부 접속은 `ipAllowList: []`로 막고 앱에서는 내부 접속 주소를 사용한다. 같은 워크스페이스의 사설망을 환경별로 차단하는 설정과는 별개다.

## 1. 저장소에 설정 반영

`chore/render-deployment`의 변경을 PR로 `develop`에 병합하고 CI 세 검사를 확인한다. Render가 GitHub의 파일을 읽으므로 로컬에만 있는 설정으로는 시작할 수 없다.

- `render.yaml`: 테스트 앱 512 MB + PostgreSQL 256 MB / 디스크 1 GB.
- `render.production.yaml`: 이후 운영 앱 512 MB + PostgreSQL 1 GB / 디스크 5 GB.
- `Dockerfile`: 앱 이미지에 DB 마이그레이션 실행 파일과 SQL을 포함한다.

두 Blueprint 모두 **유료 컴퓨트 설정**이다. 배포 전 실행하는 마이그레이션 명령은 Render 유료 웹 서비스에서 지원한다. 파일을 GitHub에 올리는 것만으로 리소스가 생성되지는 않는다. 최종 생성 화면의 앱·DB·저장 공간 요금 합계를 확인한다. 초기 사양은 시작점이며 메모리 사용량에 따라 조정한다.

## 2. 테스트 환경 생성

1. [Render Dashboard](https://dashboard.render.com/)에 가입·로그인하고 GitHub를 연결한다. 저장소 접근 범위는 `Myuceller/QuizOneBite`로 선택할 수 있다.
2. **New → Blueprint**에서 `Myuceller/QuizOneBite`를 연결한다.
3. Blueprint 이름은 `quizonebite-staging`, 브랜치는 **`develop`**, Blueprint Path는 **`render.yaml`**로 지정한다.
4. 생성 대상이 테스트 웹 서비스 1개와 테스트 DB 1개인지, 지역·사양·예상 요금이 맞는지 확인한다.
5. **Deploy Blueprint**를 누르면 유료 리소스 생성과 최초 배포가 시작된다.
6. Blueprint의 **Auto Sync는 끈다**. 이후 인프라 설정 변경은 CI 결과를 확인하고 수동 Sync한다. 앱의 일반 코드 변경은 아래 `checksPass` 정책으로 배포한다.

환경변수는 Blueprint가 연결한다. 로컬 `.env.local`을 업로드하지 않는다.

| 변수 | 값의 출처 |
| --- | --- |
| `DATABASE_URL` | 해당 환경 Render Postgres의 내부 연결 주소 |
| `BETTER_AUTH_SECRET` | Render가 환경별로 무작위 생성 |
| `BETTER_AUTH_URL` | 해당 웹 서비스의 `RENDER_EXTERNAL_URL`을 참조 |
| `AI_PROVIDER` | `mock` |

초기에는 Render가 발급한 HTTPS 주소를 사용하므로 도메인 구입은 필요 없다. 서비스 이름을 바꾸면 `fromService.name`과 DB 참조도 맞춘다. 추후 커스텀 도메인을 연결할 때에는 Blueprint의 `BETTER_AUTH_URL`을 해당 HTTPS origin의 `value`로 변경하고 재배포한다. Dashboard 값만 바꾸면 다음 Sync에서 Blueprint 설정이 다시 적용될 수 있다.

## 3. 배포 흐름과 확인

```text
Docker 이미지 빌드
  → preDeployCommand: node scripts/db.mjs migrate
  → node server.js
  → /api/health/ready 확인
  → HTTPS 주소로 접속
```

Render는 로컬 `compose.yaml`을 실행하지 않는다. 앱은 Dockerfile의 마지막 `runner` 단계로 만들고 DB는 별도 관리형 서비스로 생성한다. 마이그레이션은 같은 앱 이미지에서 실행하며 실패하면 새 버전 배포가 중단된다. 기존 SQL의 체크섬을 확인하고 새 SQL만 트랜잭션으로 적용한다. 샘플 시드는 배포 시 자동 실행하지 않는다.

서비스가 Live가 되면 아래 흐름을 확인한다.

- `/api/health/ready`가 HTTP 200인지 확인.
- 가입 → 환영 화면 → 샘플 문제 생성 → 내 문제 모음 → 로그아웃 → 재로그인.
- 재배포 후에도 계정과 저장된 문제가 유지되는지 확인.

staging도 외부에서 접속할 수 있는 HTTPS 웹사이트다. 현재는 샘플 문제 미리보기와 계정 기능을 제공하고 정답 제출·채점은 아직 없다. 유료 Astra 호출도 공개 배포에서 차단된 상태다.

## 4. CI와 운영 배포

- 테스트 앱: `develop`의 CI 결과를 확인한 뒤 자동 배포(`autoDeployTrigger: checksPass`). GitHub Checks 접근 권한이 연결되어 있어야 한다. 첫 배포 후 실제 `develop` 커밋으로 CI 대기→배포 흐름을 확인한다.
- 운영 앱: `main`의 자동 배포는 꺼져 있다(`off`). 출시 PR 병합 및 CI 성공 후 **Manual Deploy**로 배포한다.
- Blueprint Sync 자체는 서비스 설정 변경에 따른 배포를 일으킬 수 있다. CI 기반 앱 배포와 별도이므로 두 Blueprint의 Auto Sync를 끄고 검증 후 수동 Sync한다. Blueprint 최초 생성도 `off`와 무관하게 첫 배포를 시작한다.

운영을 만들 때에는 먼저 배포 변경을 `develop → main` 출시 PR로 반영한다. 별도 **New → Blueprint**에서 브랜치 **`main`**, 경로 **`render.production.yaml`**을 선택한다. 운영 DB와 비밀값이 새로 생성되며 테스트 DB를 공유하지 않는다. Render 프로젝트 화면에서도 두 서비스 묶음을 `staging` / `production` 환경으로 분류할 수 있다.

운영 생성 전 DB 백업 보존 기간과 복구 절차, 런타임·마이그레이션 DB 역할 분리, 이메일 인증·비밀번호 복구를 정리한다. 현재 Blueprint는 환경별로 Render가 생성한 하나의 DB 사용자를 앱과 마이그레이션에 사용한다. 이전 앱 이미지로 되돌려도 DB 마이그레이션은 자동으로 되돌아가지 않으므로 새 SQL은 이전 앱과 호환되게 추가한다.

## 공식 자료

- [Blueprint 생성 절차](https://render.com/docs/infrastructure-as-code)
- [Blueprint 설정 형식](https://render.com/docs/blueprint-spec)
- [배포 및 pre-deploy 명령](https://render.com/docs/deploys)
- [Render 기본 환경변수](https://render.com/docs/environment-variables)
- [PostgreSQL 연결](https://render.com/docs/postgresql-creating-connecting)
- [요금](https://render.com/pricing)
