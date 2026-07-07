# 03 Input and Output Specification

## Purpose
Define how data enters the application, how it is normalized internally, and what outputs the application produces.

## Status
Active draft

## Last Updated
2026-07-08

## Owner
Engineering / Agent

## Compression-Safe Summary
- MVP input is Excel upload only: `.xls` and `.xlsx`, first worksheet only. Additional Excel files may be appended to the current in-browser analysis.
- CSV, pasted table data, manual entry, and in-app data editing are deferred beyond MVP.
- Imported PCR data should normalize into stable specimen/reagent/curve records keyed by `curveId`; appended files must rekey curves to avoid ID collisions.
- Parsing should preserve original values and surface warnings.
- Output image and clipboard content should match the current rendered chart.
- PNG and JPEG export use white background and filename `YYMMDD_plotN.ext`.
- Plotted-data CSV, when enabled, uses filename `YYMMDD_plotN_data.csv` and includes only the current plotted chart projection.
- Chart styling uses stable default colors by original data/group order, solid no-marker lines by default, and optional individual marker overrides.

## Update Rule
Update this file when parsing rules, data types, invalid data handling, internal data shape, output formats, or error messages change.

## Supported Inputs

| ID | Input | Initial Rule | Related Requirements | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| IO-001 | Excel workbook | Support `.xls` and `.xlsx` upload through browser file APIs; parse only the first worksheet. The user can replace the current dataset or append another file to the current analysis. | FR-001 | AC-001, AC-002, AC-PCR-001, AC-PCR-015, AC-PCR-016, AC-PCR-025 |
| IO-002 | CSV file | Deferred beyond MVP. | FR-002 | TBD |
| IO-003 | Pasted table | Deferred beyond MVP. | FR-003 | TBD |
| IO-004 | Manual entry / editing | Deferred beyond MVP. Imported data is not editable in MVP. | FR-003 | AC-PCR-017 |

## Excel Rules
MVP target:

- File extension: `.xls`, `.xlsx`
- Source: browser file picker or drag and drop
- Processing location: browser
- Worksheet behavior: parse worksheet index 0 only.
- If worksheet index 0 is invalid, import fails even if later worksheets are valid.
- Later worksheets are ignored. The UI may show a notice that only the first worksheet was used.
- Row 1: specimen labels
- Row 2: reagent labels
- Row 3 onward: fluorescence values
- X axis: generated `Cycle 1~N` unless a later requirement explicitly adds source X values.

Parser policy:

- Empty trailing rows after the final row containing any fluorescence value are ignored.
- Internal empty fluorescence cells normalize to `null` and produce warnings.
- Empty data columns are ignored only when specimen header, reagent header, and all data cells are empty.
- Date, boolean, and error cells in fluorescence rows are treated as nonnumeric fluorescence unless later explicitly supported.
- Formula cells are never recalculated in the browser. Use cached finite numeric values when available; otherwise normalize to `null` and warn.
- Merged headers warn; do not silently infer repeated labels unless implementation later adds tested behavior.
- Negative numeric fluorescence values are valid raw values and should not warn by default.
- Maximum file size, maximum row count, and maximum column count remain performance-budget decisions.

## CSV Rules
CSV import is not part of the MVP. If added later, it must map into the same PCR curve model or require explicit specimen/reagent row confirmation.

## Pasted Table Rules
Pasted table input is not part of the MVP.

## Manual Entry Rules
Manual table entry and in-app data editing are not part of the MVP. Source data corrections should be made in Excel and reuploaded.

## PCR Header Interpretation
MVP rules:

- Row 1 is always specimen labels.
- Row 2 is always reagent labels.
- Row 3 onward is fluorescence data.
- Similar specimen or reagent names warn only; the app does not merge, rename, or correct labels. MVP similar-key rule trims labels, lowercases Latin text, removes whitespace/hyphen/underscore characters, and compares non-empty keys.
- Missing specimen or reagent labels produce warnings and may make affected curves invalid depending on parser validation.

## Internal PCR Dataset Model
The normalized PCR dataset should be representable as:

```json
{
  "curves": [
    {
      "curveId": "sheet1_col3",
      "specimenId": "specimen_1",
      "reagentId": "reagent_a1",
      "sourceId": "workbook:sheet0:col3",
      "specimenLabel": "Specimen 1",
      "reagentLabel": "A1",
      "x": [1, 2, 3],
      "y": [120, 130, 160],
      "warnings": []
    }
  ],
  "warnings": []
}
```

Curve IDs should be stable for a given workbook/sheet/column parse and should not depend on the current tree grouping. In a single parsed workbook, IDs use source position such as `sheet0_col_A`. When another workbook is appended into the current analysis, appended IDs are rekeyed with an import prefix such as `file2_sheet0_col_A` so selections, overrides, chart series, and export order do not collide with the existing dataset.

## Type Inference
Candidate data types:

- `text`
- `number`
- `date`
- `boolean`
- `empty`
- `mixed`

Type inference should not destroy original values. If parsing is ambiguous, the UI should show a warning. MVP does not provide manual correction; users correct the source workbook and reupload.

## Missing Value Handling
Candidate rule:

- Empty cells normalize to `null`.
- Empty fluorescence cells normalize to `null`.
- X values are generated cycle numbers in MVP and should not be missing.
- Chart-specific behavior for `null` fluorescence values must be implemented and tested.

Open questions:

- Missing Y values should create chart gaps and export as blank cells in plotted-data CSV.
- Should advanced filters treat empty strings and nulls as the same in a future version?

## Selection and Search Model
MVP selection is curve-based:

- `selectedCurveIds`: selected curves.
- `groupingMode`: `reagent` by default, `specimen` optional.
- `matchedCurveIds`: all curves matching current search across the full dataset.
- Search bulk actions apply to `matchedCurveIds`, including collapsed or nonvisible rows.
- Major groups start collapsed after import.
- No curves are selected by default after import.

## Chart Configuration Model
MVP chart configuration:

```json
{
  "chartType": "pcr-amplification-line",
  "x": {
    "source": "generated-cycle",
    "scale": {
      "mode": "fixed",
      "min": 1,
      "max": 45,
      "preset1": { "label": "P1", "min": "", "max": "" },
      "preset2": { "label": "P2", "min": "", "max": "" }
    }
  },
  "visibleCurveIds": ["sheet1_col3"],
  "legend": {
    "visible": true,
    "mode": "grouped",
    "order": ["sheet1_col3"]
  },
  "styleRules": {},
  "curveOverrides": {
    "sheet0_col_A": {
      "lineType": "solid",
      "markerType": "none"
    }
  }
}
```

This structure may be refined during implementation but must preserve curveId-based identity.

## Outputs

| ID | Output | Initial Rule | Related Requirements | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| IO-101 | Chart preview | Reflect current dataset, filters, mappings, layout, legend, and fixed scales. | FR-006 to FR-010 | AC-004 to AC-008 |
| IO-102 | Image download | Export the current chart preview as PNG or JPEG with white background. | FR-011 | AC-009, AC-PCR-010 |
| IO-103 | Clipboard image | Copy current chart image where supported, with fallback on failure. | FR-012 | AC-010 |
| IO-104 | Static build | Produce static assets that work on GitHub Pages. | FR-013 | AC-011 |
| IO-105 | Plotted data export | Export only currently plotted data when the current chart projection is simple and rectangular; otherwise disable with a clear reason. | FR-016 | AC-PCR-021, AC-PCR-022 |

## Image Download Rules
- Formats: PNG, JPEG.
- Background: white only.
- Filename convention: `YYMMDD_plotN.ext`, using browser-local date. Example: `260707_plot1.png`.
- Export excludes UI controls and includes only the chart output.
- Export reflects current selected curves, scale, style, and legend/order state.
- Export uses the same chart option projection as preview. Preview layout height is fixed in the UI, while image export keeps its chart-only export dimensions.
- More than 20 visible curves warns but does not block export by default.

## Plotted Data Export Rules
- Format: CSV.
- Filename convention: `YYMMDD_plotN_data.csv`.
- Counter rule: if data CSV is exported together with an image, both artifacts share the same `plotN`; if data CSV is exported alone, it receives the next browser-local `plotN`.
- Failed export attempts do not consume `plotN`.
- Data scope: current plotted curves only, in current legend/export order.
- Exclude hidden curves, unselected curves, and raw workbook data that is not part of the current chart projection.
- Enable only when the current chart state is simple: one chart, shared X values across visible curves, and rectangular CSV output possible.
- If not enabled, show a concise reason instead of exporting partial or misleading data.
- Header row starts with `Cycle`.
- Duplicate display labels are disambiguated by source file and column, for example `A1 / 검체 1 [sample.xlsx:A]`.
- `null` Y values export as blank CSV cells.
- CSV values are quoted when required by commas, quotes, or line breaks.

## Clipboard Rules
- Supported clipboard MIME type for MVP: `image/png`.
- Clipboard copy must be triggered by an explicit user action.
- Clipboard copy uses the same chart option projection as PNG export and a white background.
- If `navigator.clipboard.write` or `ClipboardItem` is unavailable, or if permission is denied, show a fallback message telling the user to download PNG instead.
- Clipboard copy does not consume the `plotN` filename counter unless a fallback download is explicitly performed.

## Implemented Export Counter Rules
- Browser session starts at `plot1` after a dataset import.
- Successful PNG/JPEG download increments `plotN`.
- Successful plotted-data CSV download increments `plotN`.
- Failed image, clipboard, or CSV attempts do not increment `plotN`.
- Current MVP implements image and data CSV as separate actions; combined image+CSV export remains a future candidate.

## Future Output Candidates
These are not confirmed:

- Download chart configuration JSON.
- Export PDF.
- Export SVG.
- Save chart presets in localStorage.

## Error Messages
The application should provide clear messages for:

- Unsupported file type
- File too large
- Empty dataset
- Missing headers
- Duplicate headers
- Invalid chart mapping
- Fixed axis min greater than max
- Clipboard permission failure
- Export generation failure
