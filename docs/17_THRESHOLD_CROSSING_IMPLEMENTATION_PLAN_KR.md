# 17 Threshold 및 교차 Cycle 검토 상세 구현 계획

## 문서 상태

- 상태: Complete; separately committed and deployed as IsoAmplar Plot Analysis T
- 작성일: 2026-07-14
- Owner: Product / Engineering / Data Visualization / QA
- 기준 소스: `6a2fe80d94d3a269a6dc728cd57efa3a7276faa9`
- 선행 기준: `docs/12_AUDIT_REMEDIATION_IMPLEMENTATION_PLAN_KR.md` S0-S11 및 `docs/16_SELECTION_SETS_AND_SELECTED_DATA_XLSX_PLAN_KR.md` T0-T6 release-verified

## 1. 목적

사용자가 하나의 분석 탭에서 fluorescence Threshold를 직접 설정하고 다음 작업을 수행할 수 있게 한다.

1. 현재 plot에 Threshold 수평선을 표시한다.
2. 현재 선택 곡선별 Threshold 교차 지점을 계산하고 검토한다.
3. 계산 결과의 근거가 된 원본 두 점과 예외 상태를 함께 확인한다.
4. plot 이미지, Analysis XLSX 연속성, 선택 데이터 XLSX 후속 검토에 일관되게 반영한다.

이 기능은 **사용자 지정 raw fluorescence 기준선과 교차 위치 검토 기능**이다. Ct/Cq/Tt/Tp, 양성/음성 판정, 정량, 임상 판독 또는 장비 보정 기능으로 확장하지 않는다.

## 2. 압축 안전 요약

- Threshold는 분석 탭별 하나만 지원하며 기본값은 비활성화이다.
- Threshold는 가져온 raw fluorescence 값에 직접 적용한다. smoothing, normalization, baseline correction, log 변환, 평균 또는 원본 수정은 하지 않는다.
- X축은 현재 생성된 `Cycle 1..N`이므로 파생값은 standalone에서도 Ct류 결과로 오인되지 않는 `Cycle축 선형 교차 추정값`으로 표시한다.
- 계산 결과는 파생값이다. `Curve.y`, `Curve.stats`, import warning 또는 원본 workbook 값을 변경하지 않는다.
- 기본 후보는 인접한 유효 원자료가 `y[i-1] < T` 및 `y[i] >= T`를 만족하는 첫 상승 교차이다.
- 관측 Cycle과 두 원자료 사이의 선형 보간 추정 Cycle을 구분하여 보존한다.
- `null`을 가로질러 보간하지 않으며, 시작 시점 이상, 미도달, 결측 불확정, 다중 교차를 숫자 하나로 숨기지 않는다.
- Scale/Box zoom은 Threshold 계산 범위를 자르지 않는다. 계산은 선택 곡선의 전체 원자료를 사용한다.
- Threshold 설정은 Analysis XLSX schema 5에 저장하고, 교차 결과는 복원 후 원자료에서 재계산한다.
- 선택 데이터 XLSX schema 2에는 curve 요약용 `ThresholdResults`와 event 근거용 `ThresholdEvents` 시트를 추가하고 `PlottedData` 원자료 시트는 변경하지 않는다.
- Threshold 계산 활성과 별개로 미리보기 표시와 plot-bearing image/clipboard 포함을 각각 켜고 끌 수 있다. 두 표시 옵션의 기본값은 켜짐이다.
- 이미지 출력의 Plot only/Plot + Legend에는 `includeInPlotExport`가 켜진 경우에만 Threshold 선을 포함하고 Legend only 및 report legend에는 포함하지 않는다.
- 여러 source instance의 곡선에 같은 Threshold를 적용할 때 비교 주의를 표시하지만 계산을 차단하거나 자동 보정하지 않는다.

## 3. 현재 계약에서 변경되는 범위

현재 문서는 자동 threshold/Ct/Cq 계산을 명시적으로 제외한다. 본 기능을 구현하려면 다음 범위를 함께 갱신해야 한다.

- `docs/01_PROJECT_CHARTER_KR.md`: threshold 전체 제외를 사용자 지정 raw Threshold 분석 허용으로 좁힌다.
- `docs/02_FUNCTIONAL_REQUIREMENTS_EN.md`: `FR-023`을 추가한다.
- `docs/03_INPUT_OUTPUT_SPEC_EN.md`: `IO-101`, `IO-106`, `IO-107`을 갱신하고 `IO-108` Threshold 결과 계약을 추가한다.
- `docs/04_TEST_PLAN_ACCEPTANCE_EN.md`: `AC-PCR-056`~`AC-PCR-058`을 추가하고 `AC-PCR-037`, `AC-QP-010`의 금지 범위를 자동/import-time threshold와 임상 판독으로 한정한다.
- `DECISIONS.md`: `D051`에 사용자 지정 raw Threshold의 의미, 계산 규칙 버전, 저장/출력 경계를 기록한다.
- `README.md`, 사용자 가이드, `CHANGELOG.md`, `DEVELOPMENT_STATE.md`: 사용자 표시와 현재 지원 범위를 동기화한다.

문서 갱신은 기존의 다음 불변조건을 완화해서는 안 된다.

- 가져오기 시 Threshold를 자동 계산하거나 적용하지 않는다.
- Threshold로 양성/음성 또는 임상 판독을 자동 생성하지 않는다.
- baseline correction, smoothing, normalization 또는 정량 계산을 추가하지 않는다.
- 원본 fluorescence와 `null` 위치를 변경하지 않는다.

## 4. 용어와 사용자 표시

### 4.1 허용 용어

- 설정 영역: `Threshold`
- 설정·standalone 표시: `User-set raw fluorescence Threshold`
- 결과 영역: `User-set raw Threshold 값 검토`
- 실제 데이터 행: `사용자 지정 raw Threshold 최초 관측 이상점`
- 보간값: `Cycle축 선형 교차 추정값`
- 원자료 근거: `교차 전 원자료`, `교차 후 원자료`
- 데이터 단위 안내: `Raw fluorescence · 보정 없음`

### 4.2 금지 용어

검증된 별도 분석 규칙이 승인되기 전에는 다음 용어를 결과명이나 판정으로 사용하지 않는다.

- Ct, Cq, Tt, Tp
- Positive, Negative, 양성, 음성
- Quantification, 농도, copy number
- 유효/무효 검체 또는 임상 판독

### 4.3 명칭 근거

현재 X축은 실제 시간 metadata가 아니라 가져온 각 행에 생성된 `Cycle 1..N`이다. 따라서 시간 단위 또는 qPCR 정량 용어를 사용하지 않고 생성된 축에서의 교차 위치만 표현한다.

## 5. 과학·데이터 무결성 불변조건

1. 계산 입력은 현재 normalized dataset의 원본 `curve.x`와 `curve.y`이다.
2. fluorescence 숫자는 JavaScript finite number의 원래 정밀도로 계산한다. 계산 전에 반올림하지 않는다.
3. `null`은 결측이며 0으로 대체하거나 앞뒤 값으로 채우지 않는다.
4. Scale, Box zoom, 검색, tree 접힘 상태는 계산 입력을 자르지 않는다.
5. 현재 선택된 곡선만 계산하며 결과 순서는 현재 사용자 legend/export 순서를 따른다.
6. Selection Set 적용은 Threshold 설정을 변경하지 않고 새 선택에 대해 결과만 재계산한다.
7. Threshold 결과는 `curveId`로 곡선과 연결하고 표시명 중복으로 결합하지 않는다.
8. 계산 결과는 import warning이 아니다. 별도 파생 분석 결과 계층에 둔다.
9. source instance가 둘 이상이면 `서로 다른 원본 데이터의 raw fluorescence는 장비/조건 차이의 영향을 받을 수 있습니다.`라는 비교 주의를 표시한다.
10. 주의는 계산, preview 또는 export를 자동 차단하지 않는다.
11. Threshold가 현재 적용 Y축 밖에 있어도 Y축 범위를 자동 변경하지 않는다.
12. Threshold 선이 화면 밖에 있더라도 교차 계산은 전체 원자료를 기준으로 유지한다.

## 6. Threshold 설정 계약

### 6.1 분석 상태 모델

권장 모델은 다음과 같다.

```ts
type ThresholdRuleId = "raw-first-upward-linear-v1";

type AppliedThreshold = {
  value: number;
  ruleId: ThresholdRuleId;
};

type ThresholdSettings = {
  enabled: boolean;
  draftValue: string;
  applied: AppliedThreshold | null;
  showInPreview: boolean;
  includeInPlotExport: boolean;
};
```

- `draftValue`는 사용자가 편집 중인 문자열을 그대로 보존한다.
- `applied`만 chart와 계산에 사용한다.
- `enabled`가 false이면 선과 결과 panel을 비활성화하되 마지막 draft/applied 값은 유지한다.
- `showInPreview`는 미리보기의 선/범위 밖 주석만 제어하며 계산과 결과 panel은 변경하지 않는다.
- `includeInPlotExport`는 Plot only/Plot + Legend/표준 plot-bearing clipboard의 선/범위 밖 주석만 제어한다. Legend only/report legend 출력에는 항상 적용하지 않는다.
- 기본값은 `{ enabled: false, draftValue: "", applied: null, showInPreview: true, includeInPlotExport: true }`이다.
- 계산 규칙은 반드시 `ruleId`로 저장하여 향후 알고리즘 변경 시 기존 결과 의미를 식별할 수 있게 한다.

### 6.2 입력 검증

- 공백, `NaN`, `Infinity`, `-Infinity`는 적용할 수 없다.
- 입력 문법은 부호·10진수·소수·지수 표기만 허용한다. `0x10`, `0b10`, locale comma, 단위가 섞인 문자열은 JavaScript `Number()`의 부가 해석에 맡기지 않고 거부한다.
- 음수와 지수 표기는 raw fluorescence 범위상 허용한다.
- finite number이면 데이터 범위 밖의 값도 적용할 수 있다. 대신 화면 밖/미도달 상태를 명확히 표시한다.
- 값의 UI 표시를 반올림하더라도 내부 applied 값과 XLSX numeric cell은 원래 number를 유지한다.
- 자동으로 Auto Y range를 Threshold에 맞추지 않는다.

### 6.3 Draft/Applied 동작

- `Apply`는 유효한 draft를 applied로 복사하고 `enabled=true`로 설정한 뒤 결과를 재계산한다.
- applied가 없으면 enable 요청을 거부하고 먼저 유효한 값을 적용하도록 안내한다.
- applied 이후 draft가 변경되면 plot과 결과는 마지막 applied 값을 유지하고 `변경값 미적용`을 표시한다.
- draft/applied 일치 여부는 문자열이 아니라 parse된 finite number로 비교한다. 따라서 `1e3`과 `1000`은 같은 값이다.
- `Revert`는 draft를 마지막 applied number의 canonical 문자열로 되돌린다.
- `Clear`는 확인 후 enabled=false, draft empty, applied=null로 초기화한다.
- enabled=true이고 draft/applied가 일치하지 않거나 applied가 없으면 다음 출력만 차단한다.
  - `includeInPlotExport=true`인 Plot only / Plot + Legend PNG·JPEG
  - `includeInPlotExport=true`인 plot-bearing clipboard PNG
  - ThresholdResults를 포함하는 선택 데이터 XLSX
- 다음 출력과 작업은 유지한다.
  - `includeInPlotExport=false`인 Plot only / Plot + Legend 및 plot-bearing clipboard PNG
  - Legend only 및 report legend 출력
  - 원자료만 포함하는 Plotted CSV
  - Analysis XLSX 저장
- 차단 문구는 마지막 applied 값과 미적용 draft를 구분하여 설명한다.

### 6.4 상태 수명

- 새 빈 분석: 기본 비활성 상태.
- 원본 replace: Threshold 설정 초기화.
- Excel/Quick Paste append: 기존 Threshold 설정 유지.
- Selection Set 적용/선택 변경/순서 변경: 설정 유지, 결과 재계산.
- 미리보기/Plot Export 표시 toggle 변경: 계산 결과와 applied 값은 유지하고 대상 renderer의 표시만 변경.
- 탭 전환: 분석 탭별 설정 격리.
- Analysis XLSX restore: draft/applied/enabled/ruleId 정확히 복원하고 결과는 재계산.
- Analysis XLSX schema 1~4 restore: Threshold 비활성 기본값으로 migration하되 schema 3 provenance와 schema 4 Selection Sets capability를 보존한다.
- Box zoom return history와 Threshold 설정은 서로 독립적이다.

## 7. 교차 계산 계약

### 7.1 후보 정의

Threshold를 `T`라고 할 때, 인접한 두 배열 위치 `i-1`, `i`가 모두 finite이고 다음을 만족하면 상승 교차 후보이다.

```text
y[i - 1] < T && y[i] >= T
```

- 배열상 인접한 두 점만 사용한다.
- 두 점 사이에 `null`이 있으면 후보가 아니다.
- `y[i] === T`이면 직접 도달한 교차로 인정한다.
- 숨겨진 epsilon이나 자동 허용오차를 적용하지 않는다.

### 7.2 제공 값

전체 곡선과 정상 후보마다 다음 값을 계산한다.

- `firstObservedAtOrAbovePoint`는 전체 배열에서 가장 이른 finite `y[i] >= T`의 index/x/y이다.
- `upperObservedPoint = { index: i, x: x[i], y: y[i] }`
- `leftPoint = { index: i-1, x: x[i-1], y: y[i-1] }`
- `rightPoint = { index: i, x: x[i], y: y[i] }`
- `interpolatedCycle = x[i-1] + (T - y[i-1]) * (x[i] - x[i-1]) / (y[i] - y[i-1])`

`upperObservedPoint.x`는 실제 관측된 Threshold 이상 지점이며 보간된 교차 위치가 아니다. `interpolatedCycle`은 원자료 자체가 아니라 두 원자료 사이의 선형 추정값임을 UI와 XLSX에 명시한다.

### 7.3 결과 모델

```ts
type ThresholdOutcome =
  | "crossed"
  | "not-reached"
  | "starts-at-threshold"
  | "starts-above-threshold"
  | "indeterminate-leading-gap"
  | "indeterminate-gap"
  | "insufficient-data";

type ThresholdSourceReference = {
  sourceInstanceId?: string;
  sourceKind?: "excel" | "paste";
  sourceName: string;
  worksheet: string;
  columnLetter: string;
  cell: string;
  formulaCacheStatus?: "not-formula" | "used" | "missing";
};

type ThresholdEvidencePoint = {
  index: number;
  x: number;
  y: number;
  source: ThresholdSourceReference;
};

type ThresholdResult = {
  curveId: string;
  threshold: number;
  ruleId: ThresholdRuleId;
  outcome: ThresholdOutcome;
  firstObservedAtOrAbovePoint: { index: number; x: number; y: number } | null;
  candidateCount: number;
  gapEventCount: number;
  hasMissingData: boolean;
  multipleUpwardCrossings: boolean;
  events: Array<{
    eventType: "crossing" | "indeterminate-leading-gap" | "indeterminate-gap" | "missing-data";
    relation: "primary" | "subsequent" | "evidence-only";
    eventIndex: number;
    leftPoint: ThresholdEvidencePoint | null;
    rightPoint: ThresholdEvidencePoint | null;
    interpolatedCycle: number | null;
    interpolationStatus: "finite" | "not-applicable" | "non-finite";
    formulaCacheEvidence: boolean;
    sourceReferences: ThresholdSourceReference[];
  }>;
  firstIndeterminateGap: {
    kind: "leading-gap" | "internal-gap";
    leftPoint: { index: number; x: number; y: number } | null;
    rightPoint: { index: number; x: number; y: number };
    missingStartIndex: number;
    missingEndIndex: number;
    formulaCacheEvidence: boolean;
    sourceReferences: ThresholdSourceReference[];
  } | null;
};
```

- `candidateCount`는 `eventType="crossing"`인 event 수이고 `gapEventCount`는 gap/missing-data event 수이다. 따라서 전체 `events.length = candidateCount + gapEventCount`이다.
- 정상 crossing과 잠재적 결측 crossing을 포함한 모든 gap run을 audit event로 보존한다. 가장 이른 잠재 교차 event만 outcome을 결정하며 이후 crossing/gap은 `subsequent` 또는 `evidence-only`로 유지한다.
- `[below, null, below]`와 trailing gap은 outcome을 `indeterminate-gap`으로 만들지 않지만 `hasMissingData=true`와 evidence-only event로 보존하여 `not-reached`가 완전한 무결측 관측으로 오해되지 않게 한다.
- outcome이 `crossed`일 때만 첫 event를 대표 event로 제공한다.
- outcome이 `starts-at/above` 또는 `indeterminate-*`이면 이후 유효 events가 있어도 대표 관측/보간 필드는 blank로 유지하고 `후속 상승 event`로만 표시한다.
- `candidateCount > 1`이면 `다중 상승 교차` 주의를 반드시 표시하고 모든 event를 details에서 검토할 수 있게 한다.
- 다중 교차를 숨기거나 마지막 교차로 자동 교체하지 않는다.
- event를 구성하는 source cell에 formula cached-value warning이 있으면 해당 event에 근거 flag와 source reference를 연결한다. 수식을 재계산하지 않는다.
- source 근거는 문자열이 아니라 `sourceInstanceId`, source kind/name, worksheet, column, exact cell, formula cache status, raw index/Cycle/value를 가진 구조화 객체로 보존한다. 같은 파일을 반복 추가해도 source instance로 구분한다.
- 선형 추정은 비율을 먼저 계산하는 overflow-resistant 순서로 수행한다. 모든 입력이 finite여도 최종 추정값이 non-finite이면 crossing 근거는 유지하고 `interpolatedCycle=null`, `interpolationStatus="non-finite"`로 기록한다.
- 파생 결과 배열은 Zustand나 workbook hidden JSON의 authoritative data로 저장하지 않는다.

### 7.4 상태 정의

| 상태 | 정의 | 숫자 표시 |
|---|---|---|
| `crossed` | 시간순 첫 잠재 교차 사건이 인접 finite 상승 후보임 | 첫 event의 upper observed point와 보간 추정 Cycle |
| `not-reached` | 두 개 이상의 finite 값이 있고 시간순 유효 후보와 결측 불확정 전이가 없으며 T에 도달한 관측값도 없음 | 없음, UI는 `관측된 교차 없음`으로 표시 |
| `starts-at-threshold` | 첫 유효 원자료가 T와 같아 이전 교차 위치를 알 수 없음 | 첫 유효 Cycle은 근거로 표시, 추정값 없음 |
| `starts-above-threshold` | 첫 유효 원자료가 T보다 높아 교차가 관측 범위 이전일 수 있음 | 첫 유효 Cycle은 근거로 표시, 추정값 없음 |
| `indeterminate-leading-gap` | index 0부터 하나 이상의 `null`이 있고 첫 finite 원자료가 T 이상이어서 관측 시작 이전/결측 중 교차를 구분할 수 없음 | 첫 finite 원자료만 근거로 표시, 추정값 없음 |
| `indeterminate-gap` | 시간순 첫 잠재 교차가 T 미만 finite 값과 T 이상 finite 값 사이의 `null` run에 있어 위치를 보간할 수 없음 | 없음, 양쪽 가장 가까운 원자료만 근거 표시 |
| `insufficient-data` | 위의 시작/leading-gap 상태에 해당하지 않고 finite 원자료가 0개 또는 1개라 교차 유무를 판정할 수 없음 | 없음 |

판정은 배열 acquisition 순서대로 수행한다.

1. finite 값이 없으면 `insufficient-data`다.
2. index 0이 finite이고 T와 같거나 초과하면 finite count와 무관하게 `starts-at/above`다.
3. 하나 이상의 leading `null` 뒤 첫 finite 값이 T 이상이면 `indeterminate-leading-gap`이다.
4. 위 조건에 해당하지 않고 finite count가 1이면 `insufficient-data`다.
5. 그 외에는 시간순으로 **가장 먼저 나타난 잠재 교차 사건**을 판정한다. 인접 finite 후보가 먼저면 `crossed`, T 미만과 T 이상 사이의 internal null run이 먼저면 `indeterminate-gap`이다.

따라서 `[below, null, above, below, above]`는 뒤의 정상 후보보다 앞선 결측 불확정을 우선하여 `indeterminate-gap`으로 표시한다. 이후 유효 event는 숨기지 않고 event list에 보존한다.

index 0의 첫 유효값이 T 이상인 곡선이 이후 다시 내려갔다가 상승하면 outcome은 `starts-at/above`를 유지하되 이후 events를 함께 제공한다. 이로써 관측 범위 이전 교차 가능성과 실제로 관측된 후속 상승 event를 동시에 검토할 수 있다.

### 7.5 계산 범위와 성능

- 계산 복잡도는 선택 곡선의 전체 point 수에 대한 `O(total selected points)`이다.
- dataset, 선택 curveId/order 또는 applied Threshold가 바뀔 때만 memoized 재계산한다.
- pointer move, hover highlight, panel scroll마다 재계산하지 않는다.
- 100곡선 x 100point 합성 데이터에서 반복 계산과 UI 열기 browser smoke를 수행한다.
- Web Worker, 서버 또는 별도 계산 dependency는 도입하지 않는다.
- 제품 restore/input 계약은 계속 정확한 `Cycle 1..N`이다. 순수 계산 모듈의 방어 테스트가 임의 X축 제품 지원을 의미하지 않는다.

## 8. UI/UX 계약

### 8.1 Threshold 설정 영역

- 우측 설정 패널에서 `Scale` 다음에 별도 `Threshold` accordion을 추가한다.
- 기본은 접힌 상태이다.
- compact control 구성:
  - 표시/계산 enable toggle
  - `미리보기 표시` toggle
  - `Plot Export 포함` toggle
  - 숫자 draft input
  - `Apply`
  - 적용값 상태
  - `Revert`
  - icon-sized `Clear`
  - 교차/미도달/검토 필요 요약
  - `결과 열기/닫기`
- Threshold는 Y scale 값이지만 Scale preset과 의미가 다르므로 P1/P2 입력 행에 섞지 않는다.
- 색상/선형 사용자 설정은 1차 범위에 추가하지 않는다.

### 8.2 Chart 표시

- `enabled && applied && showInPreview`일 때 미리보기 Threshold 선을 표시한다.
- Threshold 선은 중립적인 짙은 회색 점선, marker 없음, standalone에서도 의미가 남는 `User-set raw fluorescence Threshold (no correction): <value>` 라벨을 사용한다.
- 첫 visible curve의 silent ECharts `markLine`으로 한 번만 구성한다.
- pseudo-series를 만들지 않아 legend, hover index, curve order, style warning에 섞이지 않게 한다.
- ECharts `MarkLineComponent`를 preview와 lazy image renderer 양쪽에 등록한다.
- 선은 plot grid 안에서만 보이고 custom legend에는 추가하지 않는다.
- Threshold가 실제 렌더된 Y축 extent 밖이면 선을 거짓 경계값에 그리지 않고 `User-set raw fluorescence Threshold (no correction) <value> is above/below the displayed Y range` 주석을 chart 내부에 표시한다.
- Auto Y축은 ECharts가 확정한 실제 렌더 축 extent를 기준으로 판정한다. preview와 lazy export renderer 모두 첫 render 뒤 public pixel conversion/plot containment를 사용하는 동일 helper로 선/주석을 최종 결정하며, 데이터 min/max를 화면 extent로 오인하지 않는다.
- Threshold가 실제 축 min/max와 정확히 같으면 범위 안으로 본다. finite Y가 없는 Auto 축에서는 선을 그리지 않고 `표시 가능한 Y축 데이터가 없음` standalone 주석을 사용한다.
- 범위 밖 주석은 preview와 raster export에서 동일하게 보이고 clip/overlap되지 않아야 한다. 이를 위해 ECharts graphic 또는 동등한 비-series annotation 경로를 양 renderer에 명시적으로 등록·검증한다.
- 범위 밖 상태에서도 Scale을 자동 변경하지 않는다.

### 8.3 값 검토 Panel

- chart의 고정 point readout 아래, custom legend 위에 bounded/collapsible `Threshold 값 검토` panel을 둔다.
- 기본은 닫힌 상태이며 열려도 plot 위를 덮지 않는다.
- 최대 높이를 고정하고 내부 세로 scroll을 사용하여 chart panel 전체 높이가 무제한 증가하지 않게 한다.
- 기본 열:
  - style sample
  - Analysis label
  - Cycle축 선형 교차 추정값
  - 사용자 지정 raw Threshold 최초 관측 이상점
  - 상태
- 행 확장 또는 details에는 threshold, candidate count, 전후 raw X/Y, 원본 specimen/reagent/source instance/file/column을 표시한다.
- 현재 사용자 legend/export 순서를 따른다.
- 검색과 상태 필터를 제공하되 선택 상태를 변경하지 않는다.
- 행 hover/focus는 기존 `curveId` highlight 경로를 재사용하고 pointer exit/blur에서 해제한다.
- chart raw point hover readout에는 보간값을 주입하지 않는다. 관측 point와 파생 crossing을 별도 영역으로 유지한다.
- 1280x720, 1366x768, 1920x1080에서 document horizontal overflow와 incoherent overlap이 없어야 한다.

### 8.4 상태 문구

- 활성/적용: `Raw fluorescence Threshold <value> 적용됨`
- 미적용 draft: `입력값이 아직 적용되지 않았습니다. 현재 plot은 <applied>를 사용합니다.`
- 범위 밖: `User-set raw fluorescence Threshold가 현재 적용 Y축 범위 밖에 있습니다.`
- mixed source: `선택 곡선이 여러 원본 데이터에 속합니다. raw fluorescence 비교 조건을 확인하십시오.`
- 다중 교차: `첫 상승 교차를 표시합니다. 총 <n>개 후보가 있어 검토가 필요합니다.`
- 결과 없음: `현재 선택 곡선이 없거나 적용된 Threshold가 없습니다.`

## 9. Chart와 상호작용 계약

- Auto/Fixed/P1/P2/Box zoom은 Threshold 값을 변경하지 않는다.
- Threshold는 Auto Y domain 계산에 포함하지 않는다.
- Box zoom으로 Threshold가 화면 밖으로 나가도 계산 결과는 유지한다.
- Previous scale은 scale만 복원하고 Threshold를 변경하지 않는다.
- Auto scale도 Threshold를 변경하거나 비활성화하지 않는다.
- curve/legend hover는 Threshold line style을 변경하지 않는다.
- Threshold 결과 행 hover는 곡선만 강조하고 Threshold line은 유지한다.
- curve marker/line style 변경은 계산값을 바꾸지 않는다.
- Analysis label 변경은 결과 표시명만 바꾸고 결과/identity는 유지한다.
- selection/order 변경은 결과 목록을 현재 curveId/order로 다시 투영한다.

## 10. 이미지·클립보드 출력 계약

- Plot only PNG/JPEG: Threshold가 활성·적용 상태이고 `includeInPlotExport=true`이면 선과 라벨 포함.
- Plot + Legend PNG/JPEG: Threshold가 활성·적용 상태이고 `includeInPlotExport=true`이면 plot 부분에만 선과 라벨 포함.
- 각 대상의 표시 toggle이 켜져 있고 applied Threshold가 실제 Y축 밖이면 preview/image/clipboard에 실제 선 대신 값과 above/below 방향을 포함한 범위 밖 주석을 반드시 포함한다.
- 표준 clipboard PNG: 선택된 plot layout과 동일.
- Legend only, report legend PNG/JPEG/clipboard, rich Excel legend clipboard: Threshold 미포함.
- T판 Threshold 값 검토 패널은 상태 필터 옆 복사 아이콘으로 현재 필터 결과를 Excel 표로 복사한다. 일반 Export 패널에는 중복 버튼을 추가하지 않는다.
- 표 열은 `검체`, `시약`, `추정 교차 Cycle`, `결과 상태` 순서다. 유효한 대표 추정값은 숫자로, 추정 불가 상태는 빈 셀로 기록한다.
- 복사 순서는 현재 curve/범례 순서를 따르고, 다중 교차는 `교차 (다중 교차 검토)`로 보존한다. `판정`이나 양성/음성 표현을 사용하지 않는다.
- rich HTML과 TSV를 함께 제공하며 label-like text는 Excel 수식으로 실행되지 않도록 보호한다. 이 동작은 원본판에는 추가하지 않는다.
- 이미지 export는 preview와 동일한 `buildPcrChartOption` 결과를 사용한다.
- white background, 파일명, export counter 규칙은 변경하지 않는다.
- threshold line nonblank/pixel evidence와 preview/download parity를 Playwright에서 확인한다.
- 범위 안 선과 범위 밖 주석을 각각 raster text/pixel evidence로 확인한다.
- threshold draft가 적용되지 않은 활성 상태에서는 plot-bearing output을 차단하고 적용/되돌리기 안내를 표시한다.
- 단, `includeInPlotExport=false`인 plot-bearing output에는 Threshold가 포함되지 않으므로 미적용 draft만을 이유로 차단하지 않는다.

### 10.1 표시 상태 행렬

| 계산 enabled | showInPreview | includeInPlotExport | 미리보기 | Plot-bearing export | 결과/XLSX 계산 |
|---|---:|---:|---|---|---|
| false | 무관 | 무관 | 숨김 | 미포함 | 비활성 |
| true | true | false | 표시 | 미포함 | 유지 |
| true | false | true | 숨김 | 포함 | 유지 |
| true | false | false | 숨김 | 미포함 | 유지 |

Selected Data XLSX의 Threshold 결과는 두 표시 toggle과 무관하고 `enabled + applied + 일치하는 draft` 계약만 따른다. Legend only/report legend는 모든 조합에서 Threshold를 제외한다.

## 11. Analysis XLSX schema 5 계약

### 11.1 저장 항목

- `thresholdSettings.enabled`
- `thresholdSettings.draftValue`
- `thresholdSettings.applied.value` 또는 null
- `thresholdSettings.applied.ruleId` 또는 null
- `thresholdSettings.showInPreview`
- `thresholdSettings.includeInPlotExport`

### 11.2 저장하지 않는 항목

- 곡선별 ThresholdResult 배열
- 결과 panel open/search/filter 상태
- hover/focus 상태
- 계산 cache
- mixed-source advisory의 표시 여부

### 11.3 Migration

- `ANALYSIS_STATE_SCHEMA_VERSION`을 4에서 5로 올린다.
- schema 1~4는 Threshold 비활성 기본값으로 migration한다.
- migration/validation은 명시적 capability predicate를 사용한다: provenance는 schema 3+, Selection Sets는 schema 4+, Threshold는 schema 5+.
- schema 4의 Selection Sets와 active selection set 및 schema 3+ provenance를 그대로 보존해야 한다.
- 기존 schema 버전 비교를 단순히 `schemaVersion === current`로 처리하여 schema 4 Selection Sets를 잃거나 schema 4를 unsupported로 거부하지 않게 한다.
- schema 5는 threshold field 누락, 잘못된 type, non-finite applied value, unknown rule ID, enabled=true/applied=null 모순을 검증한다.
- hidden restore JSON이 authoritative source다.
- visible `Settings` sheet에 enabled, draft, applied, rule ID, `Raw fluorescence / no baseline correction` note를 추가한다.
- 복원 후 결과는 현재 raw curves에서 재계산한다.

## 12. 선택 데이터 XLSX schema 2 계약

### 12.1 Workbook 구조

기존 시트를 유지하고 `ThresholdResults`, `ThresholdEvents`를 추가한다.

1. `PlottedData`: 변경 없음. raw numeric/null과 전체 common X 행 유지.
2. `CurveInfo`: 변경 없음.
3. `Warnings`: 변경 없음.
4. `ExportInfo`: applied Threshold, rule ID, data transform `None`, threshold calculation note 추가.
5. `ThresholdResults`: 현재 선택/order의 곡선별 outcome, 첫 관측 이상점, 대표 event와 요약.
6. `ThresholdEvents`: 모든 인접 상승 event와 결측 불확정 gap의 event-level 원자료/source 근거.
7. hidden `_IsoAmplarSelectedData`: schema version 2 role marker.

### 12.2 ThresholdResults 열

- Order
- Curve ID
- Analysis label
- Original specimen
- Original reagent
- Source instance ID
- Source name
- Source column
- Threshold
- Rule ID
- Outcome
- Candidate count
- Multiple upward crossings
- First observed at-or-above index / Cycle / Fluorescence
- Primary event upper observed Cycle (`crossed` outcome only)
- Primary Cycle-axis linear crossing estimate (`crossed` outcome only)
- Left X / Left Y
- Right X / Right Y
- Note

숫자는 numeric cell, 없음은 blank cell, 사용자/source 문자열은 non-formula/non-hyperlink string cell로 기록한다.
`starts-at/above`와 `indeterminate-*` outcome의 이후 유효 crossing은 primary 열에 승격하지 않는다. primary 열은 blank로 두고 `ThresholdEvents`에서 `subsequent crossing`으로 명시한다.

### 12.3 ThresholdEvents 열

- Curve order
- Curve ID
- Analysis label
- Event type (`crossing`, `indeterminate-leading-gap`, `indeterminate-gap`)
- Event relation (`primary`, `subsequent`, `leading uncertainty`)
- Event number
- Left index / Left X / Left Y
- Right index / Right X / Right Y
- Interpolated cycle
- Formula cached-value evidence
- Source instance/name/column/cell references

`ThresholdEvents`는 valid crossing과 leading/internal gap boundary 모두에 동일한 source/formula-cache provenance를 제공한다. 파생 결과 검토용이며 원본 값이나 수식을 재작성하지 않는다.

### 12.4 제공 조건

- 기존의 non-empty/common-X/rectangular 조건을 유지한다.
- schema 2 writer는 `ThresholdResults`와 `ThresholdEvents` 시트를 항상 생성하여 workbook 구조를 고정한다.
- role inspector는 schema 1과 schema 2를 모두 output-only Selected Data 역할로 인식한다. 새 writer는 schema 2만 생성한다.
- Threshold 비활성 시 시트에는 metadata와 `Threshold disabled` 상태만 기록하고 curve별 가짜 결과를 만들지 않는다.
- Threshold 활성 + 미적용 draft이면 선택 데이터 XLSX를 차단한다.
- Threshold 활성 + applied이면 현재 선택 곡선 결과를 기록한다.
- Scale/Box zoom은 `PlottedData` 행과 Threshold 계산 범위를 자르지 않는다.
- 출력 파일은 앱의 원본/append/Analysis restore 입력으로 계속 거부한다.

## 13. 기존 출력과 비범위

### 13.1 변경하지 않는 출력

- Plotted CSV는 raw rectangular data만 유지하고 Threshold 열을 추가하지 않는다.
- report legend와 rich Excel legend clipboard는 line/marker/label만 유지한다.
- Analysis XLSX에는 native editable chart를 추가하지 않는다.
- 선택 데이터 XLSX의 `PlottedData`에 보간 행이나 Threshold 교차 행을 삽입하지 않는다.

### 13.2 명시적 제외

- 자동 Threshold 추천 또는 negative control 기반 계산
- 여러 Threshold 동시 표시/저장
- Threshold style 사용자 지정
- baseline subtraction/correction
- smoothing, normalization, log transform
- sustained crossing, slope, derivative 또는 sigmoid fitting
- 실제 시간 단위 변환
- Ct/Cq/Tt/Tp 명명
- 양성/음성, 임상 판독, 유효성 판정
- 농도/copy number/표준곡선 정량
- Threshold별 Selection Set 또는 Named View
- 서버 계산 또는 사용자 데이터 전송

## 14. 요구사항·수용기준 초안

### FR-023 초안

> As a user, I want to set one user-defined raw-fluorescence Threshold per analysis and inspect auditable per-curve geometric crossing evidence. The app shall render the applied Threshold without changing chart scale or source data, allow preview visibility and plot-bearing export inclusion to be controlled independently without changing calculations, calculate selected curves using a versioned first-upward adjacent-point rule, distinguish first observed at-or-above points from Cycle-axis linear estimates, expose leading/internal gap, start, and multiple-event outcomes, persist configuration through Analysis XLSX, and export derived evidence separately from raw values. It shall not label the result Ct/Cq/Tt/Tp or make positive/negative or clinical interpretations.

### IO-108 초안

> Threshold analysis is a browser-local derived projection over the current selected curves and full raw X/Y arrays. Applied scale and preview/export visibility toggles do not crop or alter calculation input. Preview and plot-bearing image output use the applied Threshold only when their respective visibility option is enabled; Selected Data XLSX records curve summaries and event evidence in separate result sheets; Analysis XLSX stores only the versioned configuration and recomputes results after restore.

### AC-PCR-056 초안

> One tab-local Threshold supports disabled, draft, applied, revert, clear, append/replace, tab isolation, independent preview/export visibility toggles, and out-of-Y-range states. When enabled for a target, preview and plot-bearing image/clipboard output show the same silent horizontal line or range annotation without altering Auto/Fixed/P1/P2/Box zoom bounds, calculations, or custom legend identity.

### AC-PCR-057 초안

> The versioned raw first-upward rule scans acquisition order, uses only adjacent finite points satisfying `previous < T && current >= T`, never interpolates across null, gives chronological priority to earlier leading/internal gap uncertainty, preserves all event/source evidence and full-precision observed/bracketing values, reports a separate Cycle-axis linear estimate only as primary for `crossed`, and distinguishes crossed, no observed crossing, starts at/above, indeterminate leading/internal gap, insufficient data, and multiple-upward-event cases in current curve order.

### AC-PCR-058 초안

> Analysis XLSX schema 5 roundtrips Threshold draft/applied configuration while schemas 1-4 migrate by explicit capability without losing schema-3 provenance or schema-4 Selection Sets. Selected Data XLSX schema 2 preserves raw `PlottedData`, adds formula-safe result/event sheets, and still recognizes schema-1 files as output-only. Restore recomputes derived results and no output mutates raw fluorescence or performs clinical interpretation.

## 15. 단계별 구현 Phase

| Phase | 목적 | 주요 산출물 | 완료 조건 |
|---|---|---|---|
| TH0 | 범위·결정·baseline 고정 | D051, FR/IO/AC 초안 반영, rollback anchor | 기존 전체 test/build/Playwright 통과 및 사용자 결정 확인 |
| TH1 | 순수 계산 계층 | `threshold.ts`, 결과 model, edge-case tests | 모든 상태·수식·null·다중 교차 단위 테스트 통과 |
| TH2 | 탭 상태와 Analysis XLSX schema 5 | Zustand actions, migration/validation, visible Settings | schema 1~5 roundtrip, tab/append/replace/dirty 테스트 통과 |
| TH3 | Chart line과 이미지 parity | ECharts markLine, preview/export renderer 등록 | preview/PNG/JPEG/clipboard/scale/hover 회귀 통과 |
| TH4 | 설정 및 값 검토 UX | Threshold accordion, bounded result panel, highlight 연동 | component/E2E/desktop visual/accessibility 통과 |
| TH5 | 선택 데이터 XLSX schema 2 | `ThresholdResults`, `ThresholdEvents`, role migration/readback | numeric/null/string/evidence/schema/browser download 통과 |
| TH6 | 통합 안정화 | draft export guard, Selection Set, mixed source, 100x100 성능 | full unit/audit/build/fresh Chromium 반복 통과 |
| TH7 | 문서·가이드·릴리스 | 요구사항/결정/guide/PDF/changelog/state, release evidence | 전문가 최종 GO, CI, Pages, public synthetic smoke 통과 |

### 15.1 현재 실행 상태 - 2026-07-14

- TH0~TH6: 구현 및 로컬 자동/브라우저 검증 완료.
- TH7: README, 요구사항, I/O, 수용기준, changelog, state, release evidence, 합성 screenshot, 사용자 가이드 Markdown/PDF의 로컬 갱신과 검증까지 완료.
- 최종 감사 보완: curve별 event raw bracket/cell/source/formula-cache 근거 표시, 다중 교차 review 통합, 비-primary XLSX note 정합성, 전 outcome/mismatched-draft/out-of-range export 회귀를 추가했다.
- 전체 로컬 gate: Vitest 336/336, audit 1/1, dependency vulnerability 0, production build pass, fresh Chromium 13/13, pre/post `dist` byte equality pass.
- 최종 독립 재감사: prior P1/P2 4건 해소 확인, release-blocking finding 없음, GO.
- 사용자 검수와 별도 T 에디션 배포가 완료되었다. Product source `3b6c6a1`과 rollback tag `release-20260714-threshold-edition`은 `isoamplar-plot-analysis-t`에만 push되었고 Pages run `29302909343` 및 공개 URL smoke가 통과했다. 원본 non-T 저장소와 Pages는 변경하지 않았다.

## 16. 공통 Phase 실행 규칙

모든 Phase는 다음 순서를 따른다.

1. 해당 Phase 관련 문서와 현재 source/test를 읽는다.
2. 이전 Phase test/build baseline이 깨끗한지 확인한다.
3. 새 동작의 실패 테스트 또는 acceptance evidence를 먼저 추가한다.
4. 해당 Phase 범위만 구현한다.
5. focused test, `npm test`, `npm run test:audit`, `npm run build`, `npm run check:diff`를 수행한다.
6. UI/renderer/workbook을 건드린 Phase는 fresh `npm run test:e2e`와 실제 browser 검증을 수행한다.
7. synthetic data만 screenshot/evidence/user guide에 사용한다.
8. 데이터 무결성, 시각화, frontend, QA 관점의 독립 검토를 수행한다.
9. 명백한 보강은 해당 Phase에서 반영하고 테스트를 다시 실행한다.
10. `DEVELOPMENT_STATE.md`, 관련 requirements/IO/AC/decision/changelog를 갱신한다.
11. Phase 완료 후에만 승인된 commit을 만들고 다음 Phase로 이동한다.

## 17. 단계별 구현 프롬프트

### Phase TH0 프롬프트

```text
docs/17_THRESHOLD_CROSSING_IMPLEMENTATION_PLAN_KR.md를 읽고 Phase TH0만 수행하라.

목표:
- 현재 release 상태를 rollback 가능한 commit/tag로 확인한다.
- Threshold가 기존 비범위였다는 사실을 유지하면서 사용자 지정 raw fluorescence Threshold만 새 범위로 승인하는 D051을 작성한다.
- FR-023, IO-108, AC-PCR-056~058을 authoritative 문서에 추가한다.
- AC-PCR-037과 AC-QP-010은 자동/import-time threshold와 임상 판독 금지로 정확히 좁히되 raw fluorescence 불변 조건을 완화하지 않는다.

필수 확인:
- 사용자 결정 항목 UD-TH-01, UD-TH-02, UD-TH-03이 확정되지 않았으면 구현을 시작하지 않는다.
- 기존 Analysis XLSX schema 4 Selection Sets와 Selected Data XLSX schema 1을 baseline fixture로 고정한다.
- npm test, npm run test:audit, npm run build, npm run test:e2e, npm run check:diff를 수행한다.
- 실제 사용자 workbook/label/value를 fixture나 screenshot에 포함하지 않는다.

금지:
- 계산 코드, UI 또는 schema version을 TH0에서 변경하지 않는다.
- Ct/Cq/Tt/Tp, 양성/음성 또는 baseline correction을 범위에 넣지 않는다.
```

### Phase TH1 프롬프트

```text
docs/17_THRESHOLD_CROSSING_IMPLEMENTATION_PLAN_KR.md의 Phase TH1만 수행하라.

src/analysis/threshold.ts에 store/UI/chart renderer와 독립된 순수 Threshold 계산 계층을 구현하라.
입력은 Curve의 원본 x/y와 finite applied Threshold이며, 출력은 curveId, ruleId, outcome, first observed at-or-above point, 전체 crossing events, 첫 결측 불확정 gap이다.

규칙:
- 인접 finite 점에서 previous < T && current >= T만 상승 후보로 인정한다.
- null을 가로질러 보간하지 않는다.
- 배열 acquisition 순서로 첫 잠재 사건을 판정하고, 앞선 null-gap 불확정을 뒤의 유효 crossing으로 덮지 않는다.
- starts-at-threshold, starts-above-threshold, indeterminate-leading-gap, indeterminate-gap, not-reached, insufficient-data를 구분한다.
- first observed at-or-above point와 crossing event를 분리한다.
- 후보가 여러 개이면 첫 후보를 대표로 유지하면서 전체 event list, candidateCount와 multiple flag를 제공한다.
- bracket source cell의 formula cached-value warning과 source reference를 근거로 연결하되 수식을 재계산하지 않는다.
- 계산 전 반올림, smoothing, normalization, baseline correction을 하지 않는다.
- full precision number를 보존하고 표시 formatting은 계산 모듈 밖에 둔다.

테스트:
- exact equality, fractional interpolation, negative/scientific/large values
- leading/trailing/internal null, null 사이의 잠재 교차
- [below, null, above, below, above]에서 indeterminate-gap 우선 및 이후 event 보존
- 첫 finite 값이 threshold와 같음/초과
- [above, below, above]에서 starts-above와 이후 event 동시 보존
- plateau at threshold, downward-only, 여러 상승 교차
- 0/1 finite point, mismatched length 방어
- 100곡선 x 100point iterative 계산 smoke

focused test와 전체 test/build/audit/diff gate를 수행하고 문서를 갱신하라.
```

### Phase TH2 프롬프트

```text
docs/17_THRESHOLD_CROSSING_IMPLEMENTATION_PLAN_KR.md의 Phase TH2만 수행하라.

ThresholdSettings를 분석 탭 Zustand 상태와 Analysis XLSX schema 5에 통합하라.

구현:
- default disabled 상태와 set draft/apply/revert/enable/clear action
- tab isolation, runtime revision/dirty 처리
- append 유지, replace/new analysis 초기화
- Selection Set과 order/label 변경 시 설정 유지
- schema 1~4를 disabled Threshold로 migration
- explicit capability predicate(provenance v3+, Selection Sets v4+, Threshold v5+) 적용
- schema 3 provenance와 schema 4 Selection Sets/activeSelectionSetId 보존
- schema 5 strict type/finite/rule/consistency validation
- visible Settings sheet에 enabled/draft/applied/rule/raw-no-correction note 추가
- 결과 배열과 cache는 저장하지 않고 restore 후 재계산
- dataset load, empty tab, replace, restore, adapter snapshot/application/conversion 등 모든 appStore facade 전파 경로 갱신

검증:
- schema 1,2,3,4,5 exact workbook roundtrip
- corrupt/missing/wrong-type/unknown rule/non-finite payload 무변경 거부
- append/replace/tab switch/close/save-while-modified race
- 각 Threshold mutation 뒤 tab switch를 수행해 active facade와 persisted analysis state가 동일한지 확인
- Analysis XLSX 저장은 invalid/mismatched draft에서도 가능하고 상태를 그대로 보존

focused test와 전체 test/build/audit/diff gate를 수행하고 문서를 갱신하라.
```

### Phase TH3 프롬프트

```text
docs/17_THRESHOLD_CROSSING_IMPLEMENTATION_PLAN_KR.md의 Phase TH3만 수행하라.

적용된 Threshold를 preview와 plot-bearing image export에 일관되게 렌더링하라.

구현:
- buildPcrChartOption에 ThresholdSettings 또는 resolved applied Threshold 입력 추가
- SettingsPanel의 반복 option-builder 호출을 하나의 `buildCurrentChart` 경로로 수렴시켜 모든 image/clipboard export가 같은 입력을 사용하도록 함
- 첫 visible curve에 silent markLine 하나만 부착
- symbol 없음, 중립 점선, Threshold 값 label
- MarkLineComponent를 ChartView와 lazy export renderer 양쪽에 등록
- Y range 밖에서는 실제 line을 경계에 옮겨 그리지 않고 값/above-below 방향을 가진 non-series chart annotation을 preview/export 양쪽에 등록
- pseudo-series, custom legend item, hover readout point를 만들지 않음
- Auto/Fixed/P1/P2/Box zoom scale domain을 Threshold로 변경하지 않음
- applied Y range 밖 상태 계산과 사용자 안내
- Plot only/Plot + Legend/clipboard PNG에는 포함, Legend only/report legend에는 제외

회귀:
- curve/legend hover 및 marker 유지
- Box zoom/Previous scale/Auto scale
- selection 0/1/20+, reorder, duplicate label
- invalid/mismatched draft plot output guard
- preview/download raster의 범위 안 line과 범위 밖 annotation 위치/label, white background, nonblank pixel evidence

focused test, 전체 test/build/audit, fresh Playwright, 실제 desktop browser를 수행하고 문서를 갱신하라.
```

### Phase TH4 프롬프트

```text
docs/17_THRESHOLD_CROSSING_IMPLEMENTATION_PLAN_KR.md의 Phase TH4만 수행하라.

우측 Scale 다음에 compact Threshold accordion을 추가하고, chart readout 아래에 bounded/collapsible Threshold 값 검토 panel을 구현하라.

설정 UI:
- enable, draft input, Apply, Revert, icon-sized Clear
- applied/draft mismatch, Y-range outside, mixed-source, 결과 summary
- 기본 접힘, 기존 control size/typography와 일치

결과 UI:
- 현재 selected/order/Analysis label 기준
- style sample, Cycle축 선형 교차 추정값, user-set raw Threshold first observed at-or-above point, 상태
- details에 threshold/rule/candidate count/전체 events/첫 결측 gap/전후 raw point/source identity/formula-cache evidence
- primary 관측/보간 열은 outcome=crossed일 때만 채우고 starts/indeterminate outcome의 이후 event는 `후속 상승 event`로만 표시
- 검색과 상태 filter는 결과 표시만 바꾸며 selection을 변경하지 않음
- 행 hover/focus는 curveId 기반 기존 highlight를 재사용하고 확실히 해제
- raw point readout과 interpolated crossing을 섞지 않음
- 최대 높이와 내부 scroll로 chart panel의 무제한 증가 방지

검증:
- no dataset, no selection, disabled, invalid draft, applied, all outcome states
- keyboard/focus/aria-live/accessible name
- 20/100 result rows, long Korean/English/source label
- 1280x720, 1366x768, 1920x1080 overflow/overlap/sticky chart
- tab switch 및 Selection Set 전환 후 stale 결과/hover 없음

component/E2E/visual과 전체 gate를 수행하고 문서를 갱신하라.
```

### Phase TH5 프롬프트

```text
docs/17_THRESHOLD_CROSSING_IMPLEMENTATION_PLAN_KR.md의 Phase TH5만 수행하라.

Selected Data XLSX를 schema 2로 올리고 고정된 ThresholdResults 및 ThresholdEvents 시트를 추가하라.

계약:
- PlottedData/CurveInfo/Warnings의 원본 numeric/null/string 계약을 변경하지 않는다.
- ExportInfo에 applied Threshold, rule ID, no-transform note를 기록한다.
- ThresholdResults에 current order, curve/source identity, outcome, first observed at-or-above point, candidate count를 기록하고 outcome=crossed일 때만 대표 event/보간 열을 채운다.
- ThresholdEvents에 모든 crossing event와 first indeterminate gap의 index/X/Y/source/formula-cache evidence를 기록한다.
- 숫자는 numeric cell, 없음은 blank, 문자열은 formula/hyperlink가 없는 literal cell이다.
- disabled이면 metadata와 Threshold disabled 상태만 기록하고 가짜 곡선 결과를 만들지 않는다.
- enabled+applied이면 결과를 기록하고 enabled+unapplied draft이면 다운로드를 차단한다.
- 새 writer는 role marker schema 2를 쓰고 inspector는 schema 1과 2를 모두 output-only로 인식하여 목적별 input-role rejection을 유지한다.
- Plotted CSV와 report legend clipboard에는 Threshold 결과를 추가하지 않는다.

테스트:
- workbook sheet/readback/order/numeric/null/large/scientific/formula-like strings
- old schema 1 및 new schema 2 role detection/rejection
- all outcomes, mixed source, duplicate Analysis labels
- starts/indeterminate outcome에서 primary 열 blank 및 subsequent event 분리
- full common X rows despite Fixed/Box zoom
- browser download/counter/tab race/failure retry
- workbook에 native chart, formula, hyperlink, external link 없음

focused test와 전체 test/build/audit/fresh Playwright/browser gate를 수행하고 문서를 갱신하라.
```

### Phase TH6 프롬프트

```text
docs/17_THRESHOLD_CROSSING_IMPLEMENTATION_PLAN_KR.md의 Phase TH6만 수행하라.

Threshold 전체 통합 회귀와 안정화를 수행하라.

필수 시나리오:
- Excel 및 Quick Paste raw data에서 동일 계산 계약
- append 후 mixed-source advisory와 기존 Threshold 유지
- Selection Set 2개 전환 시 결과 membership/order 즉시 갱신
- Analysis label/style/order 변경 시 identity와 계산값 유지
- Analysis XLSX schema 1~5 roundtrip 및 selected data schema 2 출력
- invalid draft output matrix: plot image/clipboard/selected XLSX 차단, legend/report/CSV/Analysis XLSX 유지
- 100곡선 x 100point result open/search/hover/export
- null gap, first-above, multiple crossing, threshold outside scale의 합성 browser evidence
- zero unexpected network request와 browser-local 처리

npm test, npm run test:audit, npm audit --omit=dev --audit-level=high, npm run build, npm run test:e2e, npm run check:diff를 수행한다.
fresh dist hash와 Pages base path를 검증하고 독립적인 데이터 무결성/UX/QA 감사를 수행하라.
명백한 보강은 TH6에서 반영하고 전체 gate를 다시 실행하라.
```

### Phase TH7 프롬프트

```text
docs/17_THRESHOLD_CROSSING_IMPLEMENTATION_PLAN_KR.md의 Phase TH7만 수행하라.

Threshold 기능의 문서, 사용자 가이드, release evidence, commit/push/Pages 배포를 완료하라.

갱신:
- AGENTS.md는 workflow/quality gate가 실제로 바뀐 경우에만 수정
- DEVELOPMENT_STATE.md, DECISIONS.md, CHANGELOG.md, README.md
- docs/01, 02, 03, 04, 08, 13, 15, 17
- 최초 사용자 가이드 Markdown/PDF

가이드 요구:
- synthetic data와 synthetic screenshot만 사용
- Threshold 설정, 적용/되돌리기, 결과 상태, 관측/보간 차이, mixed-source 주의, XLSX 결과 시트, troubleshooting 설명
- Ct/Cq/Tt/Tp 또는 양성/음성 판정 기능이 아님을 명시
- 실제 사용자 workbook, label, disease/test name, fluorescence 값을 포함하지 않음
- PDF 전체 page render와 글자 겹침/잘림/한글 encoding을 확인
- docs/08은 command/pass criteria만 유지하고 정확한 test count/hash/run ID는 docs/15와 DEVELOPMENT_STATE에 기록하여 수치 drift를 방지

release gate:
- full unit/audit/dependency/build/fresh Chromium/exact-dist/network/raster/clipboard/Analysis XLSX/Selected Data XLSX 통과
- 독립 전문가 최종 감사 GO
- commit 및 승인된 branch/main push
- GitHub Pages workflow 성공
- public synthetic smoke에서 line, 결과, schema 5 restore, schema 2 download/readback, no overflow/error/network 확인

검증된 product source SHA와 CI/Pages run을 DEVELOPMENT_STATE.md에 기록하라.
```

## 18. 필수 테스트 매트릭스

| 영역 | 필수 사례 |
|---|---|
| 숫자 입력 | blank, whitespace, 0, negative, decimal, scientific, large finite, NaN/Infinity 거부 |
| 정상 교차 | exact threshold, fractional interpolation, non-unit/increasing X 검증 |
| 시작 상태 | index 0 finite equals/above, leading null 후 equals/above의 별도 outcome, 0/1 finite precedence |
| 결측 | internal null, multi-null run, null 사이 잠재 교차, chronological gap 우선, trailing null, all null |
| 다중 교차 | 2개 이상 상승 후보, first candidate 유지, 전체 event/count/주의 표시 |
| 미도달 | 모든 finite 값이 Threshold 미만, downward-only, plateau below |
| 데이터 불변 | x/y/null/stats/warnings/source provenance byte/structural equality |
| Selection | 0/1/20/100 curves, Selection Set 전환, reorder, group mode 변경 |
| Scale | Auto/Fixed/P1/P2, Threshold inside/outside, Box zoom/Previous/Auto |
| Chart | single markLine, range-outside standalone annotation, no pseudo-series, hover/marker/legend identity 유지 |
| UI | draft/applied/revert/clear, summary, bounded panel, search/filter, keyboard/focus |
| Analysis XLSX | schema 1~4 migration, schema 5 exact roundtrip, corrupt payload 무변경 거부 |
| Selected XLSX | schema 1/2 role 호환, schema 2 fixed sheets, raw PlottedData, ThresholdResults/Events, formula safety |
| Export | Plot only/+Legend/clipboard 포함, Legend/report 제외, counter/race/error |
| Source | Excel, Quick Paste, same source, mixed sources, duplicate file metadata |
| 성능 | 100 x 100 계산/panel/hover/export, pointer move에서 재계산 없음 |
| 보안·개인정보 | browser-local, no new network, synthetic-only evidence |

## 19. 전문가 검토 체크리스트

### 분자진단·분석 의미

- raw fluorescence Threshold임이 모든 화면과 출력에서 분명한가.
- 관측값과 선형 보간 추정값이 혼동되지 않는가.
- 시작 이상, 결측 불확정, 다중 교차가 숫자 하나로 숨겨지지 않는가.
- source/장비/조건 차이를 자동 보정하거나 판정하지 않는가.
- Ct/Cq/Tt/Tp 또는 양성/음성 의미를 암시하지 않는가.

### 데이터 무결성

- `Curve.y`, `Curve.stats`, warnings, source identity가 변경되지 않는가.
- null을 가로질러 계산하거나 scale로 계산 범위를 자르지 않는가.
- 결과가 항상 applied Threshold와 rule ID에서 재현되는가.
- persisted 결과가 원자료보다 authoritative해지지 않는가.

### Frontend·시각화

- markLine이 legend/hover/order/style에 pseudo curve로 섞이지 않는가.
- preview와 raster export가 동일한가.
- 결과 panel이 plot을 가리거나 settings scroll을 과도하게 늘리지 않는가.
- 20~100곡선에서도 label/상태/source가 연결되는가.

### 상태·Excel

- schema 4 Selection Sets가 schema 5 migration에서 보존되는가.
- Analysis XLSX는 설정만 저장하고 결과를 재계산하는가.
- Selected Data XLSX는 raw 시트와 파생 결과 시트를 분리하는가.
- formula/hyperlink/external-link 안전성과 role marker가 유지되는가.

### QA·릴리스

- 각 Phase가 focused/full/build/browser/docs gate를 통과했는가.
- 합성 edge-case evidence가 충분한가.
- 실제 데이터 또는 민감 label이 repo, screenshot, PDF, CI artifact에 없는가.
- GitHub Pages와 localhost에서 동일하게 동작하는가.

## 20. 사용자 결정 필요 항목

### UD-TH-01: 계산 입력의 의미 - 승인됨

- 결정 필요: Threshold를 **보정하지 않은 raw fluorescence에 직접 적용**하는 기능으로 한정할지 여부.
- 권장안: 승인. 현재 앱의 원본 불변 원칙과 일치하고 baseline correction을 잘못 일반화하는 위험을 피한다.
- 다른 선택의 영향: baseline-corrected Threshold를 원하면 보정 규칙, control, 장비/시약별 검증이 필요한 별도 프로젝트 범위가 된다.
- 구현 차단 Phase: TH1 이후 전체.

### UD-TH-02: 주 표시값 - 승인됨

- 결정 필요: 결과 목록에서 무엇을 주 값으로 강조할지.
- 권장안: `Cycle축 선형 교차 추정값`을 주 열로 두고 `사용자 지정 raw Threshold 최초 관측 이상점`과 전후 raw point를 항상 함께 제공한다.
- 보수안: 사용자 지정 raw Threshold 최초 관측 이상점을 주 값으로 두고 Cycle축 선형 추정값은 보조 열로 둔다.
- 공통 계약: 둘 다 저장·표시하며 보간값을 관측값 또는 Ct/Cq로 부르지 않는다.
- 구현 차단 Phase: TH4 UI 최종화. TH1 계산은 두 값을 모두 산출하도록 진행 가능하다.

### UD-TH-03: Threshold 적용 범위 - 승인됨

- 결정 필요: 첫 버전의 Threshold를 분석 탭 전체에 하나만 둘지, source/reagent/curve별 복수 Threshold까지 허용할지.
- 권장안: **분석 탭당 하나**만 승인한다. 현재 사용 흐름의 동일 기준 비교에 맞고 Scale/Selection Set/Analysis XLSX와의 상태 복잡성을 제한한다.
- 다른 선택의 영향: source/reagent/curve별 Threshold는 결과 비교, UI, 저장 schema, legend/export 표현이 달라지는 별도 기능 설계가 필요하다.
- 구현 차단 Phase: TH1 상태/API 고정 전.

### 승인 기록

- 2026-07-14: UD-TH-01 권장안 승인 - 보정하지 않은 raw fluorescence에 직접 적용.
- 2026-07-14: UD-TH-02 권장안 승인 - Cycle축 선형 교차 추정값을 주 값으로 표시하고 실제 관측점과 원자료 근거를 함께 제공.
- 2026-07-14: UD-TH-03 권장안 승인 - 분석 탭당 Threshold 하나.
- 2026-07-14: 미리보기 Threshold 표시와 plot-bearing export Threshold 포함을 각각 on/off 가능하게 하고 기본값은 둘 다 on으로 확정.

### 운영 중 사용자 판단

여러 source instance, 장비 조건, dye 또는 실험 조건의 raw fluorescence가 동일 Threshold로 비교 가능한지는 앱이 판정할 수 없다. 구현 결정으로 고정하지 않고 매 분석에서 사용자가 판단하며, 앱은 source identity와 비교 주의만 제공한다.

## 21. 명백한 보강으로 선반영한 사항

다음은 사용자 업무 판단이 아니라 데이터 무결성과 현재 아키텍처 연속성을 위한 보강으로 본 계획에 직접 포함했다.

- draft/applied 분리와 미적용 상태 output guard.
- versioned rule ID.
- null-gap, starts-above, multiple-crossing 상태 분리.
- first observed at-or-above point와 전체 crossing event의 분리.
- chronological first-event 판정으로 앞선 결측 불확정을 뒤의 정상 교차가 숨기지 않음.
- full-data 계산과 Scale 독립성.
- mixed-source advisory.
- 결과 cache/배열 비영구 저장과 restore 재계산.
- Analysis XLSX schema 4 Selection Sets migration 보존.
- capability-based Analysis XLSX migration과 appStore tab facade 전 경로 검증.
- Selected Data XLSX schema 1 역할 호환 및 raw/result/event sheet 분리.
- preview/export option-builder 경로 수렴.
- pseudo-series 금지와 markLine 단일 등록.
- pointer hover 경로에서 계산 배제.
- synthetic-only test/screenshot/guide evidence.

## 22. 완료 정의

기능은 다음 조건을 모두 만족할 때만 완료로 본다.

1. 사용자 결정 UD-TH-01/02/03이 기록되어 있다.
2. D051/D054, FR-023/FR-024, IO-108/IO-109, AC-PCR-056~060과 기존 금지 문구가 모순 없이 갱신되어 있다.
3. 모든 결과가 versioned raw first-upward rule로 재현된다.
4. 원본 fluorescence/null/source/warning이 변경되지 않는다.
5. preview와 plot-bearing image output이 동일한 Threshold를 표시한다.
6. Threshold가 Y축 밖인 standalone plot에도 값과 범위 방향을 가진 raw/no-correction 주석이 남는다.
7. Analysis XLSX schema 1~5와 Selected Data XLSX schema 1/2 role/readback이 strict gate를 통과한다.
8. Selection Sets, Quick Paste, Box zoom, hover, style, legend, export counter가 회귀하지 않는다.
9. 1280/1366/1920 desktop browser에서 overlap/overflow가 없다.
10. unit/audit/dependency/build/fresh Chromium/exact-dist/network/raster gate가 통과한다.
11. 사용자 가이드 PDF와 public synthetic smoke가 현재 배포본과 일치한다.
12. 독립 전문가 감사에서 데이터 의미, 상태/Excel, desktop UX, QA/release가 모두 GO이다.
