# 15 릴리스 후보 및 배포 증거

## 상태
Pre-deploy release candidate preparation

## 기준일
2026-07-11

## 릴리스 목적
2026-07-11 GPT-5.6 정밀감사 보완 S0-S11의 입력 추적성, scale/legend/export 정확성, 분석 저장 연속성, 데스크톱 사용성, CI/Pages 안전 게이트를 공개 GitHub Pages 기준으로 확정한다.

## Candidate 식별자
- Candidate branch: `codex/audit-remediation`
- Candidate commit: 배포 전 최종 commit 후 기록
- Candidate tag: 배포 전 생성 후 기록
- Last-known-good public SHA: `9e77ad23ec8e863d3d05e7c8508ceb4729372155`
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
- [ ] 4역할 최종 감사 GO
- [ ] candidate commit/tag 생성
- [ ] branch CI 성공

## 공개 Pages smoke
- [ ] HTTP 200, title/icon/static asset base path
- [ ] synthetic `.xlsx` import와 reagent-first collapsed state
- [ ] curve 선택 후 nonblank canvas
- [ ] Fixed/Box zoom/Previous scale
- [ ] custom legend와 line/marker identity
- [ ] PNG download와 white background
- [ ] Analysis XLSX save/restore
- [ ] 예상하지 않은 console/page error 없음
- [ ] 예상하지 않은 runtime cross-origin request 없음

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
- Branch CI run: pending
- Pages workflow run: pending
- Deployed SHA: pending
- Post-deploy smoke: pending
- Rollback required: pending
