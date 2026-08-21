import type {
  Account, AutoTest, Collection, CookieStore, FolderNode, HttpMethod, Person, RequestNode, RunRecord, TestStatus, TreeNode,
} from "./types";
import { ROOT_SUITE, uid } from "./types";
import { ensureTrash } from "./tree";

export const PEOPLE: Person[] = [
  { id: "p1", name: "Анна Крылова", color: "#ffb454", login: "a.krylova", role: "qa" },
  { id: "p2", name: "Дмитрий Соколов", color: "#4fe0c4", login: "d.sokolov", role: "qa" },
  { id: "p3", name: "Мария Ветрова", color: "#7fb7ff", login: "m.vetrova", role: "dev" },
  { id: "p4", name: "Игорь Шамин", color: "#ff9d92", login: "i.shamin", role: "admin" },
];

export const ACCOUNT: Account = {
  id: "acc-mvp",
  name: "Тимур Валиев",
  email: "t.valiev@mvp.team",
  plan: "team",
  createdAt: Date.now() - 92 * 86400000,
};

export const makeFolder = (name: string): FolderNode => ({ id: uid(), kind: "folder", name, children: [] });
export const makeRequest = (name: string, method: HttpMethod, path: string): RequestNode => ({
  id: uid(), kind: "request", name, method, path,
});

function hist(st: TestStatus, ago: number, dur: number): RunRecord[] {
  const seq: Array<"passed" | "failed" | "diff"> = ["passed", "passed", "passed", "passed"];
  if (st === "failed" || st === "diff") seq[3] = st;
  return seq.map((s, i) => ({
    id: uid(),
    status: s,
    at: Date.now() - (ago + (3 - i) * 137 + Math.round(Math.random() * 30)) * 60000,
    dur: Math.round(dur * (0.72 + Math.random() * 0.55)),
    diffPct: s === "diff" ? +(0.4 + Math.random() * 1.8).toFixed(1) : undefined,
    byName: PEOPLE[(i + 1) % PEOPLE.length].name,
  }));
}

interface Scenario {
  name: string; folder?: string; method: HttpMethod; path: string; assignee: string;
  tags: string[]; status: TestStatus; ago?: number; dur?: number; enabled?: boolean;
  description?: string; testType?: "auto" | "manual"; pagePath?: string;
}

function toTest(s: Scenario, screenUrl: string): AutoTest {
  const lastRun = s.ago !== undefined ? Date.now() - s.ago * 60000 : undefined;
  const dur = s.dur ?? 1500;
  const full = (p?: string) => {
    const base = screenUrl.replace(/\/$/, "");
    const path = (p ?? "").trim();
    if (!path) return base;
    try { return new URL(path, screenUrl).href; } catch { return `${base}${path.startsWith("/") ? path : `/${path}`}`; }
  };
  return {
    id: uid(), name: s.name, suite: s.folder ?? ROOT_SUITE, path: s.path,
    viewports: ["1440", "768", "390"], assignee: s.assignee, tags: s.tags,
    description: s.description, status: s.status, enabled: s.enabled ?? true,
    lastRun, durMs: lastRun ? dur : undefined,
    diffPct: s.status === "diff" ? 0.8 : undefined,
    testType: s.testType,
    pageUrl: s.testType === "manual" ? full(s.pagePath ?? s.path) : undefined,
    history: lastRun && s.ago !== undefined ? hist(s.status, s.ago, dur) : [],
  };
}

function buildScenarios(scenarios: Scenario[], screenUrl: string): { tree: TreeNode[]; tests: AutoTest[] } {
  const folders = new Map<string, FolderNode>();
  const root: TreeNode[] = [];
  const tests: AutoTest[] = [];
  for (const s of scenarios) {
    const req = makeRequest(s.name, s.method, s.path);
    if (s.folder) {
      let f = folders.get(s.folder);
      if (!f) { f = makeFolder(s.folder); folders.set(s.folder, f); root.push(f); }
      f.children.push(req);
    } else root.push(req);
    tests.push({ ...toTest(s, screenUrl), requestId: req.id });
  }
  return { tree: root, tests };
}

function seedCollections(): Collection[] {
  const checkout = buildScenarios([
    { name: "Карточка товара — галерея и цена", folder: "Каталог", method: "GET", path: "/product/sku-1042", assignee: "p1", tags: ["смоук", "регресс"], status: "passed", ago: 42, dur: 2100, description: "Проверяем галерею изображений, цену и наличие на карточке товара." },
    { name: "Каталог — фильтры и сортировка", folder: "Каталог", method: "GET", path: "/catalog?filter=new", assignee: "p2", tags: ["регресс"], status: "passed", ago: 44, dur: 1800 },
    { name: "Поиск — пустая выдача", folder: "Поиск", method: "GET", path: "/search?q=xyz-000", assignee: "p3", tags: ["негатив"], status: "diff", ago: 47, dur: 1250 },
    { name: "Поиск — живые подсказки", folder: "Поиск", method: "GET", path: "/search?q=куртка", assignee: "p3", tags: ["смоук"], status: "passed", ago: 49, dur: 1100 },
    { name: "Корзина — добавление товара", folder: "Корзина", method: "POST", path: "/api/cart/items", assignee: "p2", tags: ["смоук", "регресс"], status: "passed", ago: 51, dur: 2400, description: "Добавление в корзину обновляет счётчик и мини-карточку." },
    { name: "Корзина — применение промокода", folder: "Корзина", method: "POST", path: "/api/cart/promo", assignee: "p4", tags: ["регресс"], status: "failed", ago: 53, dur: 2900, description: "Промокод WINTER10 должен пересчитать итог." },
    { name: "Оформление — шаг «Контакты»", folder: "Оформление", method: "GET", path: "/checkout/contacts", assignee: "p1", tags: ["критично"], status: "passed", ago: 56, dur: 2200 },
    { name: "Оформление — валидация формы", folder: "Оформление", method: "POST", path: "/checkout/contacts", assignee: "p4", tags: ["негатив"], status: "failed", ago: 61, dur: 1700 },
    { name: "Оплата — форма карты", folder: "Оплата", method: "GET", path: "/payment/card", assignee: "p2", tags: ["критично", "смоук"], status: "passed", ago: 64, dur: 3100 },
    { name: "Оплата — отказ банка", folder: "Оплата", method: "POST", path: "/api/payments", assignee: "p4", tags: ["негатив"], status: "diff", ago: 69, dur: 2600 },
    { name: "Профиль — история заказов", folder: "Аккаунт", method: "GET", path: "/account/orders", assignee: "p3", tags: ["регресс"], status: "passed", ago: 72, dur: 1600 },
    { name: "Главная — визуальный эталон", folder: "Эталоны", method: "GET", path: "/", assignee: "p1", tags: ["визуал", "эталон"], status: "idle", testType: "manual", pagePath: "/", description: "Ручная сверка главной страницы с сохранённым эталоном." },
    { name: "Корзина — визуальный эталон", folder: "Эталоны", method: "GET", path: "/cart", assignee: "p2", tags: ["визуал", "эталон"], status: "idle", testType: "manual", pagePath: "/cart", description: "Сверка корзины с эталоном после изменений вёрстки." },
    { name: "Страница ошибки 404", method: "GET", path: "/404", assignee: "p4", tags: ["негатив"], status: "idle" },
  ], "https://mvp.site/checkout");

  const lk = buildScenarios([
    { name: "Форма входа — валидные данные", folder: "Авторизация", method: "POST", path: "/api/login", assignee: "p2", tags: ["смоук"], status: "passed", ago: 130, dur: 1900 },
    { name: "Вход через SSO-провайдера", folder: "Авторизация", method: "GET", path: "/sso/redirect", assignee: "p2", tags: ["критично"], status: "passed", ago: 133, dur: 2700 },
    { name: "Восстановление пароля", folder: "Авторизация", method: "POST", path: "/api/recovery", assignee: "p3", tags: ["регресс"], status: "passed", ago: 136, dur: 1500 },
    { name: "Настройки безопасности", folder: "Профиль", method: "GET", path: "/security", assignee: "p1", tags: ["регресс"], status: "diff", ago: 140, dur: 1350 },
    { name: "Список активных сессий", folder: "Профиль", method: "GET", path: "/security/sessions", assignee: "p4", tags: ["регресс"], status: "passed", ago: 143, dur: 1200 },
    { name: "Двухфакторная аутентификация", folder: "Безопасность", method: "POST", path: "/api/2fa", assignee: "p4", tags: ["критично"], status: "passed", ago: 149, dur: 2350 },
  ], "https://lk.mvp.site/login");

  const promo = buildScenarios([
    { name: "Первый экран и оффер", method: "GET", path: "/", assignee: "p1", tags: ["смоук"], status: "passed", ago: 300, dur: 1750 },
    { name: "Тарифы и сравнение планов", method: "GET", path: "/#pricing", assignee: "p3", tags: ["контент"], status: "failed", ago: 307, dur: 1650 },
    { name: "Форма раннего доступа", method: "POST", path: "/api/signup", assignee: "p2", tags: ["критично"], status: "passed", ago: 314, dur: 2050 },
  ], "https://promo.mvp.site");

  return [
    {
      id: "c1", name: "Checkout · web", color: "#ffb454",
      baseUrl: "https://mvp.site", screenUrl: "https://mvp.site/checkout",
      browser: "chromium", viewports: ["1440", "768", "390"],
      threshold: 0.2, delayMs: 800, baseline: "main", notify: true,
      auth: "cookie", cookieUser: "qa-bot",
      tree: checkout.tree, tests: checkout.tests,
    },
    {
      id: "c2", name: "Личный кабинет · SSO", color: "#4fe0c4",
      baseUrl: "https://lk.mvp.site", screenUrl: "https://lk.mvp.site/login",
      browser: "firefox", viewports: ["1440"],
      threshold: 0.3, delayMs: 600, baseline: "release-1.2", notify: true,
      auth: "login", authLogin: "qa-bot@mvp.site", authPassword: "s3cret-qa",
      tree: lk.tree, tests: lk.tests,
    },
    {
      id: "c3", name: "Лендинг MVP", color: "#7fb7ff",
      baseUrl: "https://promo.mvp.site", screenUrl: "https://promo.mvp.site",
      browser: "webkit", viewports: ["1440", "390"],
      threshold: 0.5, delayMs: 1000, baseline: "develop", notify: false,
      auth: "none",
      tree: promo.tree, tests: promo.tests,
    },
  ];
}

const KEY = "kadr-screenbuilds-v3";

export interface PersistedState {
  collections: Collection[];
  activeId: string;
  buildNo: number;
  cookieStore: CookieStore;
  account: Account;
  tagColors: Record<string, string>;
}

function reconcileLinks(c: Collection): Collection {
  const reqs: RequestNode[] = [];
  const walk = (ns: TreeNode[]) =>
    ns.forEach((n) => {
      if (n.kind === "request") reqs.push(n);
      else if (n.kind === "folder" && !n.isTrash) walk(n.children);
    });
  walk(c.tree);
  const used = new Set<string>();
  const tests = c.tests.map((t) => {
    if (t.requestId && reqs.some((r) => r.id === t.requestId)) return t;
    const match = reqs.find((r) => !used.has(r.id) && r.name === t.name && r.path === t.path);
    if (match) { used.add(match.id); return { ...t, requestId: match.id }; }
    return t;
  });
  return { ...c, tests };
}

const PALETTE = ["#ffb454", "#4fe0c4", "#7fb7ff", "#ff7a68"];

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as PersistedState;
      if (Array.isArray(p.collections) && p.collections.length) {
        p.collections = p.collections.map((c, i) =>
          reconcileLinks({
            ...c,
            color: c.color || PALETTE[i % PALETTE.length],
            screenUrl: c.screenUrl || c.baseUrl,
            auth: c.auth && (["none", "cookie", "login", "key"] as const).includes(c.auth) ? c.auth : "none",
            tree: ensureTrash(Array.isArray(c.tree) ? c.tree : []),
            tests: c.tests.map((t) =>
              t.status === "running" || t.status === "queued" ? { ...t, status: "idle", startedAt: undefined } : t,
            ),
          }),
        );
        return {
          ...p,
          cookieStore: p.cookieStore && typeof p.cookieStore === "object" ? p.cookieStore : {},
          account: p.account ?? ACCOUNT,
          tagColors: p.tagColors && typeof p.tagColors === "object" ? p.tagColors : {},
        };
      }
    }
  } catch { /* повреждённые данные — пересеиваем */ }
  const collections = seedCollections().map((c) => ({ ...c, tree: ensureTrash(c.tree) }));
  return { collections, activeId: collections[0].id, buildNo: 13, cookieStore: {}, account: ACCOUNT, tagColors: {} };
}

export function saveState(s: PersistedState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* квота — молча */ }
}

/* ---------- per-account хранение (привязка тестов к аккаунту) ---------- */

import { db } from "./backend/db";
import { isSupabase, supabaseBackend } from "./backend/supabase";

/** Сид-состояние для нового рабочего места */
function seedState(): PersistedState {
  const collections = seedCollections().map((c) => ({ ...c, tree: ensureTrash(c.tree) }));
  return { collections, activeId: collections[0]?.id ?? "", buildNo: 13, cookieStore: {}, account: ACCOUNT, tagColors: {} };
}

function normalize(p: PersistedState): PersistedState {
  return {
    ...p,
    collections: (p.collections ?? []).map((c, i) =>
      reconcileLinks({
        ...c,
        color: c.color || PALETTE[i % PALETTE.length],
        screenUrl: c.screenUrl || c.baseUrl,
        auth: c.auth && (["none", "cookie", "login", "key"] as const).includes(c.auth) ? c.auth : "none",
        tree: ensureTrash(Array.isArray(c.tree) ? c.tree : []),
        tests: c.tests.map((t) =>
          t.status === "running" || t.status === "queued" ? { ...t, status: "idle", startedAt: undefined } : t,
        ),
      }),
    ),
    cookieStore: p.cookieStore && typeof p.cookieStore === "object" ? p.cookieStore : {},
    account: p.account ?? ACCOUNT,
    tagColors: p.tagColors && typeof p.tagColors === "object" ? p.tagColors : {},
  };
}

/**
 * Загружает состояние рабочего места аккаунта (синхронно).
 * В Supabase-режиме приложение предварительно кеширует облачное состояние в
 * localStorage (см. App), поэтому здесь всегда работает быстрый локальный путь.
 */
export function loadStateFor(accountId: string): PersistedState {
  try {
    const cached = db.loadAccountState<PersistedState>(accountId);
    if (cached && Array.isArray(cached.collections) && cached.collections.length) {
      return normalize(cached);
    }
  } catch { /* повреждённые данные — пересеиваем */ }
  const fresh = seedState();
  db.saveAccountState(accountId, fresh);
  return fresh;
}

/** Сохраняет состояние аккаунта: локально + (в Supabase-режиме) в облако. */
export function saveStateFor(accountId: string, s: PersistedState) {
  db.saveAccountState(accountId, s);
  if (isSupabase()) void supabaseBackend.saveState(accountId, s);
}

