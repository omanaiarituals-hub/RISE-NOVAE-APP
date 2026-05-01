"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { DemoBanner } from '@/components/DemoBanner';

type DefiCategory = "personnel" | "programme" | "communaute" | "confort";
type DefiStatus = "disponible" | "en_cours" | "termine" | "abandonne";

interface DayCheck {
  day: number;
  done: boolean;
}

interface Defi {
  id: string;
  title: string;
  description: string;
  category: DefiCategory;
  duration: number;
  status: DefiStatus;
  startDate?: string;
  badge?: string;
  points: number;
  predefined: boolean;
  days: DayCheck[];
}

const C = {
  cream: "#FAF7F2",
  roseLight: "#F2E0D8",
  rose: "#E8C4B8",
  roseDark: "#D4A090",
  noir: "#1A1A1A",
  gris: "#6B6B6B",
  grisClair: "#E8E4DF",
  blanc: "#FFFFFF",
};

const CATEGORIES: Record<DefiCategory, { label: string; emoji: string; bg: string; border: string; text: string; description: string }> = {
  personnel:  { label: "Personnel",       emoji: "🎯", bg: "#C8D8E8", border: "#A0BEDC", text: "#2C5F8A", description: "Tes objectifs personnels" },
  programme:  { label: "Programme 90j",   emoji: "🔥", bg: "#F2E0D8", border: "#D4A090", text: "#8A4A3A", description: "Liés à ta transformation" },
  communaute: { label: "Communauté",      emoji: "👥", bg: "#FBF0CC", border: "#E8D080", text: "#7A6010", description: "Défis partagés ensemble" },
  confort:    { label: "Zone de confort", emoji: "💫", bg: "#F0D8F0", border: "#C8A0C8", text: "#6A2A6A", description: "Ose, révèle-toi, grandis" },
};

const PREDEFINED: Omit<Defi, "id" | "status" | "days" | "startDate">[] = [
  { title: "7 jours sans réseaux sociaux",        description: "Déconnecte-toi des réseaux sociaux pendant 7 jours. Observe comment ton énergie change.",        category: "personnel",  duration: 7,  badge: "🧘", points: 150, predefined: true },
  { title: "Lever 30 min plus tôt",               description: "Commence chaque journée 30 minutes plus tôt pendant 14 jours pour créer un rituel matinal.",      category: "personnel",  duration: 14, badge: "🌅", points: 200, predefined: true },
  { title: "Zéro achat impulsif",                 description: "30 jours sans achats non planifiés. Avant chaque achat, attends 48h.",                            category: "personnel",  duration: 30, badge: "💎", points: 300, predefined: true },
  { title: "7 jours de réflexion quotidienne",    description: "Remplis ta zone de réflexion chaque jour sans exception pendant 7 jours.",                        category: "programme",  duration: 7,  badge: "✍️", points: 175, predefined: true },
  { title: "Compléter la Phase 1",                description: "Termine les 30 premières missions de reprogrammation mentale.",                                    category: "programme",  duration: 30, badge: "🌱", points: 500, predefined: true },
  { title: "Streak 21 jours",                     description: "Ne rate aucune mission pendant 21 jours consécutifs.",                                             category: "programme",  duration: 21, badge: "⚡", points: 400, predefined: true },
  { title: "Partage une victoire",                description: "Publie une victoire dans la communauté, même petite. Inspire les autres.",                         category: "communaute", duration: 7,  badge: "🌟", points: 100, predefined: true },
  { title: "Soutiens 5 membres",                  description: "Encourage et réponds à 5 membres différents de la communauté cette semaine.",                      category: "communaute", duration: 7,  badge: "🤝", points: 125, predefined: true },
  { title: "Challenge collectif 30j",             description: "Rejoins le défi collectif du mois avec la communauté entière.",                                   category: "communaute", duration: 30, badge: "🏆", points: 350, predefined: true },
  { title: "Parler à un inconnu",                 description: "Engage une vraie conversation avec une personne que tu ne connais pas. Juste une.",                category: "confort",    duration: 7,  badge: "🦋", points: 200, predefined: true },
  { title: "Dire non sans culpabilité",           description: "Refuse 3 demandes qui ne te correspondent pas cette semaine. Sans t'excuser.",                     category: "confort",    duration: 7,  badge: "💪", points: 225, predefined: true },
  { title: "Apprendre quelque chose de nouveau",  description: "Commence une compétence totalement nouvelle — danse, instrument, langue, code.",                   category: "confort",    duration: 30, badge: "🎨", points: 300, predefined: true },
  { title: "Poser ta candidature",                description: "Postule à quelque chose qui te fait peur : job, formation, opportunité. Fais-le.",                 category: "confort",    duration: 14, badge: "🚀", points: 350, predefined: true },
  { title: "Exprimer tes émotions",               description: "Dis à quelqu'un d'important ce que tu ressens vraiment. Sois authentique.",                       category: "confort",    duration: 7,  badge: "❤️", points: 250, predefined: true },
];

let _id = 1;
const uid = () => `d${_id++}`;

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function daysLeft(startDate: string, duration: number): number {
  const end = new Date(startDate); end.setDate(end.getDate() + duration);
  const diff = Math.ceil((end.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}
function makeDays(duration: number): DayCheck[] {
  return Array.from({ length: duration }, (_, i) => ({ day: i + 1, done: false }));
}
function inputStyle(): React.CSSProperties {
  return { width: "100%", border: "1px solid #E8E4DF", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "'DM Sans',sans-serif", background: "#FAF7F2", outline: "none", boxSizing: "border-box", color: "#1A1A1A" };
}
function labelStyle(): React.CSSProperties {
  return { display: "block", fontSize: 11, color: "#6B6B6B", letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" };
}

// ─── DAY CHECKS ────────────────────────────────────────────
function DayChecks({ defi, onToggleDay }: { defi: Defi; onToggleDay: (id: string, day: number) => void }) {
  const cat = CATEGORIES[defi.category];
  const doneDays = defi.days.filter(d => d.done).length;
  const pct = Math.round((doneDays / defi.duration) * 100);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: C.gris }}>{doneDays}/{defi.duration} jours complétés</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: cat.text }}>{pct}%</span>
      </div>
      <div style={{ height: 5, background: C.grisClair, borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: cat.border, borderRadius: 10, transition: "width 0.3s" }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {defi.days.map(d => (
          <button key={d.day} onClick={() => onToggleDay(defi.id, d.day)} title={`Jour ${d.day}`}
            style={{ width: 32, height: 32, borderRadius: 8, background: d.done ? cat.border : C.grisClair, border: `1.5px solid ${d.done ? cat.border : C.grisClair}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: d.done ? C.blanc : C.gris, fontFamily: "'DM Sans',sans-serif", fontWeight: 700, transition: "all 0.15s" }}>
            {d.done ? "✓" : d.day}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── DEFI CARD ─────────────────────────────────────────────
interface DefiCardProps {
  defi: Defi;
  onStart: (id: string) => void;
  onToggleDay: (id: string, day: number) => void;
  onComplete: (id: string) => void;
  onAbandon: (id: string) => void;
  onShare: (defi: Defi) => void;
}
function DefiCard({ defi, onStart, onToggleDay, onComplete, onAbandon, onShare }: DefiCardProps) {
  const cat = CATEGORIES[defi.category];
  const isEnCours    = defi.status === "en_cours";
  const isTermine    = defi.status === "termine";
  const isAbandonne  = defi.status === "abandonne";
  const isDisponible = defi.status === "disponible";
  const doneDays     = defi.days.filter(d => d.done).length;
  const allDone      = doneDays === defi.duration;
  const remaining    = defi.startDate ? daysLeft(defi.startDate, defi.duration) : defi.duration;

  return (
    <div style={{ background: isTermine ? "#F5FBF5" : (isAbandonne ? "#F8F8F8" : C.blanc), border: `1.5px solid ${isTermine ? "#90C8A8" : (isEnCours ? cat.border : C.grisClair)}`, borderRadius: 14, padding: "16px 18px", marginBottom: 12, opacity: isAbandonne ? 0.6 : 1, boxShadow: isEnCours ? `0 2px 12px ${cat.border}44` : "none" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: cat.bg, border: `1px solid ${cat.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          {isTermine ? defi.badge || "🏆" : cat.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", color: C.noir }}>{defi.title}</span>
            {isTermine && <span style={{ fontSize: 16 }}>{defi.badge}</span>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, background: cat.bg, border: `1px solid ${cat.border}`, borderRadius: 10, padding: "1px 8px", color: cat.text }}>{cat.emoji} {cat.label}</span>
            <span style={{ fontSize: 10, color: C.gris }}>{defi.duration}j · {defi.points} pts</span>
            {isEnCours && <span style={{ fontSize: 10, color: remaining <= 3 ? "#D4956A" : C.gris, fontWeight: remaining <= 3 ? 700 : 400 }}>⏱ {remaining}j restants</span>}
          </div>
        </div>
        {isTermine && <div style={{ background: "#CCE8D8", border: "1px solid #90C8A8", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#2A6A48", fontWeight: 600, whiteSpace: "nowrap" }}>✓ Accompli</div>}
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: C.gris, lineHeight: 1.5 }}>{defi.description}</p>
      {(isEnCours || isTermine) && <DayChecks defi={defi} onToggleDay={onToggleDay} />}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {isDisponible && <button onClick={() => onStart(defi.id)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: cat.border, color: C.blanc, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600 }}>▶ Commencer</button>}
        {isEnCours && allDone && <button onClick={() => onComplete(defi.id)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#7BAF8E", color: C.blanc, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600 }}>🏆 Valider le défi</button>}
        {isEnCours && <button onClick={() => onAbandon(defi.id)} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.grisClair}`, background: C.blanc, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.gris }}>Abandonner</button>}
        {isTermine && <button onClick={() => onShare(defi)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#E8D080", color: "#7A6010", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600 }}>📢 Partager</button>}
      </div>
    </div>
  );
}

// ─── CREATE MODAL ──────────────────────────────────────────
function CreateModal({ onConfirm, onCancel }: { onConfirm: (data: { title: string; description: string; category: DefiCategory; duration: number }) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DefiCategory>("personnel");
  const [duration, setDuration] = useState(7);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.blanc, borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 18px", fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: C.noir }}>Créer un défi</h3>
        <label style={labelStyle()}>Titre</label>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Méditer chaque matin…" style={{ ...inputStyle(), marginBottom: 12 }} />
        <label style={labelStyle()}>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Décris ton défi…" style={{ ...inputStyle(), minHeight: 80, resize: "vertical", marginBottom: 12 } as React.CSSProperties} />
        <label style={labelStyle()}>Catégorie</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {(Object.keys(CATEGORIES) as DefiCategory[]).map(key => {
            const cat = CATEGORIES[key]; const sel = category === key;
            return <button key={key} onClick={() => setCategory(key)} style={{ padding: "8px 6px", borderRadius: 8, border: `2px solid ${sel ? cat.border : C.grisClair}`, background: sel ? cat.bg : C.blanc, cursor: "pointer", fontSize: 12, color: sel ? cat.text : C.gris, textAlign: "left" }}>{cat.emoji} {cat.label}</button>;
          })}
        </div>
        <label style={labelStyle()}>Durée</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {[7, 14, 21, 30, 60, 90].map(d => (
            <button key={d} onClick={() => setDuration(d)} style={{ padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${duration === d ? C.roseDark : C.grisClair}`, background: duration === d ? C.roseLight : C.blanc, fontSize: 12, color: duration === d ? C.roseDark : C.gris, cursor: "pointer", fontWeight: duration === d ? 700 : 400 }}>{d}j</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${C.grisClair}`, background: C.blanc, cursor: "pointer", color: C.gris }}>Annuler</button>
          <button onClick={() => { if (title.trim()) onConfirm({ title, description, category, duration }); }} style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: C.roseDark, color: C.blanc, cursor: "pointer", fontWeight: 600 }}>Créer le défi</button>
        </div>
      </div>
    </div>
  );
}

// ─── SHARE MODAL ───────────────────────────────────────────
function ShareModal({ defi, onClose }: { defi: Defi; onClose: () => void }) {
  const cat = CATEGORIES[defi.category];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.blanc, borderRadius: 16, padding: 28, width: "100%", maxWidth: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.15)", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{defi.badge || "🏆"}</div>
        <h3 style={{ margin: "0 0 6px", fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: C.noir }}>Défi accompli !</h3>
        <p style={{ fontSize: 14, color: C.gris, marginBottom: 16 }}>Tu viens de compléter <strong>{defi.title}</strong> et gagné <strong style={{ color: cat.text }}>+{defi.points} points</strong> !</p>
        <div style={{ background: cat.bg, border: `1px solid ${cat.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 18 }}>
          <p style={{ margin: 0, fontSize: 13, color: cat.text, fontStyle: "italic" }}>"{defi.description}"</p>
        </div>
        <p style={{ fontSize: 12, color: C.gris, marginBottom: 16 }}>Ton accomplissement sera partagé dans la Communauté ✨</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${C.grisClair}`, background: C.blanc, cursor: "pointer", color: C.gris }}>Fermer</button>
          <button onClick={onClose} style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: C.roseDark, color: C.blanc, cursor: "pointer", fontWeight: 600 }}>📢 Partager dans la Communauté</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ──────────────────────────────────────────────────
export default function DefisPage() {
  const [defis, setDefis] = useState<Defi[]>(
    PREDEFINED.map(d => ({ ...d, id: uid(), status: "disponible" as DefiStatus, days: makeDays(d.duration) }))
  );
  const [activeTab, setActiveTab] = useState<"tous" | "en_cours" | "termine" | DefiCategory>("tous");
  const [showCreate, setShowCreate] = useState(false);
  const [shareDefi, setShareDefi] = useState<Defi | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);

  const enCours  = defis.filter(d => d.status === "en_cours").length;
  const termines = defis.filter(d => d.status === "termine").length;
  const badges   = defis.filter(d => d.status === "termine" && d.badge).map(d => d.badge!);

  function startDefi(id: string) {
    setDefis(p => p.map(d => d.id === id ? { ...d, status: "en_cours" as DefiStatus, startDate: fmtDate(new Date()), days: makeDays(d.duration) } : d));
  }
  function toggleDay(id: string, day: number) {
    setDefis(p => p.map(d => d.id === id ? { ...d, days: d.days.map(dd => dd.day === day ? { ...dd, done: !dd.done } : dd) } : d));
  }
  function completeDefi(id: string) {
    setDefis(p => p.map(d => d.id === id ? { ...d, status: "termine" as DefiStatus } : d));
    const defi = defis.find(d => d.id === id);
    if (defi) { setTotalPoints(p => p + defi.points); setShareDefi({ ...defi, status: "termine" }); }
  }
  function abandonDefi(id: string) {
    setDefis(p => p.map(d => d.id === id ? { ...d, status: "abandonne" as DefiStatus } : d));
  }
  function createDefi(data: { title: string; description: string; category: DefiCategory; duration: number }) {
    const cat = CATEGORIES[data.category];
    setDefis(p => [{ id: uid(), ...data, status: "disponible" as DefiStatus, badge: cat.emoji, points: Math.round(data.duration * 8), predefined: false, days: makeDays(data.duration) }, ...p]);
    setShowCreate(false);
  }

  const filtered = defis.filter(d => {
    if (activeTab === "tous")     return d.status !== "abandonne";
    if (activeTab === "en_cours") return d.status === "en_cours";
    if (activeTab === "termine")  return d.status === "termine";
    return d.category === activeTab && d.status !== "abandonne";
  });

  const tabs = [
    { key: "tous",       label: "Tous",      count: defis.filter(d => d.status !== "abandonne").length },
    { key: "en_cours",   label: "En cours",  count: enCours },
    { key: "termine",    label: "Accomplis", count: termines },
    { key: "confort",    label: "💫 Zone confort" },
    { key: "communaute", label: "👥 Communauté" },
  ];

  return (
    <>
      <DemoBanner />
      <div style={{ minHeight: "100vh", background: C.cream, fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ background: C.blanc, borderBottom: `1px solid ${C.grisClair}`, padding: "0 24px" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0 10px" }}>
              <Link href="/" style={{ fontSize: 12, color: C.gris, textDecoration: "none", padding: "4px 10px", borderRadius: 20, border: `1px solid ${C.grisClair}`, background: C.cream }}>← Accueil</Link>
              <div style={{ flex: 1 }}>
                <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: C.noir }}>Mes Défis</h1>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: C.gris }}>Repousse tes limites, révèle qui tu es vraiment</p>
              </div>
              <button onClick={() => setShowCreate(true)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: C.roseDark, color: C.blanc, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Créer un défi</button>
            </div>
            <div style={{ display: "flex", gap: 20, padding: "10px 0 14px", flexWrap: "wrap" }}>
              {[{ icon: "⚡", val: enCours, label: "En cours", color: C.noir }, { icon: "🏆", val: termines, label: "Accomplis", color: C.noir }, { icon: "✨", val: totalPoints, label: "Points", color: C.roseDark }].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: s.color, fontFamily: "'Cormorant Garamond',serif" }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: C.gris, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
                  </div>
                </div>
              ))}
              {badges.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {badges.slice(0, 6).map((b, i) => <span key={i} style={{ fontSize: 20 }}>{b}</span>)}
                  {badges.length > 6 && <span style={{ fontSize: 12, color: C.gris }}>+{badges.length - 6}</span>}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  style={{ padding: "6px 14px", borderRadius: "8px 8px 0 0", border: `1px solid ${activeTab === tab.key ? C.grisClair : "transparent"}`, borderBottom: activeTab === tab.key ? `2px solid ${C.roseDark}` : "2px solid transparent", background: activeTab === tab.key ? C.blanc : "transparent", cursor: "pointer", fontSize: 12, color: activeTab === tab.key ? C.roseDark : C.gris, fontWeight: activeTab === tab.key ? 700 : 400, whiteSpace: "nowrap" }}>
                  {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ""}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 24px" }}>
          {(activeTab === "confort" || activeTab === "communaute" || activeTab === "personnel" || activeTab === "programme") && (
            <div style={{ background: CATEGORIES[activeTab as DefiCategory].bg, border: `1px solid ${CATEGORIES[activeTab as DefiCategory].border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>{CATEGORIES[activeTab as DefiCategory].emoji}</span>
              <div>
                <div style={{ fontWeight: 700, color: CATEGORIES[activeTab as DefiCategory].text, fontFamily: "'Cormorant Garamond',serif", fontSize: 16 }}>{CATEGORIES[activeTab as DefiCategory].label}</div>
                <div style={{ fontSize: 12, color: CATEGORIES[activeTab as DefiCategory].text, opacity: 0.8 }}>{CATEGORIES[activeTab as DefiCategory].description}</div>
              </div>
            </div>
          )}
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: C.gris }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🌟</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, marginBottom: 6 }}>Aucun défi ici</div>
              <div style={{ fontSize: 13 }}>Commence un défi ou crée le tien !</div>
            </div>
          ) : (
            filtered.map(defi => <DefiCard key={defi.id} defi={defi} onStart={startDefi} onToggleDay={toggleDay} onComplete={completeDefi} onAbandon={abandonDefi} onShare={setShareDefi} />)
          )}
        </div>

        {showCreate && <CreateModal onConfirm={createDefi} onCancel={() => setShowCreate(false)} />}
        {shareDefi  && <ShareModal defi={shareDefi} onClose={() => setShareDefi(null)} />}
      </div>
    </>
  );
}