# IsoAmplar Plot Analysis T

Desktop browser tool for reviewing and exporting IsoAmplar/LAMP amplification fluorescence plots. It is a static React application deployed on GitHub Pages; imported data is processed in the browser.

This tool is for research and kit-development visualization. Its Threshold table uses the working labels `Positive` and `ND` for user-defined crossing status only; these labels are not clinical positive/negative interpretation. The app does not calculate Ct/Cq.

## Current Capabilities

- Open `.xls` / `.xlsx` files and use the first worksheet only.
- Enter a specimen once for consecutive reagent columns; later blank specimen cells inherit the nearest explicit specimen to their left within that source.
- Ignore columns whose reagent header is truly blank or exactly `-`; an explicit specimen on an ignored column still anchors later specimen inheritance.
- Append another Excel workbook without changing existing selection or settings.
- Quick Paste Import for tab-separated or single-column comparison data, with read-only preview and warnings.
- Reagent-first or specimen-first selection, full-dataset search, and stable `curveId` identity.
- Reversible curve/specimen/reagent exclusion with duplicate-label source confirmation and exact restore; imported fluorescence remains intact.
- ECharts plot preview with Auto, Fixed, FAM/HEX Y presets, user-editable preset bounds, Box zoom, Previous scale, and raw point readout.
- Common or exact per-reagent user-set raw fluorescence Thresholds per analysis, with independent preview/export visibility and auditable per-curve observed and Cycle-axis linear crossing evidence. An unconfigured reagent is excluded from Threshold analysis rather than reported as ND.
- Specimen/reagent group styles, per-curve overrides, HEX colors, line types, markers, and an optional eight-color quick palette that preserves the full color editor.
- User-controlled legend order, Analysis labels, Auto compact labels, and separate plot/legend outputs.
- PNG/JPEG download, PNG clipboard copy with fallback, rich Excel legend clipboard, Selected Data XLSX schema 4 with exact per-reagent Threshold result/event evidence, and secondary conditional plotted-data CSV.
- Named Selection Sets for switching recurring curve combinations without changing scale, style, labels, or order.
- Multiple analysis tabs and Analysis XLSX schema 7 save/restore containing the complete imported dataset, exclusion state, settings, Selection Sets, and Common/per-reagent Threshold configuration.

The app does not smooth, normalize, baseline-correct, log-transform, or average fluorescence data. Its optional user-set raw Threshold feature reports a versioned geometric crossing estimate together with observed raw evidence; it does not recommend a Threshold, bridge null gaps, calculate Ct/Cq/Tt/Tp, or make a clinical interpretation. `Positive` means a calculable upward crossing and `ND` means no crossing reached under the user-set Threshold.

## Input Contract

Excel columns represent curves:

1. Row 1: specimen or experimental condition
2. Row 2: reagent or assay/channel
3. Row 3 onward: fluorescence values in cycle order

The first included curve column must resolve to a specimen label. A truly blank later specimen cell means "same specimen as the nearest explicit label to the left". This shorthand applies only inside the current workbook or full-table paste. A truly blank reagent header or the exact trimmed text `-` excludes that column from analysis; reagent labels never inherit. An explicit specimen label above an excluded reagent column remains a valid inheritance anchor for later included columns.

Quick Paste accepts Excel-style tab-separated ranges and delimiter-free single columns. CSV files, comma-separated tables, in-app source editing, custom X/cycle columns, and worksheet selection are not supported.

## Privacy

The production app has no backend requirement. Release browser tests allow only known static app `GET/HEAD` requests plus local `blob:` / `data:` output and fail on same-origin writes, cross-origin requests, or WebSockets. Exported files remain under the user's control.

## Development

```bash
npm ci
npm run dev
```

Local development: `http://127.0.0.1:5173/`

## Verification

```bash
npm run check:diff
npm run test
npm run test:audit
npm audit --omit=dev --audit-level=high
npm run build
npm run test:e2e
```

Playwright starts a fresh production preview on port `4174` and never reuses an existing server. CI builds once for `/isoamplar-plot-analysis-t/`, records the complete `dist` SHA-256 manifest, runs fresh Chromium, and rejects any pre/post-test byte difference.

## Deployment

Pushes to `main` and manual workflow dispatch run the verified GitHub Pages workflow. The build job is read-only; only the deploy job receives Pages/OIDC write permissions.

Public app: https://siun-comp.github.io/isoamplar-plot-analysis-t/

This `T` edition is now the sole maintained product. The original non-T deployment is retained only as a historical rollback artifact and does not receive feature patches. The current app exposes its version and user-facing history; immutable prior T releases can be opened from the version dialog for result reproduction.

Developer: Jang Si Un
