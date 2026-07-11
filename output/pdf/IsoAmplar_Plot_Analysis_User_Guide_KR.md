# IsoAmplar Plot Analysis 최초 사용자용 상세 가이드

- 앱: https://siun-comp.github.io/isoamplar-plot-analysis/
- 개발자: Jang Si Un
- 가이드 기준일: 2026-07-11
- 예시 데이터: `Synthetic Sample`, `Control Sample`, `Assay 1`, `Assay 2`, `Reference`와 합성 fluorescence 값만 사용

이 도구는 LAMP 증폭형광 데이터를 브라우저에서 선택, 비교, 시각화하고 결과를 내보내기 위한 분석 보조 도구다. 임상 판독, 양성/음성 판단, threshold 자동 산정, Ct/Cq 계산 도구가 아니다.

## 1. 빠른 시작

1. Excel 파일을 가져오거나 `붙여넣기 입력`을 연다.
2. 데이터 형식과 warning을 확인한다.
3. 시약별 또는 검체별 보기에서 비교할 curve만 선택한다.
4. Scale, Style, Legend, Analysis Labels를 조정한다.
5. PNG/JPEG, Clipboard PNG, Legend 출력, Plotted CSV 중 목적에 맞는 결과를 만든다.
6. 나중에 분석을 이어갈 경우 Analysis XLSX를 저장한다.

## 2. Excel 입력 형식

앱은 `.xls`와 `.xlsx`의 첫 번째 worksheet만 사용한다. 각 열은 하나의 curve다.

| 위치 | 의미 | 합성 예시 |
| --- | --- | --- |
| 1행 | 검체 또는 조건 이름 | Synthetic Sample |
| 2행 | 시약 또는 채널 이름 | Assay 1 |
| 3행 이후 | Cycle 순서의 fluorescence 숫자 | 0.12, 0.18, 0.42 |

- X축은 가장 긴 데이터 열을 기준으로 `Cycle 1..N`을 생성한다.
- 수식은 workbook에 cached numeric value가 있을 때만 읽으며 앱이 재계산하지 않는다.
- 검체명이나 시약명이 비어 있어도 fluorescence가 있으면 curve를 가져오고 warning을 표시한다.
- 내부 빈 값과 숫자가 아닌 값은 `null`로 처리해 선을 연결하지 않는다.
- 원본 숫자에 smoothing, normalization, baseline correction, log transform, averaging, Ct/Cq 계산을 적용하지 않는다.

## 3. 소량 표 붙여넣기

Quick Paste Import는 비교용 curve 몇 개를 추가하기 위해 새 Excel 파일을 만드는 부담을 줄이는 기능이다. spreadsheet 편집기가 아니며, 이미 가져온 데이터를 앱 안에서 수정하지 않는다.

### 검체명·시약명 포함 모드

Excel 입력과 같은 구조를 붙여넣는다.

```text
Synthetic Sample<Tab>Synthetic Sample<Tab>Control Sample
Assay 1<Tab>Assay 2<Tab>Reference
0.12<Tab>0.10<Tab>0.08
0.18<Tab>0.15<Tab>0.09
```

### 한 검체의 시약별 값 모드

검체명을 별도 입력하고, 붙여넣은 표의 1행을 시약명, 2행 이후를 fluorescence로 해석한다.

```text
검체명: Comparison Sample

Assay 1<Tab>Assay 2
0.12<Tab>0.10
0.18<Tab>0.15
```

검체명은 새 import source를 구성할 때만 사용한다. 이미 가져온 curve의 검체명을 바꾸는 기능이 아니다.

### 지원 구분 형식과 제한

- Excel 범위 복사에서 생성되는 Tab 구분 표를 지원한다.
- curve 하나만 복사한 구분자 없는 단일 열을 지원한다.
- comma/CSV 표는 자동 해석하지 않는다. 쉼표가 라벨, 천 단위, 소수점과 충돌해 데이터가 잘못 분리될 수 있기 때문이다.
- custom Cycle 열, quoted CSV, multiline cell, CSV file import는 지원하지 않는다.
- raw text 2,000,000자 또는 250,000 cells를 넘으면 브라우저 안전을 위해 차단한다.
- 10,000 fluorescence cells를 넘으면 대량 입력 안내를 표시하지만 안전 상한 이하면 가져오기를 막지 않는다.

### 미리보기와 warning

`미리보기 생성` 전에는 분석 데이터가 바뀌지 않는다. 미리보기는 읽기 전용이며 다음 정보를 보여준다.

- 구분 방식, curve 수, Cycle 수, warning 수
- 검체명과 시약명
- 처음 12개 curve와 처음 10개 Cycle
- warning 위치와 처리 결과
- 반영 대상 analysis tab

빈 fluorescence 또는 숫자가 아닌 값이 `null`로 바뀌는 경우, 해당 위치와 그래프 gap 결과를 확인하는 checkbox를 선택해야 가져오기 버튼이 활성화된다.

미리보기 후 textarea, 입력 모드, 단일 검체명을 바꾸면 미리보기가 stale 상태가 된다. 원래 값으로 되돌려도 다시 미리보기를 생성해야 한다. 가져오기 이름만 바꾸는 것은 fluorescence를 다시 해석하지 않으며 curve identity도 바꾸지 않는다.

### 반영 방식

- `현재 분석에 추가`: 기존 selection, scale, style, label, legend/export order를 유지하고 새 curve를 unselected로 끝에 추가한다.
- `새 분석으로 열기`: 독립 analysis tab을 만들고 새 curve는 모두 unselected, 대분류는 접힌 상태로 시작한다.
- 미리보기를 만든 분석이 닫히거나 변경되면 stale 반영을 차단하고 다시 미리보기를 요구한다.

![Quick Paste preview](../../docs/gui_mockups/screenshots/quick_paste_preview.png)

## 4. 화면 구성

| 영역 | 역할 |
| --- | --- |
| Analysis tabs | 여러 분석을 독립적으로 열고 이름, dirty 상태를 관리 |
| 데이터 가져오기 | Excel 파일 선택, 추가 선택, 붙여넣기 입력 |
| 데이터 선택 | 시약별/검체별 분류, 검색, 필터, curve 선택 |
| 그래프 미리보기 | 선택 curve, Box zoom, point readout, custom legend |
| 설정 | Scale, Style, Legend, Export |

![Synthetic chart after Quick Paste](../../docs/gui_mockups/screenshots/quick_paste_chart.png)

## 5. 데이터 선택과 검색

- 기본 보기는 시약별이다.
- 검체별 보기로 바꿔도 selection은 `curveId` 기준으로 유지된다.
- import 직후 모든 대분류 그룹은 접힌 상태다.
- 검색은 접힌 그룹을 포함한 전체 dataset에 적용된다.
- `표시 선택`과 `표시 해제`는 현재 검색/필터 조건 전체에 적용된다.
- 20개 초과 curve는 가독성 warning과 보조 action을 제공하지만 preview/export를 차단하지 않는다.

## 6. Scale과 Box zoom

| 모드 | 설명 | 권장 상황 |
| --- | --- | --- |
| Auto | 현재 표시 curve에 맞춰 범위 계산 | 초기 탐색 |
| Fixed | 사용자가 min/max 직접 지정 | 비교 이미지의 축 통일 |
| P1/P2 | 분석별 사용자 preset | 반복 범위 전환 |
| Box zoom | plot area를 사각형으로 선택해 Fixed 범위 적용 | 복잡한 구간 확대 |

Box zoom은 데이터 자체를 자르거나 변환하지 않는다. `Previous scale`은 Box zoom 전 scale로 한 단계씩 돌아가고, `Auto scale`은 양 축을 Auto로 바꾸며 return history를 지운다.

## 7. Style, Legend, Analysis Labels

- 색상, 선, 마커 기준을 검체별 또는 시약별로 지정할 수 있다.
- 기본 curve는 실선, 마커 없음이다.
- 선은 실선/점선/도트, 마커는 없음/원형/세모/네모를 지원한다.
- 개별 curve override는 그룹 기준보다 우선하며 `Custom` 또는 `Preset` 상태로 구분된다.
- Legend Order는 현재 사용자 순서이며 chart/export/CSV가 같은 순서를 따른다.
- Analysis Labels는 chart legend, report legend, Excel legend copy, plotted CSV header, Analysis XLSX에 적용된다.
- Reset은 원본 검체/시약 기반 라벨로 되돌리며 원본 source metadata는 바뀌지 않는다.

## 8. Export

| 출력 | 용도 | 주요 규칙 |
| --- | --- | --- |
| PNG/JPEG | 그래프 이미지 | 흰 배경, `YYMMDD_분석명_plotN.ext` |
| Clipboard PNG | 문서에 바로 붙여넣기 | 브라우저 clipboard 권한 필요 |
| Legend Clipboard PNG | 여러 plot과 하나의 legend 조합 | report-readable legend 사용 |
| Copy for Excel | style sample과 label을 Excel의 별도 cell에 붙여넣기 | Chrome/Edge rich clipboard 권장 |
| Plotted CSV | 현재 표시 curve의 공통 X축 데이터 | 직사각형 CSV일 때만 활성화 |
| Analysis XLSX | 전체 dataset과 설정 저장 | 선택하지 않은 curve도 포함 |

## 9. Analysis XLSX로 분석 이어가기

Analysis XLSX는 Excel 안에서 편집하는 chart workbook이 아니라 IsoAmplar 웹 앱의 restore file이다.

저장 항목:

- 전체 imported dataset와 warning
- 선택/미선택, 그룹/검색 상태, 사용자 순서
- X/Y scale, P1/P2, style, individual override
- Analysis Labels, legend/export 설정
- analysis name과 export counter
- Excel/paste source type, immutable source ID, source name, column, paste input mode

Excel과 paste가 섞인 분석도 모든 source와 unselected curve를 포함한다. 구버전 Analysis XLSX에 source type이 없으면 Excel source로 안전하게 복원한다.

저장 중 현재 분석이 바뀌면 생성된 파일은 저장 시작 시점 snapshot이고, live analysis는 Unsaved로 유지되며 자동으로 닫히지 않는다.

## 10. Warning과 문제 해결

| 상황 | 앱 동작 | 권장 조치 |
| --- | --- | --- |
| 검체명 비어 있음 | curve를 가져오고 missing specimen warning | 원본 또는 paste source 확인 |
| 시약명 비어 있음 | curve를 가져오고 missing reagent warning | 원본 또는 paste source 확인 |
| 두 header 모두 비어 있음 | fluorescence가 있으면 두 warning과 함께 import | 의도한 curve인지 확인 |
| 빈 fluorescence | `null`, graph gap | 누락이 의도인지 확인 |
| 숫자가 아닌 fluorescence | 원문 token warning, `null`, graph gap | 메모/단위 혼입 확인 |
| curve별 길이 차이 | 가장 긴 길이에 맞춰 짧은 curve를 `null`로 채움 | 장비 export와 비교 목적 확인 |
| comma/CSV paste | import 전 차단 | Excel 범위를 Tab 형식으로 다시 복사 |
| 여러 worksheet | 첫 번째 worksheet만 사용 | 분석 sheet를 첫 번째로 배치 |
| formula cache 없음 | 앱이 계산하지 않고 warning | Excel에서 계산 후 저장 |
| clipboard 실패 | fallback message | HTTPS Chrome/Edge 또는 파일 저장 사용 |
| stale paste preview | 가져오기 버튼 비활성화 | 현재 내용으로 미리보기 재생성 |
| stale Analysis XLSX save | live analysis를 Unsaved로 유지 | 현재 상태를 다시 저장 |

유효한 숫자 text는 finite decimal/scientific number로 변환해 같은 수치로 plot한다. 예를 들어 `1e3`은 숫자 `1000`으로 저장된다. 표시 문자열 모양 자체가 아니라 숫자 값의 보존이 보장된다. `NaN`, infinity, hexadecimal, 천 단위 쉼표, decimal comma는 숫자로 인정하지 않는다.

## 11. 권장 작업 흐름

1. 대량 데이터는 Excel 첫 worksheet에 정리한다.
2. 중간 비교용 소량 curve만 Quick Paste로 추가한다.
3. warning과 null 처리 결과를 확인한다.
4. 비교 목적에 필요한 curve만 선택한다.
5. Scale을 통일하고 그룹 Style을 먼저 적용한다.
6. 필요한 curve만 개별 override하고 Analysis Labels를 정리한다.
7. 이미지/legend/CSV를 목적에 맞게 export한다.
8. 분석을 이어갈 가능성이 있으면 Analysis XLSX를 저장하고 다시 열어 확인한다.

## 12. 현재 제한사항

- CSV file import와 comma/CSV paste parsing은 제공하지 않는다.
- worksheet picker, custom Cycle 열, source cell 편집은 제공하지 않는다.
- 이미 import된 검체명, 시약명, fluorescence를 앱 안에서 수정하지 않는다.
- native editable Excel chart를 생성하지 않는다.
- 자동 threshold, Ct/Cq, 임상 판독 계산을 제공하지 않는다.
- clipboard는 브라우저/보안 정책에 따라 실패할 수 있다.

## 13. 최종 검수 체크리스트

- [ ] 실제 민감 label 대신 합성 또는 익명화 label을 사용했는가?
- [ ] warning과 null gap을 확인했는가?
- [ ] 선택 curve와 Legend Order가 의도한 비교 순서인가?
- [ ] X/Y scale이 비교 목적에 맞는가?
- [ ] Style과 Analysis Labels가 export에 일관되게 반영되는가?
- [ ] PNG/JPEG 또는 clipboard 결과를 실제 문서에서 확인했는가?
- [ ] Analysis XLSX를 다시 열어 전체 source와 설정이 유지되는가?
