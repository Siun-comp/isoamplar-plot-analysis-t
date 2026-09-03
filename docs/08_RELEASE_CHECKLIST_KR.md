# 08 릴리스 체크리스트

## 상태
Active release gate

## 최종 갱신
2026-09-04

## v1.2.0 시약별 Threshold·색상 팔레트 게이트
- [x] v1.1.0 정적 실행판과 SHA-256 manifest 보존
- [x] 보관 실행판은 Git binary 속성으로 원본 줄바꿈/바이트를 보존하며 patch-format 검사에서 제외
- [x] 공통/시약별 모드 전환 시 각 설정 보존
- [x] 정확한 `reagentId` 기준 적용, 신규 시약 미설정, 미설정 curve ND 오분류 방지
- [x] 시약별 입력 전체 선검증 및 부분 적용 없는 원자적 `모두 적용`
- [x] Preview/Plot Export 동일 다중 Threshold projection과 동일 값 병합
- [x] Threshold Excel clipboard 5열 및 Selected Data XLSX schema 4 근거
- [x] Analysis XLSX schema 6 roundtrip과 schema 5 Common migration
- [x] 모든 색상 팝업의 선택형 8색 정사각형 팔레트와 기존 HEX/picker 유지
- [x] 전체 Vitest 45 files / 393 tests, audit 1/1, dependency vulnerabilities 0, Pages build, fresh Chromium 13/13
- [x] Playwright 전후 complete `dist` byte-identical: `d4c5651a323f6158ca5323b739121c308a483325ed50f2a8736678b57347c6e0`
- [x] 데이터 무결성·데스크톱 UX 재감사 잔여 항목 해소: 시약별 전부 미설정 XLSX 근거와 긴 Threshold 라벨 수치 보존. 전문가 재감사는 사용 한도 중단 전 핵심 불변조건을 확인했고, lead가 기록된 잔여 검사를 완료하여 release blocker 없음.
- [x] commit/tag/push/Pages 배포 및 최신/v1.1/v1.0 공개 smoke: head `6936093`, tag `v1.2.0`, run `33558251077`

배포 전 보관 자산의 Git 줄바꿈 정규화를 차단하는 과정에서 run `33557883231`과 `33558044276`이 각각 형식 검사와 archive manifest 검사에서 중단되었다. 두 실행은 배포 단계에 도달하지 않았고, 바이너리 속성 적용 및 archive byte 재인덱싱 후 최종 run에서 전체 gate와 배포가 통과했다.

## v1.1.0 단일 유지보수 T판 게이트
- [x] 배포 전 T판 `v1.0.0` 정적 빌드 및 SHA-256 manifest 보존
- [x] 공란/문자 `-` 시약 열 제외, 전부 제외 차단, 제외 열 검체 anchor 유지
- [x] 원본 확장자 제거 분석 이름 및 중복 날짜 없는 Analysis XLSX 파일명
- [x] 새 분석 Y축 FAM/HEX 기본 preset과 Analysis XLSX 복원 우선순위
- [x] Threshold `Positive`/`ND` UI·Excel clipboard·Selected Data XLSX schema 3 일치
- [x] 앱 버전/변경 이력/이전판 링크와 Analysis XLSX Settings app version
- [x] 전체 Vitest 45 files / 381 tests 및 audit 1/1 gate
- [x] T Pages base-path production build와 fresh Chromium 13/13
- [x] 사용자 가이드 20-page PDF 재생성 및 시각 검수
- [x] GitHub Pages 배포와 최신/보관 URL 공개 smoke: source `60b9414`, run `30802527069`

## Threshold 로컬 후보 게이트
- [x] raw fluorescence 불변 및 `null` 비연결 계산 규칙 검증
- [x] 미리보기 표시와 Plot Export 포함 독립 제어
- [x] Analysis XLSX schema 5 저장·복원·재계산
- [x] Selected Data XLSX schema 2 결과/event sheet와 raw `PlottedData` 분리
- [x] `npm run test`: 41 files / 336 tests
- [x] `npm run test:audit`: 1 audit probe
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities
- [x] production build
- [x] fresh Chromium `13/13`
- [x] T Pages base-path exact `dist` pre/post Playwright equality: `1fccad63a0182049c6d266b99642fb03b0b5be68e7e319ebd5fb17d0f8585224`
- [x] synthetic Threshold preview/export raster difference, Y범위 밖 export 안내, workbook download/readback
- [x] 다중 교차 검토 분류와 curve별 raw point/cell/source/formula-cache event 근거
- [x] 로컬 데스크톱 화면: 문서 가로 overflow 없음, 고정 chart 높이, 한글 깨짐/console error 없음
- [x] 최종 독립 재감사: prior P1/P2 4건 해소, release-blocking finding 없음, GO
- [x] 사용자 로컬 검수 및 T 에디션 별도 배포 승인
- [x] `isoamplar-plot-analysis-t` commit/push/GitHub Pages 배포 및 공개 smoke: source `3b6c6a1`, run `29302909343`

## M13 보고서 출력 가독성 패치

- [x] 신규 분석 Chart image layout 기본값 `Plot only`
- [x] Analysis XLSX 명시적 기존 layout 값 보존
- [x] 9.5 cm 축소 배치용 출력 전용 축·선·마커·여백 프로필
- [x] preview와 source data/scale/selection/order/style 비변이 테스트
- [x] T판 Threshold 수치 중심 annotation과 Y범위 밖 안내
- [x] T판 42 files / 337 tests, audit 1/1, dependency vulnerabilities 0
- [x] T Pages base-path build와 fresh Chromium 13/13
- [x] proportional line-width distinction and matching Plot + Legend sample geometry
- [x] T판 out-of-range Threshold export annotation 36px profile
- [x] downloaded Plot PNG 2400 x 1520/white/opaque/nonblank raster regression
- [x] T판 exact `dist` pre/post Playwright equality: `2f2da701e1fd4c8412eb17ff80ba34516f995777909f2271526ab7ff585f7632`
- [x] T 사용자 가이드 PDF 재생성과 Export page render QA
- [x] T판 commit/push/Pages/public smoke: `274260b`, run `29317052614`
- [x] 원본판 공통 변경 이식과 독립 전체 게이트
- [x] 원본판 commit/push/Pages/public smoke: `95c2977`, run `29317061923`

## M14 T판 Threshold Excel 클립보드

- [x] 현재 상태 필터 결과만 현재 curve 순서로 복사
- [x] `검체 / 시약 / 추정 교차 Cycle / 결과 상태` 4열 rich HTML + TSV
- [x] 유효 추정값 숫자, 추정 불가 빈 셀, 다중 교차 검토 문구 보존
- [x] formula-like label 보호와 clipboard 실패 안내
- [x] 복사 아이콘 접근성·빈 필터 결과 비활성화·성공 상태 표시
- [x] Vitest 43 files / 339 tests, audit 1/1, dependency vulnerabilities 0
- [x] T Pages-base build와 fresh Chromium 13/13
- [x] Chromium `text/html` / `text/plain` 실제 clipboard readback
- [x] exact `dist` pre/post Playwright equality: `e8e7846cc589bc091239be322ac387c4cb6d66b575b6e709e0fc1ad2e1fbd839`
- [x] 19-page 사용자 가이드 PDF 재생성과 Threshold page render QA
- [x] 원본 non-T worktree 변경 없음
- [x] T판 commit/push/Pages/public smoke: source `18505c9`, run `29323723239`

## 자동 게이트
- [x] `git diff --check`
- [x] `npm run test`: 32 files / 265 tests
- [x] `npm run test:audit`: 1 audit probe
- [x] `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities
- [x] GitHub Pages base-path production build
- [x] fresh Chromium `11/11` with `--fail-on-flaky-tests`
- [x] exact `dist` pre/post Playwright equality
- [x] local dist tree SHA-256: `1012572727dd66d74763775f828fef165baa24012c61c770db6617e90d6cce46`
- [x] 1366x768 in-app Pages-path preview: no horizontal overflow, no console warning/error
- [x] independent release/security and browser/data-integrity GO
- [x] final product/domain, data/privacy, desktop UX/accessibility, QA/release four-role GO
- [x] repository 밖 representative workbook의 local-only import, 전체 선택, nonblank canvas, P1/P2 적용, browser error 0

## 자동 브라우저 범위
- Excel `.xlsx`, append, Quick Paste 경계 입력
- reagent-first collapsed selection, search bulk selection
- Auto/Fixed/P1/P2/Box zoom/Previous scale
- dense Style/Legend, hover/readout, custom legend
- clipboard image failure와 download fallback 안내
- legend PNG의 exact size, 불투명 흰 배경/외곽선, text/style pixel slot
- 알려진 정적 app `GET/HEAD`와 blob/data 이외의 request/WebSocket 차단
- Analysis XLSX save/restore/resave 및 curve/source/X/Y/stats exact equality
- null, 음수, 지수값, 큰 fluorescence 값 보존

## GitHub Pages workflow
- [x] `main` push와 `workflow_dispatch` trigger 유지
- [x] build job은 `contents: read`만 사용
- [x] deploy job만 `pages: write`, `id-token: write` 사용
- [x] Pages artifact upload 전 unit/audit/dependency/Chromium/dist equality 통과
- [x] screenshot, trace, browser console, network evidence failure artifact 보존
- [x] release candidate push workflow run 성공: `29156244025`
- [x] 공개 Pages URL에서 post-deploy smoke 성공: `29156323546`, product artifact source SHA `eae3281fb8f9bbbd900fab528be3e094b93b555a`

## 사용자 수동 확인
- [ ] 실제 업무 Excel에서 검체/시약 label, curve 수, warning이 의도와 일치하는지 확인
- [ ] 실제 분석 범위의 P1/P2와 style이 비교 목적에 맞는지 확인
- [ ] Windows Chrome/Edge에서 PNG clipboard와 rich Excel legend paste 확인
- [ ] 보고서/문서에 붙인 PNG/JPEG/legend의 가독성 확인
- [ ] 큰 실제 파일에서 체감 성능과 브라우저 메모리 확인

## 미결정 항목
- 공식 최대 file/curve/cycle 수치
- internal analysis tab warning/hard cap
- public Pages 또는 조직 접근제어 hosting
- Named View, optional Export Preflight, multi-step settings undo

## 롤백 trigger
- 지원 Excel/Quick Paste import 실패
- 선택 후 canvas가 비어 있음
- Fixed/P1/P2/Box zoom 또는 preview/export scale 불일치
- legend identity/style가 preview와 export에서 다름
- Analysis XLSX restore가 dataset/settings를 정확히 복원하지 못함
- 예상하지 않은 runtime network request 또는 심각한 browser error

## v1.3.0 분석 제외/복구 게이트

- [x] 개별 curve 제외/복구가 정확한 `curveId` 한 개에만 적용됨
- [x] 동명 그룹이 여러 source instance에 걸치면 원본별 범위를 확인하기 전 실행되지 않음
- [x] 제외 곡선이 Plot, Legend, Threshold, Selected Data XLSX/CSV에서 빠짐
- [x] Selection Set 원래 구성은 보존되고 적용 시 활성 곡선만 선택됨
- [x] 동일 이름 append 곡선이 기존 제외 상태를 상속하지 않음
- [x] Analysis XLSX schema 7이 전체 원본과 제외 상태를 정확히 복원함
- [x] v1.2.0 immutable archive manifest 검증 통과
- [x] v1.2.0 tag 이후 archive source까지 변경이 배포 증적 문서 3개뿐임을 CI에서 검증
- [x] Vitest 45 files / 399 tests, audit 1/1, production dependency vulnerabilities 0
- [x] Pages-base production build와 fresh Chromium 14/14
- [x] complete `dist` pre/post Playwright byte-identical: `925692d6a95657e840b62d413de2e9fbdc50251e32b8897e43ec534f2981cf96`
- [x] 1280x720 단일/복수 원본 제외 및 복구 dialog 시각 검수, browser warning/error 0

## 롤백 절차
1. 마지막 정상 SHA와 실패 candidate SHA를 기록한다.
2. `main`을 강제 재작성하지 않는다.
3. 실패 commit을 `git revert`하는 새 commit을 만들거나 마지막 정상 SHA의 tree를 복구 commit으로 만든다.
4. 같은 Pages workflow로 재배포한다.
5. 공개 URL에서 import, nonblank chart, scale/export, Analysis XLSX smoke를 다시 수행한다.
6. rollback SHA, workflow run, 공개 smoke 결과를 `DEVELOPMENT_STATE.md`에 기록한다.
