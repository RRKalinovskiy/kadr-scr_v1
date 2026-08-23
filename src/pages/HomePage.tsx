import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2, Diff, Eye, Shield, Zap, Layers, ArrowRight } from "lucide-react";
import { useEffect } from "react";

export default function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "КАДР — скрин-сборки автотестов";
    
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) {
      link.href = "/favicon.ico";
    } else {
      const newLink = document.createElement("link");
      newLink.rel = "icon";
      newLink.href = "/favicon.ico";
      document.head.appendChild(newLink);
    }
  }, []);

  const handleStartClick = () => {
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-deep overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-line bg-deep/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden>
              <rect x="2" y="2" width="28" height="28" rx="8" fill="#ffb454" />
              <path d="M9 22.5V9.5l7 7 7-7v13" stroke="#17211d" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <div className="font-display text-[20px] font-bold tracking-[0.12em] text-fog">КАДР</div>
              <div className="text-[10px] font-semibold tracking-wide text-dim">скрин-сборки автотестов</div>
            </div>
          </div>
          <button 
            onClick={handleStartClick}
            className="flex items-center gap-2 rounded-lg bg-amber px-5 py-2.5 text-[13px] font-extrabold text-[#17211d] shadow-[0_2px_14px_rgba(255,180,84,0.3)] transition-all duration-150 hover:bg-amber2 hover:scale-105 active:scale-[0.98]"
          >
            Войти
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center justify-center pt-16">
        {/* Background effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-amber/[0.08] blur-3xl" />
          <div className="absolute -bottom-28 -right-20 h-[500px] w-[500px] rounded-full bg-teal/[0.07] blur-3xl" />
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(233,244,243,0.05) 1px, transparent 1.4px)", backgroundSize: "22px 22px" }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 py-20">
          <div className="text-center">
            {/* Badge */}
            <div className="fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-teal/40 bg-teal/[0.07] px-4 py-1.5 text-[11px] font-bold text-teal">
              <Zap size={14} className="shrink-0" />
              Автоматическое сравнение скриншотов в реальном времени
            </div>

            {/* Main heading */}
            <h1 className="fade-up font-display text-[56px] font-bold leading-tight text-fog" style={{ animationDelay: "50ms" }}>
              Снимайте кадры.<br />
              <span className="text-amber">Сверяйте с эталоном.</span>
            </h1>

            <p className="fade-up mx-auto mt-6 max-w-[600px] text-[16px] font-semibold leading-relaxed text-mist" style={{ animationDelay: "100ms" }}>
              КАДР открывает страницу вашего стенда, делает скриншот и сравнивает его с эталоном — 
              падения и расхождения видны сразу.
            </p>

            {/* CTA Button */}
            <div className="fade-up mt-10 flex justify-center" style={{ animationDelay: "150ms" }}>
              <button 
                onClick={handleStartClick}
                className="group flex items-center gap-3 rounded-xl bg-amber px-10 py-5 text-[16px] font-extrabold text-[#17211d] shadow-[0_4px_20px_rgba(255,180,84,0.4)] transition-all duration-200 hover:bg-amber2 hover:scale-105 hover:shadow-[0_6px_30px_rgba(255,180,84,0.5)] active:scale-[0.98]"
              >
                Начать работу
                <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            {/* Trust badges */}
            <div className="fade-up mt-12 flex items-center justify-center gap-8 text-[11px] font-semibold text-dim" style={{ animationDelay: "200ms" }}>
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-teal" />
                Надёжное хранение данных
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-teal" />
                MySQL база данных
              </div>
            </div>
          </div>

          {/* Feature cards */}
          <div className="fade-up mt-24 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" style={{ animationDelay: "250ms" }}>
            {[
              {
                Icon: Camera,
                title: "Автоскриншоты",
                description: "Автоматическое создание скриншотов ваших страниц при каждом запуске теста",
                color: "#ffb454"
              },
              {
                Icon: Diff,
                title: "Сравнение",
                description: "Точное выявление визуальных расхождений между текущим и эталонным состоянием",
                color: "#46d68c"
              },
              {
                Icon: Layers,
                title: "Коллекции тестов",
                description: "Организуйте тесты в коллекции для удобного управления и запуска",
                color: "#60a5fa"
              }
            ].map((feature, i) => (
              <div 
                key={i}
                className="group rounded-2xl border border-line bg-panel/60 p-6 transition-all duration-200 hover:bg-panel/80 hover:shadow-[0_10px_40px_rgba(0,0,0,0.3)]"
              >
                <div 
                  className="mb-4 grid h-12 w-12 place-items-center rounded-xl transition-transform group-hover:scale-110"
                  style={{ background: `${feature.color}16` }}
                >
                  <feature.Icon size={24} style={{ color: feature.color }} />
                </div>
                <h3 className="font-display text-[18px] font-bold text-fog">{feature.title}</h3>
                <p className="mt-2 text-[13px] font-semibold leading-relaxed text-mist">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Live demo preview */}
          <div className="fade-up mt-24" style={{ animationDelay: "300ms" }}>
            <div className="rounded-2xl border border-line bg-panel/40 p-8 backdrop-blur">
              <div className="mb-6 flex items-center gap-2 text-[12px] font-bold text-dim">
                <Camera size={14} className="text-teal" />
                Живые прогоны обновляются в реальном времени
              </div>
              <div className="space-y-3">
                {[
                  { Icon: CheckCircle2, tone: "#46d68c", label: "Корзина · добавление", val: "успешно", ms: "1,2 с" },
                  { Icon: Diff, tone: "#ffb454", label: "Оплата · отказ банка", val: "расхождение 1,4%", ms: "2,6 с" },
                  { Icon: Eye, tone: "#60a5fa", label: "Каталог товаров", val: "проверка", ms: "1,8 с" },
                ].map((r, i) => (
                  <div 
                    key={i} 
                    className="fade-up flex items-center gap-3 rounded-xl border border-line bg-raised/60 px-4 py-3 backdrop-blur-sm"
                    style={{ animationDelay: `${350 + i * 100}ms` }}
                  >
                    <span 
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-transform"
                      style={{ color: r.tone, background: `${r.tone}16` }}
                    >
                      <r.Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-fog">{r.label}</div>
                      <div className="text-[11px] font-semibold" style={{ color: r.tone }}>{r.val}</div>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-dim">{r.ms}</span>
                    <span 
                      className="pulse-dot h-2 w-2 shrink-0 rounded-full animate-pulse"
                      style={{ background: r.tone }} 
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-deep py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
                <rect x="2" y="2" width="28" height="28" rx="8" fill="#ffb454" />
                <path d="M9 22.5V9.5l7 7 7-7v13" stroke="#17211d" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <div className="font-display text-[16px] font-bold tracking-[0.12em] text-fog">КАДР</div>
                <div className="text-[9px] font-semibold tracking-wide text-dim">скрин-сборки автотестов</div>
              </div>
            </div>
            <div className="text-[11px] font-semibold text-dim">
              © 2024 КАДР. Все права защищены.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
