'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

const GUIDE_SLIDES = [
  { id: 'welcome', tag: 'Bienvenue', title: 'NOVAÉ, c\'est une app\nqui change tout.', subtitle: 'Une seule app au lieu de cinq.', desc: 'NOVAÉ connecte ton programme 90 jours, ton agent IA, tes routines, ton planner, tes repas et ta famille. Tu te concentres sur toi — elle gère le reste.', image: MODULE_IMAGES.programme, highlights: [{ icon: '🎯', text: '10 modules connectés entre eux' }, { icon: '🤖', text: 'Un agent IA qui connaît ta vie' }, { icon: '✦', text: '90 jours pour te transformer' }], color: '#c4956a' },
  { id: 'programme', tag: 'Module 1', title: 'Programme 90 Jours', subtitle: '3 phases. Une transformation.', desc: 'Chaque jour, une mission guidée personnalisée selon ton profil psychologique. Phase 1 : Reprogrammation. Phase 2 : Action & Discipline. Phase 3 : Expansion.', image: MODULE_IMAGES.programme, highlights: [{ icon: '📸', text: 'Image unique et paysage pour chaque jour' }, { icon: '✍️', text: 'Réflexion guidée avec question personnalisée' }, { icon: '🔒', text: 'Jours débloqués progressivement' }], color: '#c4956a', demo: { type: 'programme', day: 1, title: 'Le Scanner 360°', description: 'Avant de transformer ton futur, regarde ton présent avec une honnêteté radicale. Note chaque pilier de ta vie de 1 à 10.', question: 'En regardant ces notes, quelle sphère réclame ton attention immédiate ?', tasks: ['Santé & Énergie', 'Équilibre Mental', 'Relations & Amour', 'Carrière & Projets', 'Finances'] } },
  { id: 'agent', tag: 'Module 2', title: 'Agent IA NOVAÉ', subtitle: 'Ton coach qui voit tout.', desc: 'L\'agent NOVAÉ lit tes données en temps réel — tâches, routines, repas, famille — et agit directement pour toi. Ce n\'est pas un chatbot. C\'est un vrai assistant qui connaît ta vie.', image: MODULE_IMAGES.agent, highlights: [{ icon: '⚡', text: 'Détecte les conflits de planning automatiquement' }, { icon: '⚠️', text: 'Alerte allergie croisée avec tes recettes' }, { icon: '📊', text: 'Bilan complet chaque dimanche' }], color: '#8b5a3c', demo: { type: 'chat', messages: [{ role: 'user', text: 'Y a-t-il des conflits dans mon planning cette semaine ?' }, { role: 'ai', text: '⚡ J\'ai détecté 2 conflits :\n\n• Mardi 14h : ta routine yoga chevauche une réunion planifiée\n• Jeudi : quinoa dans le Buddha Bowl — Shana est allergique\n\nVeux-tu que je réorganise ?' }, { role: 'user', text: 'Oui, réorganise le planning !' }, { role: 'ai', text: '✅ Fait ! J\'ai déplacé ta routine yoga à 7h le mardi, et remplacé le quinoa par du boulgour. Ta semaine est maintenant sans conflit. 🎯' }] } },
  { id: 'routines', tag: 'Module 3', title: 'Routines', subtitle: 'Ta révolution silencieuse.', desc: 'Crée tes routines matin et soir. Coche chaque habitude au quotidien. L\'agent IA suit ta progression et te félicite. Le suivi hebdomadaire te montre ton évolution.', image: MODULE_IMAGES.routines, highlights: [{ icon: '☀️', text: 'Routine matin personnalisée' }, { icon: '🌙', text: 'Routine soir pour décompresser' }, { icon: '📈', text: 'Stats hebdomadaires automatiques' }], color: '#d4a574', demo: { type: 'routines', items: [{ emoji: '💧', label: 'Boire un grand verre d\'eau', done: true }, { emoji: '🧘', label: '10 min de méditation', done: true }, { emoji: '📖', label: '15 min de lecture', done: false }, { emoji: '✍️', label: 'Écrire 3 gratitudes', done: false }, { emoji: '🚶', label: '20 min de marche', done: false }] } },
  { id: 'planner', tag: 'Module 4', title: 'Planner & To-do', subtitle: 'Reprends le contrôle de ton temps.', desc: 'Planifie ta journée par créneaux de 15 minutes. Crée tes tâches prioritaires. L\'agent détecte automatiquement les conflits avec tes routines et tes repas.', image: MODULE_IMAGES.planner, highlights: [{ icon: '📅', text: 'Créneaux de 15 min ultra précis' }, { icon: '🔴', text: 'Tâches prioritaires identifiées' }, { icon: '⚡', text: 'Conflits détectés en temps réel' }], color: '#c4956a' },
  { id: 'tracker', tag: 'Module 5', title: 'Tracker', subtitle: 'Ce que tu mesures, tu le changes.', desc: 'Suis tes habitudes au quotidien. Graphiques de progression. Score de cohérence hebdomadaire. Streaks et badges pour te motiver.', image: MODULE_IMAGES.tracker, highlights: [{ icon: '📊', text: 'Graphiques de progression clairs' }, { icon: '🔥', text: 'Streaks pour maintenir l\'élan' }, { icon: '🏅', text: 'Badges débloqués automatiquement' }], color: '#d4a574' },
  { id: 'recettes', tag: 'Module 6', title: 'Recettes & Courses', subtitle: 'Manger mieux sans y penser.', desc: 'Planning de repas en glisser-déposer. Liste de courses générée automatiquement. Batch cooking suggéré intelligemment. 10 recettes pré-chargées pour démarrer.', image: MODULE_IMAGES.recettes, highlights: [{ icon: '🍳', text: 'Planning repas de la semaine en 2 min' }, { icon: '🛒', text: 'Liste de courses générée en 1 clic' }, { icon: '⚠️', text: 'Allergies croisées automatiquement' }], color: '#c4956a' },
  { id: 'famille', tag: 'Module 7', title: 'Famille & Proches', subtitle: 'Ne plus jamais oublier ce qui compte.', desc: 'Stocke les informations importantes de tes proches. Allergies, anniversaires, préférences. L\'agent croise ces données avec tes recettes et te prévient 7 jours avant chaque anniversaire.', image: MODULE_IMAGES.famille, highlights: [{ icon: '💛', text: 'Anniversaires anticipés J-7' }, { icon: '⚠️', text: 'Alertes allergie proactives' }, { icon: '🎁', text: 'Idées cadeaux personnalisées' }], color: '#c4956a' },
  { id: 'communaute', tag: 'Module 8', title: 'Communauté', subtitle: 'Tu n\'es pas seule dans cette transformation.', desc: 'Rejoins des femmes qui vivent la même transformation. Partage tes victoires, tes réflexions. Participe aux défis hebdomadaires lancés par NOVAÉ. Gagne des badges.', image: MODULE_IMAGES.communaute, highlights: [{ icon: '👭', text: 'Communauté bienveillante de femmes' }, { icon: '🎯', text: 'Défis hebdomadaires lancés par NOVAÉ' }, { icon: '🏆', text: 'Classement mensuel & badges' }], color: '#8b5a3c' },
  { id: 'cta', tag: 'Tu es convaincue ?', title: 'Rejoins NOVAÉ\navant tout le monde.', subtitle: '7,99€/mois · Lancement dans 1-2 mois', desc: 'Les premières inscrites bénéficieront d\'un accès gratuit pendant toute la bêta, d\'un tarif préférentiel au lancement, et du badge "Fondatrice" dans l\'app.', image: MODULE_IMAGES.programme, highlights: [{ icon: '✦', text: 'Accès gratuit pendant la bêta' }, { icon: '🎖️', text: 'Badge Fondatrice dans l\'app' }, { icon: '💰', text: 'Tarif préférentiel au lancement' }], color: '#c4956a', isCTA: true },
]

function DemoRoutines({ items }: { items: { emoji: string; label: string; done: boolean }[] }) {
  const [checked, setChecked] = useState(items.map(i => i.done))
  const count = checked.filter(Boolean).length
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderRadius: 18, padding: 18, border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 8px 24px rgba(91,56,33,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.18em', color: '#c4956a', textTransform: 'uppercase' }}>Routine Matin</span>
        <span style={{ fontSize: 11, color: '#8b6f55' }}>{count}/{items.length}</span>
      </div>
      <div style={{ height: 3, background: 'rgba(139,90,60,0.12)', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ width: `${(count / items.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #d4a574, #c4956a)', borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
      {items.map((item, i) => (
        <div key={i} onClick={() => setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', background: checked[i] ? 'rgba(196,149,106,0.12)' : 'rgba(255,255,255,0.6)', border: `1px solid ${checked[i] ? 'rgba(196,149,106,0.3)' : 'rgba(255,255,255,0.5)'}`, marginBottom: 6, transition: 'all 0.2s' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${checked[i] ? '#c4956a' : 'rgba(139,90,60,0.25)'}`, background: checked[i] ? '#c4956a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
            {checked[i] && (<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>)}
          </div>
          <span style={{ fontSize: 14 }}>{item.emoji}</span>
          <span style={{ fontSize: 12.5, color: checked[i] ? 'rgba(61,38,24,0.4)' : '#3d2618', textDecoration: checked[i] ? 'line-through' : 'none', transition: 'all 0.2s' }}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function DemoChat({ messages }: { messages: { role: string; text: string }[] }) {
  const [visible, setVisible] = useState(1)
  useEffect(() => {
    if (visible < messages.length) {
      const t = setTimeout(() => setVisible(v => v + 1), 1200)
      return () => clearTimeout(t)
    }
  }, [visible, messages.length])
  return (
    <div style={{ background: 'linear-gradient(180deg, #5b3821 0%, #1a120c 100%)', borderRadius: 18, padding: 18, border: '1px solid rgba(212,165,116,0.2)', boxShadow: '0 12px 30px rgba(91,56,33,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(212,165,116,0.15)' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #d4a574, #c4956a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, fontFamily: "'Cormorant Garamond', serif" }}>N</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#f3dcc6', fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Agent NOVAÉ</div>
          <div style={{ fontSize: 9.5, color: 'rgba(212,165,116,0.7)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>● Connecté</div>
        </div>
      </div>
      {messages.slice(0, visible).map((msg, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
          <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 14, background: msg.role === 'user' ? 'linear-gradient(135deg, #d4a574, #c4956a)' : 'rgba(243,220,198,0.1)', color: msg.role === 'user' ? 'white' : 'rgba(243,220,198,0.92)', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', borderBottomRightRadius: msg.role === 'user' ? 3 : 14, borderBottomLeftRadius: msg.role === 'ai' ? 3 : 14, border: msg.role === 'user' ? 'none' : '1px solid rgba(212,165,116,0.15)' }}>{msg.text}</div>
        </div>
      ))}
      {visible < messages.length && (
        <div style={{ display: 'flex', gap: 4, padding: '10px 14px', background: 'rgba(243,220,198,0.1)', borderRadius: 14, borderBottomLeftRadius: 3, width: 'fit-content', border: '1px solid rgba(212,165,116,0.15)' }}>
          {[0, 1, 2].map(i => (<div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(212,165,116,0.6)', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />))}
        </div>
      )}
    </div>
  )
}

function DemoProgramme({ demo }: { demo: any }) {
  const [checked, setChecked] = useState<number[]>([])
  const [text, setText] = useState('')
  return (
    <div style={{ background: 'linear-gradient(180deg, #5b3821 0%, #1a120c 100%)', borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(212,165,116,0.2)', boxShadow: '0 12px 30px rgba(91,56,33,0.25)' }}>
      <div style={{ position: 'relative', height: 130, overflow: 'hidden' }}>
        <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=75" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.55) saturate(1.1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(26,18,12,0.85) 0%, rgba(91,56,33,0.3) 60%, transparent 100%)' }} />
        <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }}>
          <div style={{ fontSize: 9, color: '#e8b48a', fontWeight: 700, letterSpacing: '0.22em', marginBottom: 4 }}>AUJOURD'HUI · JOUR 1</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#fef6e8', fontWeight: 500, letterSpacing: '0.3px' }}>{demo.title}</div>
        </div>
      </div>
      <div style={{ padding: '16px 18px' }}>
        <p style={{ fontSize: 12, color: 'rgba(243,220,198,0.7)', lineHeight: 1.65, marginBottom: 14 }}>{demo.description}</p>
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 9.5, color: '#d4a574', fontWeight: 700, letterSpacing: '0.18em', marginBottom: 8 }}>PILIERS À NOTER /10</p>
          {demo.tasks.map((t: string, i: number) => (
            <div key={i} onClick={() => setChecked(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: checked.includes(i) ? 'rgba(212,165,116,0.18)' : 'rgba(243,220,198,0.05)', border: `1px solid ${checked.includes(i) ? 'rgba(212,165,116,0.35)' : 'rgba(243,220,198,0.08)'}`, marginBottom: 5, transition: 'all 0.2s' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${checked.includes(i) ? '#d4a574' : 'rgba(243,220,198,0.25)'}`, background: checked.includes(i) ? '#d4a574' : 'transparent', flexShrink: 0, transition: 'all 0.2s' }} />
              <span style={{ fontSize: 11.5, color: checked.includes(i) ? 'rgba(243,220,198,0.55)' : 'rgba(243,220,198,0.85)' }}>{t}</span>
            </div>
          ))}
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={demo.question} rows={2} style={{ width: '100%', background: 'rgba(243,220,198,0.06)', border: '1px solid rgba(212,165,116,0.25)', borderRadius: 10, padding: '10px 12px', fontSize: 11.5, color: '#fef6e8', fontFamily: "'DM Sans', sans-serif", resize: 'none', outline: 'none', boxSizing: 'border-box' as const }} />
      </div>
    </div>
  )
}

function ConversionForm() {
  const [mode, setMode] = useState<'choice' | 'beta' | 'waitlist' | 'done'>('choice')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const API_URL = 'https://novae-by-omanaia.com/api/subscribe'

  const submit = async (listId: number, source: string) => {
    if (!email) return
    setSending(true)
    try { await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, prenom, listId, SOURCE: source }) }) } catch {}
    finally { setSending(false); setMode('done') }
  }

  if (mode === 'done') return (
    <div style={{ textAlign: 'center', padding: '36px 0' }}>
      <div style={{ fontSize: 44, marginBottom: 14, color: '#c4956a' }}>✦</div>
      <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 400, color: '#3d2618', marginBottom: 10, letterSpacing: '0.3px' }}>C'est noté.</h3>
      <p style={{ fontSize: 13.5, color: '#6b5340', lineHeight: 1.75 }}>Merci {prenom || ''}. Tu seras parmi les premières informées.<br /><span style={{ fontStyle: 'italic', color: '#8b5a3c', fontFamily: "'Cormorant Garamond', serif", fontSize: 15 }}>— Ness, fondatrice d'OMANAÏA</span></p>
    </div>
  )

  if (mode === 'choice') return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <p style={{ fontSize: 14, color: '#6b5340', marginBottom: 28, lineHeight: 1.75 }}>Accède à l'app gratuitement pendant la bêta.</p>
      <a href="https://app.novae-by-omanaia.com" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '17px 38px', background: 'linear-gradient(135deg, #5b3821, #70492d)', borderRadius: 999, color: '#f3dcc6', fontSize: 13, fontWeight: 600, textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase', border: '1px solid rgba(212,165,116,0.4)', boxShadow: '0 10px 28px rgba(91,56,33,0.32)' }}>
        <span style={{ color: '#e8b48a', fontSize: 15 }}>✦</span> Accéder à l'app gratuitement
      </a>
      <p style={{ fontSize: 11, color: '#8b6f55', marginTop: 14, letterSpacing: '0.05em' }}>Bêta ouverte · Aucune carte requise</p>
    </div>
  )

  return (
    <div>
      <button onClick={() => setMode('choice')} style={{ background: 'none', border: 'none', color: '#8b5a3c', fontSize: 12, cursor: 'pointer', marginBottom: 18, padding: 0, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>← Retour</button>
      <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: '#3d2618', marginBottom: 18, letterSpacing: '0.3px' }}>{mode === 'beta' ? 'Rejoindre la bêta ✦' : 'Liste d\'attente'}</h3>
      <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Ton prénom" style={{ width: '100%', padding: '12px 14px', border: '1.5px solid rgba(196,149,106,0.3)', borderRadius: 10, fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif", background: 'rgba(255,255,255,0.6)', marginBottom: 10, boxSizing: 'border-box' as const, color: '#3d2618' }} />
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Ton email *" type="email" style={{ width: '100%', padding: '12px 14px', border: '1.5px solid rgba(196,149,106,0.3)', borderRadius: 10, fontSize: 13, outline: 'none', marginBottom: 16, fontFamily: "'DM Sans', sans-serif", background: 'rgba(255,255,255,0.6)', boxSizing: 'border-box' as const, color: '#3d2618' }} />
      <button onClick={() => submit(mode === 'beta' ? 7 : 8, mode === 'beta' ? 'beta_testeur_demo' : 'liste_attente_demo')} disabled={!email || sending} style={{ width: '100%', padding: '15px', background: email ? 'linear-gradient(135deg, #d4a574, #c4956a)' : 'rgba(139,90,60,0.1)', border: 'none', borderRadius: 999, color: email ? 'white' : 'rgba(61,38,24,0.3)', fontSize: 13, fontWeight: 600, letterSpacing: '0.05em', cursor: email ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif", boxShadow: email ? '0 8px 24px rgba(196,149,106,0.4)' : 'none', transition: 'all 0.2s ease' }}>{sending ? 'Envoi...' : mode === 'beta' ? 'Tester l\'app maintenant' : 'M\'inscrire sur la liste'}</button>
      <p style={{ fontSize: 10.5, color: '#8b6f55', textAlign: 'center', marginTop: 10 }}>🔒 Tes données ne seront jamais vendues ni partagées</p>
    </div>
  )
}

export default function DemoPage() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const slide = GUIDE_SLIDES[currentSlide]
  const isLast = currentSlide === GUIDE_SLIDES.length - 1
  const progress = ((currentSlide + 1) / GUIDE_SLIDES.length) * 100
  const next = () => { if (!isLast) setCurrentSlide(s => s + 1) }
  const prev = () => { if (currentSlide > 0) setCurrentSlide(s => s - 1) }

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", position: 'relative', background: 'radial-gradient(ellipse at 20% 0%, #e8c4a8 0%, transparent 55%),radial-gradient(ellipse at 80% 100%, #d4a574 0%, transparent 55%),linear-gradient(180deg, #f3dcc6 0%, #ead0b5 50%, #e0c4a3 100%)', backgroundAttachment: 'fixed' }}>

      <div style={{ background: 'linear-gradient(180deg, rgba(91,56,33,0.96) 0%, rgba(112,73,45,0.92) 100%)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '11px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, color: '#e8b48a', letterSpacing: '0.22em', fontWeight: 600 }}>MODE DÉMO</span>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(212,165,116,0.5)', flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'rgba(243,220,198,0.65)' }}>Aucune donnée n'est enregistrée</span>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(212,165,116,0.5)', flexShrink: 0 }} />
        <Link href="/" style={{ fontSize: 11, color: '#e8b48a', textDecoration: 'none', fontWeight: 600, flexShrink: 0, letterSpacing: '0.04em' }}>← Retour au site</Link>
      </div>

      <div style={{ padding: '18px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(196,149,106,0.18)', background: 'linear-gradient(135deg, rgba(255,255,255,0.45), rgba(255,255,255,0.2))', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500, letterSpacing: '0.08em', color: '#3d2618' }}>Nov<span style={{ fontStyle: 'italic', color: '#8b5a3c' }}>aé</span></div>
          <div style={{ fontSize: 8.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8b6f55', marginTop: 2, fontWeight: 500 }}>Guide de découverte</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#8b5a3c', letterSpacing: '0.1em', background: 'rgba(255,255,255,0.5)', padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(196,149,106,0.25)' }}>{currentSlide + 1} / {GUIDE_SLIDES.length}</div>
      </div>

      <div style={{ height: 3, background: 'rgba(139,90,60,0.12)' }}>
        <div style={{ height: '100%', background: `linear-gradient(90deg, ${slide.color}, #e8b48a)`, width: `${progress}%`, transition: 'width 0.5s ease', boxShadow: `0 0 12px ${slide.color}66` }} />
      </div>

      <div style={{ maxWidth: 660, margin: '0 auto', padding: '36px 22px 150px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: slide.color, background: `${slide.color}1a`, padding: '7px 14px', borderRadius: 999, border: `1px solid ${slide.color}40`, marginBottom: 22 }}>
          <span style={{ fontSize: 12 }}>✦</span>{slide.tag}
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 400, color: '#3d2618', lineHeight: 1.08, marginBottom: 12, whiteSpace: 'pre-line', letterSpacing: '0.3px' }}>{slide.title}</h1>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontStyle: 'italic', color: '#8b5a3c', marginBottom: 18, lineHeight: 1.45 }}>{slide.subtitle}</p>
        <p style={{ fontSize: 14.5, color: '#6b5340', lineHeight: 1.8, marginBottom: 30 }}>{slide.desc}</p>

        {!slide.demo && !(slide as any).isCTA && (
          <div style={{ borderRadius: 22, overflow: 'hidden', marginBottom: 26, position: 'relative', boxShadow: '0 20px 50px rgba(91,56,33,0.18)' }}>
            <img src={slide.image} alt={slide.title} style={{ width: '100%', height: 240, objectFit: 'cover', filter: 'brightness(0.92) saturate(1.05)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, rgba(91,56,33,0.55) 100%)' }} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 26 }}>
          {slide.highlights.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.5)', borderLeft: `3px solid ${slide.color}`, boxShadow: '0 4px 14px rgba(139,90,60,0.06)' }}>
              <span style={{ fontSize: 19, flexShrink: 0 }}>{h.icon}</span>
              <span style={{ fontSize: 13.5, color: '#3d2618', fontWeight: 500, lineHeight: 1.5 }}>{h.text}</span>
            </div>
          ))}
        </div>

        {slide.demo?.type === 'routines' && slide.demo?.items && (<div style={{ marginBottom: 26 }}><DemoRoutines items={slide.demo.items} /></div>)}
        {slide.demo?.type === 'chat' && slide.demo?.messages && (<div style={{ marginBottom: 26 }}><DemoChat messages={slide.demo.messages} /></div>)}
        {slide.demo?.type === 'programme' && slide.demo && (<div style={{ marginBottom: 26 }}><DemoProgramme demo={slide.demo} /></div>)}

        {(slide as any).isCTA && (
          <div style={{ marginBottom: 26 }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.6), rgba(255,255,255,0.3))', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderRadius: 24, padding: '32px 28px', border: '1px solid rgba(255,255,255,0.55)', boxShadow: '0 20px 50px rgba(91,56,33,0.12)' }}>
              <ConversionForm />
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,246,235,0.92) 100%)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(196,149,106,0.25)', boxShadow: '0 -6px 24px rgba(91,56,33,0.1)' }}>
        <div style={{ maxWidth: 660, margin: '0 auto', padding: '16px 22px', display: 'flex', gap: 12 }}>
          {currentSlide > 0 && (
            <button onClick={prev} style={{ flexShrink: 0, padding: '15px 22px', background: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.4))', border: '1px solid rgba(196,149,106,0.3)', borderRadius: 999, color: '#8b5a3c', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', transition: 'all 0.2s' }}>←</button>
          )}
          <button onClick={next} disabled={isLast} style={{ flex: 1, padding: '15px', background: isLast ? 'rgba(139,90,60,0.1)' : `linear-gradient(135deg, ${slide.color}, ${slide.color === '#8b5a3c' ? '#5b3821' : '#c4956a'})`, border: 'none', borderRadius: 999, color: isLast ? 'rgba(61,38,24,0.35)' : 'white', fontSize: 13, fontWeight: 700, cursor: isLast ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase', boxShadow: isLast ? 'none' : '0 10px 28px rgba(196,149,106,0.4)', transition: 'all 0.25s' }}>
            {isLast ? 'Guide terminé ✦' : currentSlide === 0 ? 'Découvrir l\'app →' : 'Module suivant →'}
          </button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        * { box-sizing: border-box; }
        body { margin: 0; }
        textarea::placeholder { color: rgba(243,220,198,0.4); }
        input::placeholder { color: rgba(139,90,60,0.4); }
      `}</style>
    </div>
  )
}