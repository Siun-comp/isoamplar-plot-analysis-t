# IsoAmplar Plot Analysis 정밀 감사 보고서

## 문서 상태

- 감사일: 2026-07-11
- 대상: 현재 로컬 working tree 전체(Quick Paste 포함, 아직 커밋되지 않은 변경 포함)
- 감사 범위: 프로젝트 문서, 코드베이스, 데스크톱 브라우저 UI/미감, 실제 분석 작업 흐름
- 제외 범위: 모바일/태블릿 대응, 서버·클라우드 협업 기능, 임상 판독 계산
- 데이터 원칙: 실제 사용자 데이터는 사용하지 않았으며, 브라우저 검증에는 6곡선·60 cycle의 합성 증폭 데이터만 사용했다.
- 구현 변경: 이 감사에서는 제품 코드를 수정하지 않았다.
- 검증 기준점: Git base `9e77ad2` 위의 현재 dirty working tree. 자동 검증은 2026-07-11 KST에 같은 working tree에서 수행했다.

## 1. 한눈에 보는 결론

현재 앱은 **원본 fluorescence를 변형하지 않고 비교·시각화·그림 제작을 수행하는 개인/소규모 팀용 분석 도구**로서 기본 설계가 좋다. 데이터는 브라우저 안에서 처리되고, 그래프에는 평활화, baseline correction, normalization, log 변환, Ct/Cq 계산이 적용되지 않는다. 결측값은 선으로 임의 연결하지 않고 gap으로 남는다.

다만 현재 상태를 “안심하고 반복 사용하는 분석 기록 도구”라고 부르기에는 보완이 필요하다. 특히 아래 문제는 그래프 해석 또는 작업 연속성에 직접 영향을 줄 수 있다.

1. 잘못된 Fixed scale이 실제로는 Auto scale로 그려지고 export될 수 있다.
2. 긴 범례명이 이미지 export에서 잘려 서로 다른 조건이 같은 이름처럼 보일 수 있다.
3. Excel에서 `001`처럼 보이는 header가 앱에서 `1`로 바뀔 수 있다.
4. Excel 경고는 개수만 보이고 문제 cell과 처리 결과를 확인하기 어렵다.
5. 브라우저 새로고침 또는 창 닫기에는 Unsaved 보호가 없어 저장 이후의 분석 작업을 잃을 수 있다.
6. 문서상 허용된 Quick Paste 크기 안에서도 특정 표 모양은 브라우저 오류를 일으킬 수 있다.

이 감사에서 **P0(즉시 사용 중지 수준) 문제는 확인되지 않았다.** 원본 파일 자체를 앱이 수정하거나 fluorescence를 자동 변환하는 경로는 없다. 다만 P1 항목은 팀 단위의 정기 사용 전에 우선 보완하는 것이 맞다.

## 2. 위험도 읽는 법

| 등급 | 의미 | 업무 판단 |
|---|---|---|
| P0 | 일상 흐름에서 원본 결과가 자동 왜곡되거나 합리적 복구 수단 없이 손실되는 즉시 중단 수준 | 사용 중지 후 수정 |
| P1 | 특정 조건에서 잘못된 해석, 잘못된 산출물, 작업 손실이 가능한 높은 위험 | 팀 정기 사용 전 우선 수정 |
| P2 | 사용성·추적성·성능·유지보수에서 누적 위험이 있는 항목 | 다음 안정화 단계에 계획 반영 |
| P3 | 완성도, 문서, 개발 효율을 높이는 항목 | 핵심 안정화 후 정리 |

## 3. 감사 방법과 검증 증거

### 3.1 수행 범위

- `AGENTS.md`, `README.md`, `DEVELOPMENT_STATE.md`, `DECISIONS.md`, `CHANGELOG.md` 전체 검토
- `docs/01`부터 `docs/10`, 사용자 가이드 원문 검토
- 데이터 parser, normalized model, merge, Analysis XLSX, Zustand store, chart projection, ECharts option, export, selection, 모든 주요 UI와 CSS 검토
- 데이터 무결성, 프런트엔드 상태/보안, 과학 시각화, 데스크톱 UX 관점의 독립 전문가 병행 감사
- 1차 보고서 작성 후 별도 전문가 재감사

### 3.2 자동 검증

- `npm run test`: 19 files, 162 tests 통과
- `npm run build`: TypeScript 및 production Vite build 통과
- `npm run test:e2e`: Chromium 5 tests 통과
- `npm audit --omit=dev`: 알려진 취약점 0건
- 브라우저 console warning/error: 0건

자동 검증 로그는 위 기준점의 로컬 실행 결과다. OS file picker 자체는 in-app browser 자동화로 조작하지 못했으므로 원본 Excel/Analysis XLSX 재import는 source inspection, 기존 E2E, workbook readback, roundtrip test로 검증했다. 최종 Windows Excel rich clipboard 붙여넣기는 여전히 사용자 수동 검증 항목이다.

### 3.3 데스크톱 화면 검증

- 주 감사에서 6곡선 x 60 cycle 합성 data를 약 1280 x 720 및 1920 x 1080에서 직접 확인
- 독립 UX stress 감사에서 24곡선 x 40 cycle을 1280 x 800, 1366 x 768, 1440 x 900, 1920 x 1080에서 추가 확인
- Quick Paste → read-only preview → 현재 분석 추가 → 전체 선택 → 그래프 → Style → Legend → Export 순으로 실제 조작
- 1920 x 1080에서는 중심 그래프와 좌우 패널의 전체 구성이 안정적이었다.
- laptop-height desktop에서는 기능은 동작하지만 선택 곡선과 legend가 늘수록 sticky card가 viewport보다 커져 plot 문맥을 유지하지 못했다.

## 4. 현재 잘 설계된 부분

### 4.1 원본 fluorescence 보존

- 숫자값은 `x/y` point로 직접 전달된다.
- ECharts line series에 smoothing이나 sampling을 설정하지 않았다.
- `connectNulls: false`이므로 빈 값은 gap으로 표시된다.
- Box zoom은 데이터를 자르거나 변환하지 않고 X/Y scale만 변경한다.

근거: `src/chart/chartConfig.ts:121-139`, `src/data/parseExcel.ts:179-268`

### 4.2 브라우저 로컬 처리

- runtime network 전송, analytics, localStorage 자동 저장 코드를 찾지 못했다.
- Excel, paste, chart, export는 현재 브라우저 안에서 처리된다.
- 공개 GitHub Pages URL로 앱 코드는 접근 가능하지만, 입력 데이터가 자동 업로드되는 구조는 아니다.

여기서 개인/소규모 팀은 **사용 대상**을 뜻하며 access control을 뜻하지 않는다. 현재 GitHub Pages URL 자체는 공개 접근 가능하다. 사내 정책상 URL도 비공개여야 한다면 코드 변경보다 사내 static host 또는 접근제어가 있는 배포 위치를 선택해야 한다.

### 4.3 분석 연속성의 기본 구조

- Analysis XLSX는 선택하지 않은 곡선을 포함한 전체 dataset과 설정을 저장한다.
- hidden restore JSON의 chunk 누락, 중복, schema 오류를 차단한다.
- 탭 교체/저장/Quick Paste stale preview에 runtime instance와 revision 방어가 있다.

### 4.4 일관된 chart projection

- 선택, 순서, 스타일, 범례, scale을 하나의 projection에서 계산한다.
- preview와 PNG/JPEG export가 같은 ECharts option builder를 사용한다.
- plotted CSV는 공통 X축의 직사각형 구조일 때만 제공된다.

### 4.5 데스크톱 UI의 기본 품질

- 흰 배경, 희소한 major grid, 명확한 축, 안정적인 plot 높이로 그래프 자체는 정갈하다.
- 시약별/검체별 선택, 검색 전체 일괄 동작, 접기/펼치기, custom legend의 기본 흐름이 이해하기 쉽다.
- Quick Paste는 원본 수정 없이 preview와 warning 확인을 거쳐 import하는 구조가 좋다.
- 충분히 큰 desktop에서는 chart를 sticky로 유지해 긴 설정을 내리면서도 plot을 확인할 수 있다. laptop-height desktop의 한계는 U-P2-03에 별도 기록했다.

## 5. 코드베이스 감사: P1 우선 보완

아래 증거 수준은 `브라우저 재현`, `자동 test`, `code 경로 확인`으로 구분했다. 독립 전문가 probe는 주 감사와 별도로 수행된 브라우저/Node 재현을 뜻한다.

### C-P1-01. 잘못된 Fixed scale이 Auto scale로 그려질 수 있음 `[브라우저 재현 + code]`

**사용자 영향**  
화면은 Fixed mode로 표시되지만 min/max가 비어 있거나 `min >= max`이면 ECharts에 경계값이 전달되지 않는다. 이때 ECharts는 Auto로 그리며, 이미지 export도 계속 가능하다. 사용자는 “같은 축으로 비교했다”고 생각하지만 실제 산출물은 Auto scale일 수 있다.

Box zoom도 작은 fluorescence 값에서 Y를 소수점 3자리로 반올림한다. 예를 들어 `0.0001` 수준의 값은 `0 / 0`으로 기록될 수 있다.

**근거**

- `src/chart/chartScale.ts:50-68`
- `src/ui/ChartPanel.tsx:83-92`, `src/ui/ChartPanel.tsx:239-247`
- `src/ui/SettingsPanel.tsx:331-352`

**권고**

1. scale이 유효하지 않으면 이전의 유효한 scale을 유지한다.
2. min/max 자체가 invalid한 경우 plot PNG/JPEG/clipboard export를 차단한다. 유효하지만 data와 겹치지 않는 scale warning은 별도 확인 대상으로 구분한다.
3. Box zoom은 유효 숫자를 보존하고 적용 전에 `min < max`를 검증한다.
4. 매우 작은 값, 음수, 지수표기, 큰 값을 포함한 raster/export 회귀 테스트를 추가한다.

난이도: 중간

### C-P1-02. 긴 범례명이 export 이미지에서 동일하게 잘릴 수 있음 `[독립 브라우저 재현 + code]`

**사용자 영향**  
조건명이 앞부분은 같고 끝의 lot, 농도, 온도만 다르면 PNG/JPEG 범례에서 구분 부분이 잘릴 수 있다. 독립 전문가의 shared-prefix fixture에서는 `Lot Alpha`와 `Lot Beta`의 구분 suffix가 사라졌다. 보고서에 넣은 뒤에는 어떤 선이 어떤 조건인지 잘못 연결할 위험이 있다.

**근거**

- `src/chart/exportChart.ts:286-339`
- `src/chart/exportChart.ts:389-410`

**권고**

- 문자 수 추정으로 자르지 말고 실제 text width를 측정한다.
- 범례 폭·열 수·행 높이를 동적으로 조정하여 전체 이름을 보존한다.
- 부득이한 생략에는 반드시 `...`를 표시하고, export 전 identity collision을 검사한다.
- 구분 문자가 이름 뒤쪽에 있는 shared-prefix 회귀 테스트를 추가한다.

난이도: 중간

### C-P1-03. Excel의 화면 표시 header가 조용히 달라질 수 있음 `[parser probe + code]`

**사용자 영향**  
현재 header는 Excel의 표시 문자열 `cell.w`가 아니라 내부 값 `cell.v`를 문자열로 바꾼다. 따라서 Excel에서 `001`로 보이는 검체/시약 코드가 `1`이 되거나 날짜 header가 브라우저 날짜 문자열로 바뀔 수 있다. grouping, legend, CSV, Analysis label의 기준 이름이 원본 파일과 달라질 수 있다.

**근거**

- `src/data/parseExcel.ts:318-323`

**권고**

- header는 원칙적으로 text-only 입력을 권장하고, parser는 SheetJS formatting API로 Excel 표시 label을 만든다. `cell.w` 하나만 새로운 원본 권위로 취급하지 않는다.
- 내부 원본 값, cell type, number format은 provenance metadata로 별도 보존한다.
- `001`, 날짜, 과학 표기, 앞뒤 공백, 한글/특수문자 fixture를 추가한다.

난이도: 중간

### C-P1-04. Excel 경고를 실제 위치까지 확인하기 어려움 `[브라우저 확인 + code]`

**사용자 영향**  
빈 fluorescence, 비숫자, formula cache 없음, 병합 header, 유사한 이름이 있어도 import panel에는 경고 총 개수만 보인다. 좌측 `경고` 필터와 `!` 표시는 `curve.warnings`만 보므로 dataset-level 유사명/중복 경고의 대상 곡선은 찾기 어렵다. 사용자는 실제 gap인지 입력 오류인지 원본 파일을 다시 열어 수동 대조해야 한다.

append된 curve warning은 ID rekey로 대체로 구분된다. 다만 source 식별정보가 없는 경고, 특히 curve ID가 없는 동일 payload의 workbook-level warning은 exact-JSON dedupe에서 한 건으로 합쳐질 수 있다.

**근거**

- `src/ui/DataImportPanel.tsx:111-122`
- `src/ui/DataSelectionPanel.tsx:210-229`
- `src/selection/searchCurves.ts:24-42`
- `src/data/types.ts:25-36`
- `src/data/mergeDatasets.ts:93-102`

**권고**

- Quick Paste와 같은 `Warning Inspector`를 Excel에도 공통 사용한다.
- 경고별 source 파일, sheet, cell, 원문, 앱 처리 결과를 보여준다.
- dataset-level warning의 `curveIds`도 경고 필터와 tree badge에 반영한다.
- 모든 warning에 `sourceInstanceId/sourceName`을 넣고 같은 source+code+location만 dedupe한다.

난이도: 큼

### C-P1-05. 브라우저 새로고침/닫기에 Unsaved 보호가 없음 `[브라우저 재현 + code]`

**사용자 영향**  
앱 내부 `Close`는 저장 확인을 제공하지만 F5, 브라우저 탭 닫기, 창 닫기는 경고 없이 모든 분석 탭을 잃는다. 자동 영구 저장을 원하지 않는다는 결정과 “실수로 닫을 때 경고”는 별개다.

**근거**

- `src/ui/AnalysisTabs.tsx:41-136`
- `src/app/App.tsx:8-52`

**권고**

- dirty 분석이 하나라도 있으면 표준 `beforeunload` 경고를 사용한다.
- 자동 recovery 저장은 별도 사용자 결정 없이는 추가하지 않는다.
- 마지막 Analysis XLSX 저장 시각과 현재 변경 여부를 상단에 명확히 표시한다.
- `Analysis XLSX`를 Export 안에만 두지 말고 상단의 `분석 저장` command로 노출한다.
- `파일 선택/추가 선택`의 파일형식별 분기 대신 `원본 데이터 열기`, `Excel 추가`, `저장한 분석 열기`처럼 목적을 명시한다.

난이도: 작음

### C-P1-06. 문서상 허용된 Quick Paste가 특정 모양에서 crash할 수 있음 `[독립 probe + code]`

**사용자 영향**

Quick Paste는 250,000 cells까지 허용하지만 대형 배열을 `Math.min/max(...values)`로 펼친다. 독립 probe에서 허용 범위 안의 150,000-cell 단일 열 입력이 `Maximum call stack size exceeded`를 일으켰다. 즉 UI가 허용한다고 판단한 입력이 browser error로 끝날 수 있다.

**근거**

- `src/data/parsePastedTable.ts:28-79`
- `src/data/normalizePcrData.ts:84-92`
- `src/chart/chartScale.ts:121-127`

**권고**

1. spread 기반 min/max를 iterative 계산으로 교체한다.
2. cell 수뿐 아니라 row, column, curve, cycle별 상한을 함께 검증한다.
3. 현재 허용 상한 바로 아래의 worst-shape 표를 회귀 테스트한다.
4. parser entry point를 `try/catch`로 보호해 현재 분석을 유지하고 제어된 오류를 보여준다.

난이도: 작음~중간

## 6. 코드베이스 감사: P2/P3 보완

### C-P2-01. Analysis XLSX는 복원 파일이지 검증된 감사 기록은 아님

현재 검증은 JSON 구조와 타입 중심이다. 아래 의미 일관성은 재계산하지 않는다.

- `cycleCount`와 각 curve X/Y 길이의 일치
- X가 실제 생성 규칙 `1..N`인지 여부
- min/max/missing stats 재계산 결과
- curve와 specimen/reagent entity의 양방향 membership
- `sourceFiles` 총 curve 수와 각 curve provenance의 일치
- restore payload size와 내부 관계 일관성

**업무 의미**  
Analysis XLSX를 Excel에서 변경하거나 파일이 부분 손상되더라도 문법상 유효하면 모순된 상태를 열 수 있다. 현재 목적은 “분석 이어하기”이며 규제용 audit trail이나 파일 authenticity 증명이 아니다. 따라서 같은 workbook 안의 단순 checksum보다 의미 검증과 payload 제한이 우선이다.

근거: `src/analysis/analysisState.ts:381-650`, `src/analysis/analysisWorkbook.ts:191-228`

권고: stats/entity/source 관계 재검산과 payload size 제한을 추가한다. 외부 서명 없는 내부 hash는 authenticity 보증으로 표현하지 않는다.

### C-P2-02. source 간 Cycle 호환성 확인이 없음

모든 source는 첫 fluorescence 행을 Cycle 1로 생성한다. append 시 40-cycle과 60-cycle data는 같은 시작점에 겹치고 전체 `cycleCount`는 최댓값만 가진다. 현재 입력 규칙에 맞으면 합리적이지만, 초기 행 누락이나 Cycle 0 시작 source는 한 cycle 밀려도 알 수 없다.

이 항목은 source file이 항상 row 3 = Cycle 1이라는 업무 규칙을 확실히 지킨다면 결함이 아니라 product rule이다. 다른 장비/source가 들어올 가능성이 있을 때만 append 전 cycle 수와 시작 규칙을 비교하고 경고/확인을 제공한다. source summary와 Analysis XLSX에는 관찰된 cycle 수를 기록한다.

### C-P2-03. Plotted CSV header의 Excel formula 해석 위험

검체/시약/Analysis label이 `=`, `+`, `-`, `@`로 시작하면 Excel에서 formula처럼 해석될 수 있다. 분자진단 조건명에서 `+Mg`, `-NTC`, `@65C`는 현실적인 이름이다. rich Excel clipboard는 이미 이 prefix를 방어하지만 CSV는 방어하지 않는다.

근거: `src/chart/plottedDataExport.ts:26-70`, `src/chart/exportChart.ts:365-381`

권고: CSV header도 spreadsheet-safe text 정책을 공통 적용하고 네 prefix 회귀 테스트를 추가한다.

### C-P2-04. 표시 곡선이 많을 때 hover와 editor가 급격히 무거워짐

- mouse move마다 모든 표시 point를 순회하고 각 point를 pixel로 변환한다.
- hover state 변화가 전체 ECharts option 재생성/재적용으로 이어진다.
- Style와 Legend editor는 선택 curve 전체를 DOM에 만든다.

독립 100 curves x 100 points stress에서는 약 10,651 DOM elements, 선택/render 약 482ms, pointer move 10회 약 233ms가 측정됐다. 사용자가 실제 분석 곡선을 보통 20개 이하로 제한하므로 즉시 P1은 아니지만, “100곡선 성능 목표”를 여유 있게 만족한다고 보기는 어렵다.

근거: `src/chart/ChartView.tsx:94-105`, `src/chart/ChartView.tsx:283-310`, `src/ui/SettingsPanel.tsx:995-1144`

권고: hover animation-frame throttle, nearest-X 후보 계산, readout과 highlight 분리, editor row virtualization을 적용한다.

### C-P2-05. Analysis XLSX의 전체 데이터 포함 사실을 export UI가 충분히 설명하지 않음

Analysis XLSX는 현재 plot하지 않은 곡선과 hidden restore JSON까지 포함한다. 이것은 분석 연속성에는 올바른 설계지만, 사용자가 report 파일로 오해해 전달하면 의도하지 않은 전체 데이터가 공유될 수 있다.

권고: 버튼 근처에 `전체 imported dataset + 설정을 저장하는 분석 복원 파일`이라고 항상 표시하고 report 용도가 아님을 구분한다.

### C-P2-06. 비동기 export/clipboard 완료가 다른 탭에 기록될 수 있음

분석 A에서 chart/report-legend export를 누르고 렌더링 중 분석 B로 이동하면, 생성 파일은 A의 data를 사용하지만 B의 export counter, 완료 message, Unsaved 상태가 바뀔 수 있다. clipboard 작업도 완료/오류 message가 다른 탭에 표시될 수 있다. 산출물 data 자체의 오류는 아니므로 P2로 분류하지만 여러 분석을 병행할 때 파일 번호와 저장 상태를 혼동시킨다.

근거: `src/ui/SettingsPanel.tsx:331-352`, `src/app/appStore.ts:816-824`

권고: export job에 시작 analysis ID/runtime instance/revision/counter를 고정하고, 완료 action을 해당 탭에만 적용한다. delayed export 중 탭 전환 회귀 테스트를 추가한다.

### C-P2-07. Excel 실제 형식·용량 처리의 방어와 효율이 부족함

- `.xls/.xlsx`는 확장자만 확인하고 SheetJS 자동 감지에 맡기므로 CSV/HTML을 이름만 `.xls`로 바꾼 파일도 workbook으로 읽힐 수 있다.
- 장비가 의도적으로 HTML-as-XLS를 내보내는 경우도 있으므로 단순 차단은 적합하지 않다.
- Excel에는 byte, row, column, cell, curve 상한이 없고 UI thread에서 동기 parsing한다.
- 일반 `.xlsx`는 Analysis XLSX 여부 확인과 원본 Excel import에서 두 번 읽고 parsing한다.

근거: `src/data/parseExcel.ts:23-47`, `src/data/parseExcel.ts:279-337`, `src/app/appStore.ts:201-223`

권고: 실제 형식을 감지해 확장자와 함께 표시하고, 업무 기준의 파일/curve/cycle/cell 상한을 정하며, `.xlsx`는 한 번만 parse해 분기한다. 대표 파일에서 상한이 부족할 때 Web Worker를 도입한다.

### C-P2-08. cached formula 값이 raw measurement처럼 수용됨

formula cell에 finite cached value가 있으면 별도 warning 없이 숫자로 사용한다. Excel 계산 mode가 수동이거나 cache가 오래되면 이전 계산값을 측정값처럼 plot할 수 있다. 현재 원본 fluorescence 파일이 값 cell만 포함한다면 영향은 낮지만, formula workbook을 받을 가능성이 있으면 추적성이 부족하다.

근거: `src/data/parseExcel.ts:244-260`

권고: `FORMULA_CACHED_VALUE_USED` warning과 formula/cache provenance를 기록하고, 필요하면 strict import에서 fluorescence formula를 차단한다.

### C-P2-09. `Auto range` 표기가 실제 렌더링 축 범위와 다름

UI의 `Auto range`는 선택 data의 raw min/max다. ECharts Auto axis는 zero 포함과 nice tick을 적용하므로 실제 plot 범위는 다를 수 있다. 합성 data에서도 UI는 X `1-60`을 표시했지만 chart는 0부터 보였다. 이 값으로 Fixed를 만들 때도 표시 formatting으로 반올림된다.

근거: `src/chart/chartScale.ts:101-127`, `src/chart/chartConfig.ts:70-109`, `src/ui/SettingsPanel.tsx:1483-1658`

권고: `Auto range`를 `Data range`로 정확히 이름 붙이거나 ECharts의 실제 rendered bounds를 표시한다. Fixed 복사는 exact/outward-rounded bounds를 사용한다.

### C-P2-10. scientific export 검증이 실제 raster identity를 충분히 확인하지 않음

현재 unit test는 SVG 일부 문자열을 확인하고, E2E는 주로 filename과 nonempty 값을 확인한다. full legend identity, null gap pixel, 실제 scale bounds, white background, clipboard MIME/content를 end-to-end로 증명하지 않는다. Box zoom test도 서로 다른 유효 min/max인지 확인해야 한다.

권고: 다운로드한 PNG/JPEG를 decode해 dimensions, background, axis/legend identity와 대표 pixel을 검사하고, shared-prefix 긴 label과 매우 작은 Y값 fixture를 추가한다.

### C-P2-11. 큰 Analysis XLSX 저장의 memory preflight가 없음

Analysis XLSX export는 full rectangular review table, restore JSON, workbook object, output buffer, final Blob을 한 시점에 함께 만들 수 있다. 큰 import가 화면 분석에는 성공해도 저장 단계에서 browser freeze 또는 memory failure가 날 수 있다.

근거: `src/analysis/analysisWorkbook.ts:29-46`, `src/analysis/analysisWorkbook.ts:153-170`, `src/analysis/analysisWorkbook.ts:191-228`

권고: 예상 row/column/cell/JSON size를 먼저 계산해 warning 또는 limit를 적용하고, 실제 업무 최대 dataset으로 save/restore stress test를 추가한다.

### C-P2-12. 예상 밖 render/parser failure의 복구 경계가 약함

Quick Paste의 synchronous parser 호출과 React root에는 제어된 error boundary가 없다. RangeError 같은 예상 밖 오류가 나면 현재 분석 data를 보존하더라도 사용자는 명확한 복구 화면을 받지 못할 수 있다.

근거: `src/ui/PasteImportPanel.tsx:106-137`, `src/main.tsx:1-9`

권고: import entry point의 예외를 오류 message로 변환하고, root error boundary에서 reload 전 Analysis XLSX 저장 가능 여부 또는 안전한 복구 안내를 제공한다.

### C-P2-13. Browser-local product promise의 network regression test가 없음

현재 runtime network/analytics call은 없지만 acceptance criterion이 약속한 “입력 data가 browser 밖으로 나가지 않음”을 CI가 검사하지 않는다.

권고: Playwright에서 app origin 밖의 request를 감지하면 실패시키는 test를 추가한다. CSP 자체는 아래 P3 hardening으로 분리한다.

### C-P2-14. 배포 gate가 desktop CSS/브라우저 회귀를 막지 못함

- 현재 CI는 unit test와 build만 실행하며 Playwright 5개는 로컬 실행이다.
- inactive Legend tab이 보이는 실제 CSS 결함을 자동 test가 놓쳤다.
- 로컬 Playwright는 4173 port의 기존 server를 재사용할 수 있어 stale build를 검증할 가능성이 있다.
- release workflow의 `pages:write`, `id-token:write` 권한이 dependency install/test job에도 적용된다.

권고: fresh production preview를 사용하는 desktop Playwright와 핵심 screenshot/pixel assertion을 CI에 포함하고, deploy 권한을 deploy job에만 둔다.

### C-P3-01. CSP로 Browser-local 경계를 강제하지 않음

현재 코드는 외부 전송을 하지 않는 것이 확인됐지만 이를 강제하는 CSP와 CI network guard는 없다. 향후 dependency나 코드 수정으로 network call이 추가되어도 자동으로 잡히지 않는다.

현재 개인/소규모 desktop 사용에서 직접 장애는 아니므로 P3 hardening으로 분류한다. 권고: production CSP의 `connect-src`를 최소화하고, Playwright가 app origin 밖의 request를 실패시키는 network guard를 추가한다.

### C-P3-02. 상태와 UI 모듈의 크기가 다음 수정 위험을 높임

- `src/app/appStore.ts`: 1,335줄, active adapter와 `analyses`에 상태를 이중 보관
- `src/ui/SettingsPanel.tsx`: 1,660줄
- `src/styles.css`: 2,046줄

당장 사용 오류는 아니지만 export/tab race처럼 “기능 A의 완료가 기능 B 상태를 건드리는” 문제가 다시 생기기 쉽다.

권고: 우선 async action이 analysis ID/runtime revision을 명시적으로 받게 하고 race test를 강화한다. 같은 유형의 상태 결함이 계속될 때 `analyses[activeAnalysisId]` 단일 권위와 Import/Scale/Style/Legend/Export controller 분리를 검토한다. 대규모 리팩터링을 동작 수정과 섞지 않는다.

### C-P3-03. 정적 개발 품질 gate가 없음

- lint/format gate와 coverage threshold가 없다.

권고: 최소 lint와 `git diff --check`를 먼저 gate로 추가하고, coverage threshold는 의미 있는 module 경계를 만든 뒤 도입한다.

### C-P3-04. clean build가 외부 SheetJS tarball 가용성에 의존함

lockfile integrity는 고정돼 있지만 `npm ci`는 `cdn.sheetjs.com`의 tarball을 다시 받을 수 있어야 한다. CDN 장애 또는 사내 network policy가 있으면 source가 정상이어도 배포 build가 실패할 수 있다.

근거: `package.json:20`, `package-lock.json`의 SheetJS resolved/integrity entry

권고: 검증한 tarball을 `vendor/`에 보관하고 `file:` dependency로 참조하는 방안을 검토한다.

## 7. 데스크톱 UI/미감 감사

### U-P2-01. Legend의 Order/Labels 탭이 실제로 분리되지 않음

`Labels`를 눌러도 `Order` 목록이 그대로 보인다. DOM에는 `hidden`이 적용되지만 CSS `.legend-order-list { display: grid; }`가 이를 덮는다. 실제 브라우저에서 `hidden=true`, computed `display=grid`, visible=true를 확인했다.

**영향**  
Labels 화면이 불필요하게 길어지고, 사용자는 현재 어느 탭을 편집하는지 혼동한다.

근거: `src/ui/SettingsPanel.tsx:1255-1292`, `src/styles.css:1780-1793`

권고: Legend editor 안에서만 inactive panel을 conditional rendering하거나 scoped `[hidden]` rule로 숨기고 Playwright visible/hidden 테스트를 추가한다.

난이도: 작음

### U-P2-02. 개별 Style 표가 설정 열 폭과 맞지 않음

340px 설정 열 안에 Curve, 범례명, 색상, HEX, 선, 마커, 상태, 초기화를 한 행에 모두 넣어 가로 스크롤이 생긴다. 6곡선만 선택해도 이름과 source suffix가 잘리며, 20곡선 이상에서는 전체 파악이 어렵다.

권고 방향:

1. 그룹 Style은 현재의 압축 행을 유지한다.
2. 단기에는 기본 행을 `곡선명 | 색상 swatch | 선/마커 preview | Custom 여부`로 줄이고 한 행을 펼쳐 편집한다.
3. 이 방식으로도 20곡선 작업이 불편하면 `선택 곡선 편집` dialog/drawer로 분리한다.
4. 다중 선택 후 공통 속성 일괄 적용은 별도 toolbar 후보로 둔다.

이 구조는 가로 스크롤 없이 곡선명과 현재 스타일을 동시에 보존한다.

난이도: 큼

### U-P2-03. laptop-height desktop에서 sticky preview가 plot 문맥을 잃음

6곡선·대형 desktop에서는 sticky chart가 잘 동작했다. 그러나 독립 24곡선 stress 확인에서 chart+readout+legend card는 1366 x 768에서 약 1,091px, 1280 x 800에서 약 1,115px로 viewport보다 컸다. 설정 하단으로 내리면 canvas 상단이 viewport 위로 밀려 plot과 legend를 함께 볼 수 없었다. 현재 E2E는 chart `y < 36`만 검사하여 음수 위치로 화면 밖에 있어도 통과할 수 있다.

권고:

- plot shell 자체를 가용 viewport 높이에 맞춰 sticky로 유지한다.
- legend는 별도 접기 또는 내부 scroll을 사용해 canvas 높이를 침범하지 않게 한다.
- 지원 목표는 확정 전 제안으로 `1440 x 900 이상, 권장 1920 x 1080`을 검토하되, 24곡선에서도 plot이 보이는지 검증한다.
- 모바일 breakpoint 작업은 하지 않는다.

### U-P2-04. 기본 시각 identity가 겹치는 곡선을 구분하지 못할 수 있음

현재 기본은 reagent별 색상, 모든 line은 실선, marker 없음이다. 같은 reagent의 여러 specimen은 legend sample까지 같은 모양이 된다. 곡선이 정확히 겹치면 한 곡선이 완전히 가려질 수 있다.

사용자가 지정한 색상 순서는 유지해야 한다. 자동으로 임의 변경하기보다 다음 보조가 적합하다.

- 같은 visual signature를 가진 표시 곡선 수를 알려주는 `스타일 충돌` 경고
- 기존 `구분 프리셋 적용`의 결과 collision 수를 보여주고 line+marker 조합까지 사용해 남은 중복을 줄이기
- 노란색/하늘색처럼 흰 배경 대비가 낮은 색에는 report readability 경고

24곡선 stress 확인에서 기본은 6개 visual signature만 사용했고, 기존 구분 preset 후에도 18개 signature로 6개 duplicate pair가 남았다.

### U-P2-05. Legend order/label 편집이 곡선 수에 따라 선형으로 길어짐

Order는 한 칸 이동 화살표만 제공하고 Labels에는 검색이 없다. 24곡선에서는 Order와 Labels 모두 긴 내부 scroll이 필요하다. 사용자가 현재 순서를 직접 정하는 기능은 유지하되 다음 보조가 필요하다.

- Order/Labels 공통 검색
- 맨 위/맨 아래 이동
- 현재 grouping 기준의 group 단위 정렬
- drag를 추가한다면 keyboard 화살표도 유지

근거: `src/ui/SettingsPanel.tsx:1268-1390`, `src/styles.css:1780-1893`

### U-P2-06. preview legend도 긴 진단 식별자의 구분 suffix를 숨김

custom legend는 좁은 column에서 한 줄 ellipsis를 사용한다. 시약/조건명의 앞부분이 같고 lot·농도·온도 suffix가 뒤에 있으면 화면상 구분 부분이 보이지 않는다. hover title은 보조 수단일 뿐 전체 비교를 대신하지 못한다.

권고: reagent/specimen 또는 primary/secondary label을 두 줄로 분리하거나 최대 두 줄 wrap을 허용하고, 같은 표시 문자열로 줄어드는 항목에는 경고한다.

근거: `src/styles.css:1140-1174`

### U-P3-01. 한글과 영어의 혼용이 제품 완성도를 낮춤

`New analysis`, `Close`, `Unsaved`, `Clean`, `Scale`, `Style`, `Legend`, `Export`, `Auto compact`와 한글이 같은 작업면에 섞여 있다. 전문용어인 Cycle, Fluorescence, Analysis XLSX는 유지해도 되지만 일반 동작어는 한 언어로 통일하는 편이 빠르게 읽힌다.

권고: 한국어 우선 UI로 정리하고 전문 파일/분석 용어만 영어를 유지한다. 특히 `Clean`은 분자진단 문맥에서 오염/청정 상태처럼 읽힐 수 있으므로 `저장됨`, `Unsaved`는 `저장 안 됨`으로 바꾼다.

### U-P3-02. 정보 상자가 많아 주의 우선순위가 약함

전체적으로 정갈하지만 panel, details, export group, editor가 모두 비슷한 흰 상자와 border를 사용한다. 중요한 경고와 단순 구획의 시각적 무게가 비슷하다.

권고: page section은 border를 줄이고, 오류·Unsaved·Warning Inspector·export 완료처럼 행동이 필요한 상태에만 강한 색과 배경을 사용한다.

### U-P3-03. 상단 3개 band가 operational workspace의 첫 화면을 줄임

branding, analysis controls, import controls가 각각 별도 band를 차지한다. 1440 x 900 stress 확인에서 workspace 시작점이 document 상단에서 약 322px 아래였다.

권고: import 후 header를 compact mode로 줄이고, developer credit는 About/help로 이동하며, import는 source toolbar로 접을 수 있게 한다. 이는 모바일 대응이 아니라 desktop working area 확보 목적이다.

## 8. 문서·컨텍스트 압축 감사

현재 가장 큰 문서 리스크는 “문서가 많아서 안전한 것”이 아니라 “서로 다른 시점의 진실이 함께 남아 있는 것”이다.

### 확인된 불일치

- `README.md`에는 Quick Paste, Analysis XLSX, analysis tabs, Box zoom, Analysis labels가 충분히 반영되지 않았다.
- `docs/01_PROJECT_CHARTER_KR.md`는 아직 CSV/직접입력 기반의 generic chart app을 설명한다.
- `DECISIONS.md`의 일부 초기 기술 결정이 구현 완료 후에도 Provisional이다.
- `docs/03_INPUT_OUTPUT_SPEC_EN.md`는 drag-and-drop을 입력 경로로 적지만 UI에 없다.
- `docs/04_TEST_PLAN_ACCEPTANCE_EN.md:196`은 comma paste를 test한다고 적지만 구현은 comma/CSV를 거부한다.
- `docs/07_FIXTURE_SNAPSHOT_PLAN_KR.md`는 source app이 없다고 적고, 계획한 고정 fixture/snapshot은 아직 없다.
- `docs/08_RELEASE_CHECKLIST_KR.md`는 97 unit tests/3 E2E 기준으로 오래됐다.
- `docs/09_UX_REFINEMENT_IMPLEMENTATION_PLAN_KR.md`는 R0-R13 완료 후에도 `Draft for implementation`이다.
- `CHANGELOG.md`는 Quick Paste를 Added와 Deferred 양쪽에 기록한다.
- `DEVELOPMENT_STATE.md`는 가장 최신이지만 500줄 이상 누적되어 다음 agent가 핵심 상태를 찾기 어렵다.

### 권고 구조

1. `DEVELOPMENT_STATE.md` 상단에 1페이지 분량의 `CURRENT TRUTH`를 둔다.
2. 완료된 상세 phase log는 `docs/archive/`로 이동한다.
3. `README`는 현재 사용자 기능과 실행/배포만 설명한다.
4. charter와 requirements는 현재 범위만 남기고 과거 generic scope는 history로 보낸다.
5. release checklist는 자동 생성 가능한 test/build 수치를 직접 적지 않거나 매 release 갱신한다.
6. 실제 `.xls/.xlsx` 고정 fixture와 normalized snapshot을 체크인한다.

이 작업은 기능 추가보다 컨텍스트 압축 후 품질 저하를 막는 효과가 크다.

## 9. 사용자 작업 흐름에 도움이 되는 보완사항

아래는 기능 수를 늘리기 위한 제안이 아니라, 현재 사용 패턴인 `여러 source 입력 → 일부 곡선 선택 → 조건 비교 → scale/style/label 정리 → 그림/데이터 export → 나중에 이어서 분석`을 더 안전하고 빠르게 만드는 제안이다.

### W1. Import Audit / Warning Center

가장 우선순위가 높다.

- source별 파일명, sheet, 실제 형식, curve 수, cycle 수
- header 누락·표시값 변경·유사명·중복명
- 빈 값/비숫자/formula/병합 cell의 정확한 위치
- 앱이 취한 처리: 유지, null/gap, 무시, 차단
- 해당 곡선 선택/검색으로 바로 이동
- warning을 누르면 Quick Paste preview 또는 source 위치 표시로 이동

효과: Excel 원본을 반복해서 열어 대조하는 시간이 줄고, gap의 원인을 분석 결과와 입력 오류로 구분하기 쉽다.

첫 단계는 현재 import summary 아래의 expandable warning list로 작게 시작하고, source가 여러 개일 때 공통 Warning Center로 확장하는 것이 적합하다.

### W2. Save Safety와 명확한 checkpoint

- 브라우저 refresh/close 경고
- 상단에 `마지막 Analysis XLSX 저장: 시각 / 이후 변경 있음` 표시
- Analysis XLSX 버튼을 Export accordion 안뿐 아니라 상단의 명확한 `분석 저장` command로 제공
- `원본 데이터 열기`, `Excel 추가`, `저장한 분석 열기`를 명시적으로 분리
- 자동 영구 저장은 하지 않음

효과: 여러 탭으로 장시간 분석할 때 실수로 전체 작업을 잃는 위험을 줄인다.

### W3. Named View(선택 세트) 저장

Multi-plot을 만들지 않고도 현재 선택한 curve IDs, 순서, scale, style, labels를 `조건 비교 A`, `온도 비교`, `Lot 비교` 같은 이름으로 한 분석 안에 저장한다. view를 바꾸면 동일 chart에 해당 구성이 복원된다. Named View는 Analysis XLSX에 함께 저장한다.

효과: 여러 곡선을 반복해서 체크/해제하는 현재 작업을 직접 줄이며, 화면을 복잡한 multi-plot으로 만들지 않는다.

### W4. Export Preflight

필요할 때 켜는 선택형 export 요약을 제공한다. 모든 export에 modal 확인을 강제하지 않는다.

- 표시 곡선 수와 순서
- X/Y scale mode와 실제 적용 bounds
- 동일 visual style 충돌 여부
- 잘릴 수 있는 범례명 여부
- 선택 산출물의 포함 범위
- Analysis XLSX는 전체 imported data 포함이라는 경고

효과: 보고서에 잘못된 scale·범례·포함 범위를 넣는 실수를 줄인다.

### W5. Source compatibility summary

추가 선택 또는 Quick Paste append 전 source별 cycle 수, curve 수, header 공란, 중복 조합을 비교한다. 다른 cycle 수는 차단하지 않되 결과가 어떻게 겹쳐지는지 확인하게 한다.

효과: 여러 run/조건을 합칠 때 한 cycle shift나 짧은 run을 더 빨리 발견한다.

### W6. 선택적 figure metadata

이미지에 항상 큰 제목을 넣는 것은 현재의 깔끔함을 해칠 수 있다. 대신 export에만 선택적으로 다음을 넣는 것이 적합하다.

- Analysis name
- Run/source identifier
- Y-axis unit 또는 측정 표기
- scale mode

효과: PowerPoint/Excel로 옮긴 뒤 파일명과 분리되어도 그림의 조건을 잃지 않는다.

### W7. 설정 Undo/Redo

원본 데이터는 편집하지 않되 selection, order, scale, style, Analysis label 변경만 browser session에서 여러 단계 되돌릴 수 있게 한다.

효과: 조건 비교 중 잘못 누른 style/reset/order 작업을 Analysis XLSX 재import 없이 복구할 수 있다.

## 10. 이번 범위에서 권하지 않는 확장

현재 사용자와 사용 환경을 기준으로 아래 작업은 우선순위가 낮다.

- 모바일/태블릿 최적화
- 서버 database, 로그인, 실시간 협업
- multi-plot 비교 화면
- native editable Excel chart
- 앱 안에서 fluorescence 원본 수정
- 자동 smoothing, normalization, threshold, Ct/Cq 또는 임상 판독 계산
- 범용 CSV dialect 자동 추측

이 항목들은 핵심 안정성을 높이지 않으면서 화면과 검증 범위를 크게 늘린다.

## 11. 권장 보완 순서

### Stabilization A: 해석·손실 위험 제거

1. Fixed scale 검증과 export 차단
2. 범례 전체 identity 보존
3. Excel header 표시값 보존
4. Excel warning 상세와 provenance
5. browser refresh/close 보호 및 분석 저장 command
6. Quick Paste iterative min/max와 controlled error handling

### Stabilization B: 연속성·성능·UI 정리

1. Analysis XLSX 의미 검증과 memory/payload limit
2. source/cycle compatibility summary
3. CSV header formula와 cached formula warning
4. async export의 시작 탭 고정
5. Legend inactive tab 결함과 대량 order/label 편집 보완
6. 개별 Style editor compact row 개선
7. hover/editor 성능과 Auto range 표기 보완
8. CI desktop E2E, network guard, raster export 검증

### Workflow C: 반복 분석 속도 향상

1. Named View
2. Export Preflight
3. 선택적 figure metadata
4. 설정 Undo/Redo

### Documentation D: 컨텍스트 압축 내성 강화

1. README/charter/current requirements 동기화
2. 완료 plan archive
3. current truth 요약
4. 고정 fixture/snapshot 추가

## 12. 수정 전 임시 안전 사용 수칙

1. 검체명과 시약명은 Excel에서 text cell로 저장하고 `001` 같은 숫자 서식만으로 이름을 만들지 않는다.
2. `.xls/.xlsx` 확장자를 임의로 바꾼 CSV/HTML 파일은 넣지 않는다.
3. Fixed/P1/P2 사용 시 화면 하단 scale warning이 없는지 확인하고 실제 축 눈금을 대조한다.
4. 길고 비슷한 범례명은 구분 문자를 앞쪽에도 두거나 Analysis label로 짧고 고유하게 만든다.
5. Excel import 후 warning 수가 1개 이상이면 원본의 빈 cell, formula, 병합 header를 직접 대조한다.
6. 브라우저 refresh/닫기 전에 Analysis XLSX를 저장한다.
7. Analysis XLSX는 선택하지 않은 곡선을 포함한 전체 분석 archive이므로 report 파일처럼 외부 전달하지 않는다.
8. 한 화면의 표시 곡선은 현재 사용 패턴대로 가능하면 20개 이하로 유지한다.

## 13. 작성 후 전문가 재감사 반영

초안 작성 후 architecture/state, scientific visualization/data integrity, desktop UX 관점에서 다시 대조했다. 다음을 최종본에 반영했다.

- async export 문제를 산출물 data 오류가 아닌 tab bookkeeping 문제로 명확히 하고 P2로 조정
- Quick Paste 허용범위 crash와 일반 Excel 형식/용량 hardening을 분리
- warning dedupe 위험을 source 정보가 없는 identical workbook-level warning으로 한정
- Excel 표시 label은 `cell.w` 단독이 아니라 formatting API+raw provenance로 설계하도록 수정
- 24곡선 laptop-height sticky stress, 100 x 100 성능 수치, custom legend suffix ellipsis를 추가
- Analysis XLSX 내부 hash보다 semantic validation과 memory/payload limit를 우선하도록 범위를 축소
- CSP, 대규모 store refactor, Named View/Undo 같은 항목을 즉시 안정화와 분리
- UI의 `Clean`을 분자진단 문맥에 맞는 `저장됨`으로 바꾸는 권고를 명시

재감사 중 refresh loss를 P0로 올리자는 의견도 있었다. 최종 등급은 P1로 유지했다. 이유는 앱이 원본 source file을 삭제하거나 변경하지 않고, 손실 대상은 마지막 저장 이후의 browser-memory 분석 상태이기 때문이다. 그럼에도 일반적인 F5/창 닫기에서 경고가 없다는 점은 높은 우선순위이며 Stabilization A에 포함했다.

## 14. 최종 판단

이 프로젝트의 핵심 방향은 맞다. React/ECharts/SheetJS를 사용한 정적 browser-local 구조, curveId 기반 선택, 원본 데이터 무변환, Analysis XLSX 연속성, custom legend/export 분리는 사용자 목적에 잘 맞는다. 가장 큰 개선 기회는 새로운 기능을 많이 추가하는 것이 아니라 다음 세 가지를 강화하는 것이다.

1. **입력과 경고의 추적성**: 어떤 source의 어떤 cell이 어떻게 처리되었는지 보이게 만들기
2. **산출물의 오인 방지**: Fixed scale과 범례 identity가 export에서 절대 조용히 바뀌지 않게 만들기
3. **장시간 분석의 안전성**: 탭 전환·refresh·저장·이어하기를 실수에 강하게 만들기

이 세 축을 먼저 보완하면 현재 앱은 개인 실험 탐색 도구에서 소규모 개발팀이 반복적으로 신뢰하고 사용할 수 있는 안정적인 분석 도구로 한 단계 올라갈 수 있다.
