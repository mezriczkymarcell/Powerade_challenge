import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Flame, Trophy, Wallet, LayoutDashboard, PlusCircle, Upload, Check, ChevronRight,
  LogOut, AlertTriangle, Clock, Camera, X, RefreshCw, Users, UserPlus, ArrowLeft,
  Crown, Settings, User, Calendar, Target, Zap, Award, TrendingUp, Ban, DoorOpen
} from "lucide-react";

/* ============================================================================
   POWERADE CHALLENGE  ·  v4
   ========================================================================== */

const SUPABASE_URL = "https://ategpcynydszerhioegq.supabase.co";
const SUPABASE_KEY = "sb_publishable_wftKjFv9FXQEe1obFruNxg_kdTdAqnu";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "powerade-auth" },
});

const TOTAL_WEEKS = 13;
const TOTAL_DAYS = TOTAL_WEEKS * 7;
const GOAL_MALE = 4000;
const GOAL_FEMALE = 3000;
const PENALTY = 5000;
const REVOLUT_LINK = "https://revolut.me/poweradechallenge"; // <-- cseréld a valós Pool linkre

const goalOf = (u) => u?.custom_goal || (u?.gender === "female" ? GOAL_FEMALE : GOAL_MALE);

const C = {
  blue: "#007AC1", blueDeep: "#00538A", cyan: "#00E5FF", ink: "#0F172A",
  slate: "#64748B", line: "#E6EBF0", soft: "#F5F9FC",
  danger: "#EF4444", ok: "#10B981", amber: "#F59E0B",
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
const mondayOf = (s) => { const d = parse(s); const w = (d.getDay() + 6) % 7; return addDays(s, -w); };

const weekDays = (start, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i));
const weekIndexNow = (start) =>
  Math.min(Math.max(Math.floor(diffDays(TODAY, start) / 7), 0), TOTAL_WEEKS - 1);
const remainingPct = (start) => {
  const elapsed = Math.min(Math.max(diffDays(TODAY, start) + 1, 0), TOTAL_DAYS);
  return 1 - elapsed / TOTAL_DAYS;
};
const notStarted = (g) => g.start_date > TODAY;
const daysUntil = (g) => diffDays(g.start_date, TODAY);

/* ============================ HETI ZÁRÓ ALGORITMUS ======================== */
function evaluateWeek(entries, start, weekIndex, goal) {
  const days = weekDays(start, weekIndex);
  const total = days.reduce((s, d) => s + (entries[d]?.kcal || 0), 0);
  const closed = days[6] < TODAY;
  const started = days[0] <= TODAY;
  let status = "upcoming";
  if (started) {
    if (closed) status = total >= goal ? "passed" : "failed";
    else status = total >= goal ? "onTrack" : "active";
  }
  return { weekIndex, days, total, goal, status, closed, penalty: status === "failed" ? PENALTY : 0 };
}

function evaluate(user, group) {
  const goal = goalOf(user);
  const start = group.start_date;
  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, w) => evaluateWeek(user.entries, start, w, goal));
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
  const t = { ok: C.ok, danger: C.danger, amber: C.amber, blue: C.blue, slate: C.slate }[tone];
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
  <button onClick={() => onChange(!on)} className="relative h-7 w-12 rounded-full transition"
    style={{ background: on ? C.blue : C.line }}>
    <span className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all shadow"
      style={{ left: on ? 26 : 4 }} />
  </button>
);

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

/* ========================= A POWERADE PALACK (SVG) ========================= */
function PoweradeBottle({ pct, daysLeft, beforeStart }) {
  const TOP = 58, BOT = 250;
  const p = Math.max(0, Math.min(1, pct));
  const level = TOP + (BOT - TOP) * (1 - p);
  const [pops, setPops] = useState([]);
  const [pressed, setPressed] = useState(false);
  const n = useRef(0);

  const pop = () => {
    const id = ++n.current;
    const drift = (Math.random() - 0.5) * 120;
    const rot = (Math.random() - 0.5) * 24;
    setPops((s) => [...s, { id, drift, rot }]);
    setPressed(true);
    setTimeout(() => setPressed(false), 140);
    setTimeout(() => setPops((s) => s.filter((x) => x.id !== id)), 1500);
  };

  const BOTTLE = "M52 34 h46 v14 c0 7 4 11 9 16 c10 10 14 22 14 38 v128 c0 14 -10 24 -24 24 h-44 c-14 0 -24 -10 -24 -24 v-128 c0 -16 4 -28 14 -38 c5 -5 9 -9 9 -16 z";

  return (
    <div className="relative flex flex-col items-center">
      <style>{`
        @keyframes pcFly {
          0%   { opacity: 0; transform: translate(-50%, 0) scale(.7) rotate(0deg); }
          15%  { opacity: 1; transform: translate(-50%, -18px) scale(1.06) rotate(var(--r)); }
          100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), -150px) scale(.9) rotate(var(--r)); }
        }
      `}</style>

      {pops.map((x) => (
        <span key={x.id}
          className="pointer-events-none absolute left-1/2 top-6 z-10 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-black shadow-lg"
          style={{
            background: C.ink, color: C.cyan,
            "--dx": `${x.drift}px`, "--r": `${x.rot}deg`,
            animation: "pcFly 1.5s cubic-bezier(.2,.7,.3,1) forwards",
          }}>
          Szopókás poverád
        </span>
      ))}

      <svg width="150" height="280" viewBox="0 0 150 280"
        onClick={pop} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && pop()}
        className="cursor-pointer select-none"
        style={{ transform: pressed ? "scale(.94)" : "scale(1)", transition: "transform 140ms cubic-bezier(.2,.8,.2,1)" }}>
        <defs>
          <clipPath id="bottleInner"><path d={BOTTLE} /></clipPath>
          <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.cyan} />
            <stop offset="55%" stopColor={C.blue} />
            <stop offset="100%" stopColor={C.blueDeep} />
          </linearGradient>
          <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="35%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        <rect x="50" y="8" width="50" height="24" rx="6" fill={C.blueDeep} />
        <rect x="50" y="14" width="50" height="3" fill="#fff" opacity="0.25" />
        <path d={BOTTLE} fill={C.soft} />

        <g clipPath="url(#bottleInner)">
          <g style={{ transition: "transform 1200ms cubic-bezier(.2,.8,.2,1)", transform: `translateY(${level - TOP}px)` }}>
            <path d={`M-40 ${TOP} q 25 -9 50 0 t 50 0 t 50 0 t 50 0 t 50 0 V 290 H -40 Z`} fill="url(#liquid)">
              <animateTransform attributeName="transform" type="translate"
                values="0 0; 50 0; 0 0" dur="4s" repeatCount="indefinite" />
            </path>
          </g>
          <rect x="0" y="0" width="150" height="280" fill="url(#glass)" />
        </g>

        <path d={BOTTLE} fill="none" stroke={C.line} strokeWidth="2.5" />
        <rect x="29" y="132" width="92" height="46" rx="4" fill="#fff" opacity="0.92" />
        <text x="75" y="152" textAnchor="middle" fontSize="13" fontWeight="900" fill={C.blueDeep} letterSpacing="0.5">POWERADE</text>
        <text x="75" y="169" textAnchor="middle" fontSize="10" fontWeight="700" fill={C.slate}>
          {beforeStart ? "KÉSZÜLJ" : p <= 0 ? "LEJÁRT" : `${daysLeft} NAP`}
        </text>
      </svg>

      <p className="mt-1 text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>
        {beforeStart ? "Még nem indult" : p <= 0 ? "A kihívás véget ért" : `${Math.round(p * 100)}% van hátra`}
      </p>
    </div>
  );
}

/* ================================ Belépés ================================= */
function AuthScreen() {
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
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
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
            Egy hét, egy cél. Nem kell minden nap edzeni — vasárnap éjfélig kell összejönnie.
          </p>
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
            <button onClick={() => { setMode("forgot"); setMsg(null); }}
              className="text-sm font-bold" style={{ color: C.blue }}>
              Elfelejtettem a jelszavam
            </button>
          )}

          {mode === "signup" && (
            <>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Kategória</label>
                <div className="flex gap-2">
                  {[["male", "Férfi", GOAL_MALE], ["female", "Nő", GOAL_FEMALE]].map(([g, l, goal]) => {
                    const on = gender === g;
                    return (
                      <button key={g} type="button" onClick={() => setGender(g)}
                        className="flex-1 rounded-xl py-3 transition active:scale-95"
                        style={{ background: on ? `${C.blue}0F` : C.soft, border: `2px solid ${on ? C.blue : "transparent"}` }}>
                        <p className="text-sm font-bold" style={{ color: on ? C.blue : C.ink }}>{l}</p>
                        <p className="text-xs font-semibold" style={{ color: C.slate }}>heti {goal} kcal</p>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs" style={{ color: C.slate }}>
                  A heti célod később a profilodban egyedire állítható.
                </p>
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
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Kategória</label>
              <div className="flex gap-2">
                {[["male", "Férfi", GOAL_MALE], ["female", "Nő", GOAL_FEMALE]].map(([g, l, goal]) => {
                  const on = gender === g;
                  return (
                    <button key={g} type="button" onClick={() => setGender(g)}
                      className="flex-1 rounded-xl py-3 transition active:scale-95"
                      style={{ background: on ? `${C.blue}0F` : C.soft, border: `2px solid ${on ? C.blue : "transparent"}` }}>
                      <p className="text-sm font-bold" style={{ color: on ? C.blue : C.ink }}>{l}</p>
                      <p className="text-xs font-semibold" style={{ color: C.slate }}>heti {goal} kcal</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: C.soft }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold" style={{ color: C.ink }}>Egyedi heti cél</p>
                  <p className="text-xs" style={{ color: C.slate }}>Felülírja a kategória szerinti célt.</p>
                </div>
                <Toggle on={customOn} onChange={setCustomOn} />
              </div>
              {customOn && (
                <div className="mt-3">
                  <Field type="number" inputMode="numeric" value={custom} placeholder="pl. 2500"
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
function GroupsScreen({ me, groups, invites, onOpen, onCreate, onAccept, onDecline, onSignOut, onProfile, toast }) {
  const [creating, setCreating] = useState(false);
  const [gname, setGname] = useState("");
  const [gstart, setGstart] = useState(mondayOf(TODAY));
  const [gpenalty, setGpenalty] = useState(true);
  const [ggoal, setGgoal] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!gname.trim()) return toast("Adj nevet a csoportnak.", "danger");
    setBusy(true);
    const ok = await onCreate({
      name: gname.trim(), start_date: mondayOf(gstart),
      penalty_enabled: gpenalty, goal_text: ggoal.trim() || null,
    });
    setBusy(false);
    if (ok) { setGname(""); setGgoal(""); setCreating(false); toast("Csoport létrehozva. Hívd meg a többieket!", "ok"); }
  };

  return (
    <div className="min-h-screen px-5 py-8" style={{ background: "#fff" }}>
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <button onClick={onProfile} className="flex items-center gap-3 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: C.soft }}>{me.emoji}</div>
            <div>
              <p className="text-lg font-black" style={{ color: C.ink }}>{me.name}</p>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.blue }}>
                Heti cél: {goalOf(me).toLocaleString("hu-HU")} kcal
              </p>
            </div>
          </button>
          <div className="flex gap-1">
            <button onClick={onProfile} className="rounded-lg p-2" title="Profil"><User size={18} style={{ color: C.slate }} /></button>
            <button onClick={onSignOut} className="rounded-lg p-2" title="Kilépés"><LogOut size={18} style={{ color: C.slate }} /></button>
          </div>
        </div>

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
            <Field label="Kezdés" type="date" value={gstart} min={TODAY}
              onChange={(e) => setGstart(e.target.value)}
              hint={`A kihívás mindig hétfőn indul. A választott naphoz tartozó hétfő: ${fmtLong(mondayOf(gstart))}`} />

            <div className="rounded-xl p-4" style={{ background: C.soft }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold" style={{ color: C.ink }}>Pénzbüntetés</p>
                  <p className="text-xs" style={{ color: C.slate }}>Bukott hetenként {money(PENALTY)} a közös kasszába.</p>
                </div>
                <Toggle on={gpenalty} onChange={setGpenalty} />
              </div>
            </div>

            {gpenalty && (
              <Field label="Erre költjük az összegyűlt pénzt" value={ggoal} placeholder="pl. Közös hétvége Bükkben"
                onChange={(e) => setGgoal(e.target.value)} />
            )}

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
              const pct = remainingPct(g.start_date);
              return (
                <Card key={g.id} className="cursor-pointer p-5 transition hover:opacity-90" onClick={() => onOpen(g.id)}>
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-lg font-black" style={{ color: C.ink }}>{g.name}</p>
                    {g.owner_id === me.id && <Crown size={14} style={{ color: C.amber }} />}
                    {!g.penalty_enabled && <Pill tone="slate"><Ban size={11} /> tét nélkül</Pill>}
                  </div>
                  <p className="mt-0.5 text-xs font-semibold" style={{ color: pre ? C.amber : C.slate }}>
                    {pre ? `Indulásig ${daysUntil(g)} nap` : `${wk}. hét / ${TOTAL_WEEKS}`} · {g.members.length} tag
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-1">
                    {g.members.slice(0, 8).map((m) => (
                      <span key={m.id} title={m.name} className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
                        style={{ background: C.soft }}>{m.emoji}</span>
                    ))}
                    {g.members.length > 8 && <span className="text-xs font-bold" style={{ color: C.slate }}>+{g.members.length - 8}</span>}
                  </div>

                  <div className="mt-4">
                    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: C.soft }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${(1 - pct) * 100}%`, background: `linear-gradient(90deg, ${C.blue}, ${C.cyan})` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
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
      </div>
    </div>
  );
}

/* ============================ Heti köríves mutató ========================= */
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
        <circle cx="80" cy="80" r={R} fill="none" stroke="url(#ring)" strokeWidth="14" strokeLinecap="round"
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
function ThreeMonthGrid({ entries, weeks, cw, onPick }) {
  return (
    <div className="space-y-2">
      {weeks.map((w) => (
        <div key={w.weekIndex} className="flex items-center gap-3">
          <div className="w-12 shrink-0 text-right text-xs font-bold tabular-nums"
            style={{ color: w.weekIndex === cw ? C.blue : C.slate }}>{w.weekIndex + 1}. hét</div>
          <div className="flex flex-1 gap-1">
            {w.days.map((d) => {
              const k = entries[d]?.kcal || 0;
              const future = d > TODAY;
              const bg = future ? "#fff" : k >= 700 ? C.blue : k >= 400 ? "#4FA8DA" : k > 0 ? "#A9D8F0" : C.soft;
              return (
                <button key={d} title={`${fmtHU(d)} — ${k} kcal`} disabled={future}
                  onClick={() => !future && onPick?.(d)}
                  className="h-6 flex-1 rounded-md transition hover:opacity-70"
                  style={{ background: bg, border: `1px solid ${future ? C.line : "transparent"}` }} />
              );
            })}
          </div>
          <div className="w-14 shrink-0 text-right text-xs font-bold tabular-nums" style={{ color: C.slate }}>
            {w.status === "upcoming" ? "—" : w.total}
          </div>
          <div className="w-5 shrink-0">
            {w.status === "failed" && <X size={16} strokeWidth={3} style={{ color: C.danger }} />}
            {w.status === "passed" && <Check size={16} strokeWidth={3} style={{ color: C.ok }} />}
            {(w.status === "active" || w.status === "onTrack") && <Clock size={14} style={{ color: C.blue }} />}
          </div>
        </div>
      ))}
      <p className="pt-1 text-xs" style={{ color: C.slate }}>Kattints egy napra, ha utólag pótolnád.</p>
    </div>
  );
}

/* =============================== Dashboard ================================ */
function DashboardView({ me, group, stats, pool, go, onPickDay }) {
  const pre = notStarted(group);
  const cw = weekIndexNow(group.start_date);
  const week = stats.weeks[cw];
  const daysLeftWeek = week.days.filter((d) => d >= TODAY).length;
  const missing = Math.max(stats.goal - week.total, 0);
  const urgent = !pre && missing > 0 && daysLeftWeek <= 2;
  const pct = pre ? 1 : remainingPct(group.start_date);
  const daysLeftAll = Math.max(TOTAL_DAYS - (diffDays(TODAY, group.start_date) + 1), 0);

  return (
    <div className="space-y-5">
      <Card className="flex flex-col items-center p-6">
        <SectionTitle>A kihívás</SectionTitle>
        <PoweradeBottle pct={pct} daysLeft={daysLeftAll} beforeStart={pre} />
        {pre && (
          <div className="mt-3 rounded-xl px-4 py-3 text-center" style={{ background: `${C.amber}12` }}>
            <p className="text-sm font-black" style={{ color: C.ink }}>
              Már csak {daysUntil(group)} nap az indulásig
            </p>
            <p className="text-xs font-semibold" style={{ color: C.slate }}>Rajt: {fmtLong(group.start_date)}</p>
          </div>
        )}
      </Card>

      {!pre && (
        <Card className="p-6">
          <SectionTitle right={
            <Pill tone={week.total >= stats.goal ? "ok" : "blue"}>
              {week.total >= stats.goal ? "Cél teljesítve" : "Folyamatban"}
            </Pill>}>
            {cw + 1}. hét · {fmtHU(week.days[0])}–{fmtHU(week.days[6])}
          </SectionTitle>

          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
            <WeeklyRing kcal={week.total} goal={stats.goal} />
            <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-1">
              <div className="rounded-xl p-4" style={{ background: C.soft }}>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Hiányzik</div>
                <div className="mt-1 text-3xl font-black tabular-nums" style={{ color: C.blue }}>{missing}</div>
                <div className="text-xs font-semibold" style={{ color: C.slate }}>{daysLeftWeek} nap van hátra</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: C.soft }}>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>
                  <Flame size={14} /> Streak
                </div>
                <div className="mt-1 text-3xl font-black tabular-nums" style={{ color: C.ink }}>
                  {stats.streak}<span className="text-base font-bold" style={{ color: C.slate }}> nap</span>
                </div>
              </div>
            </div>
          </div>

          {urgent && (
            <div className="mt-5 flex items-center gap-3 rounded-xl p-4" style={{ background: `${C.amber}12` }}>
              <AlertTriangle size={18} style={{ color: C.amber }} />
              <p className="flex-1 text-sm font-semibold" style={{ color: C.ink }}>
                Még {missing} kcal hiányzik, és csak {daysLeftWeek} nap van hátra.
              </p>
              <Button variant="soft" onClick={() => go("tracker")}>Rögzítés</Button>
            </div>
          )}
        </Card>
      )}

      {group.penalty_enabled && (
        <Card className="p-6" style={{ background: `linear-gradient(135deg, ${C.blueDeep}, ${C.blue})`, border: "none" }}>
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.cyan }}>Közös kassza · Revolut</p>
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
          <ThreeMonthGrid entries={me.entries} weeks={stats.weeks} cw={cw} onPick={onPickDay} />
        </Card>
      )}
    </div>
  );
}

/* ================================ Tracker ================================= */
function TrackerView({ me, group, sports, onAddSport, onSave, toast, initialDate }) {
  const [date, setDate] = useState(initialDate || TODAY);
  const [kcal, setKcal] = useState("");
  const [sport, setSport] = useState(sports[0]);
  const [custom, setCustom] = useState("");
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { if (initialDate) setDate(initialDate); }, [initialDate]);

  const existing = me.entries[date];
  useEffect(() => {
    setKcal(existing ? String(existing.kcal) : "");
    setSport(existing?.sport || sports[0]);
    setPreview(existing?.proof_url || null);
    setFile(null);
  }, [date]); // eslint-disable-line

  const save = async () => {
    const n = parseInt(kcal, 10);
    if (!n || n <= 0) return toast("Adj meg egy 0-nál nagyobb kalóriaértéket.", "danger");
    setBusy(true);
    const ok = await onSave(date, n, sport, file);
    setBusy(false);
    if (ok) toast(`${fmtHU(date)} rögzítve: ${n} kcal (${sport})`, "ok");
  };

  const addSport = () => {
    const s = custom.trim();
    if (!s) return;
    onAddSport(s); setSport(s); setCustom(""); setAdding(false);
  };

  const cw = weekIndexNow(group.start_date);
  const isPast = date < TODAY;

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <SectionTitle right={isPast && <Pill tone="amber"><Clock size={11} /> Utólagos</Pill>}>Napi aktivitás</SectionTitle>
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
            <p className="mt-2 text-xs" style={{ color: C.slate }}>
              Nem kell minden nap edzeni — csak a heti összeg számít. Elfelejtett napot utólag is pótolhatsz.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Elégetett kalória</label>
            <div className="relative">
              <input type="number" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="0"
                className="w-full rounded-xl px-4 py-4 text-3xl font-black tabular-nums outline-none"
                style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: C.slate }}>kcal</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Sportág</label>
            {!adding ? (
              <div className="flex gap-2">
                <select value={sport} onChange={(e) => setSport(e.target.value)}
                  className="flex-1 rounded-xl px-4 py-3 text-base outline-none"
                  style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }}>
                  {sports.map((s) => <option key={s} value={s}>{s}</option>)}
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
            <Upload size={18} /> {busy ? "Mentés…" : existing ? "Nap frissítése" : "Nap rögzítése"}
          </Button>
        </div>
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
                <span className="w-14 text-xs font-bold uppercase" style={{ color: C.slate }}>
                  {parse(d).toLocaleDateString("hu-HU", { weekday: "short" })}
                </span>
                <span className="flex-1 text-sm font-semibold" style={{ color: e ? C.ink : C.slate }}>
                  {e ? e.sport : future ? "—" : "Pihenőnap"}
                </span>
                {e?.proof_url && <Camera size={14} style={{ color: C.slate }} />}
                <span className="text-sm font-black tabular-nums" style={{ color: e ? C.blue : C.line }}>
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

/* =========================== Kiemelkedő statisztikák ====================== */
function HighlightStats({ group }) {
  const stats = useMemo(() => {
    const start = group.start_date;
    const end = addDays(start, TOTAL_DAYS - 1);
    const rows = group.members.map((u) => ({ u, ev: evaluate(u, group) }));

    // Legjobb nap
    let bestDay = null;
    rows.forEach(({ u }) => Object.entries(u.entries).forEach(([d, e]) => {
      if (d >= start && d <= end && (!bestDay || e.kcal > bestDay.kcal)) bestDay = { name: u.name, emoji: u.emoji, kcal: e.kcal, date: d };
    }));

    // Legaktívabb hét (csoportszinten)
    let bestWeek = null;
    for (let w = 0; w < TOTAL_WEEKS; w++) {
      const days = weekDays(start, w);
      if (days[0] > TODAY) break;
      const total = rows.reduce((s, { u }) => s + days.reduce((x, d) => x + (u.entries[d]?.kcal || 0), 0), 0);
      if (total > 0 && (!bestWeek || total > bestWeek.total)) bestWeek = { w: w + 1, total, days };
    }

    // Leghosszabb streak
    const bestStreak = rows.reduce((b, { u, ev }) => (!b || ev.streak > b.streak ? { name: u.name, emoji: u.emoji, streak: ev.streak } : b), null);

    // Legfegyelmezettebb (legtöbb teljesített hét)
    const bestDiscipline = rows.map(({ u, ev }) => ({
      name: u.name, emoji: u.emoji, passed: ev.weeks.filter((w) => w.status === "passed").length,
    })).sort((a, b) => b.passed - a.passed)[0];

    // Csoport összesen + kedvenc sport
    const totalKcal = rows.reduce((s, { ev }) => s + ev.totalKcal, 0);
    const sportCount = {};
    rows.forEach(({ u }) => Object.entries(u.entries).forEach(([d, e]) => {
      if (d >= start && d <= end) sportCount[e.sport] = (sportCount[e.sport] || 0) + 1;
    }));
    const topSport = Object.entries(sportCount).sort((a, b) => b[1] - a[1])[0];

    return { bestDay, bestWeek, bestStreak, bestDiscipline, totalKcal, topSport };
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

  if (!stats.bestDay) return null;

  return (
    <Card className="p-6">
      <SectionTitle>Rekordok</SectionTitle>
      <div className="space-y-2">
        <Row icon={Zap} tone={C.amber} label="Legtöbb kalória egy nap alatt"
          value={`${stats.bestDay.emoji} ${stats.bestDay.name} — ${stats.bestDay.kcal.toLocaleString("hu-HU")} kcal`}
          sub={fmtHU(stats.bestDay.date)} />
        {stats.bestWeek && (
          <Row icon={TrendingUp} label="Legaktívabb hét"
            value={`${stats.bestWeek.w}. hét — ${stats.bestWeek.total.toLocaleString("hu-HU")} kcal`}
            sub={`${fmtHU(stats.bestWeek.days[0])}–${fmtHU(stats.bestWeek.days[6])}`} />
        )}
        {stats.bestStreak?.streak > 0 && (
          <Row icon={Flame} tone={C.danger} label="Leghosszabb aktív sorozat"
            value={`${stats.bestStreak.emoji} ${stats.bestStreak.name}`} sub={`${stats.bestStreak.streak} nap`} />
        )}
        {stats.bestDiscipline?.passed > 0 && (
          <Row icon={Award} tone={C.ok} label="Legfegyelmezettebb"
            value={`${stats.bestDiscipline.emoji} ${stats.bestDiscipline.name}`}
            sub={`${stats.bestDiscipline.passed} teljesített hét`} />
        )}
        {stats.topSport && (
          <Row icon={Trophy} label="A csapat kedvenc sportja" value={stats.topSport[0]} sub={`${stats.topSport[1]} alkalom`} />
        )}
        <Row icon={Users} tone={C.blueDeep} label="A csapat összesen"
          value={`${stats.totalKcal.toLocaleString("hu-HU")} kcal`} />
      </div>
    </Card>
  );
}

/* ============================== Ranglista ================================= */
function LeaderboardView({ group, meId }) {
  const [tab, setTab] = useState("week");
  const cw = weekIndexNow(group.start_date);

  const rows = useMemo(() => group.members.map((u) => {
    const s = evaluate(u, group);
    const weekKcal = s.weeks[cw].total;
    return {
      id: u.id, name: u.name, emoji: u.emoji, goal: s.goal,
      kcal: tab === "week" ? weekKcal : s.totalKcal,
      done: weekKcal >= s.goal, paid: s.paid, debt: s.debt + s.pending,
      failed: s.weeks.filter((w) => w.status === "failed").length,
    };
  }).sort((a, b) => b.kcal - a.kcal), [group, tab, cw]);

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
        <div className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider"
          style={{ background: C.soft, color: C.slate }}>
          <span className="w-6">#</span><span className="flex-1">Név</span>
          <span className="w-20 text-right">kcal</span>
          {pen && <span className="w-24 text-right">Befizetve</span>}
        </div>
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3"
            style={{ borderTop: `1px solid ${C.line}`, background: r.id === meId ? `${C.cyan}0F` : "#fff" }}>
            <span className="w-6 text-base font-black tabular-nums" style={{ color: i === 0 ? C.blue : C.slate }}>{i + 1}</span>
            <span className="text-2xl">{r.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold" style={{ color: C.ink }}>
                {r.name}{r.id === meId && <span className="ml-1 text-xs font-bold" style={{ color: C.blue }}>· te</span>}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                {tab === "week" && (r.done ? <Pill tone="ok"><Check size={11} /> Megvan</Pill>
                  : <Pill tone="blue">cél: {r.goal.toLocaleString("hu-HU")}</Pill>)}
                {pen && (r.debt > 0 ? <Pill tone="danger">Tartozás {money(r.debt)}</Pill> : <Pill tone="ok">Rendezve</Pill>)}
                {r.failed > 0 && <span className="text-xs font-semibold" style={{ color: C.slate }}>{r.failed} bukott hét</span>}
              </div>
            </div>
            <span className="w-20 text-right text-sm font-black tabular-nums" style={{ color: C.ink }}>
              {r.kcal.toLocaleString("hu-HU")}
            </span>
            {pen && (
              <span className="w-24 text-right text-sm font-bold tabular-nums" style={{ color: r.paid ? C.ok : C.slate }}>
                {money(r.paid)}
              </span>
            )}
          </div>
        ))}
      </Card>

      <HighlightStats group={group} />
    </div>
  );
}

/* ============================== Kassza / Tagok ============================ */
function WalletView({ me, group, stats, pool, onDeclare, onApprove, onInvite, onLeave, onUpdateGroup, toast }) {
  const failed = stats.weeks.filter((w) => w.status === "failed");
  const isOwner = group.owner_id === me.id;
  const pen = group.penalty_enabled;
  const pendingAll = group.members.flatMap((u) =>
    u.payments.filter((p) => p.group_id === group.id && p.status === "pending").map((p) => ({ ...p, user: u })));

  const [invEmail, setInvEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [gPen, setGPen] = useState(group.penalty_enabled);
  const [gGoal, setGGoal] = useState(group.goal_text || "");
  const [gStart, setGStart] = useState(group.start_date);

  const invite = async () => {
    if (!/^\S+@\S+\.\S+$/.test(invEmail.trim())) return toast("Adj meg egy érvényes e-mail-címet.", "danger");
    setBusy(true);
    const ok = await onInvite(invEmail.trim());
    setBusy(false);
    if (ok) { setInvEmail(""); toast("Meghívó elküldve.", "ok"); }
  };

  const saveGroup = async () => {
    const patch = { penalty_enabled: gPen, goal_text: gGoal.trim() || null };
    if (notStarted(group)) patch.start_date = mondayOf(gStart);
    const ok = await onUpdateGroup(patch);
    if (ok) toast("Csoport beállításai mentve.", "ok");
  };

  return (
    <div className="space-y-5">
      {pen ? (
        <Card className="p-6">
          <SectionTitle>Az én egyenlegem</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            {[["Összes büntetés", stats.penalties, C.ink],
              ["Befizetve", stats.paid, C.ok],
              ["Tartozás", stats.debt, stats.debt ? C.danger : C.slate]].map(([l, v, col]) => (
              <div key={l} className="rounded-xl p-3" style={{ background: C.soft }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>{l}</p>
                <p className="mt-1 text-lg font-black tabular-nums" style={{ color: col }}>{money(v)}</p>
              </div>
            ))}
          </div>

          {group.goal_text && (
            <div className="mt-4 flex items-center gap-2 rounded-xl p-3" style={{ background: `${C.cyan}12` }}>
              <Target size={16} style={{ color: C.blueDeep }} />
              <p className="text-sm font-semibold" style={{ color: C.ink }}>
                Erre költjük: <b>{group.goal_text}</b>
              </p>
            </div>
          )}

          {stats.pending > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-xl p-3" style={{ background: `${C.amber}12` }}>
              <Clock size={16} style={{ color: C.amber }} />
              <p className="text-sm font-semibold" style={{ color: C.ink }}>{money(stats.pending)} jóváhagyásra vár.</p>
            </div>
          )}

          <div className="mt-5 space-y-2">
            <Button className="w-full py-4 text-base" onClick={() => window.open(REVOLUT_LINK, "_blank")}>
              <Wallet size={18} /> Fizetés a Revolut kasszába
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => onDeclare(stats.debt)} disabled={stats.debt <= 0}>
              <Check size={16} /> Igazolom a befizetést ({money(stats.debt)})
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="flex items-center gap-3 p-6">
          <Ban size={20} style={{ color: C.slate }} />
          <p className="text-sm font-semibold" style={{ color: C.ink }}>
            Ebben a csoportban nincs pénzbüntetés. Csak a becsület a tét.
          </p>
        </Card>
      )}

      {isOwner && pen && (
        <Card className="p-6">
          <SectionTitle right={<Pill tone="amber"><Crown size={12} /> Csoportgazda</Pill>}>Jóváhagyásra vár</SectionTitle>
          {pendingAll.length === 0 ? (
            <p className="py-4 text-center text-sm font-semibold" style={{ color: C.slate }}>Nincs függő befizetés.</p>
          ) : (
            <div className="space-y-2">
              {pendingAll.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ border: `1px solid ${C.line}` }}>
                  <span className="text-xl">{p.user.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: C.ink }}>{p.user.name}</p>
                    <p className="text-xs" style={{ color: C.slate }}>{money(p.amount)}</p>
                  </div>
                  <Button onClick={() => onApprove(p.id)} className="px-3 py-2"><Check size={14} /> Megérkezett</Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="p-6">
        <SectionTitle right={<span className="text-xs font-bold" style={{ color: C.slate }}>{group.members.length} tag</span>}>
          Tagok és meghívás
        </SectionTitle>
        <div className="mb-4 space-y-1">
          {group.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-1.5">
              <span className="text-xl">{m.emoji}</span>
              <span className="flex-1 text-sm font-semibold" style={{ color: C.ink }}>{m.name}</span>
              {m.id === group.owner_id && <Crown size={13} style={{ color: C.amber }} />}
              <span className="text-xs font-bold" style={{ color: C.slate }}>{goalOf(m)} kcal</span>
            </div>
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
            <div className="flex items-center justify-between gap-3 rounded-xl p-4" style={{ background: C.soft }}>
              <div>
                <p className="text-sm font-bold" style={{ color: C.ink }}>Pénzbüntetés</p>
                <p className="text-xs" style={{ color: C.slate }}>Bukott hetenként {money(PENALTY)}.</p>
              </div>
              <Toggle on={gPen} onChange={setGPen} />
            </div>

            {gPen && (
              <Field label="Erre költjük az összegyűlt pénzt" value={gGoal} placeholder="pl. Közös hétvége Bükkben"
                onChange={(e) => setGGoal(e.target.value)} />
            )}

            {notStarted(group) && (
              <Field label="Kezdés" type="date" value={gStart} min={TODAY}
                onChange={(e) => e.target.value && setGStart(e.target.value)}
                hint={`Hétfőre igazítva: ${fmtLong(mondayOf(gStart))}`} />
            )}

            <Button onClick={saveGroup} className="w-full">Beállítások mentése</Button>
          </div>
        </Card>
      )}

      {pen && failed.length > 0 && (
        <Card className="p-6">
          <SectionTitle right={<span className="text-xs font-bold" style={{ color: C.slate }}>{money(pool)} a kasszában</span>}>
            Büntetés-történet
          </SectionTitle>
          <div className="space-y-2">
            {failed.map((w) => (
              <div key={w.weekIndex} className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ border: `1px solid ${C.line}` }}>
                <X size={16} strokeWidth={3} style={{ color: C.danger }} />
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: C.ink }}>
                    {w.weekIndex + 1}. hét · {fmtHU(w.days[0])}–{fmtHU(w.days[6])}
                  </p>
                  <p className="text-xs" style={{ color: C.slate }}>{w.total} / {w.goal} kcal</p>
                </div>
                <span className="text-sm font-black tabular-nums" style={{ color: C.danger }}>{money(PENALTY)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!isOwner && (
        <Card className="p-6">
          <SectionTitle>Kilépés</SectionTitle>
          <p className="mb-4 text-sm" style={{ color: C.slate }}>
            Kiléphetsz a csoportból. Az adataid megmaradnak: ha újra meghívnak, minden ott folytatódik, ahol abbahagytad.
          </p>
          <Button variant="danger" className="w-full" onClick={onLeave}>
            <DoorOpen size={16} /> Kilépek a csoportból
          </Button>
        </Card>
      )}
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
  const [sports, setSports] = useState(DEFAULT_SPORTS);
  const [openId, setOpenId] = useState(null);
  const [screen, setScreen] = useState("groups"); // groups | profile | group
  const [tab, setTab] = useState("dashboard");
  const [pickDate, setPickDate] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = (msg, tone = "ok") => { setToast({ msg, tone }); setTimeout(() => setToast(null), 3000); };

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
    const [pr, en, pa, gr, gm, inv] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("entries").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("groups").select("*"),
      supabase.from("group_members").select("*"),
      supabase.from("invites").select("*"),
    ]);
    const bad = [pr, en, pa, gr, gm, inv].find((r) => r.error);
    if (bad) { notify("Betöltési hiba: " + bad.error.message, "danger"); return; }

    const users = (pr.data || []).map((p) => ({
      ...p,
      entries: Object.fromEntries((en.data || []).filter((x) => x.user_id === p.id).map((x) => [x.date, x])),
      payments: (pa.data || []).filter((x) => x.user_id === p.id),
    }));
    setProfiles(users);

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
  const stats = useMemo(() => (me && group ? evaluate(me, group) : null), [me, group]);
  const pool = useMemo(() => !group ? 0 : group.members.flatMap((m) => m.payments)
    .filter((p) => p.group_id === group.id && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0), [group]);

  const createGroup = async (g) => {
    const { data, error } = await supabase.from("groups")
      .insert({ ...g, owner_id: session.user.id }).select().single();
    if (error) { notify("Nem sikerült: " + error.message, "danger"); return false; }
    const { error: e2 } = await supabase.from("group_members")
      .upsert({ group_id: data.id, user_id: session.user.id, left_at: null }, { onConflict: "group_id,user_id" });
    if (e2) { notify("Nem sikerült csatlakozni: " + e2.message, "danger"); return false; }
    await load();
    return true;
  };

  const updateGroup = async (patch) => {
    const { error } = await supabase.from("groups").update(patch).eq("id", group.id);
    if (error) { notify("Nem sikerült: " + error.message, "danger"); return false; }
    await load();
    return true;
  };

  const acceptInvite = async (inv) => {
    const { error } = await supabase.from("group_members")
      .upsert({ group_id: inv.group_id, user_id: session.user.id, left_at: null }, { onConflict: "group_id,user_id" });
    if (error) { notify("Nem sikerült csatlakozni: " + error.message, "danger"); return; }
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
    notify("Kiléptél a csoportból. Az adataid megmaradtak.", "ok");
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

  const saveEntry = async (date, kcal, sport, file) => {
    let proof_url = me.entries[date]?.proof_url || null;
    if (file) {
      const path = `${session.user.id}/${date}-${Date.now()}`;
      const { error } = await supabase.storage.from("proofs").upload(path, file, { upsert: true });
      if (error) { notify("A kép feltöltése nem sikerült.", "danger"); return false; }
      proof_url = supabase.storage.from("proofs").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("entries")
      .upsert({ user_id: session.user.id, date, kcal, sport, proof_url }, { onConflict: "user_id,date" });
    if (error) { notify("Mentés sikertelen: " + error.message, "danger"); return false; }
    await load();
    return true;
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
    notify("Befizetés igazolva — jóváhagyásra vár.", "ok");
    await load();
  };

  const approve = async (id) => {
    const { error } = await supabase.from("payments").update({ status: "paid" }).eq("id", id);
    if (error) { notify("Jóváhagyás sikertelen.", "danger"); return; }
    notify("Befizetés jóváhagyva.", "ok");
    await load();
  };

  const Toast = () => toast && (
    <div className="fixed bottom-24 left-1/2 z-40 w-11/12 max-w-sm -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg md:bottom-6"
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
  if (!session) return <AuthScreen />;
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
      <GroupsScreen me={me} groups={groups} invites={invites} toast={notify}
        onOpen={(id) => { setOpenId(id); setScreen("group"); setTab("dashboard"); }}
        onCreate={createGroup} onAccept={acceptInvite} onDecline={declineInvite}
        onProfile={() => setScreen("profile")}
        onSignOut={() => supabase.auth.signOut()} />
      <Toast />
    </>
  );

  const NAV = [
    ["dashboard", "Kezdőlap", LayoutDashboard],
    ["tracker", "Rögzítés", PlusCircle],
    ["leaderboard", "Ranglista", Trophy],
    ["wallet", group.penalty_enabled ? "Kassza" : "Csoport", Wallet],
  ];

  return (
    <div className="min-h-screen pb-24 md:pb-8" style={{ background: "#fff" }}>
      <header className="sticky top-0 z-20 backdrop-blur"
        style={{ background: "rgba(255,255,255,.85)", borderBottom: `1px solid ${C.line}` }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-3">
          <button onClick={() => { setOpenId(null); setScreen("groups"); }} className="rounded-lg p-2">
            <ArrowLeft size={18} style={{ color: C.slate }} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black" style={{ color: C.ink }}>{group.name}</p>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.blue }}>
              Heti cél: {goalOf(me).toLocaleString("hu-HU")} kcal
            </p>
          </div>
          <div className="hidden gap-1 md:flex">
            {NAV.map(([k, l, Icon]) => (
              <button key={k} onClick={() => setTab(k)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition"
                style={{ background: tab === k ? `${C.blue}0F` : "transparent", color: tab === k ? C.blue : C.slate }}>
                <Icon size={16} /> {l}
              </button>
            ))}
          </div>
          <button onClick={() => setScreen("profile")} className="rounded-lg p-2" title="Profil">
            <User size={18} style={{ color: C.slate }} />
          </button>
          <button onClick={load} className="rounded-lg p-2"><RefreshCw size={16} style={{ color: C.slate }} /></button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
        {tab === "dashboard" && <DashboardView me={me} group={group} stats={stats} pool={pool} go={setTab}
          onPickDay={(d) => { setPickDate(d); setTab("tracker"); }} />}
        {tab === "tracker" && <TrackerView me={me} group={group} sports={sports} initialDate={pickDate}
          onAddSport={(s) => setSports((p) => [...p, s])} onSave={saveEntry} toast={notify} />}
        {tab === "leaderboard" && <LeaderboardView group={group} meId={me.id} />}
        {tab === "wallet" && <WalletView me={me} group={group} stats={stats} pool={pool}
          onDeclare={declare} onApprove={approve} onInvite={inviteEmail}
          onLeave={leaveGroup} onUpdateGroup={updateGroup} toast={notify} />}
      </main>

      <Toast />

      <nav className="fixed bottom-0 left-0 right-0 z-20 md:hidden"
        style={{ background: "#fff", borderTop: `1px solid ${C.line}` }}>
        <div className="mx-auto flex max-w-3xl">
          {NAV.map(([k, l, Icon]) => {
            const on = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)} className="flex flex-1 flex-col items-center gap-1 py-3">
                <Icon size={20} strokeWidth={on ? 2.5 : 2} style={{ color: on ? C.blue : C.slate }} />
                <span className="text-xs font-bold" style={{ color: on ? C.blue : C.slate }}>{l}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
