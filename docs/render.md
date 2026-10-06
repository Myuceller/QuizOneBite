# Render 배포 시작하기

호스팅은 Render Web Service(Docker)와 Render Postgres로 결정했다. staging 앱·DB가 생성되어 배포되었다. 테스트 주소는 <https://quizonebite-staging.onrender.com>이다. 운영은 아직 생성하지 않았으며 별도 Blueprint를 사용한다.

## 환경 구성

| 환경 | 코드 | 앱 | DB |
| --- | --- | --- | --- |
| local | 작업 브랜치 | 개발 서버 또는 Docker | 로컬 Compose PostgreSQL 18 |
| staging | `develop` | `quizonebite-staging` | `quizonebite-staging-db` |
| production | `main` | `quizonebite-production` | `quizonebite-production-db` |

로컬 계정·문제 데이터는 원격 DB로 복사하지 않는다. 두 원격 DB와 인증 비밀값은 각각 생성된다. 앱과 DB는 같은 Singapore 리전에 둔다. DB 외부 접속은 `ipAllowList: []`로 막고 앱에서는 내부 접속 주소를 사용한다. 같은 워크스페이스의 사설망을 환경별로 차단하는 설정과는 별개다.

## 1. 저장소에 설정 반영

배포 설정 변경을 PR로 `develop`에 병합하고 CI 세 검사를 확인한다. Render가 GitHub의 파일을 읽으므로 로컬에만 있는 설정으로는 시작할 수 없다.

- `render.yaml`: Free 테스트 앱 + Free PostgreSQL(1 GB, 생성 후 30일 만료).
- `render.production.yaml`: 이후 운영 앱 512 MB + PostgreSQL 1 GB / 디스크 5 GB.
- `Dockerfile`: 앱 이미지에 DB 마이그레이션 실행 파일과 SQL을 포함한다.

테스트 Blueprint는 **무료 체험 구성**, 운영 Blueprint는 **유료 구성**이다. 파일을 GitHub에 올리는 것만으로 리소스가 생성되지는 않는다. 테스트 생성 화면에서는 앱과 DB가 모두 Free이고 예상 컴퓨트 요금이 $0인지 확인한다.

무료 웹 서버는 15분간 접속이 없으면 잠들고 다음 접속 시 약 1분의 재시작 시간이 생긴다. 워크스페이스당 월 750시간을 공유한다. 무료 DB는 워크스페이스당 1개, 생성 후 30일에 만료되고 이후 14일 유예 기간이 지나면 데이터와 함께 삭제된다. 관리형 백업도 제공하지 않으므로 테스트 데이터만 사용하고 만료 전에 장기 DB 구성을 결정한다. 트래픽·빌드 무료 한도도 별도이며 결제 수단이 등록되어 있으면 초과 비용이 생길 수 있다. [무료 플랜 제한](https://render.com/docs/free)

## 2. 테스트 환경 생성

1. [Render Dashboard](https://dashboard.render.com/)에 가입·로그인하고 GitHub를 연결한다. 저장소 접근 범위는 `Myuceller/QuizOneBite`로 선택할 수 있다.
2. **New → Blueprint**에서 `Myuceller/QuizOneBite`를 연결한다.
3. Blueprint 이름은 `quizonebite-staging`, 브랜치는 **`develop`**, Blueprint Path는 **`render.yaml`**로 지정한다.
4. 생성 대상이 테스트 웹 서비스 1개와 테스트 DB 1개인지, 지역·사양·예상 요금이 맞는지 확인한다.
5. **Deploy Blueprint**를 누르면 무료 테스트 리소스 생성과 최초 배포가 시작된다.
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
  → 테스트: 컨테이너 시작 시 migrate 성공 후 exec node server.js
    운영: preDeployCommand에서 migrate 성공 후 node server.js
  → /api/health/ready 확인
  → HTTPS 주소로 접속
```

Render는 로컬 `compose.yaml`을 실행하지 않는다. 앱은 Dockerfile의 마지막 `runner` 단계로 만들고 DB는 별도 관리형 서비스로 생성한다. 무료 웹 서비스는 pre-deploy 명령을 지원하지 않아 테스트 환경에서는 `dockerCommand: /bin/sh /app/scripts/start-render.sh`로 마이그레이션 성공 후 서버를 시작한다. 시작 명령의 인용부호 해석에 의존하지 않도록 여러 명령은 별도 스크립트에 둔다. 재시작할 때도 실행되지만 기존 SQL의 체크섬을 확인하고 새 SQL만 트랜잭션으로 적용한다. 마이그레이션 실패 시 서버는 시작하지 않는다. 운영 환경은 유료 pre-deploy 명령을 유지한다. 샘플 시드는 배포 시 자동 실행하지 않는다.

기존 배포가 `/bin/sh: node scripts/db.mjs migrate && exec node server.js: not found` 및 종료 코드 127로 실패했다면, 수정 커밋 반영 후 Blueprint에서 **Manual sync**를 실행해 Docker Command도 갱신한다. 코드만 새로 배포하면 기존 서비스의 시작 명령이 남아 있을 수 있다. 서비스 Settings의 Docker Command가 `/bin/sh /app/scripts/start-render.sh`인지 확인한 후 배포한다.

서비스가 Live가 되면 아래 흐름을 확인한다.

- `/api/health/ready`가 HTTP 200인지 확인.
- 가입 → 환영 화면 → 샘플 문제 생성 → 내 문제 모음 → 로그아웃 → 재로그인.
- 재배포 후에도 계정과 저장된 문제가 유지되는지 확인.

staging도 외부에서 접속할 수 있는 HTTPS 웹사이트다. 계정 기능과 문제 은행 기반 풀이·채점·평가를 제공한다. 유료 Astra 호출도 공개 배포에서 차단된 상태다.

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
