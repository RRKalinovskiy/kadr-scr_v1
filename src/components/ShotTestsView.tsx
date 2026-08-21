import { useEffect, useState } from "react";
import { Camera, GitCompare, ImageOff, Loader2, Play } from "lucide-react";
import type { AutoTest, Collection, Person } from "../types";
import { STATUS_META, fmtDate, fmtDur, fmtTime } from "../types";
import { getBaseline } from "../screenshots";
import { Avatar } from "./ui";

function ShotCard({ test, col, people, onRun, onOpen }: {
  test: AutoTest; col: Collection; people: Person[];
  onRun: (id: string) => void; onOpen: (id: string) => void;
}) {
  const [baseline, setBaseline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getBaseline(test.id).then((b) => { if (live) { setBaseline(b); setLoading(false); } });
    return () => { live = false; };
  }, [test.id, test.baselineAt]);

  const m = STATUS_META[test.status];
  const person = people.find((p) => p.id === test.assignee) ?? people[0];

  return (
    <div className="group fade-up flex flex-col overflow-hidden rounded-xl border border-line bg-raised/50 transition-all duration-200 hover:-translate-y-0.5 hover:border-line2 hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
      {/* превью эталона */}
      <div className="relative h-[120px] w-full overflow-hidden bg-[#0b1417]">
        {loading ? (
          <div className="grid h-full place-items-center"><Loader2 size={18} className="spin text-teal" /></div>
        ) : baseline ? (
          <img src={baseline} alt={`Эталон: ${test.name}`} className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-dim">
            <ImageOff size={20} />
            <span className="text-[10px] font-bold">эталон не сохранён</span>
          </div>
        )}
        <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-md bg-deep/80 text-teal backdrop-blur-sm">
          <Camera size={12} />
        </span>
        <span className="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold" style={{ color: m.color, background: m.bg }}>
          {m.label}
        </span>
      </div>

      {/* инфо */}
      <div className="flex flex-1 flex-col p-3">
        <div className="truncate text-[12.5px] font-extrabold text-fog" title={test.name}>{test.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[9.5px] font-semibold text-dim">
          <span className="rounded px-1 py-[1px]" style={{ color: col.color, background: `${col.color}1a` }}>{col.name}</span>
          {test.diffPct !== undefined && <span className="font-mono text-amber">Δ {test.diffPct.toFixed(1).replace(".", ",")}%</span>}
        </div>

        <div className="mt-auto flex items-center justify-between pt-2.5">
          <div className="flex items-center gap-1.5">
            <Avatar person={person} size={20} />
            <span className="text-[9.5px] font-bold text-mist">
              {test.lastRun ? `${fmtTime(test.lastRun)} · ${fmtDate(test.lastRun)}` : "не запускался"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onRun(test.id)} title="Прогнать со скрина"
              className="grid h-7 w-7 place-items-center rounded-md bg-teal/12 text-teal transition-all hover:bg-teal/25 active:scale-90">
              <Play size={12} fill="currentColor" />
            </button>
            <button onClick={() => onOpen(test.id)} title="Открыть карточку"
              className="grid h-7 w-7 place-items-center rounded-md bg-raised text-mist transition-all hover:bg-line hover:text-fog active:scale-90">
              <GitCompare size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShotTestsView({ collections, people, onRun, onOpen }: {
  collections: Collection[]; people: Person[];
  onRun: (colId: string, testId: string) => void; onOpen: (colId: string, testId: string) => void;
}) {
  const manual = collections
    .filter((c) => !c.deleted)
    .flatMap((c) => c.tests.filter((t) => t.testType === "manual").map((t) => ({ col: c, test: t })));

  if (manual.length === 0) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-teal/20 to-amber/10 shadow-[inset_0_0_0_1px_rgba(79,224,196,0.25)]">
            <Camera size={24} className="text-teal" />
          </div>
          <div className="text-[15px] font-extrabold text-fog">Скриншот-тестов пока нет</div>
          <p className="mx-auto mt-1.5 max-w-[300px] text-[12px] font-semibold leading-relaxed text-mist">
            Создайте тест типа «Ручной · по эталону», сохраните эталон — и он появится здесь с мини-превью.
          </p>
        </div>
      </div>
    );
  }

  const passed = manual.filter(({ test }) => test.status === "passed").length;

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[1100px] px-6 py-5">
        <div className="mb-4 flex items-baseline gap-2.5">
          <h2 className="font-display text-[18px] font-bold text-fog">Скриншот-тесты</h2>
          <span className="rounded-md bg-raised px-2 py-0.5 font-mono text-[11px] font-bold text-mist">{manual.length}</span>
          <span className="ml-auto font-mono text-[11px] font-semibold text-dim">
            <span className="text-[#46d68c]">{passed}</span> пройдено · <span className="text-coral">{manual.length - passed}</span> требуют внимания
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4">
          {manual.map(({ col, test }) => (
            <ShotCard key={test.id} test={test} col={col} people={people}
              onRun={(id) => onRun(col.id, id)} onOpen={(id) => onOpen(col.id, id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
