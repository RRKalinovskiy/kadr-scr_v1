/* ---------- утилиты ---------- */

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

export const fmtDur = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1).replace(".", ",")} с` : `${ms} мс`;

export const fmtElapsed = (startedAt: number) => {
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/* ---------- тесты ---------- */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "#4fe0c4", POST: "#ffb454", PUT: "#7fb7ff", PATCH: "#c9a2ff", DELETE: "#ff7a68",
};

export type TestStatus = "passed" | "failed" | "diff" | "running" | "queued" | "idle" | "skipped";

export const STATUS_META: Record<TestStatus, { label: string; short: string; color: string; bg: string }> = {
  passed: { label: "Успешно", short: "OK", color: "#46d68c", bg: "rgba(70,214,140,0.12)" },
  failed: { label: "Падение", short: "FAIL", color: "#ff7a68", bg: "rgba(255,122,104,0.12)" },
  diff: { label: "Расхождение", short: "Δ", color: "#ffb454", bg: "rgba(255,180,84,0.12)" },
  running: { label: "Прогон", short: "…", color: "#4fe0c4", bg: "rgba(79,224,196,0.12)" },
  queued: { label: "В очереди", short: "Q", color: "#90a7ac", bg: "rgba(144,167,172,0.12)" },
  idle: { label: "Ожидает", short: "—", color: "#5f777d", bg: "rgba(95,119,125,0.14)" },
  skipped: { label: "Пропущен", short: "SKIP", color: "#8a7f6a", bg: "rgba(138,127,106,0.14)" },
};

export const STATUS_WEIGHT: Record<TestStatus, number> = {
  running: 0, queued: 1, failed: 2, diff: 3, idle: 4, skipped: 5, passed: 6,
};

export interface RunRecord {
  id: string;
  status: "passed" | "failed" | "diff";
  at: number;
  dur: number;
  diffPct?: number;
  /** кто запустил прогон */
  byName?: string;
  /** причина падения */
  failText?: string;
}

/** Снимки конкретного прогона (хранятся в IndexedDB) */
export interface RunShots {
  base: string;
  result: string;
  diff: string | null;
}

/* ---------- шаги визуального редактора ---------- */

export type BuilderTool = "cursor" | "click" | "drag" | "area";
export type StepKind = "click" | "drag" | "area" | "wait" | "type";

export interface TestStep {
  id: string;
  kind: StepKind;
  enabled: boolean;
  selector?: string;
  tag?: string;
  text?: string;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  area?: { x: number; y: number; w: number; h: number };
  areaNorm?: { x: number; y: number; w: number; h: number };
  waitMs?: number;
  typeText?: string;
}

/** «auto» — шаги в редакторе, «manual» — ручная сверка с эталоном */
export type TestType = "auto" | "manual";

/** тест в корне коллекции, вне папок */
export const ROOT_SUITE = "__root__";

export interface AutoTest {
  id: string;
  name: string;
  suite: string;
  path: string;
  viewports: string[];
  assignee: string;
  tags: string[];
  description?: string;
  script?: string;
  steps?: TestStep[];
  status: TestStatus;
  enabled: boolean;
  startedAt?: number;
  durMs?: number;
  lastRun?: number;
  diffPct?: number;
  /** связь с запросом в дереве набора */
  requestId?: string;
  testType?: TestType;
  /** полный адрес страницы для эталона (коллекция + путь) */
  pageUrl?: string;
  baselineAt?: number;
  history: RunRecord[];
}

/* ---------- дерево сценариев ---------- */

export interface RequestNode {
  id: string;
  kind: "request";
  name: string;
  method: HttpMethod;
  path: string;
}

export interface FolderNode {
  id: string;
  kind: "folder";
  name: string;
  children: TreeNode[];
  isTrash?: boolean;
}

export type TreeNode = RequestNode | FolderNode;

export const TRASH_NAME = "Корзина";

export const isReservedName = (name: string): boolean =>
  name.trim().toLowerCase() === TRASH_NAME.toLowerCase();

/* ---------- авторизация ---------- */

export type AuthKind = "none" | "cookie" | "login" | "key";

export const AUTH_META: Record<AuthKind, { label: string; short: string; hint: string }> = {
  none: { label: "Без авторизации", short: "публичный", hint: "Ресурс открыт — доступ без аутентификации" },
  cookie: { label: "По cookie", short: "cookie", hint: "Считываем куки браузера для обнаружения готовой авторизации" },
  login: { label: "Логин и пароль", short: "логин", hint: "Пытаемся авторизоваться на ресурсе по логину и паролю" },
  key: { label: "По ключу", short: "ключ", hint: "Ключ доступа указывается вручную" },
};

export interface AuthCheckState {
  state: "idle" | "checking" | "ok" | "err";
  text?: string;
  at?: number;
  cookies?: string[];
}

/* ---------- коллекции, люди, служебное ---------- */

export type BrowserKind = "chromium" | "firefox" | "webkit";

export interface Person {
  id: string;
  name: string;
  color: string;
  login: string;
  role: "admin" | "qa" | "dev";
}

export interface Account {
  id: string;
  name: string;
  email: string;
  plan: string;
  createdAt: number;
}

export interface Collection {
  id: string;
  name: string;
  color: string;
  baseUrl: string;
  screenUrl: string;
  browser: BrowserKind;
  viewports: string[];
  threshold: number;
  delayMs: number;
  baseline: string;
  notify: boolean;
  deleted?: boolean;
  auth: AuthKind;
  authLogin?: string;
  authPassword?: string;
  authPasswordHash?: string;
  authSalt?: string;
  authKey?: string;
  authKeyHash?: string;
  authKeyMasked?: string;
  cookieUser?: string;
  sessionToken?: string;
  sessionAt?: number;
  sessionCookies?: { name: string; value: string }[];
  tests: AutoTest[];
  tree: TreeNode[];
}

export interface CollectionDraft {
  name: string;
  screenUrl: string;
  browser: BrowserKind;
  threshold: number;
  delayMs: number;
  notify: boolean;
  auth: AuthKind;
  authLogin?: string;
  authPassword?: string;
  authKey?: string;
  cookieUser?: string;
  color?: string;
}

export interface CookieJarItem { name: string; value: string }
/** ключ — хост стенда: cookie общие для всех коллекций домена */
export type CookieStore = Record<string, CookieJarItem[]>;

export interface LastBuild {
  no: number;
  colName: string;
  at: number;
  durMs: number;
  total: number;
  passed: number;
  diff: number;
  failed: number;
}

export type ToastKind = "success" | "info" | "warning";
