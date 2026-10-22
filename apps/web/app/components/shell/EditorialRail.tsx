import { useEffect, useState } from "react";
import { Link } from "react-router";
type Entry = { id?: string; title: string; links?: { aihot?: string; story?: string }; rank?: number };
export function EditorialRail() {
  const [selected, setSelected] = useState<Entry[] | null>(null);
  const [hot, setHot] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/v1/items?mode=selected&window=7d&limit=5', { signal: controller.signal }),
      fetch('/api/v1/hot-topics', { signal: controller.signal }),
    ]).then(async ([a, b]) => {
      if (!a.ok || !b.ok) throw new Error('load failed');
      const [s, h] = await Promise.all([a.json(), b.json()]);
      setSelected(s.items ?? []); setHot((h.items ?? []).slice(0, 5));
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  return <aside className="editorial-rail" aria-label="精选与热点">
    <section><h2>值得关注</h2><p className="rail-description">从资讯中筛选与手机零售有关的重要变化。</p>
      {failed ? <p className="rail-empty">暂时无法加载，请刷新重试。</p> : selected === null ? <p className="rail-empty">正在加载精选…</p> : selected.length ? <ol>{selected.map((x,i) => <li key={x.id ?? i}><a href={x.links?.aihot ?? '/'}>{x.title}</a></li>)}</ol> : <p className="rail-empty">暂时没有达到精选标准的文章。可以先浏览全部资讯。</p>}
      <Link to="/">查看精选 →</Link></section>
    <section><h2>热点追踪</h2>{failed ? <p className="rail-empty">暂时无法加载。</p> : hot === null ? <p className="rail-empty">正在加载热点…</p> : hot.length ? <ol>{hot.map((x,i) => <li key={x.id ?? i}><a href={x.links?.story ?? '/hot'}>{x.title}</a></li>)}</ol> : <p className="rail-empty">还没有形成热点事件。这里会汇集相关报道与后续进展。</p>}<Link to="/hot">查看热点 →</Link></section>
    <section><h2>阅读入口</h2><div className="rail-links"><Link to="/topics">品牌与主题</Link><Link to="/daily">行业日报</Link><Link to="/about">关于手机之间</Link></div></section>
  </aside>;
}
