import { useEffect, useMemo, useRef, useState } from "react";
import type { LegendItem } from "../chart/chartProjection";
import { layoutLegendItems } from "../chart/legendLayout";
import type { LineType, MarkerType } from "../data/types";

export function CustomLegend({
  items,
  highlightedCurveId,
  onHoverCurve
}: {
  items: LegendItem[];
  highlightedCurveId?: string | null;
  onHoverCurve?: (curveId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const [availableTextWidth, setAvailableTextWidth] = useState(150);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = normalizedQuery
    ? items.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
    : items;
  const layout = useMemo(
    () => layoutLegendItems({ items: visibleItems, maxTextWidth: availableTextWidth, font: "12px Arial, sans-serif" }),
    [availableTextWidth, visibleItems]
  );
  const layoutByCurveId = new Map(layout.items.map((entry) => [entry.item.curveId, entry]));

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const updateWidth = () => {
      const listWidth = list.clientWidth;
      if (listWidth <= 0) return;
      const columnGap = 12;
      const minimumColumnWidth = 230;
      const columns = Math.max(1, Math.floor((listWidth + columnGap) / (minimumColumnWidth + columnGap)));
      const columnWidth = (listWidth - columnGap * (columns - 1)) / columns;
      setAvailableTextWidth(Math.max(24, columnWidth - 79));
    };
    updateWidth();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="custom-legend" aria-label="Custom legend">
      <div className="custom-legend-header">
        <strong>Legend</strong>
        <span>{items.length} curves</span>
      </div>
      {items.length > 12 && (
        <input
          className="legend-search"
          type="search"
          aria-label="Legend search"
          placeholder="Search legend"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      )}
      <ul ref={listRef} className="custom-legend-list">
        {visibleItems.map((item) => (
          <li
            className={`custom-legend-item${highlightedCurveId === item.curveId ? " custom-legend-item-active" : ""}`}
            key={item.curveId}
            tabIndex={0}
            onMouseEnter={() => onHoverCurve?.(item.curveId)}
            onMouseLeave={() => onHoverCurve?.(null)}
            onFocus={() => onHoverCurve?.(item.curveId)}
            onBlur={() => onHoverCurve?.(null)}
          >
            <LegendSample item={item} />
            <span className="custom-legend-label" title={item.label}>
              {(layoutByCurveId.get(item.curveId)?.lines ?? [item.label]).map((line, index) => (
                <span key={`${item.curveId}-line-${index}`}>{line}</span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {layout.collisions.length > 0 && (
        <div className="legend-identity-warning" role="alert">
          Legend labels are not distinguishable: {layout.collisions.flatMap((collision) => collision.sourceIdentities).join(", ")}.
          Use distinct Analysis labels before legend export.
        </div>
      )}
      {visibleItems.length === 0 && <p>표시할 범례가 없습니다.</p>}
    </section>
  );
}

export function LegendSample({ item }: { item: LegendItem }) {
  return (
    <svg
      className="legend-sample"
      viewBox="0 0 64 20"
      aria-hidden="true"
      data-line-type={item.lineType}
      data-marker-type={item.markerType}
    >
      <line
        x1="4"
        y1="10"
        x2="60"
        y2="10"
        stroke={item.color}
        strokeWidth={Math.max(2, item.lineWidth)}
        strokeLinecap={item.lineType === "dotted" ? "round" : "butt"}
        strokeDasharray={getStrokeDashArray(item.lineType)}
      />
      <LegendMarker markerType={item.markerType} color={item.color} />
    </svg>
  );
}

function LegendMarker({ markerType, color }: { markerType: MarkerType; color: string }) {
  if (markerType === "none") return null;
  if (markerType === "circle") {
    return <circle cx="32" cy="10" r="4.2" fill={color} data-marker-symbol="circle" />;
  }
  if (markerType === "triangle") {
    return <polygon points="32,5 37,15 27,15" fill={color} data-marker-symbol="triangle" />;
  }
  return <rect x="28" y="6" width="8" height="8" fill={color} data-marker-symbol="rect" />;
}

function getStrokeDashArray(lineType: LineType) {
  if (lineType === "dashed") return "8 5";
  if (lineType === "dotted") return "1 5";
  return undefined;
}
