import { useState, useRef, useEffect, useCallback } from "react";
import homePageImg from "../assets/homepage.webp";
import centerPageImg from "../assets/ranking-center.webp";
import aceIconImg from "../assets/ace-icon.webp";

const SCREEN_W = 390;
const SCREEN_H = 844;

/* ============================================================
   王牌菜榜 icon 强化动效方案（基于原方案 = 承接方案二的方案B）
   原方案：现有动效 —— 返回榜单中心时 icon 单道白色扫光（1.6s）
   方案一：弹性放大 + 双重扫光（白 + 暖橙光束先后掠过）
   方案二：呼吸放大 + 橙色光晕脉冲 + 光环两圈向外扩散
   方案三：闪光 + 星尘光点向四周迸发
   四个方案共用方案B 的王牌菜榜入场形态（上滑整页/返回箭头）
   ============================================================ */
const SCHEMES = [
  { id: "origin", label: "原方案 · 上滑整页（现状）", short: "原方案" },
  { id: "s1", label: "方案一 · 弹性放大+双重扫光", short: "方案一" },
  { id: "s2", label: "方案二 · 橙色光晕脉冲扩散", short: "方案二" },
  { id: "s3", label: "方案三 · 星尘迸发", short: "方案三" },
];

/* 方案三星尘迸发：10 颗光点以 icon 为中心向四周飞散的方向与距离(px) */
const PARTICLE_DIRS = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2 + 0.32;
  const dist = 28 + (i % 3) * 12;
  return [Math.round(Math.cos(angle) * dist), Math.round(Math.sin(angle) * dist * 0.85)];
});

/* 进入榜单中心页后：原方案保持现状（0.65s 后王牌菜榜直接上滑展开，icon 动效仅在返回时播放）；
   方案一/二/三先播 icon 强化动效，动效收尾后王牌菜榜再上滑展开 */
const CENTER_ENTRY_DELAY = { origin: 650, s1: 1700, s2: 1900, s3: 1550 };

/* 四个方案共用方案B 的 ace 页形态（上滑整页/返回箭头） */
const aceModeOf = () => "up";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"; /* 快出 + 明显缓收，上滑更利落 */

export default function Index() {
  const [scheme, setScheme] = useState("origin");
  const [screen, setScreen] = useState("home"); // home | center
  const [ace, setAce] = useState("closed"); // closed | open(整页)
  const [aceLoaded, setAceLoaded] = useState(false); // 王牌菜榜页是否加载完成
  const [iconBounceKey, setIconBounceKey] = useState(0); // 王牌菜榜 icon 强化动效重放计数（返回/进入榜单中心时）
  const [animOn, setAnimOn] = useState(true); // 切换方案瞬间关闭过渡，避免穿帮
  const [bubbleOpen, setBubbleOpen] = useState(false); // 悬浮方案切换气泡展开态
  const [centerEntryKey, setCenterEntryKey] = useState(0); // 切换方案后强制重播榜单中心入场链路
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const iframeRef = useRef(null);
  const schemeRef = useRef(scheme);
  useEffect(() => { schemeRef.current = scheme; }, [scheme]);

  // 自适应不同屏幕尺寸：完整呈现手机屏幕（390×844）
  useEffect(() => {
    const fit = () => {
      const s = Math.max(0.2, Math.min(window.innerWidth / SCREEN_W, window.innerHeight / SCREEN_H));
      scaleRef.current = s;
      setScale(s);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // 王牌菜榜页直接引用 public/ace.html（资源外置按需加载），不再内联 10MB 大包
  const aceDocUrl = (import.meta.env.BASE_URL || "/") + "ace.html";

  // 演示画面固定 780×1688（2x），居中呈现

  const closeAce = useCallback(() => {
    setAce("closed");
    // 面板收起后，榜单中心页的王牌菜榜 icon 按当前方案播放强化动效
    window.setTimeout(() => setIconBounceKey((k) => k + 1), 420);
  }, []);

  // 每次进入王牌菜榜后，榜首（苏小柳点心）商卡橙色描边闪动 3 次
  const triggerCardHighlight = useCallback(() => {
    window.setTimeout(() => {
      try {
        iframeRef.current?.contentWindow?.postMessage("ace:highlight-card", "*");
      } catch (err) {}
    }, 700); // 等入场动画结束后再开始闪
  }, []);

  // 打开王牌菜榜：重置到白斩鸡榜 tab，并同步返回图标形态（上滑=返回箭头）
  const showAce = useCallback(() => {
    setAce("open");
    try {
      const win = iframeRef.current?.contentWindow;
      win?.postMessage("ace:reset-tab", "*");
      win?.postMessage("ace:mode:" + aceModeOf(), "*");
    } catch (err) {
      /* iframe 未就绪时由 URL 参数保证初始态 */
    }
    triggerCardHighlight();
  }, [triggerCardHighlight]);

  // 王牌菜榜页面常驻预加载，点击时直接呈现
  const openAce = showAce;

  const switchScheme = (id) => {
    if (id === scheme) return;
    setAnimOn(false);
    setScheme(id);
    setAce("closed");
    setScreen("center"); // 切换方案后直接进入榜单中心页，立即展示该方案的入口动效
    setCenterEntryKey((k) => k + 1);
    window.setTimeout(() => setAnimOn(true), 80);
  };

  // 进入榜单中心页后，王牌菜榜按当前方案自动出现：
  // 原方案 0.65s 后直接上滑；新方案先播 icon 强化动效，收尾后整页上滑展开
  useEffect(() => {
    if (screen !== "center") return;
    if (schemeRef.current !== "origin") setIconBounceKey((k) => k + 1);
    const t = window.setTimeout(
      () => {
        showAce();
      },
      CENTER_ENTRY_DELAY[schemeRef.current] ?? 650
    );
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, centerEntryKey]);

  const isAceVisible = ace !== "closed";
  const aceFull = ace === "open";

  // 常驻面板：一个容器承载全部方案，iframe 只加载一次
  const closedTransform = "translateY(100%)";

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#f5f5f7] flex items-center justify-center" style={{ fontFamily: "-apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif" }}>
      <style>{`
        /* ===== 王牌菜榜 icon 强化动效（key 重播） ===== */
        .icon-beam {
          background: linear-gradient(100deg, rgba(255,255,255,0) 18%, rgba(255,255,255,0.55) 40%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0.55) 60%, rgba(255,255,255,0) 82%);
          transform: translateX(-130%) skewX(-20deg);
          will-change: transform;
        }
        @keyframes icon-beam-sweep {
          0% { transform: translateX(-130%) skewX(-20deg); }
          100% { transform: translateX(230%) skewX(-20deg); }
        }
        /* 原方案：单道白色扫光（现状动效，1.6s） */
        .icon-beam--origin { animation: icon-beam-sweep 1.6s cubic-bezier(0.45, 0, 0.25, 1) 0.05s both; }
        /* 方案一：弹性放大 + 白/暖双道扫光 */
        @keyframes icon-pop {
          0% { transform: scale(1); } 30% { transform: scale(1.16); } 52% { transform: scale(0.94); }
          74% { transform: scale(1.05); } 100% { transform: scale(1); }
        }
        .icon-inner--s1 { animation: icon-pop 0.95s cubic-bezier(0.34, 1.4, 0.64, 1) 0.05s both; }
        .icon-beam--1 { animation: icon-beam-sweep 0.8s cubic-bezier(0.45, 0, 0.25, 1) 0.12s both; }
        .icon-beam--2 {
          background: linear-gradient(100deg, rgba(255,255,255,0) 18%, rgba(255,220,180,0.6) 40%, rgba(255,255,255,1) 50%, rgba(255,220,180,0.6) 60%, rgba(255,255,255,0) 82%);
          animation: icon-beam-sweep 0.8s cubic-bezier(0.45, 0, 0.25, 1) 0.55s both;
        }
        /* 方案二：呼吸放大 + 橙色光晕脉冲 + 光环两圈扩散 */
        @keyframes icon-breathe {
          0%, 100% { transform: scale(1); } 40% { transform: scale(1.08); } 75% { transform: scale(0.99); }
        }
        .icon-inner--s2 { animation: icon-breathe 1.5s ease-in-out 0.05s both; }
        .icon-glow {
          background: radial-gradient(circle at 50% 55%, rgba(255,150,60,0.55) 0%, rgba(255,150,60,0.2) 45%, rgba(255,150,60,0) 75%);
          animation: icon-glow-pulse 0.75s ease-out 0.05s 3 both;
        }
        @keyframes icon-glow-pulse { 0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; } }
        .icon-ring {
          position: absolute; left: 50%; top: 50%;
          width: 100%; height: 100%;
          border-radius: 9999px;
          border: 2px solid rgba(255,140,64,0.85);
          box-shadow: 0 0 12px rgba(255,150,60,0.45);
          transform: translate(-50%, -50%);
          opacity: 0;
          will-change: transform, opacity;
        }
        @keyframes icon-ring-burst {
          0% { transform: translate(-50%, -50%) scale(0.7); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(2.7); opacity: 0; }
        }
        .icon-ring--1 { animation: icon-ring-burst 1.15s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both; }
        .icon-ring--2 { animation: icon-ring-burst 1.15s cubic-bezier(0.16, 1, 0.3, 1) 0.55s both; }
        /* 方案三：闪光 + 星尘迸发 */
        .icon-inner--s3 { animation: icon-pop 0.75s cubic-bezier(0.34, 1.4, 0.64, 1) 0.05s both; }
        .icon-flash { background: #fff; mix-blend-mode: screen; animation: icon-flash 0.35s ease-out 0.08s both; }
        @keyframes icon-flash { 0% { opacity: 0.75; } 100% { opacity: 0; } }
        .icon-particle {
          position: absolute; left: 50%; top: 50%;
          width: 6px; height: 6px; margin: -3px 0 0 -3px;
          border-radius: 9999px;
          background: radial-gradient(circle, #FFFFFF 0%, #FFD9A8 40%, rgba(255,140,60,0) 75%);
          box-shadow: 0 0 6px rgba(255,180,110,0.9);
          opacity: 0;
          animation: icon-particle-fly 0.95s cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }
        @keyframes icon-particle-fly {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.15); opacity: 0; }
        }
      `}</style>
      {/* 手机屏幕（自适应不同屏幕尺寸，无外壳描边与圆角） */}
      <div className="relative" style={{ width: SCREEN_W * scale, height: SCREEN_H * scale }}>
        <div
          className="relative overflow-hidden bg-white"
          style={{
            width: SCREEN_W,
            height: SCREEN_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
            {/* ===== 底层页面（首页 / 榜单中心页）===== */}
            <div
              className="absolute inset-0"
              style={{
                transition: animOn ? `transform 0.45s ${EASE}, filter 0.45s ${EASE}` : "none",
                transform: aceFull ? "scale(0.96)" : "none",
                filter: isAceVisible ? "brightness(0.92)" : "none",
              }}
            >
              {/* 首页 */}
              <div
                className="absolute inset-0 transition-opacity duration-300"
                style={{ opacity: screen === "home" ? 1 : 0, pointerEvents: screen === "home" ? "auto" : "none" }}
              >
                <img src={homePageImg} alt="首页" className="absolute inset-0 w-full h-full" draggable={false} />
                {/* 点评榜单入口热区 */}
                <button
                  aria-label="点评榜单入口"
                  onClick={() => setScreen("center")}
                  className="absolute rounded-xl active:bg-black/5"
                  style={{ left: "1.4%", top: "35.6%", width: "48.2%", height: "10.4%" }}
                />
              </div>

              {/* 榜单中心页 */}
              <div
                className="absolute inset-0 transition-opacity duration-300"
                style={{ opacity: screen === "center" ? 1 : 0, pointerEvents: screen === "center" ? "auto" : "none" }}
              >
                <img src={centerPageImg} alt="榜单中心页" className="absolute inset-0 w-full h-full" draggable={false} />
                {/* 返回首页热区 */}
                <button
                  aria-label="返回首页"
                  onClick={() => setScreen("home")}
                  className="absolute active:bg-black/5 rounded-full"
                  style={{ left: "2.5%", top: "7%", width: "7.5%", height: "4.2%" }}
                />
                {/* 王牌菜榜入口 icon：按当前方案播放强化动效（外层不裁切，允许光晕/星尘溢出） */}
                <div
                  key={iconBounceKey}
                  className="absolute pointer-events-none"
                  style={{ left: "9.6%", top: "30.6%", width: "10.3%", height: "4.74%" }}
                >
                  {/* 方案二：橙色光环两圈向外脉冲扩散 */}
                  {scheme === "s2" && (
                    <>
                      <div className="icon-ring icon-ring--1" />
                      <div className="icon-ring icon-ring--2" />
                    </>
                  )}
                  {/* 方案三：星尘光点向四周迸发 */}
                  {scheme === "s3" &&
                    PARTICLE_DIRS.map((d, i) => (
                      <div
                        key={i}
                        className="icon-particle"
                        style={{ "--dx": d[0] + "px", "--dy": d[1] + "px", animationDelay: 30 * i + "ms" }}
                      />
                    ))}
                  <div className={`icon-inner icon-inner--${scheme} absolute inset-0 overflow-hidden`}>
                    <img src={aceIconImg} alt="王牌菜榜" className="w-full h-full" draggable={false} />
                    {scheme === "origin" && <div className="icon-beam icon-beam--origin absolute inset-0" />}
                    {scheme === "s1" && (
                      <>
                        <div className="icon-beam icon-beam--1 absolute inset-0" />
                        <div className="icon-beam icon-beam--2 absolute inset-0" />
                      </>
                    )}
                    {scheme === "s2" && <div className="icon-glow absolute inset-0" />}
                    {scheme === "s3" && <div className="icon-flash absolute inset-0" />}
                  </div>
                </div>
                {/* 王牌菜榜入口热区 */}
                <button
                  aria-label="进入王牌菜榜"
                  onClick={openAce}
                  className="absolute rounded-xl active:bg-black/5"
                  style={{ left: "5.5%", top: "30.4%", width: "17%", height: "8.6%" }}
                />
              </div>
            </div>

            {/* ===== 王牌菜榜常驻面板（iframe 预加载，仅加载一次）===== */}
            <div
              className="absolute left-0 right-0 bottom-0 z-30 overflow-hidden"
              style={{
                height: SCREEN_H,
                background: "#1A1008",
                transform: ace === "closed" ? closedTransform : "translate(0, 0)",
                transition: !animOn ? "none" : `transform 0.38s ${EASE}`,
                boxShadow: "0 -8px 30px rgba(0,0,0,0.18)",
                pointerEvents: ace === "closed" ? "none" : "auto",
              }}
            >
              {aceDocUrl && (
              <iframe
                src={aceDocUrl}
                title="王牌菜榜"
                ref={iframeRef}
                onLoad={() => {
                  setAceLoaded(true);
                  try {
                    iframeRef.current?.contentWindow?.postMessage("ace:mode:" + aceModeOf(), "*");
                  } catch (err) {}
                }}
                className="absolute left-0 border-0"
                style={{
                  width: SCREEN_W,
                  height: SCREEN_H,
                  background: "#1A1008",
                  top: 0,
                }}
              />
              )}
              {/* 整页态：状态栏浮在王牌菜榜顶部安全区之上（页面自身预留了 54px 状态栏空间） */}
              {aceFull && (
                <div
                  className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between pointer-events-none"
                  style={{ height: 54, paddingLeft: 30, paddingRight: 24 }}
                >
                  <span style={{ color: "#fff", fontSize: 16, fontWeight: 600, letterSpacing: 0.5, fontVariantNumeric: "tabular-nums" }}>9:41</span>
                  <div className="flex items-center" style={{ gap: 7 }}>
                    <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
                      <rect x="0" y="8" width="3" height="4" rx="0.8" fill="#fff"/>
                      <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" fill="#fff"/>
                      <rect x="10" y="3" width="3" height="9" rx="0.8" fill="#fff"/>
                      <rect x="15" y="0.5" width="3" height="11.5" rx="0.8" fill="#fff" opacity="0.4"/>
                    </svg>
                    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                      <path d="M8 11 L5.6 8.4 A3.6 3.6 0 0 1 10.4 8.4 Z" fill="#fff"/>
                      <path d="M3.7 6.3 A6.2 6.2 0 0 1 12.3 6.3" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                      <path d="M1.4 3.8 A9.4 9.4 0 0 1 14.6 3.8" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                    </svg>
                    <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
                      <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="#fff" opacity="0.5"/>
                      <rect x="2" y="2" width="15.5" height="8" rx="1.8" fill="#fff"/>
                      <path d="M23 4 v4 a2.2 2.2 0 0 0 0 -4" fill="#fff" opacity="0.5"/>
                    </svg>
                  </div>
                </div>
              )}
              {/* 加载兜底：极少数情况下内容未就绪时给出提示，避免白屏观感 */}
              {!aceLoaded && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white">
                  <div className="w-6 h-6 rounded-full border-2 border-[#ff6633] border-t-transparent animate-spin" />
                  <div className="mt-3 text-[12px] text-[#999]">王牌菜榜加载中…</div>
                </div>
              )}
            </div>

            {/* ===== 王牌菜榜页内返回热区（覆盖原生返回按钮位置）===== */}
            {isAceVisible && (
              <button
                aria-label="返回榜单中心页"
                onClick={closeAce}
                className="absolute z-40 active:bg-black/10 rounded-full"
                style={{
                  left: "2%",
                  width: "9.5%",
                  height: "4.8%",
                  top: "6.2%",
                }}
              />
            )}

          </div>

        {/* ===== 悬浮方案切换（屏幕左缘，外露一小部分）===== */}
            <div
              className="absolute z-50"
              style={{ left: -7 * scale, top: "calc(44% + 100px)", transform: `scale(${scale * 1.2})`, transformOrigin: "top left" }}
            >
              {bubbleOpen && (
                <div
                  className="absolute flex flex-col overflow-hidden"
                  style={{ left: 0, top: "calc(100% + 6px)", borderRadius: 12, background: "rgba(17, 17, 17, 0.8)", backdropFilter: "blur(4px)" }}
                >
                  {SCHEMES.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setBubbleOpen(false);
                        switchScheme(s.id);
                      }}
                      className="whitespace-nowrap text-left px-3 py-1.5 text-[11px] active:opacity-70"
                      style={{
                        color: scheme === s.id ? "#ff6633" : "rgba(255,255,255,0.85)",
                        fontWeight: scheme === s.id ? 600 : 400,
                        borderBottom: i < SCHEMES.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                      }}
                    >
                      {s.short}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setBubbleOpen((v) => !v)}
                className="block text-center active:opacity-80"
                style={{
                  borderRadius: "0 8px 8px 0",
                  padding: "7px 6px 7px 4px",
                  fontSize: 10,
                  lineHeight: "13px",
                  color: "rgba(255,255,255,0.9)",
                  background: "rgba(17, 17, 17, 0.8)",
                  backdropFilter: "blur(4px)",
                }}
              >
                {SCHEMES.find((s) => s.id === scheme).short}
                <svg
                  width="10"
                  height="6"
                  viewBox="0 0 10 6"
                  fill="none"
                  style={{ display: "block", margin: "2px auto 0" }}
                >
                  <path d="M1 1l4 4 4-4" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
        </div>
      </div>
  );
}
