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

export default function CGUPage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 60px' }}>

        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, fontSize: 12, color: C.gris, background: 'rgba(44,44,44,0.05)', border: 'none', borderRadius: 20, padding: '6px 14px', cursor: 'pointer' }}>
          <ArrowLeft size={13} /> Retour
        </button>

        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.rose, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 6px' }}>OMANAÏA</p>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, color: C.noir, margin: '0 0 8px' }}>Conditions Générales d'Utilisation</h1>
          <p style={{ fontSize: 12, color: C.gris }}>Dernière mise à jour : avril 2026 · Version 1.0</p>
        </div>

        <div style={{ background: C.blanc, borderRadius: 16, padding: '24px 28px', boxShadow: '0 2px 12px rgba(44,44,44,0.05)' }}>

          <H2>Article 1 — Présentation de l'application</H2>
          <P>L'application RISE NOVAÉ (ci-après « l'Application ») est éditée par OMANAÏA, micro-entreprise immatriculée au Registre National des Entreprises sous le numéro SIREN 100305218, dont le siège social est situé au 78 Avenue des Champs-Élysées, Bureau 326, 75008 Paris, France.</P>
          <P>Responsable de publication : SEDIRI Nesserine</P>
          <P>Contact : contact@omanaia.com</P>
          <P>L'Application RISE NOVAÉ est un outil de développement personnel permettant à ses utilisateurs de suivre leurs routines, planifier leur quotidien, suivre un programme de transformation sur 90 jours et gérer leur alimentation.</P>

          <H2>Article 2 — Acceptation des conditions</H2>
          <P>L'utilisation de l'Application implique l'acceptation pleine et entière des présentes Conditions Générales d'Utilisation (CGU). Si vous n'acceptez pas ces conditions, vous devez cesser immédiatement d'utiliser l'Application.</P>
          <P>Ces CGU peuvent être modifiées à tout moment. Les utilisateurs seront informés de toute modification substantielle par notification dans l'Application. La poursuite de l'utilisation vaut acceptation des nouvelles conditions.</P>

          <H2>Article 3 — Accès et inscription</H2>
          <P>L'accès à l'Application nécessite la création d'un compte personnel avec une adresse email valide et un mot de passe sécurisé. L'utilisateur s'engage à fournir des informations exactes et à maintenir la confidentialité de ses identifiants.</P>
          <P>Toute activité effectuée depuis votre compte est sous votre responsabilité. En cas de perte ou de compromission de vos identifiants, vous devez nous en informer sans délai.</P>
          <P>L'Application est destinée aux personnes âgées de 18 ans et plus.</P>

          <H2>Article 4 — Description des services</H2>
          <P>L'Application propose les fonctionnalités suivantes :</P>
          <P>• Programme de transformation personnelle sur 90 jours structuré en 3 phases (Reprogrammation, Action/Discipline, Expansion)</P>
          <P>• Gestion des routines matin et soir avec suivi de progression</P>
          <P>• Planificateur quotidien, hebdomadaire et mensuel</P>
          <P>• Suivi des habitudes et statistiques personnelles</P>
          <P>• Planification des repas et liste de courses</P>
          <P>• Agent conversationnel IA d'accompagnement</P>
          <P>• Espace famille et communautaire</P>

          <H2>Article 5 — Tarification</H2>
          <P>L'Application est actuellement proposée gratuitement dans le cadre d'une phase bêta ouverte à un nombre limité d'utilisateurs test.</P>
          <P>À l'issue de cette phase bêta, l'Application sera proposée en mode freemium avec une offre premium à 7,99€ par mois. Les utilisateurs bêta seront prévenus au moins 30 jours avant la fin de la gratuité.</P>
          <P>Les prix s'entendent TTC (TVA française applicable).</P>

          <H2>Article 6 — Obligations de l'utilisateur</H2>
          <P>L'utilisateur s'engage à :</P>
          <P>• Utiliser l'Application conformément à sa destination et aux présentes CGU</P>
          <P>• Ne pas utiliser l'Application à des fins illicites ou portant atteinte aux droits des tiers</P>
          <P>• Ne pas tenter de contourner les mesures de sécurité de l'Application</P>
          <P>• Ne pas reproduire, copier ou exploiter les contenus de l'Application sans autorisation</P>
          <P>• Signaler tout dysfonctionnement ou contenu inapproprié à contact@omanaia.com</P>

          <H2>Article 7 — Propriété intellectuelle</H2>
          <P>L'ensemble des éléments constituant l'Application (textes, graphiques, logiciels, méthodologies, programmes de transformation) est la propriété exclusive d'OMANAÏA et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.</P>
          <P>Toute reproduction, représentation, modification ou exploitation non autorisée est strictement interdite et constitue une contrefaçon.</P>

          <H2>Article 8 — Limitation de responsabilité</H2>
          <P>RISE NOVAÉ est un outil de soutien au développement personnel. Il ne constitue en aucun cas un substitut à un suivi médical, psychologique ou thérapeutique professionnel.</P>
          <P>OMANAÏA ne saurait être tenu responsable des dommages directs ou indirects résultant de l'utilisation ou de l'impossibilité d'utiliser l'Application, ni de l'interprétation des contenus par les utilisateurs.</P>

          <H2>Article 9 — Suspension et résiliation</H2>
          <P>OMANAÏA se réserve le droit de suspendre ou supprimer tout compte en cas de violation des présentes CGU, sans préavis ni indemnité.</P>
          <P>L'utilisateur peut supprimer son compte à tout moment depuis la section Paramètres de l'Application. La suppression entraîne l'effacement définitif de toutes les données personnelles dans un délai de 30 jours, conformément au RGPD.</P>

          <H2>Article 10 — Droit applicable et juridiction</H2>
          <P>Les présentes CGU sont soumises au droit français. En cas de litige, les parties s'efforceront de trouver une solution amiable. À défaut, les tribunaux compétents de Paris seront seuls compétents.</P>
          <P>Conformément aux articles L.616-1 et R.616-1 du code de la consommation, vous pouvez également recourir à un médiateur de la consommation.</P>

        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: C.gris, opacity: 0.5 }}>
          OMANAÏA — SIREN 100305218 · 78 Av. des Champs-Élysées, Bureau 326, 75008 Paris
        </p>
      </div>
    </div>
  )
}