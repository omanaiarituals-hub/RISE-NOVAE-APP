'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

// ⚠️ Ton compte uniquement. Remplace par ton user_id si besoin.
const OWNER_ID = 'cce02eb0-53a1-49c0-82bc-1851a92f1e3c'

const STORAGE_KEY = 'novae-presentation-scripts'

interface Script { id: string; label: string; text: string }

const DEFAULT_SCRIPTS: Script[] = [
  { id: '1', label: 'Présentation', text: "Salut toi. Moi, c'est Nova, ta nouvelle assistante. Pas une appli de plus. Une présence à tes côtés, pour porter ce que tu gardes dans ta tête." },
  { id: '2', label: 'Ce que je fais', text: "Tu me parles, et j'agis. Je planifie ta semaine, j'ajoute tes rendez-vous, je prépare tes repas et ta liste de courses, et je te rappelle ce qui compte, pour que tu n'aies plus à y penser." },
  { id: '3', label: 'Ton programme', text: "Chaque matin, je te donne le récap de ta journée. Et je t'accompagne, jour après jour, dans ton programme de 90 jours, pour te retrouver, à ton rythme." },
  { id: '4', label: 'Invitation', text: "Tu n'as plus à tout porter seule. Essaie-moi pendant quatorze jours. Et respire, enfin." },
]

export default function PresentationPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const router = useRouter()

  const [scripts, setScripts] = useState<Script[]>(DEFAULT_SCRIPTS)
  const [speaking, setSpeaking] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [rate, setRate] = useState(0.95)
  const [pitch, setPitch] = useState(1.05)
  const [editMode, setEditMode] = useState(false)
  const ttsVoiceRef = useRef<any>(null)
  const stopRef = useRef(false)

  // Gate : page reservee a ton compte
  useEffect(() => {
    if (!authLoading && (!user || user.id !== OWNER_ID)) {
      router.push('/')
    }
  }, [user, authLoading, router])

  // Charger les scripts sauvegardes + voix FR
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setScripts(JSON.parse(saved))
    } catch {}
    if ('speechSynthesis' in window) {
      const pick = () => {
        const voices = window.speechSynthesis.getVoices()
        ttsVoiceRef.current =
          voices.find(v => v.lang === 'fr-FR' && /amélie|audrey|virginie|f(é|e)min|female|google/i.test(v.name)) ||
          voices.find(v => v.lang === 'fr-FR') ||
          voices.find(v => v.lang && v.lang.startsWith('fr')) || null
      }
      pick()
      window.speechSynthesis.onvoiceschanged = pick
    }
    return () => { try { window.speechSynthesis?.cancel() } catch {} }
  }, [])

  const persist = (next: Script[]) => {
    setScripts(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  const cleanForSpeech = (t: string) => t
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\uFE00-\uFE0F\u200D\u20E3]/g, '')
    .replace(/[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF]/g, ' ')
    .replace(/[\u2022\u00B7]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const makeUtterance = (text: string) => {
    const u = new SpeechSynthesisUtterance(cleanForSpeech(text))
    u.lang = 'fr-FR'
    if (ttsVoiceRef.current) u.voice = ttsVoiceRef.current
    u.rate = rate
    u.pitch = pitch
    return u
  }

  const stopAll = () => {
    stopRef.current = true
    try { window.speechSynthesis.cancel() } catch {}
    setSpeaking(false)
    setActiveId(null)
  }

  const speakOne = (s: Script) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    stopRef.current = false
    window.speechSynthesis.cancel()
    const u = makeUtterance(s.text)
    u.onstart = () => { setSpeaking(true); setActiveId(s.id) }
    u.onend = () => { setSpeaking(false); setActiveId(null) }
    u.onerror = () => { setSpeaking(false); setActiveId(null) }
    window.speechSynthesis.speak(u)
  }

  const playAll = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    stopRef.current = false
    window.speechSynthesis.cancel()
    let i = 0
    const next = () => {
      if (stopRef.current || i >= scripts.length) { setSpeaking(false); setActiveId(null); return }
      const s = scripts[i]
      const u = makeUtterance(s.text)
      u.onstart = () => { setSpeaking(true); setActiveId(s.id) }
      u.onend = () => { i++; setTimeout(next, 350) }
      u.onerror = () => { i++; setTimeout(next, 350) }
      window.speechSynthesis.speak(u)
    }
    next()
  }

  const updateScript = (id: string, patch: Partial<Script>) => {
    persist(scripts.map(s => s.id === id ? { ...s, ...patch } : s))
  }
  const addScript = () => {
    persist([...scripts, { id: Date.now().toString(), label: 'Nouveau', text: '' }])
  }
  const removeScript = (id: string) => {
    persist(scripts.filter(s => s.id !== id))
  }

  if (authLoading || !user || user.id !== OWNER_ID) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FDFAF7' }}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#8b6f55' }}>…</p>
      </div>
    )
  }

  const activeText = activeId ? scripts.find(s => s.id === activeId)?.text : null

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(120% 80% at 50% 0%, #FBEDE6 0%, #FDFAF7 55%, #F6E3D6 100%)', fontFamily: "'DM Sans', sans-serif", paddingBottom: 60 }}>
      <style>{`
        @keyframes novaBreathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes novaRipple { 0%{transform:translate(-50%,-50%) scale(1);opacity:.5} 100%{transform:translate(-50%,-50%) scale(2.6);opacity:0} }
        .nova-core.speaking { animation: novaBreathe 2.4s ease-in-out infinite; }
        .nova-ripple { position:absolute; left:50%; top:50%; width:150px; height:150px; border-radius:50%; border:2px solid #C9A96E; transform:translate(-50%,-50%); animation: novaRipple 2.2s ease-out infinite; pointer-events:none; }
        .nova-ripple.r2 { animation-delay:.7s; border-color:#D9A6B0; }
        .nova-ripple.r3 { animation-delay:1.4s; }
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 22px 0' }}>
        <Link href="/agent" style={{ fontSize: 13, color: '#8b6f55', textDecoration: 'none' }}>← Agent</Link>
      </div>

      {/* Scène à filmer */}
      <div style={{ textAlign: 'center', padding: '30px 22px 10px' }}>
        <div style={{ position: 'relative', width: 340, height: 340, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {speaking && (
            <>
              <span className="nova-ripple r1" />
              <span className="nova-ripple r2" />
              <span className="nova-ripple r3" />
            </>
          )}
          <div
            className={`nova-core${speaking ? ' speaking' : ''}`}
            style={{
              width: 150, height: 150, borderRadius: '50%',
              background: 'linear-gradient(135deg, #C9A96E, #F2C4CE)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 64, fontWeight: 700, fontFamily: "'Cormorant Garamond', serif",
              boxShadow: '0 12px 40px rgba(196,149,106,.3)', zIndex: 2,
            }}
          >N</div>
        </div>

        <div style={{ minHeight: 130, maxWidth: 600, margin: '26px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{
            fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
            fontSize: 30, lineHeight: 1.4, color: '#3d2618', margin: 0,
            opacity: activeText ? 1 : 0.4, transition: 'opacity .3s',
          }}>
            {activeText || 'Nova est prête à se présenter.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 22 }}>
          {!speaking ? (
            <button onClick={playAll} style={btnPrimary}>▶ Tout enchaîner</button>
          ) : (
            <button onClick={stopAll} style={btnStop}>⏹ Stop</button>
          )}
        </div>
      </div>

      {/* Réglages voix */}
      <div style={{ maxWidth: 600, margin: '24px auto 0', padding: '0 22px', display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
        <label style={sliderWrap}>
          <span style={sliderLbl}>Vitesse {rate.toFixed(2)}</span>
          <input type="range" min={0.6} max={1.3} step={0.05} value={rate} onChange={e => setRate(parseFloat(e.target.value))} />
        </label>
        <label style={sliderWrap}>
          <span style={sliderLbl}>Tonalité {pitch.toFixed(2)}</span>
          <input type="range" min={0.7} max={1.5} step={0.05} value={pitch} onChange={e => setPitch(parseFloat(e.target.value))} />
        </label>
      </div>

      {/* Scripts éditables */}
      <div style={{ maxWidth: 600, margin: '30px auto 0', padding: '0 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#3d2618', margin: 0 }}>Mes textes</h2>
          <button onClick={() => setEditMode(e => !e)} style={btnGhost}>{editMode ? 'Terminer' : '✎ Modifier'}</button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {scripts.map(s => (
            <div key={s.id} style={{
              background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)',
              border: `1px solid ${activeId === s.id ? '#C9A96E' : 'rgba(196,149,106,0.25)'}`,
              borderRadius: 16, padding: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                {editMode ? (
                  <input value={s.label} onChange={e => updateScript(s.id, { label: e.target.value })}
                    style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8b6f55', background: 'transparent', border: 'none', outline: 'none' }} />
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8b6f55' }}>{s.label}</span>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => speakOne(s)} style={btnPlaySmall}>▶ Nova parle</button>
                  {editMode && <button onClick={() => removeScript(s.id)} style={{ ...btnPlaySmall, background: 'rgba(180,80,80,0.1)', color: '#8b3a3a', border: '1px solid rgba(180,80,80,0.3)' }}>✕</button>}
                </div>
              </div>
              {editMode ? (
                <textarea value={s.text} onChange={e => updateScript(s.id, { text: e.target.value })}
                  rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: 14, color: '#3d2618', background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(196,149,106,0.25)', borderRadius: 10, padding: '10px 12px', outline: 'none' }} />
              ) : (
                <p style={{ fontSize: 14, color: '#5b4636', lineHeight: 1.5, margin: 0 }}>{s.text}</p>
              )}
            </div>
          ))}
        </div>

        {editMode && (
          <button onClick={addScript} style={{ ...btnGhost, width: '100%', marginTop: 12 }}>+ Ajouter un texte</button>
        )}

        <p style={{ fontSize: 11, color: '#8b6f55', opacity: 0.7, textAlign: 'center', marginTop: 22, lineHeight: 1.5 }}>
          Page privée, visible uniquement sur ton compte. Tes textes sont sauvegardés sur cet appareil. Pour filmer : passe en plein écran et lance « Tout enchaîner ».
        </p>
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '14px 30px', borderRadius: 40, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #C9A96E, #b88a4f)', color: '#fff',
  fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: '.3px',
  boxShadow: '0 8px 22px rgba(196,149,106,.3)',
}
const btnStop: React.CSSProperties = {
  padding: '14px 30px', borderRadius: 40, border: '1px solid rgba(180,80,80,.4)', cursor: 'pointer',
  background: '#fff', color: '#8b3a3a', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 16,
}
const btnGhost: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 12, border: '1px solid rgba(196,149,106,0.35)', cursor: 'pointer',
  background: 'rgba(255,255,255,0.5)', color: '#8b5a3c', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13,
}
const btnPlaySmall: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
  background: 'rgba(196,149,106,0.15)', color: '#8b5a3c', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 12,
}
const sliderWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }
const sliderLbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8b6f55' }