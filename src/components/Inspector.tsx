import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Camera, Check, ClipboardList, ClipboardPaste, Code2, ExternalLink, FolderPlus, GitCompare, Globe, Image as ImageIcon,
  Loader2, Maximize2, Play, RefreshCw, Save, Trash2, Upload, Video, X,
} from "lucide-react";
import type { AutoTest, Collection, LastBuild, Person, RunRecord, RunShots, TreeNode } from "../types";
import { ROOT_SUITE, STATUS_META, fmtDate, fmtDur, fmtTime, initials } from "../types";
import { buildTestUrl } from "../urlcheck";
import { getRunShots, captureBaselineFromUrl, compareImages, fileToDataUrl, getBaseline, pasteFromClipboard, saveBaseline, type CompareResult } from "../screenshots";
import { captureLiveOfUrl } from "../livec";
import { Avatar, FieldLabel, SectionTitle, StatusBadge } from "./ui";
import TagPicker from "./TagPicker";

export interface ManualResult {
  status: "passed" | "failed";
  diffPct: number;
  durMs: number;
  failText?: string;
  shots?: RunShots;
}

interface Props {
  test: AutoTest | null;
  col: Collection;
  people: Person[];
  lastBuild: LastBuild | null;
  tagColors: Record<string, string>;
  onTagColor: (tag: string, color: string) => void;
  onSave: (id: string, patch: Partial<AutoTest>) => void;
  onDirtyChange: (dirty: boolean) => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onOpenBuilder: () => void;
  onManualResult: (id: string, r: ManualResult) => void;
}

export default function Inspector(props: Props) {
  const { test, col, lastBuild } = props;
  if (!test) return <BuildSummary lastBuild={lastBuild} colName={col.name} />;
  return <TestDetails key={test.id} {...props} test={test} />;
}

/* ---------- сводка последней сборки ---------- */
function BuildSummary({ lastBuild, colName }: { lastBuild: LastBuild | null; colName: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 scroll-thin">
      <SectionTitle>Сводка</SectionTitle>
      {!lastBuild ? (
        <div className="rounded-lg border border-dashed border-line2/60 px-3 py-4 text-center text-[11.5px] font-semibold leading-relaxed text-dim">
          Сборок пока не было.<br />Запустите первую — Ctrl+Enter.
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="rounded-xl border border-line bg-raised/50 p-3.5">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-[13px] font-bold text-fog">Сборка #{lastBuild.no}</span>
              <span className="font-mono text-[10px] font-semibold text-dim">{fmtTime(lastBuild.at)} · {fmtDate(lastBuild.at)}</span>
            </div>
            <div className="mt-0.5 text-[10.5px] font-semibold text-dim">{lastBuild.colName} · {fmtDur(lastBuild.durMs)}</div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-deep/60">
              {lastBuild.passed > 0 && <span style={{ width: `${(lastBuild.passed / lastBuild.total) * 100}%`, background: "#46d68c" }} />}
              {lastBuild.diff > 0 && <span style={{ width: `${(lastBuild.diff / lastBuild.total) * 100}%`, background: "#ffb454" }} />}
              {lastBuild.failed > 0 && <span style={{ width: `${(lastBuild.failed / lastBuild.total) * 100}%`, background: "#ff7a68" }} />}
            </div>
            <div className="mt-2.5 flex gap-3 text-[10.5px] font-bold">
              <span className="text-[#46d68c]">{lastBuild.passed} успешно</span>
              <span className="text-amber">{lastBuild.diff} расхожд.</span>
              <span className="text-coral">{lastBuild.failed} упало</span>
              <span className="ml-auto font-mono font-semibold text-dim">{lastBuild.total} всего</span>
            </div>
          </div>
          <div className="rounded-lg border border-line/70 bg-raised/40 px-3 py-2.5 text-[10.5px] font-semibold leading-relaxed text-dim">
            Выберите тест в списке, чтобы открыть карточку: превью, эталон, шаги и история запусков.
          </div>
        </div>
      )}
      <div className="mt-auto pt-4 text-center font-mono text-[9.5px] font-semibold text-dim">набор: {colName}</div>
    </div>
  );
}

/* ---------- развёрнутый просмотр изображения ---------- */
function ExpandedShot({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-deep/90 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal/12 text-teal"><ImageIcon size={16} /></span>
        <div className="truncate text-[13px] font-extrabold text-fog">{title}</div>
        <button onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-dim transition-all hover:bg-raised hover:text-fog active:scale-90"><X size={16} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-6 scroll-thin">
        <img src={src} alt={title} className="mx-auto max-w-[1100px] rounded-2xl border border-line shadow-[0_40px_120px_rgba(0,0,0,0.6)]" />
      </div>
    </div>
  );
}

/* ---------- модалка ручного прогона ---------- */
function ManualRunModal({ test, baseline, threshold, pageUrl, settleMs, onClose, onResult, onReplaceBaseline }: {
  test: AutoTest; baseline: string; threshold: number; pageUrl: string; settleMs: number;
  onClose: () => void; onResult: (r: ManualResult) => void; onReplaceBaseline: (shot: string) => void;
}) {
  const [current, setCurrent] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replacedFlash, setReplacedFlash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(Date.now());

  const loadFile = async (f: File | undefined) => {
    if (!f) return;
    setErr(null); setLoadingMsg("Читаем файл…");
    try { setCurrent(await fileToDataUrl(f)); setResult(null); }
    catch (e) { setErr(e instanceof Error ? e.message : "Не удалось прочитать файл"); }
    finally { setLoadingMsg(null); }
  };

  const paste = async () => {
    setErr(null); setLoadingMsg("Читаем буфер обмена…");
    try { setCurrent(await pasteFromClipboard()); setResult(null); }
    catch (e) { setErr(e instanceof Error ? e.message : "В буфере нет изображения"); }
    finally { setLoadingMsg(null); }
  };

  const shootLivePage = async () => {
    setErr(null); setLoadingMsg("Открываем страницу АТ и снимаем кадр…");
    try {
      setCurrent(await captureLiveOfUrl(pageUrl, settleMs + 800));
      setResult(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось снять живой скриншот страницы");
    } finally { setLoadingMsg(null); }
  };

  const run = async () => {
    if (!current) return;
    setErr(null); setLoadingMsg("Сравниваем с эталоном…");
    startedRef.current = Date.now();
    try {
      const r = await compareImages(baseline, current);
      setResult(r);
    } catch (e) { setErr(e instanceof Error ? e.message : "Не удалось сравнить изображения"); }
    finally { setLoadingMsg(null); }
  };

  const replaceBaseline = async () => {
    if (!current) return;
    setErr(null); setLoadingMsg("Сохраняем эталон…");
    try {
      await saveBaseline(test.id, current);
      onReplaceBaseline(current);
      setReplacedFlash(true);
      window.setTimeout(() => setReplacedFlash(false), 1600);
    } catch (e) { setErr(e instanceof Error ? e.message : "Не удалось сохранить эталон"); }
    finally { setLoadingMsg(null); }
  };

  const cmp = result;
  const passed = cmp ? cmp.diffPct <= threshold : false;
  const finish = () => {
    if (!cmp || !current) return;
    onResult({
      status: passed ? "passed" : "failed",
      diffPct: cmp.diffPct,
      durMs: Date.now() - startedRef.current,
      failText: passed ? undefined : `Расхождение ${cmp.diffPct.toFixed(2).replace(".", ",")}% превышает допустимый порог ${threshold.toFixed(1).replace(".", ",")}% — страница отличается от эталона.`,
      shots: { base: baseline, result: current, diff: cmp.diffDataUrl },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-deep/75 p-4 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="toast-in flex max-h-[92vh] w-full max-w-[860px] flex-col rounded-2xl border border-line bg-panel shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
        <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-5 py-3.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#c9a2ff]/15 text-[#c9a2ff]"><GitCompare size={17} /></span>
          <div className="min-w-0">
            <div className="font-display text-[13.5px] font-bold text-fog">Ручной прогон · сверка с эталоном</div>
            <div className="mt-0.5 truncate font-mono text-[10.5px] font-semibold text-dim">{test.name}</div>
          </div>
          <button onClick={onClose} className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-dim transition-all hover:bg-raised hover:text-fog active:scale-90"><X size={16} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 scroll-thin">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-teal/45 bg-teal/10 px-3 py-2 text-[11.5px] font-extrabold text-teal transition-all hover:bg-teal/20 active:scale-95">
              <Upload size={13} />Из файла
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void loadFile(e.target.files?.[0])} />
            <button onClick={() => void paste()}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-2 text-[11.5px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95">
              <ClipboardPaste size={13} />Из буфера
            </button>
            <button onClick={() => void shootLivePage()}
              title="Открыть страницу АТ и снять её живой кадр автоматически"
              className="flex items-center gap-1.5 rounded-lg border border-[#c9a2ff]/45 bg-[#c9a2ff]/10 px-3 py-2 text-[11.5px] font-extrabold text-[#c9a2ff] transition-all hover:bg-[#c9a2ff]/20 active:scale-95">
              {loadingMsg?.includes("снимаем") ? <Loader2 size={13} className="spin" /> : <Video size={13} />}Снять страницу
            </button>
            {loadingMsg && <span className="flex items-center gap-1.5 text-[11px] font-bold text-teal"><Loader2 size={12} className="spin" />{loadingMsg}</span>}
          </div>
          {err && <div className="toast-in mb-3 rounded-lg border border-coral/45 bg-coral/10 px-3 py-2 text-[12px] font-bold text-coral">{err}</div>}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { label: "Эталон", src: baseline },
              { label: "Текущий скрин", src: current },
              { label: "Различия", src: cmp?.diffDataUrl ?? null },
            ].map((p) => (
              <div key={p.label}>
                <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-dim">{p.label}</div>
                <div className="group relative overflow-hidden rounded-xl border border-line bg-[#0b1417]" style={{ minHeight: 160 }}>
                  {p.src ? (
                    <>
                      <img src={p.src} alt={p.label} className="w-full object-contain" />
                      <button onClick={() => setExpanded(p.src)} title="Развернуть"
                        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md bg-deep/80 text-mist opacity-0 transition-all hover:text-teal group-hover:opacity-100 active:scale-90">
                        <Maximize2 size={13} />
                      </button>
                    </>
                  ) : (
                    <div className="grid h-[160px] place-items-center text-[10.5px] font-semibold text-dim">
                      {p.label === "Различия" ? "запустите сравнение" : "загрузите изображение"}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {cmp && (
            <div className={`fade-up mt-4 rounded-xl border px-4 py-3 ${passed ? "border-[#46d68c]/40 bg-[#46d68c]/10" : "border-coral/40 bg-coral/10"}`}>
              <div className="flex items-center gap-2.5">
                {passed ? <Check size={18} className="text-[#46d68c]" /> : <AlertTriangle size={18} className="text-coral" />}
                <div>
                  <div className={`text-[13px] font-extrabold ${passed ? "text-[#46d68c]" : "text-coral"}`}>
                    {passed ? "Совпадает с эталоном" : "Расхождение с эталоном — тест падает"}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] font-semibold text-mist">
                    Δ {cmp.diffPct.toFixed(2).replace(".", ",")}% · отличающихся пикселей: {cmp.diffPixels.toLocaleString("ru-RU")} из {cmp.totalPixels.toLocaleString("ru-RU")} · порог {threshold.toFixed(1).replace(".", ",")}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-5 py-3.5">
          <span className="text-[10px] font-semibold text-dim">Красным подсвечены отличающиеся пиксели</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-line bg-raised px-4 py-2 text-[12px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95">Отмена</button>
            {current && (
              <button onClick={() => void replaceBaseline()} disabled={!!loadingMsg} title="Заменить эталон текущим скриншотом"
                className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[12px] font-extrabold transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${
                  replacedFlash ? "border-[#46d68c]/50 bg-[#46d68c]/10 text-[#46d68c]" : "border-[#c9a2ff]/45 bg-[#c9a2ff]/10 text-[#c9a2ff] hover:bg-[#c9a2ff]/20"}`}>
                {replacedFlash ? <Check size={13} strokeWidth={3} /> : <RefreshCw size={13} />}
                {replacedFlash ? "Эталон обновлён" : "Обновить эталон"}
              </button>
            )}
            {!cmp ? (
              <button onClick={() => void run()} disabled={!current || !!loadingMsg}
                className="flex items-center gap-1.5 rounded-lg bg-amber px-4 py-2 text-[12px] font-extrabold text-[#17211d] transition-all hover:bg-amber2 active:scale-95 disabled:pointer-events-none disabled:opacity-40">
                <GitCompare size={13} />Сравнить с эталоном
              </button>
            ) : (
              <button onClick={finish}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-extrabold transition-all active:scale-95 ${passed ? "bg-[#46d68c] text-[#0b1a17] hover:brightness-110" : "bg-coral text-[#2b0f0b] hover:brightness-110"}`}>
                <Check size={13} strokeWidth={3} />Зафиксировать результат
              </button>
            )}
          </div>
        </div>
      </div>
      {expanded && <ExpandedShot src={expanded} title="Просмотр" onClose={() => setExpanded(null)} />}
    </div>
  );
}

/* ---------- карточка прогона ---------- */
function RunCardModal({ run, test, onClose }: { run: RunRecord; test: AutoTest; onClose: () => void }) {
  const [shots, setShots] = useState<RunShots | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<"base" | "result" | "diff">("result");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let live = true;
    setLoaded(false);
    getRunShots(test.id, run.id).then((s) => { if (live) { setShots(s); setLoaded(true); } });
    return () => { live = false; };
  }, [test.id, run.id]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const m = STATUS_META[run.status];
  const src = mode === "base" ? shots?.base : mode === "result" ? shots?.result : shots?.diff;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-deep/75 p-4 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="toast-in flex max-h-[92vh] w-full max-w-[760px] flex-col rounded-2xl border border-line bg-panel shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
        <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-5 py-3.5">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: m.color }} />
          <div className="min-w-0">
            <div className="font-display text-[13.5px] font-bold text-fog">Прогон · {test.name}</div>
            <div className="mt-0.5 font-mono text-[10.5px] font-semibold text-dim">{fmtDate(run.at)} · {fmtTime(run.at)}</div>
          </div>
          <span className="ml-auto rounded-md px-2 py-1 text-[11.5px] font-extrabold" style={{ color: m.color, background: m.bg }}>{m.label}</span>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-dim transition-all hover:bg-raised hover:text-fog active:scale-90"><X size={16} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 scroll-thin">
          {/* метаданные */}
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { l: "Дата запуска", v: fmtDate(run.at) },
              { l: "Время запуска", v: fmtTime(run.at) },
              { l: "Длительность", v: fmtDur(run.dur) },
              { l: "Кто запускал", v: run.byName ?? "—" },
            ].map((x) => (
              <div key={x.l} className="rounded-lg border border-line/70 bg-raised/40 px-3 py-2">
                <div className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-dim">{x.l}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[12px] font-bold text-fog">
                  {x.l === "Кто запускал" && x.v !== "—" && (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-teal/15 text-[8px] font-extrabold text-teal">{initials(x.v)}</span>
                  )}
                  {x.v}
                </div>
              </div>
            ))}
          </div>

          {run.diffPct !== undefined && (
            <div className="mb-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 font-mono text-[11.5px] font-bold text-amber">
              Расхождение: Δ {run.diffPct.toFixed(2).replace(".", ",")}%
            </div>
          )}
          {run.status === "failed" && run.failText && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-coral" />
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-coral">Причина падения</div>
                <div className="mt-0.5 text-[12px] font-semibold leading-relaxed text-fog">{run.failText}</div>
              </div>
            </div>
          )}

          {/* режимы просмотра */}
          {!loaded ? (
            <div className="grid h-[200px] place-items-center"><Loader2 size={22} className="spin text-[#c9a2ff]" /></div>
          ) : shots ? (
            <>
              <div className="mb-2 flex items-center gap-1 rounded-lg border border-line bg-raised p-1">
                {([
                  { id: "base" as const, label: "Эталон" },
                  { id: "result" as const, label: "Результат" },
                  { id: "diff" as const, label: "Разница" },
                ]).map((t) => (
                  <button key={t.id} onClick={() => setMode(t.id)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-extrabold transition-all duration-150 ${mode === t.id ? "bg-[#c9a2ff]/15 text-[#c9a2ff] shadow-[inset_0_0_0_1px_rgba(201,162,255,0.4)]" : "text-mist hover:text-fog"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="group relative overflow-hidden rounded-xl border border-line bg-[#0b1417]">
                {src ? (
                  <>
                    <img src={src} alt={mode} className="max-h-[340px] w-full object-contain" />
                    <button onClick={() => setExpanded(true)} title="Развернуть"
                      className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-deep/85 px-2 py-1 text-[9.5px] font-extrabold text-mist opacity-0 transition-all hover:text-teal group-hover:opacity-100 active:scale-95">
                      <Maximize2 size={11} />Развернуть
                    </button>
                  </>
                ) : (
                  <div className="grid h-[200px] place-items-center text-[10.5px] font-semibold text-dim">Нет данных для этого режима</div>
                )}
              </div>
            </>
          ) : (
            <div className="grid h-[160px] place-items-center rounded-xl border border-dashed border-line2/60 text-center text-[10.5px] font-semibold leading-relaxed text-dim">
              Снимки не сохранены — сравнение доступно для ручных прогонов
            </div>
          )}
        </div>
      </div>
      {expanded && src && <ExpandedShot src={src} title={`${test.name} · ${fmtDate(run.at)}`} onClose={() => setExpanded(false)} />}
    </div>
  );
}

/* ---------- карточка теста ---------- */
function TestDetails({ test, col, people, tagColors, onTagColor, onSave, onDirtyChange, onRun, onDelete, onClose, onOpenBuilder, onManualResult }: Props & { test: AutoTest }) {
  const defaultPageUrl = useMemo(() => buildTestUrl(col.screenUrl, test.path), [col.screenUrl, test.path]);
  const [draft, setDraft] = useState({
    name: test.name,
    description: test.description ?? "",
    tags: [...test.tags],
    testType: test.testType ?? "auto",
    pageUrl: test.pageUrl ?? defaultPageUrl,
    suite: test.suite,
  });
  const [nameError, setNameError] = useState(false);
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const folders = useMemo(() => {
    const names: string[] = [];
    const walk = (ns: TreeNode[]) =>
      ns.forEach((n) => {
        if (n.kind === "folder" && !n.isTrash) {
          if (!names.includes(n.name)) names.push(n.name);
          walk(n.children);
        }
      });
    walk(col.tree);
    return names;
  }, [col]);

  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const delTimer = useRef<number | undefined>(undefined);
  const isManual = draft.testType === "manual";

  const [baseline, setBaseline] = useState<string | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [baselineErr, setBaselineErr] = useState<string | null>(null);
  const [baselineFlash, setBaselineFlash] = useState(false);
  const [expandedBaseline, setExpandedBaseline] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [historyRun, setHistoryRun] = useState<RunRecord | null>(null);
  const baselineFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    if (!isManual) { setBaseline(null); return; }
    setBaselineLoading(true);
    getBaseline(test.id).then((b) => { if (live) { setBaseline(b); setBaselineLoading(false); } });
    return () => { live = false; };
  }, [test.id, isManual, test.baselineAt]);

  const applyManualBaseline = async (shot: string) => {
    const url = draft.pageUrl.trim() || defaultPageUrl;
    setBaselineErr(null);
    setCapturing(true);
    try {
      await saveBaseline(test.id, shot);
      setBaseline(shot);
      onSave(test.id, { pageUrl: url, baselineAt: Date.now(), testType: "manual" });
      setBaselineFlash(true);
      window.setTimeout(() => setBaselineFlash(false), 1600);
    } catch (e) {
      setBaselineErr(e instanceof Error ? e.message : "Не удалось сохранить эталон");
    } finally { setCapturing(false); }
  };

  const updateBaseline = async () => {
    const url = draft.pageUrl.trim() || defaultPageUrl;
    setBaselineErr(null);
    setCapturing(true);
    try {
      const shot = await captureBaselineFromUrl(url);
      await applyManualBaseline(shot);
    } catch (e) {
      setBaselineErr(e instanceof Error ? e.message : "Не удалось снять эталон");
    } finally { setCapturing(false); }
  };

  const loadBaselineFromFile = async (f: File | undefined) => {
    if (!f) return;
    try { await applyManualBaseline(await fileToDataUrl(f)); }
    catch (e) { setBaselineErr(e instanceof Error ? e.message : "Не удалось прочитать файл"); }
  };

  const loadBaselineFromClipboard = async () => {
    try { await applyManualBaseline(await pasteFromClipboard()); }
    catch (e) { setBaselineErr(e instanceof Error ? e.message : "В буфере обмена нет изображения (или нет доступа к буферу)"); }
  };

  const dirty =
    draft.name !== test.name ||
    draft.description !== (test.description ?? "") ||
    draft.testType !== (test.testType ?? "auto") ||
    draft.pageUrl !== (test.pageUrl ?? defaultPageUrl) ||
    draft.suite !== test.suite ||
    JSON.stringify(draft.tags) !== JSON.stringify(test.tags);

  useEffect(() => { onDirtyChange(dirty || nameError); }, [dirty, nameError]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = () => {
    if (!draft.name.trim()) { setNameError(true); return; }
    const suite = newFolderMode ? (newFolderName.trim() || draft.suite) : draft.suite;
    onSave(test.id, {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      tags: draft.tags,
      testType: draft.testType,
      pageUrl: draft.pageUrl,
      suite,
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1400);
  };

  const armDelete = () => {
    if (confirmDel) { window.clearTimeout(delTimer.current); onDelete(test.id); return; }
    setConfirmDel(true);
    delTimer.current = window.setTimeout(() => setConfirmDel(false), 2600);
  };

  const person = people.find((p) => p.id === test.assignee) ?? people[0];
  const tagSuggestions = [...new Set(col.tests.flatMap((t) => t.tags))];
  const busy = test.status === "running" || test.status === "queued";
  const pageUrlResolved = draft.pageUrl.trim() || defaultPageUrl;

  return (
    <div className="fade-up flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-3 scroll-thin">
        {/* шапка карточки */}
        <div className="mb-4 border-b border-line pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal/12 text-teal shadow-[inset_0_0_0_1px_rgba(79,224,196,0.25)]">
                <ClipboardList size={17} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-dim">Карточка теста</span>
                  {dirty && (
                    <span className="flex items-center gap-1 rounded bg-amber/12 px-1.5 py-[2px] text-[9px] font-extrabold uppercase tracking-wider text-amber">
                      <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-amber" />не сохранено
                    </span>
                  )}
                </div>
                <div className="mt-1"><StatusBadge status={test.status} /></div>
              </div>
            </div>
            <button onClick={onClose} title="Закрыть карточку (клик вне карточки тоже закрывает)"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[10.5px] font-extrabold text-mist transition-all duration-150 hover:border-coral/50 hover:bg-coral/10 hover:text-coral active:scale-95">
              <X size={13} />Закрыть
            </button>
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line bg-raised/50 px-2.5 py-1.5">
            <Avatar person={person} size={24} />
            <div className="leading-tight">
              <div className="text-[11px] font-extrabold text-fog">{person.name}</div>
              <div className="font-mono text-[9px] font-semibold text-dim">ответственный · @{person.login}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionTitle>Основное</SectionTitle>

          <div>
            <FieldLabel>Тип теста</FieldLabel>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-raised p-1">
              <button onClick={() => set("testType", "auto")}
                className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11.5px] font-extrabold transition-all duration-150 ${draft.testType === "auto" ? "bg-amber/15 text-amber shadow-[inset_0_0_0_1px_rgba(255,180,84,0.4)]" : "text-mist hover:text-fog"}`}>
                <Code2 size={13} />Авто · редактор шагов
              </button>
              <button onClick={() => set("testType", "manual")}
                className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11.5px] font-extrabold transition-all duration-150 ${isManual ? "bg-[#c9a2ff]/15 text-[#c9a2ff] shadow-[inset_0_0_0_1px_rgba(201,162,255,0.4)]" : "text-mist hover:text-fog"}`}>
                <GitCompare size={13} />Ручной · по эталону
              </button>
            </div>
          </div>

          <div>
            <FieldLabel>Папка</FieldLabel>
            <select value={newFolderMode ? "__new__" : draft.suite}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__new__") { setNewFolderMode(true); setNewFolderName(""); }
                else { setNewFolderMode(false); set("suite", v); }
              }}
              className="w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-[13px] font-bold text-fog outline-none transition-colors focus:border-line2">
              <option value={ROOT_SUITE} className="bg-panel">Корень коллекции (без папки)</option>
              {folders.map((f) => <option key={f} value={f} className="bg-panel">{f}</option>)}
              <option value="__new__" className="bg-panel">Новая папка…</option>
            </select>
            {newFolderMode && (
              <div className="mt-2 flex items-center gap-1.5">
                <FolderPlus size={14} className="shrink-0 text-amber" />
                <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Название новой папки"
                  className="w-full rounded-lg border border-amber/50 bg-raised px-2.5 py-2 text-[12.5px] font-bold text-fog outline-none transition-colors placeholder:text-dim focus:border-amber" />
              </div>
            )}
          </div>

          <div>
            <FieldLabel>Название *</FieldLabel>
            <input value={draft.name} onChange={(e) => { set("name", e.target.value); setNameError(false); }}
              className={`w-full rounded-lg border bg-raised px-3 py-2.5 text-[13px] font-bold text-fog outline-none transition-colors ${nameError ? "border-coral/70" : "border-line focus:border-line2"}`} />
            {nameError && <div className="mt-1 text-[11px] font-bold text-coral">Название обязательно</div>}
          </div>

          <div>
            <FieldLabel>Описание</FieldLabel>
            <textarea value={draft.description} onChange={(e) => set("description", e.target.value)} rows={3}
              placeholder="Что проверяет сценарий: шаги, ожидаемый результат…"
              className="w-full resize-y rounded-lg border border-line bg-raised px-3 py-2.5 text-[12px] font-semibold leading-relaxed text-fog outline-none transition-colors placeholder:text-dim focus:border-line2 scroll-thin" />
          </div>

          <SectionTitle>Проверка</SectionTitle>

          {isManual ? (
            <div className="space-y-3">
              <div>
                <FieldLabel><span className="flex items-center gap-1.5"><Globe size={11} className="text-[#c9a2ff]" /> Адрес страницы для эталона</span></FieldLabel>
                <div className="flex gap-1.5">
                  <input value={draft.pageUrl} onChange={(e) => set("pageUrl", e.target.value)} spellCheck={false} placeholder={defaultPageUrl}
                    className="w-full rounded-lg border border-line bg-raised px-3 py-2.5 font-mono text-[12px] font-semibold text-[#c9a2ff] outline-none transition-colors placeholder:text-dim focus:border-[#c9a2ff]/50" />
                  <a href={pageUrlResolved} target="_blank" rel="noreferrer" title="Открыть страницу в браузере"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-[11px] font-extrabold text-mist transition-all hover:border-[#c9a2ff]/50 hover:text-[#c9a2ff] active:scale-95">
                    <ExternalLink size={12} />Открыть страницу
                  </a>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-line bg-raised/40">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-line/70 px-3 py-2">
                  <Camera size={13} className="shrink-0 text-[#c9a2ff]" />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-mist">Эталонный скриншот</span>
                  {test.baselineAt && <span className="font-mono text-[9.5px] font-semibold text-dim">обновлён {fmtTime(test.baselineAt)} · {fmtDate(test.baselineAt)}</span>}
                  <span className="ml-auto flex flex-wrap items-center gap-1.5">
                    <button onClick={() => baselineFileRef.current?.click()} disabled={capturing} title="Загрузить скриншот из файла и сохранить как эталон"
                      className="flex items-center gap-1.5 rounded-md border border-line bg-raised px-2 py-1 text-[10px] font-extrabold text-mist transition-all hover:border-[#c9a2ff]/50 hover:text-[#c9a2ff] active:scale-95 disabled:pointer-events-none disabled:opacity-60">
                      <Upload size={11} />Из файла
                    </button>
                    <input ref={baselineFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void loadBaselineFromFile(e.target.files?.[0])} />
                    <button onClick={() => void loadBaselineFromClipboard()} disabled={capturing} title="Вставить скриншот из буфера обмена и сохранить как эталон"
                      className="flex items-center gap-1.5 rounded-md border border-line bg-raised px-2 py-1 text-[10px] font-extrabold text-mist transition-all hover:border-[#c9a2ff]/50 hover:text-[#c9a2ff] active:scale-95 disabled:pointer-events-none disabled:opacity-60">
                      <ClipboardPaste size={11} />Из буфера
                    </button>
                    <button onClick={() => void updateBaseline()} disabled={capturing} title="Загрузить страницу, снять скриншот и сохранить как эталон"
                      className="flex items-center gap-1.5 rounded-md border border-[#c9a2ff]/45 bg-[#c9a2ff]/10 px-2 py-1 text-[10px] font-extrabold text-[#c9a2ff] transition-all hover:bg-[#c9a2ff]/20 active:scale-95 disabled:pointer-events-none disabled:opacity-60">
                      {capturing ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />}
                      {capturing ? "Сохраняем…" : "Обновить эталон"}
                    </button>
                  </span>
                </div>
                <div className="p-3">
                  {baselineFlash && (
                    <div className="toast-in mb-2 flex items-center gap-1.5 rounded-lg border border-[#46d68c]/40 bg-[#46d68c]/10 px-3 py-2 text-[11px] font-bold text-[#46d68c]">
                      <Check size={12} strokeWidth={3} />Эталон сохранён
                    </div>
                  )}
                  {baselineErr && <div className="toast-in mb-2 rounded-lg border border-coral/45 bg-coral/10 px-3 py-2 text-[11px] font-bold text-coral">{baselineErr}</div>}
                  {baselineLoading ? (
                    <div className="grid h-[120px] place-items-center"><Loader2 size={20} className="spin text-[#c9a2ff]" /></div>
                  ) : baseline ? (
                    <div className="group relative overflow-hidden rounded-lg border border-line bg-[#0b1417]">
                      <img src={baseline} alt="Эталон" className="max-h-[180px] w-full object-contain object-top" />
                      <button onClick={() => setExpandedBaseline(true)} title="Развернуть эталон"
                        className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-deep/85 px-2 py-1 text-[9.5px] font-extrabold text-mist opacity-0 transition-all hover:text-teal group-hover:opacity-100 active:scale-95">
                        <Maximize2 size={11} />Развернуть
                      </button>
                    </div>
                  ) : (
                    <div className="grid h-[120px] place-items-center rounded-lg border border-dashed border-line2/60 text-center">
                      <div className="text-[10.5px] font-semibold leading-relaxed text-dim">
                        Эталон не сохранён.<br />
                        «Обновить эталон» — автозахват страницы, либо загрузите вручную: «Из файла» / «Из буфера».
                      </div>
                    </div>
                  )}
                  <div className="mt-2 text-[9.5px] font-semibold leading-relaxed text-dim">
                    При запуске из списка страница АТ снимается автоматически и сверяется с эталоном; при первом запуске снимок сохраняется как эталон.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={onOpenBuilder}
              className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-raised/60 px-3 py-2.5 text-left transition-all duration-150 hover:border-teal/40 hover:bg-raised active:scale-[0.99]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-amber/12 text-amber"><Code2 size={15} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-extrabold text-fog">Редактор теста</span>
                <span className="block truncate font-mono text-[10px] font-semibold text-dim">
                  {test.steps?.length ? `настроено шагов: ${test.steps.length} · клики, перетаскивания, области` : "шаги не настроены — откройте конструктор"}
                </span>
              </span>
              <Code2 size={14} className="shrink-0 text-dim" />
            </button>
          )}

          <TagPicker value={draft.tags} onChange={(tags) => set("tags", tags)} colors={tagColors} onColor={onTagColor} suggestions={tagSuggestions} />

          <div>
            <SectionTitle>История запусков</SectionTitle>
            {test.history.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line2/60 px-3 py-3 text-center text-[11px] font-semibold leading-relaxed text-dim">
                Запусков пока не было — выполните тест, и здесь появится история результатов
              </div>
            ) : (
              <div className="space-y-1">
                {[...test.history].sort((a, b) => b.at - a.at).map((r) => {
                  const m = STATUS_META[r.status];
                  return (
                    <button key={r.id} onClick={() => setHistoryRun(r)} title="Открыть карточку прогона"
                      className="group flex w-full items-center gap-2.5 rounded-lg border border-line/70 bg-raised/50 px-2.5 py-1.5 text-left transition-all duration-150 hover:border-line2 hover:bg-raised active:scale-[0.99]">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: m.color }} />
                      <span className="w-[86px] shrink-0 text-[11.5px] font-extrabold" style={{ color: m.color }}>{m.label}</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] font-semibold text-mist">{fmtTime(r.at)} · {fmtDate(r.at)}</span>
                      <span className="shrink-0 font-mono text-[10px] font-semibold text-dim">{fmtDur(r.dur)}</span>
                      {r.diffPct !== undefined && (
                        <span className="shrink-0 rounded bg-amber/12 px-1.5 py-[1px] font-mono text-[9.5px] font-bold text-amber">Δ {r.diffPct.toFixed(1).replace(".", ",")}%</span>
                      )}
                      <Maximize2 size={11} className="shrink-0 text-dim opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-line bg-panel/95 p-4 pt-3 backdrop-blur-sm">
        <button onClick={save} disabled={!dirty && !nameError}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px] font-extrabold transition-all duration-150 active:scale-[0.98] ${
            savedFlash ? "bg-[#46d68c] text-[#0b1a17]" : "bg-amber text-[#17211d] hover:bg-amber2 disabled:pointer-events-none disabled:opacity-35"}`}>
          {savedFlash ? <Check size={14} strokeWidth={3} /> : <Save size={14} />}
          {savedFlash ? "Сохранено" : "Сохранить изменения"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          {isManual ? (
            <button onClick={() => setManualOpen(true)} disabled={!baseline || busy}
              title={baseline ? "Загрузить скрин и сверить с эталоном" : "Сначала сохраните эталон"}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[#c9a2ff]/45 bg-[#c9a2ff]/10 px-3 py-2 text-[12px] font-extrabold text-[#c9a2ff] transition-all hover:bg-[#c9a2ff]/20 active:scale-[0.98] disabled:opacity-40">
              <GitCompare size={12} />Прогнать со скрина
            </button>
          ) : (
            <button onClick={() => onRun(test.id)} disabled={busy}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-teal/45 bg-teal/10 px-3 py-2 text-[12px] font-extrabold text-teal transition-all hover:bg-teal/20 active:scale-[0.98] disabled:opacity-40">
              <Play size={12} fill="currentColor" />Запустить
            </button>
          )}
          <button onClick={armDelete}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-extrabold transition-all active:scale-[0.98] ${
              confirmDel ? "border-coral bg-coral text-[#2b0f0b]" : "border-coral/45 bg-coral/10 text-coral hover:bg-coral/20"}`}>
            <Trash2 size={12} />{confirmDel ? "Точно?" : "Удалить"}
          </button>
        </div>
        <div className="text-center text-[9.5px] font-semibold leading-relaxed text-dim">
          Клик вне карточки закроет её{dirty ? " — есть несохранённые изменения" : ""}
        </div>
      </div>

      {manualOpen && baseline && (
        <ManualRunModal test={test} baseline={baseline} threshold={col.threshold}
          pageUrl={pageUrlResolved} settleMs={col.delayMs ?? 800}
          onClose={() => setManualOpen(false)} onResult={(r) => onManualResult(test.id, r)}
          onReplaceBaseline={(shot) => { setBaseline(shot); onSave(test.id, { baselineAt: Date.now() }); }} />
      )}
      {historyRun && <RunCardModal run={historyRun} test={test} onClose={() => setHistoryRun(null)} />}
      {expandedBaseline && baseline && <ExpandedShot src={baseline} title={`Эталон · ${test.name}`} onClose={() => setExpandedBaseline(false)} />}
    </div>
  );
}
