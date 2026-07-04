// src/app/demo/page.tsx
// CORRECTIF (audit 02/07/2026) : cette page était un tunnel de démo
// pré-lancement (249 lignes) orphelin — aucun lien dans l'app ne pointait
// vers /demo, uniquement accessible par URL directe. Elle promettait un
// "accès gratuit pendant toute la bêta", un tarif à "7,99€/mois" (le vrai
// est 7,90€) et un badge "Fondatrice", alors que l'app est en production
// avec de vraies clientes payantes depuis des mois. Une visiteuse tombant
// dessus pourrait légitimement réclamer des avantages qui n'existent plus.
//
// Choix : redirection plutôt que suppression du fichier, pour rester
// réversible. Le contenu original (visite guidée des 8 modules) est bon
// et pourrait être recyclé en tour produit post-inscription avec des
// chiffres à jour — dis-moi si tu veux que je prépare cette version.
import { redirect } from 'next/navigation'

export default function DemoPage() {
  redirect('/subscribe')
}
