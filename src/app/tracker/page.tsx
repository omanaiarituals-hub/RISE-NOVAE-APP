"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from '@/lib/supabase/client';
import Navigation from "@/components/Navigation";

// ─── TYPES ─────────────────────────────────────────────────
type PeriodView = "week" | "month";

interface HabitFromDB {
  id: string;
  title: string;
  description: string; // emoji stocké ici
  category: "morning" | "evening";
  completed: boolean;
  last_completed_at: string | null;
  streak_count: number;
  created_at: string;
}

interface HabitDisplay {
  id: string;
  name: string;
  emoji: string;
  color: string;
  streak: number;
  completedDays: string[];
  category: "morning" | "evening";
}

interface TimeSlice {
  category: string;
  label: string;
  emoji: string;
  color: string;
  hours: number;
}

interface RoutineCompletion {
  morning?: boolean;
  evening?: boolean;
  morning_at?: string;
  evening_at?: string;
}

// ─── PALETTE : univers Tracker = sauge, fond beige ─────────
const C = {
  cream: "#F8F1E5",
  roseLight: "#E7EDDD",
  rose: "#C5D3B4",
  roseDark: "#7E9460",
  violet: "#7B6FA0",
  noir: "#3D2618",
  gris: "#6B6B6B",
  grisClair: "#E8E4DF",
  blanc: "#FFFFFF",
};

const HABIT_COLORS = ["#7E9460", "#7B6FA0", "#A0BEDC", "#E8D080", "#C4956A", "#E0A0B8"];

// ─── UTILS ─────────────────────────────────────────────────
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); return fmtDate(d);
  });
}
function getLast30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i)); return fmtDate(d);
  });
}
function getDayLabel(dateStr: string): string {
  return ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"][new Date(dateStr).getDay()];
}

// ─── DONUT CHART ───────────────────────────────────────────
function DonutChart({ slices, size = 160 }: { slices: TimeSlice[]; size?: number }) {
  const total = slices.reduce((s, c) => s + c.hours, 0);
  if (total === 0) return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 12, color: C.gris }}>Aucune donnée</span>
    </div>
  );
  const cx = size / 2, cy = size / 2;
  const r = size * 0.38, innerR = size * 0.22;
  let angle = -Math.PI / 2;
  const paths: { d: string; color: string }[] = [];
  slices.forEach(slice => {
    const ratio = slice.hours / total;
    const endAngle = angle + ratio * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(angle), iy1 = cy + innerR * Math.sin(angle);
    const ix2 = cx + innerR * Math.cos(endAngle), iy2 = cy + innerR * Math.sin(endAngle);
    const large = ratio > 0.5 ? 1 : 0;
    paths.push({ color: slice.color, d: `M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z` });
    angle = endAngle;
  });
  const top = [...slices].sort((a, b) => b.hours - a.hours)[0];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} stroke={C.blanc} strokeWidth={2} opacity={0.9} />)}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={22} fontFamily="'Cormorant Garamond',serif" fill={C.noir}>{top.emoji}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={10} fontFamily="'DM Sans',sans-serif" fill={C.gris}>{top.hours}h</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize={9} fontFamily="'DM Sans',sans-serif" fill={C.gris}>{total}h total</text>
    </svg>
  );
}

// ─── HABIT ROW ─────────────────────────────────────────────
function HabitRow({ habit, days }: { habit: HabitDisplay; days: string[] }) {
  const doneCount = days.filter(d => habit.completedDays.includes(d)).length;
  const pct = Math.round((doneCount / days.length) * 100);
  const today = fmtDate(new Date());

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{habit.emoji}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.noir, fontFamily: "'DM Sans',sans-serif" }}>
          {habit.name}
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{
            fontSize: 10, padding: "1px 6px", borderRadius: 8,
            background: habit.category === "morning" ? "rgba(126,148,96,0.14)" : "rgba(123,111,160,0.12)",
            color: habit.category === "morning" ? C.roseDark : C.violet,
          }}>
            {habit.category === "morning" ? "☀️" : "🌙"}
          </span>
          {habit.streak > 0 && (
            <span style={{ fontSize: 11, background: "#FBF0CC", border: "1px solid #E8D080", borderRadius: 10, padding: "1px 7px", color: "#7A6010" }}>
              🔥 {habit.streak}j
            </span>
          )}
          <span style={{ fontSize: 11, color: C.gris }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height: 4, background: C.grisClair, borderRadius: 10, marginBottom: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: habit.color, borderRadius: 10, transition: "width 0.3s" }} />
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {days.map(date => {
          const done = habit.completedDays.includes(date);
          const isToday = date === today;
          return (
            <div key={date} title={date}
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: done ? habit.color : C.grisClair,
                border: isToday ? `2px solid ${C.roseDark}` : "2px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: done ? C.blanc : C.gris,
                fontFamily: "'DM Sans',sans-serif", fontWeight: 600,
              }}
            >
              {getDayLabel(date)[0]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ROUTINE STATUS BANNER ─────────────────────────────────
function RoutineBanner({ completion }: { completion: RoutineCompletion }) {
  const both = completion.morning && completion.evening;
  const none = !completion.morning && !completion.evening;
  if (none) return null;
  return (
    <div style={{
      background: both ? "linear-gradient(135deg, rgba(126,148,96,0.14), rgba(123,111,160,0.08))" : "rgba(126,148,96,0.10)",
      borderRadius: 12, padding: "10px 14px", marginBottom: 16,
      display: "flex", alignItems: "center", gap: 10,
      border: `1px solid ${both ? "rgba(126,148,96,0.22)" : "rgba(126,148,96,0.16)"}`,
    }}>
      <span style={{ fontSize: 20 }}>{both ? "🌟" : completion.morning ? "☀️" : "🌙"}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.noir, fontFamily: "'Cormorant Garamond',serif" }}>
          {both ? "Routines du jour complétées à 100% !" : completion.morning ? "Routine du matin complétée !" : "Routine du soir complétée !"}
        </div>
        <div style={{ fontSize: 11, color: C.gris }}>
          {both ? "Tu as tenu tes deux routines aujourd'hui 💪" : "Continue comme ça !"}
        </div>
      </div>
    </div>
  );
}

// ─── PROGRESS 90J ──────────────────────────────────────────
function Progress90j({ data }: { data: any }) {
  const completedDays = data?.current_day || 0;
  const pct = Math.round((completedDays / 90) * 100);
  const phase = completedDays <= 30
    ? { name: "Reprogrammation", color: C.roseDark, num: 1 }
    : completedDays <= 60
    ? { name: "Action / Discipline", color: "#A0BEDC", num: 2 }
    : { name: "Expansion", color: "#90C8A8", num: 3 };
  const remaining = 90 - completedDays;
  return (
    <div style={{ background: C.blanc, borderRadius: 14, padding: "18px 20px", border: `1px solid ${C.grisClair}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 22 }}>🎯</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", color: C.noir }}>Programme 90 jours</div>
          <div style={{ fontSize: 11, color: C.gris }}>Phase {phase.num} — {phase.name}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", color: phase.color }}>{completedDays}</div>
          <div style={{ fontSize: 10, color: C.gris }}>/ 90 jours</div>
        </div>
      </div>
      <div style={{ height: 10, background: C.grisClair, borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: phase.color, borderRadius: 10, transition: "width 0.6s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        {[{ label: "Phase 1", days: "J1-30", color: C.roseDark }, { label: "Phase 2", days: "J31-60", color: "#A0BEDC" }, { label: "Phase 3", days: "J61-90", color: "#90C8A8" }].map((p, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, margin: "0 auto 3px" }} />
            <div style={{ fontSize: 9, color: C.gris }}>{p.label}</div>
            <div style={{ fontSize: 8, color: C.gris }}>{p.days}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { val: String(data?.completed_missions || 0), label: "Missions ✓", color: "#7BAF8E" },
          { val: String(remaining), label: "Jours restants", color: C.roseDark },
          { val: String(data?.streak_days || 0), label: "Jours streak", color: "#A0BEDC" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: C.cream, borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: "'Cormorant Garamond',serif" }}>{s.val}</div>
            <div style={{ fontSize: 10, color: C.gris }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN ──────────────────────────────────────────────────
export default function TrackerPage() {

  const [periodView, setPeriodView] = useState<PeriodView>("week");
  const [habits, setHabits] = useState<HabitDisplay[]>([]);
  const [timeData, setTimeData] = useState<TimeSlice[]>([]);
  const [programData, setProgramData] = useState<any>(null);
  const [routineCompletion, setRoutineCompletion] = useState<RoutineCompletion>({});
  const [loading, setLoading] = useState(true);
  const [newHabitName, setNewHabitName] = useState("");
  const [showAddHabit, setShowAddHabit] = useState(false);

  const days = periodView === "week" ? getLast7Days() : getLast30Days();

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: routinesData } = await supabase
        .from("routines")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (routinesData) {
        const today = fmtDate(new Date());
        const yesterday = fmtDate(new Date(Date.now() - 86400000));

        const habitsDisplay: HabitDisplay[] = routinesData.map((r: HabitFromDB, i: number) => {
          const completedDays: string[] = [];
          if (r.last_completed_at) {
            const lastDate = fmtDate(new Date(r.last_completed_at));
            if (lastDate === today && r.streak_count > 0) {
              for (let j = 0; j < Math.min(r.streak_count, 30); j++) {
                const d = new Date();
                d.setDate(d.getDate() - j);
                completedDays.push(fmtDate(d));
              }
            } else if (lastDate === yesterday && r.streak_count > 0) {
              for (let j = 1; j <= Math.min(r.streak_count, 30); j++) {
                const d = new Date();
                d.setDate(d.getDate() - j);
                completedDays.push(fmtDate(d));
              }
            }
          }
          return {
            id: r.id,
            name: r.title,
            emoji: r.description || "✨",
            color: HABIT_COLORS[i % HABIT_COLORS.length],
            streak: r.streak_count,
            completedDays,
            category: r.category,
          };
        });
        setHabits(habitsDisplay);
      }

      const { data: progData } = await supabase
        .from("program_progress")
        .select("current_day, completed_missions, streak_days")
        .eq("user_id", user.id)
        .single();
      if (progData) setProgramData(progData);

      const daysBack = periodView === "week" ? 7 : 30;
      const startDateObj = new Date();
      startDateObj.setDate(startDateObj.getDate() - daysBack);
      const startDateStr = fmtDate(startDateObj);

      const { data: tasks } = await supabase
        .from("tasks")
        .select("category, start_hour, duration_hours")
        .eq("user_id", user.id)
        .gte("date", startDateStr);

      const CAT_MAP: Record<string, { label: string; emoji: string; color: string }> = {
        pro:    { label: "Professionnel",   emoji: "💼", color: "#A0BEDC" },
        self:   { label: "Personnel / Moi", emoji: "🌸", color: "#D4A090" },
        family: { label: "Famille",         emoji: "💛", color: "#E8D080" },
        social: { label: "Social",          emoji: "🌿", color: "#90C8A8" },
      };

      if (tasks && tasks.length > 0) {
        const minuteMap: Record<string, number> = { pro: 0, self: 0, family: 0, social: 0 };
        tasks.forEach((t: any) => {
          const key = (t.category || "pro").toLowerCase();
          if (minuteMap[key] !== undefined) {
            minuteMap[key] += (t.duration_hours || 1) * 60;
          }
        });
        const slices: TimeSlice[] = Object.entries(minuteMap)
          .filter(([, mins]) => mins > 0)
          .map(([k, mins]) => ({
            category: k,
            label: CAT_MAP[k]?.label || k,
            emoji: CAT_MAP[k]?.emoji || "📌",
            color: CAT_MAP[k]?.color || "#ccc",
            hours: Math.round(mins / 60),
          }));
        if (slices.length > 0) setTimeData(slices);
        else loadMockTime();
      } else {
        loadMockTime();
      }

      const todayKey = `novae-routine-completed-${fmtDate(new Date())}`;
      const stored = localStorage.getItem(todayKey);
      if (stored) {
        try { setRoutineCompletion(JSON.parse(stored)); } catch {}
      }

    } catch (err) {
      console.error("Erreur tracker:", err);
      loadMockTime();
    }
    setLoading(false);
  };

  const loadMockTime = () => {
    setTimeData([
      { category: "pro", label: "Professionnel", emoji: "💼", color: "#A0BEDC", hours: 32 },
      { category: "moi", label: "Personnel / Moi", emoji: "🌸", color: "#D4A090", hours: 8 },
      { category: "famille", label: "Famille", emoji: "💛", color: "#E8D080", hours: 12 },
      { category: "couple", label: "Couple", emoji: "💕", color: "#E0A0B8", hours: 4 },
      { category: "amis", label: "Amis", emoji: "🌿", color: "#90C8A8", hours: 3 },
    ]);
  };

  const totalHours = timeData.reduce((s, c) => s + c.hours, 0);

  return (
    <>
    <Navigation />
    <div style={{ minHeight: "100vh", background: C.cream, fontFamily: "'DM Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.blanc, borderBottom: `1px solid ${C.grisClair}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0 10px" }}>
            <Link href="/" style={{ fontSize: 12, color: C.gris, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, border: `1px solid ${C.grisClair}`, background: C.cream }}>
              ← Accueil
            </Link>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: C.noir }}>Tracker</h1>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: C.gris }}>Visualise ton temps, tes habitudes et ta progression</p>
            </div>
            <div style={{ display: "flex", gap: 4, background: C.grisClair, borderRadius: 20, padding: 3 }}>
              {(["week", "month"] as PeriodView[]).map(p => (
                <button key={p} onClick={() => setPeriodView(p)}
                  style={{ padding: "5px 14px", borderRadius: 16, border: "none", background: periodView === p ? C.blanc : "transparent", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: periodView === p ? C.roseDark : C.gris, fontWeight: periodView === p ? 700 : 400, transition: "all 0.2s", boxShadow: periodView === p ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
                  {p === "week" ? "Semaine" : "Mois"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 110px" }}>

        {/* Banner complétion routines */}
        <RoutineBanner completion={routineCompletion} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 20 }}>
          {/* Roue du temps */}
          <div style={{ background: C.blanc, borderRadius: 14, padding: "18px 20px", border: `1px solid ${C.grisClair}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>⏱</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", color: C.noir }}>Répartition du temps</div>
                <div style={{ fontSize: 11, color: C.gris }}>
                  {totalHours > 0 ? `Depuis ton Planner · ${totalHours}h` : "Aucun événement planifié"}
                </div>
              </div>
            </div>
            {loading ? (
              <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 12, color: C.gris }}>Chargement...</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <DonutChart slices={timeData} size={160} />
                <div style={{ flex: 1 }}>
                  {timeData.map(slice => (
                    <div key={slice.category} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: slice.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: C.gris, flex: 1 }}>{slice.emoji} {slice.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.noir }}>{slice.hours}h</span>
                      <span style={{ fontSize: 10, color: C.gris }}>{totalHours > 0 ? Math.round(slice.hours / totalHours * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Progression 90j */}
          <Progress90j data={programData as any} />
        </div>

        {/* Habitudes depuis Supabase */}
        <div style={{ background: C.blanc, borderRadius: 14, padding: "18px 20px", border: `1px solid ${C.grisClair}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", color: C.noir }}>Suivi des habitudes</div>
              <div style={{ fontSize: 11, color: C.gris }}>
                Depuis tes Routines · {periodView === "week" ? "7 derniers jours" : "30 derniers jours"}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: C.gris, fontSize: 13 }}>Chargement...</div>
          ) : habits.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
              <div style={{ fontSize: 13, color: C.gris, marginBottom: 12 }}>Aucune routine définie pour l'instant.</div>
              <Link href="/routines" style={{ fontSize: 12, color: C.roseDark, fontWeight: 600, textDecoration: "none", padding: "6px 14px", border: `1px solid ${C.roseDark}`, borderRadius: 8 }}>
                Créer mes routines →
              </Link>
            </div>
          ) : (
            habits.map(habit => <HabitRow key={habit.id} habit={habit} days={days} />)
          )}
        </div>
      </div>
    </div>
    </>
  );
}