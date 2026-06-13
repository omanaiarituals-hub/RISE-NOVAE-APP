'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

const C = {
  cream: '#FAF7F2', rose: '#C4956A', noir: '#2C2C2C',
  gris: '#6B6B6B', grisClair: '#E8E4DF', blanc: '#FFFFFF',
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: C.noir, margin: '32px 0 10px', borderBottom: `1px solid ${C.grisClair}`, paddingBottom: 8 }}>{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, color: C.gris, lineHeight: 1.7, margin: '0 0 12px' }}>{children}</p>
}

export default function ConfidentialitePage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 60px' }}>

        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, fontSize: 12, color: C.gris, background: 'rgba(44,44,44,0.05)', border: 'none', borderRadius: 20, padding: '6px 14px', cursor: 'pointer' }}>
          <ArrowLeft size={13} /> Retour
        </button>

        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.rose, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 6px' }}>OMANAÏA</p>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, color: C.noir, margin: '0 0 8px' }}>Politique de Confidentialité</h1>
          <p style={{ fontSize: 12, color: C.gris }}>Dernière mise à jour : avril 2026 · Conforme RGPD</p>
        </div>

        <div style={{ background: C.blanc, borderRadius: 16, padding: '24px 28px', boxShadow: '0 2px 12px rgba(44,44,44,0.05)' }}>

          <H2>1 — Identité du responsable de traitement</H2>
          <P>Le responsable du traitement des données personnelles collectées via l'Application RISE NOVAÉ est :</P>
          <P><strong>OMANAÏA</strong> — Micro-entreprise<br />
          SIREN : 100305218<br />
          78 Avenue des Champs-Élysées, Bureau 326, 75008 Paris, France<br />
          Représentant légal : SEDIRI Nesserine<br />
          Contact DPO : contact@omanaia.com</P>

          <H2>2 — Données collectées</H2>
          <P>Dans le cadre de l'utilisation de l'Application, nous collectons les données suivantes :</P>
          <P><strong>Données d'identification :</strong> adresse email, pseudo choisi par l'utilisateur.</P>
          <P><strong>Données de progression personnelle :</strong> routines créées, missions complétées, réflexions et intentions journalières, habitudes suivies, planification des repas.</P>
          <P><strong>Données de planification :</strong> événements du calendrier, tâches, liste de courses.</P>
          <P><strong>Données techniques :</strong> adresse IP, type de navigateur, système d'exploitation, date et heure de connexion, identifiant de session.</P>
          <P>Nous ne collectons pas de données sensibles au sens de l'article 9 du RGPD (santé, origine ethnique, opinions politiques, etc.).</P>

          <H2>3 — Finalités et bases légales du traitement</H2>
          <P><strong>Fourniture du service (base : exécution du contrat) :</strong> création et gestion de votre compte, synchronisation de vos données entre appareils, fonctionnement des modules de l'Application.</P>
          <P><strong>Amélioration du service (base : intérêt légitime) :</strong> analyse agrégée et anonymisée des usages pour améliorer les fonctionnalités. Aucune donnée personnelle identifiable n'est utilisée à cette fin.</P>
          <P><strong>Obligations légales (base : obligation légale) :</strong> conservation des données requises par la loi française.</P>
          <P>Nous n'utilisons pas vos données à des fins publicitaires et ne les vendons jamais à des tiers.</P>

          <H2>4 — Durée de conservation</H2>
          <P>Les données de compte sont conservées pendant toute la durée d'activité du compte et supprimées dans un délai de 30 jours suivant la demande de suppression du compte.</P>
          <P>Les données de navigation sont conservées 12 mois maximum.</P>
          <P>Les données de facturation (le cas échéant) sont conservées 10 ans conformément aux obligations comptables françaises.</P>

          <H2>5 — Destinataires des données</H2>
          <P>Vos données sont hébergées et traitées par les sous-traitants suivants, soigneusement sélectionnés pour leur conformité RGPD :</P>
          <P><strong>Supabase Inc.</strong> (base de données et authentification) — serveurs en Union Européenne — conforme RGPD.</P>
          <P><strong>Vercel Inc.</strong> (hébergement de l'application) — conforme RGPD avec clauses contractuelles types.</P>
          <P><strong>Anthropic PBC</strong> (intelligence artificielle — module Agent NOVAÉ) — les messages envoyés à l'agent sont traités conformément à la politique de confidentialité d'Anthropic. Aucun message n'est stocké sans votre consentement explicite.</P>
          <li><strong>Brevo</strong> (France) — emails transactionnels et
  newsletter. Données : email, prénom, engagement. Hébergé en UE.</li>
 
  <li><strong>Stripe</strong> (Irlande) — paiements sécurisés.
  Données : email, carte bancaire (jamais stockée par nos soins),
  abonnement.</li>
          <P>Aucune donnée n'est transférée à des fins commerciales à des tiers.</P>

          <H2>6 — Vos droits</H2>
          <P>Conformément au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679) et à la loi Informatique et Libertés, vous disposez des droits suivants :</P>
          <P>• <strong>Droit d'accès</strong> : obtenir une copie de vos données personnelles</P>
          <P>• <strong>Droit de rectification</strong> : corriger des données inexactes</P>
          <P>• <strong>Droit à l'effacement</strong> : demander la suppression de vos données (« droit à l'oubli »)</P>
          <P>• <strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</P>
          <P>• <strong>Droit d'opposition</strong> : s'opposer au traitement de vos données</P>
          <P>• <strong>Droit à la limitation</strong> : demander la restriction du traitement</P>
          <P>Pour exercer ces droits, contactez-nous à : <strong>contact@omanaia.com</strong></P>
          <P>Vous disposez également du droit d'introduire une réclamation auprès de la <strong>CNIL</strong> (Commission Nationale de l'Informatique et des Libertés) : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: C.rose }}>www.cnil.fr</a></P>

          <H2>7 — Sécurité des données</H2>
          <P>Nous mettons en œuvre les mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction :</P>
          <P>• Chiffrement des communications (HTTPS/TLS)</P>
          <P>• Chiffrement des mots de passe (bcrypt via Supabase Auth)</P>
          <P>• Authentification sécurisée avec tokens JWT</P>
          <P>• Politiques d'accès Row Level Security (RLS) sur la base de données</P>
          <P>• Accès aux données strictement limité au personnel autorisé</P>

          <H2>8 — Cookies et traceurs</H2>
          <P>L'Application utilise uniquement des cookies strictement nécessaires au fonctionnement du service (session d'authentification). Aucun cookie publicitaire ou de suivi tiers n'est utilisé.</P>

          <H2>9 — Modifications de cette politique</H2>
          <P>Nous nous réservons le droit de modifier la présente politique à tout moment. En cas de modification substantielle, vous serez informé par une notification dans l'Application au moins 15 jours avant l'entrée en vigueur des nouvelles dispositions.</P>

          <H2>10 — Contact</H2>
          <P>Pour toute question relative à la protection de vos données personnelles :<br />
          Email : contact@omanaia.com<br />
          Courrier : OMANAÏA, 78 Avenue des Champs-Élysées, Bureau 326, 75008 Paris</P>

        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: C.gris, opacity: 0.5 }}>
          OMANAÏA — SIREN 100305218 · 78 Av. des Champs-Élysées, Bureau 326, 75008 Paris
        </p>
      </div>
    </div>
  )
}