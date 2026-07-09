# 07 PCR Fixture and Snapshot Plan

## Purpose
PCR graph web app의 Excel parser, normalized model, selection, chart, export 테스트에 사용할 fixture 목록과 expected snapshot 구조를 정의한다.

## Status
Active draft

## Last Updated
2026-07-09

## Owner
QA / Engineering / Agent

## Compression-Safe Summary
- 이 문서는 Pre-Phase 산출물이다.
- source app code는 아직 만들지 않는다.
- MVP parser fixture는 `.xlsx`와 `.xls`, 첫 번째 worksheet only, row 1 specimen, row 2 reagent, row 3+ fluorescence 기준이다.
- `graph_TEST.xlsx`는 실제 사용자 예시 기반 baseline fixture 후보이며, 앱에 데이터나 스타일을 하드코딩하면 안 된다.
- expected normalized snapshot은 `curveId` 기준 identity, source 위치, specimen/reagent label, generated cycle X, raw fluorescence Y, warnings를 검증한다.
- 모든 fixture는 원본 PCR fluorescence 값을 자동 보정, smoothing, normalization, 평균화, Ct/Cq 계산하지 않는 것을 전제로 한다.

## Update Rule
fixture 파일을 추가하거나 parser warning 정책, normalized model, curve ID 규칙, export projection 규칙이 바뀌면 이 문서를 갱신한다.

---

# 0. Planned Fixture Manifest

Phase 0/1/2에서 실제 fixture 파일과 expected snapshot을 만들 때 아래 경로를 사용한다.

| ID | Planned Source Path | Planned Snapshot Path | Linked ACs | Primary Warnings / Errors |
| --- | --- | --- | --- | --- |
| FX-001 | `tests/fixtures/source/graph_TEST.xlsx` | `tests/fixtures/expected/FX-001.graph-test.snapshot.json` | AC-PCR-001, 006, 019 | `SIMILAR_SPECIMEN_LABEL` |
| FX-002 | `tests/fixtures/source/FX-002.one-specimen-eight-reagents.xlsx` | `tests/fixtures/expected/FX-002.snapshot.json` | AC-PCR-001, 003, 018 | none |
| FX-003 | `tests/fixtures/source/FX-003.one-specimen-eight-reagents.xls` | `tests/fixtures/expected/FX-003.snapshot.json` | AC-PCR-016 | none |
| FX-004 | `tests/fixtures/source/FX-004.old-biff-korean-labels.xls` | `tests/fixtures/expected/FX-004.snapshot.json` | AC-PCR-016 | encoding/mojibake guard |
| FX-005 | `tests/fixtures/source/FX-005.many-specimens-shared-reagents.xlsx` | `tests/fixtures/expected/FX-005.snapshot.json` | AC-PCR-004, 005 | none |
| FX-006 | `tests/fixtures/source/FX-006.twenty-one-curves.xlsx` | `tests/fixtures/expected/FX-006.snapshot.json` | AC-PCR-012 | readability warning in UI state |
| FX-007 | `tests/fixtures/source/FX-007.similar-labels.xlsx` | `tests/fixtures/expected/FX-007.snapshot.json` | AC-PCR-019 | `SIMILAR_SPECIMEN_LABEL`, `SIMILAR_REAGENT_LABEL` |
| FX-008 | `tests/fixtures/source/FX-008.duplicate-pairs.xlsx` | `tests/fixtures/expected/FX-008.snapshot.json` | AC-PCR-001, 009 | `DUPLICATE_CURVE_LABEL` |
| FX-009 | `tests/fixtures/source/FX-009.missing-headers.xlsx` | `tests/fixtures/expected/FX-009.snapshot.json` | AC-PCR-001, 017 | `MISSING_SPECIMEN_LABEL`, `MISSING_REAGENT_LABEL` |
| FX-010 | `tests/fixtures/source/FX-010.nonnumeric-values.xlsx` | `tests/fixtures/expected/FX-010.snapshot.json` | AC-PCR-001, 006 | `NON_NUMERIC_FLUORESCENCE` |
| FX-011 | `tests/fixtures/source/FX-011.empty-values-uneven.xlsx` | `tests/fixtures/expected/FX-011.snapshot.json` | AC-PCR-001, 021, 022 | `EMPTY_FLUORESCENCE_CELL` |
| FX-012 | `tests/fixtures/source/FX-012.empty-rows-columns.xlsx` | `tests/fixtures/expected/FX-012.snapshot.json` | AC-PCR-001 | empty range warnings |
| FX-013 | `tests/fixtures/source/FX-013.first-valid-later-different.xlsx` | `tests/fixtures/expected/FX-013.snapshot.json` | AC-PCR-015 | `IGNORED_WORKSHEETS` |
| FX-014 | `tests/fixtures/source/FX-014.first-invalid-later-valid.xlsx` | `tests/fixtures/expected/FX-014.error.json` | AC-PCR-015 | `FIRST_SHEET_INVALID` |
| FX-015 | `tests/fixtures/source/FX-015.formula-cached.xlsx` | `tests/fixtures/expected/FX-015.snapshot.json` | AC-PCR-001 | formula cached value metadata |
| FX-016 | `tests/fixtures/source/FX-016.formula-no-cache.xlsx` | `tests/fixtures/expected/FX-016.snapshot.json` | AC-PCR-001 | `FORMULA_WITHOUT_CACHED_VALUE` |
| FX-017 | `tests/fixtures/source/FX-017.merged-headers.xlsx` | `tests/fixtures/expected/FX-017.snapshot.json` | AC-PCR-001 | `MERGED_HEADER_CELL` |
| FX-018 | `tests/fixtures/source/FX-018.unsupported-or-corrupt.*` | `tests/fixtures/expected/FX-018.error.json` | AC-012 | `UNSUPPORTED_FILE_TYPE`, `PROTECTED_OR_UNREADABLE_WORKBOOK` |
| FX-019 | `tests/fixtures/source/FX-019.large-generated.xlsx` | `tests/fixtures/expected/FX-019.summary.snapshot.json` | AC-PCR-013 | summary/hash only |
| FX-020 | generated normalized projection | `tests/fixtures/expected/FX-020.plotted-data.csv.snapshot.json` | AC-PCR-021 | none |
| FX-021 | generated normalized projection | `tests/fixtures/expected/FX-021.plotted-data-disabled.snapshot.json` | AC-PCR-022 | disabled reason |
| FX-022 | generated normalized chart sample | `tests/fixtures/expected/FX-022.visual-theme.snapshot.json` | AC-PCR-023 | no hardcoded reference content |
| FX-023 | `tests/fixtures/source/FX-023.active-tab-not-first.xlsx` | `tests/fixtures/expected/FX-023.snapshot.json` | AC-PCR-015 | `IGNORED_WORKSHEETS` |
| FX-024 | `tests/fixtures/source/FX-024.first-valid-later-invalid.xlsx` | `tests/fixtures/expected/FX-024.snapshot.json` | AC-PCR-015 | `IGNORED_WORKSHEETS`; later invalid sheet ignored |

Notes:

- `graph_TEST.xlsx` is currently available at `C:\Users\siunj\Desktop\graph_TEST.xlsx`. Phase 0/2 should copy or recreate a sanitized fixture under `tests/fixtures/source/` and record a hash.
- `.xls` fixtures must be real BIFF `.xls`; renamed `.xlsx` or HTML-saved-as-xls files do not satisfy `.xls` equivalence coverage.
- Snapshots should avoid localized UI copy. Assert warning/error codes and source cells instead.

---

# 1. Observed User Workbook

Source file inspected during Pre-Phase:

- Path: `C:\Users\siunj\Desktop\graph_TEST.xlsx`
- Format: `.xlsx`
- Sheet count: 1
- First worksheet: `Sheet1`
- Used range: 47 rows x 4 columns
- SHA-256: `F8365DF27D7EA036897B10DA2E253AC1F326EF2F67FF3E65627D95740D943781`
- Header row 1: specimen labels
- Header row 2: reagent labels
- Data rows: 45 fluorescence rows, mapping to generated `Cycle 1..45`
- Curve count: 4

Observed headers:

| Column | Specimen | Reagent | Points | Notes |
| --- | --- | --- | --- | --- |
| A | `검체 1` | `A1` | 45 | numeric fluorescence values |
| B | `검체 1` | `A2` | 45 | numeric fluorescence values |
| C | `검체2` | `A1` | 45 | similar to `검체 2`; warning candidate |
| D | `검체 2` | `A2` | 45 | similar to `검체2`; warning candidate |

Pre-Phase observations:

- All inspected fluorescence cells are numeric.
- No missing cells were observed in the used range.
- Negative numeric fluorescence values exist and are valid raw values. They must not be treated as parse errors by default.
- `검체2` and `검체 2` should trigger a non-blocking similar-name warning if the similar-name detector normalizes whitespace.
- Columns A and D have identical inspected fluorescence arrays. They are still separate curves because curve identity is source-column based.
- The workbook has one worksheet, so it does not exercise first-sheet-only ignored-sheet behavior.

Use of this workbook:

- Use as a real-world baseline fixture candidate.
- Do not hardcode its specimen labels, reagent labels, curve count, data values, chart title, axis labels, colors, markers, or threshold/reference line into the app.
- If copied into a future test fixture directory, keep it under a clear source fixture path such as `tests/fixtures/source/graph_TEST.xlsx`.

---

# 2. Fixture Matrix

Fixture IDs are stable planning IDs. Actual file names may be created in Phase 0/1/2.

| ID | Fixture | Type | Purpose | Expected Verification |
| --- | --- | --- | --- | --- |
| FX-001 | `graph_TEST.xlsx` baseline | `.xlsx` source workbook | Validate real user-like 4-curve PCR structure and similar specimen warning candidate. | 4 curves, 45 generated cycles, stable IDs, raw numeric Y values preserved, no correction/normalization. |
| FX-002 | 1 specimen x 8 reagents | `.xlsx` generated workbook | Validate cartridge-shaped common case. | 8 curves under one specimen; reagent-first tree has 8 reagent groups. |
| FX-003 | `.xls` equivalent of FX-002 | real BIFF `.xls` workbook | Validate `.xls` support and equivalence to `.xlsx`. | Normalized curve data equivalent to FX-002 except source file metadata. A renamed `.xlsx` is not sufficient. |
| FX-004 | Old BIFF `.xls` with Korean labels | real BIFF `.xls` workbook | Validate old `.xls` encoding risk. | Korean labels preserved without mojibake, or controlled actionable failure if unsupported. |
| FX-005 | Many specimens x shared reagents | `.xlsx` generated workbook | Validate specimen/reagent projections and search. | Reagent-first and specimen-first trees contain same curve IDs; selection survives grouping toggle. |
| FX-006 | More than 20 visible curves | normalized dataset or workbook | Validate readability warning without blocking preview/export. | 21+ selected curves triggers warning; all selected curves remain visible/exportable. |
| FX-007 | Similar specimen/reagent names | `.xlsx` generated workbook | Validate warning-only similar-name behavior. | Warning lists affected labels; IDs, labels, grouping, legend/export order, and export names unchanged. |
| FX-008 | Exact duplicate specimen/reagent pairs | `.xlsx` generated workbook | Validate duplicate curve label handling. | Curves remain distinct by `curveId`; duplicate-label warning if implemented; no merge. |
| FX-009 | Missing specimen/reagent labels | `.xlsx` generated workbook | Validate missing header handling. | Affected curves invalid or warning according to parser rule; no silent relabeling. |
| FX-010 | Nonnumeric fluorescence values | `.xlsx` generated workbook | Validate invalid fluorescence cell handling. | Raw value preserved in diagnostics; chart Y becomes `null`; warning contains cell address. |
| FX-011 | Empty fluorescence cells and uneven lengths | `.xlsx` generated workbook | Validate missing Y handling. | Empty cells normalize to `null`; generated cycles remain consistent; warnings include affected cells. |
| FX-012 | Empty rows and empty columns | `.xlsx` generated workbook | Validate data-range trimming. | Trailing blank rows/columns ignored; internal blank rows/cells produce null/warning. |
| FX-013 | Multi-sheet first valid, later different | `.xlsx` generated workbook | Validate first-sheet-only behavior and ignored-sheet notice. | Worksheet index 0 parsed; later sheet ignored; no data from later sheets appears. |
| FX-014 | Multi-sheet first invalid, later valid | `.xlsx` generated workbook | Validate invalid first sheet rule. | Import fails even when later worksheet is valid. |
| FX-015 | Formula cells with cached numeric values | `.xlsx` generated workbook | Validate formula cached-value policy. | Cached numeric formula result accepted; browser does not recalculate formulas. |
| FX-016 | Formula cells without cached values | `.xlsx` generated workbook | Validate formula no-cache risk. | Formula cells normalize to `null` with warning. |
| FX-017 | Merged header cells | `.xlsx` generated workbook | Validate unsupported/ambiguous header handling. | No silent fill unless explicitly implemented; missing/merged headers warn. |
| FX-018 | Unsupported/corrupt/protected/HTML-as-xls workbook | invalid files | Validate error paths. | Clear actionable error; no partial import. |
| FX-019 | Large dataset | generated workbook or normalized dataset | Validate performance smoke. | Dozens to hundreds of specimens and up to 8 reagents remain navigable; use summary/hash snapshot, not full y arrays. |
| FX-020 | Simple plotted-data export | normalized chart projection | Validate data CSV enabled case. | One chart, shared X values, selected curves only, current legend/export order. |
| FX-021 | Non-simple plotted-data export | normalized chart projection | Validate data CSV disabled case. | Data CSV disabled with clear reason when chart projection is not rectangular/shared-X. |
| FX-022 | Chart visual theme sample | normalized dataset | Validate default visual style without hardcoding reference image. | White background, sparse major grid, no dense minor grid, readable title/axis/legend, preview/export parity. |
| FX-023 | Active tab not first sheet | `.xlsx` generated workbook | Validate worksheet index 0, not workbook active tab. | Parser uses `SheetNames[0]` even if workbook active tab points elsewhere. |
| FX-024 | First valid, later invalid | `.xlsx` generated workbook | Validate ignored later sheet errors. | Import succeeds from first sheet; invalid later sheet is ignored. |

---

# 3. Expected Snapshot Schema

Parser snapshots should be JSON. The exact fixture snapshots should be generated during Phase 2 after parser implementation begins, but the schema is fixed here.

Example shape:

```json
{
  "schemaVersion": 1,
  "fixtureId": "FX-001",
  "source": {
    "fileName": "graph_TEST.xlsx",
    "fileType": "xlsx",
    "sha256": "F8365DF27D7EA036897B10DA2E253AC1F326EF2F67FF3E65627D95740D943781",
    "sheetNames": ["Sheet1"],
    "sheetCount": 1,
    "usedSheetIndex": 0,
    "usedSheetName": "Sheet1",
    "ignoredSheetNames": []
  },
  "range": {
    "rowCount": 47,
    "columnCount": 4,
    "headerRows": {
      "specimen": 1,
      "reagent": 2
    },
    "dataStartRow": 3,
    "dataRowCount": 45
  },
  "parserOptions": {
    "firstWorksheetOnly": true,
    "generatedX": "cycle-1-based",
    "rawFluorescencePreserved": true,
    "automaticCorrection": false
  },
  "curves": [
    {
      "curveId": "sheet0_col_A",
      "sourceId": "workbook:sheet0:A",
      "source": {
        "sheetIndex": 0,
        "columnIndex": 1,
        "columnLetter": "A",
        "specimenCell": "A1",
        "reagentCell": "A2",
        "dataRange": "A3:A47"
      },
      "specimenId": "specimen_0001",
      "reagentId": "reagent_A1",
      "specimenLabel": "검체 1",
      "reagentLabel": "A1",
      "displayLabel": "검체 1 │ A1",
      "x": [1, 2, 3],
      "yPreview": [41.3350398880229, 26.0445244130879, 19.5399610979439],
      "pointCount": 45,
      "nullCount": 0,
      "nonNumericCount": 0,
      "formulaCount": 0,
      "warnings": []
    }
  ],
  "groups": {
    "reagentFirst": {
      "groupCount": 2,
      "defaultCollapsed": true
    },
    "specimenFirst": {
      "groupCount": 3,
      "defaultCollapsed": true
    }
  },
  "warnings": [
    {
      "code": "SIMILAR_SPECIMEN_LABEL",
      "severity": "warning",
      "scope": "dataset",
      "labels": ["검체2", "검체 2"],
      "curveIds": ["sheet0_col_C", "sheet0_col_D"]
    }
  ]
}
```

Snapshot requirements:

- Full parser snapshots should store complete `x[]` and normalized `y[]` arrays, not only `yPreview`.
- Documentation examples may use `yPreview` to keep the document readable.
- Large fixture snapshots should not store all `y[]` arrays. Use `curveCount`, group counts, first/last curve summaries, warning counts, and `yHash` or equivalent stable summary.
- `curveId` must be stable for the same workbook/sheet/column parse.
- `curveId` must not depend on current grouping mode, search, selected state, legend order, or chart style.
- Raw labels must be preserved exactly in `specimenLabel` and `reagentLabel`.
- Display labels may be derived, but must not replace raw labels.
- Imported values are not editable in snapshots.
- Snapshot warning assertions should use stable `code`, `scope`, `sourceCell`/`sourceRange`, labels, and affected `curveIds`. Do not snapshot localized UI message text.
- Curves should be sorted by source sheet index and source column index in snapshots for deterministic diffs.
- `.xls` / `.xlsx` equivalence snapshots should compare normalized curve data after stripping source-file-specific metadata such as file name, extension, hash, and workbook container details.

Recommended curve ID rule:

- Use one workbook-local curve per source data column.
- `curveId`: `sheet0_col_<ExcelColumnLetter>`, for example `sheet0_col_A`.
- `sourceId`: `workbook:sheet0:<ExcelColumnLetter>`.
- If duplicate or missing labels exist, curve identity still comes from source position.

---

# 4. Warning Taxonomy

Warning IDs should be stable enough for tests.

| Warning ID | Scope | Trigger | Behavior |
| --- | --- | --- | --- |
| `IGNORED_WORKSHEETS` | import | Workbook has sheets after worksheet index 0. | Non-blocking notice; parser uses only first sheet. |
| `FIRST_SHEET_INVALID` | import | Worksheet index 0 lacks required PCR structure. | Blocking import error. |
| `MISSING_SPECIMEN_LABEL` | curve/header | Row 1 cell is empty for a data column. | Warning or invalid curve; no automatic name generation except technical ID. |
| `MISSING_REAGENT_LABEL` | curve/header | Row 2 cell is empty for a data column. | Warning or invalid curve; no automatic name generation except technical ID. |
| `SIMILAR_SPECIMEN_LABEL` | dataset | Specimen labels are similar after conservative normalization. | Non-blocking warning only; no merge/rename. |
| `SIMILAR_REAGENT_LABEL` | dataset | Reagent labels are similar after conservative normalization. | Non-blocking warning only; no merge/rename. |
| `DUPLICATE_CURVE_LABEL` | dataset | More than one curve would display the same specimen/reagent label pair. | Non-blocking warning; curves remain distinct by `curveId`. |
| `NON_NUMERIC_FLUORESCENCE` | cell/curve | Fluorescence cell cannot be read as a finite number. | Normalized chart Y value becomes `null`; raw value kept in diagnostics. |
| `EMPTY_FLUORESCENCE_CELL` | cell/curve | Fluorescence cell is empty inside the data range. | Normalized chart Y value becomes `null`. |
| `FORMULA_WITHOUT_CACHED_VALUE` | cell/curve | Formula cell has no usable cached value in browser parser. | Normalized chart Y value becomes `null`; warning includes cell address. |
| `MERGED_HEADER_CELL` | header | Header cell is merged or ambiguous. | Warning; no silent label fill unless explicitly implemented and tested. |
| `UNSUPPORTED_FILE_TYPE` | import | File is not `.xls` or `.xlsx`. | Blocking import error. |
| `PROTECTED_OR_UNREADABLE_WORKBOOK` | import | Workbook cannot be parsed by browser parser. | Blocking import error. |

Similar-name warning rule for MVP:

- Warning-only and non-blocking.
- Do not merge, rename, group together, or change export labels.
- Deterministic similar-key rule:
  - trim leading/trailing whitespace
  - convert Latin text to lower case
  - remove whitespace, hyphen (`-`), and underscore (`_`) characters
  - compare resulting keys only when both keys are non-empty
- Example warning target: `검체2` and `검체 2`.
- Example warning target: `Sample1`, `Sample 1`, and `Sample-1`.
- If this produces too much noise in real use, warning sensitivity can be adjusted later without changing the no-merge rule.

---

# 5. Parser Policy Decisions For Fixtures

These are technical Pre-Phase defaults and do not require user business judgment.

| Area | Fixture Policy |
| --- | --- |
| Worksheet selection | Always parse worksheet index 0 only. |
| Later worksheets | Ignore and warn with `IGNORED_WORKSHEETS`. |
| Invalid first worksheet | Fail import with `FIRST_SHEET_INVALID`, even if later sheets are valid. |
| X values | Generate `Cycle 1..N` from data row count. |
| Negative fluorescence | Valid numeric raw value; do not warn by default. |
| Empty trailing rows | Ignore after the final row containing any fluorescence value. |
| Internal empty fluorescence cells | Normalize to `null` and warn. ECharts should render `null` as a line gap. |
| Empty data columns | Ignore only if header and data cells are all empty; otherwise warn. |
| Formula cells | Never recalculate formulas in the browser. Use cached finite numeric result when available; otherwise `null` + warning. |
| Dates/booleans/error cells in fluorescence | Treat as nonnumeric fluorescence unless later explicitly supported. |
| Merged headers | Warn; do not silently infer repeated labels unless implementation adds tested behavior. |
| Raw label preservation | Preserve exactly; derived IDs/display labels must not mutate raw labels. |
| Automatic PCR analysis | No Ct/Cq, threshold, baseline, smoothing, normalization, averaging, or log transform. |
| Initial selection | After import, no curves are selected by default. All major groups are collapsed and counts remain visible. |
| Missing Y in plotted-data CSV | Export blank CSV cells for `null` Y values; do not drop rows. |
| Failed export counter | Failed export attempts do not consume `plotN`. |

---

# 6. Selection, Style, And Export Snapshot Expectations

Selection initial state after import:

```json
{
  "groupingMode": "reagent",
  "selectedCurveIds": [],
  "collapsedGroupIds": ["reagent:A1", "reagent:A2"],
  "matchedCurveIds": [],
  "reagentTree": {
    "groups": [
      {
        "groupId": "reagent:A1",
        "label": "A1",
        "curveCount": 2,
        "checkedState": "unchecked",
        "collapsed": true
      }
    ]
  },
  "specimenTree": {
    "groups": [
      {
        "groupId": "specimen:검체 1",
        "label": "검체 1",
        "curveCount": 2,
        "checkedState": "unchecked",
        "collapsed": true
      }
    ]
  }
}
```

Important expectations:

- All major groups start collapsed.
- Reagent-first is the default tree.
- Specimen-first tree derives from the same `curveId` set.
- Search bulk actions apply to all `matchedCurveIds`, including collapsed/virtualized rows.
- Group IDs should be namespaced by grouping mode, for example `reagent:A1` and `specimen:검체 1`.
- Tri-state checkbox values should be `checked`, `unchecked`, or `mixed`.
- Style presets are not parser snapshots, but state tests must verify overwrite and one-step undo.

Preset undo state-machine tests:

1. Before preset: existing group rules and individual overrides are recorded.
2. Apply preset to an explicit scope.
3. Affected curve count is emitted.
4. Existing scoped individual style fields are overwritten.
5. One-step undo restores the previous affected style state.
6. A second preset application replaces the previous undo snapshot.
7. Undo becomes unavailable after it is used once.

Preset scope rule for tests:

- Preset application must always receive an explicit scope from UI/state.
- Supported test scopes can include selected curves, current reagent group, current specimen group, search matches, and visible curves.
- No preset may silently apply to the entire dataset unless the explicit scope is `all`.

Export projection snapshot for simple plotted-data CSV:

```json
{
  "chartId": "plot1",
  "visibleCurveIds": ["sheet0_col_A", "sheet0_col_B"],
  "legendExportOrder": ["sheet0_col_A", "sheet0_col_B"],
  "sharedX": [1, 2, 3],
  "csvColumns": ["Cycle", "검체 1 │ A1", "검체 1 │ A2"],
  "nullCell": "",
  "duplicateHeaderPolicy": "append-source-column",
  "enabled": true
}
```

Export projection disabled example:

```json
{
  "enabled": false,
  "reason": "Current chart cannot be represented as one rectangular CSV with shared X values."
}
```

Image export expectations:

- PNG/JPEG only.
- White background.
- Filename `YYMMDD_<sanitizedAnalysisName>_plotN.ext` when an analysis name is available, with legacy/no-name helper coverage for `YYMMDD_plotN.ext`.
- Preview and export style parity.
- No hardcoded reference-image title, threshold/reference line, marker shape, color, legend label, curve count, axis range, or data values.

Plotted-data CSV shape:

- Header row starts with `Cycle`.
- Curve columns follow current legend/export order.
- Duplicate display labels are disambiguated by source column, for example `검체 1 │ A1 [A]`.
- `null` Y values export as blank cells.
- CSV values are RFC 4180-style quoted when needed for commas, quotes, or line breaks.
- Rows are ordered by generated cycle X ascending.
- Disabled CSV export should use stable reason codes in tests, with localized UI text tested separately if needed.

Export filename counter contract:

- `plot1` starts per browser session.
- A successful export operation increments the counter once.
- Image + CSV in one operation share the same `plotN`.
- CSV-only export receives the next `plotN`.
- Failed export attempts do not consume a number.

---

# 7. Verification Performed In Pre-Phase

Local inspection performed:

- Confirmed `C:\Users\siunj\Desktop\graph_TEST.xlsx` exists.
- Inspected first worksheet using bundled Python `openpyxl` in read-only mode.
- Confirmed observed workbook structure: 1 sheet, 47 rows, 4 columns, 45 data rows, 4 curve columns.
- Confirmed `검체2` / `검체 2` similar-name warning candidate.
- Confirmed no source app code has been created in Pre-Phase.

No automated app tests were run because source code and test framework are not scaffolded yet. Automated tests begin after Phase 0/1.
