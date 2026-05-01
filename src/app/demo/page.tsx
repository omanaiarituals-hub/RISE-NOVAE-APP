'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Images esthétiques par module ──────────────────────────────
const MODULE_IMAGES = {
  programme: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
  agent: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&q=80',
  routines: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&q=80',
  planner: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80',
  tracker: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80',
  recettes: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80',
  famille: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80',
  communaute: 'https://images.unsplash.com/photo-1512273222628-4daea6e55abb?w=600&q=80',
}

// ── Slides du guide ────────────────────────────────────────────
const GUIDE_SLIDES = [
  {
    id: 'welcome',
    tag: 'Bienvenue',
    title: 'NOVAÉ, c\'est une app\nqui change tout.',
    subtitle: 'Une seule app au lieu de cinq.',
    desc: 'NOVAÉ connecte ton programme 90 jours, ton agent IA, tes routines, ton planner, tes repas et ta famille. Tu te concentres sur toi — elle gère le reste.',
    image: MODULE_IMAGES.programme,
    highlights: [
      { icon: '🎯', text: '10 modules connectés entre eux' },
      { icon: '🤖', text: 'Un agent IA qui connaît ta vie' },
      { icon: '✦', text: '90 jours pour te transformer' },
    ],
    color: '#C4956A',
  },
  {
    id: 'programme',
    tag: 'Module 1',
    title: 'Programme 90 Jours',
    subtitle: '3 phases. Une transformation.',
    desc: 'Chaque jour, une mission guidée personnalisée selon ton profil psychologique. Phase 1 : Reprogrammation. Phase 2 : Action & Discipline. Phase 3 : Expansion.',
    image: MODULE_IMAGES.programme,
    highlights: [
      { icon: '📸', text: 'Image unique et paysage pour chaque jour' },
      { icon: '✍️', text: 'Réflexion guidée avec question personnalisée' },
      { icon: '🔒', text: 'Jours débloqués progressivement' },
    ],
    color: '#C4956A',
    demo: {
      type: 'programme',
      day: 1,
      title: 'Le Scanner 360°',
      description: 'Avant de transformer ton futur, regarde ton présent avec une honnêteté radicale. Note chaque pilier de ta vie de 1 à 10.',
      question: 'En regardant ces notes, quelle sphère réclame ton attention immédiate ?',
      tasks: ['Santé & Énergie', 'Équilibre Mental', 'Relations & Amour', 'Carrière & Projets', 'Finances'],
    },
  },
  {
    id: 'agent',
    tag: 'Module 2',
    title: 'Agent IA NOVAÉ',
    subtitle: 'Ton coach qui voit tout.',
    desc: 'L\'agent NOVAÉ lit tes données en temps réel — tâches, routines, repas, famille — et agit directement pour toi. Ce n\'est pas un chatbot. C\'est un vrai assistant qui connaît ta vie.',
    image: MODULE_IMAGES.agent,
    highlights: [
      { icon: '⚡', text: 'Détecte les conflits de planning automatiquement' },
      { icon: '⚠️', text: 'Alerte allergie croisée avec tes recettes' },
      { icon: '📊', text: 'Bilan complet chaque dimanche' },
    ],
    color: '#7B6FA0',
    demo: {
      type: 'chat',
      messages: [
        { role: 'user', text: 'Y a-t-il des conflits dans mon planning cette semaine ?' },
        { role: 'ai', text: '⚡ J\'ai détecté 2 conflits :\n\n• Mardi 14h : ta routine yoga chevauche une réunion planifiée\n• Jeudi : quinoa dans le Buddha Bowl — Shana est allergique\n\nVeux-tu que je réorganise ?' },
        { role: 'user', text: 'Oui, réorganise le planning !' },
        { role: 'ai', text: '✅ Fait ! J\'ai déplacé ta routine yoga à 7h le mardi, et remplacé le quinoa par du boulgour. Ta semaine est maintenant sans conflit. 🎯' },
      ],
    },
  },
  {
    id: 'routines',
    tag: 'Module 3',
    title: 'Routines',
    subtitle: 'Ta révolution silencieuse.',
    desc: 'Crée tes routines matin et soir. Coche chaque habitude au quotidien. L\'agent IA suit ta progression et te félicite. Le suivi hebdomadaire te montre ton évolution.',
    image: MODULE_IMAGES.routines,
    highlights: [
      { icon: '☀️', text: 'Routine matin personnalisée' },
      { icon: '🌙', text: 'Routine soir pour décompresser' },
      { icon: '📈', text: 'Stats hebdomadaires automatiques' },
    ],
    color: '#C4956A',
    demo: {
      type: 'routines',
      items: [
        { emoji: '💧', label: 'Boire un grand verre d\'eau', done: true },
        { emoji: '🧘', label: '10 min de méditation', done: true },
        { emoji: '📖', label: '15 min de lecture', done: false },
        { emoji: '✍️', label: 'Écrire 3 gratitudes', done: false },
        { emoji: '🚶', label: '20 min de marche', done: false },
      ],
    },
  },
  {
    id: 'planner',
    tag: 'Module 4',
    title: 'Planner & To-do',
    subtitle: 'Reprends le contrôle de ton temps.',
    desc: 'Planifie ta journée par créneaux de 15 minutes. Crée tes tâches prioritaires. L\'agent détecte automatiquement les conflits avec tes routines et tes repas.',
    image: MODULE_IMAGES.planner,
    highlights: [
      { icon: '📅', text: 'Créneaux de 15 min ultra précis' },
      { icon: '🔴', text: 'Tâches prioritaires identifiées' },
      { icon: '⚡', text: 'Conflits détectés en temps réel' },
    ],
    color: '#4A90D9',
  },
  {
    id: 'tracker',
    tag: 'Module 5',
    title: 'Tracker',
    subtitle: 'Ce que tu mesures, tu le changes.',
    desc: 'Suis tes habitudes au quotidien. Graphiques de progression. Score de cohérence hebdomadaire. Streaks et badges pour te motiver.',
    image: MODULE_IMAGES.tracker,
    highlights: [
      { icon: '📊', text: 'Graphiques de progression clairs' },
      { icon: '🔥', text: 'Streaks pour maintenir l\'élan' },
      { icon: '🏅', text: 'Badges débloqués automatiquement' },
    ],
    color: '#E8A87C',
  },
  {
    id: 'recettes',
    tag: 'Module 6',
    title: 'Recettes & Courses',
    subtitle: 'Manger mieux sans y penser.',
    desc: 'Planning de repas en glisser-déposer. Liste de courses générée automatiquement. Batch cooking suggéré intelligemment. 10 recettes pré-chargées pour démarrer.',
    image: MODULE_IMAGES.recettes,
    highlights: [
      { icon: '🍳', text: 'Planning repas de la semaine en 2 min' },
      { icon: '🛒', text: 'Liste de courses générée en 1 clic' },
      { icon: '⚠️', text: 'Allergies croisées automatiquement' },
    ],
    color: '#7CB87A',
  },
  {
    id: 'famille',
    tag: 'Module 7',
    title: 'Famille & Proches',
    subtitle: 'Ne plus jamais oublier ce qui compte.',
    desc: 'Stocke les informations importantes de tes proches. Allergies, anniversaires, préférences. L\'agent croise ces données avec tes recettes et te prévient 7 jours avant chaque anniversaire.',
    image: MODULE_IMAGES.famille,
    highlights: [
      { icon: '💛', text: 'Anniversaires anticipés J-7' },
      { icon: '⚠️', text: 'Alertes allergie proactives' },
      { icon: '🎁', text: 'Idées cadeaux personnalisées' },
    ],
    color: '#E8A87C',
  },
  {
    id: 'communaute',
    tag: 'Module 8',
    title: 'Communauté',
    subtitle: 'Tu n\'es pas seule dans cette transformation.',
    desc: 'Rejoins des femmes qui vivent la même transformation. Partage tes victoires, tes réflexions. Participe aux défis hebdomadaires lancés par NOVAÉ. Gagne des badges.',
    image: MODULE_IMAGES.communaute,
    highlights: [
      { icon: '👭', text: 'Communauté bienveillante de femmes' },
      { icon: '🎯', text: 'Défis hebdomadaires lancés par NOVAÉ' },
      { icon: '🏆', text: 'Classement mensuel & badges' },
    ],
    color: '#9B8EC4',
  },
  {
    id: 'cta',
    tag: 'Tu es convaincue ?',
    title: 'Rejoins NOVAÉ\navant tout le monde.',
    subtitle: '7,99€/mois · Lancement dans 1-2 mois',
    desc: 'Les premières inscrites bénéficieront d\'un accès gratuit pendant toute la bêta, d\'un tarif préférentiel au lancement, et du badge "Fondatrice" dans l\'app.',
    image: MODULE_IMAGES.programme,
    highlights: [
      { icon: '✦', text: 'Accès gratuit pendant la bêta' },
      { icon: '🎖️', text: 'Badge Fondatrice dans l\'app' },
      { icon: '💰', text: 'Tarif préférentiel au lancement' },
    ],
    color: '#C4956A',
    isCTA: true,
  },
]

// ── Composant Demo Routines ────────────────────────────────────
function DemoRoutines({ items }: { items: { emoji: string; label: string; done: boolean }[] }) {
  const [checked, setChecked] = useState(items.map(i => i.done))
  const count = checked.filter(Boolean).length

  return (
    <div style={{ background: '#FDFAF7', borderRadius: 16, padding: 16, border: '1px solid rgba(196,149,106,0.15)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: '#C4956A', textTransform: 'uppercase' }}>Routine Matin</span>
        <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.4)' }}>{count}/{items.length}</span>
      </div>
      <div style={{ height: 3, background: 'rgba(196,149,106,0.15)', borderRadius: 2, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ width: `${(count / items.length) * 100}%`, height: '100%', background: '#C4956A', borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          onClick={() => setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
            background: checked[i] ? 'rgba(196,149,106,0.08)' : 'white',
            border: `1px solid ${checked[i] ? 'rgba(196,149,106,0.2)' : 'rgba(26,26,26,0.06)'}`,
            marginBottom: 6, transition: 'all 0.2s',
          }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            border: `2px solid ${checked[i] ? '#C4956A' : 'rgba(26,26,26,0.2)'}`,
            background: checked[i] ? '#C4956A' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 0.2s',
          }}>
            {checked[i] && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span style={{ fontSize: 14 }}>{item.emoji}</span>
          <span style={{
            fontSize: 12,
            color: checked[i] ? 'rgba(26,26,26,0.35)' : '#1A1A1A',
            textDecoration: checked[i] ? 'line-through' : 'none',
            transition: 'all 0.2s',
          }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Composant Demo Chat ────────────────────────────────────────
function DemoChat({ messages }: { messages: { role: string; text: string }[] }) {
  const [visible, setVisible] = useState(1)

  useEffect(() => {
    if (visible < messages.length) {
      const t = setTimeout(() => setVisible(v => v + 1), 1200)
      return () => clearTimeout(t)
    }
  }, [visible, messages.length])

  return (
    <div style={{ background: '#1A1A1A', borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #C4956A, #D4856A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>N</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>Agent NOVAÉ</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>● Connecté</div>
        </div>
      </div>
      {messages.slice(0, visible).map((msg, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
          <div style={{
            maxWidth: '85%', padding: '9px 13px', borderRadius: 12,
            background: msg.role === 'user' ? '#C4956A' : 'rgba(255,255,255,0.08)',
            color: msg.role === 'user' ? 'white' : 'rgba(255,255,255,0.85)',
            fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap',
            borderBottomRightRadius: msg.role === 'user' ? 3 : 12,
            borderBottomLeftRadius: msg.role === 'ai' ? 3 : 12,
          }}>
            {msg.text}
          </div>
        </div>
      ))}
      {visible < messages.length && (
        <div style={{ display: 'flex', gap: 4, padding: '9px 13px', background: 'rgba(255,255,255,0.08)', borderRadius: 12, borderBottomLeftRadius: 3, width: 'fit-content' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Composant Demo Programme ───────────────────────────────────
function DemoProgramme({ demo }: { demo: any }) {
  const [checked, setChecked] = useState<number[]>([])
  const [text, setText] = useState('')

  return (
    <div style={{ background: '#1A1A1A', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ position: 'relative', height: 120, overflow: 'hidden' }}>
        <img
          src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=75"
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.6)' }}
        />
        <div style={{ position: 'absolute', bottom: 12, left: 14 }}>
          <div style={{ fontSize: 9, color: '#C4956A', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 4 }}>AUJOURD'HUI · JOUR 1</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: 'white', fontWeight: 500 }}>{demo.title}</div>
        </div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 12 }}>{demo.description}</p>
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, color: '#C4956A', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>PILIERS À NOTER /10</p>
          {demo.tasks.map((t: string, i: number) => (
            <div
              key={i}
              onClick={() => setChecked(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                background: checked.includes(i) ? 'rgba(196,149,106,0.15)' : 'rgba(255,255,255,0.04)',
                marginBottom: 4, transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: `1.5px solid ${checked.includes(i) ? '#C4956A' : 'rgba(255,255,255,0.2)'}`,
                background: checked.includes(i) ? '#C4956A' : 'transparent',
                flexShrink: 0, transition: 'all 0.2s',
              }} />
              <span style={{ fontSize: 11, color: checked.includes(i) ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.75)' }}>{t}</span>
            </div>
          ))}
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={demo.question}
          rows={2}
          style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(196,149,106,0.2)', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: 'white', fontFamily: "'DM Sans', sans-serif", resize: 'none', outline: 'none', boxSizing: 'border-box' as const }}
        />
      </div>
    </div>
  )
}

// ── Formulaire Conversion ──────────────────────────────────────
function ConversionForm() {
  const [mode, setMode] = useState<'choice' | 'beta' | 'waitlist' | 'done'>('choice')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  const API_URL = 'https://novae-by-omanaia.com/api/subscribe'

  const submit = async (listId: number, source: string) => {
    if (!email) return
    setSending(true)
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, prenom, listId, SOURCE: source }),
      })
    } catch {}
    finally {
      setSending(false)
      setMode('done')
    }
  }

  if (mode === 'done') return (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
      <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: '#1A1A1A', marginBottom: 8 }}>C'est noté !</h3>
      <p style={{ fontSize: 13, color: '#6B6560', lineHeight: 1.7 }}>
        Merci {prenom || ''} ! Tu seras parmi les premières informées.<br />— Ness, fondatrice d'OMANAÏA
      </p>
    </div>
  )

  if (mode === 'choice') return (
    <div>
      <p style={{ fontSize: 13, color: '#6B6560', textAlign: 'center', marginBottom: 20, lineHeight: 1.7 }}>
        Tu viens de voir tout ce que NOVAÉ peut faire pour toi.<br />Quelle est la suite pour toi ?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          onClick={() => setMode('beta')}
          style={{ padding: '16px', background: '#1A1A1A', border: 'none', borderRadius: 12, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'DM Sans', sans-serif" }}
        >
          <span style={{ fontSize: 22 }}>✦</span>
          <div>
            <div style={{ marginBottom: 2 }}>Devenir bêta testrice</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>Accès gratuit + badge Fondatrice + tarif préférentiel</div>
          </div>
        </button>
        <button
          onClick={() => setMode('waitlist')}
          style={{ padding: '16px', background: 'white', border: '1.5px solid #E8E0D8', borderRadius: 12, color: '#1A1A1A', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'DM Sans', sans-serif" }}
        >
          <span style={{ fontSize: 22 }}>📩</span>
          <div>
            <div style={{ marginBottom: 2 }}>Liste d'attente</div>
            <div style={{ fontSize: 11, color: '#6B6560', fontWeight: 400 }}>Être alertée au lancement + offre exclusive -20%</div>
          </div>
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <button onClick={() => setMode('choice')} style={{ background: 'none', border: 'none', color: '#6B6560', fontSize: 12, cursor: 'pointer', marginBottom: 16, padding: 0, fontFamily: "'DM Sans', sans-serif" }}>
        ← Retour
      </button>
      <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#1A1A1A', marginBottom: 16 }}>
        {mode === 'beta' ? 'Rejoindre la bêta ✦' : 'Liste d\'attente'}
      </h3>
      <input
        value={prenom}
        onChange={e => setPrenom(e.target.value)}
        placeholder="Ton prénom"
        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E8E0D8', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif", background: '#FAF7F2', marginBottom: 10, boxSizing: 'border-box' as const }}
      />
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Ton email *"
        type="email"
        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E8E0D8', borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 14, fontFamily: "'DM Sans', sans-serif", background: '#FAF7F2', boxSizing: 'border-box' as const }}
      />
      <button
        onClick={() => submit(mode === 'beta' ? 7 : 8, mode === 'beta' ? 'beta_testeur_demo' : 'liste_attente_demo')}
        disabled={!email || sending}
        style={{ width: '100%', padding: '14px', background: email ? '#C4956A' : 'rgba(26,26,26,0.08)', border: 'none', borderRadius: 10, color: email ? 'white' : 'rgba(26,26,26,0.3)', fontSize: 13, fontWeight: 600, cursor: email ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif" }}
      >
        {sending ? 'Envoi...' : mode === 'beta' ? 'Envoyer ma candidature ✦' : 'M\'inscrire sur la liste →'}
      </button>
      <p style={{ fontSize: 10, color: '#6B6560', textAlign: 'center', marginTop: 8 }}>
        🔒 Tes données ne seront jamais vendues ni partagées
      </p>
    </div>
  )
}

// ── PAGE PRINCIPALE ────────────────────────────────────────────
export default function DemoPage() {
  const router = useRouter()
  const [currentSlide, setCurrentSlide] = useState(0)

  const slide = GUIDE_SLIDES[currentSlide]
  const isLast = currentSlide === GUIDE_SLIDES.length - 1
  const progress = ((currentSlide + 1) / GUIDE_SLIDES.length) * 100

  const next = () => { if (!isLast) setCurrentSlide(s => s + 1) }
  const prev = () => { if (currentSlide > 0) setCurrentSlide(s => s - 1) }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: "'DM Sans', sans-serif" }}>

      {/* BANDE DEMO */}
      <div style={{ background: '#1A1A1A', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}>MODE DÉMO</span>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(196,149,106,0.5)', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Aucune donnée n'est enregistrée</span>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(196,149,106,0.5)', flexShrink: 0 }} />
        <Link href="/" style={{ fontSize: 11, color: '#C4956A', textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}>← Retour au site</Link>
      </div>

      {/* HEADER */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(196,149,106,0.1)', background: 'white' }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, letterSpacing: '0.1em', color: '#1A1A1A' }}>
            NOV<span style={{ color: '#C4956A' }}>A</span>É
          </div>
          <div style={{ fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6B6560', marginTop: 1 }}>Guide de découverte</div>
        </div>
        <div style={{ fontSize: 12, color: '#6B6560' }}>{currentSlide + 1} / {GUIDE_SLIDES.length}</div>
      </div>

      {/* BARRE DE PROGRESSION */}
      <div style={{ height: 3, background: 'rgba(196,149,106,0.12)' }}>
        <div style={{ height: '100%', background: slide.color, width: `${progress}%`, transition: 'width 0.5s ease' }} />
      </div>

      {/* CONTENU PRINCIPAL */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 140px' }}>

        {/* TAG */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: slide.color,
          background: `${slide.color}18`, padding: '5px 12px',
          borderRadius: 20, border: `1px solid ${slide.color}30`,
          marginBottom: 20,
        }}>
          ✦ {slide.tag}
        </div>

        {/* TITRE */}
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 500, color: '#1A1A1A', lineHeight: 1.15, marginBottom: 10, whiteSpace: 'pre-line' }}>
          {slide.title}
        </h1>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontStyle: 'italic', color: '#6B6560', marginBottom: 16 }}>
          {slide.subtitle}
        </p>
        <p style={{ fontSize: 14, color: '#6B6560', lineHeight: 1.8, marginBottom: 28 }}>
          {slide.desc}
        </p>

        {/* IMAGE (si pas de démo ni CTA) */}
        {!slide.demo && !(slide as any).isCTA && (
          <div style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 24, position: 'relative' }}>
            <img
              src={slide.image}
              alt={slide.title}
              style={{ width: '100%', height: 220, objectFit: 'cover', filter: 'brightness(0.85) saturate(0.9)' }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(26,26,26,0.6) 100%)' }} />
          </div>
        )}

        {/* HIGHLIGHTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {slide.highlights.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'white', borderRadius: 12, border: '1px solid rgba(196,149,106,0.1)' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{h.icon}</span>
              <span style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>{h.text}</span>
            </div>
          ))}
        </div>

        {/* DÉMOS INTERACTIVES */}
        {slide.demo?.type === 'routines' && slide.demo?.items && (
          <div style={{ marginBottom: 24 }}>
            <DemoRoutines items={slide.demo.items} />
          </div>
        )}
        {slide.demo?.type === 'chat' && slide.demo?.messages && (
          <div style={{ marginBottom: 24 }}>
            <DemoChat messages={slide.demo.messages} />
          </div>
        )}
        {slide.demo?.type === 'programme' && slide.demo && (
          <div style={{ marginBottom: 24 }}>
            <DemoProgramme demo={slide.demo} />
          </div>
        )}

        {/* CTA FINAL */}
        {(slide as any).isCTA && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', border: '1px solid rgba(196,149,106,0.15)', marginBottom: 16 }}>
              <ConversionForm />
            </div>
            <div style={{ background: '#1A1A1A', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 24 }}>🎮</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 3 }}>Tester l'app en mode démo</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Explore toutes les fonctionnalités · Aucune donnée enregistrée</div>
              </div>
              <button
                onClick={() => router.push('/demo/app')}
                style={{ padding: '9px 16px', background: '#C4956A', border: 'none', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}
              >
                Essayer →
              </button>
            </div>

      {/* ── NAVIGATION FIXE EN BAS ── */}
      {/* Wrapper pleine largeur pour centrer le contenu */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'rgba(250,247,242,0.96)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(196,149,106,0.12)',
      }}>
        {/* Contenu centré et limité en largeur */}
        <div style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '16px 20px',
          display: 'flex',
          gap: 12,
        }}>
          {currentSlide > 0 && (
            <button
              onClick={prev}
              style={{
                flexShrink: 0,
                padding: '14px 20px',
                background: 'white',
                border: '1px solid rgba(196,149,106,0.2)',
                borderRadius: 12,
                color: 'rgba(26,26,26,0.5)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              ←
            </button>
          )}
          <button
            onClick={next}
            disabled={isLast}
            style={{
              flex: 1,
              padding: '14px',
              background: isLast ? 'rgba(26,26,26,0.06)' : slide.color,
              border: 'none',
              borderRadius: 12,
              color: isLast ? 'rgba(26,26,26,0.3)' : 'white',
              fontSize: 13,
              fontWeight: 700,
              cursor: isLast ? 'default' : 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.04em',
              transition: 'all 0.2s',
            }}
          >
            {isLast ? 'Guide terminé ✦' : currentSlide === 0 ? 'Découvrir l\'app →' : 'Module suivant →'}
          </button>
        </div>
      </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  )
}