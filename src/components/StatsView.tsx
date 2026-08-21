import { useMemo } from "react";
import { Activity, CheckCircle2, Clock3, Layers, Timer, XCircle, Diff } from "lucide-react";
import type { Collection } from "../types";
import { fmtDur } from "../types";

interface Agg { total: number; passed: number; failed: number; diff: number; idle: number; dur: number; durCount: number }

function aggregate(collections: Collection[]): Agg {
  const a: Agg = { total: 0, passed: 0, failed: 0, diff: 0, idle: 0, dur: 0, durCount: 0 };
  for (const c of collections) {
    if (c.deleted) continue;
    for (const t of c.tests) {
      a.total++;
      if (t.status === "passed") a.passed++;
      else if (t.status === "failed") a.failed++;
      else if (t.status === "diff") a.diff++;
      else a.idle++;
      if (t.durMs !== undefined) { a.dur += t.durMs; a.durCount++; }
    }
  }
  return a;
}

function StatTile({ label, value, sub, Icon, tone }: {
  label: string; value: string; sub?: string; Icon: typeof Activity; tone: string;
}) {
  return (
    <div className="fade-up rounded-xl border border-line bg-raised/50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-line2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-dim">{label}</span>
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ color: tone, background: `${tone}16` }}>
          <Icon size={14} />
        </span>
      </div>
      <div className="mt-2 font-display text-[24px] font-bold leading-none text-fog">{value}</div>
      {sub && <div className="mt-1.5 text-[10.5px] font-semibold text-mist">{sub}</div>}
    </div>
  );
}

export default function StatsView({ collections }: { collections: Collection[] }) {
  const agg = useMemo(() => aggregate(collections), [collections]);
  const cols = collections.filter((c) => !c.deleted);
  const avgDur = agg.durCount > 0 ? Math.round(agg.dur / agg.durCount) : 0;
  const passRate = agg.total > 0 ? Math.round((agg.passed / agg.total) * 100) : 0;
  const needsAttention = agg.failed + agg.diff;

  const seg = (n: number) => (agg.total > 0 ? (n / agg.total) * 100 : 0);

  return (
    <div>
      <div className="mx-auto max-w-[1100px] px-6 py-5">

        {/* метрики */}
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-5">
          <StatTile label="Всего тестов" value={String(agg.total)} Icon={Layers} tone="#4fe0c4" sub={`${cols.length} коллекций`} />
          <StatTile label="Успешно" value={String(agg.passed)} Icon={CheckCircle2} tone="#46d68c" sub={`${passRate}% от всех`} />
          <StatTile label="Падения" value={String(agg.failed)} Icon={XCircle} tone="#ff7a68" sub={agg.failed ? "требуют фикса" : "всё чисто"} />
          <StatTile label="Расхождения" value={String(agg.diff)} Icon={Diff} tone="#ffb454" sub={agg.diff ? "сверить кадры" : "всё чисто"} />
          <StatTile label="Ср. время" value={avgDur ? fmtDur(avgDur) : "—"} Icon={Timer} tone="#7fb7ff" sub="на один прогон" />
        </div>

        {/* распределение статусов */}
        <div className="fade-up mt-5 rounded-xl border border-line bg-raised/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity size={14} className="text-teal" />
            <span className="text-[12px] font-extrabold text-fog">Распределение по статусам</span>
          </div>
          <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-deep/60">
            {agg.passed > 0 && <div className="h-full transition-all duration-500" style={{ width: `${seg(agg.passed)}%`, background: "#46d68c" }} title={`Успешно: ${agg.passed}`} />}
            {agg.diff > 0 && <div className="h-full transition-all duration-500" style={{ width: `${seg(agg.diff)}%`, background: "#ffb454" }} title={`Расхождения: ${agg.diff}`} />}
            {agg.failed > 0 && <div className="h-full transition-all duration-500" style={{ width: `${seg(agg.failed)}%`, background: "#ff7a68" }} title={`Падения: ${agg.failed}`} />}
            {agg.idle > 0 && <div className="h-full transition-all duration-500" style={{ width: `${seg(agg.idle)}%`, background: "#2b454d" }} title={`Ожидают: ${agg.idle}`} />}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px] font-bold">
            <span className="flex items-center gap-1.5 text-mist"><i className="h-2 w-2 rounded-full bg-[#46d68c]" />Успешно <b className="font-mono text-fog">{agg.passed}</b></span>
            <span className="flex items-center gap-1.5 text-mist"><i className="h-2 w-2 rounded-full bg-amber" />Расхождения <b className="font-mono text-fog">{agg.diff}</b></span>
            <span className="flex items-center gap-1.5 text-mist"><i className="h-2 w-2 rounded-full bg-coral" />Падения <b className="font-mono text-fog">{agg.failed}</b></span>
            <span className="flex items-center gap-1.5 text-mist"><i className="h-2 w-2 rounded-full bg-line2" />Ожидают <b className="font-mono text-fog">{agg.idle}</b></span>
          </div>
        </div>

        {/* по коллекциям */}
        <div className="fade-up mt-5 rounded-xl border border-line bg-raised/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 size={14} className="text-amber" />
            <span className="text-[12px] font-extrabold text-fog">Прохождение по коллекциям</span>
          </div>
          <div className="space-y-3">
            {cols.map((c) => {
              const total = c.tests.length;
              const passed = c.tests.filter((t) => t.status === "passed").length;
              const bad = c.tests.filter((t) => t.status === "failed" || t.status === "diff").length;
              const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
              return (
                <div key={c.id} className="group">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-md" style={{ color: c.color, background: `${c.color}1a` }}>
                      <Layers size={11} />
                    </span>
                    <span className="truncate text-[12px] font-extrabold text-fog">{c.name}</span>
                    <span className="ml-auto font-mono text-[10.5px] font-semibold text-mist">
                      <b className="text-fog">{passed}</b>/{total}
                      {bad > 0 && <span className="ml-1.5 text-coral">· {bad} проблем.</span>}
                    </span>
                    <span className="w-9 text-right font-mono text-[11px] font-bold" style={{ color: rate >= 80 ? "#46d68c" : rate >= 50 ? "#ffb454" : "#ff7a68" }}>{rate}%</span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-deep/60">
                    <div className="h-full rounded-l-full transition-all duration-500 group-hover:brightness-110" style={{ width: `${total > 0 ? (passed / total) * 100 : 0}%`, background: c.color }} />
                    {total > 0 && bad > 0 && <div className="h-full transition-all duration-500" style={{ width: `${(bad / total) * 100}%`, background: "#ff7a68" }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {needsAttention > 0 && (
          <div className="fade-up mt-5 flex items-center gap-3 rounded-xl border border-amber/30 bg-amber/[0.06] px-4 py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber/15 text-amber"><Activity size={15} /></span>
            <div className="text-[11.5px] font-semibold leading-relaxed text-mist">
              <b className="text-fog">{needsAttention}</b> {needsAttention === 1 ? "тест требует" : "теста требуют"} внимания:{" "}
              <span className="text-coral">{agg.failed} падений</span> и <span className="text-amber">{agg.diff} расхождений</span>. Откройте вкладку «Скриншот-тесты», чтобы сверить кадры.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
