import { data as withHeaders, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/topics";
import { apiGet, releaseBoundCache } from "../lib/api.server";
import { pageMeta } from "../lib/seo";

interface TopicSummary {
  slug: string;
  name: string;
  group: "company" | "field" | "genre";
  definition: string;
  total: number;
  recent: number;
  indexable: boolean;
  latestAt: string | null;
}

export async function loader({ request }: { request: Request }) {
  const upstream = new Headers();
  const data = await apiGet<{ topics: TopicSummary[]; refreshAt: string | null }>("/api/site/topics", { signal: request.signal, responseHeaders: upstream });
  return withHeaders(data, { headers: releaseBoundCache(data.refreshAt, 300, Date.now(), upstream) });
}

export function meta() {
  return pageMeta({
    title: "品牌与主题",
    description: "按品牌与厂商、产品与体验、零售与服务浏览手机行业主题：官方产品线、系统更新、影像续航、价格渠道与售后服务的公开追踪。",
    path: "/topics",
    image: "/og/pages/topics.png",
  });
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return loaderHeaders;
}

// key 保留 API 返回的 group 枚举，名称为手机行业语义。
const GROUPS = [
  { key: "company", name: "品牌与厂商", blurb: "按品牌与厂商浏览：官方产品线、系统更新与售后政策的公开信息" },
  { key: "field", name: "产品与体验", blurb: "按产品方向浏览：折叠屏、影像、续航与 AI 功能的公开体验与使用条件" },
  { key: "genre", name: "零售与服务", blurb: "按内容类型浏览：新品动态、机型对比、价格渠道、售后回收与一线观察" },
] as const;

export default function TopicsPage() {
  const { topics } = useLoaderData<typeof loader>();
  return (
    <div className="pb-10">
      <header className="pb-2 pt-5 lg:pt-1">
        <h1 className="text-[24px] font-semibold leading-[1.3] text-ink">品牌与主题</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
          共 <span className="num">{topics.length}</span> 个主题，按品牌与厂商、产品与体验、零售与服务浏览各主题的定义与精选内容。精选数量来自站内实际收录，页面不展示虚构的热度数字。
        </p>
      </header>
      {GROUPS.map((g) => {
        const groupTopics = topics.filter((t) => t.group === g.key);
        return (
          <section key={g.key} aria-labelledby={`topics-${g.key}`} className="pt-8">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h2 id={`topics-${g.key}`} className="text-[15px] font-bold text-ink">
                {g.name}
              </h2>
              <p className="text-[12px] text-ink-4">{g.blurb}</p>
            </div>
            {groupTopics.length === 0 ? (
              <p className="mt-3.5 rounded-lg border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-ink-4">没有配置主题</p>
            ) : (
              <ul className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupTopics.map((t) => (
                  <li key={t.slug}>
                    <Link
                      to={`/topics/${t.slug}`}
                      prefetch="intent"
                      aria-label={`查看${t.name}的主题定义与精选文章`}
                      className="card card-hover group flex h-full flex-col px-5 py-[18px]"
                    >
                      <span className="text-[15px] font-bold text-ink transition-colors group-hover:text-accent">{t.name}</span>
                      <span className="mt-1.5 line-clamp-2 flex-1 text-[12.5px] leading-[1.7] text-ink-3">{t.definition}</span>
                      <span className="mono mt-3 text-[11.5px] text-accent">
                        {t.total > 0 ? (
                          <>
                            {t.total} 条精选{t.recent > 0 ? `，近期 ${t.recent} 条` : ""}
                            <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                          </>
                        ) : (
                          "暂无精选，查看主题定义 →"
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
