// src/lib/proverbes.ts
// 90 proverbes motivants — un par jour de programme
// Le proverbe affiché dépend du jour de l'année (rotation auto)

export const PROVERBES_QUOTIDIENS: string[] = [
  "La discipline d'aujourd'hui est la liberté de demain.",
  "Chaque petit pas compte plus que le grand saut.",
  "Tu n'as pas besoin de te motiver. Tu as besoin de commencer.",
  "Le progrès, pas la perfection.",
  "Une action simple aujourd'hui change tout demain.",
  "Tu avances plus que tu ne le crois.",
  "Ce que tu fais chaque jour compte plus que ce que tu fais de temps en temps.",
  "La régularité bat l'intensité.",
  "Le temps que tu y consacres aujourd'hui te sera rendu demain.",
  "Devenir, c'est accepter de ne plus être ce que tu étais.",
  "Tu n'es pas en retard. Tu es exactement là où il faut être.",
  "Le silence intérieur est le terrain de tes plus grandes victoires.",
  "Ta seule compétition, c'est la version d'hier de toi-même.",
  "La paix vient quand on cesse de fuir.",
  "Ce que tu nourris grandit. Choisis bien.",
  "Les graines qu'on plante dans la patience donnent les plus belles récoltes.",
  "La constance crée des miracles que la passion ne peut pas créer.",
  "Tu n'as rien à prouver. Juste à devenir.",
  "Avance même quand tu ne vois pas le chemin entier.",
  "La clarté vient en marchant, pas en réfléchissant.",
  "Ton énergie est ta plus grande monnaie. Investis-la avec soin.",
  "Ce qui te ressemble te trouvera. Reste fidèle à toi.",
  "Le bonheur n'est pas un but, c'est une direction.",
  "Tu es la somme de tes habitudes, pas de tes intentions.",
  "Chaque non est un oui à autre chose.",
  "Les saisons passent en toi aussi. Sois patiente avec ton hiver.",
  "Ce que tu cherches te cherche aussi.",
  "Choisis tes batailles. Toutes ne méritent pas ton énergie.",
  "Le repos est productif quand il est intentionnel.",
  "Tu n'es pas obligée de tout comprendre pour avancer.",
  "Phase 2 commence. Tu es plus solide qu'au jour 1.",
  "Le rythme bat la performance.",
  "Faire bien dépasse faire vite.",
  "L'action est le meilleur antidote au doute.",
  "Tu deviens ce que tu pratiques.",
  "Le plus dur n'est pas de commencer, c'est de continuer.",
  "Ce qui ne te défie pas ne te transforme pas.",
  "Garde ton calme dans le bruit du monde.",
  "Tes limites sont des invitations à grandir.",
  "Tu mérites les efforts que tu fais pour toi.",
  "L'ordre extérieur naît de la paix intérieure.",
  "Avance avec douceur. La force vient avec.",
  "Ton avenir est dans tes choix d'aujourd'hui.",
  "Sois la femme dont la fillette de 8 ans rêvait.",
  "Le doute est un signe que tu sors de ta zone de confort.",
  "Tu peux faire dur ET être douce. Les deux à la fois.",
  "L'audace appelle l'audace.",
  "Une vie alignée vaut plus qu'une vie réussie.",
  "Tes peurs grandissent quand tu les évites.",
  "Le calme est une forme de victoire.",
  "Tu n'es pas en retard sur ta vie.",
  "Ce que tu honores te revient.",
  "Avance même si c'est imparfait. Surtout si c'est imparfait.",
  "Ton intuition n'a pas besoin de preuve.",
  "Donne-toi la permission de prendre ta place.",
  "Le bon moment, c'est maintenant.",
  "Tu es autorisée à recommencer autant de fois que nécessaire.",
  "La répétition est la mère du changement.",
  "Tu n'as pas à être prête. Tu as à être présente.",
  "L'élan se construit, il ne s'attend pas.",
  "Phase 3. Tu n'es plus la même qu'au début. C'est ça la victoire.",
  "Ce que tu rayonnes, tu l'attires.",
  "Le succès est la conséquence d'une discipline silencieuse.",
  "Tu es le projet le plus important de ta vie.",
  "Ton temps a plus de valeur que ton argent.",
  "L'expansion demande de lâcher l'ancien.",
  "Sois la première à croire en toi.",
  "La confiance vient en faisant, pas en attendant.",
  "Tu construis aujourd'hui ce que tu vivras demain.",
  "Le monde s'adapte aux gens qui s'engagent.",
  "Ne laisse pas tes peurs décider à ta place.",
  "L'abondance commence par la gratitude.",
  "Chaque jour mérite ta pleine présence.",
  "Tu n'es pas faite pour être ordinaire.",
  "La vraie liberté, c'est de ne plus avoir besoin de l'approbation des autres.",
  "Le succès se cache dans la routine que personne ne voit.",
  "Ton intention guide ta réalité.",
  "Tu peux choisir, à chaque seconde, qui tu deviens.",
  "Honore tes promesses envers toi-même en premier.",
  "L'élégance, c'est savoir refuser ce qui n'est plus pour soi.",
  "Tu n'es pas trop, tu n'es pas trop peu. Tu es juste.",
  "Ce que tu acceptes définit ce que tu reçois.",
  "Le silence parle plus fort que la justification.",
  "Tu es la preuve vivante que c'était possible.",
  "Les vrais changements se voient dans la durée.",
  "Tu mérites une vie qui te ressemble vraiment.",
  "Ce que tu as construit en 90 jours, personne ne peut te le reprendre.",
  "Le commencement contient déjà la fin. Choisis bien.",
  "Tu ne reviens pas en arrière. Tu es devenue.",
  "L'expansion continue. Le programme finit, pas la transformation.",
  "Tu es exactement la personne que tu attendais."
]

/**
 * Retourne le proverbe du jour en se basant sur le numéro du jour
 * dans l'année (rotation déterministe : tous les utilisateurs voient
 * le même proverbe le même jour)
 */
export function getProverbeDuJour(): string {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  return PROVERBES_QUOTIDIENS[dayOfYear % PROVERBES_QUOTIDIENS.length]
}

/**
 * Variante : proverbe en fonction du jour du programme 90j
 * (utile pour aligner le ton au stade : phase 1 doux, phase 3 ambitieux)
 */
export function getProverbeDuJourProgramme(jourProgramme: number): string {
  if (jourProgramme < 1) return PROVERBES_QUOTIDIENS[0]
  return PROVERBES_QUOTIDIENS[(jourProgramme - 1) % PROVERBES_QUOTIDIENS.length]
}