import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Flame, Trophy, Wallet, LayoutDashboard, PlusCircle, Upload, Check,
  ChevronRight, LogOut, AlertTriangle, Clock, Camera, X
} from "lucide-react";

/* ============================================================================
   POWERADE CHALLENGE
   ----------------------------------------------------------------------------
   Szabályok:
   - 3 hónap (13 hét), hétfő–vasárnap ciklusok.
   - Heti cél: 4000 kcal sporttal.
   - Minden nap kötelező mozogni. Egy 0 kcal-os (eltelt) nap = azonnali heti bukás.
   - Bukott hét = 5000 Ft büntetés a közös Revolut kasszába.
   ========================================================================== */

/* ---------------------------------- Brand --------------------------------- */
const C = {
  blue: "#007AC1",
  blueDeep: "#00538A",
  cyan: "#00E5FF",
  ink: "#0F172A",
  slate: "#64748B",
  line: "#E6EBF0",
  soft: "#F5F9FC",
  danger: "#EF4444",
  ok: "#10B981",
  amber: "#F59E0B",
};

const WEEKLY_GOAL = 4000;
const PENALTY = 5000;
const CHALLENGE_START = "2026-06-01"; // hétfő
const TOTAL_WEEKS = 13;
const REVOLUT_LINK = "https://revolut.me/poweradechallenge"; // <-- ide jön a valós Pool link

const DEFAULT_SPORTS = ["Futás", "Bringa", "Kondi", "Úszás"];
const EMOJIS = ["🏃‍♂️","🏃‍♀️","🚴‍♂️","🚴‍♀️","🏋️‍♂️","🏋️‍♀️","🏊‍♂️","🏊‍♀️","⚽","🏀","🎾","🥊","🧗","⛷️","🛹","🤸","🚶‍♂️","🧘","🥇","🔥"];

/* ------------------------------ Dátum-segédek ----------------------------- */
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const TODAY = iso(new Date());

/** Adott hét (0-indexelt) napjai, hétfőtől vasárnapig. */
const weekDays = (w) => Array.from({ length: 7 }, (_, i) => addDays(CHALLENGE_START, w * 7 + i));
/** Melyik hétben vagyunk most (klippelve a kihívás hosszára). */
const currentWeekIndex = () => {
  const diff = Math.floor((parse(TODAY) - parse(CHALLENGE_START)) / 86400000);
  return Math.min(Math.max(Math.floor(diff / 7), 0), TOTAL_WEEKS - 1);
};
const fmtHU = (s) => parse(s).toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
const money = (n) => `${n.toLocaleString("hu-HU")} Ft`;

/* ==========================================================================
   HETI ZÁRÓ ALGORITMUS  — a pénzügyi modul szíve
   ========================================================================== */
function evaluateWeek(entries, weekIndex) {
  const days = weekDays(weekIndex);
  const total = days.reduce((s, d) => s + (entries[d]?.kcal || 0), 0);
  const elapsed = days.filter((d) => d <= TODAY);           // már eltelt / mai napok
  const closed = days[6] < TODAY;                            // vasárnap éjfél elmúlt
  const missedDay = elapsed.some((d) => d < TODAY && !(entries[d]?.kcal > 0)); // 0 kcal-os múltbeli nap
  const started = days[0] <= TODAY;

  let status = "upcoming";
  if (started) {
    if (missedDay) status = "failed";                        // azonnali bukás
    else if (closed) status = total >= WEEKLY_GOAL ? "passed" : "failed";
    else status = total >= WEEKLY_GOAL ? "onTrack" : "active";
  }
  return { weekIndex, days, total, status, missedDay, closed, penalty: status === "failed" ? PENALTY : 0 };
}

function evaluateUser(user) {
  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, w) => evaluateWeek(user.entries, w));
  const penalties = weeks.reduce((s, w) => s + w.penalty, 0);
  const paid = user.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pending = user.payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const debt = Math.max(penalties - paid - pending, 0);

  // Streak: mai naptól visszafelé az utolsó megszakítatlan mozgás-sorozat.
  let streak = 0;
  let cur = user.entries[TODAY]?.kcal > 0 ? TODAY : addDays(TODAY, -1);
  while (cur >= CHALLENGE_START && user.entries[cur]?.kcal > 0) { streak++; cur = addDays(cur, -1); }

  const totalKcal = Object.values(user.entries).reduce((s, e) => s + e.kcal, 0);
  const weekKcal = weeks[currentWeekIndex()].total;
  return { weeks, penalties, paid, pending, debt, streak, totalKcal, weekKcal };
}

/* ------------------------------- Demo adatok ------------------------------ */
const seedEntries = (seed, quality) => {
  const e = {};
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let d = CHALLENGE_START; d <= TODAY; d = addDays(d, 1)) {
    if (rnd() > quality) continue;                            // kihagyott nap → bukás
    const kcal = Math.round(300 + rnd() * 700);
    e[d] = { kcal, sport: DEFAULT_SPORTS[Math.floor(rnd() * 4)], proof: rnd() > 0.5 };
  }
  return e;
};

const SEED_USERS = [
  { id: "u1", name: "Kis Márton",  email: "marton@pc.hu", emoji: "🏃‍♂️", entries: seedEntries(7, 0.97),  payments: [{ id: "p1", amount: 5000, status: "paid" }] },
  { id: "u2", name: "Tóth Anna",   email: "anna@pc.hu",   emoji: "🚴‍♀️", entries: seedEntries(21, 0.99), payments: [] },
  { id: "u3", name: "Nagy Bence",  email: "bence@pc.hu",  emoji: "🏋️‍♂️", entries: seedEntries(33, 0.88), payments: [{ id: "p2", amount: 10000, status: "paid" }] },
  { id: "u4", name: "Szabó Réka",  email: "reka@pc.hu",   emoji: "🏊‍♀️", entries: seedEntries(51, 0.93), payments: [{ id: "p3", amount: 5000, status: "pending" }] },
];

/* ============================== UI primitívek ============================== */
const Card = ({ children, className = "", ...p }) => (
  <div className={`rounded-2xl bg-white ${className}`} style={{ border: `1px solid ${C.line}`, boxShadow: "0 1px 2px rgba(15,23,42,.04)" }} {...p}>
    {children}
  </div>
);

const Button = ({ variant = "primary", className = "", style = {}, ...p }) => {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-95 disabled:opacity-40 disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-offset-2";
  const styles = {
    primary: { background: C.blue, color: "#fff" },
    ghost: { background: "#fff", color: C.ink, border: `1px solid ${C.line}` },
    danger: { background: C.danger, color: "#fff" },
    soft: { background: C.soft, color: C.blueDeep },
  }[variant];
  return <button className={`${base} ${className}`} style={{ ...styles, ...style }} {...p} />;
};

const Pill = ({ tone = "slate", children }) => {
  const t = { ok: C.ok, danger: C.danger, amber: C.amber, blue: C.blue, slate: C.slate }[tone];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold"
      style={{ color: t, background: `${t}14` }}>{children}</span>
  );
};

const SectionTitle = ({ children, right }) => (
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: C.slate }}>{children}</h2>
    {right}
  </div>
);

/* ============================== Emoji választó ============================= */
function EmojiPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {EMOJIS.map((e) => {
        const on = value === e;
        return (
          <button key={e} type="button" onClick={() => onChange(e)}
            className="flex aspect-square items-center justify-center rounded-xl text-2xl transition active:scale-90"
            style={{ background: on ? `${C.blue}12` : C.soft, border: `2px solid ${on ? C.blue : "transparent"}` }}>
            {e}
          </button>
        );
      })}
    </div>
  );
}

/* ================================ Belépés ================================= */
function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emoji, setEmoji] = useState("🏃‍♂️");
  const [err, setErr] = useState("");

  const submit = () => {
    if (!name.trim()) return setErr("Add meg a neved, hogy lássanak a ranglistán.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Ez az e-mail-cím nem érvényes.");
    onLogin({ name: name.trim(), email: email.trim(), emoji });
  };

  return (
    <div className="min-h-screen w-full px-5 py-10" style={{ background: "#fff" }}>
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
            Heti 4000 kcal. Minden nap mozgás. Aki kihagyja, 5000 Ft-tal tölti a közös kasszát.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Név</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kis Márton"
              className="w-full rounded-xl px-4 py-3 text-base outline-none focus:ring-2"
              style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>E-mail</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="te@pelda.hu" type="email"
              className="w-full rounded-xl px-4 py-3 text-base outline-none focus:ring-2"
              style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Profilkép</label>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>

          {err && <p className="text-sm font-medium" style={{ color: C.danger }}>{err}</p>}

          <Button onClick={submit} className="w-full py-4 text-base">
            Belépek a kihívásba <ChevronRight size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============================ Heti köríves mutató ========================= */
function WeeklyRing({ kcal }) {
  const pct = Math.min(kcal / WEEKLY_GOAL, 1);
  const R = 78, CIRC = 2 * Math.PI * R;
  return (
    <div className="relative flex items-center justify-center">
      <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={C.blue} />
            <stop offset="100%" stopColor={C.cyan} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={R} fill="none" stroke={C.soft} strokeWidth="16" />
        <circle cx="100" cy="100" r={R} fill="none" stroke="url(#ring)" strokeWidth="16" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-black tabular-nums" style={{ color: C.ink }}>{kcal.toLocaleString("hu-HU")}</span>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>/ {WEEKLY_GOAL} kcal</span>
        <span className="mt-1 text-xs font-bold" style={{ color: pct >= 1 ? C.ok : C.blue }}>
          {Math.round(pct * 100)}%
        </span>
      </div>
    </div>
  );
}

/* ============================ 3 hónapos naptár ============================= */
function ThreeMonthGrid({ entries, weeks }) {
  const cw = currentWeekIndex();
  return (
    <div className="space-y-2">
      {weeks.map((w) => (
        <div key={w.weekIndex} className="flex items-center gap-3">
          <div className="w-12 shrink-0 text-right text-xs font-bold tabular-nums" style={{ color: w.weekIndex === cw ? C.blue : C.slate }}>
            {w.weekIndex + 1}. hét
          </div>
          <div className="flex flex-1 gap-1">
            {w.days.map((d) => {
              const k = entries[d]?.kcal || 0;
              const future = d > TODAY;
              const bg = future ? "#fff" : k >= 700 ? C.blue : k >= 400 ? "#4FA8DA" : k > 0 ? "#A9D8F0" : `${C.danger}22`;
              return (
                <div key={d} title={`${fmtHU(d)} — ${k} kcal`}
                  className="h-6 flex-1 rounded-md"
                  style={{ background: bg, border: `1px solid ${future ? C.line : "transparent"}` }} />
              );
            })}
          </div>
          <div className="w-16 shrink-0 text-right text-xs font-bold tabular-nums" style={{ color: C.slate }}>
            {w.status === "upcoming" ? "—" : `${w.total}`}
          </div>
          <div className="w-6 shrink-0">
            {w.status === "failed" && <X size={16} strokeWidth={3} style={{ color: C.danger }} />}
            {w.status === "passed" && <Check size={16} strokeWidth={3} style={{ color: C.ok }} />}
            {(w.status === "active" || w.status === "onTrack") && <Clock size={14} style={{ color: C.blue }} />}
          </div>
        </div>
      ))}
    </div>
  );
}

/* =============================== Dashboard ================================ */
function DashboardView({ me, stats, pool, go }) {
  const cw = currentWeekIndex();
  const week = stats.weeks[cw];
  const todayEntry = me.entries[TODAY];

  return (
    <div className="space-y-5">
      {/* Signature: a heti gyűrű + tét egy kártyán */}
      <Card className="overflow-hidden p-6">
        <SectionTitle right={<Pill tone={week.missedDay ? "danger" : week.total >= WEEKLY_GOAL ? "ok" : "blue"}>
          {week.missedDay ? "Bukott hét" : week.total >= WEEKLY_GOAL ? "Cél teljesítve" : "Folyamatban"}
        </Pill>}>
          {cw + 1}. hét · {fmtHU(week.days[0])}–{fmtHU(week.days[6])}
        </SectionTitle>

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
          <WeeklyRing kcal={week.total} />
          <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-1">
            <div className="rounded-xl p-4" style={{ background: C.soft }}>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>
                <Flame size={14} /> Streak
              </div>
              <div className="mt-1 text-3xl font-black tabular-nums" style={{ color: C.ink }}>{stats.streak}<span className="text-base font-bold" style={{ color: C.slate }}> nap</span></div>
            </div>
            <div className="rounded-xl p-4" style={{ background: C.soft }}>
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Hiányzik</div>
              <div className="mt-1 text-3xl font-black tabular-nums" style={{ color: C.blue }}>
                {Math.max(WEEKLY_GOAL - week.total, 0)}
              </div>
            </div>
          </div>
        </div>

        {!todayEntry && (
          <div className="mt-5 flex items-center gap-3 rounded-xl p-4" style={{ background: `${C.amber}12` }}>
            <AlertTriangle size={18} style={{ color: C.amber }} />
            <p className="flex-1 text-sm font-semibold" style={{ color: C.ink }}>Ma még nincs bevitt mozgás. Éjfélig pótold, különben bukik a hét.</p>
            <Button variant="soft" onClick={() => go("tracker")}>Rögzítés</Button>
          </div>
        )}
      </Card>

      {/* Közös kassza */}
      <Card className="p-6" style={{ background: `linear-gradient(135deg, ${C.blueDeep}, ${C.blue})`, border: "none" }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.cyan }}>Közös kassza · Revolut</p>
            <p className="mt-2 text-4xl font-black tabular-nums text-white">{money(pool)}</p>
            <p className="mt-1 text-sm font-medium text-white opacity-80">Befizetve a csapat által · 3 hónap alatt</p>
          </div>
          <Wallet size={28} className="text-white opacity-60" />
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" onClick={() => go("wallet")} className="flex-1">Az én egyenlegem</Button>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle right={<span className="text-xs font-bold" style={{ color: C.slate }}>{stats.totalKcal.toLocaleString("hu-HU")} kcal</span>}>
          Teljes kihívás
        </SectionTitle>
        <ThreeMonthGrid entries={me.entries} weeks={stats.weeks} />
      </Card>
    </div>
  );
}

/* ================================ Tracker ================================= */
function TrackerView({ me, sports, onAddSport, onSave, toast }) {
  const [date, setDate] = useState(TODAY);
  const [kcal, setKcal] = useState("");
  const [sport, setSport] = useState(sports[0]);
  const [custom, setCustom] = useState("");
  const [adding, setAdding] = useState(false);
  const [proof, setProof] = useState(null);
  const fileRef = useRef(null);

  const existing = me.entries[date];
  useEffect(() => {
    setKcal(existing ? String(existing.kcal) : "");
    setSport(existing?.sport || sports[0]);
    setProof(existing?.proofUrl || null);
  }, [date]); // eslint-disable-line

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setProof(URL.createObjectURL(f));
  };

  const save = () => {
    const n = parseInt(kcal, 10);
    if (!n || n <= 0) return toast("Adj meg egy 0-nál nagyobb kalóriaértéket.", "danger");
    onSave(date, { kcal: n, sport, proof: !!proof, proofUrl: proof });
    toast(`${fmtHU(date)} rögzítve: ${n} kcal (${sport})`, "ok");
  };

  const addSport = () => {
    const s = custom.trim();
    if (!s) return;
    onAddSport(s); setSport(s); setCustom(""); setAdding(false);
  };

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <SectionTitle>Napi aktivitás</SectionTitle>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Nap</label>
            <input type="date" value={date} min={CHALLENGE_START} max={TODAY} onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-base outline-none"
              style={{ background: C.soft, border: `1px solid ${C.line}`, color: C.ink }} />
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
                <Button variant="ghost" onClick={() => setAdding(true)} aria-label="Új sportág">
                  <PlusCircle size={18} style={{ color: C.blue }} />
                </Button>
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
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>Igazolás (Strava / Health screenshot)</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" />
            {proof ? (
              <div className="relative overflow-hidden rounded-xl" style={{ border: `1px solid ${C.line}` }}>
                <img src={proof} alt="Igazolás" className="max-h-64 w-full object-contain" style={{ background: C.soft }} />
                <button onClick={() => { setProof(null); if (fileRef.current) fileRef.current.value = ""; }}
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

          <Button onClick={save} className="w-full py-4 text-base">
            <Upload size={18} /> {existing ? "Nap frissítése" : "Nap rögzítése"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle>Ezen a héten</SectionTitle>
        <div className="space-y-2">
          {weekDays(currentWeekIndex()).map((d) => {
            const e = me.entries[d];
            const future = d > TODAY;
            return (
              <button key={d} onClick={() => !future && setDate(d)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition"
                style={{ background: d === date ? `${C.blue}0D` : "transparent", border: `1px solid ${d === date ? C.blue : C.line}` }}>
                <span className="w-14 text-xs font-bold uppercase" style={{ color: C.slate }}>
                  {parse(d).toLocaleDateString("hu-HU", { weekday: "short" })}
                </span>
                <span className="flex-1 text-sm font-semibold" style={{ color: C.ink }}>
                  {e ? e.sport : future ? "—" : "Nincs mozgás"}
                </span>
                {e?.proof && <Camera size={14} style={{ color: C.slate }} />}
                <span className="text-sm font-black tabular-nums"
                  style={{ color: e ? C.blue : future ? C.line : C.danger }}>
                  {e ? `${e.kcal}` : future ? "" : "0"}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ============================== Ranglista ================================= */
function LeaderboardView({ users, meId }) {
  const [tab, setTab] = useState("week");

  const rows = useMemo(() => {
    const cw = currentWeekIndex();
    return users
      .map((u) => {
        const s = evaluateUser(u);
        return {
          id: u.id, name: u.name, emoji: u.emoji,
          kcal: tab === "week" ? s.weeks[cw].total : s.totalKcal,
          paid: s.paid, debt: s.debt + s.pending,
          failed: s.weeks.filter((w) => w.status === "failed").length,
        };
      })
      .sort((a, b) => b.kcal - a.kcal);
  }, [users, tab]);

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-xl p-1" style={{ background: C.soft }}>
        {[["week", "E heti rangsor"], ["all", "3 hónapos összesített"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className="flex-1 rounded-lg py-2.5 text-sm font-bold transition"
            style={{ background: tab === k ? "#fff" : "transparent", color: tab === k ? C.blue : C.slate, boxShadow: tab === k ? "0 1px 3px rgba(15,23,42,.08)" : "none" }}>
            {label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider"
          style={{ background: C.soft, color: C.slate }}>
          <span className="w-6">#</span>
          <span className="flex-1">Név</span>
          <span className="w-20 text-right">kcal</span>
          <span className="w-24 text-right">Befizetve</span>
        </div>
        {rows.map((r, i) => {
          const isMe = r.id === meId;
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3"
              style={{ borderTop: `1px solid ${C.line}`, background: isMe ? `${C.cyan}0F` : "#fff" }}>
              <span className="w-6 text-base font-black tabular-nums" style={{ color: i === 0 ? C.blue : C.slate }}>{i + 1}</span>
              <span className="text-2xl">{r.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-bold" style={{ color: C.ink }}>
                  {r.name}{isMe && <span className="ml-1 text-xs font-bold" style={{ color: C.blue }}>· te</span>}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  {r.debt > 0
                    ? <Pill tone="danger">Tartozás {money(r.debt)}</Pill>
                    : <Pill tone="ok">Rendezve</Pill>}
                  {r.failed > 0 && <span className="text-xs font-semibold" style={{ color: C.slate }}>{r.failed} bukott hét</span>}
                </div>
              </div>
              <span className="w-20 text-right text-sm font-black tabular-nums" style={{ color: C.ink }}>
                {r.kcal.toLocaleString("hu-HU")}
              </span>
              <span className="w-24 text-right text-sm font-bold tabular-nums" style={{ color: r.paid ? C.ok : C.slate }}>
                {money(r.paid)}
              </span>
            </div>
          );
        })}
      </Card>
      <p className="px-1 text-xs" style={{ color: C.slate }}>
        A „Befizetve” oszlop a Revolut kasszába már beérkezett (admin által jóváhagyott) büntetéseket mutatja.
      </p>
    </div>
  );
}

/* ============================== Pénztárca ================================= */
function WalletView({ me, stats, pool, onDeclarePayment, toast }) {
  const failedWeeks = stats.weeks.filter((w) => w.status === "failed");

  const declare = () => {
    if (stats.debt <= 0) return toast("Nincs rendezetlen büntetésed.", "ok");
    onDeclarePayment(stats.debt);
    toast("Befizetés igazolva — admin jóváhagyásra vár.", "ok");
  };

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <SectionTitle>Az én egyenlegem</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Összes büntetés", stats.penalties, C.ink],
            ["Befizetve", stats.paid, C.ok],
            ["Tartozás", stats.debt, stats.debt ? C.danger : C.slate],
          ].map(([label, val, col]) => (
            <div key={label} className="rounded-xl p-3" style={{ background: C.soft }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.slate }}>{label}</p>
              <p className="mt-1 text-lg font-black tabular-nums" style={{ color: col }}>{money(val)}</p>
            </div>
          ))}
        </div>

        {stats.pending > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-xl p-3" style={{ background: `${C.amber}12` }}>
            <Clock size={16} style={{ color: C.amber }} />
            <p className="text-sm font-semibold" style={{ color: C.ink }}>{money(stats.pending)} admin jóváhagyásra vár.</p>
          </div>
        )}

        <div className="mt-5 space-y-2">
          <Button className="w-full py-4 text-base" onClick={() => window.open(REVOLUT_LINK, "_blank")}>
            <Wallet size={18} /> Fizetés a Revolut kasszába
          </Button>
          <Button variant="ghost" className="w-full" onClick={declare} disabled={stats.debt <= 0}>
            <Check size={16} /> Igazolom a befizetést ({money(stats.debt)})
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle right={<span className="text-xs font-bold" style={{ color: C.slate }}>{money(pool)} a kasszában</span>}>
          Büntetés-történet
        </SectionTitle>
        {failedWeeks.length === 0 ? (
          <p className="py-6 text-center text-sm font-semibold" style={{ color: C.ok }}>
            Tiszta lap. Egyetlen hetet sem buktál el. 🔥
          </p>
        ) : (
          <div className="space-y-2">
            {failedWeeks.map((w) => (
              <div key={w.weekIndex} className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ border: `1px solid ${C.line}` }}>
                <X size={16} strokeWidth={3} style={{ color: C.danger }} />
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: C.ink }}>{w.weekIndex + 1}. hét · {fmtHU(w.days[0])}–{fmtHU(w.days[6])}</p>
                  <p className="text-xs" style={{ color: C.slate }}>
                    {w.missedDay ? "Kihagyott nap (0 kcal)" : `${w.total} / ${WEEKLY_GOAL} kcal`}
                  </p>
                </div>
                <span className="text-sm font-black tabular-nums" style={{ color: C.danger }}>{money(PENALTY)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ================================== App =================================== */
export default function App() {
  const [users, setUsers] = useState(SEED_USERS);
  const [meId, setMeId] = useState(null);
  const [sports, setSports] = useState(DEFAULT_SPORTS);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState(null);

  const notify = (msg, tone = "ok") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2600);
  };

  const me = users.find((u) => u.id === meId);
  const stats = useMemo(() => (me ? evaluateUser(me) : null), [me]);
  const pool = useMemo(
    () => users.reduce((s, u) => s + u.payments.filter((p) => p.status === "paid").reduce((x, p) => x + p.amount, 0), 0),
    [users]
  );

  const login = ({ name, email, emoji }) => {
    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) { setMeId(existing.id); return; }
    const u = { id: `u${Date.now()}`, name, email, emoji, entries: {}, payments: [] };
    setUsers((p) => [...p, u]);
    setMeId(u.id);
  };

  const saveEntry = (date, entry) =>
    setUsers((p) => p.map((u) => (u.id === meId ? { ...u, entries: { ...u.entries, [date]: entry } } : u)));

  const declarePayment = (amount) =>
    setUsers((p) => p.map((u) => (u.id === meId
      ? { ...u, payments: [...u.payments, { id: `p${Date.now()}`, amount, status: "pending" }] }
      : u)));

  if (!me) return <LoginScreen onLogin={login} />;

  const NAV = [
    ["dashboard", "Kezdőlap", LayoutDashboard],
    ["tracker", "Rögzítés", PlusCircle],
    ["leaderboard", "Ranglista", Trophy],
    ["wallet", "Kassza", Wallet],
  ];

  return (
    <div className="min-h-screen pb-24 md:pb-8" style={{ background: "#fff" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur" style={{ background: "rgba(255,255,255,.85)", borderBottom: `1px solid ${C.line}` }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ background: C.soft }}>{me.emoji}</div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-black" style={{ color: C.ink }}>{me.name}</p>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.blue }}>Powerade Challenge</p>
          </div>
          <div className="hidden gap-1 md:flex">
            {NAV.map(([k, label, Icon]) => (
              <button key={k} onClick={() => setTab(k)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition"
                style={{ background: tab === k ? `${C.blue}0F` : "transparent", color: tab === k ? C.blue : C.slate }}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
          <button onClick={() => setMeId(null)} className="rounded-lg p-2" aria-label="Kilépés">
            <LogOut size={18} style={{ color: C.slate }} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
        {tab === "dashboard" && <DashboardView me={me} stats={stats} pool={pool} go={setTab} />}
        {tab === "tracker" && <TrackerView me={me} sports={sports} onAddSport={(s) => setSports((p) => [...p, s])} onSave={saveEntry} toast={notify} />}
        {tab === "leaderboard" && <LeaderboardView users={users} meId={meId} />}
        {tab === "wallet" && <WalletView me={me} stats={stats} pool={pool} onDeclarePayment={declarePayment} toast={notify} />}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-30 w-11/12 max-w-sm -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg md:bottom-6"
          style={{ background: toast.tone === "danger" ? C.danger : C.ink }}>
          {toast.msg}
        </div>
      )}

      {/* Mobil nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 md:hidden" style={{ background: "#fff", borderTop: `1px solid ${C.line}` }}>
        <div className="mx-auto flex max-w-3xl">
          {NAV.map(([k, label, Icon]) => {
            const on = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)} className="flex flex-1 flex-col items-center gap-1 py-3">
                <Icon size={20} strokeWidth={on ? 2.5 : 2} style={{ color: on ? C.blue : C.slate }} />
                <span className="text-xs font-bold" style={{ color: on ? C.blue : C.slate }}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
