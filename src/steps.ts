import type { AutoTest, Collection, TestStep } from "./types";
import { buildTestUrl } from "./urlcheck";

const pct = (v: number) => Math.round(v * 100);

/** Selenium-скрипт из шагов редактора */
export function generateStepScript(test: AutoTest, steps: TestStep[], col: Collection): string {
  const url = buildTestUrl(col.screenUrl, test.path);
  const enabled = steps.filter((s) => s.enabled);
  const hasWait = enabled.some((s) => s.kind === "wait");
  const L: string[] = [
    `# ${test.name}`, `# сценарий: ${url} · ${col.browser}`, `# шагов: ${steps.length} (активно: ${enabled.length})`, "",
    "from selenium import webdriver", "from selenium.webdriver.common.by import By",
    "from selenium.webdriver.common.action_chains import ActionChains",
    ...(hasWait ? ["import time"] : []), "",
    `driver = webdriver.Chrome()  # ${col.browser}`,
    `driver.set_window_size(${test.viewports[0] ?? 1440}, 900)`,
    `driver.get("${url}")`,
    `driver.implicitly_wait(${Math.max(1, Math.round(col.delayMs / 1000))})`, "",
  ];
  if (enabled.length === 0) L.push("# шаги не настроены — снимаем контрольный кадр", "shot = driver.get_screenshot_as_png()", "");
  enabled.forEach((s, i) => {
    const n = i + 1;
    if (s.kind === "click") {
      L.push(`# шаг ${n} · клик${s.text ? ` — «${s.text}»` : ` — (${s.x}, ${s.y})`}`);
      if (s.selector) L.push(`el = driver.find_element(By.CSS_SELECTOR, "${s.selector}")`, "el.click()");
      else L.push(`el = driver.execute_script("return document.elementFromPoint(${s.x}, ${s.y})")`, "el.click()");
      L.push("");
    } else if (s.kind === "drag") {
      L.push(`# шаг ${n} · перетаскивание (${s.x}, ${s.y}) → (${s.x2}, ${s.y2})`);
      if (s.selector) L.push(`src = driver.find_element(By.CSS_SELECTOR, "${s.selector}")`);
      else L.push(`src = driver.execute_script("return document.elementFromPoint(${s.x}, ${s.y})")`);
      L.push(`ActionChains(driver).drag_and_drop_by_offset(src, ${(s.x2 ?? s.x) - s.x}, ${(s.y2 ?? s.y) - s.y}).perform()`, "");
    } else if (s.kind === "wait") {
      L.push(`# шаг ${n} · ожидание ${s.waitMs ?? 1000} мс`, `time.sleep(${((s.waitMs ?? 1000) / 1000).toFixed(2)})`, "");
    } else if (s.kind === "type") {
      const txt = (s.typeText ?? "").replace(/"/g, '\\"');
      L.push(`# шаг ${n} · ввод текста «${s.typeText ?? ""}»`);
      if (s.selector) L.push(`el = driver.find_element(By.CSS_SELECTOR, "${s.selector}")`, "el.clear()", `el.send_keys("${txt}")`);
      else L.push(`el = driver.execute_script("return document.elementFromPoint(${s.x}, ${s.y})")`, "el.clear()", `el.send_keys("${txt}")`);
      L.push("");
    } else if (s.areaNorm) {
      L.push(`# шаг ${n} · область проверки ${pct(s.areaNorm.x)}%, ${pct(s.areaNorm.y)}% · ${pct(s.areaNorm.w)}%×${pct(s.areaNorm.h)}%`,
        `region = (${pct(s.areaNorm.x)}, ${pct(s.areaNorm.y)}, ${pct(s.areaNorm.w)}, ${pct(s.areaNorm.h)})  # % кадра`,
        "# кроп контрольного кадра по области и сравнение с baseline", "");
    }
  });
  L.push("shot = driver.get_screenshot_as_png()",
    `diff = compare(shot, storage.get_baseline("${test.id}"), threshold=${col.threshold / 100})`,
    "assert diff.percent < THRESHOLD, f'расхождение {diff.percent}%'", "driver.quit()");
  return L.join("\n");
}
