"use client";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import Navigation from "@/components/Navigation";
import { DemoBanner } from '@/components/DemoBanner';
import { logEvent } from '@/lib/events';

// ─── TYPES ─────────────────────────────────────────────────
type Priority = "high" | "medium" | "low";
type CategoryKey = "pro" | "moi" | "famille" | "rdvfamille" | "couple" | "amis";
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
  startDate: string;
  endDate: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  cat: CategoryKey;
  done: boolean;
  fromTodo: boolean;
  replanNeeded: boolean;
  recurring: boolean;
  recurrenceDays: string[];
  reminderMinutes: number;
  isMultiDay: boolean;
}

interface FormData {
  title: string;
  startDate: string;
  endDate: string;
  startMinutes: number;
  endMinutes: number;
  cat: CategoryKey;
  recurrenceDays: string[];
  reminderMinutes: number;
}

interface CustodyConfig {
  mode: 'full_time' | 'alternate_weeks' | 'fixed_days' | 'custom';
  referenceDate: string;
  fixedDays: number[];
  note: string;
}

interface CustodyException {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  withChildren: boolean;
  note: string;
}

// ─── PALETTE ───────────────────────────────────────────────
const C = {
  cream: "#F8F1E5", roseLight: "#E3EEF5", rose: "#C2D7E8",
  roseDark: "#5E8AAE", noir: "#3D2618", gris: "#6B6B6B",
  grisClair: "#E8E4DF", blanc: "#FFFFFF",
};

const CATEGORIES: Record<CategoryKey, { label: string; emoji: string; bg: string; border: string; text: string }> = {
  pro:        { label: "Professionnel",   emoji: "💼", bg: "#C8D8E8", border: "#A0BEDC", text: "#2C5F8A" },
  moi:        { label: "Personnel / Moi", emoji: "🌸", bg: "#F2E0D8", border: "#D4A090", text: "#8A4A3A" },
  famille:    { label: "Moment famille",  emoji: "💛", bg: "#FBF0CC", border: "#E8D080", text: "#7A6010" },
  rdvfamille: { label: "RDV famille",     emoji: "🗓️", bg: "#FCE0CC", border: "#E8A86A", text: "#9A5A1A" },
  couple:     { label: "Couple",          emoji: "💕", bg: "#F5D0DC", border: "#E0A0B8", text: "#8A3050" },
  amis:       { label: "Amis",            emoji: "🌿", bg: "#CCE8D8", border: "#90C8A8", text: "#2A6A48" },
};

const CAT_TO_DB: Record<CategoryKey, string> = {
  pro: "pro", moi: "self", famille: "family", rdvfamille: "rdv_famille", couple: "social", amis: "social",
};
const DB_TO_CAT: Record<string, CategoryKey> = {
  pro: "pro", self: "moi", family: "famille", rdv_famille: "rdvfamille", social: "amis",
};

const PRIORITY_COLORS: Record<Priority, string> = { high: "#D4956A", medium: "#5E8AAE", low: "#6B6B6B" };

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const RECUR_DAYS = [
  { k: 'mon', l: 'L' }, { k: 'tue', l: 'M' }, { k: 'wed', l: 'M' },
  { k: 'thu', l: 'J' }, { k: 'fri', l: 'V' }, { k: 'sat', l: 'S' }, { k: 'sun', l: 'D' },
];
const RECUR_DAY_NAMES: Record<string, string> = { mon: 'Lun', tue: 'Mar', wed: 'Mer', thu: 'Jeu', fri: 'Ven', sat: 'Sam', sun: 'Dim' };

const REMINDER_OPTIONS = [
  { value: 0,     label: "Pas de rappel" },
  { value: 5,     label: "5 min avant" },
  { value: 10,    label: "10 min avant" },
  { value: 15,    label: "15 min avant" },
  { value: 30,    label: "30 min avant" },
  { value: 60,    label: "1 heure avant" },
  { value: 120,   label: "2 heures avant" },
  { value: 1440,  label: "1 jour avant" },
  { value: 2880,  label: "2 jours avant" },
  { value: 10080, label: "1 semaine avant" },
];

const SLOT_HEIGHT = 15;
const HOUR_HEIGHT = SLOT_HEIGHT * 4;
const DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAYS_FULL  = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

// ─── UTILS ─────────────────────────────────────────────────
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function minutesToLabel(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function isToday(d: Date): boolean { return fmtDate(d) === fmtDate(new Date()); }
function getWeekDates(date: Date): Date[] {
  const d = new Date(date);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x; });
}
function getDaysInMonth(y: number, m: number): number { return new Date(y, m + 1, 0).getDate(); }
function masterId(id: string): string {
  if (id.startsWith('recur::')) return id.split('::')[1];
  if (id.startsWith('multiday::')) return id.split('::')[1];
  return id;
}


type CustomCustodyPattern = {
  startDay: number;
  startTime: string;
  endDay: number;
  endTime: string;
};

function normalizeFrench(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTimeToken(hour: string, minute?: string): string {
  return `${hour.padStart(2, "0")}:${(minute || "00").padStart(2, "0")}`;
}

function parseCustomCustodyPattern(note: string): CustomCustodyPattern | null {
  const normalized = normalizeFrench(note);
  if (!normalized) return null;

  const dayMap: Record<string, number> = {
    dimanche: 0,
    lundi: 1,
    mardi: 2,
    mercredi: 3,
    jeudi: 4,
    vendredi: 5,
    samedi: 6,
  };

  const dayPattern = "(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?";
  const timePattern = "(?:a|vers)\\s*(\\d{1,2})(?:\\s*[h:]\\s*(\\d{1,2}))?";
  const clauses = normalized.split(/\s+(?:et|puis|ensuite)\s+|[,;.]/).map(item => item.trim()).filter(Boolean);

  let start: { day: number; time: string } | null = null;
  let end: { day: number; time: string } | null = null;

  for (const clause of clauses) {
    const match = clause.match(new RegExp(`${dayPattern}.*?${timePattern}`));
    if (!match) continue;

    const day = dayMap[match[1]];
    const time = parseTimeToken(match[2], match[3]);

    const isStart = /\b(recupere|reprend|reviennent|revient|arrivent|arrive|commence|debut)\b/.test(clause);
    const isEnd = /\b(repartent|repart|retournent|retourne|rentre|rentrent|fin|termine|pere .*recupere|papa .*recupere)\b/.test(clause);

    if (isStart && !start) start = { day, time };
    if (isEnd && !end) end = { day, time };
  }

  if (!start || !end) {
    const matches = Array.from(normalized.matchAll(new RegExp(`${dayPattern}.*?${timePattern}`, "g")));
    if (matches.length >= 2) {
      start = start || { day: dayMap[matches[0][1]], time: parseTimeToken(matches[0][2], matches[0][3]) };
      end = end || { day: dayMap[matches[1][1]], time: parseTimeToken(matches[1][2], matches[1][3]) };
    }
  }

  if (!start || !end) return null;
  return { startDay: start.day, startTime: start.time, endDay: end.day, endTime: end.time };
}

function customCustodyForDate(date: Date, note: string) {
  const pattern = parseCustomCustodyPattern(note);
  if (!pattern) return null;

  const day = date.getDay();
  const start = pattern.startDay;
  const end = pattern.endDay;

  const inRange = start <= end
    ? day >= start && day <= end
    : day >= start || day <= end;

  if (day === start) {
    return {
      withChildren: true,
      source: 'rhythm' as const,
      note,
      transition: `Tu récupères les filles à ${pattern.startTime}`,
      phase: 'start' as const,
    };
  }

  if (day === end) {
    return {
      withChildren: true,
      source: 'rhythm' as const,
      note,
      transition: `Les filles repartent à ${pattern.endTime}`,
      phase: 'end' as const,
    };
  }

  return {
    withChildren: inRange,
    source: 'rhythm' as const,
    note,
    transition: inRange ? 'Les filles sont avec toi' : 'Les filles ne sont pas avec toi',
    phase: inRange ? 'with' as const : 'without' as const,
  };
}

function custodyVisual(status: ReturnType<typeof custodyStatusForDate>) {
  if (status.phase === 'start') return { bg: "#EAF3EE", border: "#4E8B70", text: "#356B55", label: status.transition || "Reprise" };
  if (status.phase === 'end') return { bg: "#FFF0E4", border: "#D4956A", text: "#8A4A1A", label: status.transition || "Départ" };
  if (status.withChildren === true) return { bg: "#EAF3EE", border: "#7BAE96", text: "#356B55", label: "Avec les filles" };
  if (status.withChildren === false) return { bg: "#F4EFE8", border: "#C9BBAA", text: "#75685B", label: "Sans les filles" };
  return { bg: C.blanc, border: C.grisClair, text: C.gris, label: "" };
}

function custodyStatusForDate(
  date: Date,
  config: CustodyConfig | null,
  exceptions: CustodyException[],
): {
  withChildren: boolean | null;
  source: 'exception' | 'rhythm' | 'unknown';
  note?: string;
  transition?: string;
  phase?: 'start' | 'end' | 'with' | 'without';
} {
  const dateStr = fmtDate(date);
  const exception = exceptions.find(item => item.startDate <= dateStr && item.endDate >= dateStr);

  if (exception) {
    let transition = '';
    let phase: 'start' | 'end' | 'with' | 'without' = exception.withChildren ? 'with' : 'without';

    if (exception.startDate === dateStr && exception.startTime) {
      transition = exception.withChildren
        ? `Tu récupères les filles à ${exception.startTime}`
        : `Les filles repartent à ${exception.startTime}`;
      phase = exception.withChildren ? 'start' : 'end';
    } else if (exception.endDate === dateStr && exception.endTime) {
      transition = `Fin de l’exception à ${exception.endTime}`;
    }

    return {
      withChildren: exception.withChildren,
      source: 'exception',
      note: exception.note,
      transition,
      phase,
    };
  }

  if (!config) return { withChildren: null, source: 'unknown' };
  if (config.mode === 'full_time') {
    return { withChildren: true, source: 'rhythm', transition: 'Les filles sont avec toi', phase: 'with' };
  }
  if (config.mode === 'fixed_days') {
    const withChildren = config.fixedDays.includes(date.getDay());
    return {
      withChildren,
      source: 'rhythm',
      transition: withChildren ? 'Les filles sont avec toi' : 'Les filles ne sont pas avec toi',
      phase: withChildren ? 'with' : 'without',
    };
  }
  if (config.mode === 'alternate_weeks' && config.referenceDate) {
    const reference = new Date(`${config.referenceDate}T12:00:00`);
    const target = new Date(`${dateStr}T12:00:00`);
    const dayDifference = Math.floor((target.getTime() - reference.getTime()) / 86400000);
    const weekDifference = Math.floor(dayDifference / 7);
    const withChildren = ((weekDifference % 2) + 2) % 2 === 0;
    return {
      withChildren,
      source: 'rhythm',
      transition: withChildren ? 'Les filles sont avec toi' : 'Les filles ne sont pas avec toi',
      phase: withChildren ? 'with' : 'without',
    };
  }
  if (config.mode === 'custom') {
    return customCustodyForDate(date, config.note)
      || { withChildren: null, source: 'unknown', note: config.note };
  }

  return { withChildren: null, source: 'unknown', note: config.note };
}

// ─── STYLE HELPERS ─────────────────────────────────────────
const inputStyle = (): React.CSSProperties => ({
  width: "100%", border: "1px solid #E8E4DF", borderRadius: 8,
  padding: "8px 10px", fontSize: 13, fontFamily: "'DM Sans',sans-serif",
  background: "#FBF6EE", outline: "none", boxSizing: "border-box", color: "#3D2618",
});
const labelStyle = (): React.CSSProperties => ({
  display: "block", fontSize: 11, color: "#6B6B6B", letterSpacing: 0.5,
  marginBottom: 4, textTransform: "uppercase" as const,
});
const btnStyle = (bg?: string): React.CSSProperties => ({
  padding: "7px 14px", borderRadius: 8, border: "none", background: bg || "#5E8AAE",
  color: "#FFFFFF", cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
  fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" as const,
});
const navBtn = (): React.CSSProperties => ({
  width: 30, height: 30, borderRadius: "50%", border: "1px solid #E8E4DF",
  background: "#FFFFFF", cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
  fontSize: 16, color: "#6B6B6B", display: "flex", alignItems: "center", justifyContent: "center",
});

// ─── MODAL ─────────────────────────────────────────────────
function Modal({ title, form, setForm, onConfirm, onCancel, onDelete, confirmLabel = "Confirmer" }: {
  title: string;
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onConfirm: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  confirmLabel?: string;
}) {
  const toggleRecur = (k: string) =>
    setForm(f => ({
      ...f,
      recurrenceDays: f.recurrenceDays.includes(k)
        ? f.recurrenceDays.filter(x => x !== k)
        : [...f.recurrenceDays, k],
    }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, boxShadow: "0 8px 40px rgba(0,0,0,0.15)", maxHeight: "92vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 18px", fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#3D2618" }}>{title}</h3>

        {/* Titre */}
        <label style={labelStyle()}>Titre</label>
        <input
          autoFocus
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Nom de l'événement…"
          style={{ ...inputStyle(), marginBottom: 14 }}
        />

        {/* Dates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle()}>Date début</label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({
                ...f,
                startDate: e.target.value,
                endDate: f.endDate < e.target.value ? e.target.value : f.endDate,
              }))}
              style={inputStyle()}
            />
          </div>
          <div>
            <label style={labelStyle()}>Date fin</label>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              style={inputStyle()}
            />
          </div>
        </div>

        {/* Heures */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle()}>Heure début</label>
            <input
              type="time"
              step="300"
              value={minutesToLabel(form.startMinutes)}
              onChange={e => {
                const [h, m] = e.target.value.split(':').map(Number);
                if (isNaN(h) || isNaN(m)) return;
                const mins = h * 60 + m;
                setForm(f => ({
                  ...f,
                  startMinutes: mins,
                  endMinutes: f.endMinutes <= mins ? mins + 30 : f.endMinutes,
                }));
              }}
              style={inputStyle()}
            />
          </div>
          <div>
            <label style={labelStyle()}>Heure fin</label>
            <input
              type="time"
              step="300"
              value={minutesToLabel(form.endMinutes)}
              onChange={e => {
                const [h, m] = e.target.value.split(':').map(Number);
                if (isNaN(h) || isNaN(m)) return;
                const mins = h * 60 + m;
                if (form.startDate === form.endDate && mins <= form.startMinutes) return;
                setForm(f => ({ ...f, endMinutes: mins }));
              }}
              style={inputStyle()}
            />
          </div>
        </div>

        {/* Rappel */}
        <label style={labelStyle()}>🔔 Me rappeler</label>
        <select
          value={form.reminderMinutes}
          onChange={e => setForm(f => ({ ...f, reminderMinutes: +e.target.value }))}
          style={{ ...inputStyle(), marginBottom: 14 }}
        >
          {REMINDER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Catégorie */}
        <label style={labelStyle()}>Catégorie</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {(Object.keys(CATEGORIES) as CategoryKey[]).map(key => {
            const cat = CATEGORIES[key];
            const sel = form.cat === key;
            return (
              <button
                key={key}
                onClick={() => setForm(f => ({ ...f, cat: key }))}
                style={{ padding: "8px 6px", borderRadius: 8, border: `2px solid ${sel ? cat.border : "#E8E4DF"}`, background: sel ? cat.bg : "#FFFFFF", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: sel ? cat.text : "#6B6B6B", textAlign: "left" }}
              >
                {cat.emoji} {cat.label}
              </button>
            );
          })}
        </div>

        {/* Répétition */}
        <label style={labelStyle()}>Répétition <span style={{ textTransform: "none", letterSpacing: 0 }}>(optionnel)</span></label>
        <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
          {RECUR_DAYS.map(d => {
            const sel = form.recurrenceDays.includes(d.k);
            return (
              <button
                key={d.k}
                type="button"
                onClick={() => toggleRecur(d.k)}
                style={{ flex: 1, height: 34, borderRadius: 8, border: `2px solid ${sel ? C.roseDark : "#E8E4DF"}`, background: sel ? C.roseLight : "#FFFFFF", cursor: "pointer", fontSize: 12, fontWeight: 700, color: sel ? C.roseDark : "#bbb" }}
              >
                {d.l}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: C.gris, margin: "0 0 18px" }}>
          {form.recurrenceDays.length === 0
            ? form.startDate !== form.endDate
              ? `📅 Du ${form.startDate} au ${form.endDate}`
              : "Événement ponctuel à la date choisie."
            : form.recurrenceDays.length === 7
              ? "🔁 Se répète tous les jours."
              : `🔁 Se répète : ${form.recurrenceDays.map(k => RECUR_DAY_NAMES[k]).join(', ')}`}
        </p>

        {/* Boutons */}
        <div style={{ display: "flex", gap: 10, marginBottom: onDelete ? 10 : 0 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #E8E4DF", background: "#FFFFFF", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", color: "#6B6B6B" }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: "#5E8AAE", color: "#FFFFFF", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}
          >
            {confirmLabel}
          </button>
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "1.5px solid rgba(220,50,50,0.2)", background: "rgba(220,50,50,0.06)", color: "#c0392b", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, marginTop: 0 }}
          >
            🗑 Supprimer cet événement
          </button>
        )}
      </div>
    </div>
  );
}

// ─── DAY EVENTS ────────────────────────────────────────────
function renderDayEvents(
  dayEvents: CalEvent[],
  onToggle: (id: string) => void,
  onReplan: (ev: CalEvent) => void,
  onEdit: (ev: CalEvent) => void
) {
  if (!dayEvents.length) return null;
  const sorted = [...dayEvents].sort((a, b) => a.startMinutes - b.startMinutes);
  const columns: CalEvent[][] = [];
  for (const ev of sorted) {
    let placed = false;
    for (const col of columns) {
      if (col[col.length - 1].endMinutes <= ev.startMinutes) { col.push(ev); placed = true; break; }
    }
    if (!placed) columns.push([ev]);
  }
  const totalCols = columns.length;
  return columns.map((col, ci) =>
    col.map(ev => {
      const cat = CATEGORIES[ev.cat];
      const isRoutine = ev.id.startsWith('routine-');
      const top = (ev.startMinutes / 60) * HOUR_HEIGHT;
      const height = Math.max(((ev.endMinutes - ev.startMinutes) / 60) * HOUR_HEIGHT - 2, 20);
      return (
        <div
          key={ev.id}
          style={{ position: "absolute", top, left: `calc(52px + (100% - 52px) / ${totalCols} * ${ci})`, width: `calc((100% - 52px) / ${totalCols})`, height, background: ev.done ? "#E8E4DF" : cat.bg, border: `1.5px solid ${ev.replanNeeded ? "#D4956A" : (ev.done ? "#E8E4DF" : cat.border)}`, borderLeft: `4px solid ${ev.done ? "#6B6B6B" : cat.border}`, borderRadius: 8, padding: "4px 8px", boxSizing: "border-box", opacity: ev.done ? 0.55 : 1, overflow: "hidden", zIndex: 2 }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
            {ev.recurring
              ? <span title="Récurrent" style={{ fontSize: 12, marginTop: 1, flexShrink: 0, color: cat.text }}>🔁</span>
              : ev.isMultiDay
                ? <span title="Multi-jours" style={{ fontSize: 12, marginTop: 1, flexShrink: 0, color: cat.text }}>📅</span>
                : <input type="checkbox" checked={ev.done} onChange={() => onToggle(ev.id)} style={{ accentColor: cat.border, cursor: "pointer", marginTop: 2, flexShrink: 0 }} />
            }
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", color: ev.done ? "#6B6B6B" : cat.text, textDecoration: ev.done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {cat.emoji} {ev.title}
              </div>
              <div style={{ fontSize: 10, color: "#6B6B6B" }}>
                {ev.isMultiDay
                  ? `${ev.startDate} → ${ev.endDate}`
                  : `${minutesToLabel(ev.startMinutes)} → ${minutesToLabel(ev.endMinutes)}`
                }
                {ev.reminderMinutes > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>🔔</span>}
              </div>
            </div>
            {!isRoutine && (
              <button onClick={() => onEdit(ev)} title="Modifier" style={{ background: "none", border: "none", cursor: "pointer", color: "#6B6B6B", fontSize: 14, padding: "1px 3px" }}>✏️</button>
            )}
          </div>
          {ev.replanNeeded && !ev.done && (
            <button onClick={() => onReplan(ev)} style={{ marginTop: 4, background: "#D4956A", color: "#FFF", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>
              ↻ Replanifier
            </button>
          )}
        </div>
      );
    })
  );
}

// ─── DAY VIEW ──────────────────────────────────────────────
function DayView({ currentDate, events, onNewEvent, onToggle, onReplan, onEdit }: {
  currentDate: Date;
  events: CalEvent[];
  onNewEvent: (date: string, startMinutes: number) => void;
  onToggle: (id: string) => void;
  onReplan: (ev: CalEvent) => void;
  onEdit: (ev: CalEvent) => void;
}) {
  const dateStr = fmtDate(currentDate);
  const dayEvents = events.filter(e => e.date === dateStr);
  const now = new Date();
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 8px", borderBottom: `1px solid ${C.grisClair}` }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 600, color: C.noir }}>
          {DAYS_FULL[(currentDate.getDay() + 6) % 7]} {currentDate.getDate()} {MONTHS[currentDate.getMonth()]}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isToday(currentDate) && <span style={{ background: C.roseDark, color: C.blanc, borderRadius: 20, padding: "2px 10px", fontSize: 10 }}>AUJOURD'HUI</span>}
          <button onClick={() => onNewEvent(dateStr, 9 * 60)} style={btnStyle(C.roseDark)}>+ Évén.</button>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        {HOURS.map(h => (
          <div key={h} style={{ display: "flex", height: HOUR_HEIGHT, borderBottom: `1px solid ${C.grisClair}` }}>
            <div style={{ width: 52, padding: "6px 8px 0", fontSize: 11, color: C.gris, flexShrink: 0, borderRight: `1px solid ${C.grisClair}` }}>
              {String(h).padStart(2, "0")}:00
            </div>
            <div style={{ flex: 1, position: "relative" }}>
              {[15, 30, 45].map(min => (
                <div key={min} style={{ position: "absolute", left: 0, right: 0, top: (min / 60) * HOUR_HEIGHT, borderTop: `1px dashed ${min === 30 ? "#E0DCD8" : "#F0EDEA"}`, pointerEvents: "none" }} />
              ))}
            </div>
          </div>
        ))}
        {isToday(currentDate) && (
          <div style={{ position: "absolute", left: 52, right: 0, top: (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT, height: 2, background: C.roseDark, zIndex: 10, display: "flex", alignItems: "center", pointerEvents: "none" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.roseDark, marginLeft: -3 }} />
          </div>
        )}
        {renderDayEvents(dayEvents, onToggle, onReplan, onEdit)}
      </div>
    </div>
  );
}

// ─── WEEK VIEW ─────────────────────────────────────────────
function WeekView({ weekDates, events, custodyConfig, custodyExceptions, onDayClick }: {
  weekDates: Date[];
  events: CalEvent[];
  custodyConfig: CustodyConfig | null;
  custodyExceptions: CustodyException[];
  onDayClick: (d: Date) => void;
}) {
  const START_H = 6, END_H = 23;
  const HOURS = Array.from({ length: END_H - START_H + 1 }, (_, i) => i + START_H);
  const totalH = (END_H - START_H + 1) * HOUR_HEIGHT;

  const layout = (dayEvents: CalEvent[]) => {
    const sorted = [...dayEvents].sort((a, b) => a.startMinutes - b.startMinutes);
    const cols: CalEvent[][] = [];
    for (const ev of sorted) {
      let placed = false;
      for (const col of cols) {
        if (col[col.length - 1].endMinutes <= ev.startMinutes) { col.push(ev); placed = true; break; }
      }
      if (!placed) cols.push([ev]);
    }
    const n = cols.length || 1;
    const blocks: { ev: CalEvent; ci: number; n: number }[] = [];
    cols.forEach((col, ci) => col.forEach(ev => blocks.push({ ev, ci, n })));
    return blocks;
  };

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <div style={{ minWidth: 620 }}>
        <div style={{ display: "grid", gridTemplateColumns: "44px repeat(7,1fr)", position: "sticky", top: 0, background: C.blanc, zIndex: 5 }}>
          <div style={{ borderBottom: `1px solid ${C.grisClair}`, borderRight: `1px solid ${C.grisClair}` }} />
          {weekDates.map((d, i) => {
            const custody = custodyStatusForDate(d, custodyConfig, custodyExceptions);
            return (
              <div key={i} onClick={() => onDayClick(d)} title={custody.transition || custody.note || undefined} style={{ padding: "6px 2px", textAlign: "center", cursor: "pointer", borderBottom: `1px solid ${C.grisClair}`, borderRight: `1px solid ${C.grisClair}`, background: isToday(d) ? C.roseLight : custody.withChildren === true ? "rgba(185,215,203,0.18)" : C.blanc }}>
                <div style={{ fontSize: 9, color: C.gris, letterSpacing: 1, textTransform: "uppercase" }}>{DAYS_SHORT[i]}</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Cormorant Garamond',serif", background: isToday(d) ? C.roseDark : "transparent", color: isToday(d) ? C.blanc : C.noir, borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", margin: "2px auto 0" }}>
                  {d.getDate()}
                </div>
                <div style={{ minHeight: 13, marginTop: 1, fontSize: 9, color: custody.withChildren === true ? "#4E7D6A" : C.gris, fontWeight: 700 }}>
                  {custody.transition || (custody.withChildren === true ? "Avec" : custody.withChildren === false ? "Sans" : "")}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "44px repeat(7,1fr)" }}>
          <div style={{ position: "relative", height: totalH, borderRight: `1px solid ${C.grisClair}` }}>
            {HOURS.map((h, idx) => (
              <div key={h} style={{ position: "absolute", top: idx * HOUR_HEIGHT - 6, left: 0, right: 0, fontSize: 10, color: C.gris, padding: "0 4px", textAlign: "right" }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {weekDates.map((d, di) => {
            const ds = fmtDate(d);
            const blocks = layout(events.filter(e => e.date === ds));
            return (
              <div key={di} style={{ position: "relative", height: totalH, borderRight: `1px solid ${C.grisClair}`, background: isToday(d) ? "#FBF6EE" : "transparent" }}>
                {HOURS.map((h, idx) => (
                  <div key={h} style={{ position: "absolute", top: idx * HOUR_HEIGHT, left: 0, right: 0, borderTop: `1px solid ${C.grisClair}` }} />
                ))}
                {blocks.map(({ ev, ci, n }) => {
                  const cat = CATEGORIES[ev.cat];
                  const topMin = Math.max(ev.startMinutes - START_H * 60, 0);
                  const top = (topMin / 60) * HOUR_HEIGHT;
                  const visStart = Math.max(ev.startMinutes, START_H * 60);
                  const height = Math.max(((ev.endMinutes - visStart) / 60) * HOUR_HEIGHT - 1, 15);
                  return (
                    <div
                      key={ev.id}
                      title={`${ev.title} · ${minutesToLabel(ev.startMinutes)}-${minutesToLabel(ev.endMinutes)}`}
                      onClick={() => onDayClick(d)}
                      style={{ position: "absolute", top, height, left: `calc(${(ci / n) * 100}% + 1px)`, width: `calc(${100 / n}% - 2px)`, background: ev.done ? "#E8E4DF" : cat.bg, borderLeft: `3px solid ${ev.done ? "#6B6B6B" : cat.border}`, borderRadius: 4, padding: "1px 3px", boxSizing: "border-box", overflow: "hidden", cursor: "pointer", opacity: ev.done ? 0.55 : 1, fontSize: 9, color: ev.done ? C.gris : cat.text, lineHeight: 1.15 }}
                    >
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {cat.emoji} {ev.title}
                      </div>
                      {height > 26 && <div style={{ fontSize: 8, opacity: 0.7 }}>{minutesToLabel(ev.startMinutes)}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── MONTH VIEW ────────────────────────────────────────────
function MonthView({ currentDate, events, custodyConfig, custodyExceptions, onDayClick }: {
  currentDate: Date;
  events: CalEvent[];
  custodyConfig: CustodyConfig | null;
  custodyExceptions: CustodyException[];
  onDayClick: (d: Date) => void;
}) {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let i = 1; i <= getDaysInMonth(y, m); i++) cells.push(new Date(y, m, i));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ flex: 1, padding: "8px 12px", overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>
        {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, color: C.gris, fontWeight: 600, padding: "4px 0" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ds = fmtDate(d);
          const dayEvs = events.filter(e => e.date === ds);
          const tod = isToday(d);
          const custody = custodyStatusForDate(d, custodyConfig, custodyExceptions);
          const visual = custodyVisual(custody);
          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              title={custody.transition || custody.note || undefined}
              style={{
                minWidth: 0,
                overflow: "hidden",
                minHeight: 82,
                border: `1px solid ${tod ? C.roseDark : visual.border}`,
                borderRadius: 8,
                padding: 4,
                cursor: "pointer",
                background: tod ? C.roseLight : C.blanc,
                boxShadow: custody.withChildren !== null ? `inset 0 4px 0 ${visual.border}` : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, marginBottom: 3 }}>
                <div style={{ fontSize: 13, fontWeight: tod ? 700 : 400, color: tod ? C.roseDark : C.noir, fontFamily: "'Cormorant Garamond',serif" }}>{d.getDate()}</div>
                {custody.withChildren !== null && (
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: visual.border, flexShrink: 0 }} />
                )}
              </div>
              {custody.transition && (
                <div style={{ background: visual.bg, borderLeft: `3px solid ${visual.border}`, borderRadius: 3, padding: "2px 4px", fontSize: 8, color: visual.text, fontWeight: 700, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {custody.transition}
                </div>
              )}
              {dayEvs.slice(0, 2).map(ev => {
                const cat = CATEGORIES[ev.cat];
                return <div key={ev.id} style={{ background: cat.bg, borderRadius: 3, padding: "1px 4px", fontSize: 10, color: cat.text, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.emoji} {ev.title}</div>;
              })}
              {dayEvs.length > 2 && <div style={{ fontSize: 10, color: C.gris }}>+{dayEvs.length - 2}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ currentDate, custodyConfig, custodyExceptions, onMonthClick }: {
  currentDate: Date;
  custodyConfig: CustodyConfig | null;
  custodyExceptions: CustodyException[];
  onMonthClick: (month: number) => void;
}) {
  const year = currentDate.getFullYear();

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(235px,1fr))", gap: 12 }}>
        {MONTHS.map((monthLabel, month) => {
          const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
          const days = getDaysInMonth(year, month);
          const cells: (Date | null)[] = [
            ...Array.from({ length: firstDow }, () => null),
            ...Array.from({ length: days }, (_, index) => new Date(year, month, index + 1)),
          ];
          while (cells.length % 7 !== 0) cells.push(null);

          return (
            <button key={monthLabel} onClick={() => onMonthClick(month)} style={{ border: `1px solid ${C.grisClair}`, borderRadius: 12, background: C.blanc, padding: 10, textAlign: "left", cursor: "pointer" }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17, fontWeight: 700, color: C.noir, marginBottom: 8 }}>{monthLabel}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
                {DAYS_SHORT.map(day => <span key={day} style={{ fontSize: 8, color: C.gris, textAlign: "center", fontWeight: 700 }}>{day.slice(0, 1)}</span>)}
                {cells.map((date, index) => {
                  if (!date) return <span key={index} />;
                  const status = custodyStatusForDate(date, custodyConfig, custodyExceptions);
                  const visual = custodyVisual(status);
                  return (
                    <span
                      key={index}
                      title={status.transition || status.note || undefined}
                      style={{
                        height: 20,
                        borderRadius: 5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        fontWeight: status.phase === "start" || status.phase === "end" ? 800 : 500,
                        color: status.withChildren === null ? C.gris : visual.text,
                        background: status.withChildren === null ? C.cream : visual.bg,
                        border: `1px solid ${status.withChildren === null ? C.grisClair : visual.border}`,
                      }}
                    >
                      {date.getDate()}
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── TODO PANEL ────────────────────────────────────────────
function TodoPanel({ todos, newTask, setNewTask, newPriority, setNewPriority, onAdd, onToggle, onDelete, onPlan }: {
  todos: Todo[];
  newTask: string;
  setNewTask: (v: string) => void;
  newPriority: Priority;
  setNewPriority: (p: Priority) => void;
  onAdd: () => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPlan: (t: Todo) => void;
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
        <input
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onAdd()}
          placeholder="Nouvelle tâche…"
          style={{ ...inputStyle(), marginBottom: 8 }}
        />
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {(["high", "medium", "low"] as Priority[]).map(p => (
            <button key={p} onClick={() => setNewPriority(p)} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: `1.5px solid ${newPriority === p ? PRIORITY_COLORS[p] : C.grisClair}`, background: newPriority === p ? PRIORITY_COLORS[p] + "22" : C.blanc, fontSize: 11, color: newPriority === p ? PRIORITY_COLORS[p] : C.gris, cursor: "pointer" }}>
              {p === "high" ? "Urgent" : p === "medium" ? "Normal" : "Optionnel"}
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
              <span style={{ fontSize: 10, color: PRIORITY_COLORS[t.priority], background: PRIORITY_COLORS[t.priority] + "22", borderRadius: 10, padding: "1px 7px", marginTop: 4, display: "inline-block" }}>
                {t.priority === "high" ? "Urgent" : t.priority === "medium" ? "Normal" : "Optionnel"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button onClick={() => onPlan(t)} style={{ background: C.roseLight, border: `1px solid ${C.rose}`, borderRadius: 6, padding: "3px 7px", fontSize: 11, color: C.roseDark, cursor: "pointer" }}>📅</button>
              <button onClick={() => onDelete(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.gris, fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
            </div>
          </div>
        ))}
        {pending.length === 0 && (
          <p style={{ textAlign: "center", color: C.gris, fontSize: 12, padding: "16px 0", opacity: 0.7 }}>Aucune tâche en attente ✨</p>
        )}
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
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.grisClair}` }}>
          <div style={{ fontSize: 10, color: C.gris, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Catégories</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {(Object.keys(CATEGORIES) as CategoryKey[]).map(k => {
              const cat = CATEGORIES[k];
              return <span key={k} style={{ fontSize: 10, background: cat.bg, border: `1px solid ${cat.border}`, borderRadius: 10, padding: "2px 8px", color: cat.text }}>{cat.emoji} {cat.label}</span>;
            })}
          </div>
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
  const [form, setForm] = useState<FormData>({
    title: "", startDate: fmtDate(new Date()), endDate: fmtDate(new Date()),
    startMinutes: 9 * 60, endMinutes: 10 * 60, cat: "pro",
    recurrenceDays: [], reminderMinutes: 15,
  });
  const [mobileTab, setMobileTab] = useState<MobileTab>("planner");
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [routineEvents, setRoutineEvents] = useState<CalEvent[]>([]);
  const [plannerConflicts, setPlannerConflicts] = useState<{ routine: string; event: string; hour: number }[]>([]);
  const [showConflictBanner, setShowConflictBanner] = useState(false);
  const [custodyConfig, setCustodyConfig] = useState<CustodyConfig | null>(null);
  const [custodyExceptions, setCustodyExceptions] = useState<CustodyException[]>([]);
  const weekDates = getWeekDates(currentDate);

  useEffect(() => {
    if (window.location.search.includes("tab=todo")) {
      window.location.replace("/todo")
      return
    }
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) logEvent(supabase, user.id, 'module_planner');
    });
  }, []);

  // ─── REPLAN TIMER ─────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const todayStr = fmtDate(now);
      setEvents(prev => prev.map(e => {
        if (!e.recurring && !e.isMultiDay && !e.done && !e.replanNeeded && e.date === todayStr && e.endMinutes < nowMinutes) {
          return { ...e, replanNeeded: true };
        }
        return e;
      }));
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  // ─── LOAD DATA ────────────────────────────────────────────
  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { if (!silent) setLoading(false); return; }

    // Même stratégie de lecture que la page Entourage : on récupère les lignes
    // de garde puis on filtre côté client. Cela évite qu'une valeur historique
    // ou nullable de is_active masque une organisation pourtant enregistrée.
    const { data: custodyRows, error: custodyError } = await supabase
      .from("family_data")
      .select("*")
      .eq("user_id", user.id)
      .in("data_type", ["custody_config", "custody_exception"]);

    if (custodyError) {
      console.error("Planner: impossible de charger la garde", custodyError);
    }

    const activeCustodyRows = (custodyRows || []).filter((row: any) => row.is_active !== false);
    const configRow = activeCustodyRows.find((row: any) => row.data_type === "custody_config");
    if (configRow?.data) {
      setCustodyConfig({
        mode: configRow.data.mode || "alternate_weeks",
        referenceDate: configRow.data.referenceDate || "",
        fixedDays: Array.isArray(configRow.data.fixedDays) ? configRow.data.fixedDays.map(Number) : [],
        note: configRow.data.note || "",
      });
    } else {
      setCustodyConfig(null);
    }
    setCustodyExceptions(
      activeCustodyRows
        .filter((row: any) => row.data_type === "custody_exception")
        .map((row: any) => ({
          startDate: row.data?.startDate || "",
          startTime: row.data?.startTime || "",
          endDate: row.data?.endDate || row.data?.startDate || "",
          endTime: row.data?.endTime || "",
          withChildren: row.data?.withChildren !== false,
          note: row.data?.note || "",
        }))
        .filter((row: CustodyException) => row.startDate),
    );

    // Todos
    const { data: todosData } = await supabase
      .from("todo_list")
      .select("id, title, priority, status")
      .eq("user_id", user.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (todosData) {
      setTodos(todosData.map((t: any) => ({
        id: t.id, text: t.title,
        priority: (t.priority as Priority) || "medium",
        done: t.status === "completed" || t.status === "done",
      })));
    }

    // Événements depuis planner_events
    const { data: eventsData } = await supabase
      .from("planner_events")
      .select("id, title, category, start_date, end_date, start_minutes, end_minutes, recurrence_days, reminder_minutes_before")
      .eq("user_id", user.id)
      .neq("status", "cancelled")
      .order("start_date", { ascending: true });

    const baseNow = new Date();
    const windowDates: Date[] = [];
    for (let i = -30; i <= 90; i++) {
      const d = new Date(baseNow);
      d.setDate(baseNow.getDate() + i);
      windowDates.push(d);
    }

    if (eventsData) {
      const built: CalEvent[] = [];
      for (const e of eventsData as any[]) {
        const startMinutes = e.start_minutes ?? 9 * 60;
        const endMinutes = e.end_minutes ?? (startMinutes + 60);
        const cat = DB_TO_CAT[e.category?.toLowerCase()] || "pro";
        const recurDays: string[] = Array.isArray(e.recurrence_days) ? e.recurrence_days : [];
        const startDate = e.start_date ? e.start_date.split("T")[0] : fmtDate(new Date());
        const endDate = e.end_date ? e.end_date.split("T")[0] : startDate;
        const reminderMinutes = e.reminder_minutes_before?.[0] ?? 0;

        if (recurDays.length > 0) {
          for (const d of windowDates) {
            if (!recurDays.includes(DAY_KEYS[d.getDay()])) continue;
            built.push({
              id: `recur::${e.id}::${fmtDate(d)}`,
              title: e.title, startDate: fmtDate(d), endDate: fmtDate(d),
              date: fmtDate(d), startMinutes, endMinutes, cat,
              done: false, fromTodo: false, replanNeeded: false,
              recurring: true, recurrenceDays: recurDays,
              reminderMinutes, isMultiDay: false,
            });
          }
        } else if (startDate !== endDate) {
          // Multi-jours : apparaît sur chaque jour entre startDate et endDate
          const start = new Date(startDate);
          const end = new Date(endDate);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayStr = fmtDate(new Date(d));
            built.push({
              id: d.toDateString() === start.toDateString() ? e.id : `multiday::${e.id}::${dayStr}`,
              title: e.title, startDate, endDate,
              date: dayStr, startMinutes, endMinutes, cat,
              done: false, fromTodo: false, replanNeeded: false,
              recurring: false, recurrenceDays: [],
              reminderMinutes, isMultiDay: true,
            });
          }
        } else {
          built.push({
            id: e.id, title: e.title,
            startDate, endDate, date: startDate,
            startMinutes, endMinutes, cat,
            done: false, fromTodo: false, replanNeeded: false,
            recurring: false, recurrenceDays: [],
            reminderMinutes, isMultiDay: false,
          });
        }
      }
      setEvents(built);
    }

    // Routines
    const { data: routinesData } = await supabase
      .from('routines')
      .select('id, title, description, preferred_time, duration_minutes, frequency, custom_days, category')
      .eq('user_id', user.id)
      .not('preferred_time', 'is', null);

    if (routinesData) {
      const todayStr = fmtDate(new Date());
      const rEvents: CalEvent[] = [];
      for (const r of routinesData as any[]) {
        if (!r.preferred_time) continue;
        const parts = r.preferred_time.split(':');
        const startMin = parseInt(parts[0]) * 60 + (parseInt(parts[1]) || 0);
        const durMin = r.duration_minutes || 60;
        const days = r.custom_days
          ? (Array.isArray(r.custom_days) ? r.custom_days : r.custom_days.replace(/[{}]/g, '').split(',').map((d: string) => d.trim()))
          : [];
        for (const d of windowDates) {
          const key = DAY_KEYS[d.getDay()];
          const applies = r.frequency === 'daily' || days.length === 0 || days.length === 7 || days.includes(key);
          if (!applies) continue;
          rEvents.push({
            id: `routine-${r.id}-${fmtDate(d)}`,
            title: `${r.description || '✨'} ${r.title}`,
            startDate: fmtDate(d), endDate: fmtDate(d), date: fmtDate(d),
            startMinutes: startMin, endMinutes: startMin + durMin,
            cat: 'moi' as CategoryKey,
            done: false, fromTodo: false, replanNeeded: false,
            recurring: true, recurrenceDays: [],
            reminderMinutes: 0, isMultiDay: false,
          });
        }
      }
      setRoutineEvents(rEvents);

      // Détection conflits
      if (eventsData && rEvents.length > 0) {
        const newConflicts: { routine: string; event: string; hour: number }[] = [];
        rEvents.filter(re => re.date === todayStr).forEach(re => {
          (eventsData as any[]).forEach((ev: any) => {
const evStart = ev.start_minutes ?? (ev.start_hour != null ? ev.start_hour * 60 : 9 * 60);            const evEnd = evStart + ((ev.end_minutes ?? (evStart + 60)) - evStart);
            const evDate = ev.start_date ? ev.start_date.split("T")[0] : '';
            if (evDate === todayStr && re.startMinutes < evEnd && re.endMinutes > evStart) {
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

    if (!silent) setLoading(false);
  }

  // ─── TODO ACTIONS ─────────────────────────────────────────
  async function addTodo() {
    if (!newTask.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("todo_list").insert({
      user_id: user.id, title: newTask.trim(), priority: newPriority, status: "pending",
    }).select().single();
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

  // ─── EVENT ACTIONS ────────────────────────────────────────
  const toggleEvent = useCallback(async (id: string) => {
    const ev = events.find(e => e.id === id);
    if (!ev || ev.recurring || ev.isMultiDay) return;
    const newDone = !ev.done;
    setEvents(p => p.map(e => e.id === id ? { ...e, done: newDone, replanNeeded: false } : e));
    await supabase.from("planner_events").update({ status: newDone ? "completed" : "pending", updated_at: new Date().toISOString() }).eq("id", id);
  }, [events]);

  const deleteEvent = useCallback(async (id: string) => {
    await supabase.from("planner_events").delete().eq("id", masterId(id));
    setEditModal(null);
    await loadData(true);
  }, []);

  const openReplan = useCallback((ev: CalEvent) => {
    setForm({
      title: ev.title, startDate: fmtDate(new Date()), endDate: fmtDate(new Date()),
      startMinutes: ev.startMinutes, endMinutes: ev.endMinutes,
      cat: ev.cat, recurrenceDays: ev.recurrenceDays || [],
      reminderMinutes: ev.reminderMinutes ?? 15,
    });
    setReplanModal(ev);
  }, []);

  function openPlanTodo(todo: Todo) {
    setForm({
      title: todo.text, startDate: fmtDate(new Date()), endDate: fmtDate(new Date()),
      startMinutes: 9 * 60, endMinutes: 10 * 60, cat: "pro",
      recurrenceDays: [], reminderMinutes: 15,
    });
    setPlanModal(todo);
  }

  async function confirmPlanTodo() {
    if (!planModal) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const recurring = form.recurrenceDays.length > 0;
    const startDt = `${form.startDate}T${minutesToLabel(form.startMinutes)}:00`;
    const endDt = `${form.endDate}T${minutesToLabel(form.endMinutes)}:00`;
    await supabase.from("planner_events").insert({
      user_id: user.id, source_todo_id: planModal.id, title: form.title,
      start_date: startDt, end_date: endDt,
      start_minutes: form.startMinutes, end_minutes: form.endMinutes,
      category: CAT_TO_DB[form.cat],
      recurrence_days: recurring ? form.recurrenceDays : [],
      reminder_minutes_before: form.reminderMinutes > 0 ? [form.reminderMinutes] : [],
      reminder_sent: false,
    });
    await supabase.from("todo_list").update({ status: "in_progress", due_date: form.startDate, due_time: minutesToLabel(form.startMinutes), estimated_duration_minutes: Math.max(5, form.endMinutes - form.startMinutes), updated_at: new Date().toISOString() }).eq("id", planModal.id);
    setPlanModal(null);
    await loadData(true);
  }

  function openNewEvent(date?: string, startMinutes?: number) {
    const d = date || fmtDate(currentDate);
    setForm({
      title: "", startDate: d, endDate: d,
      startMinutes: startMinutes ?? 9 * 60,
      endMinutes: (startMinutes ?? 9 * 60) + 60,
      cat: "pro", recurrenceDays: [], reminderMinutes: 15,
    });
    setEventModal(true);
  }

  async function confirmNewEvent() {
    if (!form.title.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const recurring = form.recurrenceDays.length > 0;
    const startDt = `${form.startDate}T${minutesToLabel(form.startMinutes)}:00`;
    const endDt = `${form.endDate}T${minutesToLabel(form.endMinutes)}:00`;
    await supabase.from("planner_events").insert({
      user_id: user.id, title: form.title,
      start_date: startDt, end_date: endDt,
      start_minutes: form.startMinutes, end_minutes: form.endMinutes,
      category: CAT_TO_DB[form.cat],
      recurrence_days: recurring ? form.recurrenceDays : [],
      reminder_minutes_before: form.reminderMinutes > 0 ? [form.reminderMinutes] : [],
      reminder_sent: false,
    });
    setEventModal(false);
    await loadData(true);
  }

  function openEdit(ev: CalEvent) {
    setForm({
      title: ev.title,
      startDate: ev.startDate, endDate: ev.endDate,
      startMinutes: ev.startMinutes, endMinutes: ev.endMinutes,
      cat: ev.cat, recurrenceDays: ev.recurrenceDays || [],
      reminderMinutes: ev.reminderMinutes ?? 15,
    });
    setEditModal(ev);
  }

  async function confirmEdit() {
    if (!editModal) return;
    const startDt = `${form.startDate}T${minutesToLabel(form.startMinutes)}:00`;
    const endDt = `${form.endDate}T${minutesToLabel(form.endMinutes)}:00`;
    await supabase.from("planner_events").update({
      title: form.title,
      start_date: startDt, end_date: endDt,
      start_minutes: form.startMinutes, end_minutes: form.endMinutes,
      category: CAT_TO_DB[form.cat],
      recurrence_days: form.recurrenceDays.length > 0 ? form.recurrenceDays : [],
      reminder_minutes_before: form.reminderMinutes > 0 ? [form.reminderMinutes] : [],
      updated_at: new Date().toISOString(),
    }).eq("id", masterId(editModal.id));
    setEditModal(null);
    await loadData(true);
  }

  async function confirmReplan() {
    if (!replanModal) return;
    const startDt = `${form.startDate}T${minutesToLabel(form.startMinutes)}:00`;
    const endDt = `${form.endDate}T${minutesToLabel(form.endMinutes)}:00`;
    await supabase.from("planner_events").update({
      start_date: startDt, end_date: endDt,
      start_minutes: form.startMinutes, end_minutes: form.endMinutes,
      reminder_sent: false, updated_at: new Date().toISOString(),
    }).eq("id", masterId(replanModal.id));
    setReplanModal(null);
    await loadData(true);
  }

  function navigate(dir: number) {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    if (view === "week") d.setDate(d.getDate() + dir * 7);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    if (view === "year") d.setFullYear(d.getFullYear() + dir);
    setCurrentDate(d);
  }

  // ─── RENDER ───────────────────────────────────────────────
  const selectedCustody = custodyStatusForDate(currentDate, custodyConfig, custodyExceptions);
  const selectedVisual = custodyVisual(selectedCustody);
  const weekCustodyDays = weekDates
    .map((date, index) => ({ date, index, status: custodyStatusForDate(date, custodyConfig, custodyExceptions) }))
    .filter(item => item.status.withChildren === true);

  const dayCustodySummary = selectedCustody.transition
    || (selectedCustody.withChildren === true
      ? "Les filles sont avec toi aujourd’hui"
      : selectedCustody.withChildren === false
        ? "Les filles ne sont pas avec toi aujourd’hui"
        : "Organisation de garde non renseignée");

  const custodySummary = view === "day"
    ? dayCustodySummary
    : view === "week"
      ? weekCustodyDays.length === 7
        ? "Les filles sont avec toi toute la semaine"
        : weekCustodyDays.length > 0
          ? `Avec les filles : ${weekCustodyDays.map(item => DAYS_SHORT[item.index].toLowerCase()).join(", ")}`
          : custodyConfig
            ? "Semaine sans les filles"
            : "Organisation de garde non renseignée"
      : view === "month"
        ? "Repères de garde visibles sur chaque journée du mois"
        : view === "year"
          ? "Vue annuelle de la garde : vert avec les filles, beige sans les filles"
          : dayCustodySummary;

  const plannerHeader = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${C.grisClair}`, background: C.blanc, flexWrap: "wrap" }}>
      <button onClick={() => navigate(-1)} style={navBtn()}>‹</button>
      <button onClick={() => navigate(1)} style={navBtn()}>›</button>
      <button onClick={() => setCurrentDate(new Date())} style={{ ...navBtn(), fontSize: 10, padding: "5px 10px", width: "auto", borderRadius: 12 }}>Auj.</button>
      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, color: C.noir, flex: 1, minWidth: 80 }}>
        {view === "day" && `${DAYS_FULL[(currentDate.getDay() + 6) % 7]} ${currentDate.getDate()} ${MONTHS[currentDate.getMonth()]}`}
        {view === "week" && `Sem. du ${weekDates[0].getDate()} ${MONTHS[weekDates[0].getMonth()]}`}
        {view === "month" && `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
        {view === "year" && `${currentDate.getFullYear()}`}
      </span>
      {[["day", "Jour"], ["week", "Sem."], ["month", "Mois"], ["year", "Année"]].map(([v, l]) => (
        <button key={v} onClick={() => setView(v)} style={{ padding: "5px 10px", borderRadius: 16, border: "none", background: view === v ? C.roseDark : C.grisClair, color: view === v ? C.blanc : C.gris, cursor: "pointer", fontSize: 11, fontWeight: view === v ? 600 : 400 }}>{l}</button>
      ))}
      {!isMobile && <button onClick={() => openNewEvent()} style={btnStyle(C.roseDark)}>+ Évén.</button>}
    </div>
  );

  const plannerContent = (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {view === "day" && <DayView currentDate={currentDate} events={[...events, ...routineEvents]} onNewEvent={openNewEvent} onToggle={toggleEvent} onReplan={openReplan} onEdit={openEdit} />}
      {view === "week" && <WeekView weekDates={weekDates} events={[...events, ...routineEvents]} custodyConfig={custodyConfig} custodyExceptions={custodyExceptions} onDayClick={d => { setCurrentDate(d); setView("day"); }} />}
      {view === "month" && <MonthView currentDate={currentDate} events={[...events, ...routineEvents]} custodyConfig={custodyConfig} custodyExceptions={custodyExceptions} onDayClick={d => { setCurrentDate(d); setView("day"); }} />}
      {view === "year" && <YearView currentDate={currentDate} custodyConfig={custodyConfig} custodyExceptions={custodyExceptions} onMonthClick={month => { const next = new Date(currentDate); next.setMonth(month); setCurrentDate(next); setView("month"); }} />}
    </div>
  );

  return (
    <>
      <DemoBanner />
      <Navigation />
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 120px)", background: C.cream, fontFamily: "'DM Sans',sans-serif", overflow: "hidden" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: `1px solid ${C.grisClair}`, background: C.blanc, flexShrink: 0 }}>
          <Link href="/" style={{ fontSize: 12, color: C.gris, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, border: `1px solid ${C.grisClair}`, background: C.cream }}>← Accueil</Link>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, color: C.noir, marginLeft: 4 }}>Planner</span>
          {isMobile && (
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
                  Routine <strong>{c.routine}</strong> à {String(c.hour).padStart(2, '0')}h chevauche <strong>{c.event}</strong>
                </p>
              ))}
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#aaa" }}>Pense à reporter ou annuler l'un des deux.</p>
            </div>
            <button onClick={() => setShowConflictBanner(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 18, flexShrink: 0, lineHeight: 1 }}>×</button>
          </div>
        )}

        <div style={{ padding: "8px 16px", background: view === "day" ? selectedVisual.bg : "rgba(185,215,203,0.16)", borderBottom: `1px solid ${view === "day" ? selectedVisual.border : C.grisClair}`, display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>{view === "day" && selectedCustody.phase === "end" ? "🕖" : view === "day" && selectedCustody.phase === "start" ? "👧" : selectedCustody.withChildren === false && view === "day" ? "🌿" : custodyConfig ? "👧" : "ℹ️"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.noir }}>{custodySummary}</p>
            <p style={{ margin: "1px 0 0", fontSize: 10, color: C.gris }}>
              {view === "day" && selectedCustody.source === "exception"
                ? `Exception ponctuelle${selectedCustody.note ? ` · ${selectedCustody.note}` : ""}`
                : custodyConfig
                  ? view === "day"
                    ? "Contexte familial non bloquant pour ton planning"
                    : "Les couleurs permettent de comprendre la garde d’un coup d’œil"
                  : "À configurer dans Entourage"}
            </p>
          </div>
          <Link href="/family" style={{ fontSize: 10, fontWeight: 700, color: C.roseDark, textDecoration: "none", whiteSpace: "nowrap" }}>Gérer</Link>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {plannerHeader}
          {plannerContent}
        </div>

        {planModal   && <Modal title="📅 Planifier la tâche"   form={form} setForm={setForm} onConfirm={confirmPlanTodo} onCancel={() => setPlanModal(null)}   confirmLabel="Planifier" />}
        {eventModal  && <Modal title="+ Nouvel événement"       form={form} setForm={setForm} onConfirm={confirmNewEvent} onCancel={() => setEventModal(false)} confirmLabel="Ajouter" />}
        {editModal   && <Modal title="✏️ Modifier l'événement" form={form} setForm={setForm} onConfirm={confirmEdit}      onCancel={() => setEditModal(null)}   confirmLabel="Modifier" onDelete={() => deleteEvent(editModal.id)} />}
        {replanModal && <Modal title="↻ Replanifier"            form={form} setForm={setForm} onConfirm={confirmReplan}   onCancel={() => setReplanModal(null)} confirmLabel="Replanifier" />}
      </div>
    </>
  );
}