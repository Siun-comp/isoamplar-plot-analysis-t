# AGENTS.md

## Purpose
Operating guide for Codex agents and expert subagents working on this project.

## Status
Active draft

## Last Updated
2026-07-07

## Owner
Agent / Engineering

## Compression-Safe Summary
- Build a static GitHub Pages compatible chart creation web app.
- Supported inputs are `.xls/.xlsx` Excel and post-MVP Quick Paste for tab-separated or single-column data. CSV file/comma-table parsing, manual entry, and source editing are excluded.
- Core chart controls include header filters, layout/batch arrangement, legends, fixed X/Y scales, download, and clipboard copy.
- User data should stay in the browser by default unless a later decision changes this.
- Current truth lives in `DEVELOPMENT_STATE.md`; product scope in `docs/`; rationale in `DECISIONS.md`.

## Update Rule
Update this file only when agent workflow, project operating rules, quality gates, or collaboration rules change. Do not use it as a task log.

## Project Summary
Build a desktop-browser IsoAmplar/LAMP amplification fluorescence analysis page deployed through GitHub Pages. The application imports the fixed two-header PCR/LAMP table shape, lets users select curves, configure scales/styles/labels, and export or save a complete Analysis XLSX continuation file.

Detailed feature discussions are intentionally pending. Do not treat any chart library, UI architecture, or MVP scope as final unless it is recorded in `DECISIONS.md`.

## Required Reading Order
Before making meaningful changes, read:

1. `DEVELOPMENT_STATE.md`
2. `DECISIONS.md`
3. `docs/01_PROJECT_CHARTER_KR.md`
4. Relevant requirement, input/output, or test documents under `docs/`
5. Source files once implementation begins

## Context Compression Protocol
Before ending a substantial work session, update `DEVELOPMENT_STATE.md` with:

- Current goal and milestone
- Completed work
- Files changed
- Implemented, partially implemented, and not implemented items
- Known risks and blockers
- Verification status
- Exact next 3 tasks

If a product or technical decision changes, update `DECISIONS.md` in the same turn.

If behavior, acceptance criteria, or supported input/output formats change, update the matching document under `docs/`.

If user visible behavior changes after implementation begins, update `CHANGELOG.md`.

## Collaboration Model
Use expert agents for bounded review or independent side work when requested by the user or when the task benefits from parallel specialist review.

Recommended expert roles:

- Product requirements expert: validates user workflows, MVP scope, and priorities.
- Data visualization expert: validates chart configuration, scale behavior, legend behavior, and export expectations.
- Frontend engineering expert: validates static app architecture, state model, component boundaries, and GitHub Pages constraints.
- QA and release expert: validates acceptance tests, browser compatibility, and regression coverage.

The lead agent remains responsible for integrating expert output, checking consistency, and updating the authoritative documents.

## Engineering Defaults
These defaults are provisional until confirmed in `DECISIONS.md`:

- Build as a static single page application suitable for GitHub Pages.
- Process uploaded data locally in the browser.
- Avoid server dependencies in the initial version.
- Prefer established libraries for Excel parsing and chart rendering.
- Keep requirements and tests traceable by IDs.

## Traceability Rules
Use these prefixes consistently:

- Functional requirements: `FR-001`
- Input/output rules: `IO-001`
- Acceptance criteria: `AC-001`
- Decisions: `D001`

Every Must requirement should have at least one linked acceptance criterion before implementation is considered complete.

## Project Vocabulary
- Dataset: normalized in-memory curve data after Excel or Quick Paste import.
- Header: a column name from the dataset.
- Series: one plotted data group.
- Chart configuration: graph type, data mapping, axes, legend, layout, colors, and export options.
- Fixed scale: user supplied min/max axis bounds that remain stable across filtering and redraws.
- Layout/batch arrangement: chart sizing and placement behavior, including potential multi-chart arrangement. Exact meaning is still pending user confirmation.

## Quality Gates
A task is done only when:

- The implemented or documented behavior is reflected in relevant project documents.
- Decisions are recorded if they affect architecture, libraries, scope, data handling, or deployment.
- Acceptance criteria or tests exist for user visible behavior.
- Parser, chart rendering, export, clipboard, filtering, and axis lock changes have verification notes.
- `DEVELOPMENT_STATE.md` allows a future agent to continue without guessing.

## Release QA Rule
Before a user visible release:

- Run available automated tests.
- Complete manual browser smoke checks.
- Verify production build behavior under a GitHub Pages style base path.
- Verify image download and clipboard fallback behavior.
- Update `CHANGELOG.md`.
