/**
 * Живой захват кадра без доступа к странице.
 *
 * Снимаем *живую отрисованную* страницу через Screen Capture API (getDisplayMedia):
 * без CORS, без прокси, без авторизационных заголовков — снимается то, что реально
 * отрисовал браузер, вместе с применённой в профиле авторизацией.
 *
 * Ключевая идея сессии: браузер всегда требует ручного выбора источника в пикере,
 * НО выбранная вкладка продолжает захватываться и в фоне, и при навигации. Поэтому
 * открываем одну служебную вкладку, выбираем её в пикере один раз, а дальше для
 * каждого АТ фоново навигируем её на адрес теста и снимаем кадр — фокус из
 * редактора не уходит.
 */

interface DisplayMediaConstraints extends MediaStreamConstraints {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "include" | "exclude";
  systemAudio?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
}

export async function requestLiveStream(opts?: { hideEditorTab?: boolean }): Promise<MediaStream> {
  const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: (c: DisplayMediaConstraints) => Promise<MediaStream> };
  if (!md || typeof md.getDisplayMedia !== "function") {
    throw new Error("Браузер не поддерживает захват экрана (getDisplayMedia)");
  }
  const stream = await md.getDisplayMedia({
    video: { frameRate: 10 },
    audio: false,
    preferCurrentTab: !opts?.hideEditorTab,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
  });
  if (!stream || stream.getVideoTracks().length === 0) {
    throw new Error("Не удалось получить видеопоток захвата");
  }
  return stream;
}

/**
 * Снимает один кадр из стрима захвата и возвращает PNG dataURL.
 * Кадр снимается через setTimeout (не requestAnimationFrame): rAF не выполняется
 * в фоновой вкладке, из-за чего захват падал по таймауту, когда активна была
 * вкладка со страницей АТ. setTimeout вызывается и в фоне.
 */
export function grabFrame(stream: MediaStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const track = stream.getVideoTracks()[0];
    if (!track) return reject(new Error("Видеодорожка захвата отсутствует"));
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    let settled = false;
    const fail = window.setTimeout(() => {
      if (!settled) { settled = true; reject(new Error("Таймаут получения кадра")); }
    }, 9000);

    const grab = () => {
      if (settled) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) { window.setTimeout(grab, 150); return; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
      settled = true;
      window.clearTimeout(fail);
      resolve(canvas.toDataURL("image/png"));
    };

    video.onloadedmetadata = () => {
      video.play()
        .then(() => {
          if (video.readyState >= 2) window.setTimeout(grab, 200);
          else video.oncanplay = () => window.setTimeout(grab, 200);
        })
        .catch(() => { window.setTimeout(grab, 400); });
    };
    video.onerror = () => {
      if (!settled) { settled = true; window.clearTimeout(fail); reject(new Error("Ошибка видеопотока захвата")); }
    };
  });
}

export function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
}

/* ---------- служебная вкладка со страницей АТ ---------- */

export function openTestPage(url: string): Window | null {
  return window.open(url, "_blank", "noopener=false");
}

/** Навигация без смены фокуса — вкладка редактора остаётся активной */
export function navigateTestPageNoFocus(tab: Window, url: string): void {
  try { tab.location.href = url; } catch { /* вкладка закрыта */ }
}

export function closeTestPage(tab: Window | null): void {
  try { tab?.close(); } catch { /* ignore */ }
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/* ---------- сессия фонового захвата ---------- */

export interface CaptureSession {
  stream: MediaStream;
  tab: Window | null;
}

/**
 * Открывает служебную вкладку и запрашивает захват (в жесте пользователя).
 * В пикере нужно выбрать служебную (пустую) вкладку — вкладка редактора скрыта
 * из подсказок. Дальше capturePage() подставляет страницы АТ автоматически.
 */
export async function startCaptureSession(): Promise<CaptureSession> {
  const tab = openTestPage("about:blank");
  try {
    const stream = await requestLiveStream({ hideEditorTab: true });
    return { stream, tab };
  } catch (e) {
    closeTestPage(tab);
    throw e;
  }
}

/**
 * Снимает кадр КОНКРЕТНОЙ страницы (адреса из АТ), не уводя фокус из редактора:
 * фоново навигирует служебную вкладку на адрес, ждёт отрисовки, снимает кадр.
 */
export async function capturePage(session: CaptureSession, url: string, settleMs: number): Promise<string> {
  if (session.tab) {
    try { session.tab.location.href = url; } catch { /* ignore */ }
    await sleep(Math.max(900, settleMs));
  }
  return grabFrame(session.stream);
}

export function endCaptureSession(session: CaptureSession | null): void {
  if (!session) return;
  stopStream(session.stream);
  closeTestPage(session.tab);
}

/** Разовый живой скриншот страницы (для модалки «Снять страницу»): мини-сессия */
export async function captureLiveOfUrl(url: string, settleMs: number): Promise<string> {
  const session = await startCaptureSession();
  try {
    return await capturePage(session, url, settleMs);
  } finally {
    endCaptureSession(session);
  }
}
