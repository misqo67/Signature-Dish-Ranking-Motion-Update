import { useState, useRef, useEffect, useCallback } from "react";
import homePageImg from "../assets/homepage.webp";
import centerPageImg from "../assets/ranking-center.webp";
import aceIconImg from "../assets/ace-icon-f0.webp"; // 榜单中心页 icon 默认态 = 动画第一帧（与方案四动画首帧一致）
import aceMotionImg from "../assets/ace-motion.webp"; // 方案四：退出后播放一次的徽章动效（停末帧）

const SCREEN_W = 390;
const SCREEN_H = 844;

/* ============================================================
   王牌菜榜入口强化动效（基于原方案 = 承接方案二的方案B）
   原方案：现有动效 —— 返回榜单中心时 icon 单道白色扫光（1.6s）
   方案一：从王牌菜榜下滑退出后，icon 先放大再扫光
   方案二：关闭时全屏王牌菜榜缩小、位移至王牌菜榜入口，
           入口轻微放大回弹，结束后接一道扫光
   方案三：与原方案相同的下滑收起；收起后周边内容短暂压暗，
           入口保持明亮并出现「在这里，再看王牌菜榜」提示，
           短暂停留后自动消失、亮度恢复
   方案四：与原方案相同的下滑收起；收起后入口播放徽章动画
           （餐盖加冕再掀开，4s），播放完停在最后一帧；
           榜单中心页 icon 默认态改为动画第一帧，衔接无跳变
   各方案共用方案B 的王牌菜榜入场形态（上滑整页/返回箭头），
   首页→榜单中心→王牌菜榜 全链路保持不变
   ============================================================ */
const SCHEMES = [
  { id: "origin", label: "原方案 · 上滑整页（现状）", short: "原方案" },
  { id: "s1", label: "方案一 · 退出时放大+扫光", short: "方案一", note: "【推荐】" },
  { id: "s2", label: "方案二 · 关闭缩回入口", short: "方案二", note: "【会有跟手交互问题】" },
  { id: "s3", label: "方案三 · 聚光灯+引导提示", short: "方案三", note: "【影响操作流程性】" },
  { id: "s4", label: "方案四 · 徽章动画停末帧", short: "方案四" },
];

/* 方案二：面板缩回王牌菜榜入口的目标位（icon 位于榜单中心页 left 9.6% / top 30.6%，宽 10.3%） */
const ACE_EXIT_TRANSFORM = `translate(${(SCREEN_W * 0.096).toFixed(2)}px, ${(SCREEN_H * 0.306).toFixed(2)}px) scale(0.103)`;

/* 各方案共用方案B 的 ace 页形态（上滑整页/返回箭头） */
const aceModeOf = () => "up";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"; /* 快出 + 明显缓收，上滑更利落 */
const EASE_IN_OUT = "cubic-bezier(0.45, 0.05, 0.25, 1)"; /* 缓入缓出，方案二缩回用 */

export default function Index() {
  const [scheme, setScheme] = useState("origin");
  const [screen, setScreen] = useState("home"); // home | center
  const [ace, setAce] = useState("closed"); // closed | open(整页)
  const [aceExit, setAceExit] = useState("none"); // none | zoom(方案二 关闭缩回入口)
  const [spotlightOn, setSpotlightOn] = useState(false); // 方案三：退出后聚光灯引导提示
  const [aceLoaded, setAceLoaded] = useState(false); // 王牌菜榜页是否加载完成
  const [iconBounceKey, setIconBounceKey] = useState(0); // 王牌菜榜 icon 强化动效重放计数（从王牌菜榜返回榜单中心时）
  const [iconAnimArmed, setIconAnimArmed] = useState(false); // 仅退出王牌菜榜后允许 icon 播放动效（进入时不播）
  const [animOn, setAnimOn] = useState(true); // 切换方案瞬间关闭过渡，避免穿帮
  const [bubbleOpen, setBubbleOpen] = useState(false); // 悬浮方案切换气泡展开态
  const [centerEntryKey, setCenterEntryKey] = useState(0); // 切换方案后强制重播榜单中心入场链路
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const iframeRef = useRef(null);
  const schemeRef = useRef(scheme);
  const aceExitTimerRef = useRef(null);
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

  const clearAceExit = () => {
    if (aceExitTimerRef.current) {
      window.clearTimeout(aceExitTimerRef.current);
      aceExitTimerRef.current = null;
    }
    setAceExit("none");
    setSpotlightOn(false);
  };

  const closeAce = useCallback(() => {
    if (schemeRef.current === "s2") {
      // 方案二：全屏王牌菜榜缩小、位移至王牌菜榜入口（缓入缓出）；
      // 缩回即刻入口轻微放大回弹（不等落位）
      setAceExit("zoom");
      setIconBounceKey((k) => k + 1);
      setIconAnimArmed(true);
      aceExitTimerRef.current = window.setTimeout(() => {
        aceExitTimerRef.current = null;
        setAnimOn(false); // 落位后无过渡归位（此时面板已淡出，不可见）
        setAce("closed");
        setAceExit("none");
        window.setTimeout(() => setAnimOn(true), 60);
      }, 500);
      return;
    }
    if (schemeRef.current === "s3") {
      // 方案三：与原方案相同下滑收起；收起后周边压暗、入口保持明亮并出现提示，短暂停留后消失
      setAce("closed");
      aceExitTimerRef.current = window.setTimeout(() => {
        aceExitTimerRef.current = null;
        setSpotlightOn(true);
        aceExitTimerRef.current = window.setTimeout(() => {
          aceExitTimerRef.current = null;
          setSpotlightOn(false);
        }, 2400);
      }, 480);
      return;
    }
    setAce("closed");
    // 王牌菜榜下滑收起后，榜单中心页的王牌菜榜 icon 按当前方案播放强化动效
    // armed 与 key 重放在同一次更新中进行，避免 class 先行导致动效播两次
    window.setTimeout(() => {
      setIconAnimArmed(true);
      setIconBounceKey((k) => k + 1);
    }, 420);
  }, []);

  // 方案三：点击「我知道了」或蒙层提前关闭聚光灯提示
  const dismissSpotlight = useCallback(() => {
    if (aceExitTimerRef.current) {
      window.clearTimeout(aceExitTimerRef.current);
      aceExitTimerRef.current = null;
    }
    setSpotlightOn(false);
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
    clearAceExit();
    setAce("open");
    setIconAnimArmed(false); // 进入王牌菜榜后重置：下次进入榜单中心页 icon 不播动效，退出后才播
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
    clearAceExit();
    setAnimOn(false);
    setScheme(id);
    setAce("closed");
    setScreen("home"); // 切换方案后返回首页，由用户从首页走完整链路
    setIconAnimArmed(false); // 从首页重新进入时 icon 不播动效，退出后才播
    setCenterEntryKey((k) => k + 1);
    window.setTimeout(() => setAnimOn(true), 80);
  };

  // 进入榜单中心页后，王牌菜榜按原链路自动上滑展开（0.65s，与现状一致，全链路不变）
  useEffect(() => {
    if (screen !== "center") return;
    const t = window.setTimeout(
      () => {
        showAce();
      },
      650
    );
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, centerEntryKey]);

  const isAceVisible = ace !== "closed";
  const aceFull = ace === "open";
  const aceExiting = aceExit === "zoom"; // 方案二：面板正在缩回入口

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
        /* 方案一：退出王牌菜榜后 icon 先放大，再播扫光 */
        @keyframes icon-pop {
          0% { transform: scale(1); }
          45% { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        .icon-inner--s1 { animation: icon-pop 0.6s cubic-bezier(0.34, 1.4, 0.64, 1) both; }
        .icon-beam--s1 { animation: icon-beam-sweep 1.6s cubic-bezier(0.45, 0, 0.25, 1) 0.55s both; }
        /* 方案二：面板散开瞬间入口大幅回弹，结束后接一道扫光 */
        @keyframes icon-settle {
          0% { transform: scale(1); }
          40% { transform: scale(1.16); }
          100% { transform: scale(1); }
        }
        .icon-inner--s2 { animation: icon-settle 0.4s cubic-bezier(0.34, 1.4, 0.64, 1) 0.3s both; }
        .icon-beam--s2 { animation: icon-beam-sweep 1.6s cubic-bezier(0.45, 0, 0.25, 1) 0.72s both; }
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
                transition: animOn
                  ? `transform 0.45s ${aceExiting ? EASE_IN_OUT : EASE}, filter 0.45s ${aceExiting ? EASE_IN_OUT : EASE}`
                  : "none",
                transform: aceFull && !aceExiting ? "scale(0.96)" : "none",
                filter: isAceVisible && !aceExiting ? "brightness(0.92)" : "none",
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
                  onClick={() => { setScreen("center"); setIconAnimArmed(false); }}
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
                {/* 王牌菜榜入口 icon：按当前方案播放强化动效（外层不裁切） */}
                <div
                  key={iconBounceKey}
                  className="absolute pointer-events-none"
                  style={{ left: "9.6%", top: "30.6%", width: "10.3%", height: "4.74%" }}
                >
                  <div className={`icon-inner ${iconAnimArmed ? `icon-inner--${scheme}` : ""} absolute inset-0 overflow-hidden`}>
                    <img
                      src={scheme === "s4" && iconAnimArmed ? aceMotionImg : aceIconImg}
                      alt="王牌菜榜"
                      className="w-full h-full"
                      draggable={false}
                    />
                    {iconAnimArmed && scheme === "origin" && <div className="icon-beam icon-beam--origin absolute inset-0" />}
                    {iconAnimArmed && scheme === "s1" && <div className="icon-beam icon-beam--s1 absolute inset-0" />}
                    {iconAnimArmed && scheme === "s2" && <div className="icon-beam icon-beam--s2 absolute inset-0" />}
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

{/* ===== 方案三：聚光灯引导（周边压暗、原入口保持明亮 + 引导提示）===== */}
{scheme === "s3" && (
<div
className="absolute inset-0 z-20 transition-opacity duration-300"
style={{
opacity: spotlightOn ? 1 : 0,
pointerEvents: spotlightOn ? "auto" : "none",
}}
>
{/* 蒙层挖洞：入口区域镂空保持明亮，其余全部压暗（原入口样式不变） */}
<div
className="absolute"
style={{
left: "5.5%",
top: "30.4%",
width: "17%",
height: "8.6%",
borderRadius: 12,
boxShadow: "0 0 0 9999px rgba(17, 17, 17, 0.82)",
}}
onClick={dismissSpotlight}
/>
{/* 引导提示 + 我知道了按钮（仅渐显，无位移） */}
<div
className="absolute"
style={{
left: "25.5%",
top: "30.8%",
opacity: spotlightOn ? 1 : 0,
transition: "opacity 0.25s ease 0.1s",
}}
>
<div style={{ fontSize: 17, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", letterSpacing: 0.5 }}>
在这里，再看<span style={{ color: "#FF6633" }}>「王牌菜榜」</span>
</div>
<button
onClick={dismissSpotlight}
style={{
marginTop: 14,
background: "#fff",
color: "#111",
fontSize: 13,
fontWeight: 600,
borderRadius: 9999,
padding: "7px 22px",
boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
}}
>
我知道了
</button>
</div>
</div>
)}

{/* ===== 王牌菜榜常驻面板（iframe 预加载，仅加载一次）=====
方案二关闭时：整页缩小、位移至王牌菜榜入口并淡出，落位后入口回弹 */}
            <div
              className="absolute left-0 right-0 bottom-0 z-30 overflow-hidden"
              style={{
                height: SCREEN_H,
                background: "#1A1008",
                transform: aceExiting ? ACE_EXIT_TRANSFORM : ace === "closed" ? closedTransform : "translate(0, 0)",
                transition: !animOn
                  ? "none"
                  : aceExiting
                    ? `transform 0.45s ${EASE_IN_OUT}, opacity 0.25s ease 0.08s`
                    : `transform 0.38s ${EASE}`,
                opacity: aceExiting ? 0 : 1,
                transformOrigin: "top left",
                boxShadow: "0 -8px 30px rgba(0,0,0,0.18)",
                pointerEvents: ace === "closed" || aceExiting ? "none" : "auto",
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
              {aceFull && !aceExiting && (
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
            {isAceVisible && !aceExiting && (
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
                      {s.note && (
                        <span
                          className="block"
                          style={{
                            fontSize: 8,
                            marginTop: 1,
                            fontWeight: 400,
                            color: scheme === s.id ? "rgba(255,102,51,0.75)" : "rgba(255,255,255,0.45)",
                          }}
                        >
                          {s.note}
                        </span>
                      )}
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
