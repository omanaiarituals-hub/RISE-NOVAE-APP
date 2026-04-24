"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

// ─── TYPES ─────────────────────────────────────────────────
type Priority = "high" | "medium" | "low";
type CategoryKey = "pro" | "moi" | "famille" | "couple" | "amis";
type MobileTab = "todo" | "planner";

interface Todo {
  id: string;
  text: string;
  priority: Priority;
  done: boolean;
}

interface CalEvent {
  id: string;
  title: string;
  date: string;
  startMinutes: number; // minutes depuis minuit (ex: 9h30 = 570)
  endMinutes: number;
  cat: CategoryKey;
  done: boolean;
  fromTodo: boolean;
  replanNeeded: boolean;
}

interface FormData {
  title: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  cat: CategoryKey;
}

// ─── PALETTE ───────────────────────────────────────────────
const C = {
  cream: "#FAF7F2", roseLight: "#F2E0D8", rose: "#E8C4B8",
  roseDark: "#D4A090", noir: "#1A1A1A", gris: "#6B6B6B",
  grisClair: "#E8E4DF", blanc: "#FFFFFF",
};

const CATEGORIES: Record<CategoryKey, { label: string; emoji: string; bg: string; border: string; text: string }> = {
  pro:     { label: "Professionnel",   emoji: "💼", bg: "#C8D8E8", border: "#A0BEDC", text: "#2C5F8A" },
  moi:     { label: "Personnel / Moi", emoji: "🌸", bg: "#F2E0D8", border: "#D4A090", text: "#8A4A3A" },
  famille: { label: "Famille",         emoji: "💛", bg: "#FBF0CC", border: "#E8D080", text: "#7A6010" },
  couple:  { label: "Couple",          emoji: "💕", bg: "#F5D0DC", border: "#E0A0B8", text: "#8A3050" },
  amis:    { label: "Amis",            emoji: "🌿", bg: "#CCE8D8", border: "#90C8A8", text: "#2A6A48" },
};

const CAT_TO_DB: Record<CategoryKey, string> = {
  pro: "pro", moi: "self", famille: "family", couple: "social", amis: "social"
};
const DB_TO_CAT: Record<string, CategoryKey> = {
  "pro": "pro", "self": "moi", "family": "famille", "social": "amis",
};

const PRIORITY_COLORS: Record<Priority, string> = { high: "#D4956A", medium: "#D4A090", low: "#6B6B6B" };

// ─── CRÉNEAUX 15 MIN ───────────────────────────────────────
const SLOT_HEIGHT = 15; // px par 15 minutes
const QUARTER_SLOTS = Array.from({ length: 24 * 4 }, (_, i) => i); // 0..95

function minutesToLabel(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function minutesToHourDecimal(m: number): number { return m / 60; }

// Générer options par tranche de 15 min
const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => ({
  value: i * 15,
  label: minutesToLabel(i * 15),
}));

const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const DAYS_FULL  = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const HOUR_HEIGHT = SLOT_HEIGHT * 4; // 60px par heure

// ─── UTILS ─────────────────────────────────────────────────
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function isToday(d: Date): boolean { return fmtDate(d) === fmtDate(new Date()); }
function getWeekDates(date: Date): Date[] {
  const d = new Date(date);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x; });
}
function getDaysInMonth(y: number, m: number): number { return new Date(y, m + 1, 0).getDate(); }
function uid() { return Math.random().toString(36).slice(2); }

// Convertir heure entière (ancien format) → minutes
function hourToMinutes(h: number): number { return h * 60; }

// ─── STYLE HELPERS ─────────────────────────────────────────
const inputStyle = (): React.CSSProperties => ({ width: "100%", border: "1px solid #E8E4DF", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "'DM Sans',sans-serif", background: "#FAF7F2", outline: "none", boxSizing: "border-box", color: "#1A1A1A" });
const labelStyle = (): React.CSSProperties => ({ display: "block", fontSize: 11, color: "#6B6B6B", letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" as const });
const btnStyle = (bg?: string): React.CSSProperties => ({ padding: "7px 14px", borderRadius: 8, border: "none", background: bg || "#D4A090", color: "#FFFFFF", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" as const });
const navBtn = (): React.CSSProperties => ({ width: 30, height: 30, borderRadius: "50%", border: "1px solid #E8E4DF", background: "#FFFFFF", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 16, color: "#6B6B6B", display: "flex", alignItems: "center", justifyContent: "center" });

// ─── MODAL ─────────────────────────────────────────────────
function Modal({ title, form, setForm, onConfirm, onCancel, onDelete, confirmLabel = "Confirmer" }: {
  title: string; form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onConfirm: () => void; onCancel: () => void; onDelete?: () => void; confirmLabel?: string;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 18px", fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#1A1A1A" }}>{title}</h3>
        <label style={labelStyle()}>Titre</label>
        <input autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nom de l'événement…" style={{ ...inputStyle(), marginBottom: 12 }} />
        <label style={labelStyle()}>Date</label>
        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ ...inputStyle(), marginBottom: 12 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle()}>Heure début</label>
            <select value={form.startMinutes} onChange={e => setForm(f => ({ ...f, startMinutes: +e.target.value }))} style={inputStyle()}>
              {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle()}>Heure fin</label>
            <select value={form.endMinutes} onChange={e => setForm(f => ({ ...f, endMinutes: +e.target.value }))} style={inputStyle()}>
              {TIME_OPTIONS.filter(o => o.value > form.startMinutes).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <label style={labelStyle()}>Catégorie</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {(Object.keys(CATEGORIES) as CategoryKey[]).map(key => {
            const cat = CATEGORIES[key]; const sel = form.cat === key;
            return <button key={key} onClick={() => setForm(f => ({ ...f, cat: key }))} style={{ padding: "8px 6px", borderRadius: 8, border: `2px solid ${sel ? cat.border : "#E8E4DF"}`, background: sel ? cat.bg : "#FFFFFF", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: sel ? cat.text : "#6B6B6B", textAlign: "left" }}>{cat.emoji} {cat.label}</button>;
          })}
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: onDelete ? 10 : 0 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #E8E4DF", background: "#FFFFFF", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", color: "#6B6B6B" }}>Annuler</button>
          <button onClick={onConfirm} style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: "#D4A090", color: "#FFFFFF", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>{confirmLabel}</button>
        </div>
        {onDelete && (
          <button onClick={onDelete} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "1.5px solid rgba(220,50,50,0.2)", background: "rgba(220,50,50,0.06)", color: "#c0392b", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600 }}>
            🗑 Supprimer cet événement
          </button>
        )}
      </div>
    </div>
  );
}

// ─── DAY EVENTS ────────────────────────────────────────────
function renderDayEvents(dayEvents: CalEvent[], onToggle: (id: string) => void, onDelete: (id: string) => void, onReplan: (ev: CalEvent) => void, onEdit: (ev: CalEvent) => void) {
  if (!dayEvents.length) return null;
  const sorted = [...dayEvents].sort((a, b) => a.startMinutes - b.startMinutes);
  const columns: CalEvent[][] = [];
  for (const ev of sorted) {
    let placed = false;
    for (const col of columns) { if (col[col.length-1].endMinutes <= ev.startMinutes) { col.push(ev); placed = true; break; } }
    if (!placed) columns.push([ev]);
  }
  const totalCols = columns.length;
  return columns.map((col, ci) => col.map(ev => {
    const cat = CATEGORIES[ev.cat];
    const top = (ev.startMinutes / 60) * HOUR_HEIGHT;
    const height = Math.max(((ev.endMinutes - ev.startMinutes) / 60) * HOUR_HEIGHT - 2, 20);
    return (
      <div key={ev.id} style={{ position: "absolute", top, left: `calc(52px + (100% - 52px) / ${totalCols} * ${ci})`, width: `calc((100% - 52px) / ${totalCols})`, height, background: ev.done ? "#E8E4DF" : cat.bg, border: `1.5px solid ${ev.replanNeeded ? "#D4956A" : (ev.done ? "#E8E4DF" : cat.border)}`, borderLeft: `4px solid ${ev.done ? "#6B6B6B" : cat.border}`, borderRadius: 8, padding: "4px 8px", boxSizing: "border-box", opacity: ev.done ? 0.55 : 1, overflow: "hidden", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
          <input type="checkbox" checked={ev.done} onChange={() => onToggle(ev.id)} style={{ accentColor: cat.border, cursor: "pointer", marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", color: ev.done ? "#6B6B6B" : cat.text, textDecoration: ev.done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.emoji} {ev.title}</div>
            <div style={{ fontSize: 10, color: "#6B6B6B" }}>{minutesToLabel(ev.startMinutes)} → {minutesToLabel(ev.endMinutes)}</div>
          </div>
          <button onClick={() => onEdit(ev)} title="Modifier" style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6B6B", fontSize: 14, padding: "1px 3px" }}>✏️</button>
        </div>
        {ev.replanNeeded && !ev.done && <button onClick={() => onReplan(ev)} style={{ marginTop: 4, background: "#D4956A", color: "#FFF", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>↻ Replanifier</button>}
      </div>
    );
  }));
}

// ─── DAY VIEW ──────────────────────────────────────────────
function DayView({ currentDate, events, onNewEvent, onToggle, onDelete, onReplan, onEdit }: {
  currentDate: Date; events: CalEvent[]; onNewEvent: (date: string, startMinutes: number) => void;
  onToggle: (id: string) => void; onDelete: (id: string) => void; onReplan: (ev: CalEvent) => void; onEdit: (ev: CalEvent) => void;
}) {
  const dateStr = fmtDate(currentDate);
  const dayEvents = events.filter(e => e.date === dateStr);
  const now = new Date();
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 8px", borderBottom: `1px solid ${C.grisClair}` }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 600, color: C.noir }}>{DAYS_FULL[(currentDate.getDay()+6)%7]} {currentDate.getDate()} {MONTHS[currentDate.getMonth()]}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isToday(currentDate) && <span style={{ background: C.roseDark, color: C.blanc, borderRadius: 20, padding: "2px 10px", fontSize: 10 }}>AUJOURD'HUI</span>}
          <button onClick={() => onNewEvent(dateStr, 9 * 60)} style={btnStyle(C.roseDark)}>+ Évén.</button>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        {/* Lignes heures */}
        {HOURS.map(h => (
          <div key={h} style={{ display: "flex", height: HOUR_HEIGHT, borderBottom: `1px solid ${C.grisClair}` }}>
            <div style={{ width: 52, padding: "6px 8px 0", fontSize: 11, color: C.gris, flexShrink: 0, borderRight: `1px solid ${C.grisClair}` }}>{String(h).padStart(2,"0")}:00</div>
            <div style={{ flex: 1, position: "relative" }}>
              {/* Lignes 15/30/45 min */}
              {[15, 30, 45].map(min => (
                <div key={min} style={{ position: "absolute", left: 0, right: 0, top: (min / 60) * HOUR_HEIGHT, borderTop: `1px dashed ${min === 30 ? "#E0DCD8" : "#F0EDEA"}`, pointerEvents: "none" }} />
              ))}
            </div>
          </div>
        ))}
        {/* Ligne "maintenant" */}
        {isToday(currentDate) && (
          <div style={{ position: "absolute", left: 52, right: 0, top: (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT, height: 2, background: C.roseDark, zIndex: 10, display: "flex", alignItems: "center", pointerEvents: "none" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.roseDark, marginLeft: -3 }} />
          </div>
        )}
        {renderDayEvents(dayEvents, onToggle, onDelete, onReplan, onEdit)}
      </div>
    </div>
  );
}

// ─── WEEK VIEW ─────────────────────────────────────────────
function WeekView({ weekDates, events, onDayClick }: { weekDates: Date[]; events: CalEvent[]; onDayClick: (d: Date) => void; }) {
  const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6h→22h
  return (
    <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7,1fr)", minWidth: 560 }}>
        <div style={{ borderBottom: `1px solid ${C.grisClair}`, borderRight: `1px solid ${C.grisClair}`, padding: 8 }} />
        {weekDates.map((d, i) => (
          <div key={i} onClick={() => onDayClick(d)} style={{ padding: "8px 4px", textAlign: "center", cursor: "pointer", borderBottom: `1px solid ${C.grisClair}`, borderRight: `1px solid ${C.grisClair}`, background: isToday(d) ? C.roseLight : "transparent" }}>
            <div style={{ fontSize: 10, color: C.gris, letterSpacing: 1, textTransform: "uppercase" }}>{DAYS_SHORT[i]}</div>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Cormorant Garamond',serif", background: isToday(d) ? C.roseDark : "transparent", color: isToday(d) ? C.blanc : C.noir, borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", margin: "3px auto 0" }}>{d.getDate()}</div>
          </div>
        ))}
        {HOURS.map(h => (
          <>
            <div key={`l${h}`} style={{ padding: "8px 6px 0", fontSize: 11, color: C.gris, borderRight: `1px solid ${C.grisClair}`, borderBottom: `1px solid ${C.grisClair}`, minHeight: 52 }}>{String(h).padStart(2,"0")}:00</div>
            {weekDates.map((d, i) => {
              const ds = fmtDate(d);
              const evs = events.filter(e => e.date === ds && e.startMinutes >= h * 60 && e.startMinutes < (h + 1) * 60);
              return (
                <div key={`${h}-${i}`} style={{ borderRight: `1px solid ${C.grisClair}`, borderBottom: `1px solid ${C.grisClair}`, minHeight: 52, padding: 2, background: isToday(d) ? "#FDF8F5" : "transparent" }}>
                  {evs.map(ev => { const cat = CATEGORIES[ev.cat]; return <div key={ev.id} title={ev.title} onClick={() => onDayClick(d)} style={{ background: cat.bg, border: `1px solid ${cat.border}`, borderRadius: 4, padding: "2px 5px", fontSize: 11, color: cat.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", marginBottom: 1 }}>{cat.emoji} {ev.title} <span style={{ opacity: 0.6, fontSize: 9 }}>{minutesToLabel(ev.startMinutes)}</span></div>; })}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

// ─── MONTH VIEW ────────────────────────────────────────────
function MonthView({ currentDate, events, onDayClick }: { currentDate: Date; events: CalEvent[]; onDayClick: (d: Date) => void; }) {
  const y = currentDate.getFullYear(); const m = currentDate.getMonth();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let i = 1; i <= getDaysInMonth(y, m); i++) cells.push(new Date(y, m, i));
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <div style={{ flex: 1, padding: "8px 12px", overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, marginBottom: 4 }}>
        {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, color: C.gris, padding: "4px 0" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ds = fmtDate(d); const dayEvs = events.filter(e => e.date === ds); const tod = isToday(d);
          return (
            <div key={i} onClick={() => onDayClick(d)} style={{ minHeight: 70, border: `1px solid ${tod ? C.roseDark : C.grisClair}`, borderRadius: 8, padding: 4, cursor: "pointer", background: tod ? C.roseLight : C.blanc }}>
              <div style={{ fontSize: 13, fontWeight: tod ? 700 : 400, color: tod ? C.roseDark : C.noir, fontFamily: "'Cormorant Garamond',serif", marginBottom: 3 }}>{d.getDate()}</div>
              {dayEvs.slice(0,3).map(ev => { const cat = CATEGORIES[ev.cat]; return <div key={ev.id} style={{ background: cat.bg, borderRadius: 3, padding: "1px 4px", fontSize: 10, color: cat.text, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.emoji} {ev.title}</div>; })}
              {dayEvs.length > 3 && <div style={{ fontSize: 10, color: C.gris }}>+{dayEvs.length-3}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TODO PANEL ────────────────────────────────────────────
function TodoPanel({ todos, newTask, setNewTask, newPriority, setNewPriority, onAdd, onToggle, onDelete, onPlan }: {
  todos: Todo[]; newTask: string; setNewTask: (v: string) => void;
  newPriority: Priority; setNewPriority: (p: Priority) => void;
  onAdd: () => void; onToggle: (id: string) => void; onDelete: (id: string) => void; onPlan: (t: Todo) => void;
}) {
  const pending = todos.filter(t => !t.done);
  const done = todos.filter(t => t.done);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.blanc }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.grisClair}` }}>
        <h2 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: C.noir }}>To-Do List</h2>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: C.gris }}>{pending.length} tâche{pending.length !== 1 ? "s" : ""} en attente</p>
      </div>
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.grisClair}` }}>
        <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && onAdd()} placeholder="Nouvelle tâche…" style={{ ...inputStyle(), marginBottom: 8 }} />
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {(["high","medium","low"] as Priority[]).map(p => (
            <button key={p} onClick={() => setNewPriority(p)} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: `1.5px solid ${newPriority===p ? PRIORITY_COLORS[p] : C.grisClair}`, background: newPriority===p ? PRIORITY_COLORS[p]+"22" : C.blanc, fontSize: 11, color: newPriority===p ? PRIORITY_COLORS[p] : C.gris, cursor: "pointer" }}>
              {p==="high" ? "Urgent" : p==="medium" ? "Normal" : "Optionnel"}
            </button>
          ))}
        </div>
        <button onClick={onAdd} style={{ ...btnStyle(C.roseDark), width: "100%", padding: "9px 0" }}>+ Ajouter</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
        {pending.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px", borderRadius: 10, marginBottom: 6, background: C.cream, border: `1px solid ${C.grisClair}` }}>
            <input type="checkbox" checked={false} onChange={() => onToggle(t.id)} style={{ accentColor: C.roseDark, cursor: "pointer", marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: C.noir, lineHeight: 1.4 }}>{t.text}</div>
              <span style={{ fontSize: 10, color: PRIORITY_COLORS[t.priority], background: PRIORITY_COLORS[t.priority]+"22", borderRadius: 10, padding: "1px 7px", marginTop: 4, display: "inline-block" }}>
                {t.priority==="high" ? "Urgent" : t.priority==="medium" ? "Normal" : "Optionnel"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button onClick={() => onPlan(t)} style={{ background: C.roseLight, border: `1px solid ${C.rose}`, borderRadius: 6, padding: "3px 7px", fontSize: 11, color: C.roseDark, cursor: "pointer" }}>📅</button>
              <button onClick={() => onDelete(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.gris, fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
            </div>
          </div>
        ))}
        {done.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: C.gris, letterSpacing: 1, textTransform: "uppercase", margin: "12px 0 6px" }}>Terminées ({done.length})</div>
            {done.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, marginBottom: 4, background: C.blanc, opacity: 0.55 }}>
                <input type="checkbox" checked onChange={() => onToggle(t.id)} style={{ accentColor: C.roseDark, cursor: "pointer" }} />
                <span style={{ flex: 1, fontSize: 12, color: C.gris, textDecoration: "line-through" }}>{t.text}</span>
                <button onClick={() => onDelete(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.gris, fontSize: 16, padding: 0 }}>×</button>
              </div>
            ))}
          </>
        )}
      </div>
      <div style={{ padding: "12px 14px", borderTop: `1px solid ${C.grisClair}` }}>
        <div style={{ fontSize: 10, color: C.gris, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Catégories</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {(Object.keys(CATEGORIES) as CategoryKey[]).map(k => { const cat = CATEGORIES[k]; return <span key={k} style={{ fontSize: 10, background: cat.bg, border: `1px solid ${cat.border}`, borderRadius: 10, padding: "2px 8px", color: cat.text }}>{cat.emoji} {cat.label}</span>; })}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ──────────────────────────────────────────────────
export default function PlannerNovae() {
  const [view, setView] = useState("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [todos, setTodos] = useState<Todo[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [planModal, setPlanModal] = useState<Todo | null>(null);
  const [eventModal, setEventModal] = useState(false);
  const [editModal, setEditModal] = useState<CalEvent | null>(null);
  const [replanModal, setReplanModal] = useState<CalEvent | null>(null);
  const [form, setForm] = useState<FormData>({ title: "", date: fmtDate(new Date()), startMinutes: 9 * 60, endMinutes: 10 * 60, cat: "pro" });
  const [mobileTab, setMobileTab] = useState<MobileTab>("planner");
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [routineEvents, setRoutineEvents] = useState<CalEvent[]>([]);
  const [plannerConflicts, setPlannerConflicts] = useState<{routine: string, event: string, hour: number}[]>([]);
  const [showConflictBanner, setShowConflictBanner] = useState(false);
  const weekDates = getWeekDates(currentDate);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: todosData } = await supabase
      .from("todo_list")
      .select("id, title, priority, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (todosData) {
      setTodos(todosData.map((t: any) => ({
        id: t.id, text: t.title,
        priority: (t.priority as Priority) || "medium",
        done: t.status === "completed" || t.status === "done",
      })));
    }

    const { data: eventsData } = await supabase
      .from("tasks")
      .select("id, title, category, date, start_hour, duration_hours, status")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (eventsData) {
      setEvents(eventsData.map((e: any) => {
        const startH = e.start_hour || 9;
        const durH = e.duration_hours || 1;
        return {
          id: e.id, title: e.title,
          date: e.date ? e.date.split("T")[0] : fmtDate(new Date()),
          startMinutes: startH * 60, // compatibilité ancien format (heures entières)
          endMinutes: (startH + durH) * 60,
          cat: DB_TO_CAT[e.category?.toLowerCase()] || "pro",
          done: e.status === "completed" || e.status === "done",
          fromTodo: false, replanNeeded: false,
        };
      }));
    }

    const TODAY_KEY_P = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
    const { data: routinesData } = await supabase
      .from('routines')
      .select('id, title, description, preferred_time, duration_minutes, frequency, custom_days, category')
      .eq('user_id', user.id)
      .not('preferred_time', 'is', null);

    if (routinesData) {
      const today = fmtDate(new Date());
      const rEvents: CalEvent[] = routinesData
        .filter((r: any) => {
          if (!r.preferred_time) return false;
          if (r.frequency === 'daily') return true;
          const days = r.custom_days
            ? (Array.isArray(r.custom_days) ? r.custom_days : r.custom_days.replace(/[{}]/g, '').split(',').map((d: string) => d.trim()))
            : [];
          return days.length === 0 || days.length === 7 || days.includes(TODAY_KEY_P);
        })
        .map((r: any) => {
          const parts = r.preferred_time.split(':');
          const startMin = parseInt(parts[0]) * 60 + (parseInt(parts[1]) || 0);
          const durMin = r.duration_minutes || 60;
          return {
            id: `routine-${r.id}`,
            title: `${r.description || '✨'} ${r.title}`,
            date: today,
            startMinutes: startMin,
            endMinutes: startMin + durMin,
            cat: 'moi' as CategoryKey,
            done: false, fromTodo: false, replanNeeded: false,
          };
        });
      setRoutineEvents(rEvents);

      if (eventsData && rEvents.length > 0) {
        const newConflicts: {routine: string, event: string, hour: number}[] = [];
        rEvents.forEach((re) => {
          eventsData.forEach((ev: any) => {
            const evStart = (ev.start_hour || 9) * 60;
            const evEnd = evStart + (ev.duration_hours || 1) * 60;
            if (re.startMinutes < evEnd && re.endMinutes > evStart) {
              newConflicts.push({ routine: re.title, event: ev.title, hour: Math.floor(re.startMinutes / 60) });
            }
          });
        });
        if (newConflicts.length > 0) {
          setPlannerConflicts(newConflicts);
          setShowConflictBanner(true);
        }
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const todayStr = fmtDate(now);
      setEvents(prev => prev.map(e => {
        if (!e.done && !e.replanNeeded && e.date === todayStr && e.endMinutes < nowMinutes) {
          return { ...e, replanNeeded: true };
        }
        return e;
      }));
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  // ─── TODO ACTIONS ───────────────────────────────────────
  async function addTodo() {
    if (!newTask.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("todo_list").insert({ user_id: user.id, title: newTask.trim(), priority: newPriority, status: "pending" }).select().single();
    if (data) setTodos(p => [{ id: data.id, text: data.title, priority: newPriority, done: false }, ...p]);
    setNewTask("");
  }

  const toggleTodo = useCallback(async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const newDone = !todo.done;
    setTodos(p => p.map(t => t.id === id ? { ...t, done: newDone } : t));
    await supabase.from("todo_list").update({ status: newDone ? "completed" : "pending", updated_at: new Date().toISOString() }).eq("id", id);
  }, [todos]);

  const deleteTodo = useCallback(async (id: string) => {
    setTodos(p => p.filter(t => t.id !== id));
    await supabase.from("todo_list").delete().eq("id", id);
  }, []);

  // ─── EVENT ACTIONS ──────────────────────────────────────
  const toggleEvent = useCallback(async (id: string) => {
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    const newDone = !ev.done;
    setEvents(p => p.map(e => e.id === id ? { ...e, done: newDone, replanNeeded: false } : e));
    await supabase.from("tasks").update({ status: newDone ? "completed" : "pending", updated_at: new Date().toISOString() }).eq("id", id);
  }, [events]);

  const deleteEvent = useCallback(async (id: string) => {
    setEvents(p => p.filter(e => e.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
    setEditModal(null);
  }, []);

  const openReplan = useCallback((ev: CalEvent) => {
    setForm({ title: ev.title, date: fmtDate(new Date()), startMinutes: ev.startMinutes, endMinutes: ev.endMinutes, cat: ev.cat });
    setReplanModal(ev);
  }, []);

  function openPlanTodo(todo: Todo) {
    setForm({ title: todo.text, date: fmtDate(new Date()), startMinutes: 9 * 60, endMinutes: 10 * 60, cat: "pro" });
    setPlanModal(todo);
  }

  async function confirmPlanTodo() {
    if (!planModal) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const durH = (form.endMinutes - form.startMinutes) / 60;
    const { data } = await supabase.from("tasks").insert({
      user_id: user.id, title: form.title, date: form.date,
      start_hour: Math.floor(form.startMinutes / 60),
      duration_hours: Math.max(0.25, durH),
      category: CAT_TO_DB[form.cat], status: "pending",
    }).select().single();
    if (data) {
      setEvents(p => [...p, { id: data.id, title: form.title, date: form.date, startMinutes: form.startMinutes, endMinutes: form.endMinutes, cat: form.cat, done: false, fromTodo: true, replanNeeded: false }]);
    }
    await supabase.from("todo_list").delete().eq("id", planModal.id);
    setTodos(p => p.filter(t => t.id !== planModal.id));
    setPlanModal(null);
  }

  function openNewEvent(date?: string, startMinutes?: number) {
    setForm({ title: "", date: date || fmtDate(currentDate), startMinutes: startMinutes ?? 9 * 60, endMinutes: (startMinutes ?? 9 * 60) + 60, cat: "pro" });
    setEventModal(true);
  }

  async function confirmNewEvent() {
    if (!form.title.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const durH = (form.endMinutes - form.startMinutes) / 60;
    const { data } = await supabase.from("tasks").insert({
      user_id: user.id, title: form.title, date: form.date,
      start_hour: Math.floor(form.startMinutes / 60),
      duration_hours: Math.max(0.25, durH),
      category: CAT_TO_DB[form.cat], status: "pending",
    }).select().single();
    if (data) setEvents(p => [...p, { id: data.id, title: form.title, date: form.date, startMinutes: form.startMinutes, endMinutes: form.endMinutes, cat: form.cat, done: false, fromTodo: false, replanNeeded: false }]);
    setEventModal(false);
  }

  function openEdit(ev: CalEvent) {
    setForm({ title: ev.title, date: ev.date, startMinutes: ev.startMinutes, endMinutes: ev.endMinutes, cat: ev.cat });
    setEditModal(ev);
  }

  async function confirmEdit() {
    if (!editModal) return;
    setEvents(p => p.map(e => e.id === editModal.id ? { ...e, title: form.title, date: form.date, startMinutes: form.startMinutes, endMinutes: form.endMinutes, cat: form.cat, replanNeeded: false } : e));
    const durH = (form.endMinutes - form.startMinutes) / 60;
    await supabase.from("tasks").update({
      title: form.title, date: form.date,
      start_hour: Math.floor(form.startMinutes / 60),
      duration_hours: Math.max(0.25, durH),
      category: CAT_TO_DB[form.cat], updated_at: new Date().toISOString()
    }).eq("id", editModal.id);
    setEditModal(null);
  }

  async function confirmReplan() {
    if (!replanModal) return;
    setEvents(p => p.map(e => e.id === replanModal.id ? { ...e, date: form.date, startMinutes: form.startMinutes, endMinutes: form.endMinutes, replanNeeded: false, done: false } : e));
    const durH = (form.endMinutes - form.startMinutes) / 60;
    await supabase.from("tasks").update({
      date: form.date,
      start_hour: Math.floor(form.startMinutes / 60),
      duration_hours: Math.max(0.25, durH),
      status: "pending", updated_at: new Date().toISOString()
    }).eq("id", replanModal.id);
    setReplanModal(null);
  }

  function navigate(dir: number) {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    if (view === "week") d.setDate(d.getDate() + dir * 7);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  }

  // ─── RENDER ─────────────────────────────────────────────
  const plannerHeader = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${C.grisClair}`, background: C.blanc, flexWrap: "wrap" }}>
      <button onClick={() => navigate(-1)} style={navBtn()}>‹</button>
      <button onClick={() => navigate(1)} style={navBtn()}>›</button>
      <button onClick={() => setCurrentDate(new Date())} style={{ ...navBtn(), fontSize: 10, padding: "5px 10px", width: "auto", borderRadius: 12 }}>Auj.</button>
      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, color: C.noir, flex: 1, minWidth: 80 }}>
        {view === "day" && `${DAYS_FULL[(currentDate.getDay()+6)%7]} ${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]}`}
        {view === "week" && `Sem. du ${weekDates[0].getDate()} ${MONTHS[weekDates[0].getMonth()]}`}
        {view === "month" && `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
      </span>
      {[["day","Jour"],["week","Sem."],["month","Mois"]].map(([v,l]) => (
        <button key={v} onClick={() => setView(v)} style={{ padding: "5px 10px", borderRadius: 16, border: "none", background: view===v ? C.roseDark : C.grisClair, color: view===v ? C.blanc : C.gris, cursor: "pointer", fontSize: 11, fontWeight: view===v ? 600 : 400 }}>{l}</button>
      ))}
      {!isMobile && <button onClick={() => openNewEvent()} style={btnStyle(C.roseDark)}>+ Évén.</button>}
    </div>
  );

  const plannerContent = (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {view === "day" && <DayView currentDate={currentDate} events={[...events, ...routineEvents]} onNewEvent={openNewEvent} onToggle={toggleEvent} onDelete={deleteEvent} onReplan={openReplan} onEdit={openEdit} />}
      {view === "week" && <WeekView weekDates={weekDates} events={[...events, ...routineEvents]} onDayClick={d => { setCurrentDate(d); setView("day"); }} />}
      {view === "month" && <MonthView currentDate={currentDate} events={[...events, ...routineEvents]} onDayClick={d => { setCurrentDate(d); setView("day"); }} />}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.cream, fontFamily: "'DM Sans',sans-serif", overflow: "hidden" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: `1px solid ${C.grisClair}`, background: C.blanc, flexShrink: 0 }}>
        <a href="/" style={{ fontSize: 12, color: C.gris, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, border: `1px solid ${C.grisClair}`, background: C.cream }}>← Accueil</a>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: C.noir, marginLeft: 4 }}>Planner</span>
        {isMobile && mobileTab === "planner" && (
          <button onClick={() => openNewEvent()} style={{ ...btnStyle(C.roseDark), marginLeft: "auto", padding: "5px 12px", fontSize: 11 }}>+ Évén.</button>
        )}
      </div>

      {showConflictBanner && plannerConflicts.length > 0 && (
        <div style={{ background: "#FFF3E0", borderBottom: "2px solid #D4956A", padding: "10px 20px", display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#8A4A1A" }}>Conflits détectés aujourd'hui</p>
            {plannerConflicts.map((c, i) => (
              <p key={i} style={{ margin: "2px 0 0", fontSize: 12, color: "#6B3A10" }}>
                Routine <strong>{c.routine}</strong> à {String(c.hour).padStart(2,'0')}h chevauche <strong>{c.event}</strong>
              </p>
            ))}
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#aaa" }}>Pense à reporter ou annuler l'un des deux.</p>
          </div>
          <button onClick={() => setShowConflictBanner(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 18, flexShrink: 0, lineHeight: 1 }}>×</button>
        </div>
      )}

      {isMobile === false && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ width: 300, minWidth: 260, borderRight: `1px solid ${C.grisClair}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <TodoPanel todos={todos} newTask={newTask} setNewTask={setNewTask} newPriority={newPriority} setNewPriority={setNewPriority} onAdd={addTodo} onToggle={toggleTodo} onDelete={deleteTodo} onPlan={openPlanTodo} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {plannerHeader}
            {plannerContent}
          </div>
        </div>
      )}

      {(isMobile === true || isMobile === null) && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {mobileTab === "todo" ? (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <TodoPanel todos={todos} newTask={newTask} setNewTask={setNewTask} newPriority={newPriority} setNewPriority={setNewPriority} onAdd={addTodo} onToggle={toggleTodo} onDelete={deleteTodo} onPlan={openPlanTodo} />
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {plannerHeader}
              {plannerContent}
            </div>
          )}
          <div style={{ display: "flex", borderTop: `1px solid ${C.grisClair}`, background: C.blanc, flexShrink: 0 }}>
            <button onClick={() => setMobileTab("todo")} style={{ flex: 1, padding: "12px 0", border: "none", background: mobileTab === "todo" ? C.roseLight : C.blanc, color: mobileTab === "todo" ? C.roseDark : C.gris, cursor: "pointer", fontSize: 12, fontWeight: mobileTab === "todo" ? 700 : 400, borderTop: `2px solid ${mobileTab === "todo" ? C.roseDark : "transparent"}` }}>
              ✅ To-Do
            </button>
            <button onClick={() => setMobileTab("planner")} style={{ flex: 1, padding: "12px 0", border: "none", background: mobileTab === "planner" ? C.roseLight : C.blanc, color: mobileTab === "planner" ? C.roseDark : C.gris, cursor: "pointer", fontSize: 12, fontWeight: mobileTab === "planner" ? 700 : 400, borderTop: `2px solid ${mobileTab === "planner" ? C.roseDark : "transparent"}` }}>
              📅 Planning
            </button>
          </div>
        </div>
      )}

      {planModal   && <Modal title="📅 Planifier la tâche"    form={form} setForm={setForm} onConfirm={confirmPlanTodo}  onCancel={() => setPlanModal(null)}   confirmLabel="Planifier" />}
      {eventModal  && <Modal title="+ Nouvel événement"        form={form} setForm={setForm} onConfirm={confirmNewEvent}  onCancel={() => setEventModal(false)} confirmLabel="Ajouter" />}
      {editModal   && <Modal title="✏️ Modifier l'événement"  form={form} setForm={setForm} onConfirm={confirmEdit}      onCancel={() => setEditModal(null)}   confirmLabel="Modifier" onDelete={() => deleteEvent(editModal.id)} />}
      {replanModal && <Modal title="↻ Replanifier"             form={form} setForm={setForm} onConfirm={confirmReplan}    onCancel={() => setReplanModal(null)} confirmLabel="Replanifier" />}
    </div>
  );
}