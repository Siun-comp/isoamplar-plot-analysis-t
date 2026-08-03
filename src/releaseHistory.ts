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
    releasedOn: "2026-08-03",
    analysisSchemaVersion: 5,
    current: true,
    changes: [
      "T판을 단일 유지보수 제품으로 통합하고 이전 안정 버전 실행 경로를 추가했습니다.",
      "공란 또는 문자 '-' 시약 열을 분석에서 제외하되 검체명 이어쓰기는 보존합니다.",
      "원본 Excel 확장자를 분석 이름에서 제거하고 Analysis XLSX 저장 파일명 규칙을 단순화했습니다.",
      "Y축 FAM/HEX 프리셋과 Threshold 결과의 Positive/ND 분석 표기를 추가했습니다."
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
