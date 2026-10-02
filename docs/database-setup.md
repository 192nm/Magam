# Supabase DB 연결하기

이번 단계는 **한 매장의 마감 기록 DB 저장**입니다. 로그인과 회원별 데이터 분리는 다음 단계입니다. 현재는 `APP_ACCESS_KEY`를 아는 사람이 같은 DB 기록을 조회·저장·삭제합니다. 불특정 사용자에게 공개하는 서비스로 배포하기 전에는 로그인과 매장별 접근 제어를 구현해야 합니다.

## 1. 무료 프로젝트 생성

1. [Supabase 대시보드](https://supabase.com/dashboard)에 로그인합니다.
2. 무료 플랜 조직을 선택하고 **New project**를 누릅니다.
3. 이름은 `magam-beauty`, 지역은 목록에서 Seoul이 제공되면 Seoul을 선택합니다.
4. DB 비밀번호를 만들어 비밀번호 관리자에 보관하고 프로젝트를 생성합니다.

API 키(anon, publishable, service_role)가 아니라 **DB 비밀번호**가 필요합니다. 이번 단계에서는 Supabase Auth나 프론트엔드용 Supabase SDK를 설정하지 않습니다.

## 2. 접속 정보 입력

프로젝트 상단 **Connect → Session pooler**에서 Host, Port, Database, User를 확인합니다. IPv4에서도 접속 가능한 Session pooler의 **5432 포트**를 사용합니다. 호스트는 프로젝트마다 다르므로 화면에 있는 값을 복사하세요.

프로젝트 루트 `.env`의 아래 항목을 채웁니다. 기존 OpenAI 설정은 유지합니다.

```dotenv
DB_ENABLED=true
DB_URL=jdbc:postgresql://화면의_HOST:5432/postgres?sslmode=require&connectTimeout=10&socketTimeout=30
DB_USERNAME=화면의_USER
DB_PASSWORD=프로젝트_생성시_정한_DB_비밀번호
APP_ACCESS_KEY=본인이_정한_충분히_긴_무작위_접속키
```

- USER는 일반적으로 `postgres.프로젝트ID` 형태입니다. 화면의 값을 그대로 사용하세요.
- `DB_URL`은 `jdbc:postgresql://`로 시작해야 하며 비밀번호를 넣지 않습니다.
- `DB_PASSWORD`는 별도 속성이므로 URL 인코딩하지 않습니다. 따옴표도 붙이지 않습니다.
- 이 프로젝트의 `.env`는 Java properties 형식입니다. 비밀번호에 역슬래시(`\`)가 있으면 `\\`로 입력해야 합니다. 생성할 때 영문·숫자 위주의 충분히 긴 무작위 비밀번호를 쓰면 입력이 간단합니다.
- `APP_ACCESS_KEY`가 이미 있으면 기존 값을 유지합니다. DB 사용 시 빈 값은 허용하지 않습니다.
- DB 항목을 모두 채우기 전에는 `DB_ENABLED=false`를 유지하세요. 잘못된 설정으로 켜면 서버 시작이 실패합니다.
- `sslmode=require`는 전송 암호화를 요구합니다. 운영 전에는 Supabase에서 제공하는 CA 설정과 `verify-full` 적용을 검토하세요.

`.env`는 Git에서 제외됩니다. 비밀번호를 채팅이나 `.env.example`에 넣지 마세요. DB 비밀번호와 접속 키는 서로 다른 값으로 정하세요.

## 3. 서버 재시작

실행 중인 백엔드를 종료하고 프로젝트 루트에서 실행합니다.

```powershell
npm.cmd run dev:api
```

프론트엔드가 꺼져 있으면 다른 터미널에서 실행합니다.

```powershell
npm.cmd run dev
```

서버가 DB에 연결하면 Flyway가 `magam` 스키마와 테이블을 자동 생성합니다. SQL을 수동으로 실행할 필요가 없습니다.

| 테이블                        | 내용                                             |
| ----------------------------- | ------------------------------------------------ |
| `magam.closing_reports`       | 마감일, 매장명, 합계, 건수, 마감 문구, 생성 시각 |
| `magam.closing_items`         | 이름, 시술 내용, 금액, 항목 순서                 |
| `magam.flyway_schema_history` | 자동 적용한 DB 구조 변경 이력                    |

Supabase Table Editor에서 스키마를 `magam`으로 선택하면 확인할 수 있습니다. `magam`은 Java 서버 전용이며 Data API의 exposed schemas에 추가하지 마세요. 영수증 사진은 DB에 저장하지 않습니다.

## 4. 화면에서 확인

1. `http://localhost:5173`을 새로고침합니다.
2. **설정 → 서비스 접속 키**에 `.env`의 `APP_ACCESS_KEY` 값을 입력합니다.
3. 설정의 데이터 관리에 **DB 연결 완료**가 표시되는지 확인합니다.
4. 샘플 내역으로 문구를 만들고 **기록 저장**을 누릅니다.
5. **마감 기록 → DB 기록**에서 확인합니다. 새로고침과 백엔드 재시작 후에도 남아 있어야 합니다.
6. Supabase의 두 테이블에도 샘플 데이터가 있는지 확인한 뒤 앱에서 테스트 기록을 삭제합니다.

기존 기록은 **이 브라우저 기록**에서 계속 볼 수 있습니다. 기존 기록에는 원래 시술별 정보가 없을 수 있어 자동 이관하지 않습니다. DB 연결 후 새 기록만 DB에 저장합니다. DB 오류 시 브라우저 저장으로 자동 전환하지 않고 실패를 표시합니다. 문구를 연 상태에서 저장을 재시도하면 동일 ID를 사용하여 중복 저장을 방지합니다.

기록 목록은 100개씩 불러옵니다. 이전 기록 더 보기를 누르면 추가 조회합니다. 검색은 불러온 목록을 대상으로 합니다. 브라우저 기록 전체 삭제는 DB 기록에 영향을 주지 않습니다.

## 연결이 안 될 때

- 서버 시작 실패: `DB_URL`, USER, 비밀번호, 프로젝트 활성 상태, 5432 포트 접근 가능 여부를 확인하세요. 회사 네트워크가 DB 포트를 차단할 수 있습니다.
- 접속 키 오류: DB 비밀번호가 아니라 `APP_ACCESS_KEY`를 앱 설정에 입력해야 합니다.
- 연결 대기: `.env`의 `DB_ENABLED=true` 설정 후 백엔드를 재시작했는지 확인하세요.
- DB 연결 오류: Supabase 프로젝트가 일시 정지되어 있지 않은지 확인하고 활성화 후 재시도하세요.
- `/api/health`의 `databaseEnabled`와 `databaseAvailable`은 DB 기능 설정과 실제 연결 여부를 각각 나타냅니다. 비밀번호나 호스트를 반환하지 않습니다.

무료 플랜은 사용량 제한과 비활성 프로젝트 일시 정지 조건이 있으므로 실제 매장 데이터 운영 전에는 백업 계획을 정하세요. 현재 앱에는 자동 백업 기능이 없습니다.

공식 문서: [접속 방식과 Session pooler](https://supabase.com/docs/guides/database/connecting-to-postgres), [무료 플랜 및 과금](https://supabase.com/docs/guides/platform/billing-on-supabase).
