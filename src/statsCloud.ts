/** Клиент облачной статистики: SAP.Authenticate + CommonStatistic.GetReport. */

export interface ReportFilter {
  id: string;
  name: string;
  filterJson: string;
  dateStart?: string;
  dateEnd?: string;
  timeStart?: string;
  timeEnd?: string;
  createdAt: number;
}

export interface ReportTableData {
  columns: string[];
  rows: Record<string, unknown>[];
  error?: string;
}

export interface FilterDates {
  dateStart: string;
  dateEnd: string;
  timeStart: string;
  timeEnd: string;
}

const API_BASE = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}).VITE_API_BASE ?? "/api";

function apiToken(): string | null {
  return localStorage.getItem("kadr-regapi-token")
    || localStorage.getItem("kadr-db:session-token");
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = apiToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["X-Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* не JSON */
  }
  if (!res.ok || data.ok === false) {
    const err = new Error((data.error as string) || `HTTP ${res.status}`) as Error & { needAuth?: boolean };
    err.needAuth = Boolean(data.needAuth);
    throw err;
  }
  return data as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = apiToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["X-Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/${path}`, { headers });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* не JSON */
  }
  if (!res.ok || data.ok === false) {
    throw new Error((data.error as string) || `HTTP ${res.status}`);
  }
  return data as T;
}

export function defaultNav(): Record<string, unknown> {
  return {
    d: [true, 50, 0],
    s: [
      { t: "Логическое", n: "ЕстьЕще" },
      { t: "Число целое", n: "РазмерСтраницы" },
      { t: "Число целое", n: "Страница" },
    ],
    _type: "record",
    f: 0,
  };
}

export function datesOf(filter: ReportFilter): FilterDates {
  return {
    dateStart: filter.dateStart || new Date().toISOString().slice(0, 10),
    dateEnd: filter.dateEnd || new Date().toISOString().slice(0, 10),
    timeStart: filter.timeStart || "00:00",
    timeEnd: filter.timeEnd || "23:59",
  };
}

function fmtPeriod(date: string, time: string, tz = "+03"): string {
  const t = time.length === 5 ? `${time}:00` : time;
  return `${date} ${t}${tz}`;
}

function fmtRuDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y.slice(-2)}`;
}

function isRecordset(node: Record<string, unknown>): boolean {
  return node._type === "recordset"
    || (Array.isArray(node.d) && Array.isArray(node.s) && Array.isArray((node.d as unknown[])[0]));
}

function patchNamedSlot(names: string[], values: unknown[], dates: FilterDates) {
  names.forEach((name, i) => {
    if (name === "ВремяНачала") values[i] = dates.timeStart;
    if (name === "ВремяКонца") values[i] = dates.timeEnd;
    if (name === "ДатаНачала") values[i] = fmtRuDate(dates.dateStart);
    if (name === "ДатаКонца") values[i] = fmtRuDate(dates.dateEnd);
    if (name === "start" && typeof values[i] === "string" && /\d{4}-\d{2}-\d{2}/.test(values[i] as string)) {
      values[i] = fmtPeriod(dates.dateStart, dates.timeStart);
    }
    if (name === "end" && typeof values[i] === "string" && /\d{4}-\d{2}-\d{2}/.test(values[i] as string)) {
      values[i] = fmtPeriod(dates.dateEnd, dates.timeEnd);
    }
    if (name === "timePeriod" && values[i] && typeof values[i] === "object") {
      const tp = values[i] as Record<string, unknown>;
      tp.start = dates.timeStart;
      tp.end = dates.timeEnd;
    }
    if (name === "FilterHours" && Array.isArray(values[i])) {
      values[i] = [dates.timeStart, dates.timeEnd];
    }
  });
}

/** Подставляет период из формы в сериализованный фильтр СБИС (d/s) и в плоский JSON. */
export function applyFilterDates(node: unknown, dates: FilterDates, seen = new Set<object>()): void {
  if (!node || typeof node !== "object") return;
  if (seen.has(node as object)) return;
  seen.add(node as object);

  if (Array.isArray(node)) {
    node.forEach((x) => applyFilterDates(x, dates, seen));
    return;
  }

  const rec = node as Record<string, unknown>;
  if (Array.isArray(rec.s) && Array.isArray(rec.d)) {
    const names = (rec.s as Array<{ n?: string }>).map((f) => String(f?.n ?? ""));
    if (isRecordset(rec)) {
      (rec.d as unknown[]).forEach((row) => {
        if (Array.isArray(row)) patchNamedSlot(names, row, dates);
        else applyFilterDates(row, dates, seen);
      });
    } else {
      patchNamedSlot(names, rec.d as unknown[], dates);
    }
  }

  if (rec.period && typeof rec.period === "object") {
    const p = rec.period as Record<string, unknown>;
    if (Array.isArray(p.rs)) {
      p.rs = [{ start: fmtPeriod(dates.dateStart, dates.timeStart), end: fmtPeriod(dates.dateEnd, dates.timeEnd) }];
    }
  }
  if (rec.Фильтр && typeof rec.Фильтр === "object") {
    const f = rec.Фильтр as Record<string, unknown>;
    if ("ДатаНачала" in f) f.ДатаНачала = fmtRuDate(dates.dateStart);
    if ("ДатаКонца" in f) f.ДатаКонца = fmtRuDate(dates.dateEnd);
    if ("ВремяНачала" in f) f.ВремяНачала = dates.timeStart;
    if ("ВремяКонца" in f) f.ВремяКонца = dates.timeEnd;
  }

  Object.values(rec).forEach((v) => applyFilterDates(v, dates, seen));
}

function parseFilterJson(raw: string): unknown {
  const t = raw.trim();
  if (!t) return {};
  return JSON.parse(t);
}

/** Собирает JSON-RPC CommonStatistic.GetReport из сохранённого фильтра. */
export function buildGetReportPayload(filter: ReportFilter): Record<string, unknown> {
  const dates = datesOf(filter);
  const parsed = parseFilterJson(filter.filterJson) as Record<string, unknown>;

  let payload: Record<string, unknown>;
  if (parsed && typeof parsed === "object" && parsed.method && parsed.params) {
    payload = { ...parsed };
  } else if (parsed && typeof parsed === "object" && parsed.params) {
    payload = {
      jsonrpc: "2.0",
      protocol: 7,
      method: "CommonStatistic.GetReport",
      params: parsed.params,
      id: 1,
    };
  } else {
    const hasFilt = parsed && typeof parsed === "object" && ("Фильтр" in parsed || "filter" in parsed);
    payload = {
      jsonrpc: "2.0",
      protocol: 7,
      method: "CommonStatistic.GetReport",
      params: hasFilt
        ? {
            Фильтр: (parsed as { Фильтр?: unknown; filter?: unknown }).Фильтр ?? parsed,
            Сортировка: (parsed as { Сортировка?: unknown }).Сортировка ?? null,
            Навигация: (parsed as { Навигация?: unknown }).Навигация ?? defaultNav(),
            ДопПоля: (parsed as { ДопПоля?: unknown }).ДопПоля ?? [],
          }
        : {
            Фильтр: parsed,
            Сортировка: null,
            Навигация: defaultNav(),
            ДопПоля: [],
          },
      id: 1,
    };
  }

  payload.method = "CommonStatistic.GetReport";
  applyFilterDates(payload, dates);
  return payload;
}

function collectIdsFromRecordset(node: unknown, pred: (row: Record<string, unknown>) => boolean, out: string[]) {
  if (!node || typeof node !== "object") return;
  const rec = node as Record<string, unknown>;
  if (Array.isArray(rec.rs)) {
    for (const row of rec.rs as Array<Record<string, unknown>>) {
      if (row && typeof row.id === "string" && pred(row)) out.push(row.id);
    }
  }
  if (Array.isArray(rec.s) && Array.isArray(rec.d) && isRecordset(rec)) {
    const names = (rec.s as Array<{ n?: string }>).map((f) => String(f?.n ?? ""));
    const idIdx = names.indexOf("id");
    if (idIdx >= 0) {
      for (const row of rec.d as unknown[]) {
        if (!Array.isArray(row)) continue;
        const id = row[idIdx];
        if (typeof id === "string") {
          const obj: Record<string, unknown> = {};
          names.forEach((n, i) => { obj[n] = row[i]; });
          if (pred(obj)) out.push(id);
        }
      }
    }
  }
  if (Array.isArray(node)) {
    (node as unknown[]).forEach((x) => collectIdsFromRecordset(x, pred, out));
    return;
  }
  Object.values(rec).forEach((v) => collectIdsFromRecordset(v, pred, out));
}

/** Колонки таблицы: измерения фильтра (кроме time) + характеристики. */
export function columnsFromFilter(filter: ReportFilter): string[] {
  try {
    const parsed = parseFilterJson(filter.filterJson);
    const dims: string[] = [];
    const chars: string[] = [];
    collectIdsFromRecordset(parsed, (row) => row.id !== "time" && ("isAggregated" in row || "isTimeDim" in row), dims);
    collectIdsFromRecordset(parsed, (row) => "order" in row || "range" in row, chars);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of [...dims, ...chars]) {
      if (!c || seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
    return out;
  } catch {
    return [];
  }
}

const LABEL_KEYS = ["Метод_Метод", "name0", "label", "id", "Метод"];

export function rowLabel(row: Record<string, unknown>): string {
  for (const k of LABEL_KEYS) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "—";
}

export function mergeTableColumns(filterCols: string[], apiCols: string[], rows: Record<string, unknown>[]): string[] {
  const fromRows = new Set<string>();
  rows.forEach((r) => Object.keys(r).forEach((k) => fromRows.add(k)));
  const preferred = filterCols.filter((c) => fromRows.has(c) || apiCols.includes(c));
  const rest = [...apiCols, ...[...fromRows]].filter((c) => !preferred.includes(c) && c !== "_type");
  const hide = new Set(["rs", "s", "d", "f", "n", "meta"]);
  const merged = [...preferred, ...rest].filter((c) => !hide.has(c));
  if (merged.length === 0) {
    const sample = rows[0] ? Object.keys(rows[0]) : [];
    return sample.length ? sample : ["Значение"];
  }
  return merged;
}

export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    return Number.isInteger(value)
      ? value.toLocaleString("ru-RU")
      : value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  }
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

export function isNumericColumn(name: string, rows: Record<string, unknown>[]): boolean {
  if (/продолжит|количество|вызов|ошиб|предупрежд|мс|top|%/i.test(name)) return true;
  return rows.some((r) => typeof r[name] === "number");
}

export async function authenticateStand(
  standId: string,
  standUrl: string,
  login: string,
  password: string,
): Promise<{ cookiePreview?: string; login?: string }> {
  return apiPost("stand_auth.php", { standId, standUrl, login, password });
}

export async function checkStandSession(standId: string): Promise<{
  hasSession: boolean;
  login?: string;
  password?: string;
}> {
  try {
    const d = await apiGet<{ hasSession?: boolean; login?: string; password?: string }>(
      `stand_auth.php?standId=${encodeURIComponent(standId)}`,
    );
    return {
      hasSession: Boolean(d.hasSession),
      login: d.login || "",
      password: d.password || "",
    };
  } catch {
    return { hasSession: false };
  }
}

export async function loadStandCredentials(): Promise<
  Record<string, { login: string; password: string; hasSession: boolean }>
> {
  try {
    const d = await apiGet<{
      stands?: Record<string, { login?: string; password?: string; hasSession?: boolean }>;
    }>("stand_auth.php");
    const out: Record<string, { login: string; password: string; hasSession: boolean }> = {};
    for (const [id, row] of Object.entries(d.stands ?? {})) {
      out[id] = {
        login: row.login || "",
        password: row.password || "",
        hasSession: Boolean(row.hasSession),
      };
    }
    return out;
  } catch {
    return {};
  }
}

export async function fetchStandReport(standId: string, standUrl: string, filter: ReportFilter): Promise<ReportTableData> {
  const payload = buildGetReportPayload(filter);
  const d = await apiPost<{ columns: string[]; rows: Record<string, unknown>[] }>("stand_report.php", {
    standId,
    standUrl,
    payload,
  });
  const filterCols = columnsFromFilter(filter);
  const columns = mergeTableColumns(filterCols, d.columns ?? [], d.rows ?? []);
  return { columns, rows: d.rows ?? [] };
}
