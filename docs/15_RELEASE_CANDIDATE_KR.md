# 15 릴리스 후보 및 배포 증거

## 상태
Released - post-deploy smoke passed

## 기준일
2026-07-11

## 릴리스 목적
2026-07-11 GPT-5.6 정밀감사 보완 S0-S11의 입력 추적성, scale/legend/export 정확성, 분석 저장 연속성, 데스크톱 사용성, CI/Pages 안전 게이트를 공개 GitHub Pages 기준으로 확정한다.

## Candidate 식별자
- Candidate branch: `codex/audit-remediation`
- Initial candidate commit/tag: `dcdbc21c01adafd355fa60d9d0cda0e54c853444` / `release-20260711-audit-remediation`
- Final promoted commit/tag: `eae3281fb8f9bbbd900fab528be3e094b93b555a` / `release-20260711-audit-remediation-r1`
- Pre-release rollback SHA: `9e77ad23ec8e863d3d05e7c8508ceb4729372155`
- Current released product artifact source SHA: `eae3281fb8f9bbbd900fab528be3e094b93b555a`; evidence-only documentation commits may follow without changing the verified dist hash
- Local Pages-base dist tree SHA-256: `1012572727dd66d74763775f828fef165baa24012c61c770db6617e90d6cce46`
- Public URL: https://siun-comp.github.io/isoamplar-plot-analysis/

## Local release evidence
- `git diff --check`: pass
- Vitest: 32 files / 265 tests pass
- Audit probe: 1 pass
- Production dependency audit high/critical: 0 vulnerabilities
- Pages-base production build: pass
- Fresh Chromium: 11/11 pass with fail-on-flaky
- Dist pre/post Playwright SHA-256: byte-identical at `1012572727dd66d74763775f828fef165baa24012c61c770db6617e90d6cce46`
- In-app 1366x768 Pages path: no horizontal overflow, no console warning/error
- Final S10 release/security review: GO
- Final S10 browser/data-integrity review: GO
- User guide: 16 pages, synthetic-only, Poppler render QA pass, sensitive-term/path scan clear
- Representative workbook local-only smoke: import, all-curve selection, nonblank canvas, user-labelled P1/P2 apply, browser error 0; no label/value/path was copied into repository evidence

## 배포 전 최종 자동 확인
- [x] 최종 working tree와 문서 link 검사
- [x] 전체 test/audit/build/fresh Chromium
- [x] exact dist hash 재기록
- [x] 4역할 최종 감사 GO - product/domain, data/privacy, desktop UX/accessibility, QA/release
- [x] candidate commit/tag 생성
- [x] branch CI 성공

## 공개 Pages smoke
- [x] HTTP 200, title/icon/static asset base path
- [x] synthetic `.xlsx` import와 reagent-first collapsed state
- [x] curve 선택 후 nonblank canvas
- [x] P2/Box zoom/Previous scale
- [x] custom legend와 dashed-line/circle-marker identity
- [x] PNG download와 white opaque background
- [x] Analysis XLSX save/restore
- [x] 예상하지 않은 console/page error 없음
- [x] 예상하지 않은 runtime cross-origin request 없음

공개 smoke는 합성 fixture만 사용했다. 공개 URL의 25개 known `dist` file을 로컬 검증 artifact와 byte 비교해 mismatch 0을 확인했다. 내보낸 PNG는 2400 x 1772, 네 모서리 흰색, alpha 255였고, Analysis XLSX는 공개 앱에서 새 분석 탭으로 복원됐다.

## 사용자 수동 검수
- [ ] 실제 업무 workbook의 label/curve/warning 확인
- [ ] 실제 비교 범위 P1/P2와 style 확인
- [ ] Windows Chrome/Edge clipboard PNG 확인
- [ ] Excel rich legend paste의 cell/font/style 확인
- [ ] 큰 실제 workbook의 체감 성능 확인

## 미결정 사항
- 공식 최대 file/curve/cycle/browser-memory 지원 한계
- internal analysis tab warning 또는 hard cap
- public Pages 유지 또는 조직 접근제어 hosting
- Named View, Export Preflight, multi-step settings undo

이 항목은 현재 릴리스의 데이터 무결성 또는 핵심 분석 흐름을 차단하지 않는다. 새 범위 도입 시 별도 요구사항과 schema/roundtrip 테스트가 필요하다.

## Rollback trigger
- 지원 입력이 import되지 않거나 원본 수치가 달라짐
- 선택 후 chart canvas가 비어 있음
- scale 또는 preview/export parity 실패
- legend identity/style 불일치
- Analysis XLSX exact restore 실패
- 예상하지 않은 runtime request 또는 심각한 browser error

## Rollback 절차
1. 실패 candidate를 직접 force-push로 지우지 않는다.
2. 실패 commit을 revert하는 새 commit 또는 last-known-good tree 복구 commit을 만든다.
3. 같은 Pages workflow로 배포한다.
4. import, nonblank chart, scale/export, Analysis XLSX, network smoke를 다시 수행한다.
5. rollback SHA, workflow run, 공개 URL 결과를 `DEVELOPMENT_STATE.md`에 기록한다.

## 배포 후 기록
- Final branch CI run: https://github.com/Siun-comp/isoamplar-plot-analysis/actions/runs/29156244025 - success, 11 Chromium tests
- Initial Pages run: https://github.com/Siun-comp/isoamplar-plot-analysis/actions/runs/29156159533 - failed before build on historical Markdown trailing whitespace; no deployment occurred and the prior public version remained active
- Final Pages workflow run: https://github.com/Siun-comp/isoamplar-plot-analysis/actions/runs/29156323546 - success
- Deployed product artifact source SHA: `eae3281fb8f9bbbd900fab528be3e094b93b555a`
- Post-deploy smoke: pass at 2026-07-11 23:39 KST
- Rollback required: no
- Nonblocking workflow annotation: GitHub reports Node 20 deprecation for current action majors while forcing them to Node 24; both branch and Pages workflows completed successfully

## Post-S11 Selection Workflow 배포 기록

- 기능 범위: Selection Sets, Analysis XLSX schema 4, Selected Data XLSX, output-role rejection, updated synthetic user guide
- Final product source SHA: `6c57afbf09a55fbb99d9e7474fb645a21a24ec95`
- Final branch CI run: https://github.com/Siun-comp/isoamplar-plot-analysis/actions/runs/29161091055 - success, 293 Vitest tests and 12 Chromium tests
- Final Pages workflow run: https://github.com/Siun-comp/isoamplar-plot-analysis/actions/runs/29161173159 - success
- Public smoke: 1280x720 synthetic original-data import, one-curve selection, Selection Set creation, Selected Data XLSX download/readback, five-sheet and hidden-role-marker verification, no document horizontal overflow, zero browser errors, zero unexpected external origins
- Public URL: https://siun-comp.github.io/isoamplar-plot-analysis/
- Rollback required: no

## Threshold 확장 로컬 후보 - 2026-07-14

- Product identity: `IsoAmplar Plot Analysis T`; separate target repository and Pages path `isoamplar-plot-analysis-t`
- 기준 branch/HEAD: `codex/audit-remediation` / `6a2fe80d94d3a269a6dc728cd57efa3a7276faa9` plus approved T-edition release candidate
- 범위: 사용자 지정 raw fluorescence Threshold, crossing evidence, Analysis XLSX schema 5, Selected Data XLSX schema 2
- Vitest: 41 files / 336 tests pass
- Audit probe: 1 pass
- Production dependency audit: 0 vulnerabilities
- Production build: pass
- Fresh Chromium: 13/13 pass
- T Pages base-path complete dist pre/post Playwright SHA-256: byte-identical at `1fccad63a0182049c6d266b99642fb03b0b5be68e7e319ebd5fb17d0f8585224`
- Browser evidence: synthetic import, Threshold apply, Auto Y non-expansion, preview/export independent visibility, out-of-range PNG raster difference, Selected Data XLSX result/event readback, Analysis XLSX schema 5 restore, no unexpected network/browser error
- Desktop evidence: synthetic screenshots only; no document horizontal overflow, fixed chart viewport retained, Korean text and compact settings/results verified
- Audit remediation: per-event raw bracket/cell/source/formula-cache evidence is inspectable in the bounded UI; multiple crossings are included in review; non-primary XLSX notes no longer claim a displayed crossing; all outcome families and mismatched-draft restore are regression-tested
- Independent final re-audit: GO; no release-blocking correctness, UX, accessibility, density, or data-integrity finding
- User guide: Threshold workflow, observed/interpolated distinction, expanded source evidence, troubleshooting, and synthetic screenshots added; 19-page A4 PDF render and sensitive-term scan passed
- Release status: separate T-edition commit, tag, Pages deployment, and public smoke complete; original non-T repository and Pages URL remain unchanged.

## IsoAmplar Plot Analysis T 배포 기록

- Product source commit: `3b6c6a1ba79793979780a44b10edd9760874b8c0`
- Rollback tag: `release-20260714-threshold-edition`
- Separate repository: https://github.com/Siun-comp/isoamplar-plot-analysis-t
- Pages workflow: https://github.com/Siun-comp/isoamplar-plot-analysis-t/actions/runs/29302909343 - success
- Public URL: https://siun-comp.github.io/isoamplar-plot-analysis-t/
- Public smoke: T title/H1 and Threshold empty-state were present, browser warning/error log was empty, and the original non-T URL still exposed the non-T title/H1.
- Original isolation: no push was made to `https://github.com/Siun-comp/isoamplar-plot-analysis.git`.

## M13 T판 보고서 출력 가독성 패치 - 로컬 후보

- 신규 분석의 Chart image layout 기본값: `Plot only`
- 기존 Analysis XLSX에 명시된 `plotOnly`, `plotWithLegend`, `legendOnly`: 값 그대로 복원
- Plot 포함 PNG/JPEG/clipboard: 1200 x 760 논리 캔버스와 2x 래스터(2400px 너비), 9.5 cm 축소 배치를 고려한 축·선·마커·여백 출력 전용 프로필
- Preview, raw fluorescence, 선택 curve, X/Y bounds, 순서와 스타일: 변경 없음
- T판 Threshold export annotation: 긴 설명 대신 수치 중심 라벨; 설정·결과 근거 문구는 유지
- `npm run test`: 42 files / 337 tests
- `npm run test:audit`: 1/1
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities
- T Pages base-path build: pass
- Fresh Chromium: 13/13
- Exact `dist` pre/post Playwright SHA-256: `2f2da701e1fd4c8412eb17ff80ba34516f995777909f2271526ab7ff585f7632`, byte-identical
- Independent audit follow-up: proportional line widths retain 2.25/3 distinctions, Plot + Legend samples match plot geometry, out-of-range Threshold annotation uses 36px export text, and a downloaded 2400 x 1520 Plot PNG is now a Chromium regression gate
- Final independent re-audit: all prior P2/P3 findings resolved; no release blocker, GO
- 19-page T user guide: regenerated; Export page Poppler render QA pass
- Initial product commit `35e10da` and Pages run `29315096289` succeeded; independent-audit correction commit, final Pages deployment, and public smoke pending
