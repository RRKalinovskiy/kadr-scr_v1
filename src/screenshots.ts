/**
 * Эталонные скриншоты и снимки прогонов: хранение в IndexedDB, захват со страницы,
 * загрузка из файла/буфера и попиксельное сравнение с подсветкой различий.
 */

import type { RunShots } from "./types";

const DB_NAME = "kadr-baselines";
const STORE = "shots";
const RUNS_STORE = "runs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(RUNS_STORE)) db.createObjectStore(RUNS_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveBaseline(testId: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(dataUrl, testId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getBaseline(testId: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(testId);
      req.onsuccess = () => { db.close(); resolve((req.result as string) ?? null); };
      req.onerror = () => { db.close(); resolve(null); };
    });
  } catch { return null; }
}

/** Снимки конкретного прогона: ключ `${testId}:${runId}` */
export async function saveRunShots(testId: string, runId: string, shots: RunShots): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RUNS_STORE, "readwrite");
      tx.objectStore(RUNS_STORE).put(JSON.stringify(shots), `${testId}:${runId}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* переполнение хранилища не критично */ }
}

export async function getRunShots(testId: string, runId: string): Promise<RunShots | null> {
  try {
    const db = await openDb();
    const raw = await new Promise<string | null>((resolve) => {
      const req = db.transaction(RUNS_STORE, "readonly").objectStore(RUNS_STORE).get(`${testId}:${runId}`);
      req.onsuccess = () => resolve((req.result as string) ?? null);
      req.onerror = () => resolve(null);
    });
    db.close();
    return raw ? (JSON.parse(raw) as RunShots) : null;
  } catch { return null; }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось прочитать изображение"));
    img.src = src;
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Не удалось прочитать файл"));
    r.readAsDataURL(file);
  });
}

export async function pasteFromClipboard(): Promise<string> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (type) {
        const blob = await item.getType(type);
        return await fileToDataUrl(new File([blob], "clipboard.png", { type }));
      }
    }
  } catch { /* нет доступа к буферу */ }
  throw new Error("В буфере обмена нет изображения (или нет доступа к буферу)");
}

/** Захват эталона: HTML через прокси → same-origin srcDoc-кадр → рендер в canvas */
export async function captureBaselineFromUrl(url: string): Promise<string> {
  const proxies = [
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];
  let html: string | null = null;
  for (const p of proxies) {
    try {
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(p(url), { signal: ctrl.signal });
      window.clearTimeout(t);
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 40) { html = text; break; }
      }
    } catch { /* следующий прокси */ }
  }
  if (!html) throw new Error("Страницу не удалось загрузить — прокси не ответили. Откройте страницу и вставьте скриншот из буфера.");

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, noscript").forEach((s) => s.remove());
    const base = doc.createElement("base");
    base.href = url;
    doc.head?.prepend(base);
    html = "<!doctype html>" + doc.documentElement.outerHTML;
  } catch { /* используем как есть */ }

  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;left:-99999px;top:0;width:1280px;height:900px;border:0;";
    frame.srcdoc = html;
    let settled = false;
    const fail = (msg: string) => { if (!settled) { settled = true; frame.remove(); reject(new Error(msg)); } };
    const timer = window.setTimeout(() => fail("Страница не успела отрисоваться за 15 секунд"), 15000);
    frame.onload = () => {
      window.setTimeout(async () => {
        try {
          const w = frame.clientWidth || 1280;
          const h = Math.min(frame.contentDocument?.body?.scrollHeight || 900, 1400);
          const xml = new XMLSerializer().serializeToString(frame.contentDocument!.documentElement);
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
          const img = await loadImage("image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0);
          window.clearTimeout(timer);
          if (!settled) { settled = true; frame.remove(); resolve(canvas.toDataURL("image/png")); }
        } catch {
          window.clearTimeout(timer);
          fail("Не удалось отрисовать кадр страницы. Вставьте скриншот из буфера обмена.");
        }
      }, 900);
    };
    frame.onerror = () => { window.clearTimeout(timer); fail("Не удалось встроить страницу"); };
    document.body.appendChild(frame);
  });
}

export interface CompareResult {
  diffPct: number;
  diffDataUrl: string;
  width: number;
  height: number;
  diffPixels: number;
  totalPixels: number;
}

/** Попиксельное сравнение: расхождение > 32 по любому каналу = отличающийся пиксель (красный) */
export async function compareImages(baselineDataUrl: string, currentDataUrl: string): Promise<CompareResult> {
  const [baseImg, curImg] = await Promise.all([loadImage(baselineDataUrl), loadImage(currentDataUrl)]);
  const w = Math.max(baseImg.width, curImg.width);
  const h = Math.max(baseImg.height, curImg.height);

  const draw = (img: HTMLImageElement) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, w, h);
  };

  const a = draw(baseImg);
  const b = draw(curImg);
  const out = new ImageData(w, h);
  let diffPixels = 0;
  const total = w * h;

  for (let i = 0; i < a.data.length; i += 4) {
    const dr = Math.abs(a.data[i] - b.data[i]);
    const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
    const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
    if (dr > 32 || dg > 32 || db > 32) {
      diffPixels++;
      out.data[i] = 255; out.data[i + 1] = 70; out.data[i + 2] = 90; out.data[i + 3] = 230;
    } else {
      out.data[i] = b.data[i]; out.data[i + 1] = b.data[i + 1]; out.data[i + 2] = b.data[i + 2]; out.data[i + 3] = 60;
    }
  }

  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.putImageData(out, 0, 0);

  return {
    diffPct: +((diffPixels / total) * 100).toFixed(2),
    diffDataUrl: c.toDataURL("image/png"),
    width: w,
    height: h,
    diffPixels,
    totalPixels: total,
  };
}
