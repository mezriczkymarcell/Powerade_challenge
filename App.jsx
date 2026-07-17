import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@supabase/supabase-js";
import {
  Flame, Trophy, Wallet, LayoutDashboard, PlusCircle, Check, ChevronRight,
  LogOut, AlertTriangle, Clock, Camera, X, RefreshCw, Users, UserPlus, ArrowLeft,
  Crown, Settings, User, Target, Zap, Award, TrendingUp, Ban, DoorOpen,
  MessageSquare, Scale, Route, Timer, Beer, Medal, Heart, ChevronLeft, CalendarDays, Eye, EyeOff
} from "lucide-react";

/* ============================================================================
   POWERADE CHALLENGE
   ========================================================================== */

const SUPABASE_URL = "https://ategpcynydszerhioegq.supabase.co";
const SUPABASE_KEY = "sb_publishable_wftKjFv9FXQEe1obFruNxg_kdTdAqnu";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "powerade-auth" },
});

const TOTAL_WEEKS = 13;
const TOTAL_DAYS = TOTAL_WEEKS * 7;
const BASE_GOAL = 4000;
const DEFAULT_PENALTY = 5000;
const penaltyOf = (g) => (g?.penalty_amount ?? DEFAULT_PENALTY);
const goalOf = (u) => u?.custom_goal || BASE_GOAL;

const C = {
  blue: "#007AC1", blueDeep: "#00538A", cyan: "#00E5FF", ink: "#0F172A",
  slate: "#64748B", line: "#E6EBF0", soft: "#F5F9FC",
  danger: "#EF4444", ok: "#10B981", amber: "#F59E0B",
  pink: "#EC4899", gold: "#D4A017", silver: "#94A3B8", bronze: "#B45309",
  purple: "#7C3AED",
};

const DEFAULT_SPORTS = ["Futás", "Bringa", "Kondi", "Úszás"];
const EMOJIS = ["🏃‍♂️","🏃‍♀️","🚴‍♂️","🚴‍♀️","🏋️‍♂️","🏋️‍♀️","🏊‍♂️","🏊‍♀️","⚽","🏀","🎾","🥊","🧗","⛷️","🛹","🤸","🚶‍♂️","🧘","🥇","🔥"];

/* ------------------------------ Dátum-segédek ----------------------------- */
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const TODAY = iso(new Date());
const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 86400000);
const fmtHU = (s) => parse(s).toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
const fmtLong = (s) => parse(s).toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" });
const money = (n) => `${(n || 0).toLocaleString("hu-HU")} Ft`;

const weekDays = (start, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i));
const weekIndexNow = (start) =>
  Math.min(Math.max(Math.floor(diffDays(TODAY, start) / 7), 0), TOTAL_WEEKS - 1);
const remainingPct = (start) => {
  const elapsed = Math.min(Math.max(diffDays(TODAY, start) + 1, 0), TOTAL_DAYS);
  return 1 - elapsed / TOTAL_DAYS;
};
const notStarted = (g) => g.start_date > TODAY;
const daysUntil = (g) => diffDays(g.start_date, TODAY);
const fmtDur = (m) => (!m ? null : m >= 60 ? `${Math.floor(m / 60)} ó ${m % 60 ? `${m % 60} p` : ""}`.trim() : `${m} p`);

/* ============================ HETI ZÁRÓ ALGORITMUS ======================== */
function evaluateWeek(entries, start, weekIndex, goal, penalty) {
  const days = weekDays(start, weekIndex);
  const total = days.reduce((s, d) => s + (entries[d]?.kcal || 0), 0);
  const closed = days[6] < TODAY;
  const started = days[0] <= TODAY;
  let status = "upcoming";
  if (started) {
    if (closed) status = total >= goal ? "passed" : "failed";
    else status = total >= goal ? "onTrack" : "active";
  }
  return { weekIndex, days, total, goal, status, closed, penalty: status === "failed" ? penalty : 0 };
}

function evaluate(user, group) {
  const goal = goalOf(user);
  const start = group.start_date;
  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, w) =>
    evaluateWeek(user.entries, start, w, goal, penaltyOf(group)));
  const penalties = group.penalty_enabled ? weeks.reduce((s, w) => s + w.penalty, 0) : 0;
  const mine = user.payments.filter((p) => p.group_id === group.id);
  const paid = mine.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pending = mine.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const debt = Math.max(penalties - paid - pending, 0);

  let streak = 0;
  let cur = user.entries[TODAY]?.kcal > 0 ? TODAY : addDays(TODAY, -1);
  while (cur >= start && user.entries[cur]?.kcal > 0) { streak++; cur = addDays(cur, -1); }

  const totalKcal = Object.entries(user.entries)
    .filter(([d]) => d >= start && d <= addDays(start, TOTAL_DAYS - 1))
    .reduce((s, [, e]) => s + e.kcal, 0);
  return { goal, weeks, penalties, paid, pending, debt, streak, totalKcal };
}

/* ================================ JELVÉNYEK =============================== */
const BADGES = {
  kcal500:  { label: "500-as", tier: "bronze", icon: "500",  desc: "Egy nap alatt legalább 500 kcal-t égettél." },
  kcal800:  { label: "800-as", tier: "silver", icon: "800",  desc: "Egy nap alatt legalább 800 kcal-t égettél." },
  kcal1000: { label: "Ezres",  tier: "gold",   icon: "1000", desc: "Egy nap alatt átlépted az 1000 kcal-t." },
  firstRun: { label: "Első futás", tier: "blue", icon: "🏃", desc: "Rögzítetted az első futásod." },
  firstSwim:{ label: "Első úszás", tier: "cyan", icon: "🏊", desc: "Rögzítetted az első úszásod." },
  hour1:    { label: "1 óra",  tier: "bronze", icon: "1h", desc: "Egyhuzamban legalább 1 órát sportoltál." },
  hour2:    { label: "2 óra",  tier: "silver", icon: "2h", desc: "Egyhuzamban legalább 2 órát sportoltál." },
  hour3:    { label: "3 óra",  tier: "gold",   icon: "3h", desc: "Egyhuzamban legalább 3 órát sportoltál. Respect." },
  halfway:  { label: "Félidő", tier: "purple", icon: "½",  desc: "Túljutottál a kihívás felén (7. hét)." },
  beerKing: { label: "Beer King", tier: "amber", icon: "🍺", desc: "Ezen a héten te ittad a legtöbb sört a csapatban." },
  champion: { label: "Bajnok", tier: "champion", icon: "🏆", desc: "Megnyertél egy teljes Powerade Challenge-et. Legenda.", big: true },
};

const TIERS = {
  gold:     ["#FFE28A", "#D4A017", "#8A6508"],
  silver:   ["#F1F5F9", "#94A3B8", "#556070"],
  bronze:   ["#F0C79A", "#B45309", "#7A3806"],
  blue:     ["#7FD3FF", "#007AC1", "#00436E"],
  cyan:     ["#AEF6FF", "#00C2DB", "#00727F"],
  purple:   ["#C9B0FF", "#7C3AED", "#4A1D96"],
  amber:    ["#FFE1A3", "#F59E0B", "#93610A"],
  champion: ["#FFF3C4", "#E0A800", "#7A5A00"],
};

/** Egy jelvény: olimpiai érem hatású, gradienses SVG korong. */
function Badge({ code, size = 56, onClick, dim = false }) {
  const b = BADGES[code];
  if (!b) return null;
  const [lite, mid, dark] = TIERS[b.tier] || TIERS.silver;
  const id = `bg-${code}-${size}`;
  const isEmoji = /\p{Extended_Pictographic}/u.test(b.icon);

  return (
    <button onClick={onClick} title={b.label} type="button"
      className="relative transition active:scale-90"
      style={{ width: size, height: size, opacity: dim ? 0.28 : 1, filter: dim ? "grayscale(1)" : "none" }}>
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={lite} />
            <stop offset="45%" stopColor={mid} />
            <stop offset="100%" stopColor={dark} />
          </linearGradient>
          <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.65" />
            <stop offset="45%" stopColor="#fff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {/* szalag */}
        <path d="M22 2 L32 20 L42 2 Z" fill={dark} opacity="0.55" />
        {/* érem */}
        <circle cx="32" cy="38" r="23" fill={`url(#${id})`} />
        <circle cx="32" cy="38" r="23" fill={`url(#${id}-sheen)`} />
        <circle cx="32" cy="38" r="23" fill="none" stroke={dark} strokeWidth="1.5" opacity="0.55" />
        <circle cx="32" cy="38" r="18" fill="none" stroke="#fff" strokeWidth="1" opacity="0.45" />
        {/* recézés */}
        {Array.from({ length: 28 }).map((_, i) => {
          const a = (i / 28) * Math.PI * 2;
          return <circle key={i} cx={32 + Math.cos(a) * 21.5} cy={38 + Math.sin(a) * 21.5} r="0.7"
            fill="#fff" opacity="0.35" />;
        })}
        <text x="32" y={isEmoji ? 45 : 44} textAnchor="middle"
          fontSize={isEmoji ? 20 : b.icon.length >= 4 ? 13 : b.icon.length === 3 ? 15 : 17}
          fontWeight="900" fill="#fff"
          style={{ paintOrder: "stroke", stroke: dark, strokeWidth: 0.8 }}>
          {b.icon}
        </text>
      </svg>
    </button>
  );
}

/** Kiszámolja, milyen jelvények járnak a felhasználónak ebben a csoportban. */
function earnedBadges(user, group, allMembers) {
  const out = [];
  const start = group.start_date;
  const end = addDays(start, TOTAL_DAYS - 1);
  const days = Object.values(user.entries).filter((d) => d.date >= start && d.date <= end);
  const items = days.flatMap((d) => d.items);

  const bestDay = days.reduce((m, d) => Math.max(m, d.kcal), 0);
  if (bestDay >= 500) out.push("kcal500");
  if (bestDay >= 800) out.push("kcal800");
  if (bestDay >= 1000) out.push("kcal1000");

  const has = (re) => items.some((i) => re.test((i.sport || "").toLowerCase()));
  if (has(/fut|run/)) out.push("firstRun");
  if (has(/úsz|usz|swim/)) out.push("firstSwim");

  const maxMin = items.reduce((m, i) => Math.max(m, i.duration_min || 0), 0);
  if (maxMin >= 60) out.push("hour1");
  if (maxMin >= 120) out.push("hour2");
  if (maxMin >= 180) out.push("hour3");

  if (!notStarted(group) && weekIndexNow(start) >= 6) out.push("halfway");

  // Beer King: a héten a legtöbb sör (min. 1)
  const cw = weekIndexNow(start);
  const wd = weekDays(start, cw);
  const beersOf = (u) => wd.reduce((s, d) => s + (u.beers?.[d] || 0), 0);
  const mine = beersOf(user);
  if (mine > 0 && allMembers.every((m) => m.id === user.id || beersOf(m) < mine)) out.push("beerKing");

  // Bajnok: lezárult kihívás, ő az első
  if (TODAY > end) {
    const totals = allMembers.map((m) => ({ id: m.id, k: evaluate(m, group).totalKcal }));
    const top = totals.sort((a, b) => b.k - a.k)[0];
    if (top && top.id === user.id && top.k > 0) out.push("champion");
  }
  return out;
}

/* ============================== UI primitívek ============================== */
const Card = ({ children, className = "", style = {}, ...p }) => (
  <div className={`rounded-2xl bg-white ${className}`}
    style={{ border: `1px solid ${C.line}`, boxShadow: "0 1px 2px rgba(15,23,42,.04)", ...style }} {...p}>
    {children}
  </div>
);

const Button = ({ variant = "primary", className = "", style = {}, ...p }) => {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-95 disabled:opacity-40 disabled:active:scale-100";
  const styles = {
    primary: { background: C.blue, color: "#fff" },
    ghost: { background: "#fff", color: C.ink, border: `1px solid ${C.line}` },
    soft: { background: C.soft, color: C.blueDeep },
    danger: { background: "#fff", color: C.danger, border: `1px solid ${C.danger}33` },
  }[variant];
  return <button className={`${base} ${className}`} style={{ ...styles, ...style }} {...p} />;
};

const Pill = ({ tone = "slate", children }) => {
  const t = { ok: C.ok, danger: C.danger, amber: C.amber, blue: C.blue, slate: C.slate, pink: C.pink }[tone];
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold"
    style={{ color: t, background: `${t}14` }}>{children}</span>;
};

const SectionTitle = ({ children, right }) => (
  <div className="mb-3 flex items-center justify-between gap-2">
    <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: C.slate }}>{children}</h2>
    {right}
  </div>
);

const Field = ({ label, hint, ...p }) => (
  <div>
    {label && <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>{label}</label>}
    <input className="w-full rounded-xl px-4 py-3 text-base outline-none"
      style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} {...p} />
    {hint && <p className="mt-1 text-xs" style={{ color: C.slate }}>{hint}</p>}
  </div>
);

const Toggle = ({ on, onChange }) => (
  <button onClick={() => onChange(!on)} type="button" className="relative h-7 w-12 shrink-0 rounded-full transition"
    style={{ background: on ? C.blue : C.line }}>
    <span className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: on ? 26 : 4 }} />
  </button>
);

const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";

/* Névből/azonosítóból stabil, kellemes szín — timeline-csipeszekhez. */
const USER_HUES = [210, 262, 330, 16, 42, 152, 190, 288, 4, 128];
const userColor = (u) => {
  const key = (u?.id || u?.name || "").toString();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const hue = USER_HUES[h % USER_HUES.length];
  return { bg: `hsl(${hue} 85% 96%)`, fg: `hsl(${hue} 60% 38%)`, ring: `hsl(${hue} 70% 55%)` };
};

/** Profilkép: emoji + monogram. A keret színe a nemet jelzi. */
const Avatar = ({ user, size = 40, badge = true }) => {
  const ring = user?.gender === "female" ? C.pink : C.blue;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, background: C.soft, fontSize: size * 0.48,
        border: `2.5px solid ${ring}`, boxSizing: "border-box" }}
      title={user?.name}>
      {user?.emoji}
      {badge && (
        <span className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center rounded-md px-1 font-black"
          style={{ background: C.ink, color: "#fff", fontSize: Math.max(8, size * 0.24),
            lineHeight: 1.5, border: "1.5px solid #fff" }}>
          {initials(user?.name)}
        </span>
      )}
    </span>
  );
};

const EmojiPicker = ({ value, onChange }) => (
  <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
    {EMOJIS.map((e) => (
      <button key={e} type="button" onClick={() => onChange(e)}
        className="flex aspect-square items-center justify-center rounded-xl text-2xl transition active:scale-90"
        style={{ background: value === e ? `${C.blue}12` : C.soft, border: `2px solid ${value === e ? C.blue : "transparent"}` }}>
        {e}
      </button>
    ))}
  </div>
);

/* ============================ VITAMIN SZALAG ============================= */
const Ticker = () => {
  const items = Array.from({ length: 8 });
  return (
    <div className="w-full overflow-hidden" style={{ background: C.ink }}>
      <style>{`
        @keyframes pcMarquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div className="flex items-center whitespace-nowrap py-2"
        style={{ width: "max-content", animation: "pcMarquee 34s linear infinite" }}>
        {/* kétszer egymás után, hogy a hurok varrat nélküli legyen */}
        {[0, 1].map((half) => (
          <div key={half} className="flex items-center">
            {items.map((_, i) => (
              <span key={i}
                className="inline-flex items-center gap-1.5 px-8 text-xs font-bold leading-none tracking-wide"
                style={{ color: "#E2E8F0" }}>
                Ne felejtsd el bevenni a vitaminjaidat
                <span className="inline-flex items-center text-sm leading-none">💊</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ================================= LOGÓ ================================== */
const Logo = ({ size = "sm" }) => {
  const big = size === "lg";
  return (
    <div className="leading-none">
      <p className={`font-black tracking-tight ${big ? "text-lg" : "text-sm"}`} style={{ color: C.ink }}>
        POWERADE
      </p>
      <p className={`font-black tracking-tight ${big ? "text-lg" : "text-sm"}`} style={{ color: C.blue }}>
        CHALLENGE
      </p>
    </div>
  );
};

/* =============================== KONFETTI ================================ */
function Confetti({ onDone }) {
  const bits = useMemo(() => Array.from({ length: 90 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    dur: 2 + Math.random() * 1.6,
    size: 6 + Math.random() * 8,
    rot: Math.random() * 360,
    color: [C.blue, C.cyan, C.amber, C.ok, "#fff", C.pink][Math.floor(Math.random() * 6)],
  })), []);

  useEffect(() => { const t = setTimeout(onDone, 4200); return () => clearTimeout(t); }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <style>{`
        @keyframes pcFall {
          0%   { transform: translateY(-12vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0.9; }
        }
      `}</style>
      {bits.map((b) => (
        <span key={b.id} className="absolute top-0"
          style={{
            left: `${b.left}%`, width: b.size, height: b.size * 0.5,
            background: b.color, borderRadius: 1,
            transform: `rotate(${b.rot}deg)`,
            animation: `pcFall ${b.dur}s cubic-bezier(.25,.6,.4,1) ${b.delay}s forwards`,
            boxShadow: "0 1px 2px rgba(0,0,0,.08)",
          }} />
      ))}
    </div>
  );
}

const WinBanner = ({ onClose }) => (
  <div className="fixed inset-0 z-[61] flex items-center justify-center px-5"
    style={{ background: "rgba(15,23,42,.55)" }} onClick={onClose}>
    <Card className="w-full max-w-xs overflow-hidden p-0 text-center" onClick={(e) => e.stopPropagation()}
      style={{ boxShadow: "0 24px 60px rgba(0,0,0,.35)" }}>
      <style>{`
        @keyframes trophyPop { 0%{transform:scale(.4) rotate(-12deg);opacity:0} 60%{transform:scale(1.12) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0)} }
        @keyframes trophyShine { 0%,88%,100%{opacity:0} 94%{opacity:.9} }
        @keyframes trophyFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>
      <div className="flex items-center justify-center py-8"
        style={{ background: `linear-gradient(135deg, ${C.blueDeep}, ${C.blue})` }}>
        <div style={{ animation: "trophyPop 700ms cubic-bezier(.2,1.4,.4,1)" }}>
          <div style={{ animation: "trophyFloat 2.4s ease-in-out infinite" }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
              <defs>
                <linearGradient id="cupG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFE9A0" /><stop offset="55%" stopColor="#E8B923" /><stop offset="100%" stopColor="#A97C05" />
                </linearGradient>
              </defs>
              {/* fülek */}
              <path d="M30 34 q-16 0 -16 16 q0 14 18 16" fill="none" stroke="url(#cupG)" strokeWidth="6" />
              <path d="M80 34 q16 0 16 16 q0 14 -18 16" fill="none" stroke="url(#cupG)" strokeWidth="6" />
              {/* kehely */}
              <path d="M30 26 h50 v14 q0 26 -25 30 q-25 -4 -25 -30 z" fill="url(#cupG)" />
              <path d="M30 26 h50 v6 h-50 z" fill="#fff" opacity="0.35" />
              {/* csillag */}
              <path d="M55 38 l3.5 8 8.5 .6 -6.5 5.5 2 8.4 -7.5 -4.6 -7.5 4.6 2 -8.4 -6.5 -5.5 8.5 -.6z" fill="#fff" opacity="0.55" />
              {/* nyak + talp */}
              <rect x="50" y="70" width="10" height="14" fill="url(#cupG)" />
              <rect x="38" y="84" width="34" height="8" rx="2" fill="url(#cupG)" />
              <rect x="32" y="92" width="46" height="8" rx="3" fill="#C9A227" />
              {/* villanás */}
              <path d="M44 34 l6 -3 0 3z" fill="#fff" style={{ animation: "trophyShine 3s linear infinite" }} />
            </svg>
          </div>
        </div>
      </div>
      <div className="p-6">
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: C.amber }}>Gratulálunk!</p>
        <p className="mt-2 text-xl font-black" style={{ color: C.ink }}>Teljesítetted a hét kihívását!</p>
        <p className="mt-1 text-sm" style={{ color: C.slate }}>Megvan a heti kalóriacél. Így tovább! 💪</p>
        <Button className="mt-5 w-full py-3.5 text-base" onClick={onClose}>Zárás</Button>
      </div>
    </Card>
  </div>
);

/* ========================= A POWERADE PALACK (SVG) ========================= */
function PoweradeBottle({ pct, daysLeft, beforeStart }) {
  const TOP = 96, BOT = 288;              // a folyadék tere a palack testében
  const p = Math.max(0, Math.min(1, pct));
  const level = TOP + (BOT - TOP) * (1 - p);
  const [pops, setPops] = useState([]);
  const [drops, setDrops] = useState([]);
  const [squish, setSquish] = useState(false);
  const n = useRef(0);

  const pop = () => {
    const id = ++n.current;
    const drift = (Math.random() - 0.5) * 130;
    const rot = (Math.random() - 0.5) * 26;
    setPops((s) => [...s, { id, drift, rot }]);

    // kifröccsenő cseppek a szopókából
    const splash = Array.from({ length: 12 }, (_, i) => ({
      id: `${id}-${i}`,
      dx: (Math.random() - 0.5) * 190,
      dy: -40 - Math.random() * 110,
      size: 5 + Math.random() * 8,
      dur: 0.7 + Math.random() * 0.5,
      delay: Math.random() * 0.08,
    }));
    setDrops((s) => [...s, ...splash]);

    setSquish(true);
    setTimeout(() => setSquish(false), 260);
    setTimeout(() => setPops((s) => s.filter((x) => x.id !== id)), 1500);
    setTimeout(() => setDrops((s) => s.filter((d) => !d.id.startsWith(`${id}-`))), 1400);
  };

  /* A palack teste: keskeny nyak, széles váll, derékban behúzott, lekerekített alj. */
  const BOTTLE =
    "M63 46 h24 v10 c0 7 5 9 12 16 c9 9 21 26 21 46 " +
    "v58 c0 7 -5 11 -5 18 c0 7 5 11 5 18 v58 " +
    "c0 15 -12 25 -25 25 h-40 c-13 0 -25 -10 -25 -25 " +
    "v-58 c0 -7 5 -11 5 -18 c0 -7 -5 -11 -5 -18 v-58 " +
    "c0 -20 12 -37 21 -46 c7 -7 12 -9 12 -16 z";

  return (
    <div className="relative flex flex-col items-center">
      <style>{`
        @keyframes pcFly {
          0%   { opacity: 0; transform: translate(-50%, 0) scale(.7) rotate(0deg); }
          15%  { opacity: 1; transform: translate(-50%, -18px) scale(1.06) rotate(var(--r)); }
          100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), -160px) scale(.9) rotate(var(--r)); }
        }
        @keyframes pcDrop {
          0%   { opacity: 0; transform: translate(-50%, 0) scale(.4); }
          20%  { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), var(--dy)) scale(1); }
        }
        @keyframes pcSquish {
          0%   { transform: scale(1, 1); }
          30%  { transform: scale(1.06, .92); }
          60%  { transform: scale(.96, 1.05); }
          100% { transform: scale(1, 1); }
        }
        .pc-bottle:focus, .pc-bottle:focus-visible { outline: none; }
        .pc-bottle { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {drops.map((d) => (
        <span key={d.id} className="pointer-events-none absolute left-1/2 top-4 z-10 rounded-full"
          style={{
            width: d.size, height: d.size * 1.25,
            background: `linear-gradient(180deg, #7FE7FF, ${C.blue})`,
            borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
            "--dx": `${d.dx}px`, "--dy": `${d.dy}px`,
            animation: `pcDrop ${d.dur}s cubic-bezier(.2,.6,.4,1) ${d.delay}s forwards`,
          }} />
      ))}

      {pops.map((x) => (
        <span key={x.id}
          className="pointer-events-none absolute left-1/2 top-2 z-10 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-black shadow-lg"
          style={{ background: C.ink, color: C.cyan, "--dx": `${x.drift}px`, "--r": `${x.rot}deg`,
            animation: "pcFly 1.5s cubic-bezier(.2,.7,.3,1) forwards" }}>
          Szopókás poverád
        </span>
      ))}

      <svg width="160" height="330" viewBox="0 0 150 320" onClick={pop}
        className="pc-bottle cursor-pointer select-none"
        style={{
          outline: "none", WebkitTapHighlightColor: "transparent",
          transformOrigin: "50% 90%",
          animation: squish ? "pcSquish 260ms cubic-bezier(.3,1.2,.4,1)" : "none",
        }}>
        <defs>
          <clipPath id="bottleInner"><path d={BOTTLE} /></clipPath>
          <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5FE0FF" />
            <stop offset="45%" stopColor={C.blue} />
            <stop offset="100%" stopColor={C.blueDeep} />
          </linearGradient>
          <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="18%" stopColor="#fff" stopOpacity="0.06" />
            <stop offset="72%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id="capG" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3A3F45" />
            <stop offset="30%" stopColor="#15181C" />
            <stop offset="75%" stopColor="#2A2F35" />
            <stop offset="100%" stopColor="#0C0E11" />
          </linearGradient>
        </defs>

        {/* ---- SZOPÓKA (sportkupak) ---- */}
        <rect x="67" y="2" width="16" height="7" rx="3" fill="#E8EDF2" />
        <path d="M68 9 h14 l-2 12 h-10 z" fill="#F4F7FA" />
        <rect x="65" y="20" width="20" height="6" rx="2" fill="#C9D2DA" />

        {/* ---- FEKETE CSAVAROS KUPAK ---- */}
        <rect x="55" y="25" width="40" height="23" rx="5" fill="url(#capG)" />
        {Array.from({ length: 9 }).map((_, i) => (
          <rect key={i} x={58 + i * 4.2} y="28" width="1.4" height="17" fill="#fff" opacity="0.09" />
        ))}
        <rect x="55" y="25" width="40" height="4" rx="2" fill="#fff" opacity="0.12" />

        {/* ---- PALACK ---- */}
        <path d={BOTTLE} fill="#EEF4F8" />

        {/* folyadék */}
        <g clipPath="url(#bottleInner)">
          <g style={{ transition: "transform 1200ms cubic-bezier(.2,.8,.2,1)", transform: `translateY(${level - TOP}px)` }}>
            <path d={`M-40 ${TOP} q 25 -8 50 0 t 50 0 t 50 0 t 50 0 t 50 0 V 330 H -40 Z`} fill="url(#liquid)">
              <animateTransform attributeName="transform" type="translate"
                values="0 0; 50 0; 0 0" dur="4.5s" repeatCount="indefinite" />
            </path>
          </g>

          {/* markolat-bordák */}
          {[196, 206, 216].map((y) => (
            <path key={y} d={`M22 ${y} q 53 7 106 0`} fill="none" stroke="#fff" strokeWidth="1.6" opacity="0.16" />
          ))}
          {/* villám-mintás dombornyomás */}
          <path d="M52 236 l14 -22 l-6 20 l14 -18 l-8 24 l12 -14 l-10 22"
            fill="none" stroke="#fff" strokeWidth="2.4" opacity="0.2" strokeLinecap="round" />
          {/* üveg fénytörés */}
          <rect x="0" y="0" width="150" height="320" fill="url(#glass)" />
        </g>

        {/* kontúr */}
        <path d={BOTTLE} fill="none" stroke="#D3DEE6" strokeWidth="2" />

        {/* ---- FEKETE CÍMKE ---- */}
        <path d="M28 104 h94 v46 h-94 z" fill="#0B0E12" />
        <path d="M28 104 h94 v7 h-94 z" fill={C.blue} opacity="0.9" />
        <text x="75" y="109.5" textAnchor="middle" fontSize="4.6" fontWeight="800" fill="#fff" letterSpacing="0.4">
          HOZD KI MAGADBÓL A LEGJOBBAT
        </text>
        <text x="75" y="131" textAnchor="middle" fontSize="17" fontWeight="900" fill="#fff" letterSpacing="0.5"
          style={{ fontStretch: "condensed" }}>
          POWERADE
        </text>
        <text x="75" y="144" textAnchor="middle" fontSize="8" fontWeight="800" fill={C.cyan} letterSpacing="1.2">
          {beforeStart ? "KÉSZÜLJ" : p <= 0 ? "LEJÁRT" : `${daysLeft} NAP`}
        </text>

        {/* alsó dombornyomott felirat */}
        <text x="75" y="282" textAnchor="middle" fontSize="10" fontWeight="900"
          fill="#fff" opacity="0.22" letterSpacing="1">POWERADE</text>
      </svg>

      <p className="mt-1 text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>
        {beforeStart ? "Még nem indult" : p <= 0 ? "A kihívás véget ért" : `${Math.round(p * 100)}% van hátra`}
      </p>
      <p className="mt-2 max-w-xs text-center text-xs leading-relaxed" style={{ color: C.slate }}>
        Minden nap fogy egy korty a Powerade-ból. A cél, hogy a 13 hét alatt megigyuk az egészet.
      </p>
    </div>
  );
}

/* ============================== SÖR WIDGET =============================== */
const PeroniBottle = ({ size = 22 }) => (
  <svg width={size} height={size * 2.4} viewBox="0 0 24 58">
    <defs>
      <linearGradient id="peroniGlass" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#1F5E38" />
        <stop offset="35%" stopColor="#37A05F" />
        <stop offset="65%" stopColor="#1F5E38" />
        <stop offset="100%" stopColor="#123C24" />
      </linearGradient>
    </defs>
    <rect x="9" y="1" width="6" height="5" rx="1" fill="#C8A24A" />
    <path d="M9 6 h6 v6 c0 3 3 5 3 10 v30 c0 3 -2 5 -5 5 h-2 c-3 0 -5 -2 -5 -5 v-30 c0 -5 3 -7 3 -10 z"
      fill="url(#peroniGlass)" />
    <rect x="6" y="30" width="12" height="14" rx="1.5" fill="#F4F1E8" />
    <rect x="6" y="33" width="12" height="2" fill="#1E4FA0" />
    <rect x="6" y="39" width="12" height="2" fill="#D22630" />
    <rect x="10.5" y="9" width="1.6" height="42" fill="#fff" opacity="0.22" />
  </svg>
);

function BeerWidget({ me, onSet, toast }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(TODAY);
  const [busy, setBusy] = useState(false);
  const count = me.beers?.[date] || 0;
  const isPast = date < TODAY;

  const set = async (n) => {
    if (n < 0 || n > 30 || busy) return;
    setBusy(true);
    await onSet(date, n);
    setBusy(false);
    if (n > count) toast(n >= 6 ? "Na jó, ezt már edzésnek számoljuk. 🍻" : "Feljegyezve. 🍺", "ok");
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} style={{ background: "rgba(15,23,42,.35)" }} />
      )}

      <div className="fixed bottom-28 right-4 z-50 md:bottom-8">
        {open && (
          <Card className="mb-3 w-64 p-5" style={{ boxShadow: "0 12px 40px rgba(15,23,42,.18)" }}>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-sm font-black" style={{ color: C.ink }}>Sörszámláló</p>
                <p className="text-xs" style={{ color: C.slate }}>Csak a becsület kedvéért.</p>
              </div>
              <button onClick={() => setOpen(false)}><X size={16} style={{ color: C.slate }} /></button>
            </div>

            <input type="date" value={date} max={TODAY} onChange={(e) => e.target.value && setDate(e.target.value)}
              className="mb-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: C.soft, border: `1px solid ${isPast ? C.amber : C.line}`, color: C.ink }} />
            <div className="mb-2 flex gap-1.5">
              {[[TODAY, "Ma"], [addDays(TODAY, -1), "Tegnap"]].map(([d, l]) => (
                <button key={d} onClick={() => setDate(d)}
                  className="flex-1 rounded-lg py-1.5 text-xs font-bold transition"
                  style={{ background: date === d ? `${C.amber}1A` : C.soft, color: date === d ? C.amber : C.slate }}>
                  {l}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4 py-2">
              <button onClick={() => set(count - 1)} disabled={count === 0}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-xl font-black disabled:opacity-30"
                style={{ background: C.soft, color: C.ink }}>−</button>

              <div className="flex flex-col items-center">
                <PeroniBottle size={26} />
                <span className="mt-1 text-2xl font-black tabular-nums" style={{ color: C.ink }}>{count}</span>
              </div>

              <button onClick={() => set(count + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-xl font-black"
                style={{ background: `${C.amber}1A`, color: C.amber }}>+</button>
            </div>

            <p className="mt-2 text-center text-xs" style={{ color: C.slate }}>
              0,33-as üvegben mérve. {isPast ? `${fmtHU(date)} — korábbi nap.` : "Nem számít bele semmibe. Vagy mégis?"}
            </p>
          </Card>
        )}

        <button onClick={() => setOpen((s) => !s)}
          className="relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition active:scale-90"
          style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          <PeroniBottle size={16} />
          {(me.beers?.[TODAY] || 0) > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-black text-white"
              style={{ background: C.amber }}>{me.beers[TODAY]}</span>
          )}
        </button>
      </div>
    </>
  );
}

/* ========================= Regisztráltak száma ============================ */
const UserCounter = ({ count, className = "" }) => {
  if (!count) return null;
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${className}`}
      style={{ background: C.soft, border: `1px solid ${C.line}` }}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${C.blue}12` }}>
        <Users size={17} style={{ color: C.blue }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>
          Eddig ennyien versenyeztek
        </p>
        <p className="text-sm font-black" style={{ color: C.ink }}>
          <span className="text-lg tabular-nums" style={{ color: C.blue }}>{count.toLocaleString("hu-HU")}</span>{" "}
          {count === 1 ? "sportoló" : "sportoló"} a Powerade Challenge-ben
        </p>
      </div>
    </div>
  );
};

/* ================================ Belépés ================================= */
function AuthScreen({ userCount }) {
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [emoji, setEmoji] = useState("🏃‍♂️");
  const [gender, setGender] = useState("male");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMsg(null); setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) throw new Error("Add meg a neved, hogy lássanak a ranglistán.");
        if (pw.length < 6) throw new Error("A jelszó legalább 6 karakter legyen.");
        const { error } = await supabase.auth.signUp({
          email: email.trim(), password: pw,
          options: { data: { name: name.trim(), emoji, gender } },
        });
        if (error) throw error;
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      } else {
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error("Adj meg egy érvényes e-mail-címet.");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) throw error;
        setMsg({ tone: "ok", text: "Elküldtük a levelet. Nézd meg a postaládád (a spam mappát is)." });
      }
    } catch (e) {
      setMsg({ tone: "danger", text: e.message === "Invalid login credentials" ? "Hibás e-mail vagy jelszó." : e.message });
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen px-5 py-10" style={{ background: "#fff" }}>
      <div className="mx-auto flex w-full max-w-md flex-col">
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest"
            style={{ background: `${C.cyan}22`, color: C.blueDeep }}>
            <Flame size={14} /> 3 hónap · 13 hét
          </div>
          <h1 className="text-4xl font-black leading-none tracking-tight" style={{ color: C.ink }}>
            POWERADE<br /><span style={{ color: C.blue }}>CHALLENGE</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: C.slate }}>
            Egy hét, egy cél. Nem kell minden nap edzeni — a 7 napos ciklus végéig kell összejönnie.
          </p>
          <div className="mt-4 rounded-xl p-4" style={{ background: C.soft }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Alap heti cél</p>
            <p className="text-2xl font-black tabular-nums" style={{ color: C.blue }}>
              {BASE_GOAL.toLocaleString("hu-HU")}<span className="text-sm font-bold" style={{ color: C.slate }}> kcal</span>
            </p>
            <p className="mt-1 text-xs" style={{ color: C.slate }}>
              Ez az alapérték mindenkinek. A profilodban bármikor egyedire állíthatod.
            </p>
          </div>
        </div>

        {mode !== "forgot" && (
          <div className="mb-5 flex gap-1 rounded-xl p-1" style={{ background: C.soft }}>
            {[["signup", "Regisztráció"], ["login", "Belépés"]].map(([k, l]) => (
              <button key={k} onClick={() => { setMode(k); setMsg(null); }}
                className="flex-1 rounded-lg py-2.5 text-sm font-bold transition"
                style={{ background: mode === k ? "#fff" : "transparent", color: mode === k ? C.blue : C.slate,
                  boxShadow: mode === k ? "0 1px 3px rgba(15,23,42,.08)" : "none" }}>
                {l}
              </button>
            ))}
          </div>
        )}

        {mode === "forgot" && (
          <div className="mb-5">
            <button onClick={() => { setMode("login"); setMsg(null); }}
              className="mb-3 inline-flex items-center gap-1 text-sm font-bold" style={{ color: C.blue }}>
              <ArrowLeft size={14} /> Vissza a belépéshez
            </button>
            <p className="text-sm" style={{ color: C.slate }}>
              Add meg az e-mail-címed, és küldünk egy linket, amivel új jelszót állíthatsz be.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {mode === "signup" && <Field label="Név" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kis Márton" />}
          <Field label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="te@pelda.hu" />
          {mode !== "forgot" && (
            <Field label="Jelszó" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
              placeholder="legalább 6 karakter" onKeyDown={(e) => e.key === "Enter" && submit()} />
          )}

          {mode === "login" && (
            <button onClick={() => { setMode("forgot"); setMsg(null); }} className="text-sm font-bold" style={{ color: C.blue }}>
              Elfelejtettem a jelszavam
            </button>
          )}

          {mode === "signup" && (
            <>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Nem</label>
                <div className="flex gap-2">
                  {[["male", "Férfi", C.blue], ["female", "Nő", C.pink]].map(([g, l, col]) => {
                    const on = gender === g;
                    return (
                      <button key={g} type="button" onClick={() => setGender(g)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 transition active:scale-95"
                        style={{ background: on ? `${col}0F` : C.soft, border: `2px solid ${on ? col : "transparent"}` }}>
                        <span className="h-3 w-3 rounded-full" style={{ background: col }} />
                        <p className="text-sm font-bold" style={{ color: on ? col : C.ink }}>{l}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs" style={{ color: C.slate }}>Ez csak a profilképed keretének színét adja.</p>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Profilkép</label>
                <EmojiPicker value={emoji} onChange={setEmoji} />
              </div>
            </>
          )}

          {msg && <p className="text-sm font-medium" style={{ color: msg.tone === "ok" ? C.ok : C.danger }}>{msg.text}</p>}

          <Button onClick={submit} disabled={busy} className="w-full py-4 text-base">
            {busy ? "Egy pillanat…" : mode === "signup" ? "Regisztrálok" : mode === "login" ? "Belépés" : "Levelet kérek"}
            {!busy && <ChevronRight size={18} />}
          </Button>

          <UserCounter count={userCount} className="mt-2" />
        </div>
      </div>
    </div>
  );
}

/* ========================= Új jelszó (e-mailes link) ====================== */
function ResetPassword({ onDone }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (pw.length < 6) return setErr("A jelszó legalább 6 karakter legyen.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    onDone();
  };

  return (
    <div className="flex min-h-screen items-center px-5" style={{ background: "#fff" }}>
      <div className="mx-auto w-full max-w-md">
        <h1 className="mb-2 text-2xl font-black" style={{ color: C.ink }}>Új jelszó</h1>
        <p className="mb-5 text-sm" style={{ color: C.slate }}>Add meg az új jelszavad, és már lépünk is be.</p>
        <div className="space-y-4">
          <Field label="Új jelszó" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
            placeholder="legalább 6 karakter" onKeyDown={(e) => e.key === "Enter" && save()} />
          {err && <p className="text-sm font-medium" style={{ color: C.danger }}>{err}</p>}
          <Button onClick={save} disabled={busy} className="w-full py-4 text-base">
            {busy ? "Mentés…" : "Mentés és belépés"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============================ Profil szerkesztése ========================= */
function ProfileScreen({ me, onBack, onSave, onPassword, toast }) {
  const [name, setName] = useState(me.name);
  const [emoji, setEmoji] = useState(me.emoji);
  const [gender, setGender] = useState(me.gender);
  const [customOn, setCustomOn] = useState(!!me.custom_goal);
  const [custom, setCustom] = useState(me.custom_goal ? String(me.custom_goal) : "");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast("A név nem lehet üres.", "danger");
    const cg = customOn ? parseInt(custom, 10) : null;
    if (customOn && (!cg || cg < 500)) return toast("Adj meg egy értelmes heti célt (min. 500 kcal).", "danger");
    setBusy(true);
    const ok = await onSave({ name: name.trim(), emoji, gender, custom_goal: cg });
    setBusy(false);
    if (ok) toast("Profil mentve.", "ok");
  };

  const changePw = async () => {
    if (pw.length < 6) return toast("A jelszó legalább 6 karakter legyen.", "danger");
    const ok = await onPassword(pw);
    if (ok) { setPw(""); toast("Jelszó megváltoztatva.", "ok"); }
  };

  return (
    <div className="min-h-screen px-5 py-8" style={{ background: "#fff" }}>
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: C.blue }}>
          <ArrowLeft size={16} /> Vissza
        </button>

        <Card className="p-6">
          <SectionTitle>Profil</SectionTitle>
          <div className="space-y-4">
            <Field label="Név" value={name} onChange={(e) => setName(e.target.value)} />
            <Field label="E-mail" value={me.email} disabled hint="Az e-mail-cím nem módosítható." />

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Profilkép</label>
              <EmojiPicker value={emoji} onChange={setEmoji} />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Nem</label>
              <div className="flex gap-2">
                {[["male", "Férfi", C.blue], ["female", "Nő", C.pink]].map(([g, l, col]) => {
                  const on = gender === g;
                  return (
                    <button key={g} type="button" onClick={() => setGender(g)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 transition active:scale-95"
                      style={{ background: on ? `${col}0F` : C.soft, border: `2px solid ${on ? col : "transparent"}` }}>
                      <span className="h-3 w-3 rounded-full" style={{ background: col }} />
                      <p className="text-sm font-bold" style={{ color: on ? col : C.ink }}>{l}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: C.soft }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold" style={{ color: C.ink }}>Egyedi heti cél</p>
                  <p className="text-xs" style={{ color: C.slate }}>
                    Alapértelmezés: {BASE_GOAL.toLocaleString("hu-HU")} kcal.
                  </p>
                </div>
                <Toggle on={customOn} onChange={setCustomOn} />
              </div>
              {customOn && (
                <div className="mt-3">
                  <Field type="number" inputMode="numeric" value={custom} placeholder="pl. 3000"
                    onChange={(e) => setCustom(e.target.value)} />
                </div>
              )}
            </div>

            <Button onClick={save} disabled={busy} className="w-full py-4 text-base">
              {busy ? "Mentés…" : "Profil mentése"}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle>Jelszó módosítása</SectionTitle>
          <div className="flex gap-2">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Új jelszó"
              className="flex-1 rounded-xl px-4 py-3 text-base outline-none"
              style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
            <Button onClick={changePw}>Módosítás</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* =========================== Csoportválasztó képernyő ===================== */
function GroupsScreen({ me, groups, invites, userCount, onOpen, onCreate, onAccept, onDecline, onSignOut, onProfile, toast }) {
  const [creating, setCreating] = useState(false);
  const [gname, setGname] = useState("");
  const [gstart, setGstart] = useState(TODAY);
  const [gpenalty, setGpenalty] = useState(true);
  const [gamount, setGamount] = useState(String(DEFAULT_PENALTY));
  const [ggoal, setGgoal] = useState("");
  const [emails, setEmails] = useState([]);
  const [emailIn, setEmailIn] = useState("");
  const [busy, setBusy] = useState(false);

  const addEmail = () => {
    const e = emailIn.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return toast("Ez nem érvényes e-mail-cím.", "danger");
    if (e === me.email.toLowerCase()) return toast("Magadat nem kell meghívnod.", "danger");
    if (emails.includes(e)) return toast("Ez a cím már a listán van.", "danger");
    setEmails((s) => [...s, e]); setEmailIn("");
  };

  const create = async () => {
    if (!gname.trim()) return toast("Adj nevet a csoportnak.", "danger");
    const amt = gpenalty ? parseInt(gamount, 10) : DEFAULT_PENALTY;
    if (gpenalty && (!amt || amt < 100)) return toast("Adj meg egy értelmes büntetést (min. 100 Ft).", "danger");
    setBusy(true);
    const ok = await onCreate({
      name: gname.trim(), start_date: gstart,
      penalty_enabled: gpenalty, penalty_amount: amt, goal_text: ggoal.trim() || null,
    }, emails);
    setBusy(false);
    if (ok) {
      setGname(""); setGgoal(""); setEmails([]); setCreating(false);
      toast(emails.length ? `Csoport létrehozva, ${emails.length} meghívó kiment.` : "Csoport létrehozva.", "ok");
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#fff" }}>
      <Ticker />
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Logo size="lg" />
          <div className="flex gap-1">
            <button onClick={onProfile} className="p-1" title="Profil"><Avatar user={me} size={36} /></button>
            <button onClick={onSignOut} className="rounded-lg p-2" title="Kilépés">
              <LogOut size={18} style={{ color: C.slate }} />
            </button>
          </div>
        </div>

        <Card className="mb-6 flex items-center gap-4 p-5">
          <Avatar user={me} size={52} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-black" style={{ color: C.ink }}>{me.name}</p>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.blue }}>
              Heti cél: {goalOf(me).toLocaleString("hu-HU")} kcal
            </p>
          </div>
          <Button variant="ghost" onClick={onProfile}><Settings size={16} /></Button>
        </Card>

        {invites.length > 0 && (
          <div className="mb-6">
            <SectionTitle>Meghívásaid</SectionTitle>
            <div className="space-y-2">
              {invites.map((i) => (
                <Card key={i.id} className="p-4" style={{ border: `2px solid ${C.blue}`, background: `${C.cyan}08` }}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${C.cyan}22` }}>
                      <UserPlus size={18} style={{ color: C.blueDeep }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-black" style={{ color: C.ink }}>{i.group_name}</p>
                      <p className="text-xs font-semibold" style={{ color: C.slate }}>Meghívtak ebbe a csoportba</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => onAccept(i)} className="flex-1"><Check size={16} /> Elfogadom</Button>
                    <Button variant="danger" onClick={() => onDecline(i)}>Elutasítom</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <SectionTitle right={!creating && <Button variant="soft" onClick={() => setCreating(true)}><PlusCircle size={16} /> Új csoport</Button>}>
          Csoportjaim
        </SectionTitle>

        {creating && (
          <Card className="mb-4 space-y-4 p-5">
            <Field label="Csoport neve" value={gname} autoFocus placeholder="pl. Vértessomló brigád"
              onChange={(e) => setGname(e.target.value)} />
            <div>
              <Field label="A kihívás első napja" type="date" value={gstart}
                onChange={(e) => e.target.value && setGstart(e.target.value)} />
              <p className="mt-1 text-xs" style={{ color: C.slate }}>
                Bármelyik nap lehet. A hetek innentől <b>7 napos ciklusok</b>.
                <br />Vége: <b>{fmtLong(addDays(gstart, TOTAL_DAYS - 1))}</b>
              </p>
            </div>

            <div className="rounded-xl p-4" style={{ background: C.soft }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold" style={{ color: C.ink }}>Pénzbüntetés</p>
                  <p className="text-xs" style={{ color: C.slate }}>Bukott hetenként fizetni kell a közös kasszába.</p>
                </div>
                <Toggle on={gpenalty} onChange={setGpenalty} />
              </div>
              {gpenalty && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Összeg (Ft / bukott hét)</label>
                  <input type="number" inputMode="numeric" value={gamount} onChange={(e) => setGamount(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-base font-black tabular-nums outline-none"
                    style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.ink }} />
                </div>
              )}
            </div>

            {gpenalty && (
              <Field label="Erre költjük az összegyűlt pénzt" value={ggoal} placeholder="pl. Közös hétvége Bükkben"
                onChange={(e) => setGgoal(e.target.value)} />
            )}

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Meghívók (e-mail)</label>
              {emails.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {emails.map((e) => (
                    <span key={e} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
                      style={{ background: `${C.blue}12`, color: C.blueDeep }}>
                      {e}
                      <button onClick={() => setEmails((s) => s.filter((x) => x !== e))}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input value={emailIn} onChange={(e) => setEmailIn(e.target.value)} placeholder="haver@pelda.hu"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                  className="flex-1 rounded-xl px-4 py-3 text-base outline-none"
                  style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
                <Button variant="ghost" onClick={addEmail}><UserPlus size={16} /></Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={create} disabled={busy} className="flex-1">{busy ? "Létrehozás…" : "Létrehozom"}</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>Mégse</Button>
            </div>
          </Card>
        )}

        {groups.length === 0 && !creating ? (
          <Card className="p-10 text-center">
            <Users size={28} className="mx-auto mb-3" style={{ color: C.line }} />
            <p className="text-sm font-bold" style={{ color: C.ink }}>Még nem vagy egyetlen csoportban sem.</p>
            <p className="mx-auto mt-1 max-w-xs text-sm" style={{ color: C.slate }}>
              Hozz létre egyet, vagy kérd meg a haverokat, hogy hívjanak meg erre a címre: {me.email}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => {
              const pre = notStarted(g);
              const wk = weekIndexNow(g.start_date) + 1;
              const pool = g.members.flatMap((m) => m.payments)
                .filter((p) => p.group_id === g.id && p.status === "paid")
                .reduce((s, p) => s + p.amount, 0);
              const groupKcal = g.members.reduce((sum, m) => sum + evaluate(m, g).totalKcal, 0);
              return (
                <Card key={g.id} className="cursor-pointer p-5 transition hover:opacity-90" onClick={() => onOpen(g.id)}>
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-lg font-black" style={{ color: C.ink }}>{g.name}</p>
                    {g.owner_id === me.id && <Crown size={14} style={{ color: C.amber }} />}
                    {!g.penalty_enabled && <Pill tone="slate"><Ban size={11} /> tét nélkül</Pill>}
                  </div>
                  <p className="mt-0.5 text-xs font-semibold" style={{ color: pre ? C.amber : C.slate }}>
                    {pre ? `Indulásig ${daysUntil(g)} nap · ` : ""}{g.members.length} tag
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.slate }}>
                    <CalendarDays size={12} className="shrink-0" />
                    {fmtLong(g.start_date)} → {fmtLong(addDays(g.start_date, TOTAL_DAYS - 1))}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    {g.members.slice(0, 8).map((m) => <Avatar key={m.id} user={m} size={34} />)}
                    {g.members.length > 8 && <span className="text-xs font-bold" style={{ color: C.slate }}>+{g.members.length - 8}</span>}
                  </div>

                  <div className="mt-4">
                    {/* 13 hét, szegmensekre bontva */}
                    <div className="flex gap-1">
                      {Array.from({ length: TOTAL_WEEKS }).map((_, i) => {
                        const done = !pre && i < wk - 1;
                        const current = !pre && i === wk - 1;
                        return (
                          <div key={i} className="h-2.5 flex-1 rounded-full"
                            title={`${i + 1}. hét`}
                            style={{
                              background: current ? C.cyan : done ? C.blue : C.soft,
                              border: `1px solid ${current ? C.cyan : done ? C.blue : C.line}`,
                            }} />
                        );
                      })}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: C.slate }}>
                        {pre ? "Még nem indult" : `${wk}. hét / ${TOTAL_WEEKS}`}
                      </span>
                      <span className="text-xs font-black tabular-nums" style={{ color: C.blue }}>
                        {groupKcal.toLocaleString("hu-HU")} kcal
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: C.line }}>
                      <span className="text-xs font-semibold" style={{ color: C.slate }}>
                        {g.penalty_enabled ? <>Kassza: <b style={{ color: C.ink }}>{money(pool)}</b></> : "Nincs pénzbüntetés"}
                      </span>
                      <ChevronRight size={16} style={{ color: C.slate }} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <UserCounter count={userCount} className="mt-6" />
      </div>
    </div>
  );
}

/* ============================ Heti köríves mutató ========================= */
/* Nagy köríves haladásmutató a kezdőlap tetejére. */
function HeroRing({ pct, done, children }) {
  const R = 96, CIRC = 2 * Math.PI * R, p = Math.min(Math.max(pct, 0), 1);
  return (
    <div className="relative flex items-center justify-center" style={{ width: 224, height: 224 }}>
      <svg width="224" height="224" viewBox="0 0 224 224" className="-rotate-90">
        <defs>
          <linearGradient id="heroRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={C.blue} /><stop offset="100%" stopColor={C.cyan} />
          </linearGradient>
        </defs>
        <circle cx="112" cy="112" r={R} fill="none" stroke={C.soft} strokeWidth="18" />
        <circle cx="112" cy="112" r={R} fill="none" stroke={done ? C.ok : "url(#heroRing)"} strokeWidth="18"
          strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - p)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute flex flex-col items-center text-center">{children}</div>
    </div>
  );
}

function WeeklyRing({ kcal, goal }) {
  const pct = Math.min(kcal / goal, 1);
  const R = 62, CIRC = 2 * Math.PI * R;
  return (
    <div className="relative flex items-center justify-center">
      <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={C.blue} /><stop offset="100%" stopColor={C.cyan} />
          </linearGradient>
        </defs>
        <circle cx="80" cy="80" r={R} fill="none" stroke={C.soft} strokeWidth="14" />
        <circle cx="80" cy="80" r={R} fill="none" stroke={pct >= 1 ? C.ok : "url(#ring)"} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-black tabular-nums" style={{ color: C.ink }}>{kcal.toLocaleString("hu-HU")}</span>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>/ {goal} kcal</span>
      </div>
    </div>
  );
}

/* ============================ 3 hónapos naptár ============================= */
function ThreeMonthGrid({ entries, weeks, cw, goal, onPick }) {
  const GOAL = goal || BASE_GOAL;
  return (
    <div className="space-y-2.5">
      {weeks.map((w) => {
        const doneWeek = w.total >= GOAL && w.status !== "upcoming";
        // a hét eddig meglévő összege + a maradék napokra elosztott átlag
        const past = w.days.filter((d) => d <= TODAY);
        const future = w.days.filter((d) => d > TODAY);
        const missing = Math.max(GOAL - w.total, 0);
        const perFuture = future.length > 0 ? Math.ceil(missing / future.length) : 0;
        const isCurrentOrFuture = w.days[6] >= TODAY;

        return (
          <div key={w.weekIndex} className="rounded-2xl p-2.5"
            style={{
              background: doneWeek ? `${C.ok}0E` : w.weekIndex === cw ? `${C.blue}08` : "transparent",
              border: `1.5px solid ${doneWeek ? C.ok : w.weekIndex === cw ? `${C.blue}30` : "transparent"}`,
            }}>
            <div className="mb-1.5 flex items-center justify-between px-0.5">
              <span className="text-xs font-black tabular-nums"
                style={{ color: doneWeek ? C.ok : w.weekIndex === cw ? C.blue : C.slate }}>
                {w.weekIndex + 1}. hét
                {doneWeek && <Check size={12} strokeWidth={3} className="ml-1 inline" style={{ color: C.ok }} />}
              </span>
              <span className="text-xs font-bold tabular-nums" style={{ color: doneWeek ? C.ok : C.slate }}>
                {w.status === "upcoming" ? "—" : `${w.total.toLocaleString("hu-HU")} / ${GOAL.toLocaleString("hu-HU")}`}
              </span>
            </div>

            <div className="flex gap-1">
              {w.days.map((d) => {
                const k = entries[d]?.kcal || 0;
                const isFuture = d > TODAY;
                const dayNum = new Date(d).getDate();

                // múltbeli/mai nap: tényleges kcal, szín az érték szerint
                // jövőbeli nap ebben a hétben: világos cella a szükséges átlaggal
                let bg, fg, val;
                if (!isFuture) {
                  val = k > 0 ? k : "";
                  bg = k >= 700 ? C.blue : k >= 400 ? "#4FA8DA" : k > 0 ? "#8FCAEA" : C.soft;
                  fg = k >= 400 ? "#fff" : k > 0 ? C.blueDeep : C.slate;
                } else if (isCurrentOrFuture && perFuture > 0) {
                  val = perFuture;
                  bg = `${C.blue}0C`;
                  fg = C.blue;
                } else {
                  val = "";
                  bg = "#fff";
                  fg = C.slate;
                }

                return (
                  <button key={d} title={`${fmtHU(d)} — ${k} kcal`} disabled={isFuture || !onPick}
                    onClick={() => onPick?.(d)}
                    className="flex h-11 flex-1 flex-col items-center justify-center rounded-lg transition hover:opacity-80"
                    style={{ background: bg, border: isFuture ? `1px dashed ${C.line}` : "none" }}>
                    <span className="text-[9px] font-bold leading-none opacity-60" style={{ color: fg }}>{dayNum}</span>
                    <span className="mt-0.5 text-[10px] font-black leading-none tabular-nums" style={{ color: fg }}>
                      {val}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {onPick && (
        <p className="pt-1 text-xs" style={{ color: C.slate }}>
          A számok az aznap elégetett kcal-t mutatják. A halványkék cellák azt jelzik, naponta mennyi kell még a hét teljesítéséhez. Kattints egy múltbeli napra a pótláshoz.
        </p>
      )}
    </div>
  );
}

/* ============================ Kép + nagyítás ============================== */
function PhotoThumb({ url, size = 52, className = "" }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`shrink-0 overflow-hidden rounded-xl transition active:scale-95 ${className}`}
        style={{ width: size, height: size, border: `1px solid ${C.line}`, background: C.soft }}>
        <img src={url} alt="igazolás" className="h-full w-full object-cover" />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 2147483647, background: "rgba(15,23,42,.88)", animation: "pcFade 180ms ease-out" }}
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <style>{`
            @keyframes pcFade { from { opacity: 0 } to { opacity: 1 } }
            @keyframes pcZoom {
              from { opacity: 0; transform: scale(.9) }
              to   { opacity: 1; transform: scale(1) }
            }
          `}</style>
          <img src={url} alt="igazolás"
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            style={{ animation: "pcZoom 220ms cubic-bezier(.2,.9,.3,1)" }}
            onClick={(e) => e.stopPropagation()} />
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="absolute right-5 top-5 rounded-full p-2.5" style={{ background: "rgba(255,255,255,.16)" }}>
            <X size={22} className="text-white" />
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

/* ===================== Egy aktivitás (listaelem) ========================== */
const ActivityRow = ({ it, onDelete }) => (
  <div className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ border: `1px solid ${C.line}` }}>
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${C.blue}12` }}>
      <Flame size={15} style={{ color: C.blue }} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold" style={{ color: C.ink }}>{it.sport}</p>

      {(it.duration_min || it.distance_km) && (
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          {it.duration_min > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: C.blueDeep }}>
              <Timer size={11} /> {fmtDur(it.duration_min)}
            </span>
          )}
          {it.distance_km > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: C.blueDeep }}>
              <Route size={11} /> {Number(it.distance_km)} km
            </span>
          )}
        </div>
      )}

      {it.note && (
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: C.slate }}>
          <MessageSquare size={10} className="shrink-0" /> {it.note}
        </p>
      )}
    </div>
    <PhotoThumb url={it.proof_url} size={44} />
    <span className="shrink-0 text-sm font-black tabular-nums" style={{ color: C.blue }}>{it.kcal}</span>
    {onDelete && (
      <button onClick={() => onDelete(it.id)} className="shrink-0 rounded-lg p-1.5" title="Törlés">
        <X size={15} style={{ color: C.slate }} />
      </button>
    )}
  </div>
);

/* ==================== A NAP KIRÁLYA / HERCEGNŐJE ========================= */
function KingOfTheDay({ group }) {
  const [drinking, setDrinking] = useState(false);
  const [burps, setBurps] = useState([]);
  const n = useRef(0);

  const king = useMemo(() => {
    let best = null;
    group.members.forEach((u) => {
      const k = u.entries[TODAY]?.kcal || 0;
      if (k > 0 && (!best || k > best.kcal)) best = { user: u, kcal: k };
    });
    return best;
  }, [group]);

  const drink = () => {
    if (drinking) return;
    setDrinking(true);
    const id = ++n.current;
    setTimeout(() => {
      setBurps((s) => [...s, id]);
      setTimeout(() => setBurps((s) => s.filter((x) => x !== id)), 1200);
    }, 900);
    setTimeout(() => setDrinking(false), 1700);
  };

  const empty = !king;
  const queen = !empty && king.user.gender === "female";

  const bg = empty
    ? "linear-gradient(120deg, #EEF2F7, #F7FAFC)"
    : queen
      ? "linear-gradient(120deg, #4A0D3F 0%, #7A1550 55%, #C42A6B 100%)"
      : "linear-gradient(120deg, #1B1246 0%, #3B1D6E 55%, #6D28D9 100%)";
  const accent = queen ? "#FFD1E8" : "#FFD466";
  const rayCol = queen ? "#FF9ECF" : "#FFD466";

  return (
    <Card className="relative overflow-hidden p-4" style={{ border: "none", background: bg }}>
      {!empty && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-20" viewBox="0 0 400 120" preserveAspectRatio="none">
          {Array.from({ length: 9 }).map((_, i) => (
            <path key={i} d={`M60 60 L400 ${-40 + i * 30} L400 ${-20 + i * 30} Z`} fill={rayCol} opacity="0.35" />
          ))}
        </svg>
      )}

      <div className="relative flex items-center gap-3">
        <button onClick={drink} className="shrink-0 select-none"
          style={{ outline: "none", WebkitTapHighlightColor: "transparent", cursor: empty ? "default" : "pointer" }}>
          <style>{`
            @keyframes kingBob   { 0%,100% { transform: translateY(0) }   50% { transform: translateY(-3px) } }
            @keyframes capeSway  { 0%,100% { transform: rotate(-2.5deg) } 50% { transform: rotate(2.5deg) } }
            @keyframes crownGlint{ 0%,92%,100% { opacity: 0 } 96% { opacity: .95 } }
            @keyframes gulpUp    { 0% { opacity: 0; transform: translateY(0) scale(.6) }
                                   30% { opacity: 1 }
                                   100% { opacity: 0; transform: translateY(-26px) scale(1.15) } }
          `}</style>

          <svg width="86" height="112" viewBox="0 0 120 150">
            <defs>
              <linearGradient id="goldG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFE9A0" /><stop offset="55%" stopColor="#E8B923" /><stop offset="100%" stopColor="#A97C05" />
              </linearGradient>
              <linearGradient id="capeG" x1="0" y1="0" x2="1" y2="1">
                {queen
                  ? <><stop offset="0%" stopColor="#FF7FB8" /><stop offset="100%" stopColor="#B5185F" /></>
                  : <><stop offset="0%" stopColor="#E23A3A" /><stop offset="100%" stopColor="#8E0F1E" /></>}
              </linearGradient>
              <linearGradient id="tunicG" x1="0" y1="0" x2="0" y2="1">
                {queen
                  ? <><stop offset="0%" stopColor="#FFC2DE" /><stop offset="100%" stopColor="#E0559A" /></>
                  : <><stop offset="0%" stopColor="#2F6FE0" /><stop offset="100%" stopColor="#123C87" /></>}
              </linearGradient>
              <linearGradient id="bottleG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7FE7FF" /><stop offset="100%" stopColor="#0166A8" />
              </linearGradient>
            </defs>

            <g style={{ animation: empty ? "none" : "kingBob 2.8s ease-in-out infinite" }}>
              {/* PALÁST / SZOKNYA */}
              <g style={{ transformOrigin: "60px 62px", animation: empty ? "none" : "capeSway 3.4s ease-in-out infinite" }}>
                {queen ? (
                  <>
                    <path d="M42 62 C24 88 16 118 18 138 L102 138 C104 118 96 88 78 62 Z" fill="url(#capeG)" />
                    <path d="M18 138 q10 -6 21 0 q10 -6 21 0 q10 -6 21 0 q10 -6 21 0 l0 4 -84 0 z" fill="#fff" opacity="0.55" />
                    {[30, 50, 70, 90].map((x) => <circle key={x} cx={x} cy="126" r="1.8" fill="#fff" opacity="0.6" />)}
                  </>
                ) : (
                  <>
                    <path d="M40 62 C22 84 18 116 24 138 L96 138 C102 116 98 84 80 62 Z" fill="url(#capeG)" />
                    <path d="M24 138 q9 -7 18 0 q9 -7 18 0 q9 -7 18 0 q9 -7 18 0 l0 4 -72 0 z" fill="#fff" opacity="0.9" />
                    {[34, 52, 70, 88].map((x) => <circle key={x} cx={x} cy="132" r="1.6" fill="#111" opacity="0.55" />)}
                  </>
                )}
              </g>

              {/* TÖRZS */}
              <path d="M44 62 h32 c4 18 4 40 2 56 h-36 c-2 -16 -2 -38 2 -56 z" fill="url(#tunicG)" />
              <path d="M52 62 l8 14 l8 -14 z" fill="#fff" opacity="0.25" />
              <rect x="42" y="98" width="36" height="7" rx="2" fill="url(#goldG)" />
              <rect x="56" y="97" width="8" height="9" rx="1.5" fill={queen ? "#D6337F" : "#B9860B"} />

              {/* BAL KAR */}
              <path d="M44 68 c-9 5 -12 16 -10 26 l7 2 c0 -9 2 -17 7 -22 z" fill={queen ? "#E884B4" : "#2A5FC4"} />
              <circle cx="38" cy="97" r="5" fill="#F2C9A0" />

              {/* HAJ (hercegnő: hosszú) */}
              {queen && (
                <>
                  <path d="M42 40 c-4 20 -2 36 2 44 l8 -2 c-4 -12 -5 -26 -3 -40 z" fill="#7A4A22" />
                  <path d="M78 40 c4 20 2 36 -2 44 l-8 -2 c4 -12 5 -26 3 -40 z" fill="#7A4A22" />
                </>
              )}

              {/* FEJ */}
              <circle cx="60" cy="42" r="15" fill="#F5D0A9" />
              <path d="M45 40 a15 15 0 0 1 30 0 z" fill={queen ? "#8A5527" : "#5B3A1E"} opacity={queen ? 0.95 : 0.25} />
              <circle cx="54" cy="42" r="1.8" fill="#2B2118" />
              <circle cx="66" cy="42" r="1.8" fill="#2B2118" />
              {queen && (
                <>
                  <path d="M50 39 q4 -2 7 0" stroke="#2B2118" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                  <path d="M63 39 q4 -2 7 0" stroke="#2B2118" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                </>
              )}
              <circle cx="49" cy="47" r="3.2" fill="#F58AA8" opacity={queen ? 0.7 : 0.5} />
              <circle cx="71" cy="47" r="3.2" fill="#F58AA8" opacity={queen ? 0.7 : 0.5} />

              {drinking
                ? <ellipse cx="60" cy="51" rx="3.2" ry="3.8" fill={queen ? "#C2185B" : "#8A3B3B"} />
                : <path d="M54 50 q6 5 12 0" stroke={queen ? "#C2185B" : "#8A3B3B"} strokeWidth="1.8" fill="none" strokeLinecap="round" />}

              {/* SZAKÁLL (csak király) */}
              {!queen && <path d="M47 48 q13 22 26 0 q-4 16 -13 17 q-9 -1 -13 -17 z" fill="#fff" opacity="0.92" />}

              {/* KORONA / TIARA */}
              {queen ? (
                <>
                  <path d="M46 30 q14 -14 28 0 z" fill="url(#goldG)" />
                  <path d="M46 30 q7 -12 14 -12 q7 0 14 12 z" fill="url(#goldG)" />
                  <circle cx="60" cy="19" r="3.2" fill="#FF5FA2" />
                  <circle cx="51" cy="25" r="1.8" fill="#7FE7FF" />
                  <circle cx="69" cy="25" r="1.8" fill="#7FE7FF" />
                  <rect x="45" y="29" width="30" height="4.5" rx="2" fill="url(#goldG)" />
                  <path d="M54 30 l6 -3 l0 3 z" fill="#fff" opacity="0.85"
                    style={{ animation: empty ? "none" : "crownGlint 3.6s linear infinite" }} />
                </>
              ) : (
                <>
                  <path d="M43 28 l5 -13 l7 8 l5 -12 l5 12 l7 -8 l5 13 z" fill="url(#goldG)" />
                  <rect x="43" y="27" width="34" height="6" rx="2" fill="url(#goldG)" />
                  <circle cx="48" cy="15" r="2.4" fill="#E23A3A" />
                  <circle cx="60" cy="12" r="2.8" fill="#3BC9DB" />
                  <circle cx="72" cy="15" r="2.4" fill="#E23A3A" />
                  <path d="M52 30 l6 -3 l0 3 z" fill="#fff" opacity="0.8"
                    style={{ animation: empty ? "none" : "crownGlint 3.6s linear infinite" }} />
                </>
              )}

              {/* JOBB KAR + POWERADE-JOGAR */}
              <g style={{
                transformOrigin: "76px 68px",
                transform: drinking ? "rotate(-104deg)" : "rotate(0deg)",
                transition: "transform 650ms cubic-bezier(.3,1.1,.4,1)",
              }}>
                <path d="M76 68 c10 4 14 14 13 24 l-7 2 c0 -9 -2 -16 -8 -20 z" fill={queen ? "#E884B4" : "#2A5FC4"} />
                <circle cx="86" cy="94" r="5" fill="#F2C9A0" />
                <g style={{
                  transformOrigin: "88px 84px",
                  transform: drinking ? "rotate(38deg)" : "rotate(0deg)",
                  transition: "transform 650ms cubic-bezier(.3,1.1,.4,1)",
                }}>
                  <rect x="84" y="60" width="9" height="4" rx="1.5" fill="#F0F4F7" />
                  <rect x="83" y="63" width="11" height="5" rx="1.5" fill="#15181C" />
                  <path d="M84 68 h9 c2 5 2 20 1 24 h-11 c-1 -4 -1 -19 1 -24 z" fill="url(#bottleG)" />
                  <rect x="83" y="74" width="11" height="7" fill="#0B0E12" />
                  <text x="88.5" y="79.5" textAnchor="middle" fontSize="3.4" fontWeight="900" fill="#fff">P</text>
                </g>
              </g>

              {burps.map((id) => (
                <g key={id}>
                  {[0, 1, 2].map((i) => (
                    <circle key={i} cx={70 + i * 5} cy={40 - i * 3} r={2 + i * 0.6} fill={C.cyan}
                      style={{ animation: `gulpUp 1.1s ease-out ${i * 0.14}s forwards` }} />
                  ))}
                </g>
              ))}
            </g>
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: empty ? C.slate : accent }}>
            {empty ? "A nap királya" : queen ? "A nap hercegnője" : "A nap királya"}
          </p>

          {empty ? (
            <>
              <p className="mt-1 text-base font-black" style={{ color: C.ink }}>Még nincs trónkövetelő</p>
              <p className="text-xs font-semibold" style={{ color: C.slate }}>
                Ma még senki nem vitt fel edzést. A korona szabad.
              </p>
            </>
          ) : (
            <>
              <div className="mt-1 flex items-center gap-2">
                <Avatar user={king.user} size={30} badge={false} />
                <p className="min-w-0 flex-1 truncate text-lg font-black leading-tight text-white">
                  {king.user.name}
                </p>
              </div>
              <p className="mt-1 text-sm font-black" style={{ color: accent }}>
                {king.kcal.toLocaleString("hu-HU")} kcal ma
              </p>
              <p className="mt-0.5 text-xs font-semibold text-white opacity-60">
                {drinking ? "Kortyol egyet a jogarából…" : "Koppints rá, hadd igyon!"}
              </p>
            </>
          )}
        </div>

      </div>
    </Card>
  );
}

/* ============================== IDŐVONAL ================================= */
const relTime = (ts) => {
  if (!ts) return "";
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "most";
  if (diff < 3600) return `${Math.floor(diff / 60)} perce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} órája`;
  if (diff < 172800) return "tegnap";
  const d = Math.floor(diff / 86400);
  if (d < 7) return `${d} napja`;
  return new Date(ts).toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
};

function FeedItem({ item, likes, meId, members, onLike }) {
  const mine = likes.some((l) => l.user_id === meId);
  const count = likes.length;
  const u = item.user;
  const likers = (members
    ? likes.map((l) => members.find((m) => m.id === l.user_id)).filter(Boolean)
    : []);

  const head = {
    entry: <>edzett — <b style={{ color: C.ink }}>{item.sport}</b></>,
    weight: <>lemérte magát</>,
    beer: <>ivott {item.count} sört 🍺</>,
  }[item.type];

  const tone = { entry: C.blue, weight: C.purple, beer: C.amber }[item.type];
  const Icon = { entry: Flame, weight: Scale, beer: Beer }[item.type];
  const uc = userColor(u);

  const showPhoto = item.photo && !(item.type === "weight" && u.hide_weight);
  const bigValue =
    item.type === "entry" ? `${item.kcal.toLocaleString("hu-HU")}`
    : item.type === "weight" ? (u.hide_weight ? null : `${Number(item.kg)}`)
    : `${item.count}`;
  const bigUnit = item.type === "entry" ? "kcal" : item.type === "weight" ? "kg" : "sör 🍺";

  return (
    <div className="flex items-stretch gap-3 py-4" style={{ borderTop: `1px solid ${C.line}` }}>
      {/* NAGY FOTÓ balra (ha van) */}
      {showPhoto ? (
        <PhotoThumb url={item.photo} size={88} className="self-center" />
      ) : (
        <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center self-center rounded-2xl"
          style={{ background: `${tone}12` }}>
          <Icon size={30} style={{ color: tone }} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {/* NAGY érték */}
        <div className="flex items-baseline gap-1.5">
          {bigValue != null ? (
            <>
              <span className="text-3xl font-black leading-none tabular-nums"
                style={{ color: item.type === "beer" ? C.amber : item.type === "weight" ? C.ink : C.blue }}>
                {bigValue}
              </span>
              <span className="text-sm font-bold" style={{ color: C.slate }}>{bigUnit}</span>
            </>
          ) : (
            <span className="text-lg font-black" style={{ color: C.ink }}>Mérés</span>
          )}
          {item.type === "weight" && item.delta != null && item.delta !== 0 && (
            <Pill tone={item.delta < 0 ? "ok" : "danger"}>{item.delta > 0 ? "+" : ""}{item.delta.toFixed(1)} kg</Pill>
          )}
        </div>

        {/* sportág + idő/táv */}
        {item.type === "entry" && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="text-sm font-bold" style={{ color: C.ink }}>{item.sport}</span>
            {item.duration_min > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: C.slate }}>
                <Timer size={11} /> {fmtDur(item.duration_min)}
              </span>
            )}
            {item.distance_km > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: C.slate }}>
                <Route size={11} /> {Number(item.distance_km)} km
              </span>
            )}
          </div>
        )}

        {item.note && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: C.slate }}>
            <MessageSquare size={10} className="shrink-0" /> {item.note}
          </p>
        )}

        {/* másodlagos: színes név-csipesz + idő */}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5"
            style={{ background: uc.bg }}>
            <Avatar user={u} size={20} badge={false} />
            <span className="truncate text-xs font-black" style={{ color: uc.fg }}>{u.name}</span>
          </span>
          <span className="shrink-0 text-xs font-semibold" style={{ color: C.slate }}>{relTime(item.ts)}</span>
        </div>
      </div>

      {/* Szív + kik lájkolták */}
      <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 self-center">
        <button onClick={() => onLike(item)}
          className="flex h-10 w-10 items-center justify-center rounded-full transition active:scale-90"
          style={{ background: mine ? `${C.danger}14` : C.soft }}>
          <Heart size={20} strokeWidth={2.5}
            style={{ color: mine ? C.danger : C.slate, fill: mine ? C.danger : "transparent" }} />
        </button>
        {likers.length > 0 && (
          <div className="flex items-center">
            {likers.slice(0, 3).map((lu, idx) => (
              <span key={lu.id} className="inline-flex items-center justify-center rounded-full"
                style={{ width: 20, height: 20, marginLeft: idx === 0 ? 0 : -7, zIndex: 3 - idx,
                  background: C.soft, fontSize: 11, border: "1.5px solid #fff" }} title={lu.name}>
                {lu.emoji}
              </span>
            ))}
            {count > 3 && (
              <span className="ml-1 text-xs font-black tabular-nums" style={{ color: C.slate }}>+{count - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Feed({ group, meId, likes, onLike }) {
  const [anchor, setAnchor] = useState(TODAY);           // a felül mutatott nap
  const prevDay = addDays(anchor, -1);
  const minDate = group.start_date;

  const byDate = useMemo(() => {
    const out = {};
    const push = (d, item) => { (out[d] = out[d] || []).push(item); };

    group.members.forEach((u) => {
      Object.values(u.entries).forEach((day) => day.items.forEach((it) => push(it.date, {
        type: "entry", id: it.id, user: u, ts: it.created_at, date: it.date,
        sport: it.sport, kcal: it.kcal, duration_min: it.duration_min,
        distance_km: it.distance_km, note: it.note, photo: it.proof_url,
      })));

      const ws = (u.weights || []).slice().sort((a, b) => a.date.localeCompare(b.date));
      ws.forEach((w, i) => push(w.date, {
        type: "weight", id: w.id, user: u, ts: w.created_at, date: w.date,
        kg: Number(w.kg), delta: i > 0 ? Number(w.kg) - Number(ws[0].kg) : null,
        photo: w.photo_url,
      }));

      (u.beerRows || []).forEach((b) => { if (b.count > 0) push(b.date, {
        type: "beer", id: b.id, user: u, ts: b.created_at, date: b.date, count: b.count,
      }); });
    });

    Object.values(out).forEach((list) =>
      list.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0)));
    return out;
  }, [group]);

  const label = (d) =>
    d === TODAY ? "Ma" :
    d === addDays(TODAY, -1) ? "Tegnap" :
    parse(d).toLocaleDateString("hu-HU", { weekday: "long", month: "short", day: "numeric" });

  const canBack = prevDay > minDate;
  const canFwd = anchor < TODAY;

  const DayBlock = ({ d, dim }) => {
    const items = byDate[d] || [];
    if (d < minDate) return null;
    return (
      <div className={dim ? "opacity-95" : ""}>
        <div className="sticky top-0 z-10 -mx-1 mb-1 flex items-center gap-2 bg-white/90 px-1 py-2 backdrop-blur">
          <span className="h-2 w-2 rounded-full" style={{ background: d === TODAY ? C.blue : C.line }} />
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: d === TODAY ? C.blue : C.slate }}>
            {label(d)}
          </p>
          <span className="text-xs font-semibold" style={{ color: C.slate }}>· {fmtHU(d)}</span>
          <div className="h-px flex-1" style={{ background: C.line }} />
          <span className="text-xs font-bold tabular-nums" style={{ color: C.slate }}>
            {items.length} esemény
          </span>
        </div>

        {items.length === 0 ? (
          <p className="py-5 text-center text-sm font-semibold" style={{ color: C.line }}>
            Ezen a napon csend volt.
          </p>
        ) : (
          items.map((it) => (
            <FeedItem key={`${it.type}-${it.id}`} item={it} meId={meId}
              likes={likes.filter((l) => l.target_type === it.type && l.target_id === it.id)}
              members={group.members}
              onLike={onLike} />
          ))
        )}
      </div>
    );
  };

  return (
    <Card className="p-6">
      <SectionTitle right={
        anchor !== TODAY && (
          <button onClick={() => setAnchor(TODAY)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition active:scale-95"
            style={{ background: `${C.blue}0F`, color: C.blue }}>
            <CalendarDays size={13} /> Ugrás a mai napra
          </button>
        )}>
        Mi történik a csapatban
      </SectionTitle>

      {/* Lapozó */}
      <div className="mb-2 flex items-center justify-between rounded-xl px-2 py-1.5" style={{ background: C.soft }}>
        <button onClick={() => canBack && setAnchor(prevDay)} disabled={!canBack}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition active:scale-95 disabled:opacity-30"
          style={{ color: C.slate }}>
          <ChevronLeft size={15} /> Korábbi
        </button>

        <span className="text-xs font-black uppercase tracking-wider" style={{ color: C.slate }}>
          {fmtHU(prevDay)} – {fmtHU(anchor)}
        </span>

        <button onClick={() => canFwd && setAnchor(addDays(anchor, 1))} disabled={!canFwd}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition active:scale-95 disabled:opacity-30"
          style={{ color: C.slate }}>
          Későbbi <ChevronRight size={15} />
        </button>
      </div>

      <div className="space-y-4">
        <DayBlock d={anchor} />
        <div className="rounded-2xl p-1" style={{ background: C.soft }}>
          <div className="rounded-xl bg-white px-3 pb-2">
            <DayBlock d={prevDay} dim />
          </div>
        </div>
      </div>
    </Card>
  );
}

/* =============================== Dashboard ================================ */
function DashboardView({ me, group, stats, pool, go, onPickDay, likes, onLike }) {
  const pre = notStarted(group);
  const cw = weekIndexNow(group.start_date);
  const week = stats.weeks[cw];
  const daysLeftWeek = week.days.filter((d) => d >= TODAY).length;
  const missing = Math.max(stats.goal - week.total, 0);
  const urgent = !pre && missing > 0 && daysLeftWeek <= 2;
  const pct = pre ? 1 : remainingPct(group.start_date);
  const daysLeftAll = Math.max(TOTAL_DAYS - (diffDays(TODAY, group.start_date) + 1), 0);
  const today = me.entries[TODAY];

  const done = week.total >= stats.goal;
  const perDay = done ? 0 : Math.ceil(missing / Math.max(daysLeftWeek, 1));
  const pctWeek = Math.min(week.total / stats.goal, 1);

  return (
    <div className="space-y-5">
      <KingOfTheDay group={group} />

      {/* ====== NAGY HETI HERO-KÖR ====== */}
      {!pre && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-wider" style={{ color: C.slate }}>
              {cw + 1}. hét · {fmtHU(week.days[0])}–{fmtHU(week.days[6])}
            </p>
            <Pill tone={done ? "ok" : "blue"}>{done ? "Teljesítve" : `${daysLeftWeek} nap van hátra`}</Pill>
          </div>

          <div className="flex flex-col items-center">
            <HeroRing pct={pctWeek} done={done}>
              {done ? (
                <>
                  <Check size={40} strokeWidth={3} style={{ color: C.ok }} />
                  <span className="mt-1 text-sm font-black uppercase tracking-wide" style={{ color: C.ok }}>Heti cél megvan</span>
                </>
              ) : (
                <>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.slate }}>Még hátra</span>
                  <span className="text-5xl font-black leading-none tabular-nums" style={{ color: C.blue }}>
                    {missing.toLocaleString("hu-HU")}
                  </span>
                  <span className="text-xs font-bold" style={{ color: C.slate }}>kcal a heti célból</span>
                </>
              )}
            </HeroRing>

            {!done && (
              <div className="mt-5 grid w-full grid-cols-2 gap-3">
                <div className="rounded-xl p-4 text-center" style={{ background: `${C.blue}0D` }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Napi tempó</p>
                  <p className="mt-1 text-2xl font-black tabular-nums" style={{ color: C.blue }}>{perDay.toLocaleString("hu-HU")}</p>
                  <p className="text-xs font-semibold" style={{ color: C.slate }}>kcal / nap a teljesítéshez</p>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ background: C.soft }}>
                  <p className="flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>
                    <Flame size={12} /> Streak
                  </p>
                  <p className="mt-1 text-2xl font-black tabular-nums" style={{ color: C.ink }}>{stats.streak}</p>
                  <p className="text-xs font-semibold" style={{ color: C.slate }}>egymást követő nap</p>
                </div>
              </div>
            )}

            <div className="mt-4 w-full">
              <div className="mb-1 flex justify-between text-xs font-bold" style={{ color: C.slate }}>
                <span>{week.total.toLocaleString("hu-HU")} kcal</span>
                <span>cél: {stats.goal.toLocaleString("hu-HU")}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: C.line }}>
                <div className="h-full rounded-full"
                  style={{ width: `${pctWeek * 100}%`,
                    background: done ? C.ok : `linear-gradient(90deg, ${C.blue}, ${C.cyan})`,
                    transition: "width 800ms cubic-bezier(.2,.8,.2,1)" }} />
              </div>
            </div>

            <Button className="mt-4 w-full" onClick={() => go("tracker")}>
              <PlusCircle size={16} /> Aktivitás rögzítése
            </Button>
          </div>
        </Card>
      )}

      <Feed group={group} meId={me.id} likes={likes} onLike={onLike} />

      <Card className="flex flex-col items-center p-6">
        <SectionTitle>A kihívás</SectionTitle>
        <PoweradeBottle pct={pct} daysLeft={daysLeftAll} beforeStart={pre} />
        {pre && (
          <div className="mt-3 rounded-xl px-4 py-3 text-center" style={{ background: `${C.amber}12` }}>
            <p className="text-sm font-black" style={{ color: C.ink }}>Már csak {daysUntil(group)} nap az indulásig</p>
            <p className="text-xs font-semibold" style={{ color: C.slate }}>Rajt: {fmtLong(group.start_date)}</p>
          </div>
        )}
      </Card>

      {!pre && (
        <Card className="p-6">
          <SectionTitle right={
            <span className="text-sm font-black tabular-nums" style={{ color: today?.kcal ? C.blue : C.slate }}>
              {(today?.kcal || 0).toLocaleString("hu-HU")} kcal
            </span>}>
            Mai aktivitásaid
          </SectionTitle>
          {!today || today.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm font-semibold" style={{ color: C.slate }}>Ma még nem vittél fel semmit.</p>
              <Button variant="soft" onClick={() => go("tracker")}><PlusCircle size={16} /> Aktivitás hozzáadása</Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {today.items.map((it) => <ActivityRow key={it.id} it={it} />)}
              </div>
              <Button variant="ghost" className="mt-3 w-full" onClick={() => go("tracker")}>
                <PlusCircle size={16} /> Még egy aktivitás
              </Button>
            </>
          )}
        </Card>
      )}

      {group.penalty_enabled && (
        <Card className="p-6" style={{ background: `linear-gradient(135deg, ${C.blueDeep}, ${C.blue})`, border: "none" }}>
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.cyan }}>Közös kassza</p>
              <p className="mt-2 text-4xl font-black tabular-nums text-white">{money(pool)}</p>
              {group.goal_text && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white opacity-90">
                  <Target size={14} /> {group.goal_text}
                </p>
              )}
            </div>
            <Wallet size={28} className="shrink-0 text-white opacity-60" />
          </div>
          <div className="mt-5">
            <Button variant="ghost" onClick={() => go("wallet")} className="w-full">Az én egyenlegem</Button>
          </div>
        </Card>
      )}

      {!pre && (
        <Card className="p-6">
          <SectionTitle right={<span className="text-xs font-bold" style={{ color: C.slate }}>
            {stats.totalKcal.toLocaleString("hu-HU")} kcal</span>}>
            Teljes kihívás
          </SectionTitle>
          <ThreeMonthGrid entries={me.entries} weeks={stats.weeks} cw={cw} goal={stats.goal} onPick={onPickDay} />
        </Card>
      )}
    </div>
  );
}

/* ================================ Tracker ================================= */
function TrackerView({ me, group, sports, onAddSport, onSave, onDelete, toast, initialDate }) {
  const [date, setDate] = useState(initialDate || TODAY);
  const [kcal, setKcal] = useState("");
  const [sport, setSport] = useState(sports[0]);
  const [dur, setDur] = useState("");
  const [dist, setDist] = useState("");
  const [note, setNote] = useState("");
  const [custom, setCustom] = useState("");
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { if (initialDate) setDate(initialDate); }, [initialDate]);

  const day = me.entries[date];
  const items = day?.items || [];
  const dayTotal = day?.kcal || 0;

  const clearForm = () => {
    setKcal(""); setDur(""); setDist(""); setNote(""); setFile(null); setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = async () => {
    const n = parseInt(kcal, 10);
    if (!n || n <= 0) return toast("Adj meg egy 0-nál nagyobb kalóriaértéket.", "danger");
    setBusy(true);
    const ok = await onSave(date, {
      kcal: n, sport,
      duration_min: dur ? parseInt(dur, 10) : null,
      distance_km: dist ? parseFloat(dist.replace(",", ".")) : null,
      note: note.trim() || null,
    }, file);
    setBusy(false);
    if (ok) { clearForm(); toast(`+${n} kcal (${sport}) — ${fmtHU(date)}`, "ok"); }
  };

  const addSport = () => {
    const t = custom.trim();
    if (!t) return;
    onAddSport(t); setSport(t); setCustom(""); setAdding(false);
  };

  const cw = weekIndexNow(group.start_date);
  const isPast = date < TODAY;

  return (
    <div className="space-y-5">
      <div className="pc-glow-wrap">
        <style>{`
          @property --pcAngle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
          .pc-glow-wrap {
            position: relative;
            border-radius: 22px;
            padding: 3px;
            background: conic-gradient(from var(--pcAngle),
              ${C.cyan}, ${C.blue}, #7C3AED, ${C.pink}, ${C.amber}, ${C.cyan});
            animation: pcSpin 4s linear infinite;
            box-shadow: 0 0 22px ${C.blue}55, 0 0 40px ${C.cyan}33;
          }
          @keyframes pcSpin { to { --pcAngle: 360deg; } }
          @keyframes pcSpinFallback { to { transform: rotate(360deg); } }
          /* Ha a böngésző nem támogatja a @property-t, egy forgó pszeudó-réteg adja a mozgást */
          @supports not (background: conic-gradient(from 1deg, red, blue)) {
            .pc-glow-wrap { overflow: hidden; background: ${C.blue}; }
            .pc-glow-wrap::before {
              content: ""; position: absolute; inset: -50%;
              background: conic-gradient(${C.cyan}, ${C.blue}, #7C3AED, ${C.pink}, ${C.amber}, ${C.cyan});
              animation: pcSpinFallback 4s linear infinite;
            }
          }
          .pc-glow-inner { position: relative; z-index: 1; }
          @media (prefers-reduced-motion: reduce) {
            .pc-glow-wrap { animation: none; }
            .pc-glow-wrap::before { animation: none; }
          }
        `}</style>
        <div className="pc-glow-inner">
          <Card className="p-6">
            <SectionTitle right={isPast && <Pill tone="amber"><Clock size={11} /> Utólagos</Pill>}>
              Aktivitás hozzáadása
            </SectionTitle>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Nap</label>
            <input type="date" value={date} max={TODAY} min={group.start_date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-base outline-none"
              style={{ background: C.soft, border: `1px solid ${isPast ? C.amber : C.line}`, color: C.ink }} />
            <div className="mt-2 flex gap-2">
              {[[TODAY, "Ma"], [addDays(TODAY, -1), "Tegnap"], [addDays(TODAY, -2), "Tegnapelőtt"]].map(([d, l]) => (
                <button key={d} onClick={() => setDate(d)} disabled={d < group.start_date}
                  className="flex-1 rounded-lg py-2 text-xs font-bold transition disabled:opacity-30"
                  style={{ background: date === d ? `${C.blue}0F` : C.soft, color: date === d ? C.blue : C.slate }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Elégetett kalória</label>
            <div className="relative">
              <input type="number" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="0"
                className="w-full rounded-xl px-4 py-4 text-3xl font-black tabular-nums outline-none"
                style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: C.slate }}>kcal</span>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.amber }}>
              <AlertTriangle size={12} /> Csak az aktív kalóriákat írd be!
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Sportág</label>
            {!adding ? (
              <div className="flex gap-2">
                <select value={sport} onChange={(e) => setSport(e.target.value)}
                  className="flex-1 rounded-xl px-4 py-3 text-base outline-none"
                  style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }}>
                  {sports.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                <Button variant="ghost" onClick={() => setAdding(true)}><PlusCircle size={18} style={{ color: C.blue }} /></Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="pl. Evezés"
                  onKeyDown={(e) => e.key === "Enter" && addSport()}
                  className="flex-1 rounded-xl px-4 py-3 text-base outline-none"
                  style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
                <Button onClick={addSport}>Hozzáadás</Button>
                <Button variant="ghost" onClick={() => setAdding(false)}><X size={16} /></Button>
              </div>
            )}
          </div>

          {/* Idő + táv (opcionális) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>
                <Timer size={11} /> Idő (perc)
              </label>
              <input type="number" inputMode="numeric" value={dur} onChange={(e) => setDur(e.target.value)} placeholder="60"
                className="w-full rounded-xl px-4 py-3 text-base tabular-nums outline-none"
                style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>
                <Route size={11} /> Táv (km)
              </label>
              <input type="text" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} placeholder="8,5"
                className="w-full rounded-xl px-4 py-3 text-base tabular-nums outline-none"
                style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
            </div>
          </div>
          <p className="-mt-2 text-xs" style={{ color: C.slate }}>
            Mindkettő elhagyható — de ha kiírod, a többiek is látják, mennyit nyomtál.
          </p>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Megjegyzés</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={40}
              placeholder="pl. Hajnali kör a Duna-parton" onKeyDown={(e) => e.key === "Enter" && save()}
              className="w-full rounded-xl px-4 py-3 text-base outline-none"
              style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>
              Igazolás (Strava / Health screenshot)
            </label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); } }} />
            {preview ? (
              <div className="relative overflow-hidden rounded-xl" style={{ border: `1px solid ${C.line}` }}>
                <img src={preview} alt="Igazolás" className="max-h-64 w-full object-contain" style={{ background: C.soft }} />
                <button onClick={() => { setPreview(null); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="absolute right-2 top-2 rounded-full p-2" style={{ background: "rgba(15,23,42,.7)" }}>
                  <X size={14} className="text-white" />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl py-8 transition hover:opacity-80"
                style={{ background: C.soft, border: `2px dashed ${C.line}` }}>
                <Camera size={22} style={{ color: C.blue }} />
                <span className="text-sm font-semibold" style={{ color: C.slate }}>Kép kiválasztása</span>
              </button>
            )}
          </div>

          <Button onClick={save} disabled={busy} className="w-full py-4 text-base">
            <PlusCircle size={18} /> {busy ? "Mentés…" : "Hozzáadom a naphoz"}
          </Button>
        </div>
          </Card>
        </div>
      </div>

      <Card className="p-6">
        <SectionTitle right={
          <span className="text-sm font-black tabular-nums" style={{ color: dayTotal ? C.blue : C.slate }}>
            {dayTotal.toLocaleString("hu-HU")} kcal
          </span>}>
          {fmtHU(date)} · {items.length} aktivitás
        </SectionTitle>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm font-semibold" style={{ color: C.slate }}>
            Erre a napra még nincs bejegyzés. Egy napra akárhányat felvehetsz — összeadjuk.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => <ActivityRow key={it.id} it={it} onDelete={onDelete} />)}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <SectionTitle>Ezen a héten</SectionTitle>
        <div className="space-y-2">
          {weekDays(group.start_date, cw).map((d) => {
            const e = me.entries[d];
            const future = d > TODAY;
            return (
              <button key={d} onClick={() => !future && setDate(d)} disabled={future}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left"
                style={{ background: d === date ? `${C.blue}0D` : "transparent",
                  border: `1px solid ${d === date ? C.blue : C.line}` }}>
                <span className="w-14 shrink-0 text-xs font-bold uppercase" style={{ color: C.slate }}>
                  {parse(d).toLocaleDateString("hu-HU", { weekday: "short" })}
                </span>
                <span className="flex-1 truncate text-sm font-semibold" style={{ color: e ? C.ink : C.slate }}>
                  {e ? e.items.map((x) => x.sport).join(" + ") : future ? "—" : "Pihenőnap"}
                </span>
                <span className="shrink-0 text-sm font-black tabular-nums" style={{ color: e ? C.blue : C.line }}>
                  {e ? e.kcal : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ================================ SÚLYMODUL ============================== */
function WeightChart({ members }) {
  const series = members
    .map((m) => ({ user: m, points: (m.weights || []).slice().sort((a, b) => a.date.localeCompare(b.date)) }))
    .filter((s) => s.points.length > 0);

  if (series.length === 0) return null;

  const W = 700, H = 300, PL = 44, PR = 118, PT = 20, PB = 34;
  const allDates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const minD = allDates[0], maxD = allDates[allDates.length - 1];
  const span = Math.max(diffDays(maxD, minD), 1);

  // y = változás a kezdősúlyhoz képest (negatív = fogyás)
  const deltas = series.flatMap((s) => s.points.map((p) => p.kg - s.points[0].kg));
  const lo = Math.min(-1, ...deltas), hi = Math.max(1, ...deltas);
  const pad = (hi - lo) * 0.15 || 1;
  const yMin = lo - pad, yMax = hi + pad;

  const x = (d) => PL + (diffDays(d, minD) / span) * (W - PL - PR);
  const y = (v) => PT + ((yMax - v) / (yMax - yMin)) * (H - PT - PB);

  const COLORS = [C.blue, C.pink, C.ok, C.amber, C.purple, C.cyan, C.danger, C.blueDeep];

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 520 }}>
        {/* rács */}
        {[yMax, (yMax + yMin) / 2, yMin].map((v, i) => (
          <g key={i}>
            <line x1={PL} y1={y(v)} x2={W - PR} y2={y(v)} stroke={C.line} strokeWidth="1" strokeDasharray="3 4" />
            <text x={PL - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fontWeight="700" fill={C.slate}>
              {v > 0 ? "+" : ""}{v.toFixed(1)}
            </text>
          </g>
        ))}
        {/* nulla vonal */}
        <line x1={PL} y1={y(0)} x2={W - PR} y2={y(0)} stroke={C.slate} strokeWidth="1.5" opacity="0.5" />

        <text x={PL} y={H - 10} fontSize="10" fontWeight="700" fill={C.slate}>{fmtHU(minD)}</text>
        <text x={W - PR} y={H - 10} textAnchor="end" fontSize="10" fontWeight="700" fill={C.slate}>{fmtHU(maxD)}</text>

        {series.map((s, i) => {
          const col = COLORS[i % COLORS.length];
          const start = s.points[0].kg;
          const last = s.points[s.points.length - 1];
          const delta = last.kg - start;
          const path = s.points.map((p, j) =>
            `${j === 0 ? "M" : "L"} ${x(p.date)} ${y(p.kg - start)}`).join(" ");
          return (
            <g key={s.user.id}>
              <path d={path} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {s.points.map((p) => (
                <circle key={p.date} cx={x(p.date)} cy={y(p.kg - start)} r="3.5" fill="#fff" stroke={col} strokeWidth="2" />
              ))}
              {/* címke a végén */}
              {(() => {
                const hidden = !!s.user.hide_weight;   // titkosítva: a közös grafikonon senki nem látja
                const w = hidden ? 74 : 104;
                return (
                  <g transform={`translate(${x(last.date) + 10}, ${y(delta)})`}>
                    <rect x="0" y="-11" width={w} height="22" rx="6" fill={col} />
                    <text x="7" y="4" fontSize="10" fontWeight="900" fill="#fff">{initials(s.user.name)}</text>
                    {!hidden && (
                      <text x="28" y="4" fontSize="10" fontWeight="800" fill="#fff">{Number(last.kg)} kg</text>
                    )}
                    <text x={hidden ? 30 : 70} y="4" fontSize="10" fontWeight="900" fill="#fff" opacity="0.95">
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)} kg
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function WeightView({ me, group, onSaveWeight, onDeleteWeight, onToggleModule, onToggleHide, toast }) {
  const [kg, setKg] = useState("");
  const [date, setDate] = useState(TODAY);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const withWeights = group.members.filter((m) => (m.weights || []).length > 0);
  const mine = (me.weights || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const start = mine.length ? mine[mine.length - 1].kg : null;
  const now = mine.length ? mine[0].kg : null;
  const delta = start != null ? now - start : 0;

  const save = async () => {
    const v = parseFloat((kg || "").replace(",", "."));
    if (!v || v < 20 || v > 400) return toast("Adj meg egy értelmes súlyt (kg).", "danger");
    setBusy(true);
    const ok = await onSaveWeight(date, v, file);
    setBusy(false);
    if (ok) {
      setKg(""); setFile(null); setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      toast("Súly rögzítve.", "ok");
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <SectionTitle right={
          <button onClick={() => onToggleModule(false)} className="text-xs font-bold" style={{ color: C.slate }}>
            Modul kikapcsolása
          </button>}>
          Súlykövetés
        </SectionTitle>

        {withWeights.length === 0 ? (
          <p className="py-8 text-center text-sm font-semibold" style={{ color: C.slate }}>
            Még senki nem mért. Legyél te az első.
          </p>
        ) : (
          <>
            <WeightChart members={withWeights} />
            <p className="mt-2 text-center text-xs" style={{ color: C.slate }}>
              A grafikon a <b>kezdősúlyhoz mért változást</b> mutatja. A vonal alatt = fogyás.
            </p>
            {me.hide_weight && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold" style={{ color: C.blue }}>
                <EyeOff size={12} /> A te kilóid itt nem jelennek meg — csak a változásod.
              </p>
            )}
          </>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: C.ink }}>Súlyom titkosítása</p>
            <p className="text-xs" style={{ color: C.slate }}>
              Bekapcsolva a többiek <b>csak a változást</b> látják (pl. −2,4 kg), a konkrét kilókat nem.
              Te természetesen mindent látsz.
            </p>
          </div>
          <Toggle on={!!me.hide_weight} onChange={onToggleHide} />
        </div>
      </Card>

      {mine.length > 0 && (
        <Card className="p-6">
          <SectionTitle right={me.hide_weight && <Pill tone="blue"><EyeOff size={11} /> csak neked</Pill>}>
            Az én mérésem
          </SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            {[["Kezdő", `${Number(start)} kg`, C.slate],
              ["Jelenlegi", `${Number(now)} kg`, C.ink],
              ["Változás", `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`, delta < 0 ? C.ok : delta > 0 ? C.danger : C.slate]]
              .map(([l, v, col]) => (
              <div key={l} className="rounded-xl p-3" style={{ background: C.soft }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>{l}</p>
                <p className="mt-1 text-lg font-black tabular-nums" style={{ color: col }}>{v}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <SectionTitle>Új mérés</SectionTitle>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Súly (kg)</label>
              <input type="text" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="85,4"
                className="w-full rounded-xl px-4 py-3 text-2xl font-black tabular-nums outline-none"
                style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Nap</label>
              <input type="date" value={date} max={TODAY} onChange={(e) => e.target.value && setDate(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-base outline-none"
                style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Igazoló fotó</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); } }} />
            {preview ? (
              <div className="relative overflow-hidden rounded-xl" style={{ border: `1px solid ${C.line}` }}>
                <img src={preview} alt="Mérleg" className="max-h-64 w-full object-contain" style={{ background: C.soft }} />
                <button onClick={() => { setPreview(null); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="absolute right-2 top-2 rounded-full p-2" style={{ background: "rgba(15,23,42,.7)" }}>
                  <X size={14} className="text-white" />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl py-7 transition hover:opacity-80"
                style={{ background: C.soft, border: `2px dashed ${C.line}` }}>
                <Scale size={22} style={{ color: C.blue }} />
                <span className="text-sm font-semibold" style={{ color: C.ink }}>Dobj egy igazoló fotót a többieknek!</span>
                <span className="text-xs" style={{ color: C.slate }}>A mérleg kijelzője, hogy senki ne kotyoghasson bele.</span>
              </button>
            )}
          </div>

          <Button onClick={save} disabled={busy} className="w-full py-4 text-base">
            <Scale size={18} /> {busy ? "Mentés…" : "Mérés rögzítése"}
          </Button>
        </div>
      </Card>

      {mine.length > 0 && (
        <Card className="p-6">
          <SectionTitle>Méréseim</SectionTitle>
          <div className="space-y-2">
            {mine.map((w) => (
              <div key={w.id} className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ border: `1px solid ${C.line}` }}>
                <Scale size={15} style={{ color: C.blue }} />
                <span className="flex-1 text-sm font-semibold" style={{ color: C.ink }}>{fmtHU(w.date)}</span>
                <PhotoThumb url={w.photo_url} size={40} />
                <span className="text-sm font-black tabular-nums" style={{ color: C.ink }}>{Number(w.kg)} kg</span>
                <button onClick={() => onDeleteWeight(w.id)} className="rounded-lg p-1.5">
                  <X size={15} style={{ color: C.slate }} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* =========================== Kiemelkedő statisztikák ====================== */
function HighlightStats({ group }) {
  const s = useMemo(() => {
    const start = group.start_date;
    const end = addDays(start, TOTAL_DAYS - 1);
    const rows = group.members.map((u) => ({ u, ev: evaluate(u, group) }));

    let bestDay = null;
    rows.forEach(({ u }) => Object.values(u.entries).forEach((d) => {
      if (d.date >= start && d.date <= end && (!bestDay || d.kcal > bestDay.kcal))
        bestDay = { name: u.name, emoji: u.emoji, kcal: d.kcal, date: d.date };
    }));

    let bestWeek = null;
    for (let w = 0; w < TOTAL_WEEKS; w++) {
      const days = weekDays(start, w);
      if (days[0] > TODAY) break;
      const total = rows.reduce((acc, { u }) => acc + days.reduce((x, d) => x + (u.entries[d]?.kcal || 0), 0), 0);
      if (total > 0 && (!bestWeek || total > bestWeek.total)) bestWeek = { w: w + 1, total, days };
    }

    const bestStreak = rows.reduce((b, { u, ev }) =>
      (!b || ev.streak > b.streak ? { name: u.name, emoji: u.emoji, streak: ev.streak } : b), null);

    const bestDiscipline = rows.map(({ u, ev }) => ({
      name: u.name, emoji: u.emoji, passed: ev.weeks.filter((w) => w.status === "passed").length,
    })).sort((a, b) => b.passed - a.passed)[0];

    const items = rows.flatMap(({ u }) => Object.values(u.entries)
      .filter((d) => d.date >= start && d.date <= end).flatMap((d) => d.items.map((i) => ({ ...i, u }))));

    const sportCount = {};
    items.forEach((i) => { sportCount[i.sport] = (sportCount[i.sport] || 0) + 1; });
    const topSport = Object.entries(sportCount).sort((a, b) => b[1] - a[1])[0];

    const longest = items.reduce((b, i) => (i.duration_min && (!b || i.duration_min > b.duration_min) ? i : b), null);
    const farthest = items.reduce((b, i) => (i.distance_km && (!b || i.distance_km > b.distance_km) ? i : b), null);
    const totalKm = items.reduce((x, i) => x + (Number(i.distance_km) || 0), 0);
    const totalKcal = rows.reduce((x, { ev }) => x + ev.totalKcal, 0);

    // sör: csak ha volt már legalább egy
    const beerRows = rows.map(({ u }) => ({
      u, n: Object.entries(u.beers || {}).filter(([d]) => d >= start && d <= end)
        .reduce((x, [, c]) => x + c, 0),
    })).sort((a, b) => b.n - a.n);
    const beerTotal = beerRows.reduce((x, r) => x + r.n, 0);

    return { bestDay, bestWeek, bestStreak, bestDiscipline, topSport, longest, farthest, totalKm, totalKcal, beerRows, beerTotal };
  }, [group]);

  const Row = ({ icon: Icon, label, value, sub, tone = C.blue }) => (
    <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: C.soft }}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${tone}18` }}>
        <Icon size={16} style={{ color: tone }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>{label}</p>
        <p className="truncate text-sm font-black" style={{ color: C.ink }}>{value}</p>
      </div>
      {sub && <span className="shrink-0 text-xs font-bold" style={{ color: C.slate }}>{sub}</span>}
    </div>
  );

  if (!s.bestDay) return null;

  return (
    <Card className="p-6">
      <SectionTitle>Rekordok</SectionTitle>
      <div className="space-y-2">
        <Row icon={Zap} tone={C.amber} label="Legtöbb kalória egy nap alatt"
          value={`${s.bestDay.emoji} ${s.bestDay.name} — ${s.bestDay.kcal.toLocaleString("hu-HU")} kcal`}
          sub={fmtHU(s.bestDay.date)} />
        {s.bestWeek && (
          <Row icon={TrendingUp} label="Legaktívabb hét"
            value={`${s.bestWeek.w}. hét — ${s.bestWeek.total.toLocaleString("hu-HU")} kcal`}
            sub={`${fmtHU(s.bestWeek.days[0])}–${fmtHU(s.bestWeek.days[6])}`} />
        )}
        {s.longest && (
          <Row icon={Timer} tone={C.purple} label="Leghosszabb edzés"
            value={`${s.longest.u.emoji} ${s.longest.u.name} — ${fmtDur(s.longest.duration_min)}`}
            sub={s.longest.sport} />
        )}
        {s.farthest && (
          <Row icon={Route} tone={C.ok} label="Leghosszabb táv"
            value={`${s.farthest.u.emoji} ${s.farthest.u.name} — ${Number(s.farthest.distance_km)} km`}
            sub={s.farthest.sport} />
        )}
        {s.bestStreak?.streak > 0 && (
          <Row icon={Flame} tone={C.danger} label="Leghosszabb aktív sorozat"
            value={`${s.bestStreak.emoji} ${s.bestStreak.name}`} sub={`${s.bestStreak.streak} nap`} />
        )}
        {s.bestDiscipline?.passed > 0 && (
          <Row icon={Award} tone={C.ok} label="Legfegyelmezettebb"
            value={`${s.bestDiscipline.emoji} ${s.bestDiscipline.name}`} sub={`${s.bestDiscipline.passed} teljesített hét`} />
        )}
        {s.topSport && <Row icon={Trophy} label="A csapat kedvenc sportja" value={s.topSport[0]} sub={`${s.topSport[1]} alkalom`} />}
        {s.totalKm > 0 && <Row icon={Route} label="Megtett táv összesen" value={`${s.totalKm.toFixed(1)} km`} />}
        <Row icon={Users} tone={C.blueDeep} label="A csapat összesen" value={`${s.totalKcal.toLocaleString("hu-HU")} kcal`} />

        {s.beerTotal > 0 && (
          <div className="mt-4 rounded-xl p-4" style={{ background: `${C.amber}0F`, border: `1px dashed ${C.amber}55` }}>
            <div className="mb-2 flex items-center gap-2">
              <Beer size={15} style={{ color: C.amber }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.amber }}>
                Sörliga · {s.beerTotal} üveg
              </p>
            </div>
            <div className="space-y-1">
              {s.beerRows.filter((r) => r.n > 0).map((r, i) => (
                <div key={r.u.id} className="flex items-center gap-2">
                  <span className="w-4 text-xs font-black" style={{ color: C.slate }}>{i + 1}</span>
                  <span className="text-sm">{r.u.emoji}</span>
                  <span className="flex-1 truncate text-sm font-bold" style={{ color: C.ink }}>{r.u.name}</span>
                  {i === 0 && <Pill tone="amber">👑 Beer King</Pill>}
                  <span className="text-sm font-black tabular-nums" style={{ color: C.amber }}>{r.n}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ============================== Ranglista ================================= */
function LeaderboardView({ group, meId, onOpenMember }) {
  const [tab, setTab] = useState("week");
  const cw = weekIndexNow(group.start_date);

  const daysLeft = useMemo(
    () => Math.max(weekDays(group.start_date, cw).filter((d) => d >= TODAY).length, 1),
    [group, cw]);

  const rows = useMemo(() => group.members.map((u) => {
    const s = evaluate(u, group);
    const weekKcal = s.weeks[cw].total;
    const target = tab === "week" ? s.goal : s.goal * TOTAL_WEEKS;
    const kcal = tab === "week" ? weekKcal : s.totalKcal;
    const left = Math.max(target - kcal, 0);
    return {
      id: u.id, name: u.name, emoji: u.emoji, gender: u.gender, goal: s.goal, target, kcal, left,
      perDay: Math.ceil(left / daysLeft),
      pct: Math.min(kcal / target, 1), done: kcal >= target,
      paid: s.paid, debt: s.debt + s.pending,
      failed: s.weeks.filter((w) => w.status === "failed").length,
    };
  }).sort((a, b) => b.kcal - a.kcal), [group, tab, cw, daysLeft]);

  const pen = group.penalty_enabled;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-xl p-1" style={{ background: C.soft }}>
        {[["week", "E heti rangsor"], ["all", "3 hónapos összesített"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="flex-1 rounded-lg py-2.5 text-sm font-bold transition"
            style={{ background: tab === k ? "#fff" : "transparent", color: tab === k ? C.blue : C.slate,
              boxShadow: tab === k ? "0 1px 3px rgba(15,23,42,.08)" : "none" }}>
            {l}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {rows.map((r, i) => (
          <button key={r.id} onClick={() => onOpenMember(r.id)}
            className="w-full px-4 py-4 text-left transition hover:opacity-80"
            style={{ borderTop: i ? `1px solid ${C.line}` : "none",
              background: r.id === meId ? `${C.cyan}0F` : "#fff" }}>

            {/* fejsor: helyezés, avatar, név, kcal */}
            <div className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-center text-base font-black tabular-nums"
                style={{ color: i === 0 ? C.blue : C.slate }}>{i + 1}</span>
              <Avatar user={r} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black" style={{ color: C.ink }}>
                  {r.name}{r.id === meId && <span className="ml-1 text-xs font-bold" style={{ color: C.blue }}>· te</span>}
                </p>
                <p className="text-xs font-semibold" style={{ color: C.slate }}>
                  cél: {r.target.toLocaleString("hu-HU")} kcal
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-black leading-none tabular-nums" style={{ color: C.ink }}>
                  {r.kcal.toLocaleString("hu-HU")}
                </p>
                <p className="text-xs font-bold" style={{ color: C.slate }}>kcal</p>
              </div>
              <ChevronRight size={16} className="shrink-0" style={{ color: C.line }} />
            </div>

            {/* haladás */}
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: C.line }}>
                <div className="h-full rounded-full"
                  style={{ width: `${r.pct * 100}%`,
                    background: r.done ? C.ok : `linear-gradient(90deg, ${C.blue}, ${C.cyan})`,
                    transition: "width 700ms cubic-bezier(.2,.8,.2,1)" }} />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-black tabular-nums"
                style={{ color: r.done ? C.ok : C.slate }}>
                {Math.round(r.pct * 100)}%
              </span>
            </div>

            {/* alsó sáv: hiányzik / napi tempó / extrák */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {r.done ? (
                <Pill tone="ok"><Check size={11} /> Teljesítve</Pill>
              ) : (
                <>
                  <span className="text-xs font-semibold" style={{ color: C.slate }}>
                    Hiányzik:{" "}
                    <b className="tabular-nums" style={{ color: C.blue }}>{r.left.toLocaleString("hu-HU")} kcal</b>
                  </span>
                  {tab === "week" && (
                    <span className="text-xs font-semibold" style={{ color: C.slate }}>
                      Napi tempó:{" "}
                      <b className="tabular-nums" style={{ color: C.ink }}>{r.perDay.toLocaleString("hu-HU")}</b>
                    </span>
                  )}
                </>
              )}
              {pen && r.debt > 0 && <Pill tone="danger">tartozás {money(r.debt)}</Pill>}
              {r.failed > 0 && (
                <span className="text-xs font-semibold" style={{ color: C.slate }}>{r.failed} bukott hét</span>
              )}
            </div>
          </button>
        ))}
      </Card>

      {tab === "week" && (
        <p className="px-1 text-xs leading-relaxed" style={{ color: C.slate }}>
          A <b>napi tempó</b> azt mutatja, mennyit kell naponta összeszedni, hogy a maradék{" "}
          <b>{daysLeft} nap</b> alatt meglegyen a heti cél.
        </p>
      )}

      <HighlightStats group={group} />
    </div>
  );
}

/* ============================ Tag profiloldala =========================== */
function MemberView({ user, group, meId, onBack }) {
  const st = useMemo(() => evaluate(user, group), [user, group]);
  const cw = weekIndexNow(group.start_date);
  const week = st.weeks[cw];
  const pre = notStarted(group);
  const [openBadge, setOpenBadge] = useState(null);

  const codes = useMemo(() => earnedBadges(user, group, group.members), [user, group]);
  const allCodes = Object.keys(BADGES);

  const days = useMemo(() => Object.values(user.entries)
    .filter((d) => d.date >= group.start_date && d.date <= TODAY)
    .sort((a, b) => b.date.localeCompare(a.date)), [user, group]);

  const activeDays = days.length;
  const bestDay = days.reduce((b, d) => (!b || d.kcal > b.kcal ? d : b), null);
  const avg = activeDays ? Math.round(st.totalKcal / activeDays) : 0;
  const passed = st.weeks.filter((w) => w.status === "passed").length;
  const failed = st.weeks.filter((w) => w.status === "failed").length;
  const beers = Object.entries(user.beers || {})
    .filter(([d]) => d >= group.start_date).reduce((s, [, c]) => s + c, 0);
  const totalKm = days.flatMap((d) => d.items).reduce((s, i) => s + (Number(i.distance_km) || 0), 0);

  const Stat = ({ label, value, sub, tone = C.ink }) => (
    <div className="rounded-xl p-3" style={{ background: C.soft }}>
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums" style={{ color: tone }}>{value}</p>
      {sub && <p className="text-xs font-semibold" style={{ color: C.slate }}>{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: C.blue }}>
        <ArrowLeft size={16} /> Vissza
      </button>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Avatar user={user} size={64} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-black" style={{ color: C.ink }}>
              {user.name}{user.id === meId && <span className="ml-1 text-sm font-bold" style={{ color: C.blue }}>· te</span>}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Pill tone="blue">heti cél: {st.goal.toLocaleString("hu-HU")} kcal</Pill>
              {user.id === group.owner_id && <Pill tone="amber"><Crown size={11} /> gazda</Pill>}
            </div>
          </div>
        </div>

        {!pre && (
          <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
            <WeeklyRing kcal={week.total} goal={st.goal} />
            <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-1">
              <Stat label="Streak" value={`${st.streak} nap`} />
              <Stat label="Összesen" value={`${st.totalKcal.toLocaleString("hu-HU")} kcal`} sub={`${activeDays} aktív nap`} />
            </div>
          </div>
        )}
      </Card>

      {/* JELVÉNYEK */}
      <Card className="p-6">
        <SectionTitle right={<span className="text-xs font-bold" style={{ color: C.slate }}>
          {codes.length} / {allCodes.length}</span>}>
          Jelvények
        </SectionTitle>

        <div className="flex flex-wrap gap-3">
          {allCodes.map((code) => {
            const got = codes.includes(code);
            const big = BADGES[code].big;
            return (
              <Badge key={code} code={code} size={big ? 68 : 54} dim={!got}
                onClick={() => setOpenBadge({ code, got })} />
            );
          })}
        </div>

        {openBadge && (
          <div className="mt-4 flex items-start gap-3 rounded-xl p-4" style={{ background: C.soft }}>
            <Badge code={openBadge.code} size={46} dim={!openBadge.got} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black" style={{ color: C.ink }}>{BADGES[openBadge.code].label}</p>
              <p className="text-xs" style={{ color: C.slate }}>{BADGES[openBadge.code].desc}</p>
              {!openBadge.got && <p className="mt-1 text-xs font-bold" style={{ color: C.amber }}>Még nincs meg.</p>}
            </div>
            <button onClick={() => setOpenBadge(null)}><X size={16} style={{ color: C.slate }} /></button>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <SectionTitle>Statisztikák</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Teljesített hét" value={passed} tone={C.ok} />
          <Stat label="Bukott hét" value={failed} tone={failed ? C.danger : C.slate} />
          <Stat label="Napi átlag" value={`${avg} kcal`} sub="aktív napokra" />
          {bestDay && <Stat label="Legjobb nap" value={`${bestDay.kcal.toLocaleString("hu-HU")} kcal`} sub={fmtHU(bestDay.date)} tone={C.blue} />}
          {totalKm > 0 && <Stat label="Megtett táv" value={`${totalKm.toFixed(1)} km`} tone={C.purple} />}
          {group.penalty_enabled && <Stat label="Tartozás" value={money(st.debt + st.pending)} tone={st.debt ? C.danger : C.slate} />}
          {group.penalty_enabled && <Stat label="Befizetve" value={money(st.paid)} tone={C.ok} />}
          {beers > 0 && <Stat label="Sör 🍺" value={beers} sub="a kihívás alatt" tone={C.amber} />}
        </div>
      </Card>

      {!pre && (
        <Card className="p-6">
          <SectionTitle right={<span className="text-xs font-bold" style={{ color: C.slate }}>
            {st.totalKcal.toLocaleString("hu-HU")} kcal</span>}>
            Heti bontás
          </SectionTitle>
          <ThreeMonthGrid entries={user.entries} weeks={st.weeks} cw={cw} />
        </Card>
      )}

      <Card className="p-6">
        <SectionTitle>Aktivitások</SectionTitle>
        {days.length === 0 ? (
          <p className="py-6 text-center text-sm font-semibold" style={{ color: C.slate }}>
            Még nincs egyetlen bejegyzés sem.
          </p>
        ) : (
          <div className="space-y-4">
            {days.map((d) => (
              <div key={d.date}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>
                    {parse(d.date).toLocaleDateString("hu-HU", { weekday: "long", month: "short", day: "numeric" })}
                  </p>
                  <span className="text-sm font-black tabular-nums" style={{ color: C.blue }}>
                    {d.kcal.toLocaleString("hu-HU")} kcal
                  </span>
                </div>
                <div className="space-y-2">
                  {d.items.map((it) => <ActivityRow key={it.id} it={it} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================== Kassza / Csoport ========================== */
function WalletView({ me, group, stats, pool, onApprove, onDeclare, onInvite, onLeave,
                      onUpdateGroup, onOpenMember, onToggleWeight, toast }) {
  const isOwner = group.owner_id === me.id;
  const pen = group.penalty_enabled;
  const [invEmail, setInvEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [gPen, setGPen] = useState(group.penalty_enabled);
  const [gAmount, setGAmount] = useState(String(penaltyOf(group)));
  const [gGoal, setGGoal] = useState(group.goal_text || "");
  const [gStart, setGStart] = useState(group.start_date);

  // mentés után a mezők vegyék át a frissült értékeket
  useEffect(() => {
    setGPen(group.penalty_enabled);
    setGAmount(String(penaltyOf(group)));
    setGGoal(group.goal_text || "");
    setGStart(group.start_date);
  }, [group.penalty_enabled, group.penalty_amount, group.goal_text, group.start_date]);

  const ledger = useMemo(() => group.members.map((u) => {
    const s = evaluate(u, group);
    return { u, ...s };
  }).sort((a, b) => b.paid - a.paid || b.debt - a.debt), [group]);

  const totalDebt = ledger.reduce((s, r) => s + r.debt, 0);
  const topPayer = ledger.find((r) => r.paid > 0);

  const invite = async () => {
    if (!/^\S+@\S+\.\S+$/.test(invEmail.trim())) return toast("Adj meg egy érvényes e-mail-címet.", "danger");
    setBusy(true);
    const ok = await onInvite(invEmail.trim());
    setBusy(false);
    if (ok) { setInvEmail(""); toast("Meghívó elküldve.", "ok"); }
  };

  const saveGroup = async () => {
    const amt = parseInt(gAmount, 10);
    if (gPen && (!amt || amt < 100)) return toast("Adj meg egy értelmes büntetést (min. 100 Ft).", "danger");
    const patch = {
      penalty_enabled: gPen,
      penalty_amount: gPen ? amt : penaltyOf(group),
      goal_text: gGoal.trim() || null,
      start_date: gStart,
    };
    const ok = await onUpdateGroup(patch);
    if (ok) toast("Csoport beállításai mentve.", "ok");
  };

  return (
    <div className="space-y-5">
      {pen ? (
        <>
          {/* Kassza illusztráció */}
          <Card className="overflow-hidden p-6" style={{ background: `linear-gradient(135deg, ${C.blueDeep}, ${C.blue})`, border: "none" }}>
            <div className="flex items-center gap-5">
              <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
                <defs>
                  <linearGradient id="walletG" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FFE9A8" /><stop offset="100%" stopColor="#E0A800" />
                  </linearGradient>
                </defs>
                <rect x="10" y="22" width="52" height="36" rx="8" fill="url(#walletG)" />
                <rect x="10" y="22" width="52" height="9" rx="4" fill="#fff" opacity="0.35" />
                <rect x="40" y="34" width="26" height="14" rx="5" fill="#fff" opacity="0.9" />
                <circle cx="50" cy="41" r="3.4" fill={C.blueDeep} />
                <rect x="18" y="12" width="30" height="12" rx="3" fill="#fff" opacity="0.5" transform="rotate(-8 33 18)" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.cyan }}>Összegyűlt a kasszában</p>
                <p className="mt-1 text-4xl font-black tabular-nums text-white">{money(pool)}</p>
                {group.goal_text && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-white opacity-90">
                    <Target size={14} /> {group.goal_text}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,.14)" }}>
                <p className="text-xs font-bold uppercase" style={{ color: C.cyan }}>Kintlévőség</p>
                <p className="text-lg font-black tabular-nums text-white">{money(totalDebt)}</p>
              </div>
              <div className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,.14)" }}>
                <p className="text-xs font-bold uppercase" style={{ color: C.cyan }}>Legtöbbet fizette</p>
                <p className="truncate text-sm font-black text-white">
                  {topPayer ? `${topPayer.u.emoji} ${topPayer.u.name}` : "—"}
                </p>
                {topPayer && <p className="text-xs font-bold text-white opacity-80">{money(topPayer.paid)}</p>}
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-white opacity-70">
              A pénzmozgást egymás közt intézitek — az app csak vezeti, ki hol áll.
            </p>
          </Card>

          {/* Ki mennyivel tartozik */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider"
              style={{ background: C.soft, color: C.slate }}>
              <span className="flex-1">Név</span>
              <span className="w-24 text-right">Büntetés</span>
              <span className="w-24 text-right">Befizetve</span>
              <span className="w-24 text-right">Tartozás</span>
            </div>
            {ledger.map((r) => (
              <button key={r.u.id} onClick={() => onOpenMember(r.u.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:opacity-80"
                style={{ borderTop: `1px solid ${C.line}`, background: r.u.id === me.id ? `${C.cyan}0F` : "#fff" }}>
                <Avatar user={r.u} size={34} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold" style={{ color: C.ink }}>{r.u.name}</span>
                <span className="w-24 text-right text-sm font-bold tabular-nums" style={{ color: C.slate }}>{money(r.penalties)}</span>
                <span className="w-24 text-right text-sm font-bold tabular-nums" style={{ color: r.paid ? C.ok : C.slate }}>{money(r.paid)}</span>
                <span className="w-24 text-right text-sm font-black tabular-nums" style={{ color: r.debt ? C.danger : C.ok }}>
                  {r.debt ? money(r.debt) : "rendben"}
                </span>
              </button>
            ))}
          </Card>

          {/* Saját rendezés */}
          <Card className="p-6">
            <SectionTitle right={<Pill tone="slate">{money(penaltyOf(group))} / bukott hét</Pill>}>Az én egyenlegem</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              {[["Büntetés", stats.penalties, C.ink],
                ["Befizetve", stats.paid, C.ok],
                ["Tartozás", stats.debt, stats.debt ? C.danger : C.slate]].map(([l, v, col]) => (
                <div key={l} className="rounded-xl p-3" style={{ background: C.soft }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>{l}</p>
                  <p className="mt-1 text-lg font-black tabular-nums" style={{ color: col }}>{money(v)}</p>
                </div>
              ))}
            </div>
            {stats.pending > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-xl p-3" style={{ background: `${C.amber}12` }}>
                <Clock size={16} style={{ color: C.amber }} />
                <p className="text-sm font-semibold" style={{ color: C.ink }}>{money(stats.pending)} jóváhagyásra vár.</p>
              </div>
            )}
            <Button variant="ghost" className="mt-4 w-full" onClick={() => onDeclare(stats.debt)} disabled={stats.debt <= 0}>
              <Check size={16} /> Rendeztem a tartozásom ({money(stats.debt)})
            </Button>
            <p className="mt-2 text-xs" style={{ color: C.slate }}>
              A csoport gazdája hagyja jóvá, ha tényleg megkapta.
            </p>
          </Card>

          {isOwner && (
            <Card className="p-6">
              <SectionTitle right={<Pill tone="amber"><Crown size={12} /> Csoportgazda</Pill>}>Jóváhagyásra vár</SectionTitle>
              {(() => {
                const pending = group.members.flatMap((u) =>
                  u.payments.filter((p) => p.group_id === group.id && p.status === "pending").map((p) => ({ ...p, user: u })));
                return pending.length === 0 ? (
                  <p className="py-4 text-center text-sm font-semibold" style={{ color: C.slate }}>Nincs függő befizetés.</p>
                ) : (
                  <div className="space-y-2">
                    {pending.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ border: `1px solid ${C.line}` }}>
                        <Avatar user={p.user} size={34} />
                        <div className="flex-1">
                          <p className="text-sm font-bold" style={{ color: C.ink }}>{p.user.name}</p>
                          <p className="text-xs" style={{ color: C.slate }}>{money(p.amount)}</p>
                        </div>
                        <Button onClick={() => onApprove(p.id)} className="px-3 py-2"><Check size={14} /> Megkaptam</Button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Card>
          )}
        </>
      ) : (
        <Card className="flex items-center gap-3 p-6">
          <Ban size={20} style={{ color: C.slate }} />
          <p className="text-sm font-semibold" style={{ color: C.ink }}>
            Ebben a csoportban nincs pénzbüntetés. Csak a becsület a tét.
          </p>
        </Card>
      )}

      {/* Súlymodul */}
      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${C.purple}12` }}>
              <Scale size={18} style={{ color: C.purple }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: C.ink }}>Súlykövetés</p>
              <p className="text-xs" style={{ color: C.slate }}>Közös fogyás-diagram. Bárki be- vagy kikapcsolhatja.</p>
            </div>
          </div>
          <Toggle on={group.weight_enabled} onChange={onToggleWeight} />
        </div>
      </Card>

      {/* Tagok */}
      <Card className="p-6">
        <SectionTitle right={<span className="text-xs font-bold" style={{ color: C.slate }}>{group.members.length} tag</span>}>
          Tagok és meghívás
        </SectionTitle>
        <div className="mb-4 space-y-1">
          {group.members.map((m) => (
            <button key={m.id} onClick={() => onOpenMember(m.id)}
              className="flex w-full items-center gap-3 rounded-lg py-2 text-left transition hover:opacity-70">
              <Avatar user={m} size={34} />
              <span className="flex-1 truncate text-sm font-semibold" style={{ color: C.ink }}>{m.name}</span>
              {m.id === group.owner_id && <Crown size={13} style={{ color: C.amber }} />}
              <span className="text-xs font-bold" style={{ color: C.slate }}>{goalOf(m)} kcal</span>
              <ChevronRight size={14} style={{ color: C.line }} />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="haver@pelda.hu"
            onKeyDown={(e) => e.key === "Enter" && invite()}
            className="flex-1 rounded-xl px-4 py-3 text-base outline-none"
            style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
          <Button onClick={invite} disabled={busy}><UserPlus size={16} /> Meghívás</Button>
        </div>
      </Card>

      {isOwner && (
        <Card className="p-6">
          <SectionTitle right={<Settings size={16} style={{ color: C.slate }} />}>Csoport beállításai</SectionTitle>
          <div className="space-y-4">
            <div className="rounded-xl p-4" style={{ background: C.soft }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold" style={{ color: C.ink }}>Pénzbüntetés</p>
                  <p className="text-xs" style={{ color: C.slate }}>Bukott hetenként fizetni kell.</p>
                </div>
                <Toggle on={gPen} onChange={setGPen} />
              </div>
              {gPen && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Összeg (Ft / bukott hét)</label>
                  <input type="number" inputMode="numeric" value={gAmount} onChange={(e) => setGAmount(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-base font-black tabular-nums outline-none"
                    style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.ink }} />
                </div>
              )}
            </div>

            {gPen && (
              <Field label="Erre költjük az összegyűlt pénzt" value={gGoal} placeholder="pl. Közös hétvége Bükkben"
                onChange={(e) => setGGoal(e.target.value)} />
            )}

            <div>
              <Field label="A kihívás első napja" type="date" value={gStart}
                onChange={(e) => e.target.value && setGStart(e.target.value)} />

              <div className="mt-2 rounded-xl p-3" style={{ background: `${C.amber}0D` }}>
                <p className="text-xs font-bold" style={{ color: C.ink }}>Rajt: {fmtLong(gStart)}</p>
                <p className="text-xs" style={{ color: C.slate }}>
                  Vége: {fmtLong(addDays(gStart, TOTAL_DAYS - 1))} · a hetek 7 napos ciklusok a rajttól
                </p>
                {gStart !== group.start_date && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold" style={{ color: C.amber }}>
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    A hetek és a büntetések újraszámolódnak. A rögzített aktivitások megmaradnak,
                    csak átkerülnek a megfelelő ciklusokba.
                  </p>
                )}
              </div>
            </div>

            <Button onClick={saveGroup} className="w-full">Beállítások mentése</Button>
          </div>
        </Card>
      )}

      {!isOwner && (
        <Card className="p-6">
          <SectionTitle>Kilépés</SectionTitle>
          <p className="mb-4 text-sm" style={{ color: C.slate }}>
            Az adataid megmaradnak: ha újra meghívnak, minden ott folytatódik, ahol abbahagytad.
          </p>
          <Button variant="danger" className="w-full" onClick={onLeave}>
            <DoorOpen size={16} /> Kilépek a csoportból
          </Button>
        </Card>
      )}
    </div>
  );
}

/* ========================= Új jelvény felugró ablak ======================= */
function BadgeModal({ code, onClose }) {
  const b = BADGES[code];
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-5"
      style={{ background: "rgba(15,23,42,.55)" }} onClick={onClose}>
      <Card className="w-full max-w-xs p-7 text-center" onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: "0 24px 60px rgba(0,0,0,.3)" }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.amber }}>Új jelvény!</p>
        <div className="my-4 flex justify-center">
          <div style={{ animation: "pcPop 700ms cubic-bezier(.2,1.4,.4,1)" }}>
            <Badge code={code} size={110} />
          </div>
        </div>
        <style>{`
          @keyframes pcPop {
            0% { transform: scale(.3) rotate(-25deg); opacity: 0; }
            60% { transform: scale(1.12) rotate(6deg); opacity: 1; }
            100% { transform: scale(1) rotate(0deg); }
          }
        `}</style>
        <p className="text-xl font-black" style={{ color: C.ink }}>{b.label}</p>
        <p className="mt-1 text-sm" style={{ color: C.slate }}>{b.desc}</p>
        <Button className="mt-5 w-full" onClick={onClose}>Köszi!</Button>
      </Card>
    </div>
  );
}

/* ================================== App =================================== */
export default function App() {
  const [session, setSession] = useState(null);
  const [recovery, setRecovery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [invites, setInvites] = useState([]);
  const [badgeRows, setBadgeRows] = useState([]);
  const [likes, setLikes] = useState([]);
  const [userCount, setUserCount] = useState(null);
  const [sports, setSports] = useState(DEFAULT_SPORTS);
  const [openId, setOpenId] = useState(() => {
    try { return localStorage.getItem("pc-last-group") || null; } catch { return null; }
  });
  const [screen, setScreen] = useState(() => {
    try { return localStorage.getItem("pc-last-group") ? "group" : "groups"; } catch { return "groups"; }
  });
  const [tab, setTab] = useState("dashboard");
  const [pickDate, setPickDate] = useState(null);
  const [memberId, setMemberId] = useState(null);
  const [toast, setToast] = useState(null);
  const [confetti, setConfetti] = useState(false);
  const [newBadge, setNewBadge] = useState(null);
  const wasDone = useRef(null);

  const notify = (msg, tone = "ok") => { setToast({ msg, tone }); setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    supabase.rpc("user_count").then(({ data }) => { if (typeof data === "number") setUserCount(data); });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s);
      if (e === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    const [pr, en, pa, gr, gm, inv, we, be, ba, lk] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("entries").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("groups").select("*"),
      supabase.from("group_members").select("*"),
      supabase.from("invites").select("*"),
      supabase.from("weights").select("*"),
      supabase.from("beers").select("*"),
      supabase.from("badges").select("*"),
      supabase.from("likes").select("*"),
    ]);
    const bad = [pr, en, pa, gr, gm, inv, we, be, ba, lk].find((r) => r.error);
    if (bad) { notify("Betöltési hiba: " + bad.error.message, "danger"); return; }

    const users = (pr.data || []).map((p) => {
      const mine = (en.data || []).filter((x) => x.user_id === p.id);
      const byDate = {};
      mine.forEach((x) => {
        if (!byDate[x.date]) byDate[x.date] = { date: x.date, kcal: 0, items: [] };
        byDate[x.date].kcal += x.kcal;
        byDate[x.date].items.push(x);
      });
      Object.values(byDate).forEach((d) =>
        d.items.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")));

      const beerRows = (be.data || []).filter((x) => x.user_id === p.id);
      const beers = {};
      beerRows.forEach((x) => { beers[x.date] = x.count; });

      return {
        ...p,
        entries: byDate,
        payments: (pa.data || []).filter((x) => x.user_id === p.id),
        weights: (we.data || []).filter((x) => x.user_id === p.id),
        beers, beerRows,
      };
    });
    setProfiles(users);
    setLikes(lk.data || []);
    setBadgeRows((ba.data || []).filter((b) => b.user_id === session.user.id));

    const active = (gm.data || []).filter((m) => !m.left_at);
    const myIds = new Set(active.filter((m) => m.user_id === session.user.id).map((m) => m.group_id));
    setGroups((gr.data || []).filter((g) => myIds.has(g.id)).map((g) => ({
      ...g,
      members: active.filter((m) => m.group_id === g.id)
        .map((m) => users.find((u) => u.id === m.user_id)).filter(Boolean),
    })));

    const myEmail = (session.user.email || "").toLowerCase();
    setInvites((inv.data || [])
      .filter((i) => i.email.toLowerCase() === myEmail && !myIds.has(i.group_id))
      .map((i) => ({ ...i, group_name: (gr.data || []).find((g) => g.id === i.group_id)?.name || "Csoport" })));

    const custom = [...new Set((en.data || []).map((x) => x.sport))].filter((s) => !DEFAULT_SPORTS.includes(s));
    setSports([...DEFAULT_SPORTS, ...custom]);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const me = profiles.find((u) => u.id === session?.user?.id);
  const group = groups.find((g) => g.id === openId);
  const member = group?.members.find((u) => u.id === memberId);
  const stats = useMemo(() => (me && group ? evaluate(me, group) : null), [me, group]);
  const pool = useMemo(() => !group ? 0 : group.members.flatMap((m) => m.payments)
    .filter((p) => p.group_id === group.id && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0), [group]);

  /* ---- Heti cél elérése: konfetti + szalag ---- */
  useEffect(() => {
    if (!group || !stats || notStarted(group)) { wasDone.current = null; return; }
    const done = stats.weeks[weekIndexNow(group.start_date)].total >= stats.goal;
    if (wasDone.current === false && done) { setConfetti(true); }
    wasDone.current = done;
  }, [group, stats]);

  /* ---- Jelvények kiosztása és visszavonása ---- */
  useEffect(() => {
    if (!me || !group) return;
    const codes = earnedBadges(me, group, group.members);
    const have = badgeRows.filter((b) => b.group_id === group.id);

    // Új jelvények, amik most jártak
    const missing = codes.filter((c) => !have.some((b) => b.code === c));
    // Meglévő jelvények, amik már NEM járnak (pl. törölted az edzést) — a Beer King
    // hetente vándorol, ezért azt nem vonjuk vissza automatikusan
    const revoke = have.filter((b) => !codes.includes(b.code) && b.code !== "beerKing");

    if (missing.length || revoke.length) {
      (async () => {
        if (missing.length) {
          await supabase.from("badges")
            .insert(missing.map((code) => ({ user_id: me.id, group_id: group.id, code })));
        }
        if (revoke.length) {
          await supabase.from("badges").delete().in("id", revoke.map((b) => b.id));
        }
        await load();
      })();
      return;
    }

    const unseen = have.find((b) => !b.seen && codes.includes(b.code));
    if (unseen && !newBadge) setNewBadge(unseen);
  }, [me, group, badgeRows]); // eslint-disable-line

  const closeBadge = async () => {
    if (newBadge) await supabase.from("badges").update({ seen: true }).eq("id", newBadge.id);
    setNewBadge(null);
    await load();
  };

  /* -------------------------------- Műveletek ------------------------------ */
  const createGroup = async (g, emails = []) => {
    const { data, error } = await supabase.from("groups").insert({ ...g, owner_id: session.user.id }).select().single();
    if (error) { notify("Nem sikerült: " + error.message, "danger"); return false; }
    const { error: e2 } = await supabase.from("group_members").insert({ group_id: data.id, user_id: session.user.id });
    if (e2) { notify("Nem sikerült csatlakozni: " + e2.message, "danger"); return false; }
    if (emails.length) {
      const { error: e3 } = await supabase.from("invites").insert(emails.map((email) => ({ group_id: data.id, email })));
      if (e3) notify("A csoport elkészült, de a meghívók nem mentek ki.", "danger");
    }
    await load();
    return true;
  };

  const updateGroup = async (patch) => {
    const { error } = await supabase.from("groups").update(patch).eq("id", group.id);
    if (error) { notify("Nem sikerült: " + error.message, "danger"); return false; }
    await load();
    return true;
  };

  const toggleWeight = async (on) => {
    const { error } = await supabase.rpc("set_weight_module", { gid: group.id, enabled: on });
    if (error) { notify("Nem sikerült: " + error.message, "danger"); return; }
    notify(on ? "Súlykövetés bekapcsolva." : "Súlykövetés kikapcsolva.", "ok");
    if (!on && tab === "weight") setTab("dashboard");
    await load();
  };

  const acceptInvite = async (inv) => {
    const { data: back } = await supabase.from("group_members").update({ left_at: null })
      .eq("group_id", inv.group_id).eq("user_id", session.user.id).select();
    if (!back || back.length === 0) {
      const { error } = await supabase.from("group_members").insert({ group_id: inv.group_id, user_id: session.user.id });
      if (error) { notify("Nem sikerült csatlakozni: " + error.message, "danger"); return; }
    }
    await supabase.from("invites").delete().eq("id", inv.id);
    notify("Csatlakoztál a csoporthoz!", "ok");
    await load();
  };

  const declineInvite = async (inv) => {
    await supabase.from("invites").delete().eq("id", inv.id);
    notify("Meghívás elutasítva.", "ok");
    await load();
  };

  const leaveGroup = async () => {
    const { error } = await supabase.from("group_members")
      .update({ left_at: new Date().toISOString() })
      .eq("group_id", group.id).eq("user_id", session.user.id);
    if (error) { notify("Nem sikerült: " + error.message, "danger"); return; }
    setOpenId(null); setScreen("groups");
    try { localStorage.removeItem("pc-last-group"); } catch {}
    notify("Kiléptél a csoportból.", "ok");
    await load();
  };

  const inviteEmail = async (email) => {
    const { error } = await supabase.from("invites").insert({ group_id: group.id, email });
    if (error) {
      notify(error.code === "23505" ? "Ezt a címet már meghívtad." : "Nem sikerült: " + error.message, "danger");
      return false;
    }
    return true;
  };

  const upload = async (file, prefix) => {
    const path = `${session.user.id}/${prefix}-${Date.now()}`;
    const { error } = await supabase.storage.from("proofs").upload(path, file, { upsert: true });
    if (error) return null;
    return supabase.storage.from("proofs").getPublicUrl(path).data.publicUrl;
  };

  const addEntry = async (date, fields, file) => {
    let proof_url = null;
    if (file) {
      proof_url = await upload(file, date);
      if (!proof_url) { notify("A kép feltöltése nem sikerült.", "danger"); return false; }
    }
    const { error } = await supabase.from("entries")
      .insert({ user_id: session.user.id, date, ...fields, proof_url });
    if (error) { notify("Mentés sikertelen: " + error.message, "danger"); return false; }
    await load();
    return true;
  };

  const deleteEntry = async (id) => {
    // a .select() visszaadja a ténylegesen törölt sorokat — így kiderül, ha a jogosultság néma módon blokkolt
    const { data, error } = await supabase.from("entries").delete().eq("id", id).select();
    if (error) { notify("Nem sikerült törölni: " + error.message, "danger"); return; }
    if (!data || data.length === 0) {
      notify("A törlést az adatbázis nem engedélyezte. (Csak a saját bejegyzésed törölheted.)", "danger");
      return;
    }
    notify("Aktivitás törölve.", "ok");
    await load();
  };

  const saveWeight = async (date, kg, file) => {
    let photo_url = null;
    if (file) {
      photo_url = await upload(file, `w-${date}`);
      if (!photo_url) { notify("A kép feltöltése nem sikerült.", "danger"); return false; }
    }
    const { error } = await supabase.from("weights")
      .upsert({ user_id: session.user.id, date, kg, photo_url }, { onConflict: "user_id,date" });
    if (error) { notify("Mentés sikertelen: " + error.message, "danger"); return false; }
    await load();
    return true;
  };

  const deleteWeight = async (id) => {
    const { data, error } = await supabase.from("weights").delete().eq("id", id).select();
    if (error) { notify("Nem sikerült törölni: " + error.message, "danger"); return; }
    if (!data || data.length === 0) {
      notify("A törlést az adatbázis nem engedélyezte.", "danger");
      return;
    }
    notify("Mérés törölve.", "ok");
    await load();
  };

  const setBeers = async (date, count) => {
    const { error } = await supabase.from("beers")
      .upsert({ user_id: session.user.id, date, count }, { onConflict: "user_id,date" });
    if (error) { notify("Nem sikerült: " + error.message, "danger"); return; }
    await load();
  };

  const toggleLike = async (item) => {
    const existing = likes.find((l) =>
      l.user_id === session.user.id && l.target_type === item.type && l.target_id === item.id);
    if (existing) {
      setLikes((s) => s.filter((l) => l.id !== existing.id)); // azonnali visszajelzés
      await supabase.from("likes").delete().eq("id", existing.id);
    } else {
      const row = { user_id: session.user.id, target_type: item.type, target_id: item.id };
      setLikes((s) => [...s, { ...row, id: `tmp-${Date.now()}` }]);
      const { error } = await supabase.from("likes").insert(row);
      if (error) notify("Nem sikerült: " + error.message, "danger");
    }
    await load();
  };

  const saveProfile = async (patch) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", session.user.id);
    if (error) { notify("Mentés sikertelen: " + error.message, "danger"); return false; }
    await load();
    return true;
  };

  const changePassword = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { notify(error.message, "danger"); return false; }
    return true;
  };

  const declare = async (amount) => {
    if (amount <= 0) return;
    const { error } = await supabase.from("payments")
      .insert({ user_id: session.user.id, amount, group_id: group.id });
    if (error) { notify("Nem sikerült: " + error.message, "danger"); return; }
    notify("Rögzítve — a gazda jóváhagyására vár.", "ok");
    await load();
  };

  const approve = async (id) => {
    const { error } = await supabase.from("payments").update({ status: "paid" }).eq("id", id);
    if (error) { notify("Jóváhagyás sikertelen.", "danger"); return; }
    notify("Befizetés jóváhagyva.", "ok");
    await load();
  };

  /* --------------------------------- Nézetek ------------------------------- */
  const Toast = () => toast && (
    <div className="fixed bottom-28 left-1/2 z-40 w-11/12 max-w-sm -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg md:bottom-8"
      style={{ background: toast.tone === "danger" ? C.danger : C.ink }}>
      {toast.msg}
    </div>
  );

  const Spinner = () => (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "#fff" }}>
      <RefreshCw className="animate-spin" style={{ color: C.blue }} />
    </div>
  );

  if (loading) return <Spinner />;
  if (recovery && session) return <ResetPassword onDone={() => setRecovery(false)} />;
  if (!session) return <AuthScreen userCount={userCount} />;
  if (!me) return <Spinner />;

  if (screen === "profile") return (
    <>
      <ProfileScreen me={me} onBack={() => setScreen(openId ? "group" : "groups")}
        onSave={saveProfile} onPassword={changePassword} toast={notify} />
      <Toast />
    </>
  );

  if (!group) return (
    <>
      <GroupsScreen me={me} groups={groups} invites={invites} userCount={userCount} toast={notify}
        onOpen={(id) => { setOpenId(id); setScreen("group"); setTab("dashboard");
          try { localStorage.setItem("pc-last-group", id); } catch {} }}
        onCreate={createGroup} onAccept={acceptInvite} onDecline={declineInvite}
        onProfile={() => setScreen("profile")} onSignOut={() => supabase.auth.signOut()} />
      <Toast />
    </>
  );

  const NAV = [
    ["dashboard", "Kezdőlap", LayoutDashboard],
    ["tracker", "Rögzítés", PlusCircle],
    ["leaderboard", "Ranglista", Trophy],
    ...(group.weight_enabled ? [["weight", "Súly", Scale]] : []),
    ["wallet", group.penalty_enabled ? "Kassza" : "Csoport", Wallet],
  ];

  const go = (t) => { setTab(t); setMemberId(null); };

  return (
    <div className="min-h-screen pb-24 md:pb-8" style={{ background: "#fff" }}>
      <Ticker />
      <header className="sticky top-0 z-20"
        style={{ background: "#fff", borderBottom: `1px solid ${C.line}` }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
          <button onClick={() => { setOpenId(null); setMemberId(null); setScreen("groups");
            try { localStorage.removeItem("pc-last-group"); } catch {} }} className="rounded-lg p-1.5">
            <ArrowLeft size={18} style={{ color: C.slate }} />
          </button>
          <Logo />
          <div className="mx-2 hidden h-7 w-px md:block" style={{ background: C.line }} />
          <p className="hidden min-w-0 flex-1 truncate text-xs font-bold md:block" style={{ color: C.slate }}>
            {group.name}
          </p>
          <div className="flex-1 md:hidden" />

          <div className="hidden gap-1 lg:flex">
            {NAV.map(([k, l, Icon]) => (
              <button key={k} onClick={() => go(k)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition"
                style={{ background: tab === k ? `${C.blue}0F` : "transparent", color: tab === k ? C.blue : C.slate }}>
                <Icon size={15} /> {l}
              </button>
            ))}
          </div>

          <button onClick={() => setScreen("profile")} className="p-1" title="Profil">
            <Avatar user={me} size={32} />
          </button>
          <button onClick={load} className="rounded-lg p-1.5"><RefreshCw size={15} style={{ color: C.slate }} /></button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
        {member ? (
          <MemberView user={member} group={group} meId={me.id} onBack={() => setMemberId(null)} />
        ) : (
          <>
            {tab === "dashboard" && <DashboardView me={me} group={group} stats={stats} pool={pool} go={go}
              likes={likes} onLike={toggleLike}
              onPickDay={(d) => { setPickDate(d); setTab("tracker"); }} />}
            {tab === "tracker" && <TrackerView me={me} group={group} sports={sports} initialDate={pickDate}
              onAddSport={(s) => setSports((p) => [...p, s])} onSave={addEntry} onDelete={deleteEntry} toast={notify} />}
            {tab === "leaderboard" && <LeaderboardView group={group} meId={me.id} onOpenMember={setMemberId} />}
            {tab === "weight" && group.weight_enabled && <WeightView me={me} group={group}
              onSaveWeight={saveWeight} onDeleteWeight={deleteWeight} onToggleModule={toggleWeight}
              onToggleHide={async (v) => {
                const ok = await saveProfile({ hide_weight: v });
                if (ok) notify(v ? "Mostantól csak a változásod látszik." : "A súlyod újra látható a csapatnak.", "ok");
              }} toast={notify} />}
            {tab === "wallet" && <WalletView me={me} group={group} stats={stats} pool={pool}
              onApprove={approve} onDeclare={declare} onInvite={inviteEmail} onOpenMember={setMemberId}
              onLeave={leaveGroup} onUpdateGroup={updateGroup} onToggleWeight={toggleWeight} toast={notify} />}
          </>
        )}
      </main>

      <BeerWidget me={me} onSet={setBeers} toast={notify} />
      <Toast />
      {confetti && <Confetti onDone={() => setConfetti(false)} />}
      {confetti && <WinBanner onClose={() => setConfetti(false)} />}
      {newBadge && <BadgeModal code={newBadge.code} onClose={closeBadge} />}

      <nav className="fixed bottom-0 left-0 right-0 z-20 lg:hidden"
        style={{ background: "#fff", borderTop: `1px solid ${C.line}` }}>
        <div className="mx-auto flex max-w-3xl">
          {NAV.map(([k, l, Icon]) => {
            const on = tab === k;
            return (
              <button key={k} onClick={() => go(k)} className="flex flex-1 flex-col items-center gap-1 py-3">
                <Icon size={19} strokeWidth={on ? 2.5 : 2} style={{ color: on ? C.blue : C.slate }} />
                <span className="text-[11px] font-bold" style={{ color: on ? C.blue : C.slate }}>{l}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
