import type { StoryReportView, StoryFactView } from "@aihot/contracts/site";

export interface ReportComparisonGroup {
  key: string;
  title: string;
  reportCount: number;
  sourceCount: number;
  latestAt: string | null;
  reports: StoryReportView[];
}

interface DraftGroup {
  key: string;
  reports: StoryReportView[];
  latest: { at: string; id: string; title: string } | null;
}

/** 按归组 factId 对照各家报道。只统计传入列表，不代表全故事总数。 */
export function groupStoryReports(
  reports: readonly StoryReportView[],
  developments: readonly StoryFactView[],
): ReportComparisonGroup[] {
  const factTitles = new Map(developments.map((d) => [d.factId, d.title]));
  const seen = new Set<string>();
  const drafts = new Map<string, DraftGroup>();
  const order: string[] = [];

  for (const report of reports) {
    if (seen.has(report.id)) continue;
    seen.add(report.id);
    const key = report.factId !== "" ? `fact:${report.factId}` : `report:${report.id}`;
    let group = drafts.get(key);
    if (!group) {
      group = { key, reports: [], latest: null };
      drafts.set(key, group);
      order.push(key);
    }
    group.reports.push(report);
    const time = Date.parse(report.publishedAt);
    if (Number.isNaN(time)) continue;
    if (!group.latest || time > Date.parse(group.latest.at) || (time === Date.parse(group.latest.at) && report.id < group.latest.id)) {
      group.latest = { at: report.publishedAt, id: report.id, title: report.title };
    }
  }

  const groups = order.map((key) => {
    const group = drafts.get(key)!;
    const reportsSorted = [...group.reports].sort((a, b) => {
      const ta = Date.parse(a.publishedAt);
      const tb = Date.parse(b.publishedAt);
      if (Number.isNaN(ta) && Number.isNaN(tb)) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      if (ta !== tb) return tb - ta;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    const factId = key.startsWith("fact:") ? key.slice(5) : null;
    const mappedTitle = factId != null ? factTitles.get(factId) : undefined;
    return {
      key,
      title: mappedTitle ?? group.latest?.title ?? reportsSorted[0]?.title ?? "",
      reportCount: reportsSorted.length,
      sourceCount: new Set(reportsSorted.map((r) => r.source.id)).size,
      latestAt: group.latest?.at ?? null,
      reports: reportsSorted,
    };
  });

  return groups.sort((a, b) => {
    const ta = a.latestAt == null ? NaN : Date.parse(a.latestAt);
    const tb = b.latestAt == null ? NaN : Date.parse(b.latestAt);
    if (Number.isNaN(ta) && Number.isNaN(tb)) return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    if (ta !== tb) return tb - ta;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}
