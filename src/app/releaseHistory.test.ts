import { describe, expect, it } from "vitest";
import { APP_VERSION, getReleaseUrl, RELEASE_HISTORY } from "../releaseHistory";

describe("release history", () => {
  it("keeps package version and the current release record aligned", () => {
    const current = RELEASE_HISTORY.filter((release) => release.current);
    expect(current).toHaveLength(1);
    expect(current[0].version).toBe(APP_VERSION);
    expect(RELEASE_HISTORY.map((release) => release.version)).toEqual([APP_VERSION, "1.0.0"]);
    expect(RELEASE_HISTORY[1].manifestSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("builds base-path-safe URLs for current and archived releases", () => {
    expect(getReleaseUrl(RELEASE_HISTORY[0], "/isoamplar-plot-analysis-t/")).toBe(
      "/isoamplar-plot-analysis-t/"
    );
    expect(getReleaseUrl(RELEASE_HISTORY[1], "/isoamplar-plot-analysis-t/")).toBe(
      "/isoamplar-plot-analysis-t/versions/v1.0.0/"
    );
  });
});
