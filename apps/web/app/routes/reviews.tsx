import { SITE, withSubject } from "@aihot/industry/site";
import { useLoaderData, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/reviews";
import type { PoolResponse } from "@aihot/contracts/site";
import { loadOr404, queryString } from "../lib/api.server";
import { pageMeta } from "../lib/seo";
import { SearchField } from "../features/feed/Filters";
import { DayList, Pagination } from "../features/feed/DayList";
import { EmptyState } from "../components/ui/Page";

// 评测聚合页（方案A）：复用 /all 的 pool 接口，固定 category=comparison，
// 只聚合站内已有的机型对比 / 实测内容，不接外部测评源。
const CATEGORY = "comparison";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const tag = url.searchParams.get("tag")?.trim() || null;
  const q = url.searchParams.get("q")?.trim().slice(0, 200) || null;
  const page = Math.min(Math.max(Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1, 1), 50);
  const data = await loadOr404<PoolResponse>(
    `/api/site/pool${queryString({ category: CATEGORY, tag, q, page: page > 1 ? page : null })}`,
    { signal: request.signal, busyRedirect: "/all/search-busy" },
  );
  return { data };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const q = loaderData?.data.filters?.q;
  const page = loaderData?.data.page ?? 1;
  return pageMeta({
    title: q ? `评测搜索：${q}` : `手机评测`,
    description: `${SITE.name} 的${withSubject("评测")}栏目：实测、对比与可核对的评测内容，随实测与对比类文章入库自动更新。`,
    path: page > 1 ? `/reviews?page=${page}` : "/reviews",
    noindex: !!q,
  });
}

export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=30" };
}

function pageHref(params: URLSearchParams, page: number) {
  const sp = new URLSearchParams(params);
  sp.delete("search");
  if (page <= 1) sp.delete("page");
  else sp.set("page", String(page));
  const s = sp.toString();
  return s ? `/reviews?${s}` : "/reviews";
}

export default function ReviewsPage() {
  const { data } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const navigation = useNavigation();
  const f = data.filters;
  const q = f?.q ?? null;
  const busy = navigation.state === "loading" && navigation.location?.pathname === "/reviews";

  return (
    <div className="pb-6">
      <div className="hidden lg:block">
        <h1 className="text-[24px] font-semibold leading-[1.3] text-ink">{q ? `搜索“${q}”` : "全部评测"}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-3">实测、对比与可核对的评测内容，来自站内的机型对比与实测文章。</p>
        <div className="feed-filter-row mb-5 mt-4 flex items-center justify-end gap-4">
          <SearchField variant="track" defaultValue={q ?? ""} keep={{ category: CATEGORY }} />
        </div>
      </div>

      <div className="lg:hidden">
        <h1 className="pb-3 pt-5 text-[22px] font-bold text-ink">{q ? `搜索“${q}”` : "全部评测"}</h1>
        <SearchField variant="bar" defaultValue={q ?? ""} keep={{ category: CATEGORY }} autoFocus={params.get("search") === "1"} />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-3">实测、对比与可核对的评测内容。</p>
      </div>

      <div className={`transition-opacity duration-200 ${busy ? "opacity-50" : ""}`}>
        {data.items.length === 0 ? (
          <div className="mt-2 lg:card">
            <EmptyState title="暂无评测内容。评测会随实测与对比类文章入库自动出现。">先去看看<a href="/all" className="text-accent hover:underline">全部动态</a>，或稍后再回来。</EmptyState>
          </div>
        ) : (
          <DayList items={data.items} todayCount={q ? null : data.todayCount} showTags />
        )}
      </div>
      <Pagination page={data.page} pageCount={data.pageCount} href={(p) => pageHref(params, p)} />
      {data.page >= 50 && <p className="mt-4 text-center text-[12px] text-ink-4">最多提供 50 页，更早的内容请使用搜索或主题页。</p>}
    </div>
  );
}
