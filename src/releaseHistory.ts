import packageMetadata from "../package.json" with { type: "json" };

export const APP_VERSION = packageMetadata.version;

export type AppRelease = {
  version: string;
  releasedOn: string;
  analysisSchemaVersion: number;
  current: boolean;
  archivePath?: string;
  manifestSha256?: string;
  changes: readonly string[];
};

export const RELEASE_HISTORY: readonly AppRelease[] = [
  {
    version: APP_VERSION,
    releasedOn: "2026-09-02",
    analysisSchemaVersion: 6,
    current: true,
    changes: [
      "공통 또는 정확한 시약별 raw fluorescence Threshold를 선택해 분석할 수 있습니다.",
      "시약별 Threshold는 일괄 검증·적용되며 미설정 시약을 ND로 오인하지 않습니다.",
      "Preview와 Plot Export에 동일한 다중 Threshold 선과 충돌 방지 라벨을 적용했습니다.",
      "모든 색상 팝업에 기존 8색 순서의 정사각형 빠른 선택 팔레트를 추가했습니다."
    ]
  },
  {
    version: "1.1.0",
    releasedOn: "2026-08-03",
    analysisSchemaVersion: 5,
    current: false,
    archivePath: "versions/v1.1.0/",
    manifestSha256: "6e18757d1334616a69c7685864f09ce4d8dcc7adf8aef3d5efa55149e81e510a",
    changes: [
      "T판을 단일 유지보수 제품으로 통합하고 이전 안정 버전 실행 경로를 추가했습니다.",
      "공란 또는 문자 '-' 시약 열 제외, FAM/HEX Y축 프리셋, Positive/ND 분석 표기를 추가했습니다."
    ]
  },
  {
    version: "1.0.0",
    releasedOn: "2026-07-23",
    analysisSchemaVersion: 5,
    current: false,
    archivePath: "versions/v1.0.0/",
    manifestSha256: "7ccadd5e2ebadaba07436217b355579263e32aa92fb99d7e13a891fc8b8318c9",
    changes: [
      "Threshold 교차 검토, 결과표 복사, Analysis XLSX 연속 분석을 포함한 최초 고정 T판입니다.",
      "검체명 이어쓰기와 Plot/Legend 보고서 출력 개선이 포함되어 있습니다."
    ]
  }
];

export function getReleaseUrl(release: AppRelease, baseUrl = import.meta.env.BASE_URL) {
  return release.current ? baseUrl : `${baseUrl}${release.archivePath ?? ""}`;
}
