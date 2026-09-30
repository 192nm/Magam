# Magam Beauty

**영수증을 올리고, 확인하고, 공유하면 끝.** 미용실의 하루 마감을 돕는 모바일 중심 웹 서비스입니다.

## 선택한 기술

| 영역        | 적용 기술                                               | 선택 이유                                                                                             |
| ----------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 프론트엔드  | React 19 + TypeScript + Vite 8                          | 사진 업로드와 결과 편집 중심의 가벼운 SPA. 사용자의 React 경험을 활용하고 빠르게 개발할 수 있습니다.  |
| 백엔드      | Java 17 + Spring Boot 4.1                               | 익숙한 Java를 활용하며 업로드 검증, 외부 API 호출, 예외 처리와 향후 인증·DB 확장을 분리하기 좋습니다. |
| 빌드        | npm + Gradle Wrapper 9.1                                | Gradle을 별도 설치할 필요 없이 재현 가능한 빌드를 제공합니다.                                         |
| 영수증 인식 | OpenAI Responses API + 이미지 입력 + Structured Outputs | 한국어 영수증에서 이름, 시술, 금액을 정해진 JSON 구조로 추출합니다.                                   |
| 기록 보관   | 브라우저 localStorage                                   | 별도 가입 없이 바로 쓰는 초기 버전입니다. 서버 DB와 기기 간 동기화는 포함하지 않습니다.               |
| 검증        | JUnit / Spring Boot 통합 테스트, Vitest, Playwright     | 금액 계산, 인식 결과 검증, 실제 API, 모바일·데스크톱 사용자 흐름을 확인합니다.                        |

이 서비스는 검색 노출보다 모바일 입력·수정 흐름이 중요하므로 React + Vite로 구성했습니다. 서버 렌더링을 위한 별도 Node.js 서버 없이 Spring Boot가 API를 담당하고, 배포 시 React 정적 파일도 함께 제공합니다. 추후 매장 계정과 서버 기록 저장이 필요하면 Spring Security + JPA + PostgreSQL을 추가할 수 있습니다.

공식 문서: [React의 Vite 기반 앱 구성](https://react.dev/learn/build-a-react-app-from-scratch), [Spring Boot 요구 사항](https://docs.spring.io/spring-boot/system-requirements.html), [OpenAI 이미지 입력](https://developers.openai.com/api/docs/guides/images-vision), [OpenAI 구조화된 출력](https://developers.openai.com/api/docs/guides/structured-outputs).

## 제공 기능

- 모바일 사진 선택·카메라 촬영, 드래그 앤 드롭, 한 번에 최대 5장 업로드
- JPG / PNG / WEBP 지원, 사진당 10MB 제한, 마감당 최대 30장·200건
- 전송 전 이미지 방향 반영·크기 축소·EXIF 제거, 서버에서 실제 이미지 형식 검증
- 고객 이름 / 디자이너 이름 / 둘 다 추출하는 설정
- 이름·시술명·금액 직접 수정, 수동 내역 추가, 원본 사진 미리보기
- 금액 자동 합산, 불확실한 이름·금액은 빈칸으로 남기고 사용자 확인 요구
- 마감 문구 미리보기, 텍스트 복사, 기기 공유, `.txt` 다운로드
- 매장 이름·문구 형식 설정, 브라우저에 최근 100개 마감 기록 보관·검색·삭제
- API 키 없이 샘플 체험과 수동 마감 작성 가능. 샘플은 문구에도 `샘플`로 표시

## 로컬 실행

필요한 환경: **Node.js 22.12 이상, JDK 17 이상**. 현재 프로젝트는 Java 17로 컴파일합니다.

프로젝트 루트에서 실행합니다. Windows PowerShell은 실행 정책 충돌을 피하도록 `npm.cmd`를 사용합니다. macOS/Linux에서는 `npm`으로 바꾸세요.

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

터미널 1 — Spring Boot API:

```powershell
npm.cmd run dev:api
```

터미널 2 — React:

```powershell
npm.cmd run dev
```

- 서비스: **http://localhost:5173**
- API 상태: http://localhost:8080/api/health
- Vite가 `/api` 요청을 Spring Boot의 8080 포트로 전달합니다.
- 두 서버를 실행한 PC와 휴대폰을 같은 네트워크에 연결한 뒤, Vite 터미널에 표시되는 `Network` 주소로 접속하면 모바일에서 확인할 수 있습니다. 네트워크와 방화벽 설정에 따라 접근이 제한될 수 있습니다.
- 기기 공유·클립보드 최신 API는 HTTPS 또는 localhost 환경에서 동작합니다. 일반 HTTP에서는 복사 대체 기능을 사용하며, 미지원 브라우저에서는 텍스트를 직접 선택하거나 다운로드할 수 있습니다.
- macOS/Linux에서 Wrapper 실행 권한이 없으면 `chmod +x backend/gradlew`를 한 번 실행하세요.

## 영수증 자동 인식 연결

루트 `.env`에 **서버에서만 사용할 키**를 설정하고 API 서버를 재시작하세요. 값을 따옴표로 감싸지 않습니다.

```dotenv
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4.1-mini
SERVER_PORT=8080
APP_ACCESS_KEY=
SPRING_PROFILES_ACTIVE=local
```

실제 인식에는 사용 가능한 OpenAI API 키와 해당 모델 사용 권한·잔액이 필요합니다. 키가 없으면 서버는 자동 인식이 연결되지 않았다고 명시하며, 업로드에 가짜 인식 결과를 반환하지 않습니다. `OPENAI_MODEL`은 이미지 입력·Responses API·Structured Outputs를 지원하는 모델로 변경할 수 있습니다.

OpenAI 키는 브라우저나 `VITE_` 환경 변수에 넣지 마세요. `.env`는 Git과 Docker 빌드 컨텍스트에서 제외되어 있습니다. `APP_ACCESS_KEY`를 설정하면 프론트엔드 **설정 → 서비스 접속 키**에 같은 값을 입력해야 사진을 인식할 수 있습니다. 이 키는 브라우저 탭의 sessionStorage에만 보관됩니다.

## 사용 순서

1. **설정**에서 매장 이름과 영수증에서 정리할 이름을 선택합니다.
2. **오늘의 마감**에서 영수증 사진을 올리거나 직접 내역을 추가합니다.
3. 사진을 눌러 원본을 확인하고, 이름과 시술금액을 수정한 뒤 **확인 / 전체 확인**을 누릅니다.
4. 마감 날짜를 확인하고 **마감 문구 만들기**를 누릅니다.
5. **텍스트 복사**, **공유**, **다운로드**를 사용합니다. 다시 보려면 **기록 저장**을 누릅니다.

예시 문구:

```text
[마감 헤어] 2026.09.30 마감

1. 김민지 / 디자인 커트 · 45,000원
2. 이서연 / 컬러 + 클리닉 · 120,000원

총 2건 · 165,000원
오늘도 수고하셨습니다.
```

## API

| 메서드 | 경로                    | 요청 / 응답                                                                  |
| ------ | ----------------------- | ---------------------------------------------------------------------------- |
| GET    | `/api/health`           | 서버 상태, 인식 연결 여부, 접속 키 필요 여부                                 |
| POST   | `/api/receipts/extract` | multipart `file`, `nameMode=customer\|stylist\|both` → `entries`, `warnings` |
| POST   | `/api/reports/preview`  | 날짜·매장·확인된 내역·형식 → `text`, `total`, `count`                        |

모든 POST에는 `X-Magam-Client: 1` 헤더가 필요합니다. 인식 API는 설정된 경우 `X-Access-Key` 헤더도 요구합니다. 서버는 CORS를 개방하지 않으며, 프론트엔드와 같은 출처 또는 개발 프록시를 통해 사용합니다.

인식 결과의 `amount: null`은 0원이 아니라 **읽지 못한 금액**입니다. 고객 이름도 알 수 없으면 빈 문자열이며, 원본에 없는 정보를 만들어 채우지 않습니다. 모든 인식 결과는 `needsReview: true`로 반환합니다. 마감 문구 API는 미확인 항목, 빈 이름, 누락된 금액, 음수·범위를 초과한 금액을 거부합니다. 공유 문구의 총액은 검증된 내역으로 서버에서 다시 계산합니다.

인식 요청은 서버 인스턴스 전체 기준 분당 20회, 동시 2회로 제한하며 외부 API 요청은 65초 후 종료합니다. 오류 메시지는 한국어로 반환하고 API 키나 외부 응답 원문을 노출하지 않습니다.

## 테스트와 빌드

```powershell
# 프론트엔드 타입 검사 + 프로덕션 빌드
npm.cmd run build

# 프론트엔드 금액·문구 테스트
npm.cmd test

# 백엔드 단위·HTTP 통합 테스트
.\backend\gradlew.bat -p backend test

# 브라우저 설치 후 모바일·데스크톱 E2E
npx.cmd playwright install chromium
npm.cmd run test:e2e

# 코드 형식 검사
npm.cmd run format:check
```

브라우저 테스트는 필요할 때 개발 서버를 시작합니다. 이미 설치된 Chromium 계열 브라우저를 사용하려면 경로를 지정할 수도 있습니다.

```powershell
$env:PLAYWRIGHT_BROWSER_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm.cmd run test:e2e
```

유료 OCR 호출은 테스트에서 모의 응답을 사용하며 실제 영수증 인식 정확도·계정 연결은 API 키를 설정한 뒤 별도 확인해야 합니다.

배포용 JAR 하나로 프론트엔드와 API를 함께 실행할 수 있습니다.

```powershell
npm.cmd run build
.\backend\gradlew.bat -p backend bootJar
java -jar backend/build/libs/magam-beauty.jar
```

빌드한 서비스는 **http://localhost:8080**에서 제공됩니다. React 수정 후에는 `npm run build`와 JAR 빌드를 다시 실행하세요.

Windows에서 IDE가 빌드 출력 폴더를 잡고 있어 `AccessDeniedException`이 발생하면, 실행 중인 백엔드를 종료하고 `-PmagamBuildDir=build-verify`를 붙여 별도 폴더에서 빌드할 수 있습니다. 이 경우 JAR는 `backend/build-verify/libs/magam-beauty.jar`에 생성됩니다. `npm run dev:api`는 IDE 출력과 분리된 `backend/build-dev`를 사용합니다.

Docker 구성도 포함되어 있습니다.

```powershell
docker build -t magam-beauty .
docker run --rm -p 8080:8080 --env-file .env -e SPRING_PROFILES_ACTIVE=prod magam-beauty
```

`prod` 프로필에서 유료 인식을 켜려면 `APP_ACCESS_KEY`도 설정해야 서버가 시작됩니다. 실제 공개 배포에는 HTTPS를 연결하세요. 현재 접속 키는 단일 매장용 간단한 보호 장치이며 계정·권한 관리나 다중 매장 격리는 구현하지 않았습니다.

## 데이터 보관과 현재 범위

- 원본 사진은 현재 페이지의 미리보기와 인식에 사용되며 앱 서버에 영구 저장하지 않습니다. 프론트엔드에서 정규화한 사진을 OpenAI에 전송하므로 해당 서비스의 데이터 처리 정책도 적용됩니다. API 요청에는 `store: false`를 지정합니다.
- 작성 중인 내역, 매장 설정, 마감 기록은 **현재 기기의 현재 브라우저**에 저장됩니다. 브라우저 데이터 삭제·시크릿 모드 종료 시 사라질 수 있고 기기 사이에 자동 동기화되지 않습니다.
- 사진 미리보기는 새로고침 시 지워집니다. 추출한 내역은 유지됩니다. 공용 기기에서는 새 마감과 기록 삭제를 사용하세요.
- 금액은 원 단위 정수입니다. 음수 환불·여러 고객에게 나누어 적용된 할인은 자동 확정하지 않습니다. 사용자 검토가 필요합니다.
- HEIC / PDF는 현재 지원하지 않습니다. JPG 또는 PNG로 변환해서 업로드하세요.
- 카카오톡으로 자동 발송하지 않습니다. 기기의 공유 기능 또는 복사·붙여넣기를 사용합니다.
- 회원가입, 서버 DB, 직원 권한, 매장별 동기화, 결제 수단별 정산, 정산 확정 잠금은 초기 범위에 포함하지 않았습니다.

## 디렉터리

```text
src/
  App.tsx                    # 마감 작성 / 기록 / 설정 화면
  components/Modal.tsx        # 키보드 접근 가능한 대화상자
  lib/api.ts                 # 업로드 처리 / API / 복사·다운로드
  lib/domain.ts              # 금액·문구 생성 / 브라우저 저장 검증
  lib/types.ts               # 프론트엔드 데이터 타입
  styles.css                 # 모바일 우선 동작을 포함한 반응형 UI
backend/
  build.gradle               # Spring Boot / Java 빌드
  gradlew, gradlew.bat        # Gradle Wrapper
  src/main/java/com/magam/beauty/
    ApiController.java       # REST API
    ReceiptRecognitionService.java # OpenAI 인식 연동
    ReceiptImageValidator.java     # 실제 이미지 검증
    ReportService.java       # 마감 문구·금액 계산
    ApiProtectionFilter.java # 접속 키 / 요청 제한
    ApiExceptionHandler.java # 통일된 오류 응답
  src/main/resources/        # 서버 설정 / 인식 JSON 스키마
  src/test/                  # 백엔드 검증
tests/                       # Vitest / Playwright
scripts/backend.mjs          # OS별 백엔드 실행
.env.example                 # 환경 변수 예제
Dockerfile                   # 프론트 빌드 + JAR 배포
```
