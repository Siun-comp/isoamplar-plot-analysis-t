# Phase S9 Performance Evidence

## Status

- Phase: S9 hover/editor performance remediation
- Updated: 2026-07-11
- Data policy: generated synthetic labels and fluorescence values only
- Product-limit policy: measurements are comparative evidence, not official support limits

## Reproduce

```powershell
npm run build
npm run test:e2e:s9-performance
```

The Playwright test disables retries, prints one `S9_PERFORMANCE` JSON line, and attaches the same JSON structure to the test result. The standard full Chromium suite also executes this workload. The first import is marked cold and the second import reuses the already loaded application modules.

## Workloads

| Workload | Curves | Cycles per curve | Purpose |
| --- | ---: | ---: | --- |
| Reference | 20 | 100 | Typical readable comparison workload |
| Stress | 100 | 100 | Dense interaction and editor stress workload |

Both workbooks are generated during the test. They model the intended domain shape by repeating at most eight synthetic reagents across an increasing number of synthetic specimens. No user workbook, specimen name, reagent name, or fluorescence value is used.

## Representative Result

Fresh Chromium, one worker, production `dist`, local Windows desktop:

| Metric | 20 x 100 | 100 x 100 |
| --- | ---: | ---: |
| Module-cache state | Cold first import | Warm module cache |
| Excel import | 223.29 ms | 176.40 ms |
| Select all + nonblank chart | 477.64 ms | 558.30 ms |
| 20 moves + committed readout | 1,530.27 ms | 1,665.39 ms |
| Style editor open | 80.68 ms | 102.62 ms |
| Legend Labels open | 76.21 ms | 104.24 ms |
| New-analysis + return tab | 144.09 ms | 284.49 ms |
| Plot-only PNG completed | 235.08 ms | 298.26 ms |
| DOM elements with Style open | 997 | 3,343 |
| DOM elements with Legend Labels open | 997 | 3,343 |

The values include Playwright command and assertion overhead. They are useful for detecting large regressions on the same machine and command, not for defining a universal browser speed guarantee.

## Algorithm Evidence

- Pointer movement is coalesced to the latest point once per animation frame.
- The nearest-X index is found before pixel-distance comparison. Every point whose X coordinate lies inside the 32 px horizontal hit window remains eligible, preserving steep-curve, exact-boundary, null-gap, and duplicate-X behavior.
- In the deterministic 100-curve x 100-cycle regression geometry, the current path performs no more than 800 point-to-pixel conversions instead of the previous 10,000, and the test requires at least a fivefold work-unit reduction. Extremely compressed X scales can legitimately produce a wider candidate window to preserve correct hit testing.
- Hover highlighting applies a data-free series style patch. It does not rebuild or resend fluorescence arrays, marker types, labels, or series order.
- The patch is applied through a real ECharts SSR model test and must preserve data, marker, line type/color, order, restoration, and series removal after option replacement.
- Identical readout values do not create a new React readout state object.
- Pointer work carries an option/mode generation and intent. Box zoom changes, drag cancellation, option replacement, global-out, and component cleanup cancel or invalidate stale queued work.

## Editor Decision

The measured 100-curve Style editor opened in about 103 ms and Legend Labels in about 104 ms. The no-retry Chromium regression also scrolls to the final Legend Labels row, changes its analysis label, and resets that row to its original value. Both editors therefore complete representative browser interaction without a freeze. S8 already removed permanently mounted popover panels. S9 does not add a new virtualized Style/Legend workflow; that would add focus, scroll, and editor-state risk without a measured blocking bottleneck.

## Remaining Limits

- No official maximum file size, curve count, cycle count, or interaction-time budget is declared.
- Results vary with CPU, browser, extensions, and concurrent applications.
- Browser-process out-of-memory behavior is not converted into a product guarantee.
- Representative user files are still required before a hard performance budget or supported maximum can be approved.
