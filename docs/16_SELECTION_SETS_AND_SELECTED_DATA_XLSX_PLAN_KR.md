# 16 선택 세트 및 선택 데이터 XLSX 상세 구현 계획

## 문서 상태

- 상태: Implemented and release-verified
- 작성일: 2026-07-12
- Owner: Product / Engineering / QA
- 선행 기준: `docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md` S0-S11 released

## 1. 목적

반복적인 조건 비교에서 여러 곡선을 매번 다시 체크하는 작업을 줄이고, 현재 선택한 곡선의 원본 수치를 Excel에서 후속 정리할 수 있도록 다음 두 기능을 추가한다.

1. 분석 탭 안에서 곡선 선택 조합을 이름으로 저장하고 즉시 전환하는 `선택 세트`.
2. 현재 선택 곡선의 원본 수치와 추적 정보를 담는 `선택 데이터 XLSX`.

`선택 곡선을 새 분석으로 복사` 기능은 데이터 subset 재구성 비용과 선택 세트와의 기능 중복을 고려하여 명시적으로 폐기한다.

## 2. 압축 안전 요약

- 선택 세트는 현재 분석 탭 안에서만 유효하며 `curveId` 목록으로 곡선 구성만 저장한다.
- 선택 세트 적용은 현재 선택을 덮어쓴다. Scale, style, Analysis label, legend/export order, 검색, 접힘 상태는 바꾸지 않는다.
- 선택 세트는 Analysis XLSX에 저장·복원하며 브라우저 영구 저장은 추가하지 않는다.
- 데이터 append 시 기존 선택 세트는 유지하고 새 곡선을 자동 포함하지 않는다. 원본 데이터 replace 시 선택 세트는 초기화한다.
- `선택 데이터 XLSX`는 현재 사용자 순서의 선택 곡선만 포함하고 fluorescence 값을 보정·변환하지 않는다.
- `선택 데이터 XLSX`와 `Analysis XLSX`는 서로 다른 목적의 파일이다. 전자는 Excel 후속 정리용이며 앱 작업 복원 파일이 아니다.
- 기존 Plotted CSV는 호환성을 위해 `기타 형식`에 보조 출력으로 유지한다.
- native editable Excel chart, 선택 세트별 Scale/style/label/order, 선택 subset 새 분석 생성은 범위 밖이다.

## 3. 고정 불변조건

1. fluorescence 숫자와 `null`은 원본 상태를 유지한다. 보간, smoothing, normalization, baseline correction, log 변환, 평균, Ct/Cq 계산을 하지 않는다.
2. 선택 세트와 현재 선택은 `curveId` 기준으로 연결한다.
3. Analysis label은 원본 specimen/reagent/source identity를 대체하지 않는다.
4. 선택 데이터 XLSX의 열 순서는 현재 사용자 legend/export 순서를 따른다.
5. Box zoom과 X/Y 표시 Scale은 내보내는 데이터 행을 자르지 않는다.
6. Analysis XLSX는 계속 미선택 곡선을 포함한 전체 imported dataset과 모든 분석 설정을 저장한다.
7. 기존 schema 1~3 Analysis XLSX는 선택 세트가 없는 상태로 정상 복원되어야 한다.

## 4. 범위

### 4.1 포함

- 현재 선택으로 선택 세트 생성.
- 선택 세트 적용, 이름 변경, 현재 선택으로 업데이트, 삭제.
- 적용 직전 선택 1회 복원.
- 현재 선택과 적용된 세트가 다르면 `수정됨` 상태 표시.
- 분석 탭별 선택 세트 격리.
- Analysis XLSX schema 4 저장·복원과 schema 1~3 migration.
- append/replace/새 분석 탭 동작과 선택 세트 계약.
- 선택 데이터 XLSX 생성, 파일 저장, 파일명 규칙, 시트 구조.
- Export 패널에서 선택 데이터 XLSX를 주 데이터 출력으로 표시하고 CSV를 보조화.
- 단위, 상태, 컴포넌트, Analysis XLSX roundtrip, Playwright 테스트.

### 4.2 제외

- 선택 곡선을 새 분석 탭으로 복사.
- 선택 세트별 Scale, P1/P2, style, Analysis label, legend order 저장.
- 선택 세트 자동 생성 또는 유사 조건 자동 묶음.
- 새로 append된 곡선의 기존 세트 자동 포함.
- 선택 데이터 XLSX를 Analysis XLSX처럼 앱 작업 상태로 복원.
- 선택 데이터 XLSX에 native Excel chart 삽입.
- CSV import 또는 앱 내 데이터 편집.

## 5. 선택 세트 제품 계약

### 5.1 용어

- 사용자 표시명: `선택 세트`.
- `분석 그룹`, `프리셋`, `Named View`라는 명칭은 사용하지 않는다.
- 이유: 검체/시약 그룹, Style preset, 향후 확장된 전체 화면 상태와 혼동을 방지한다.

### 5.2 저장 모델

```ts
type SelectionSet = {
  selectionSetId: string;
  name: string;
  curveIds: string[];
};
```

- `curveIds`는 중복이 없어야 하며 현재 dataset의 curve만 참조해야 한다.
- 세트는 곡선 membership만 저장한다. 표시 순서는 현재 전역 `orderedCurveIds`의 투영을 사용한다.
- 이름은 trim 후 비어 있을 수 없으며 같은 분석 안에서 대소문자를 무시한 중복 이름을 허용하지 않는다.
- 임의 hard limit은 두지 않는다. 빈 선택은 세트로 저장할 수 없다.

분석 상태에는 다음을 추가한다.

```ts
selectionSets: SelectionSet[];
activeSelectionSetId: string | null;
```

- 적용 전 선택 복원 snapshot은 runtime-only로 유지하고 Analysis XLSX에는 저장하지 않는다. snapshot은 `selectedCurveIds`, `activeSelectionSetId`, `datasetId`를 함께 보존한다.
- `activeSelectionSetId`는 저장·복원한다. 현재 선택이 해당 세트와 다르면 UI에서 파생된 `수정됨` 상태로 표시한다.
- 드롭다운에서 고른 적용 후보는 UI runtime-only `pendingSelectionSetId`로 관리한다. 후보 변경만으로 선택, active ID, dirty/revision을 바꾸지 않는다.

### 5.3 동작

- 생성: 현재 선택을 새 세트로 저장하고 해당 세트를 active로 둔다.
- 적용: 사용자가 `적용`을 눌렀을 때만 후보 세트의 `curveIds`로 현재 선택 전체를 덮어쓰고 active ID를 갱신한다. 같은 active 세트를 같은 membership으로 적용하면 no-op이다.
- 업데이트: active 세트의 membership을 현재 선택으로 교체한다.
- 이름 변경: membership은 유지한다.
- 삭제: 세트만 삭제하며 현재 선택은 유지한다.
- 1회 복원: `적용 전 선택으로 돌아가기`로 마지막 세트 적용 직전의 현재 선택과 active ID를 함께 복원한다.
- 수동 checkbox, 검색 일괄 선택/해제, 그룹 선택이 active 세트 membership과 달라지면 `수정됨`으로 표시하되 세트를 자동 저장하지 않는다.
- 빈 현재 선택으로 세트를 생성하거나 업데이트할 수 없다.
- 업데이트 전에는 세트 이름, 기존 곡선 수, 변경 후 곡선 수를 보여주는 인라인 확인을 거친다.
- 삭제는 앱 내부 확인 UI를 사용한다. active 세트 삭제 시 active ID만 `null`로 바꾸고 현재 선택은 유지하며, non-active 세트 삭제는 active 상태에 영향을 주지 않는다.
- 복원 snapshot은 복원 완료, 이후 수동 선택 변경, 다른 세트 적용, append/replace, Analysis XLSX restore, 대상 세트 삭제, 분석 탭 종료 시 폐기한다.
- append: 기존 세트와 active 상태를 유지한다. 새 curve는 기존 세트에 들어가지 않으며 복원 snapshot은 폐기한다.
- replace/new empty analysis: 선택 세트와 active 상태를 비운다.
- Analysis XLSX restore: 세트와 active 상태를 정확히 복원하고 runtime-only 복원 snapshot은 비운다.

### 5.4 UI

- 위치: 좌측 `데이터 선택` 패널에서 현재 선택 개수와 tree 사이.
- 기본 상태: 데이터가 있을 때 compact한 `선택 세트` 영역을 표시한다. 세트가 없으면 `현재 선택을 새 세트로 저장` 버튼 하나만 표시한다.
- 기본 제어: 세트 select, `적용`, `현재 선택 저장`.
- 관리 제어: 이름 변경, 현재 선택으로 업데이트, 삭제는 compact details/menu 안에 배치한다.
- 생성/이름 변경은 인라인 입력과 명시적 확인/취소를 사용한다. browser prompt는 사용하지 않는다.
- destructive delete는 세트 이름을 포함한 확인을 사용한다. 삭제는 원본 데이터나 현재 선택을 삭제하지 않는다는 점을 문구로 구분한다.
- 키보드와 accessible name을 제공하고 tree의 가로폭을 늘리지 않는다.
- 세트 목록을 세로 행으로 나열하지 않는다. 긴 이름은 말줄임하되 hover/focus에서 전체 이름을 제공한다.
- 260px 폭에서 가로 overflow가 없어야 하고, 관리 UI가 닫힌 기본 상태에서 tree 시작 위치 증가는 약 80px 이내로 제한한다.

## 6. Analysis XLSX schema 계약

- `ANALYSIS_STATE_SCHEMA_VERSION`을 3에서 4로 올린다.
- schema 4는 `selectionSets`와 `activeSelectionSetId`를 저장한다.
- schema 1~3 migration 결과는 `selectionSets: []`, `activeSelectionSetId: null`이다.
- schema 4 validation:
  - selection set ID와 이름은 nonblank/unique.
  - 각 `curveIds` 배열은 unique.
  - 모든 curve ID는 dataset에 존재.
  - active ID는 `null`이거나 존재하는 세트 ID.
  - 세트가 빈 curve 목록을 가지면 restore를 거부.
- visible `SelectionSets` review sheet에는 세트별 곡선을 한 행씩 기록한다. 세트 ID/이름/active 여부/curveId/Analysis label/원본 specimen·reagent/source instance·파일·열/현재 전역 순서 투영 순번을 포함한다. hidden restore payload가 authoritative source다.
- 기존 schema의 fluorescence, provenance, warning, style, scale validation은 완화하지 않는다.

## 7. 선택 데이터 XLSX 계약

### 7.1 역할과 명칭

- 사용자 표시명: `선택 데이터 XLSX`.
- 목적: 현재 선택한 곡선 수치를 Excel에서 후속 정리·검토.
- `Analysis XLSX`와 달리 앱의 전체 작업 상태를 복원하지 않는다.
- 원본 데이터 입력 파일로 오인하지 않도록 전용 hidden marker sheet에 선택 데이터 workbook marker와 schema version을 기록한다.
- `원본 데이터 열기`, `Excel 추가`, `저장한 분석 열기`는 workbook 역할을 먼저 판별한다. 선택 데이터 XLSX이면 상태 변경 전에 `선택 데이터 XLSX는 Excel 후속 분석용이며 원본 입력 또는 분석 복원 파일이 아닙니다.`라고 안내하고 거부한다.

### 7.2 제공 조건

- 선택 곡선이 한 개 이상이어야 한다.
- 1차 구현은 기존 Plotted CSV와 동일하게 모든 선택 곡선이 동일한 X 배열을 공유하는 직사각형 projection에서만 제공한다.
- 조건이 맞지 않으면 다운로드를 비활성화하고 이유를 표시한다. 곡선을 자르거나 X값을 보정하지 않는다.

### 7.3 시트

1. `PlottedData`
   - 첫 열 `Cycle`, 이후 현재 사용자 순서의 선택 곡선.
   - header는 최종 Analysis label을 우선 사용하고 중복 시 source suffix를 붙여 고유하게 한다.
   - 숫자는 Excel numeric cell, `null`은 blank cell.
2. `CurveInfo`
   - 순서, curveId, Analysis label, 원본 specimen, 원본 reagent, source kind, source name, worksheet/input mode, source column, point count, warning count.
3. `Warnings`
   - 선택 곡선에 적용되는 warning을 code/severity/handling/message/curveId/source identity/위치/raw·display value/format/formula cache provenance와 함께 기록한다.
   - curve, source, dataset 수준 warning을 포함하되 선택 곡선과 관계없는 curve-only warning은 제외한다.
4. `ExportInfo`
   - marker, 분석명, export 시각, 곡선 수, X/Y applied Scale mode와 bounds, fluorescence transform `None`.
   - Scale은 표시 metadata일 뿐이며 모든 공통 X 행을 출력한다는 점을 기록한다. invalid draft가 있어도 마지막 유효 applied Scale만 기록하고 XLSX 출력을 차단하지 않는다.

### 7.4 안전 규칙

- 모든 사용자·원본 문자열은 formula 또는 hyperlink cell로 생성하지 않는다. 선택 세트명, 분석명, Analysis label, specimen/reagent, 파일·worksheet·source 이름, warning 문자열이 `=`, `+`, `-`, `@`로 시작해도 원문을 바꾸지 않은 string cell이며 `cell.f`와 hyperlink가 없어야 한다.
- label 안전 처리는 XLSX 산출물에만 적용하고 앱 상태와 Analysis XLSX 원본 label을 변경하지 않는다.
- 현재 표시 Scale에 관계없이 공통 X의 모든 행을 포함한다.
- 파일명은 `YYMMDD_analysisName_plotN_data.xlsx` 규칙을 사용한다.
- workbook에는 native chart, 매크로, 외부 링크를 넣지 않는다.
- 성공적으로 파일이 생성되고 다운로드가 시작된 출력만 `plotN` counter를 소비한다. 생성 실패는 counter를 바꾸지 않는다.

## 8. 구현 Phase

| Phase | 목적 | 완료 조건 |
|---|---|---|
| T0 | 계약·회귀 기준 고정 | 계획/요구사항/수용기준 초안과 baseline test 확인 |
| T1 | 선택 세트 순수 모델 | 생성·적용·수정 판정·validation 단위 테스트 |
| T2 | Store와 schema 4 | 탭 격리, append/replace, schema migration, roundtrip 통과 |
| T3 | 선택 세트 UI | 생성·적용·업데이트·이름 변경·삭제·복원 component/E2E 통과 |
| T4 | 선택 데이터 XLSX | 4개 review 시트와 marker, 수치·null·label·warning·metadata·파일명 테스트 통과 |
| T5 | Export UI 통합 | XLSX primary, CSV secondary, 명확한 역할 설명과 상태 처리 |
| T6 | 전체 검증·문서·배포 | full test/build/Playwright/browser/문서/전문가 검토/Pages 통과 |

## 9. 단계별 구현 프롬프트

### Phase T0 프롬프트

```text
docs/16_SELECTION_SETS_AND_SELECTED_DATA_XLSX_PLAN_KR.md의 T0를 수행하라.
현재 schema 3 Analysis XLSX, SelectionState, Plotted CSV 계약을 먼저 읽고 신규 요구사항과 수용기준을 문서에 연결하라.
새 기능 구현 전 기존 test/build baseline을 확인한다.
원본 fluorescence, curveId, provenance 계약을 변경하지 마라.
```

### Phase T1 프롬프트

```text
선택 세트의 순수 모델과 테스트를 구현하라.
세트는 selectionSetId/name/curveIds만 저장하며 적용은 현재 선택을 덮어쓴다.
membership 비교, 이름 정규화/중복 검사, unknown curveId 거부를 store와 분리된 순수 함수로 검증하라.
Scale/style/label/order를 세트에 추가하지 마라.
```

### Phase T2 프롬프트

```text
선택 세트를 분석 탭 Zustand 상태와 Analysis XLSX schema 4에 통합하라.
schema 1~3은 빈 선택 세트로 migration하고 schema 4 semantic validation을 추가하라.
append는 기존 세트를 유지하고 신규 curve를 자동 포함하지 않으며 replace는 초기화한다.
탭 격리, dirty/revision, save/restore roundtrip 회귀 테스트를 수행하라.
```

### Phase T3 프롬프트

```text
좌측 데이터 선택 패널에 compact한 선택 세트 UI를 구현하라.
현재 선택 저장, 적용, 업데이트, 이름 변경, 삭제, 적용 전 선택 1회 복원을 제공한다.
active 세트와 현재 선택이 다르면 수정됨을 표시하고 자동 덮어쓰지 않는다.
인라인 이름 입력, 키보드/accessible name, 좁은 좌측 패널의 overflow를 검증하라.
```

### Phase T4 프롬프트

```text
SheetJS/xlsx로 선택 데이터 XLSX writer를 구현하라.
PlottedData, CurveInfo, Warnings, ExportInfo 시트와 전용 hidden marker를 만들고 현재 사용자 순서, Analysis label, source/warning provenance, raw numeric/null을 보존하라.
공통 X 직사각형 조건을 유지하고 scale로 행을 자르지 마라.
formula-like label이 formula cell이 되지 않음과 native chart/외부 링크 부재를 테스트하라.
```

### Phase T5 프롬프트

```text
Export의 Data 영역에서 선택 데이터 XLSX를 primary action으로 연결하라.
Analysis XLSX와 역할이 다름을 상시 짧게 설명하고 Plotted CSV는 기타 형식 details로 이동하라.
파일명, export counter, async analysis-tab isolation, error message를 기존 export 계약과 일치시켜라.
```

### Phase T6 프롬프트

```text
선택 세트와 선택 데이터 XLSX 전체 회귀를 수행하라.
npm test, npm build, fresh Playwright, 1280/1366/1920 desktop browser, GitHub Pages base path를 검증한다.
Analysis XLSX schema 1~4 roundtrip, append, tab isolation, XLSX numeric/null/formula safety, raw fluorescence 불변을 재확인한다.
관련 requirements/I-O/test/decisions/changelog/development state/user guide를 갱신하고 전문가 최종 감사를 수행한다.
검증된 변경만 commit/push/deploy한다.
```

## 10. 필수 테스트 매트릭스

| 영역 | 필수 사례 |
|---|---|
| 선택 세트 모델 | 생성, 덮어쓰기 적용, 수정됨 판정, 빈 선택/중복 이름/unknown curve 거부 |
| 선택 세트 수명 | append 유지, replace 초기화, 탭 격리, active/non-active 삭제, 적용 전 선택과 active ID 복원, stale snapshot 폐기 |
| Analysis XLSX | schema 1~3 migration, schema 4 exact roundtrip, corrupt set/active ID 거부 |
| PlottedData | 현재 순서, 숫자 cell, null blank, 음수·지수·대형 숫자, 전체 X 행 |
| Label 안전성 | Analysis label, 중복 label suffix, formula-like label string cell |
| Metadata | specimen/reagent/source instance/cells/range/finite/null/warning, applied Scale, transform None |
| UI | 후보/active 구분, update/delete 확인, 260px overflow 없음, 0/1/20세트, keyboard/focus, dirty/modified 상태, CSV secondary disclosure |
| 파일 역할 | 선택 데이터 marker를 원본/추가/Analysis 열기에서 무변경 거부, 명확한 역할 안내 |
| 회귀 | chart/legend/export order, raw fluorescence, box zoom, Quick Paste, Excel append, Analysis save |

## 11. 전문가 검토 체크리스트

- 분자진단 workflow: 반복 조건 비교가 탭 복제 없이 해결되는가.
- 데이터 무결성: 세트 전환과 XLSX 출력이 값이나 원본 identity를 바꾸지 않는가.
- 상태 아키텍처: schema migration, 탭 격리, append/replace가 명시적인가.
- Excel 안전성: 숫자/null/string/formula 동작이 실제 workbook cell에서 검증되는가.
- 데스크톱 UX: 좌측 패널과 Export 영역이 더 복잡해지지 않는가.
- QA/release: 기존 Analysis XLSX와 Pages 배포 회귀가 없는가.

## 11.1 구현 결과

- T0-T5 구현 완료: 상태 모델, Analysis XLSX schema 4, 선택 세트 UI, 선택 데이터 XLSX writer, Export 통합, 파일 역할 차단을 적용했다.
- 선택 세트는 현재 분석의 `curveId` 구성만 저장하며, 적용 후보와 현재 적용 세트를 분리하고 수동 선택 변경 시 `수정됨`을 표시한다.
- 선택 데이터 XLSX는 `PlottedData`, `CurveInfo`, `Warnings`, `ExportInfo` 및 숨김 역할 marker를 포함하며 앱 복원 입력으로 사용되지 않는다.
- Analysis XLSX는 전체 imported dataset과 선택 세트를 함께 보존하고 schema 1-3을 선택 세트가 없는 schema 4 상태로 migration한다.
- 단위·상태·컴포넌트·workbook readback·Playwright 회귀와 합성 데이터 화면 증거를 추가했다. 최종 로컬 게이트는 Vitest 293/293, audit 1/1, Chromium 12/12, production dependency vulnerability 0, build 성공이며 세 독립 전문가 재감사는 모두 GO이다. 최종 product source `6c57afb`는 branch CI `29161091055`와 Pages `29161173159`를 통과했고 공개 합성 smoke도 통과했다.

## 12. 사용자 결정 필요 항목

현재 구현을 막는 미결정 항목은 없다.

다음 항목은 실제 사용 후 별도 판단하며 이번 범위에서 확정하지 않는다.

- CSV 출력 완전 제거 여부.
- 선택 세트별 Scale/style/label/order를 포함하는 확장 Named View.
- 공통 X가 아닌 곡선을 위한 long-form 또는 curve-pair XLSX 형식.
