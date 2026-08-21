import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Bug, Check, ChevronLeft, Code2, Copy, Eye, EyeOff, Loader2, Maximize2,
  MousePointer, MousePointerClick, Move, Play, Plus, RefreshCw, Scan, Save, Square, Timer, Trash2, Type, Video, X,
} from "lucide-react";
import type { AutoTest, BuilderTool, Collection, TestStep } from "../types";
import { uid } from "../types";
import { buildTestUrl } from "../urlcheck";
import { buildSelector, HOVER_CSS, loadPageHtml, prepareHtml, shotSrcs, PROXIES } from "../pageload";
import { generateStepScript } from "../steps";
import { KIND_COLOR, KIND_LABEL } from "./stepMeta";
import { FieldLabel } from "./ui";

interface Props {
  test: AutoTest;
  col: Collection;
  onClose: () => void;
  onSave: (id: string, steps: TestStep[]) => void;
}

const TOOLS: Array<{ id: BuilderTool; label: string; Icon: typeof MousePointer; hint: string }> = [
  { id: "cursor", label: "Курсор", Icon: MousePointer, hint: "Страница интерактивна — инструменты спят" },
  { id: "click", label: "Клик", Icon: MousePointerClick, hint: "Кликните по контролу — его класс попадёт в шаг" },
  { id: "drag", label: "Перетащить", Icon: Move, hint: "Зажмите и протяните — запишем перемещение из A в B" },
  { id: "area", label: "Область", Icon: Scan, hint: "Обведите зону проверки — область сверки кадра" },
];

export default function TestBuilder({ test, col, onClose, onSave }: Props) {
  const url = buildTestUrl(col.screenUrl, test.path);
  const [steps, setSteps] = useState<TestStep[]>(test.steps ?? []);
  const [tool, setTool] = useState<BuilderTool>("click");
  const [viewMode, setViewMode] = useState<"dom" | "shot">("dom");
  const [prepared, setPrepared] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<"loading" | "ready" | "fail">("loading");
  const [shotIdx, setShotIdx] = useState(0);
  const [shotLoading, setShotLoading] = useState(true);
  const [shotFailed, setShotFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [recording, setRecording] = useState(false);
  const [debugging, setDebugging] = useState(false);
  const [debugIdx, setDebugIdx] = useState(-1);
  const [debugCursor, setDebugCursor] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const [areaScan, setAreaScan] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const hoverEl = useRef<Element | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const areaRef = useRef<{ x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null);
  const [areaState, setAreaState] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ping, setPing] = useState<{ x: number; y: number; key: number } | null>(null);
  const debugCancel = useRef(false);
  const doc = frameRef.current?.contentDocument ?? null;

  /* загрузка страницы через прокси (srcDoc) */
  useEffect(() => {
    let cancelled = false;
    setPipeline("loading");
    setPrepared(null);
    void (async () => {
      const html = await loadPageHtml(url);
      if (cancelled) return;
      if (html) { setPrepared(prepareHtml(html, url)); setPipeline("ready"); }
      else setPipeline("fail");
    })();
    return () => { cancelled = true; };
  }, [url, reloadKey]);

  /* прикрепляем стили подсветки к документу фрейма */
  useEffect(() => {
    if (pipeline !== "ready") return;
    const t = window.setTimeout(() => {
      const d = frameRef.current?.contentDocument;
      if (!d) return;
      const st = d.createElement("style");
      st.textContent = HOVER_CSS;
      d.head?.appendChild(st);
    }, 400);
    return () => window.clearTimeout(t);
  }, [pipeline, reloadKey]);

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) };
  };

  const captureEl = (x: number, y: number): { selector?: string; tag?: string; text?: string } => {
    const d = frameRef.current?.contentDocument;
    if (pipeline === "ready" && d) {
      const el = d.elementFromPoint(x, y);
      if (el) {
        const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 48);
        return { selector: buildSelector(el), tag: el.tagName.toLowerCase(), text: text || undefined };
      }
    }
    return {};
  };

  const addStep = (s: TestStep) => setSteps((prev) => [...prev, s]);
  const clearHover = () => { hoverEl.current?.classList.remove("kadr-hover"); hoverEl.current = null; };

  const onHover = (e: React.MouseEvent) => {
    if (tool === "cursor" || pipeline !== "ready") return;
    const d = frameRef.current?.contentDocument;
    if (!d) return;
    const { x, y } = toLocal(e);
    const el = d.elementFromPoint(x, y);
    if (el !== hoverEl.current) {
      clearHover();
      if (el && el.tagName.toLowerCase() !== "html") { el.classList.add("kadr-hover"); hoverEl.current = el; }
    }
  };

  const onStageClick = (e: React.MouseEvent) => {
    if (tool !== "click") return;
    const { x, y } = toLocal(e);
    addStep({ id: uid(), kind: "click", enabled: true, x, y, ...captureEl(x, y) });
    setPing({ x, y, key: Date.now() });
  };

  const onDragDown = (e: React.PointerEvent) => {
    if (tool !== "drag") return;
    e.preventDefault();
    const p = toLocal(e);
    dragRef.current = p;
    setDragState({ ...p, x2: p.x, y2: p.y });
  };
  const onAreaDown = (e: React.PointerEvent) => {
    if (tool !== "area") return;
    e.preventDefault();
    const p = toLocal(e);
    areaRef.current = p;
    setAreaState({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  useEffect(() => {
    const mv = (ev: PointerEvent) => {
      const p = toLocal(ev);
      if (dragRef.current) setDragState((s) => (s ? { ...s, x2: p.x, y2: p.y } : s));
      if (areaRef.current) {
        const a = areaRef.current;
        setAreaState({ x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w: Math.abs(p.x - a.x), h: Math.abs(p.y - a.y) });
      }
    };
    const up = (ev: PointerEvent) => {
      const p = toLocal(ev);
      if (dragRef.current) {
        const s = dragRef.current;
        dragRef.current = null;
        setDragState(null);
        if (Math.hypot(p.x - s.x, p.y - s.y) > 8) {
          addStep({ id: uid(), kind: "drag", enabled: true, x: s.x, y: s.y, x2: p.x, y2: p.y, ...captureEl(s.x, s.y) });
          setPing({ x: p.x, y: p.y, key: Date.now() });
        }
      }
      if (areaRef.current) {
        const a = areaRef.current;
        areaRef.current = null;
        const rect = { x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w: Math.abs(p.x - a.x), h: Math.abs(p.y - a.y) };
        setAreaState(null);
        const stage = stageRef.current?.getBoundingClientRect();
        if (rect.w > 12 && rect.h > 12 && stage) {
          addStep({
            id: uid(), kind: "area", enabled: true, x: rect.x, y: rect.y, area: rect,
            areaNorm: { x: +(rect.x / stage.width).toFixed(3), y: +(rect.y / stage.height).toFixed(3), w: +(rect.w / stage.width).toFixed(3), h: +(rect.h / stage.height).toFixed(3) },
          });
          setPing({ x: rect.x, y: rect.y, key: Date.now() });
        }
      }
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline]);

  /* запись: реальные события на странице (srcDoc) */
  useEffect(() => {
    if (!recording || pipeline !== "ready") return;
    const d = frameRef.current?.contentDocument;
    if (!d) return;
    const onClick = (e: MouseEvent) => {
      const { x, y } = toLocal(e);
      addStep({ id: uid(), kind: "click", enabled: true, x, y, ...captureEl(x, y) });
      setPing({ x, y, key: Date.now() });
    };
    d.addEventListener("click", onClick, true);
    return () => d.removeEventListener("click", onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, pipeline, reloadKey]);

  /* отладка: визуальное исполнение шагов */
  const startDebug = async () => {
    if (debugging) return;
    const enabled = steps.filter((s) => s.enabled);
    if (enabled.length === 0) return;
    setDebugging(true);
    debugCancel.current = false;
    for (let i = 0; i < enabled.length; i++) {
      if (debugCancel.current) break;
      const s = enabled[i];
      setDebugIdx(i);
      const target = s.kind === "drag" ? { x: s.x2 ?? s.x, y: s.y2 ?? s.y } : { x: s.x, y: s.y };
      setDebugCursor({ x: target.x, y: target.y, visible: true });
      await new Promise<void>((r) => window.setTimeout(r, 350));
      if (debugCancel.current) break;
      if (s.kind === "click") {
        setRipple({ x: s.x, y: s.y, key: Date.now() });
        await new Promise<void>((r) => window.setTimeout(r, 500));
      } else if (s.kind === "drag") {
        setRipple({ x: s.x2 ?? s.x, y: s.y2 ?? s.y, key: Date.now() });
        await new Promise<void>((r) => window.setTimeout(r, 600));
      } else if (s.kind === "area" && s.area) {
        setAreaScan(s.area);
        await new Promise<void>((r) => window.setTimeout(r, 800));
        setAreaScan(null);
      } else if (s.kind === "wait") {
        await new Promise<void>((r) => window.setTimeout(r, Math.min(s.waitMs ?? 1000, 2000)));
      } else {
        await new Promise<void>((r) => window.setTimeout(r, 500));
      }
    }
    setDebugCursor((c) => ({ ...c, visible: false }));
    setDebugIdx(-1);
    setDebugging(false);
  };

  const updateStep = (id: string, patch: Partial<TestStep>) => setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeStep = (id: string) => setSteps((prev) => prev.filter((s) => s.id !== id));
  const toggleStep = (id: string) => setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  const moveStep = (i: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const n = [...prev];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const script = generateStepScript(test, steps, col);
  const toolDef = TOOLS.find((t) => t.id === tool) ?? TOOLS[1];

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-deep shadow-[0_0_120px_rgba(0,0,0,0.8)]">
      {/* шапка */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
        <button onClick={onClose} title="Вернуться к карточке теста"
          className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-[12px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95">
          <ChevronLeft size={15} />Карточка
        </button>
        <div className="min-w-0">
          <div className="font-display text-[13px] font-bold text-fog">Редактор теста</div>
          <div className="mt-0.5 max-w-[260px] truncate font-mono text-[10px] font-semibold text-dim">{test.name}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowCode((v) => !v)} title="Сгенерированный код (Selenium)"
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-extrabold transition-all duration-150 active:scale-95 ${showCode ? "border-teal/50 bg-teal/10 text-teal" : "border-line bg-raised text-mist hover:border-line2 hover:text-fog"}`}>
            <Code2 size={14} />Код
          </button>
          <button onClick={() => onSave(test.id, steps)}
            className="flex h-9 items-center gap-2 rounded-lg bg-amber px-4 text-[12.5px] font-extrabold text-[#17211d] shadow-[0_2px_14px_rgba(255,180,84,0.28)] transition-all duration-150 hover:bg-amber2 active:scale-[0.97]">
            <Save size={14} />Сохранить шаги
          </button>
        </div>
      </header>

      {/* панель инструментов */}
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-line bg-panel/80 px-4">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-deep/50 p-1">
          {TOOLS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTool(id)} title={label}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-extrabold transition-all duration-150 active:scale-95 ${tool === id ? "bg-teal/15 text-teal shadow-[inset_0_0_0_1px_rgba(79,224,196,0.4)]" : "text-mist hover:text-fog"}`}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
        <span className="mx-1.5 h-5 w-px bg-line" />
        <button onClick={() => setSteps((s) => s.slice(0, -1))} disabled={steps.length === 0} title="Отменить последний шаг"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 text-[11.5px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95 disabled:pointer-events-none disabled:opacity-30">
          <X size={12} />Отменить
        </button>
        <button onClick={() => setRecording((v) => !v)} title={recording ? "Остановить запись" : "Запись действий"}
          className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11.5px] font-extrabold transition-all duration-150 active:scale-95 ${recording ? "border-coral/50 bg-coral/10 text-coral" : "border-line bg-raised text-mist hover:border-coral/50 hover:text-coral"}`}>
          <Video size={13} className={recording ? "pulse-dot" : ""} />{recording ? "Идёт запись" : "Запись"}
        </button>
        <button onClick={() => (debugging ? (debugCancel.current = true) : void startDebug())} disabled={steps.filter((s) => s.enabled).length === 0}
          title={debugging ? "Остановить отладку" : "Запустить отладку"}
          className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11.5px] font-extrabold transition-all duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${debugging ? "border-amber/50 bg-amber/10 text-amber" : "border-[#46d68c]/45 bg-[#46d68c]/10 text-[#46d68c] hover:bg-[#46d68c]/20"}`}>
          {debugging ? <Square size={12} fill="currentColor" /> : <Bug size={14} />}{debugging ? "Стоп" : "Отладка"}
        </button>
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-dim">{toolDef.hint}</span>
        <span className="shrink-0 rounded-md bg-raised px-2 py-1 font-mono text-[10.5px] font-bold text-mist">{steps.length} шаг{steps.length % 10 === 1 && steps.length % 100 !== 11 ? "" : "а/ов"}</span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* сцена */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line/70 bg-deep/80 px-3">
            <span className="flex gap-1">
              <i className="h-2 w-2 rounded-full bg-coral/60" /><i className="h-2 w-2 rounded-full bg-amber/60" /><i className="h-2 w-2 rounded-full bg-teal/60" />
            </span>
            <span className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 truncate rounded bg-panel/80 px-2 py-0.5 font-mono text-[9.5px] text-mist">
              <span className="text-teal">https</span><span className="truncate">{url.replace(/^https?/, "")}</span>
            </span>
            <div className="flex h-6 shrink-0 items-center rounded-md border border-line bg-panel/80 p-[2px]">
              <button onClick={() => setViewMode("dom")} className={`flex h-full items-center gap-1 rounded px-2 text-[9px] font-extrabold uppercase transition-all ${viewMode === "dom" ? "bg-teal/15 text-teal" : "text-dim hover:text-mist"}`}>
                <Code2 size={10} />DOM
              </button>
              <button onClick={() => setViewMode("shot")} className={`flex h-full items-center gap-1 rounded px-2 text-[9px] font-extrabold uppercase transition-all ${viewMode === "shot" ? "bg-teal/15 text-teal" : "text-dim hover:text-mist"}`}>
                <Scan size={10} />Кадр
              </button>
            </div>
            <button onClick={() => setReloadKey((k) => k + 1)} title="Перезагрузить страницу"
              className="grid h-6 w-6 place-items-center rounded text-dim transition-all hover:bg-raised hover:text-teal active:scale-90">
              <RefreshCw size={11} className={pipeline === "loading" ? "spin" : ""} />
            </button>
          </div>

          <div ref={stageRef} className={`relative min-h-0 flex-1 overflow-hidden bg-[#0e181b] ${tool === "cursor" ? "cursor-default" : "cursor-crosshair"}`}>
            {pipeline === "loading" && viewMode === "dom" && (
              <div className="absolute inset-0 z-30 grid place-items-center bg-deep/60">
                <div className="flex flex-col items-center gap-2.5">
                  <Loader2 size={26} className="spin text-teal" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-dim">поднимаем страницу…</span>
                </div>
              </div>
            )}
            {pipeline === "fail" && viewMode === "dom" && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-deep/70 px-8 text-center">
                <p className="max-w-[420px] text-[12.5px] font-bold leading-relaxed text-mist">
                  Страницу не удалось поднять через прокси. Переключитесь на «Кадр» или перезагрузите.
                </p>
                <button onClick={() => setReloadKey((k) => k + 1)}
                  className="rounded-lg border border-teal/45 bg-teal/10 px-3.5 py-2 text-[11.5px] font-extrabold text-teal transition-all hover:bg-teal/20 active:scale-95">
                  Повторить
                </button>
              </div>
            )}
            {viewMode === "dom" && pipeline === "ready" && prepared && (
              <iframe key={reloadKey} ref={frameRef} srcDoc={prepared} sandbox="allow-same-origin allow-popups allow-forms"
                title={`Страница: ${test.name}`} className="h-full w-full border-0 bg-white" />
            )}
            {viewMode === "shot" && (
              <>
                {shotLoading && !shotFailed && (
                  <div className="absolute inset-0 z-30 grid place-items-center bg-deep/60">
                    <div className="flex flex-col items-center gap-2.5">
                      <Loader2 size={26} className="spin text-teal" />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-dim">получаем скриншот…</span>
                    </div>
                  </div>
                )}
                {shotFailed ? (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-deep/70 px-8 text-center">
                    <p className="max-w-[420px] text-[12.5px] font-bold leading-relaxed text-mist">Сервисы скриншотов не ответили.</p>
                    <div className="flex gap-2">
                      <a href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-teal/45 bg-teal/10 px-3.5 py-2 text-[11.5px] font-extrabold text-teal transition-all hover:bg-teal/20 active:scale-95">Открыть в браузере</a>
                      <button onClick={() => { setShotIdx(0); setShotFailed(false); setShotLoading(true); setReloadKey((k) => k + 1); }}
                        className="rounded-lg border border-line bg-raised px-3.5 py-2 text-[11.5px] font-extrabold text-mist transition-all hover:border-line2 hover:text-fog active:scale-95">Повторить</button>
                    </div>
                  </div>
                ) : (
                  <img key={`${shotIdx}-${reloadKey}`} src={shotSrcs(url, reloadKey || undefined)[shotIdx]} alt={`Скриншот: ${test.name}`}
                    onLoad={() => setShotLoading(false)}
                    onError={() => { if (shotIdx < 1) { setShotIdx(1); setShotLoading(true); } else { setShotFailed(true); setShotLoading(false); } }}
                    className={`h-full w-full object-cover object-top transition-opacity duration-500 ${shotLoading ? "opacity-0" : "opacity-100"}`} />
                )}
              </>
            )}

            {/* маркеры шагов */}
            <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
              {steps.filter((s) => s.enabled && s.kind === "drag").map((s) => (
                <g key={s.id}>
                  <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={KIND_COLOR.drag} strokeWidth={2} strokeDasharray="5 4" />
                  <circle cx={s.x} cy={s.y} r={4} fill={KIND_COLOR.drag} />
                  <circle cx={s.x2} cy={s.y2} r={4} fill="none" stroke={KIND_COLOR.drag} strokeWidth={2} />
                </g>
              ))}
              {dragState && <line x1={dragState.x} y1={dragState.y} x2={dragState.x2} y2={dragState.y2} stroke="#7fb7ff" strokeWidth={2} strokeDasharray="4 4" opacity={0.8} />}
            </svg>
            {steps.filter((s) => s.enabled && s.kind === "click").map((s) => {
              const i = steps.indexOf(s);
              return (
                <span key={s.id} className="pointer-events-none absolute z-10 grid h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-mono text-[9px] font-bold text-deep shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                  style={{ left: s.x, top: s.y, background: KIND_COLOR.click }}>{i + 1}</span>
              );
            })}
            {steps.filter((s) => s.enabled && s.kind === "area" && s.area).map((s) => (
              <span key={s.id} className="pointer-events-none absolute z-10 rounded border-2 border-dashed"
                style={{ left: s.area!.x, top: s.area!.y, width: s.area!.w, height: s.area!.h, borderColor: KIND_COLOR.area, background: "rgba(255,180,84,0.06)" }} />
            ))}
            {areaState && <span className="pointer-events-none absolute z-20 rounded border-2 border-dashed border-amber bg-amber/10" style={{ left: areaState.x, top: areaState.y, width: areaState.w, height: areaState.h }} />}
            {areaScan && <span className="area-scan pointer-events-none absolute z-20 rounded border-2 border-amber" style={{ left: areaScan.x, top: areaScan.y, width: areaScan.w, height: areaScan.h }} />}
            {ripple && <span key={ripple.key} className="debug-ripple pointer-events-none absolute z-30 h-9 w-9 rounded-full border-2 border-teal" style={{ left: ripple.x, top: ripple.y }} />}
            {ping && <span key={ping.key} className="step-ping pointer-events-none absolute z-30 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-teal" style={{ left: ping.x, top: ping.y }} />}
            {debugCursor.visible && (
              <svg className="debug-cursor pointer-events-none absolute z-40 transition-all duration-300" style={{ left: debugCursor.x - 4, top: debugCursor.y - 2 }} width="22" height="22" viewBox="0 0 24 24">
                <path d="M4 2l16 8-7 2-3 7z" fill="#4fe0c4" stroke="#0a1416" strokeWidth="1.5" />
              </svg>
            )}
            {debugging && (
              <div className="absolute left-1/2 top-3 z-40 -translate-x-1/2">
                <span className="flex items-center gap-2 rounded-full border border-teal/50 bg-deep/90 px-3 py-1.5 text-[10.5px] font-bold text-teal shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
                  <span className="pulse-dot h-2 w-2 rounded-full bg-teal" />Отладка · шаг {debugIdx + 1} из {steps.filter((s) => s.enabled).length}
                </span>
              </div>
            )}

            {/* слой захвата */}
            <div className="absolute inset-0 z-20" style={{ pointerEvents: tool === "cursor" || pipeline === "loading" ? "none" : "auto" }}
              onMouseMove={onHover} onMouseLeave={clearHover} onClick={onStageClick}
              onPointerDown={tool === "drag" ? onDragDown : tool === "area" ? onAreaDown : undefined} />
          </div>

          {showCode && (
            <div className="fade-up flex h-[36%] shrink-0 flex-col border-t border-line bg-deep/90">
              <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line/70 px-3">
                <Code2 size={12} className="text-teal" />
                <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-mist">Сгенерированный код · Selenium</span>
                <button onClick={() => { void navigator.clipboard.writeText(script).then(() => { setCodeCopied(true); window.setTimeout(() => setCodeCopied(false), 1400); }); }}
                  className={`ml-auto flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-extrabold transition-all active:scale-95 ${codeCopied ? "border-[#46d68c]/50 text-[#46d68c]" : "border-line text-mist hover:border-line2 hover:text-fog"}`}>
                  {codeCopied ? <Check size={10} /> : <Copy size={10} />}{codeCopied ? "Скопировано" : "Копировать"}
                </button>
                <button onClick={() => setShowCode(false)} className="grid h-6 w-6 place-items-center rounded text-dim transition-all hover:bg-raised hover:text-fog"><X size={12} /></button>
              </div>
              <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[10.5px] leading-relaxed text-mist scroll-thin">{script}</pre>
            </div>
          )}
        </div>

        {/* панель шагов */}
        <aside className="flex w-[300px] shrink-0 flex-col border-l border-line bg-panel">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3.5">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-dim">Шаги автотеста</span>
            <span className="rounded bg-line/70 px-1.5 py-[1px] font-mono text-[10px] font-bold text-mist">{steps.length}</span>
            <div className="ml-auto flex gap-1">
              <button onClick={() => addStep({ id: uid(), kind: "wait", enabled: true, x: 0, y: 0, waitMs: 1000 })} title="Добавить «Подождать»"
                className="grid h-6 w-6 place-items-center rounded-md bg-raised text-mist transition-all hover:text-amber active:scale-90"><Timer size={13} /></button>
              <button onClick={() => addStep({ id: uid(), kind: "type", enabled: true, x: 0, y: 0, typeText: "" })} title="Добавить «Ввести текст»"
                className="grid h-6 w-6 place-items-center rounded-md bg-raised text-mist transition-all hover:text-[#c9a2ff] active:scale-90"><Type size={13} /></button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5 scroll-thin">
            {steps.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2.5 px-4 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-dashed border-line2 text-dim"><MousePointerClick size={20} /></span>
                <div className="text-[12px] font-extrabold text-fog">Шагов пока нет</div>
                <p className="text-[10.5px] font-semibold leading-relaxed text-dim">Выберите инструмент и кликните по контролу на странице — действие запишется как шаг.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {steps.map((s, i) => (
                  <div key={s.id} className={`group rounded-lg border px-2.5 py-2 transition-all duration-150 ${debugging && steps.filter((x) => x.enabled).indexOf(s) === debugIdx ? "border-teal/50 bg-teal/[0.06]" : "border-line/70 bg-raised/50 hover:border-line2"} ${!s.enabled ? "opacity-45" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded font-mono text-[9.5px] font-bold text-deep" style={{ background: KIND_COLOR[s.kind] }}>{i + 1}</span>
                      <span className="text-[11px] font-extrabold" style={{ color: KIND_COLOR[s.kind] }}>{KIND_LABEL[s.kind]}</span>
                      <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="grid h-5 w-5 place-items-center rounded text-dim transition-all hover:bg-line hover:text-fog active:scale-90 disabled:opacity-25" title="Выше"><ArrowUp size={11} /></button>
                        <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="grid h-5 w-5 place-items-center rounded text-dim transition-all hover:bg-line hover:text-fog active:scale-90 disabled:opacity-25" title="Ниже"><ArrowDown size={11} /></button>
                        <button onClick={() => toggleStep(s.id)} className="grid h-5 w-5 place-items-center rounded text-dim transition-all hover:bg-line hover:text-fog active:scale-90" title={s.enabled ? "Выключить" : "Включить"}>{s.enabled ? <Eye size={11} /> : <EyeOff size={11} />}</button>
                        <button onClick={() => removeStep(s.id)} className="grid h-5 w-5 place-items-center rounded text-coral transition-all hover:bg-coral/15 active:scale-90" title="Удалить"><Trash2 size={11} /></button>
                      </span>
                    </div>
                    {s.kind === "wait" ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <input type="number" min={100} step={100} value={s.waitMs ?? 1000} onChange={(e) => updateStep(s.id, { waitMs: Math.max(0, +e.target.value || 0) })}
                          className="w-20 rounded-md border border-line bg-panel px-2 py-1 font-mono text-[11px] font-bold text-fog outline-none focus:border-amber" />
                        <span className="text-[10px] font-semibold text-dim">мс паузы</span>
                      </div>
                    ) : s.kind === "type" ? (
                      <div className="mt-1.5">
                        <input value={s.typeText ?? ""} onChange={(e) => updateStep(s.id, { typeText: e.target.value })} placeholder="Вводимый текст…"
                          className="w-full rounded-md border border-line bg-panel px-2 py-1 text-[11px] font-semibold text-fog outline-none placeholder:text-dim focus:border-[#c9a2ff]" />
                      </div>
                    ) : (
                      <div className="mt-1 pl-7">
                        {s.selector ? (
                          <div className="truncate font-mono text-[10px] font-bold text-teal" title={s.selector}>{s.selector}</div>
                        ) : (
                          <div className="font-mono text-[10px] font-semibold text-dim">селектор разрешится в рантайме</div>
                        )}
                        {s.text && <div className="truncate text-[10px] font-semibold text-mist">«{s.text}»</div>}
                        <div className="font-mono text-[9px] font-semibold text-dim">
                          {s.kind === "drag" ? `(${s.x}, ${s.y}) → (${s.x2}, ${s.y2})` : s.kind === "area" && s.areaNorm ? `${Math.round(s.areaNorm.x * 100)}%, ${Math.round(s.areaNorm.y * 100)}% · ${Math.round(s.areaNorm.w * 100)}×${Math.round(s.areaNorm.h * 100)}%` : `(${s.x}, ${s.y})`}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 border-t border-line/70 px-3.5 py-2.5 text-[9.5px] font-semibold leading-relaxed text-dim">
            Шаги выполняются по порядку при запуске автотеста. «Подождать» и «Ввести текст» — логические действия.
          </div>
        </aside>
      </div>
      {expanded && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-deep/90" onClick={() => setExpanded(null)}>
          <img src={expanded} alt="Скриншот" className="max-h-[90vh] max-w-[90vw] rounded-xl border border-line" />
        </div>
      )}
    </div>
  );
}
