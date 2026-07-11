# 01 프로젝트 차터

## 상태
Implemented baseline - release validation and real-data hardening

## 최종 갱신
2026-07-11

## 목적
IsoAmplar 장비 및 LAMP 개발 과정에서 얻은 증폭형광 데이터를 데스크톱 브라우저에서 선택, 비교, 시각화하고 보고용 결과로 정리한다. 주 사용자는 프로그래머가 아닌 분자진단 키트 개발자다.

이 도구는 원본 수치를 자동 해석하거나 임상 판독하는 프로그램이 아니다. 여러 검체, 시약, 개발 조건의 곡선을 필요한 수준으로 선별하고 동일한 축과 스타일로 비교하는 분석 보조 도구다.

## 핵심 사용자 흐름
1. `.xls` 또는 `.xlsx` 원본을 열거나 소량 비교 데이터를 Quick Paste로 미리보기 한다.
2. warning과 source 위치를 확인한다.
3. 시약별 또는 검체별 보기에서 필요한 curve만 선택한다.
4. X/Y scale, Box zoom, 색상, 선, 마커, 순서, Analysis label을 조정한다.
5. plot, legend, CSV를 목적에 맞게 내보낸다.
6. 분석을 이어갈 경우 전체 imported dataset과 설정을 Analysis XLSX로 저장한다.

## 현재 범위
- Excel `.xls` / `.xlsx`, 첫 worksheet만 사용
- 현재 분석에 추가 Excel import
- Tab 구분 또는 단일 열 Quick Paste Import와 읽기 전용 preview
- 시약별 기본 선택 보기와 검체별 대체 보기
- `curveId` 기반 선택, 순서, style, label 연결
- Auto/Fixed/P1/P2/Box zoom scale
- 그룹 및 개별 color/line/marker 설정
- custom legend, Analysis label, plot/legend 분리 출력
- PNG/JPEG, PNG clipboard, rich Excel legend clipboard, 조건부 plotted CSV
- 내부 analysis tabs와 전체 dataset 기반 Analysis XLSX save/restore
- 정적 GitHub Pages 배포와 브라우저 내부 데이터 처리

## 과학·데이터 무결성 원칙
- fluorescence 숫자를 smoothing, normalization, baseline correction, log 변환, 평균 또는 보간하지 않는다.
- 빈 값과 비숫자 값은 warning과 `null` gap으로 처리한다.
- formula를 재계산하지 않으며 finite cached numeric value만 warning과 함께 사용한다.
- 원본 specimen/reagent/source label과 사용자가 작성한 Analysis label을 분리한다.
- preview와 plot image export는 같은 선택, 순서, 적용 scale, style projection을 사용한다.
- Analysis XLSX는 선택하지 않은 curve도 포함한 전체 imported dataset을 저장한다.

## 비목표
- CSV file import 또는 comma/quoted CSV 자동 추측
- 앱 안의 원본 cell 편집, 검체/시약/fluorescence 수정
- worksheet picker 또는 custom X/cycle 입력
- threshold, Ct/Cq, 양성/음성, 임상 판독 계산
- native editable Excel chart
- 서버 저장, 계정, 공동 편집, 실시간 협업
- 모바일 분석 UI, multi-plot dashboard

## 배포·보안 경계
- 서버와 데이터베이스 없이 GitHub Pages에서 동작한다.
- 앱 runtime은 알려진 정적 asset `GET/HEAD` 외의 same-origin write, cross-origin request, WebSocket을 필요로 하지 않는다.
- 민감 데이터는 사용자가 명시적으로 파일/clipboard로 내보낼 때만 브라우저 밖으로 이동한다.
- 조직 접근제어가 필요하면 별도의 hosting 정책 결정이 필요하다.

## 완료 기준
- 지원 입력이 source와 warning provenance를 유지한다.
- 데이터 선택과 설정이 curve identity를 잃지 않는다.
- preview/export/Analysis XLSX가 수치와 설정을 조용히 바꾸지 않는다.
- 자동 테스트, fresh Chromium, exact-dist, dependency audit, Pages smoke가 릴리스 전에 통과한다.
- 현재 진실과 미결정 항목이 `DEVELOPMENT_STATE.md`, `DECISIONS.md`, 요구사항·테스트 문서에 남는다.

## 남은 사용자 결정
- 공식 최대 파일/curve/cycle/browser-memory 지원 한계
- 내부 analysis tab 경고 또는 hard cap
- 공개 Pages 유지 또는 조직 접근제어 hosting 이전
- 후속 Named View, Export Preflight, multi-step settings undo 도입 여부
