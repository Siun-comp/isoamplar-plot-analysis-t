# 04 Test Plan and Acceptance Criteria

## Purpose
Define how the PCR graph web tool will be validated and how completion will be judged.

## Status
Active draft

## Last Updated
2026-07-08

## Owner
QA / Engineering / Agent

## Compression-Safe Summary
- MVP testing is PCR-specific, not generic spreadsheet charting.
- MVP input is Excel upload only: `.xls` and `.xlsx`, first worksheet only.
- CSV import, pasted input, manual entry, and in-app data editing are deferred beyond MVP.
- Testing must cover PCR/LAMP-style import, append import, stable curve IDs, reagent-first selection, collapsed groups, search, grouping-aware labels, fixed axes, user-editable P1/P2 presets, clean chart visual style, stable colors, default no markers, style/legend behavior, PNG/JPEG export, clipboard fallback, and GitHub Pages.
- Exported images must match the current rendered chart state and use a white background.
- Plotted-data CSV export is allowed only for a simple current chart projection.
- Fixture manifest and expected snapshot schema live in `docs/07_FIXTURE_SNAPSHOT_PLAN_KR.md`.
- Known gaps must be recorded instead of assumed away.

## Update Rule
Update this file whenever requirements change, bugs are fixed, release criteria change, or new risk areas are discovered.

## Test Scope
Initial MVP scope:

- `.xls` and `.xlsx` Excel upload
- First-worksheet-only parsing
- PCR header interpretation: row 1 specimen, row 2 reagent, row 3+ fluorescence
- Generated cycle X values
- Import warnings without automatic correction
- Reagent-first and specimen-first selection projections
- Major-group collapsed default
- Full-dataset search and search bulk actions
- PCR amplification line chart rendering
- Clean chart visual style: white background, sparse major grid, no dense minor grid by default, readable title/axis/legend layout
- Fixed X/Y axis scales and P1/P2 presets
- Style rules, built-in presets, individual curve overrides, and one-step preset undo
- Legend/export order parity
- PNG and JPEG image download with white background
- Clipboard image copy and fallback
- Optional plotted-data CSV export for simple current chart state
- Static GitHub Pages deployment behavior

Deferred beyond MVP:

- CSV import
- Pasted table input
- Manual entry
- In-app data editing
- Multi-sheet picker
- Generic spreadsheet chart types
- SVG/PDF export
- Transparent background export
- Saved custom presets
- Multi-chart/batch layout

## Test Levels
- Smoke tests for the core Excel import to export flow.
- Unit tests for parsing, validation, PCR normalization, tree derivation, search, style precedence, filename generation, and axis range helpers.
- Component tests for upload, selection tree, warning surfaces, settings accordions, style preset application, legend ordering, and export controls.
- End to end tests for upload -> collapsed selection -> expand/select -> render -> axis lock -> style preset -> PNG/JPEG export.
- Visual/export smoke checks for chart-only output, white background, and preview/export state parity.
- Manual browser compatibility checks for clipboard and downloaded image fidelity.
- Accessibility sanity checks for form controls, tree controls, accordions, and keyboard reachable actions.

## Acceptance Criteria

| ID | Requirement | Acceptance Criterion | Verification |
| --- | --- | --- | --- |
| AC-001 | FR-001 | User can import a valid `.xls` or `.xlsx` file and see a normalized PCR model parsed from the first worksheet only. | Automated + manual |
| AC-002 | FR-001, FR-004 | User can review detected specimen labels, reagent labels, fluorescence columns, generated cycles, and import warnings. | Automated + manual |
| AC-003 | FR-003 | Pasted input, manual entry, and in-app data editing are not required in MVP; correction flow is source-file edit followed by reupload. | Manual/document review |
| AC-004 | FR-005 | Selection, grouping, search, and search bulk actions update the selected curve set and rendered chart data. | Automated + manual |
| AC-005 | FR-007 | Multi-chart layout and batch arrangement are deferred; the single-chart MVP layout remains usable without overlap or clipped controls. | Manual + visual |
| AC-006 | FR-006, FR-008 | Chart, style, and legend settings affect the rendered chart as configured. | Automated + manual |
| AC-007 | FR-009 | Fixed X scale is applied consistently across redraws and relevant filter, selection, grouping, and style changes until changed by the user. | Automated + manual |
| AC-008 | FR-010 | Fixed Y scale is applied consistently across redraws and relevant filter, selection, grouping, and style changes until changed by the user. | Automated + manual |
| AC-009 | FR-011 | Image download produces a valid PNG or JPEG of the current chart only, without surrounding UI controls, with white background and filename `YYMMDD_plotN.ext`. | Automated smoke + manual |
| AC-010 | FR-012 | Clipboard copy places the current chart image on the clipboard where supported; otherwise the UI shows a clear download fallback. | Manual + fallback test |
| AC-011 | FR-013 | The app works from a GitHub Pages style URL without backend services. | Build + manual |
| AC-012 | FR-014 | Invalid file type, invalid first sheet, invalid axis bounds, export failure, and clipboard failure show actionable errors. | Automated + manual |

## PCR-Specific Acceptance Criteria

These criteria bind implementation to decisions `D010` through `D016`.

| ID | Requirement / Decision | Acceptance Criterion | Verification |
| --- | --- | --- | --- |
| AC-PCR-001 | FR-001, IO-001, D012, D014 | Excel upload creates a normalized PCR model with stable curve IDs, specimen labels from row 1, reagent labels from row 2, fluorescence values from row 3 onward, and generated cycle values when no X axis is present. | Automated + manual |
| AC-PCR-002 | D003 | Importing, selecting, rendering, and exporting PCR data remains browser-local and does not send uploaded data to a backend. | Automated network guard + manual |
| AC-PCR-003 | D011, D012 | The default selection tree is reagent-first. | Component + E2E |
| AC-PCR-004 | D011 | Reagent-first and specimen-first views are projections over the same curve IDs and preserve identical selection state when toggled. | Unit + component |
| AC-PCR-005 | D012 | Search matches the full normalized dataset, and search bulk actions apply to every matching curve including collapsed, nonvisible, and virtualized rows. | Unit + component + E2E |
| AC-PCR-006 | D010, D012 | Chart preview renders only selected curves and applies no implicit smoothing, baseline correction, normalization, averaging, log transform, or Ct/Cq calculation. | Unit + visual/manual |
| AC-PCR-007 | FR-009, FR-010, D008 | Fixed X/Y scales and scale presets persist after filter, selection, grouping mode, style, and redraw changes until the user changes them. | Unit + E2E |
| AC-PCR-008 | D012, D014 | Style presets overwrite scoped individual curve overrides, show affected-count feedback, and provide one-step undo for the last preset apply. | Unit + component |
| AC-PCR-009 | D006, D012 | Legend order and export order exactly match the current preview order. | E2E + export smoke |
| AC-PCR-010 | FR-011, D014 | PNG and JPEG export produce valid chart-only images matching current preview selection, scale, style, and legend/order state, using a white background and filename `YYMMDD_plotN.ext`. | Automated smoke + manual |
| AC-PCR-011 | FR-012, D007 | Clipboard export succeeds where supported and shows image-download fallback when unsupported, blocked, or denied. | Manual + fallback test |
| AC-PCR-012 | D012, D014 | More than 20 visible curves triggers a readability warning and assistance path, but preview/export remain enabled and include all visible curves. | Component + E2E |
| AC-PCR-013 | D011 | Large datasets with dozens to hundreds of specimens and up to 8 reagents remain usable within the agreed performance budget. | Performance smoke + manual |
| AC-PCR-014 | D010 | Retired/default-forbidden UI terms do not appear in user-visible UI unless later approved: `replicate`, `series`, `solo/isolate`, hover/solo emphasis wording, and exclude/restore wording. | Automated text scan + manual |
| AC-PCR-015 | FR-001, IO-001, D014 | Multi-sheet workbook import always uses worksheet index 0; later sheets are ignored. If the first sheet is invalid, import fails even if later sheets are valid. | Parser unit + E2E |
| AC-PCR-016 | FR-001, IO-001, D014 | `.xls` and `.xlsx` fixtures with equivalent first-sheet data normalize to equivalent PCR curve data. | Parser unit |
| AC-PCR-017 | FR-003, IO-004, D014 | Imported specimen, reagent, and fluorescence values cannot be edited in the app; correcting source data requires reupload. | Component + manual |
| AC-PCR-018 | FR-005, D014 | All reagent/specimen major groups are collapsed immediately after import, with counts and checkbox state still accurate. | Component + E2E |
| AC-PCR-019 | FR-004, D014 | Similar names trigger a warning listing affected labels but do not change IDs, labels, selection, grouping, or export names. | Parser unit + component |
| AC-PCR-020 | FR-008, D014 | Built-in presets apply to the chosen scope, overwrite affected individual style fields deterministically, report affected count, and provide one-step undo. No saved custom presets are required in MVP. | Unit + component |
| AC-PCR-021 | FR-016, D014 | Plotted-data CSV export, when available, contains only currently plotted curves in current legend/export order. It excludes hidden/unselected curves and raw workbook-only data. | Unit + E2E |
| AC-PCR-022 | FR-016, D014 | Plotted-data CSV export is disabled with a clear reason unless the current chart is simple: one chart, shared X values across visible curves, and rectangular CSV output possible. | Unit + component |
| AC-PCR-023 | FR-006, FR-011, D015 | The default chart theme is clean and analysis-readable: white background, sparse major grid lines only, no dense minor grid by default, readable title/axis/legend spacing, balanced line widths, distinguishable but controlled colors, and PNG/JPEG export matches the preview style. Reference images are not hardcoded: example-specific title, axis labels, axis ranges, threshold/reference line, marker shapes, colors, legend labels, curve count, and data values must not be fixed from the reference. | Playwright screenshot + visual/manual + export smoke |
| AC-PCR-024 | FR-006, FR-008, FR-009, FR-010, D021, D023, D024 | The app identity is `IsoAmplar Plot Analysis` with developer credit `Jang Si Un`; preview plot height remains stable when side settings expand; default curve colors remain stable as earlier/later curves are selected; default lines have no markers; individual curve marker overrides support none, circle, triangle, and rect; P1/P2 X/Y presets are user-editable and selectable only with valid min/max; Fixed mode displays current Auto bounds for editing support. | Unit + component + E2E |
| AC-PCR-025 | FR-001, FR-005, FR-006, FR-008, D025 | The app can append another `.xls`/`.xlsx` first worksheet to the current analysis without replacing existing data; appended curves receive unique IDs, are added unselected at the end of user order, and preserve existing selected curves, scale, style, overrides, and chart output. Reagent mode uses reagent-first labels across selection, legend, legend order, and plotted CSV; specimen mode uses specimen-first labels. The center chart panel stays visible on desktop scroll, tree group/subgroup rows are visually distinguishable, compact scale/export controls do not clip labels, and group/individual style colors can be entered by HEX code as well as picker. | Unit + component + E2E + visual/manual |

## PCR Test Phases

1. Requirements and fixture definition: create small, medium, large, malformed, `.xls`, `.xlsx`, appended-workbook, multi-sheet, similar-name, over-20-curve, and data-export fixtures with expected normalized JSON snapshots.
2. Browser-local Excel parsing: test specimen/reagent extraction, first-sheet-only behavior, `.xls`/`.xlsx` equivalence, generated cycles, nonnumeric values, blank rows/columns, duplicate or similar names, missing headers, uneven lengths, formulas, old `.xls` encodings, protected files, and unsupported files.
3. Normalized PCR model: test stable curve IDs, source sheet/range, warnings, style state, selection state, and legend/export order.
4. Selection tree and search: test reagent-first default, specimen-first toggle, grouping-aware labels, all-groups-collapsed default, tri-state checkboxes, collapse/expand, full-dataset search matching, and search bulk actions.
5. Chart rendering: test selected-curve rendering, no implicit PCR transformations, null/missing values, clean visual theme, and over-20 readability warning without blocking preview/export.
6. Scale preset and fixed axis: test Auto, Fixed, P1, P2, min/max validation, current Auto bound display, and persistence across redraw triggers.
7. Style preset and override: test style precedence, stable default colors, default no markers, individual marker overrides, built-in preset overwrite, affected-count feedback, and one-step undo.
8. Legend and export order: test manual order, grouped legend, selected order, reagent/specimen order, and preview/export parity.
9. PNG, JPEG, clipboard, and plotted-data export: test valid chart-only images, white background, preview/export visual style parity, fake-date filename generation, clipboard success/fallback, simple plotted-data CSV, and disabled non-simple data export.
10. Performance, accessibility, and release: test large datasets, virtualized tree behavior, keyboard navigation, browser compatibility, and GitHub Pages base path.

## Manual Test Cases
Before a user-visible MVP release:

1. Import a valid `.xlsx` PCR workbook.
2. Import an equivalent valid `.xls` PCR workbook.
3. Import a multi-sheet workbook and confirm only the first worksheet is used.
4. Import a workbook whose first worksheet is invalid and a later worksheet is valid; confirm import fails.
5. Import a workbook whose active tab is not the first sheet; confirm worksheet index 0 is still used.
6. Confirm all major groups are collapsed after import and no curves are selected by default.
7. Toggle between reagent-first and specimen-first views and confirm selection is preserved.
8. Search across all data and apply a bulk selection action to matches inside collapsed groups.
9. Select a small readable set of curves and render the PCR line chart.
10. Select more than 20 visible curves and confirm the warning appears while export remains possible.
11. Set fixed X and Y axis bounds, then change selection and confirm scale remains fixed.
12. Apply a built-in style preset, confirm affected-count feedback, and use one-step undo.
13. Change legend order and confirm preview/export order matches it.
14. Download PNG and JPEG and confirm chart-only output, white background, and `YYMMDD_plotN.ext` filenames.
15. Copy the chart image to clipboard where supported; confirm fallback where unsupported or blocked.
16. Export plotted-data CSV for a simple current chart; confirm only plotted curves in current order are included.
17. Confirm plotted-data CSV is disabled with a clear reason for a non-simple chart state.
18. Test the production build through the same base path used by GitHub Pages.
19. Review the default chart screenshot and confirm it has a clean modern PCR-plot feel without dense background grid lines.
20. Confirm the implementation does not hardcode reference-image content such as title, threshold line, axis ranges, colors, marker shapes, legend labels, or data values.

## Browser Matrix
Minimum manual verification candidates:

- Latest Chrome
- Latest Edge
- Latest Firefox

Clipboard image behavior should be explicitly checked in Chrome and Edge because browser support and permissions differ.

## GitHub Pages Checks
- Production build emits static assets only.
- No backend server is required.
- No secrets or server-only environment variables are required.
- Asset paths work under a repository base path.
- File import uses browser APIs only.
- Clipboard image copy is tested in HTTPS deployment or a realistic local equivalent.

## Sample Test Data
Create or collect fixture datasets for:

- `.xlsx` PCR workbook: 1 specimen x 8 reagents.
- `.xls` PCR workbook equivalent to the `.xlsx` baseline.
- Real old BIFF `.xls` workbook with Korean labels.
- PCR workbook: many specimens sharing the same reagent names.
- PCR workbook: more than 20 selectable/visible curves.
- PCR workbook: similar specimen or reagent names such as `Sample1`, `Sample 1`, and `Sample-1`.
- PCR workbook: nonnumeric fluorescence cells.
- PCR workbook: formulas with and without cached values.
- PCR workbook: missing specimen or reagent cells.
- PCR workbook: empty rows, empty columns, and uneven curve lengths.
- Multi-sheet workbook where worksheet 0 is valid and later sheets differ.
- Multi-sheet workbook where worksheet 0 is invalid and a later sheet is valid.
- Multi-sheet workbook where worksheet 0 is valid, later sheet is invalid, and import still succeeds from worksheet 0.
- Workbook whose active tab is not worksheet index 0.
- Unsupported/corrupt/password-protected workbook.
- Formula workbook with cached numeric values.
- Formula workbook without cached values.
- Large workbook for performance smoke testing.
- Simple plotted-data export case with shared cycle X values.
- Non-simple plotted-data export case with mismatched X arrays or non-rectangular output.

## Automation Candidates
- Excel parser tests for `.xls` and `.xlsx`.
- First-sheet-only parser tests.
- Expected normalized JSON snapshot tests.
- Fixture manifest path/existence tests once fixtures are created.
- Similar-name warning tests.
- Header and missing-value validation tests.
- Search and selection-state tests.
- Tree derivation and collapsed-default tests.
- All-collapsed initial state snapshot tests for reagent-first and specimen-first trees.
- Axis validation tests.
- Style precedence, preset overwrite, and one-step undo tests.
- Preset undo state-machine tests covering second preset replacement and undo unavailable after use.
- Legend/export order tests.
- Export filename tests with fake browser-local date, for example `260707_plot1.png` and `260707_plot2.jpg`.
- Export filename counter edge tests: image+CSV share a number, CSV-only consumes next number, failed export does not consume a number.
- Export image smoke tests for PNG/JPEG validity and white background.
- Playwright screenshot comparison/review for default chart visual theme.
- Clipboard fallback UI tests.
- Plotted-data CSV inclusion and disabled-reason tests.
- Plotted-data CSV shape tests: header row, duplicate header disambiguation, blank cell for null Y, quoting/escaping, row order.
- End to end smoke test for import to chart to PNG/JPEG download.

## Accessibility Checks
- File input and primary controls are keyboard reachable.
- Buttons have accessible names.
- Grouping toggle has radio or equivalent semantics.
- Accordion/tree controls expose expanded/collapsed state.
- Mixed checkboxes expose their mixed state.
- Form errors are associated with relevant controls where feasible.
- Color is not the only signal for warnings or selected curves.
- Focus remains usable after file import and chart updates.

## Known Gaps
- PCR parser, selection UI, chart preview, style controls, legend order, image export utilities, clipboard fallback, and plotted-data CSV utilities are implemented for MVP.
- The selected test stack is installed and configured for unit/component/Playwright smoke tests.
- Static checked-in sample fixture files do not exist yet; generated workbook fixtures are used in Vitest and Playwright tests.
- PCR-specific expected normalized JSON snapshots do not exist yet.
- Browser checks have been performed with Playwright: upload-first smoke, generated `.xlsx` upload, appended `.xlsx` upload, collapsed reagent-first selection, chart canvas nonblank pixel check, fixed chart viewport height after settings expansion, and sticky chart panel behavior.
- Clipboard behavior has not been manually verified in Chrome/Edge under the final deployment origin.
- GitHub Pages deployment behavior has not been verified.
- Performance budgets for file size, specimen count, imported curve count, and rendered curve count have not been finalized.
- P1/P2 presets are editable per analysis session; persistence across app reloads has not been finalized.

## Current Automated Coverage - 2026-07-08
- Vitest: parser `.xlsx` / `.xls`, first-sheet-only, invalid first sheet, blank/nonnumeric/formula cells, similar-name warnings, append merge identity, selection tree state, chart option theme/scale/style, grouping-aware labels, HEX color input, stable colors, default no markers, marker mappings, style preset undo, editable P1 scale behavior, export filename generation, and plotted-data CSV shape.
- Testing Library: upload-first workspace, IsoAmplar title/developer credit, reagent-first collapsed default, search bulk selection across collapsed groups, grouping-mode selection/header persistence, and Fixed scale Auto-bound copy behavior.
- Playwright: production-preview smoke, generated `.xlsx` upload, appended `.xlsx` upload, reagent-first collapsed state, search bulk select, chart canvas visibility, nonwhite pixel check, chart viewport height stability, and sticky chart behavior.
- Visual artifacts: `docs/gui_mockups/screenshots/phase8_mvp_desktop.png`, `docs/gui_mockups/screenshots/phase8_mvp_mobile.png`, `docs/gui_mockups/screenshots/isoamplar_refinement_desktop.png`, and `docs/gui_mockups/screenshots/isoamplar_append_sticky_refinement.png`.

## Context Compression Quality Gate
Before ending a development session:

- `DEVELOPMENT_STATE.md` reflects the current phase and next step.
- `DECISIONS.md` contains any newly accepted or changed decisions.
- This test plan contains acceptance criteria for newly added behavior.
- `CHANGELOG.md` records user visible changes.
- Known test gaps are visible in this file.
