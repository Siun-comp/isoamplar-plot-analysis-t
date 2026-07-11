# 10 Quick Paste Import 상세 구현 계획 및 단계별 프롬프트

## 목적
소량의 데이터를 추가하기 위해 별도 Excel 파일을 만드는 번거로움을 줄이되, 원본 데이터 무결성을 해치지 않는 붙여넣기 기반 입력 경로를 추가하기 위한 구현 계획이다.

이 기능은 수동 편집기가 아니다. 사용자가 붙여넣은 표를 하나의 import source로 해석하고, 미리보기와 warning 확인 후 현재 분석에 추가하거나 새 분석으로 여는 기능이다.

## 상태
Implemented - Phases Q0 through Q6

## Last Updated
2026-07-11

## Owner
Product / Engineering / Agent

## 압축 안전 요약
- 기능명은 임시로 `Quick Paste Import`로 둔다.
- 이 기능은 app-side manual editing이 아니다.
- 붙여넣기 입력은 두 모드를 지원한다: `전체 표 모드`는 기존 Excel 입력과 같은 1행 검체명 / 2행 시약명 / 3행 이후 fluorescence 구조를 사용하고, `단일 검체 모드`는 별도 검체명 입력 + 1행 시약명 / 2행 이후 fluorescence 구조를 사용한다.
- 단일 검체 모드의 검체명 입력은 import 전 header 보완 metadata이며, 이미 import된 데이터 수정 기능이 아니다.
- 붙여넣은 데이터는 preview와 warning 확인 전에는 현재 분석에 반영되지 않는다.
- 지원 구분 형식은 Excel 범위 복사에서 생성되는 tab-separated text와 구분자 없는 단일 열이다. Comma/CSV 표는 무음 오해석 방지를 위해 거부한다.
- preview에서 cell 편집은 제공하지 않는다. 잘못 붙여넣은 경우 사용자가 입력창의 원문을 고쳐 다시 preview한다.
- 확정 동작은 `현재 분석에 추가`와 `새 분석으로 열기`만 제공한다.
- 내부 결과는 기존 `PcrDataset`, `Curve`, `PcrWarning`, `SelectionState`, `Analysis XLSX` 흐름과 동일해야 한다.
- paste source는 Analysis XLSX hidden restore JSON과 visible review sheet에서 Excel source와 구분 가능해야 한다.
- 원본 fluorescence 값은 자동 보정, smoothing, normalization, baseline correction, log transform, Ct/Cq 계산 없이 그대로 보존한다.

## 비목표
- Excel과 같은 spreadsheet grid 편집기 구현.
- 기존 import된 dataset의 cell 수정.
- 붙여넣은 preview table 안에서 cell별 직접 수정.
- custom X/cycle 열 입력.
- 이미 import된 Excel/paste source의 검체명 또는 시약명 수정.
- CSV file import.
- 장비별 proprietary text parser.
- source-data 오타 자동 수정, 자동 병합, 자동 보정.
- native editable Excel chart 또는 Report/Plotted XLSX 구현.

## 핵심 제품 원칙
1. 붙여넣기는 편집이 아니라 import다.
2. 잘못된 원본은 앱 안에서 고치지 않고 다시 붙여넣는다.
3. preview와 warning은 사용자가 반영 전 판단하기 위한 안전장치다.
4. 확정 후에는 기존 Excel import와 동일한 분석 흐름을 따른다.
5. Analysis XLSX에는 붙여넣기 source도 전체 dataset 일부로 저장되어야 한다.

## 입력 형식
Quick Paste Import는 소량의 중간 비교 데이터를 추가하기 위한 기능이다. 대량 데이터 또는 정리된 원본 데이터는 계속 Excel에서 정리한 뒤 import하는 흐름을 권장한다.

### 입력 모드 A: 전체 표 모드
기본 입력 형식은 기존 Excel과 동일하다.

```text
검체 1      검체 1      검체 2
시약 A      시약 B      시약 A
120.5       118.2       130.1
122.0       119.0       132.3
...
```

규칙:
- 1행: specimen label.
- 2행: reagent label.
- 3행 이후: fluorescence values.
- X axis는 기존처럼 `Cycle 1..N`으로 자동 생성한다.
- 각 열은 하나의 curve다.
- 빈 열은 specimen, reagent, fluorescence가 모두 비어 있을 때만 무시한다.
- 내부 빈 fluorescence 값은 `null`과 warning으로 처리한다.
- 숫자가 아닌 fluorescence 값은 `null`과 warning으로 처리한다.
- 음수 fluorescence 값은 원본 raw value로 유효하다.

### 입력 모드 B: 단일 검체 모드
사용자가 검체명을 별도 입력하고, 붙여넣기 표에는 시약명과 fluorescence만 포함한다. 한 test cartridge 또는 한 검체에서 나온 일부 시약 데이터를 중간 비교용으로 추가할 때 사용한다.

```text
검체명 입력: 검체 1

시약 A      시약 B      시약 C
120.5       118.2       130.1
122.0       119.0       132.3
...
```

해석 결과:

```text
검체 1      검체 1      검체 1
시약 A      시약 B      시약 C
120.5       118.2       130.1
122.0       119.0       132.3
...
```

규칙:
- 검체명 입력은 필수다. 비어 있으면 preview를 생성하지 않고 actionable error를 표시한다.
- 붙여넣은 표의 1행은 reagent label이다.
- 붙여넣은 표의 2행 이후는 fluorescence values다.
- 앱은 preview 생성 과정에서만 입력된 검체명을 각 curve의 specimen label로 적용한다.
- 이 적용은 이미 import된 데이터 수정이 아니며, preview 확정 전 import source를 구성하는 과정이다.
- 검체명 입력을 변경하면 기존 preview는 stale이 되며 confirm action을 막아야 한다.
- 시약명과 fluorescence warning 정책은 전체 표 모드와 동일하다.

지원 구분 형식:
- 우선순위 1: tab-separated text.
- 우선순위 2: 구분자가 없는 단일 열. 한 curve만 복사한 경우를 안전하게 지원한다.
- Comma-separated/CSV 표는 자동 분할하지 않고 actionable error로 차단한다. 쉼표가 라벨, 천 단위 표기, 소수점 표기와 충돌해 무음 데이터 왜곡을 만들 수 있기 때문이다.
- line break + repeated whitespace 분할은 지원하지 않는다. 공백이 검체/시약명에 포함될 수 있기 때문이다.

권장 UX:
- textarea placeholder에 1행/2행/3행 예시를 짧게 표시한다.
- 사용자는 Excel 범위를 복사해서 그대로 붙여넣을 수 있어야 한다.
- 입력 모드는 segmented control 또는 radio로 표시한다: `전체 표` / `단일 검체`.
- `단일 검체` 모드에서만 검체명 입력칸을 표시한다.
- 모드를 변경하면 기존 preview는 stale로 표시하거나 폐기한다.
- 구분자를 자동 판단하되, 자동 판단 결과를 preview에 표시한다.
- tab이 포함된 입력은 항상 tab-separated로 처리한다.
- tab이 없으면 각 행 전체를 하나의 cell로 해석해 단일 curve 입력을 지원한다.
- comma table, quoted CSV, escaped comma, multiline cell 같은 CSV parser 수준의 형식은 지원하지 않는다. 이 경우 사용자는 Excel 범위를 복사해 tab-separated 형태로 다시 붙여넣는다.

## Preview 정책
붙여넣기 후 즉시 dataset에 반영하지 않는다.

Preview에 표시할 정보:
- 입력 모드.
- 단일 검체 모드일 경우 적용될 검체명.
- 감지된 delimiter.
- curve 수.
- cycle 수.
- specimen/reagent label 목록 요약.
- warning 수와 warning 목록.
- warning 목록은 bounded pagination으로 모든 source location을 확인할 수 있게 한다.
- 첫 N행 데이터 preview. N은 8~12행 수준으로 제한한다.
- source 이름 입력칸. 기본값은 `Paste import N` 또는 현재 시각 기반 이름.
- `EMPTY_FLUORESCENCE_CELL` 또는 `NON_NUMERIC_FLUORESCENCE`로 `null`이 생성되는 경우 결과를 명시하고 확인 checkbox를 거쳐야 import할 수 있다.

Preview에서 제공하지 않는 것:
- cell별 직접 편집 grid.
- 특정 cell만 고치는 UI.
- fluorescence 값 자동 변환 옵션.
- missing header 자동 채우기.
- 비슷한 검체명/시약명 자동 병합.

Preview action:
- `현재 분석에 추가`
- `새 분석으로 열기`
- `다시 붙여넣기`
- `취소`

## Warning 정책
기존 Excel parser 정책과 최대한 일치해야 한다.

필수 warning:
- missing specimen label.
- missing reagent label.
- empty fluorescence cell.
- nonnumeric fluorescence.
- duplicate display label.
- similar specimen label.
- similar reagent label.
- inconsistent effective fluorescence length 가능성.

붙여넣기에서는 row 길이가 서로 다를 수 있으므로 다음 정책을 둔다.
- 전체 행을 최대 column count 기준으로 정규화한다.
- 짧은 행의 누락 cell은 빈 fluorescence 또는 빈 header로 판단한다.
- 완전 빈 trailing rows는 무시한다.
- column별 effective fluorescence length가 다르면 preview summary에 표시하고, 누락된 내부 cell은 기존 `EMPTY_FLUORESCENCE_CELL` warning과 `null`로 표현한다.
- 별도 warning code가 필요해질 경우 구현 단계에서 `PcrWarningCode`와 I/O spec/test plan을 함께 갱신한다. 초기 구현에서는 warning taxonomy를 불필요하게 늘리지 않는다.
- chart는 기존 null 처리와 동일하게 gap을 만든다.

Import 실패 조건:
- 전체 표 모드에서 3행 미만.
- 단일 검체 모드에서 검체명 없음 또는 붙여넣기 표 2행 미만.
- usable curve가 0개.
- 구분 형식 판단 실패 또는 comma/CSV table 감지.
- preview parser 내부 오류.

규모 제한:
- 기능 목적은 소량 데이터 추가다.
- 구현 단계에서 성능 검증 전 hard limit을 임의 확정하지 않는다.
- preview 단계에서 large paste warning을 제공해 사용자가 실수로 전체 workbook 수준의 데이터를 붙여넣은 경우를 인지하게 한다.
- 명확한 성능 문제가 확인되지 않는 한 large paste warning은 import를 차단하지 않는다.
- 구현 안전 상한은 raw text 2,000,000자 또는 정규화 전 250,000 cells이며, 10,000 fluorescence cells를 넘으면 비차단 large-paste 안내를 표시한다.

## 내부 데이터 모델
Quick Paste Import도 `PcrDataset`을 생성해야 한다.

권장 source metadata:
- `sourceKind`: `"paste"`.
- `sourceFileName`: preview source name. 예: `Paste import 1`.
- `sheetName`: `Paste`.
- `sheetIndex`: 0.
- `PcrDataset.sourceKind`: 가능하면 `"paste"`로 둔다. 기존 payload 호환을 위해 optional 필드로 시작하고, 없으면 `"excel"`로 간주한다.
- `CurveSource.sourceKind`: 가능하면 `"paste"`로 둔다. 기존 payload 호환을 위해 optional 필드로 시작하고, 없으면 `"excel"`로 간주한다.
- `CurveSource.sourceInstanceId`: 사용자가 바꿀 수 있는 source name과 독립된 paste source 고유 ID다.
- `CurveSource.inputMode`: `fullTable` 또는 `singleSpecimen`으로 실제 입력 구조를 기록한다.
- `CurveSource.fileName`: preview source name.
- `CurveSource.sheetName`: `Paste`.
- `CurveSource.columnLetter`: 기존 Excel과 동일하게 A, B, C...
- `CurveSource.specimenCell`: A1, B1...
- `CurveSource.reagentCell`: A2, B2...
- `CurveSource.dataStartCell`: A3...
- `CurveSource.dataEndCell`: column + last row.

curveId 정책:
- 단독 parse 결과는 `paste0_col_A`, `paste0_col_B`처럼 source-position 기반 ID를 권장한다.
- 현재 분석에 추가될 때는 기존 append rekey 정책과 충돌하지 않아야 한다.
- 같은 분석에 paste source가 여러 번 추가되어도 append merge가 `fileN_...` prefix 등으로 curveId 충돌을 제거해야 한다.
- source name 변경은 curveId를 바꾸지 않는다. source name은 추적/표시용 metadata이며 selection/style/legend order identity가 아니다.
- selection, legend order, style override, export order는 계속 curveId 기준으로 동작해야 한다.

source summary:
- `SourceFileSummary`는 fileName 필드에 paste source name을 저장한다.
- `SourceFileSummary.sourceKind: "excel" | "paste" | "analysis"`를 추가하는 방향을 우선 검토한다. 기존 Analysis XLSX에는 이 필드가 없으므로 restore 시 missing 값은 `"excel"`로 보정한다.
- Analysis XLSX visible `ImportedData`에서는 붙여넣기 source도 추적 가능해야 한다.

## UI 배치
권장 위치:
- `Excel 데이터` 패널의 파일 선택 / 추가 선택 옆에 `붙여넣기 입력` 버튼을 추가한다.

권장 흐름:
1. 사용자가 `붙여넣기 입력`을 누른다.
2. modal 또는 inline panel이 열린다.
3. 사용자가 표를 붙여넣고 `Preview`를 누른다.
4. 앱이 preview dataset과 warning을 표시한다.
5. 사용자가 `현재 분석에 추가` 또는 `새 분석으로 열기`를 선택한다.
6. 반영 후 기존 데이터 선택/스타일/범례/Export 흐름을 그대로 사용한다.

Dirty state:
- 현재 분석에 추가하면 active analysis는 dirty가 된다.
- 새 분석으로 열면 새 tab은 dirty 상태로 시작한다.
- 기존 dirty replace 확인 흐름은 그대로 유지한다.
- preview가 생성된 시점의 target analysis id를 저장한다.
- target analysis runtime instance와 revision도 함께 저장하며, 확인 전에 target이 닫히거나 변경되면 import를 막고 preview 재생성을 요구한다.
- preview 중 사용자가 다른 analysis tab으로 이동해도 `현재 분석에 추가`는 preview가 만들어진 원래 tab에 적용되어야 한다.
- target tab이 닫혔거나 존재하지 않으면 import를 막고 다시 preview하도록 안내한다.

Selection:
- 붙여넣기 append 결과의 새 curves는 기존 Excel append처럼 기본 unselected가 적합하다.
- 새 분석으로 열 경우도 현재 Excel import와 동일하게 기본 selected curves는 없다.
- major group은 기본 collapsed다.
- 새 분석의 analysis name 기본값은 source name을 따르되, 사용자가 이후 Analysis name에서 수정할 수 있다.

## 단계별 구현 계획

### Phase Q0. 요구사항 및 결정 문서 고정
목표:
- 붙여넣기 import가 수동 편집이 아님을 문서와 decision에 고정한다.
- I/O spec, functional requirements, acceptance criteria에 traceability를 추가한다.

완료 조건:
- `DECISIONS.md`에 Quick Paste Import 결정 추가.
- `docs/02_FUNCTIONAL_REQUIREMENTS_EN.md`에 post-MVP supported input requirement 추가.
- `docs/03_INPUT_OUTPUT_SPEC_EN.md`에 pasted table planned/implemented rules 추가.
- `docs/04_TEST_PLAN_ACCEPTANCE_EN.md`에 acceptance criteria 추가.
- `CHANGELOG.md`와 `DEVELOPMENT_STATE.md`에 계획 문서와 결정 상태를 기록.

검증:
- 문서 간 용어 일치 확인.
- `manual entry`, `editing`, `paste import` 경계가 혼동되지 않는지 리뷰.

구현 프롬프트:
```text
docs/10_QUICK_PASTE_IMPORT_PLAN_KR.md를 기준으로 Phase Q0을 진행하라.
Quick Paste Import는 수동 편집기가 아니라 붙여넣은 원본 표를 import source로 추가하는 기능이다.
DECISIONS.md, docs/02_FUNCTIONAL_REQUIREMENTS_EN.md, docs/03_INPUT_OUTPUT_SPEC_EN.md, docs/04_TEST_PLAN_ACCEPTANCE_EN.md를 갱신하라.
사용자가 확정한 사항: app-side cell editing 금지, 기존 Excel 구조 유지, preview/warning 후 append 또는 new analysis.
불필요한 기능 확장은 하지 말고, CSV file import/custom cycle/manual edit는 제외하라.
문서 갱신 후 다각도 전문가 검토를 수행하고 필요한 보완을 반영하라.
```

### Phase Q1. Paste parser와 dataset builder
목표:
- text input을 기존 `PcrDataset`으로 변환하는 순수 utility를 구현한다.

권장 파일:
- `src/data/parsePastedTable.ts`
- `src/data/parsePastedTable.test.ts`

구현 범위:
- 구분 형식 감지: tab 우선, 구분자 없는 단일 열 지원, comma/CSV table 거부.
- input mode parameter: `fullTable` 또는 `singleSpecimen`.
- singleSpecimen mode에서는 별도 specimen label을 각 curve에 적용하고, 붙여넣기 표의 1행을 reagent row로 해석.
- row normalization.
- 1행 specimen, 2행 reagent, 3행 이후 fluorescence.
- Excel parser와 같은 warning code 재사용.
- 필요한 경우 기존 Excel parser의 column/fluorescence parsing helper를 공통화하되, 리팩터링 범위는 parser parity에 필요한 수준으로 제한.
- paste source metadata 생성.
- raw fluorescence preservation.
- no smoothing/no transform.

완료 조건:
- valid pasted table이 `PcrDataset`으로 변환된다.
- singleSpecimen mode에서 별도 specimen label + reagent/fluorescence table이 `PcrDataset`으로 변환된다.
- empty headers, nonnumeric values, empty cells, duplicate labels, similar labels warning이 동작한다.
- singleSpecimen mode에서 specimen label이 비어 있으면 import failure가 된다.
- uneven row length가 warning과 null로 표현된다.
- quoted/ambiguous comma input과 invalid input은 actionable parse failure를 반환한다.

검증:
- `npm run test -- --run src/data/parsePastedTable.test.ts src/data/parseExcel.test.ts`
- parser output이 existing chart/selection utilities와 호환되는지 unit test.
- 구분 형식 오판으로 인한 데이터 왜곡을 막기 위해 tab, 단일 열, comma/CSV 거부 case를 테스트한다.

구현 프롬프트:
```text
docs/10_QUICK_PASTE_IMPORT_PLAN_KR.md Phase Q1을 구현하라.
붙여넣기 text를 PcrDataset으로 변환하는 src/data/parsePastedTable.ts와 tests를 추가하라.
기존 Excel 구조와 warning 정책을 최대한 재사용하라.
수동 편집, custom cycle, CSV file import는 구현하지 말라.
원본 fluorescence 값은 변환하지 말라.
테스트는 valid tab paste, delimiter-free single-column paste, comma/CSV rejection, missing headers, empty/nonnumeric fluorescence, uneven row length, no usable curves를 포함하라.
singleSpecimen mode 테스트를 포함하라: specimen label + reagent/fluorescence paste, blank specimen label rejection, specimen label change does not affect curveId after preview confirmation.
```

### Phase Q2. Preview state와 UI shell
목표:
- 붙여넣기 입력 modal/panel을 추가하되, 아직 store 반영은 제한적으로 연결한다.

권장 파일:
- `src/ui/PasteImportPanel.tsx`
- `src/ui/PasteImportPanel.test.tsx` 또는 `src/app/App.test.tsx`
- `src/styles.css`

구현 범위:
- `붙여넣기 입력` 버튼.
- input mode control: `전체 표` / `단일 검체`.
- singleSpecimen mode 전용 검체명 입력.
- textarea.
- preview action.
- detected delimiter / curve count / cycle count / warning count.
- read-only preview table.
- source name input.
- large paste warning display.
- cancel / 다시 붙여넣기.
- preview result가 생성된 뒤 textarea 원문이 바뀌면 기존 preview는 stale로 표시하거나 confirm buttons를 비활성화한다.
- preview result가 생성된 뒤 input mode 또는 단일 검체명이 바뀌면 기존 preview는 stale로 표시하거나 confirm buttons를 비활성화한다.
- preview result는 생성 당시 active analysis id를 함께 저장한다.

금지:
- preview table cell editing.
- imported dataset 직접 수정 UI.

완료 조건:
- 붙여넣기 원문 수정은 textarea에서만 가능하다.
- preview table은 read-only다.
- invalid input은 현재 분석을 변경하지 않는다.
- source name 입력은 metadata만 바꾸며, preview table cell 또는 fluorescence 값을 바꾸는 편집 기능으로 오해되지 않아야 한다.
- 단일 검체명 입력은 import 전 header 보완값이며, 기존 dataset의 검체명을 수정하는 기능으로 보이면 안 된다.
- preview 중 tab 전환 후 confirm해도 target tab이 명시적으로 유지되거나, target이 사라진 경우 안전하게 차단된다.

검증:
- Testing Library로 modal open/close, preview, warning display, no mutation 확인.
- Playwright screenshot 또는 DOM smoke.

구현 프롬프트:
```text
docs/10_QUICK_PASTE_IMPORT_PLAN_KR.md Phase Q2를 구현하라.
DataImportPanel에 붙여넣기 입력 버튼을 추가하고 read-only preview modal/panel을 만든다.
입력 모드는 전체 표 모드와 단일 검체 모드를 제공한다. 단일 검체 모드에서는 검체명 입력칸을 표시하고, 붙여넣기 표는 1행 시약 / 2행 이후 fluorescence로 해석한다.
textarea 원문 입력과 preview 생성까지만 UI를 연결하라.
preview table은 수정 불가이며 cell editing grid를 만들지 말라.
invalid preview, stale preview, blank single-specimen label은 active analysis를 변경하지 않아야 한다.
테스트와 브라우저 smoke를 수행하라.
```

### Phase Q3. Store integration: append / new analysis
목표:
- preview dataset을 현재 분석에 append하거나 새 analysis tab으로 열 수 있게 한다.

권장 파일:
- `src/app/appStore.ts`
- `src/app/appStore.test.ts`
- `src/ui/PasteImportPanel.tsx`
- `src/ui/DataImportPanel.tsx`

구현 범위:
- `appendPastedDataset` 또는 generic `appendDataset` action 검토.
- `openPastedDatasetInNewAnalysis` 또는 existing new tab helper 재사용.
- append 시 기존 selection/style/legend order 보존.
- appended paste curves는 unselected.
- 새 분석은 기본 collapsed, selected none.
- dirty state 갱신.
- async race는 file import보다 낮지만 active tab target을 명시적으로 캡처한다.
- preview가 만들어진 target analysis id를 confirm action에 전달한다.
- confirm 시 target analysis id가 존재하지 않으면 import하지 않고 오류/안내를 표시한다.
- preview가 생성된 tab과 confirm action이 적용될 tab이 달라질 수 있으므로, append target analysisId를 preview 생성 또는 confirm 시점에 명확히 고정한다.

완료 조건:
- 현재 분석에 추가가 existing append policy와 동일하게 동작한다.
- 새 분석으로 열기가 independent analysis tab을 만든다.
- Analysis name/source name이 혼동되지 않는다.

검증:
- store tests.
- App tests.
- e2e: paste -> preview -> append -> select -> chart render.
- e2e: paste -> preview -> new analysis -> tab created.

구현 프롬프트:
```text
docs/10_QUICK_PASTE_IMPORT_PLAN_KR.md Phase Q3를 구현하라.
Preview dataset을 현재 분석에 추가하거나 새 analysis tab으로 열 수 있게 store와 UI를 연결하라.
append 시 기존 selected/style/legend order를 보존하고 새 paste curves는 unselected로 둔다.
새 분석으로 열 때 기본 grouping/collapse/selection 정책은 Excel import와 동일하게 유지한다.
dirty state와 target tab 안전성을 테스트하라.
```

### Phase Q4. Analysis XLSX continuity
목표:
- 붙여넣기 source가 Analysis XLSX export/import에서 전체 dataset 일부로 보존되는지 확인하고 보완한다.

권장 파일:
- `src/analysis/analysisWorkbook.ts`
- `src/analysis/analysisWorkbook.test.ts`
- `src/analysis/analysisState.ts`

구현 범위:
- paste source metadata가 hidden restore JSON에 포함되는지 확인.
- visible `ImportedData`에서 source 추적이 가능한지 확인.
- sourceFiles summary에 paste source가 포함되는지 확인.
- restore 후 curveId, selection, style, labels, order가 유지되는지 확인.
- legacy Analysis XLSX payload에는 `sourceKind`가 없을 수 있으므로 restore migration/default 처리 검증.

완료 조건:
- paste data를 포함한 Analysis XLSX를 export하고 다시 import해도 동일하게 분석을 이어갈 수 있다.
- unselected paste curves도 보존된다.
- restored paste curves가 Excel-imported curves와 같은 chart/export pipeline을 사용하되, source review에서는 paste source로 식별된다.

검증:
- Analysis XLSX roundtrip unit test.
- App test 또는 e2e smoke.

구현 프롬프트:
```text
docs/10_QUICK_PASTE_IMPORT_PLAN_KR.md Phase Q4를 구현하라.
Quick Paste Import로 추가된 source가 Analysis XLSX에 전체 dataset 일부로 저장되고 restore되는지 검증하라.
필요 시 visible ImportedData/source summary 표시를 보완하되 native editable Excel chart는 구현하지 말라.
paste source, unselected paste curves, style/order/labels roundtrip 테스트를 추가하라.
```

### Phase Q5. Export/Chart regression
목표:
- paste source curve가 chart, legend, style, plotted CSV, PNG/JPEG export에서 Excel curve와 동일하게 동작하는지 검증한다.

구현 범위:
- chart projection compatibility.
- grouping labels.
- legend order.
- style override.
- plotted CSV header/source disambiguation.
- image export layout.

완료 조건:
- paste curves와 Excel curves가 같은 chart projection pipeline을 탄다.
- export 결과가 current visible/order/label/style을 따른다.

검증:
- focused chart/export tests.
- Playwright visual check.

구현 프롬프트:
```text
docs/10_QUICK_PASTE_IMPORT_PLAN_KR.md Phase Q5를 구현하라.
Quick Paste Import로 들어온 curve가 chart projection, custom legend, style override, plotted CSV, PNG/JPEG export에서 Excel-imported curve와 동일하게 동작하는지 회귀 테스트를 추가하라.
데이터 값 변환이나 자동 보정은 절대 추가하지 말라.
```

### Phase Q6. 문서, 가이드, 릴리스 검증
목표:
- 사용자 가이드와 상태 문서를 갱신하고 배포 전 회귀를 완료한다.

구현 범위:
- first-user guide에 Quick Paste Import 사용법 추가.
- `CHANGELOG.md`, `DEVELOPMENT_STATE.md` 갱신.
- 필요 시 screenshots 갱신.
- full test/build/e2e.
- 사용자 검수 후 commit/deploy.

검증:
- `npm run test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`
- local production preview screenshot.
- 사용자가 원하면 GitHub Pages deploy.

구현 프롬프트:
```text
docs/10_QUICK_PASTE_IMPORT_PLAN_KR.md Phase Q6를 진행하라.
Quick Paste Import 사용법, 제한사항, troubleshooting을 문서와 사용자 가이드에 반영하라.
CHANGELOG.md와 DEVELOPMENT_STATE.md를 갱신하라.
full Vitest, production build, Playwright e2e, visual screenshot review를 수행하라.
커밋/배포는 사용자 확인 후에만 진행하라.
```

## 수용 기준 초안
- AC-QP-001: 사용자는 표 데이터를 붙여넣고 preview를 생성할 수 있다.
- AC-QP-002: preview 생성 전 또는 invalid preview 상태에서는 active analysis가 변경되지 않는다.
- AC-QP-003: preview table은 read-only이며 cell editing UI를 제공하지 않는다.
- AC-QP-004: valid full-table paste input은 기존 Excel 구조와 동일하게 specimen/reagent/fluorescence curves로 해석된다.
- AC-QP-005: missing header, empty fluorescence, nonnumeric fluorescence, similar labels, duplicate labels warning이 표시된다.
- AC-QP-006: 현재 분석에 추가 시 기존 selected/style/legend/export order가 보존되고 새 curves는 unselected로 추가된다.
- AC-QP-007: 새 분석으로 열기 시 독립 analysis tab이 생성된다.
- AC-QP-008: paste source는 Analysis XLSX export/import 후에도 전체 dataset 일부로 복원된다.
- AC-QP-009: paste curves는 chart, custom legend, style, plotted CSV, PNG/JPEG export에서 Excel curves와 같은 pipeline을 사용한다.
- AC-QP-010: fluorescence 값에는 smoothing, normalization, baseline correction, log transform, Ct/Cq calculation이 적용되지 않는다.
- AC-QP-011: paste source는 sourceKind 또는 동등한 metadata로 Excel source와 구분되며, Analysis XLSX hidden restore JSON과 visible review sheet에서 추적 가능하다.
- AC-QP-012: source name 변경은 curveId, selection, style override, legend/export order identity를 변경하지 않는다.
- AC-QP-013: textarea 원문이 preview 후 변경되면 stale preview를 그대로 import할 수 없다.
- AC-QP-014: single-specimen mode는 검체명을 필수로 요구하고, 해당 검체명을 새 paste import source를 구성할 때만 모든 pasted reagent/fluorescence columns에 적용한다.
- AC-QP-015: input mode 또는 single-specimen name이 preview 후 변경되면 stale preview를 그대로 import할 수 없으며, 이미 import된 curves를 변경하지 않는다.
- AC-QP-016: Tab-separated 및 delimiter-free single-column 입력만 허용하고 comma/CSV 표는 명시적으로 거부한다.
- AC-QP-017: null이 되는 warning은 source cell과 chart gap 결과를 표시하고 모든 위치를 bounded pagination으로 확인할 수 있다.
- AC-QP-018: append와 새 분석 열기 모두 preview가 캡처한 target runtime instance/revision이 변경되면 차단한다.
- AC-QP-019: 동일 파일명/worksheet를 반복 가져와도 source instance를 구분하며 Analysis XLSX에서 provenance를 보존한다.
- AC-QP-020: 모바일 viewport에서 dialog footer action은 항상 보이고 body만 스크롤된다.

## 사용자 결정 필요 항목
현재 구현 시작을 막는 필수 결정 항목은 없다.

추후 논의 가능 항목:
- 버튼 문구: `붙여넣기 입력`, `Quick Paste`, `Paste import` 중 최종 UI 명칭.
- source name 기본 규칙: `Paste import N` 또는 사용자 analysis name 기반.
- input mode 문구: `전체 표` / `단일 검체` 또는 더 이해하기 쉬운 한국어 표현.
- 향후 명시적 CSV parser 또는 comma delimiter 선택 기능을 별도 도입할지. 현재 구현은 안전을 위해 comma table을 거부한다.
- future custom cycle input 필요 여부. 현재 계획에서는 제외한다.

## 전문가 검토 체크리스트
- 데이터 무결성: 붙여넣기 기능이 편집기로 오해되지 않는가?
- Traceability: paste source가 Analysis XLSX와 visible review sheet에서 추적 가능한가?
- Parser parity: Excel parser warning과 과도하게 달라지지 않는가?
- Delimiter safety: tab/single-column 외 comma/CSV table이 무음 분할되지 않고 명시적으로 거부되는가?
- Identity safety: source name 수정이 curveId 기반 selection/style/order를 흔들지 않는가?
- UX: preview에서 사용자가 실수 반영을 막을 충분한 정보가 있는가?
- Performance: 소량 입력 목적에 맞게 scope가 제한되어 있는가?
- Regression: append/new analysis/chart/export/Analysis XLSX 경로가 모두 테스트되는가?

## 구현 결과
- Q0-Q6 구현 완료.
- `src/data/parsePastedTable.ts`가 full-table, single-specimen, tab-separated, single-column 입력을 `PcrDataset`으로 변환한다.
- `src/ui/PasteImportPanel.tsx`가 native modal, 직접 paste textarea, 읽기 전용 제한 미리보기, warning 확인, stale preview 차단을 제공한다.
- warning detail은 12개 단위 pagination으로 모든 source cell에 접근 가능하고, 모바일에서는 dialog body만 스크롤되어 footer action이 유지된다.
- 현재 분석 append와 새 분석 열기는 target runtime instance/revision 검증 후 수행되며 새 curve는 unselected다.
- 동일 file metadata의 반복 import도 별도 immutable source instance로 구분된다.
- Analysis XLSX hidden restore JSON과 visible Settings/ImportedData가 Excel/paste source kind, source name, source ID, source column, paste input mode를 보존한다.
- 구버전 Analysis XLSX의 누락 source metadata는 `excel` provenance로 migration된다.
- paste curve는 기존 chart, custom legend, style, plotted CSV, PNG/JPEG/clipboard projection을 그대로 사용한다.
- 커밋과 GitHub Pages 배포는 사용자 검수 후 별도 수행한다.
