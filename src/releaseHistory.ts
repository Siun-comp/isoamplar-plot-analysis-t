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
    releasedOn: "2026-09-04",
    analysisSchemaVersion: 7,
    current: true,
    changes: [
      "잘못 입력한 곡선·검체·시약 그룹을 원본 삭제 없이 현재 분석에서 제외하고 복구할 수 있습니다.",
      "동일 이름이 여러 입력 원본에 존재하면 파일·worksheet·열 단위 범위를 확인한 뒤 제외합니다.",
      "Analysis XLSX는 전체 imported dataset과 정확한 curveId 제외 상태를 함께 보존합니다.",
      "선택 세트, Threshold, Plot, Legend 및 선택 데이터 출력이 동일한 제외 상태를 사용합니다."
    ]
  },
  {
    version: "1.2.0",
    releasedOn: "2026-09-02",
    analysisSchemaVersion: 6,
    current: false,
    archivePath: "versions/v1.2.0/",
    manifestSha256: "0f5acc898273bcea5c8366ffc077d3cb4f856972daae8af71e31969c4fe01947",
    changes: [
      "공통 또는 정확한 시약별 raw fluorescence Threshold 분석을 추가했습니다.",
      "기존 8색 순서의 정사각형 빠른 선택 팔레트를 추가했습니다."
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
