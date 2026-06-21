'use client'

import Link from 'next/link'

export default function CGUPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E8E4DF', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/" style={{ fontSize: 12, color: '#6B6B6B', textDecoration: 'none', padding: '4px 12px', borderRadius: 20, border: '1px solid #E8E4DF', background: '#FAF7F2' }}>← Accueil</Link>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, color: '#D4A090' }}>NOVAÉ</span>
      </div>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* ── CGU ── */}
        <section style={{ marginBottom: 64 }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>
            Conditions Générales d'Utilisation
          </h1>
          <p style={{ fontSize: 12, color: '#6B6B6B', marginBottom: 40 }}>Dernière mise à jour : 26 avril 2026 · OMANAÏA — SIREN 100305218</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>1. Présentation de l'application</h2>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>
                NOVAÉ est une application de développement personnel proposée par OMANAÏA (SIREN 100305218), micro-entreprise française. L'application fournit des outils d'organisation personnelle, un programme structuré de 90 jours, un assistant IA, des modules de gestion des routines, recettes, famille et notes.
              </p>
            </article>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>2. Avertissement important — Guide, pas garantie</h2>
              <div style={{ background: 'rgba(196,149,106,0.08)', border: '1.5px solid rgba(196,149,106,0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
                <p style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.75, fontWeight: 500, margin: 0 }}>
                  NOVAÉ est un <strong>guide et outil d'accompagnement</strong>. Elle ne promet aucun résultat spécifique. Les résultats dépendent exclusivement de l'implication, de la régularité et des efforts personnels de l'utilisatrice. Aucune transformation ne peut être garantie sans engagement total de sa part.
                </p>
              </div>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>
                L'application ne se substitue en aucun cas à un suivi médical, psychologique, nutritionnel ou professionnel. En cas de difficulté de santé physique ou mentale, consultez un professionnel qualifié.
              </p>
            </article>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>3. Intelligence Artificielle — Disclaimer</h2>
              <div style={{ background: 'rgba(123,111,160,0.08)', border: '1.5px solid rgba(123,111,160,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
                <p style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.75, margin: 0 }}>
                  ⚠️ <strong>L'Agent NOVAÉ est une intelligence artificielle.</strong> Ses réponses sont générées automatiquement et ne constituent pas des conseils médicaux, psychologiques, juridiques ou financiers. L'IA peut commettre des erreurs. Ses suggestions ne remplacent pas l'avis d'un professionnel qualifié.
                </p>
              </div>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>
                Les alertes allergie, suggestions de recettes et analyses de planning sont fournies à titre indicatif uniquement. OMANAÏA ne saurait être tenue responsable des décisions prises sur la base des réponses de l'IA.
              </p>
            </article>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>4. Accès et compte utilisateur</h2>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>
                L'accès à NOVAÉ nécessite la création d'un compte. L'utilisatrice est responsable de la confidentialité de ses identifiants. NOVAÉ est réservée aux personnes majeures (18 ans ou plus). En vous inscrivant, vous confirmez avoir lu et accepté les présentes CGU ainsi que notre Politique de Confidentialité.
              </p>
            </article>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>5. Tarification</h2>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>
                L'application est actuellement en phase bêta gratuite. Au lancement officiel, un abonnement mensuel de <strong>7,99€/mois</strong> sera proposé. Les utilisatrices bêta seront informées en avance et bénéficieront d'un tarif préférentiel. OMANAÏA se réserve le droit de modifier les tarifs avec un préavis de 30 jours.
              </p>
            </article>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>6. Propriété intellectuelle</h2>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>
                Tous les contenus de l'application (textes, design, Reset 90 jours, méthodologie) sont la propriété exclusive d'OMANAÏA. Toute reproduction, modification ou redistribution sans autorisation est interdite.
              </p>
            </article>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>7. Limitation de responsabilité</h2>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>
                OMANAÏA ne peut être tenue responsable des dommages directs ou indirects résultant de l'utilisation de l'application, d'une interruption de service, d'erreurs dans les réponses de l'IA ou de la perte de données. L'application est fournie "en l'état".
              </p>
            </article>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>8. Droit applicable</h2>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>
                Les présentes CGU sont soumises au droit français. En cas de litige, les parties tenteront une résolution amiable avant tout recours judiciaire. Juridiction compétente : tribunaux français.
              </p>
            </article>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>9. Contact</h2>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>
                Pour toute question : <a href="mailto:contact@novae-by-omanaia.com" style={{ color: '#C4956A' }}>contact@novae-by-omanaia.com</a><br />
                OMANAÏA — SIREN 100305218 — France
              </p>
            </article>

          </div>
        </section>

        {/* ── POLITIQUE DE CONFIDENTIALITÉ ── */}
        <section>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>
            Politique de Confidentialité
          </h1>
          <p style={{ fontSize: 12, color: '#6B6B6B', marginBottom: 40 }}>Conforme RGPD · Dernière mise à jour : 26 avril 2026</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>1. Données collectées</h2>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>Nous collectons les données suivantes :</p>
              <ul style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 2, paddingLeft: 20, marginTop: 8 }}>
                <li><strong>Compte :</strong> adresse email, prénom/pseudo</li>
                <li><strong>Utilisation :</strong> tâches, routines, recettes, notes, données famille (allergies, anniversaires)</li>
                <li><strong>Programme :</strong> progression 90 jours, réponses au profil psychologique</li>
                <li><strong>Technique :</strong> logs de connexion, type d'appareil</li>
              </ul>
            </article>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>2. Utilisation des données</h2>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>
                Vos données sont utilisées exclusivement pour faire fonctionner l'application et personnaliser votre expérience. Elles sont stockées sur Supabase (serveurs européens). Elles ne sont jamais vendues ni partagées avec des tiers à des fins commerciales.
              </p>
            </article>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>3. Intelligence Artificielle et données</h2>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>
                L'Agent IA accède à vos données de l'application (tâches, routines, recettes, famille) pour personnaliser ses réponses. Ces données sont envoyées à l'API Anthropic (Claude) pour traitement. Anthropic s'engage à ne pas utiliser ces données pour entraîner ses modèles. Consultez la <a href="https://www.anthropic.com/privacy" target="_blank" style={{ color: '#C4956A' }}>politique de confidentialité d'Anthropic</a>.
              </p>
            </article>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>4. Vos droits (RGPD)</h2>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>Conformément au RGPD, vous disposez des droits suivants :</p>
              <ul style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 2, paddingLeft: 20, marginTop: 8 }}>
                <li><strong>Accès :</strong> obtenir une copie de vos données</li>
                <li><strong>Rectification :</strong> corriger vos données</li>
                <li><strong>Suppression :</strong> demander la suppression de votre compte et données</li>
                <li><strong>Portabilité :</strong> recevoir vos données dans un format lisible</li>
                <li><strong>Opposition :</strong> vous opposer au traitement de vos données</li>
              </ul>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75, marginTop: 12 }}>
                Pour exercer ces droits : <a href="mailto:contact@novae-by-omanaia.com" style={{ color: '#C4956A' }}>contact@novae-by-omanaia.com</a>
              </p>
            </article>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>5. Cookies et stockage local</h2>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>
                NOVAÉ utilise le stockage local (localStorage) de votre navigateur pour sauvegarder vos préférences d'interface. Aucun cookie publicitaire n'est utilisé. Aucune publicité n'est diffusée dans l'application.
              </p>
            </article>

            <article>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>6. Conservation des données</h2>
              <p style={{ fontSize: 14, color: '#4A4A4A', lineHeight: 1.75 }}>
                Vos données sont conservées tant que votre compte est actif. En cas de suppression de compte, toutes vos données sont supprimées dans un délai de 30 jours.
              </p>
            </article>

          </div>
        </section>

        <div style={{ marginTop: 48, padding: '20px', background: 'white', borderRadius: 12, border: '1px solid #E8E4DF', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#6B6B6B', margin: '0 0 12px' }}>Des questions sur vos données ?</p>
          <a href="mailto:contact@novae-by-omanaia.com" style={{ fontSize: 13, color: '#C4956A', fontWeight: 500 }}>contact@novae-by-omanaia.com</a>
        </div>

      </main>
    </div>
  )
}