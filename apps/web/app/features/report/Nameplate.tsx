// The report nameplates (industry/brand/nameplates/, made by scripts/nameplates.ts from the pack's
// subject word). Each logotype is cached on its own; the two paths take the theme's ink and accent.
import { SITE } from "@aihot/industry/site";
import daily from "@aihot/industry/brand/nameplates/daily.svg?url&no-inline";
import weekly from "@aihot/industry/brand/nameplates/weekly.svg?url&no-inline";
import monthly from "@aihot/industry/brand/nameplates/monthly.svg?url&no-inline";
import archive from "@aihot/industry/brand/nameplates/archive.svg?url&no-inline";
import viewBoxes from "@aihot/industry/brand/nameplates/index.json";

const NAMEPLATES = {
  daily: { url: daily, viewBox: viewBoxes.daily },
  weekly: { url: weekly, viewBox: viewBoxes.weekly },
  monthly: { url: monthly, viewBox: viewBoxes.monthly },
  archive: { url: archive, viewBox: viewBoxes.archive },
} as const;

const LABELS: Record<Exclude<keyof typeof NAMEPLATES, "archive">, string> = { daily: "日报", weekly: "周报", monthly: "月报" };

export function Nameplate({ which, className = "" }: { which: keyof typeof NAMEPLATES; className?: string }) {
  // The static plates were cut for the pack's old subject word. While the site's subject has moved on,
  // set the nameplate as live text instead; the archive keeps its own plate.
  if (String(SITE.subject) !== "AI" && which !== "archive") {
    const label = LABELS[which];
    const width = ([...SITE.subject, ...label].length) * 220 + 24;
    return (
      <svg viewBox={`0 -122 ${width} 244`} className={className} aria-hidden="true" focusable="false">
        <text x="12" y="76" fontSize="220" fontWeight="900" style={{ fontFamily: "inherit" }}>
          <tspan className="fill-accent">{SITE.subject}</tspan>
          <tspan className="fill-ink">{label}</tspan>
        </text>
      </svg>
    );
  }
  const n = NAMEPLATES[which];
  return (
    <svg viewBox={n.viewBox} className={className} aria-hidden="true" focusable="false">
      <use href={`${n.url}#accent`} className="fill-accent" />
      <use href={`${n.url}#ink`} className="fill-ink" />
    </svg>
  );
}
