/**
 * Общие механизмы «построения страницы»: каскад CORS-прокси → srcDoc-кадр,
 * серверные скриншоты, селекторы контролов.
 */

export const PROXIES: Array<(u: string) => string> = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

export async function loadPageHtml(url: string, onStage?: (i: number) => void): Promise<string | null> {
  for (let i = 0; i < PROXIES.length; i++) {
    onStage?.(i + 1);
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(PROXIES[i](url), { signal: ctrl.signal });
      window.clearTimeout(timer);
      if (!res.ok) continue;
      const text = await res.text();
      if (text && text.length > 40) return text;
    } catch { /* следующий */ }
  }
  return null;
}

export const shotSrcs = (url: string, bust?: number) => [
  `https://image.thum.io/get/width/1500/crop/1000/noanimate/${encodeURIComponent(url)}${bust ? `?b=${bust}` : ""}`,
  `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1500${bust ? `&b=${bust}` : ""}`,
];

export function prepareHtml(html: string, baseUrl: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, noscript").forEach((s) => s.remove());
    const base = doc.createElement("base");
    base.href = baseUrl;
    doc.head?.prepend(base);
    return "<!doctype html>" + doc.documentElement.outerHTML;
  } catch { return html; }
}

export const HOVER_CSS =
  ".kadr-hover{outline:2px solid #4fe0c4 !important;outline-offset:2px !important}" +
  ".kadr-flash{outline:2px solid #ffb454 !important;outline-offset:2px !important}";

export function buildSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id && !/^\d/.test(el.id) && !el.id.includes(":")) return `#${el.id}`;
  const cls = Array.from(el.classList).filter((c) => c && !c.startsWith("kadr")).slice(0, 2);
  if (cls.length) return `${tag}.${cls.join(".")}`;
  const role = el.getAttribute("role");
  if (role) return `${tag}[role="${role}"]`;
  const name = el.getAttribute("name");
  if (name) return `${tag}[name="${name}"]`;
  const href = el.getAttribute("href");
  if (href && href.startsWith("#")) return `${tag}[href="${href}"]`;
  return tag;
}
