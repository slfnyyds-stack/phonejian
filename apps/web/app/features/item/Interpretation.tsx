import type { Interpretation } from "@aihot/contracts/site";

type InterpretationList = {
  label: string;
  items: string[];
};

export function Interpretation({ interpretation }: { interpretation: Interpretation }) {
  const lists: InterpretationList[] = [
    { label: "原文要点", items: interpretation.facts },
    { label: "对门店的影响", items: interpretation.impact },
    { label: "局限与存疑", items: interpretation.limits },
  ];

  return (
    <section className="mt-5 border-t border-line-soft pt-5">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="text-[15px] font-semibold text-ink">本站解读</h2>
        <p className="text-[12px] text-ink-3">我们读完原文后写的解读，不是原文</p>
      </div>

      <p className="text-[16px] leading-[1.9] text-ink-2 lg:text-[17px]">
        {interpretation.reading}
      </p>

      {lists.map((list) =>
        list.items.length > 0 ? (
          <div key={list.label} className="mt-4">
            <h3 className="mb-1.5 text-[12px] font-medium text-ink-3">{list.label}</h3>
            <ul className="list-disc space-y-1 pl-5 text-[14px] leading-7 text-ink-2">
              {list.items.map((item, index) => (
                <li key={`${list.label}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null
      )}

      <p className="mt-4 text-[12px] text-ink-4">{interpretation.attribution}</p>
    </section>
  );
}
