'use client'

import { useMemo, useState } from 'react'

type NovaeValueIntroProps = {
  onDone: () => void
}

const C = {
  cream: '#FBF7F1',
  surface: '#FFFDFC',
  bordeaux: '#6E1F3D',
  bordeaux2: '#8A3455',
  gold: '#C4956A',
  goldSoft: '#EAD7C2',
  rose: '#F4E3E6',
  rose2: '#F8ECE9',
  taupe: '#6D625D',
  text: '#352E2B',
  line: '#E8D9CF',
}

function Dots({ active }: { active: number }) {
  return (
    <div className="v3-dots" aria-label={`Étape ${active + 1} sur 5`}>
      {[0, 1, 2, 3, 4].map(index => (
        <span key={index} className={index === active ? 'active' : ''} />
      ))}
    </div>
  )
}

export function NovaeValueIntro({ onDone }: NovaeValueIntroProps) {
  const [slide, setSlide] = useState(0)
  const isLast = slide === 4
  const label = useMemo(() => `Découverte ${slide + 1} sur 5`, [slide])

  const next = () => {
    if (isLast) onDone()
    else setSlide(current => Math.min(4, current + 1))
  }

  return (
    <main className="v3-root">
      <section className="v3-shell">
        <header className="v3-header">
          <div className="v3-brand">NOVAÉ</div>
          <button type="button" onClick={onDone}>Passer la découverte</button>
        </header>

        <div className="v3-progress">
          <span style={{ width: `${((slide + 1) / 5) * 100}%` }} />
        </div>

        <div className="v3-stage" aria-label={label}>
          {slide === 0 && (
            <article className="v3-slide">
              <p className="v3-kicker">TON QUOTIDIEN, PAS UNE VIE THÉORIQUE</p>
              <h1>NOVAÉ s’adapte à <em>ta vraie vie.</em></h1>
              <p className="v3-lead">
                Seule, en couple, parent solo, avec ou sans enfants : Nova utilise
                les repères que tu choisis de lui donner pour adapter son aide à
                ton quotidien réel.
              </p>
              <div className="v3-grid">
                <div><b>Ta situation</b><span>Qui partage ton quotidien.</span></div>
                <div><b>Ton rythme</b><span>Travail, rendez-vous, contraintes.</span></div>
                <div><b>Enfants & garde</b><span>Quand leur présence change l’organisation.</span></div>
                <div><b>Tes repères</b><span>Lieux, trajets connus et préférences.</span></div>
              </div>
              <p className="v3-signature">Elle s’adapte à toi. Pas l’inverse.</p>
            </article>
          )}

          {slide === 1 && (
            <article className="v3-slide">
              <p className="v3-kicker">DU FLOU À UNE ACTION CONCRÈTE</p>
              <h1>Peu de temps, des courses à faire, <em>aucune idée pour ce soir ?</em></h1>
              <div className="v3-scenario">
                <div className="v3-user-message">
                  “J’ai peu de temps ce soir. Je dois faire des courses et je ne sais pas quoi préparer.”
                </div>
                <div className="v3-arrow">↓</div>
                <div className="v3-result-card">
                  <b>Nova peut proposer un repas rapide</b>
                  <span>Une idée adaptée à valider avant création.</span>
                </div>
                <div className="v3-result-card">
                  <b>Puis générer la liste de courses</b>
                  <span>Après ta validation, sans ressaisir les ingrédients.</span>
                </div>
              </div>
              <p className="v3-outcome">
                Tu sais quoi faire avant même de pousser ton caddie.
              </p>
            </article>
          )}

          {slide === 2 && (
            <article className="v3-slide">
              <p className="v3-kicker">ELLE T’AIDE À VOIR CE QUI NE COLLE PAS</p>
              <h1>Ton agenda dit oui. <em>La vraie vie, parfois non.</em></h1>
              <p className="v3-lead">
                Quand Nova connaît tes horaires et un temps de trajet, elle peut
                vérifier si deux engagements s’enchaînent réellement.
              </p>
              <div className="v3-timeline">
                <div className="v3-time"><strong>17:00</strong><span>Fin du travail</span></div>
                <div className="v3-travel">Trajet connu : 30 min</div>
                <div className="v3-time"><strong>17:30</strong><span>Récupérer les enfants</span></div>
                <div className="v3-alert">
                  <b>Ça ne passe pas tel quel.</b>
                  <span>Nova peut te le signaler et t’aider à ajuster ton départ ou ton organisation.</span>
                </div>
              </div>
            </article>
          )}

          {slide === 3 && (
            <article className="v3-slide">
              <p className="v3-kicker">ET BIEN PLUS…</p>
              <h1>NOVAÉ, ton app <em>contre la charge mentale.</em></h1>
              <p className="v3-lead">
                Vie pro, vie perso, repas, courses, rappels, notes, documents,
                routines et entourage : tout se retrouve dans un même espace,
                avec Nova comme point d’entrée.
              </p>
              <div className="v3-feature-list">
                <div><span>01</span><b>Planifier ton quotidien selon ta vraie vie</b></div>
                <div><span>02</span><b>T’aider avec repas, courses, rappels et documents</b></div>
                <div><span>03</span><b>Te signaler quand deux moments s’enchaînent mal</b></div>
                <div><span>04</span><b>Transformer certaines demandes en actions après validation</b></div>
              </div>
            </article>
          )}

          {slide === 4 && (
            <article className="v3-slide v3-final">
              <p className="v3-kicker">TON ESPACE COMMENCE ICI</p>
              <h1>Commence dès maintenant et <em>découvre tout ce que NOVAÉ peut faire pour toi.</em></h1>
              <p className="v3-lead">
                Avant de te laisser explorer l’app, quelques questions suffisent
                pour donner à Nova les repères de base : ta situation, ton rythme,
                tes priorités et l’ambiance qui te ressemble.
              </p>
              <div className="v3-final-box">
                <span>Quelques minutes maintenant</span>
                <strong>pour éviter de devoir tout reconfigurer plus tard.</strong>
              </div>
            </article>
          )}
        </div>

        <footer className="v3-footer">
          <Dots active={slide} />
          <div className="v3-actions">
            <button
              type="button"
              className="v3-back"
              disabled={slide === 0}
              onClick={() => setSlide(current => Math.max(0, current - 1))}
            >
              Retour
            </button>
            <button type="button" className="v3-next" onClick={next}>
              {isLast ? 'Configurer mon espace' : 'Continuer'} <span>→</span>
            </button>
          </div>
        </footer>
      </section>

      <style>{`
        .v3-root {
          min-height: 100dvh;
          padding: max(18px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom));
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 8% 8%, rgba(196,149,106,.13), transparent 30%),
            radial-gradient(circle at 92% 88%, rgba(110,31,61,.08), transparent 34%),
            ${C.cream};
          color: ${C.text};
          font-family: var(--novae-font-body, Inter, system-ui, sans-serif);
        }
        .v3-shell {
          width: min(100%, 920px);
          min-height: min(780px, calc(100dvh - 36px));
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid ${C.line};
          border-radius: 30px;
          background: rgba(255,253,252,.94);
          box-shadow: 0 26px 80px rgba(74,47,38,.12);
        }
        .v3-header {
          min-height: 70px;
          padding: 18px clamp(18px,4vw,40px) 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .v3-brand {
          color: ${C.gold};
          font-family: var(--novae-font-title, Georgia, serif);
          letter-spacing: .26em;
          font-size: 18px;
          font-weight: 600;
        }
        .v3-header button {
          min-height: 44px;
          border: 0;
          background: transparent;
          color: ${C.taupe};
          cursor: pointer;
        }
        .v3-progress { height: 2px; background: ${C.goldSoft}; }
        .v3-progress span {
          display: block;
          height: 100%;
          background: linear-gradient(90deg, ${C.gold}, ${C.bordeaux});
          transition: width .25s ease;
        }
        .v3-stage {
          flex: 1;
          display: grid;
          align-items: center;
          padding: clamp(24px,5vw,52px) clamp(20px,7vw,74px) 24px;
        }
        .v3-slide { width: min(100%,720px); margin: 0 auto; animation: v3in .25s ease; }
        .v3-kicker {
          margin: 0 0 14px;
          color: ${C.gold};
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .17em;
        }
        .v3-slide h1 {
          margin: 0;
          color: ${C.bordeaux};
          font-family: var(--novae-font-title, Georgia, serif);
          font-size: clamp(40px,6vw,66px);
          line-height: .99;
          font-weight: 600;
          letter-spacing: -.025em;
        }
        .v3-slide h1 em { display:block; margin-top:5px; color:${C.gold}; font-style:normal; }
        .v3-lead {
          max-width: 650px;
          margin: 22px 0 0;
          color: ${C.taupe};
          font-size: clamp(15px,2vw,18px);
          line-height: 1.65;
        }
        .v3-grid {
          margin-top: 28px;
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
        }
        .v3-grid > div, .v3-result-card, .v3-time, .v3-feature-list > div, .v3-final-box {
          border:1px solid ${C.line};
          border-radius:18px;
          background:${C.surface};
        }
        .v3-grid > div { padding:16px; display:grid; gap:5px; }
        .v3-grid b, .v3-result-card b, .v3-feature-list b, .v3-final-box strong { color:${C.bordeaux}; }
        .v3-grid span, .v3-result-card span, .v3-alert span { color:${C.taupe}; font-size:12px; line-height:1.5; }
        .v3-signature { margin-top:20px; color:${C.bordeaux}; font-family:var(--novae-font-title, Georgia, serif); font-size:20px; }
        .v3-scenario { margin-top:26px; }
        .v3-user-message { padding:17px 18px; border-radius:18px; background:${C.rose2}; line-height:1.5; }
        .v3-arrow { text-align:center; color:${C.gold}; padding:8px 0; font-size:20px; }
        .v3-result-card { margin-bottom:9px; padding:15px 17px; display:grid; gap:4px; }
        .v3-outcome { margin-top:14px; padding:14px 16px; border-radius:16px; background:${C.bordeaux}; color:white; }
        .v3-timeline { margin-top:26px; }
        .v3-time { padding:15px 17px; display:grid; grid-template-columns:70px 1fr; gap:12px; align-items:center; }
        .v3-time strong { color:${C.gold}; font-size:17px; }
        .v3-time span { color:${C.bordeaux}; font-weight:800; }
        .v3-travel { min-height:58px; margin-left:34px; padding-left:34px; display:flex; align-items:center; border-left:1px dashed ${C.gold}; color:${C.taupe}; font-size:12px; }
        .v3-alert { margin-top:13px; padding:15px 17px; border:1px solid rgba(110,31,61,.16); border-radius:18px; background:${C.rose}; display:grid; gap:5px; }
        .v3-alert b { color:${C.bordeaux}; }
        .v3-feature-list { margin-top:28px; display:grid; gap:10px; }
        .v3-feature-list > div { padding:14px 16px; display:grid; grid-template-columns:38px 1fr; align-items:center; gap:12px; }
        .v3-feature-list span { color:${C.gold}; font-size:11px; font-weight:900; }
        .v3-final-box { margin-top:26px; padding:18px; display:grid; gap:5px; background:${C.rose2}; }
        .v3-final-box span { color:${C.taupe}; font-size:12px; }
        .v3-final-box strong { font-family:var(--novae-font-title, Georgia, serif); font-size:21px; }
        .v3-footer { padding:12px clamp(18px,4vw,40px) 22px; }
        .v3-dots { display:flex; justify-content:center; gap:7px; margin-bottom:16px; }
        .v3-dots span { width:7px; height:7px; border-radius:999px; background:${C.goldSoft}; }
        .v3-dots span.active { width:24px; background:${C.bordeaux}; }
        .v3-actions { display:flex; gap:10px; }
        .v3-back,.v3-next { min-height:50px; border-radius:16px; font:inherit; font-weight:800; cursor:pointer; }
        .v3-back { width:110px; border:1px solid ${C.line}; background:transparent; color:${C.taupe}; }
        .v3-back:disabled { opacity:0; pointer-events:none; }
        .v3-next { flex:1; border:0; background:linear-gradient(135deg,${C.bordeaux},${C.bordeaux2}); color:white; box-shadow:0 10px 28px rgba(110,31,61,.19); }
        .v3-next span { color:${C.goldSoft}; margin-left:8px; }
        @keyframes v3in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @media(max-width:640px){
          .v3-root{padding:0;place-items:stretch}
          .v3-shell{min-height:100dvh;border:0;border-radius:0;box-shadow:none}
          .v3-stage{padding:24px 18px 18px}
          .v3-slide h1{font-size:clamp(37px,11vw,52px)}
        }
        @media(max-width:390px){
          .v3-grid{grid-template-columns:1fr}
          .v3-slide h1{font-size:36px}
          .v3-lead{font-size:14px}
        }
        @media(prefers-reduced-motion:reduce){.v3-slide,.v3-progress span{animation:none;transition:none}}
      `}</style>
    </main>
  )
}
