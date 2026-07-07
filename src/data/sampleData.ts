import { createEntityId, createPcrDatasetFromCurves, createStats } from "./normalizePcrData";
import type { Curve, PcrDataset } from "./types";

const DEFAULT_REAGENTS = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"];

type SyntheticCurveInput = {
  specimenLabel: string;
  reagentLabel: string;
  specimenIndex: number;
  reagentIndex: number;
  curveIndex: number;
  cycleCount: number;
  fileName: string;
  sheetName: string;
};

export type SyntheticDatasetOptions = {
  specimenLabels?: string[];
  reagentLabels?: string[];
  cycleCount?: number;
  fileName?: string;
  sheetName?: string;
  importedAtIso?: string;
};

export function createOneSpecimenEightReagentDataset() {
  return createSyntheticPcrDataset({
    specimenLabels: ["검체 1"],
    reagentLabels: DEFAULT_REAGENTS,
    fileName: "sample_1x8.xlsx"
  });
}

export function createMultiSpecimenCommonReagentDataset() {
  return createSyntheticPcrDataset({
    specimenLabels: ["검체 1", "검체 2", "검체 3"],
    reagentLabels: ["A1", "A2", "A3"]
  });
}

export function createSimilarNameDataset() {
  return createSyntheticPcrDataset({
    specimenLabels: ["검체 1", "검체1", "검체-2"],
    reagentLabels: ["A1", "A_1", "A2"]
  });
}

export function createTwentyOnePlusCurveDataset() {
  return createSyntheticPcrDataset({
    specimenLabels: ["검체 1", "검체 2", "검체 3"],
    reagentLabels: DEFAULT_REAGENTS
  });
}

export function createSyntheticPcrDataset(options: SyntheticDatasetOptions = {}): PcrDataset {
  const specimenLabels = options.specimenLabels ?? ["검체 1", "검체 2"];
  const reagentLabels = options.reagentLabels ?? ["A1", "A2"];
  const cycleCount = options.cycleCount ?? 45;
  const fileName = options.fileName ?? "synthetic_pcr.xlsx";
  const sheetName = options.sheetName ?? "Sheet1";
  const importedAtIso = options.importedAtIso ?? "2026-07-07T00:00:00.000Z";

  const curves: Curve[] = [];
  let curveIndex = 0;

  specimenLabels.forEach((specimenLabel, specimenIndex) => {
    reagentLabels.forEach((reagentLabel, reagentIndex) => {
      curveIndex += 1;
      curves.push(
        createSyntheticCurve({
          specimenLabel,
          reagentLabel,
          specimenIndex,
          reagentIndex,
          curveIndex,
          cycleCount,
          fileName,
          sheetName
        })
      );
    });
  });

  return createPcrDatasetFromCurves({
    curves,
    fileName,
    sheetName,
    cycleCount,
    importedAtIso
  });
}

function createSyntheticCurve(input: SyntheticCurveInput): Curve {
  const columnIndex = input.curveIndex - 1;
  const columnLetter = columnIndexToLetter(columnIndex);
  const x = Array.from({ length: input.cycleCount }, (_, index) => index + 1);
  const y = x.map((cycle) =>
    syntheticAmplificationValue(
      cycle,
      18 + input.specimenIndex * 4 + input.reagentIndex * 0.55,
      38 + input.reagentIndex * 1.7,
      0.18 + input.specimenIndex * 0.025
    )
  );

  const curveId = `sheet0_col_${columnLetter}`;
  const specimenId = createEntityId("specimen", input.specimenLabel);
  const reagentId = createEntityId("reagent", input.reagentLabel);

  return {
    curveId,
    sourceId: `${input.fileName}#${input.sheetName}!${columnLetter}`,
    specimenId,
    reagentId,
    specimenLabel: input.specimenLabel,
    reagentLabel: input.reagentLabel,
    displayLabel: `${input.specimenLabel} / ${input.reagentLabel}`,
    x,
    y,
    source: {
      fileName: input.fileName,
      sheetName: input.sheetName,
      sheetIndex: 0,
      columnIndex,
      columnLetter,
      specimenCell: `${columnLetter}1`,
      reagentCell: `${columnLetter}2`,
      dataStartCell: `${columnLetter}3`,
      dataEndCell: `${columnLetter}${input.cycleCount + 2}`
    },
    stats: createStats(y),
    warnings: []
  };
}

function syntheticAmplificationValue(cycle: number, midpoint: number, max: number, baseline: number) {
  const logistic = max / (1 + Math.exp(-0.38 * (cycle - midpoint)));
  const earlyDrift = cycle < 10 ? Math.sin(cycle * 1.7) * 0.025 : 0;
  return Number((baseline + logistic + earlyDrift).toFixed(4));
}

export { createEntityId, createPcrDatasetFromCurves, createStats };

function columnIndexToLetter(index: number) {
  let dividend = index + 1;
  let columnName = "";

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnName;
}
