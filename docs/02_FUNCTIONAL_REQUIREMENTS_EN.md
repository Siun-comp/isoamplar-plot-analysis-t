# 02 Functional Requirements

## Purpose
Define user visible functional requirements for the chart creation web app.

## Status
Active draft

## Last Updated
2026-07-08

## Owner
Product / Engineering / Agent

## Compression-Safe Summary
- Requirements are focused on the IsoAmplar Plot Analysis MVP for PCR/LAMP-style amplification fluorescence curve analysis.
- MVP input is Excel upload only: `.xls` and `.xlsx`, first worksheet only, no in-app data editing. Additional Excel files may be appended to the current analysis.
- CSV import, pasted input, manual entry, generic spreadsheet charting, SVG/PDF export, and transparent background are future candidates, not MVP.
- Must-have baseline covers Excel parsing, reagent-first selection, clean amplification line charting, fixed axes, user-editable P1/P2 scale presets, stable styling, PNG/JPEG export, clipboard fallback, and GitHub Pages.
- Each Must requirement should map to at least one `AC-*` item.
- Implementation details belong in decisions or source code, not requirement text.
- Open questions must remain explicit rather than hidden in assumptions.

## Update Rule
Update this file whenever a feature is added, removed, reprioritized, or behavior changes. Link requirements to acceptance criteria in `docs/04_TEST_PLAN_ACCEPTANCE_EN.md`.

## Priority Legend
- Must: required for initial usable product unless the user changes scope.
- Should: important but can be deferred if MVP needs to shrink.
- Could: useful future enhancement.

## Primary User Workflow
1. Open the web page.
2. Upload an Excel workbook.
3. Review the detected PCR structure from the first worksheet: row 1 specimen, row 2 reagent, row 3 onward fluorescence.
4. Select curves by reagent-first or specimen-first grouping.
5. Configure fixed/preset X/Y scales, styles, legend order, and export settings.
6. Preview the PCR amplification line chart.
7. Download PNG/JPEG or copy the chart output where supported.

## Requirements

| ID | Priority | User Story | Functional Requirement | Acceptance Criteria | Notes / Edge Cases |
| --- | --- | --- | --- | --- | --- |
| FR-001 | Must | As a user, I want to import PCR Excel data. | The app shall import `.xls` and `.xlsx` files from the browser, parse only the first worksheet, and support either replacing the current dataset or appending another file to the current analysis. | AC-001, AC-002, AC-PCR-001, AC-PCR-015, AC-PCR-016, AC-PCR-025 | Later worksheets are ignored in MVP. If the first worksheet is invalid, import fails even if later worksheets are valid. |
| FR-002 | Could | As a user, I may later want CSV import. | CSV import is deferred beyond MVP. | TBD | Do not implement for MVP unless the user reopens scope. |
| FR-003 | Could | As a user, I may later want pasted or manual data input. | Pasted table input, manual entry, and in-app data editing are deferred beyond MVP. | AC-PCR-017 | Corrections happen in the source file followed by reupload. |
| FR-004 | Must | As a user, I want to review detected PCR structure. | The app shall detect and display row 1 specimens, row 2 reagents, row 3+ fluorescence values, generated cycle values, and import warnings. | AC-001, AC-002, AC-PCR-001, AC-PCR-019 | Similar names warn only; no auto-merge, rename, or correction UI. |
| FR-005 | Must | As a user, I want to select analysis curves. | The app shall support reagent-first selection by default, optional specimen-first grouping, search, global search bulk actions, selected/unselected filters, collapsed groups, and grouped-row readability styling. | AC-004, AC-PCR-003, AC-PCR-004, AC-PCR-005, AC-PCR-018, AC-PCR-025 | Search bulk actions apply to all matched curves, not only visible rows. Curve labels follow the active grouping mode. |
| FR-006 | Must | As a user, I want to generate amplification plots. | The app shall render selected curves as clean amplification line charts using generated cycles as X values unless later configured otherwise. | AC-006, AC-PCR-006, AC-PCR-012, AC-PCR-023, AC-PCR-024, AC-PCR-025 | No automatic smoothing, normalization, Ct/Cq, averaging, or log transform. Visual style should be polished and readable, not decorative or dense. The preview plot viewport should not stretch when side panels expand and should stay visible during desktop page scrolling. |
| FR-007 | Could | As a user, I may later want layout or batch arrangement. | Multi-chart layout, batch output, and graph boards are deferred beyond the single-chart MVP. | TBD | Revisit after the single-chart PCR workflow is stable. |
| FR-008 | Must | As a user, I want to configure legends and styles. | The app shall support legend visibility/mode, current-order legend/export ordering, group style rules, stable default colors, color picker and HEX color input, individual curve overrides, optional markers, and preset overwrite semantics. | AC-006, AC-PCR-008, AC-PCR-009, AC-PCR-020, AC-PCR-024, AC-PCR-025 | Built-in presets only for MVP unless later approved. Default curves are solid lines without markers. |
| FR-009 | Must | As a user, I want fixed X-axis scales. | The app shall allow automatic, user fixed, or user-defined P1/P2 X-axis min/max values. | AC-007, AC-PCR-024 | Invalid bounds must be rejected. Fixed mode should show current Auto bounds as editing aid. |
| FR-010 | Must | As a user, I want fixed Y-axis scales. | The app shall allow automatic, user fixed, or user-defined P1/P2 Y-axis min/max values. | AC-008, AC-PCR-024 | Fixed bounds should persist across filtering and redraws. P1/P2 values are user-entered, not invented defaults. |
| FR-011 | Must | As a user, I want to download chart images. | The app shall export the current chart as PNG and JPEG with white background and filename `YYMMDD_plotN.ext`. | AC-009, AC-PCR-010 | Example on 2026-07-07: `260707_plot1.png`. Transparent background is out of MVP. |
| FR-012 | Must | As a user, I want to copy charts to the clipboard. | The app shall copy the current chart image to the clipboard where supported and provide a fallback when unsupported. | AC-010 | Clipboard image copy requires browser support, HTTPS, and user gesture. |
| FR-013 | Must | As a user, I want the app hosted from GitHub. | The app shall work as a static GitHub Pages deployment without required backend services. | AC-011 | Asset paths must work under a repository base path. |
| FR-014 | Should | As a user, I want understandable errors. | The app shall show actionable errors for invalid input, invalid mappings, export failure, and clipboard failure. | AC-012 | Error copy should be concise and user oriented. |
| FR-015 | Could | As a user, I want reusable chart configurations. | The app may allow downloading or reloading chart configuration JSON. | TBD | Future scope unless user prioritizes it. |
| FR-016 | Should | As a user, I may want exported plotted data. | The app should export currently plotted data as CSV only when the current chart state is simple and rectangular enough for reliable output. | AC-PCR-021, AC-PCR-022 | Disable with a clear reason when the chart state is not safely exportable. |

## Confirmed Chart Type
- Amplification fluorescence line chart for IsoAmplar analysis.

Other chart types are future candidates only.

## Chart Configuration Fields
Candidate configurable fields:

- Chart title
- X axis label
- Y axis label
- Default visual theme
- Legend visibility
- Legend position
- Series display name
- Series color
- Chart width and height
- Margins or layout presets
- Grid visibility
- X axis automatic scale
- X axis fixed min and max
- Y axis automatic scale
- Y axis fixed min and max

The fixed scale behavior must remain stable after filtering, data remapping, and chart redraws unless the user resets it.

## Default Chart Visual Direction
- White background.
- Clean clinical/report style rather than decorative dashboard styling.
- Sparse major grid lines only by default; dense minor grid lines are off by default.
- Axis, title, and legend typography should be readable and modern without becoming overly austere.
- Lines should have balanced width and distinguishable colors/line styles.
- Default lines should have no point markers; markers are individual curve options only.
- PNG/JPEG export should match the preview's visual style.
- Reference images are style direction only. Do not hardcode reference-specific title text, axis labels, axis ranges, threshold/reference line, marker shapes, colors, legend labels, curve count, or data values.

## Privacy Requirement
By default, imported user data should stay inside the browser session and should not be uploaded to any server.

If future features require remote storage or sharing, they must be explicitly approved and documented in `DECISIONS.md`.

## Open Questions
- What maximum row count and file size should be targeted?
- Should advanced filters beyond search and selected/unselected state be global, per chart, or both?
- Should chart/style presets be saved in a future version?
- Should chart configuration JSON be downloadable?

## MVP Implementation Status - 2026-07-08
- Implemented: `.xls` / `.xlsx` upload, append upload, first worksheet only, row 1 specimen / row 2 reagent / row 3+ fluorescence parsing, generated cycle X values, warning-only similar names, missing-header warnings, and no source-data editing.
- Implemented: reagent-first default selection, specimen-first alternate view, grouping-aware curve labels, all groups collapsed after import, curveId-based selection, search/filter bulk actions across collapsed groups, grouped row banding, and virtualized major-group tree rendering in browser.
- Implemented: ECharts amplification line chart preview with white background, sparse major grid, no minor grid, fixed/sticky plot preview, stable default colors, default no-marker solid lines, fixed/auto/user-defined P1/P2 X/Y scales, >20 visible-curve warning, group/individual style controls, built-in style presets with one-step undo, and user legend/export order.
- Implemented: PNG/JPEG image export with white background, PNG clipboard copy with fallback message, and plotted-data CSV export when selected curves share a rectangular X axis.
- Not finalized: persistence for P1/P2, style presets, or chart configuration across app reloads.
- Deferred: CSV import, paste/manual input, in-app data editing, sheet picker, saved custom presets, chart configuration JSON import/export, multi-chart/batch layout, SVG/PDF export, and transparent background export.
