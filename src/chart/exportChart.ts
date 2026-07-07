import type { EChartsCoreOption } from "echarts/core";
import type { ImageExportType } from "./exportFilenames";

type EchartsCoreModule = typeof import("echarts/core");

let echartsPromise: Promise<EchartsCoreModule> | null = null;

export async function exportChartImageBlob(args: {
  option: EChartsCoreOption;
  type: ImageExportType;
  width?: number;
  height?: number;
}) {
  const echarts = await loadEchartsForExport();
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = `${args.width ?? 1200}px`;
  container.style.height = `${args.height ?? 760}px`;
  container.style.background = "#ffffff";
  document.body.appendChild(container);

  const chart = echarts.init(container, undefined, {
    renderer: "canvas",
    width: args.width ?? 1200,
    height: args.height ?? 760
  });

  try {
    chart.setOption(args.option, true);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const dataUrl = chart.getDataURL({
      type: args.type,
      pixelRatio: 2,
      backgroundColor: "#ffffff"
    });
    return dataUrlToBlob(dataUrl);
  } finally {
    chart.dispose();
    container.remove();
  }
}

export async function copyPngBlobToClipboard(blob: Blob) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard image copy is not supported in this browser.");
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": blob
    })
  ]);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function dataUrlToBlob(dataUrl: string) {
  const [metadata, base64] = dataUrl.split(",");
  const mimeMatch = metadata.match(/^data:(.*?);base64$/u);
  const mime = mimeMatch?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

async function loadEchartsForExport() {
  echartsPromise ??= Promise.all([
    import("echarts/core"),
    import("echarts/charts"),
    import("echarts/components"),
    import("echarts/renderers")
  ]).then(([echarts, charts, components, renderers]) => {
    echarts.use([
      charts.LineChart,
      components.GridComponent,
      components.LegendComponent,
      components.TooltipComponent,
      renderers.CanvasRenderer
    ]);
    return echarts;
  });

  return echartsPromise;
}

