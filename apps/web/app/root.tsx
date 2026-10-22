import { titled } from "./lib/seo";
import { SITE } from "@aihot/industry/site";
import {
  isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData, useLocation, useNavigation, useRouteError, useRouteLoaderData,
  type ShouldRevalidateFunction,
} from "react-router";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import type { Route } from "./+types/root";
import "./app.css";
import "./editorial.css";
import "./feed-layout-fix.css";
import "./obsidian.css";
import { Sidebar } from "./components/shell/Sidebar";
import { BackToTop, NavigationProgress } from "./components/shell/Chrome";
import { RingMark, Wordmark } from "./components/Logo";
import { buttonClass } from "./components/ui/Controls";
import { THEME_BOOT_SCRIPT } from "./lib/local-state";
import { apiGet } from "./lib/api.server";
import { useHydratedFlag } from "./lib/hydration";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico?v=b2-1", sizes: "any" },
  { rel: "icon", type: "image/png", href: "/icon.png?v=b2-1" },
  { rel: "apple-touch-icon", href: "/apple-icon.png?v=b2-1" },
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "alternate", type: "application/rss+xml", title: `${SITE.name} — 精选`, href: "/feed.xml" },
];

interface SiteMeta {
  changelogVersion: string | null;
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    return await apiGet<SiteMeta>("/api/site/meta", { signal: request.signal });
  } catch {
    return { changelogVersion: null } satisfies SiteMeta;
  }
}

export const shouldRevalidate: ShouldRevalidateFunction = () => false;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={SITE.locale} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#faf9f6" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#13191c" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration getKey={(location) => location.key} />
        <Scripts />
      </body>
    </html>
  );
}

/** Only a page nobody matched falls back to this; every page names itself. */
export function meta({ error }: Route.MetaArgs) {
  if (!error) return [];
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return [{ title: titled(notFound ? "页面不存在" : "暂时无法加载") }, { name: "robots", content: "noindex" }];
}

/** 180px reference left nav plus a wide main column around a page (or an error). */
function SiteShell({ changelogVersion, children }: { changelogVersion: string | null; children: ReactNode }) {
  const navigation = useNavigation();
  const { pathname } = useLocation();
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);
  // Which top-nav section owns the current URL; no section is assumed for other pages.
  const activeNav =
    pathname === "/" ? "精选"
    : pathname === "/all" || pathname.startsWith("/items/") ? "资讯"
    : pathname === "/reviews" ? "评测"
    : pathname === "/hot" || pathname.startsWith("/story/") ? "热点"
    : pathname === "/daily" || pathname.startsWith("/daily/") || pathname === "/weekly" || pathname.startsWith("/weekly/") || pathname === "/monthly" || pathname.startsWith("/monthly/") ? "日报"
    : pathname === "/topics" || pathname.startsWith("/topic/") ? "主题"
    : pathname === "/about" ? "关于"
    : null;
  useEffect(() => {
    // Keep the active tab visible inside the phone's horizontally scrolling nav,
    // without scrolling the page itself and without animation for reduced-motion users.
    if (!activeLinkRef.current) return;
    // "auto" honors the reduced-motion preference: never an animated scroll.
    activeLinkRef.current.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  }, [pathname]);
  return (
    <div className="phone-reference-site flex min-h-dvh">
      <NavigationProgress active={navigation.state === "loading"} />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-control focus:bg-surface focus:px-3 focus:py-2">
        跳到正文
      </a>
      <Sidebar changelogVersion={changelogVersion} />
      <div className="min-w-0 flex-1">
        <header className="editorial-header lg:hidden">
          <div className="editorial-header-inner">
            <Link to="/all" className="editorial-brand"><Wordmark size={24} /><span>手机行业资讯与一线观察</span></Link>
            <nav aria-label="网站导航">{([["/all","资讯"],["/reviews","评测"],["/","精选"],["/hot","热点"],["/daily","日报"],["/topics","主题"],["/about","关于"]] as const).map(([to,label]) => {
              const active = activeNav === label;
              return (
                <Link
                  key={to}
                  to={to}
                  ref={active ? activeLinkRef : undefined}
                  aria-current={active ? "page" : undefined}
                  className={active ? "border-b-2 border-accent font-semibold" : undefined}
                >
                  {label}
                </Link>
              );
            })}</nav>
          </div>
        </header>
        <main id="main" className="min-w-0 px-4 pb-12 pt-4 lg:px-7 lg:pt-6">
          <div className="mx-auto w-full min-w-0 max-w-[640px] lg:max-w-[var(--page-max-wide)]">{children}</div>
        </main>
        <footer className="min-w-0 border-t border-line px-4 py-5 lg:px-7 flex flex-wrap gap-4 text-xs text-ink-3"><span>{SITE.name} · 记录手机行业的变化</span><Link to="/feed/all.xml" reloadDocument>RSS 订阅</Link><Link to="/feedback">反馈</Link></footer>
      </div>
      <BackToTop />
    </div>
  );
}

export default function App() {
  const meta = useLoaderData<typeof loader>();
  useHydratedFlag();
  const { pathname } = useLocation();
  // The admin has its own chrome.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return <Outlet />;
  return (
    <SiteShell changelogVersion={meta.changelogVersion}>
      <Outlet />
    </SiteShell>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const site = useRouteLoaderData<typeof loader>("root");
  const { pathname } = useLocation();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const notFound = status === 404;
  const body = (
    <div className="flex min-h-[70vh] items-center justify-center px-2 py-16">
      <div className="max-w-sm text-center">
        <RingMark className="mx-auto mb-5 size-10 text-accent" />
        <div className="mono text-[12px] text-ink-4">{status}</div>
        <h1 className="mt-1.5 text-[20px] font-bold text-ink">{notFound ? "这里没有内容" : "暂时无法加载"}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">
          {notFound ? "你访问的页面不存在，或内容已不再公开。" : "服务暂时繁忙，请稍后再试。已经加载过的内容不受影响。"}
        </p>
        <div className="mt-6 flex justify-center gap-2.5">
          <Link to="/" className={buttonClass("primary")}>
            回到精选
          </Link>
          <Link to="/all" className={buttonClass("secondary")}>
            浏览全部动态
          </Link>
        </div>
      </div>
    </div>
  );
  // Admin errors stay inside the admin's own chrome.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return body;
  return <SiteShell changelogVersion={site?.changelogVersion ?? null}>{body}</SiteShell>;
}
