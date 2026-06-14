// Contenu des articles du blog NOVAÉ.
// Pages publiques (SEO) servies par src/app/blog/[slug]/page.tsx
// Écrits à la première personne (le vécu de Ness, fondatrice).

export interface BlogArticle {
  slug: string
  tag: string
  readTime: string
  title: string
  excerpt: string
  image: string
  imageAlt: string
  date: string // ISO YYYY-MM-DD
  metaTitle: string
  metaDescription: string
  bodyHtml: string
  faq: { q: string; a: string }[]
}

const CTA = `
<div class="article-cta">
  <h3>C'est exactement pour ça que j'ai créé NOVAÉ</h3>
  <p>Un programme de 90 jours, une coach IA qui te connaît, et des outils que j'ai construits à partir des neurosciences et de la thérapie cognitive. Parce que j'en avais besoin moi-même, et que je ne l'ai trouvé nulle part.</p>
  <a class="article-cta-btn" href="https://app.novae-by-omanaia.com/signup">Essayer 14 jours gratuitement</a>
</div>`

export const blogArticles: BlogArticle[] = [
  {
    slug: 'charge-mentale-femmes',
    tag: 'Neurosciences',
    readTime: '5 min',
    title: 'Pourquoi tu réagis comme ça et ce que ton cerveau cache vraiment',
    excerpt:
      "Je criais pour rien, je me sentais nulle après, et je me demandais ce qui m'arrivait. Ce n'était pas moi. C'était la façon dont mon cerveau réagissait quand il portait trop.",
    image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=1200&q=80',
    imageAlt: 'Femme fatiguée par la charge mentale',
    date: '2026-06-14',
    metaTitle: 'Charge mentale : pourquoi tu réagis comme ça (et ce que ton cerveau cache) | NOVAÉ',
    metaDescription:
      "Je criais pour un rien puis je culpabilisais. Ce n'était pas un défaut de caractère. Voici ce que j'ai compris sur ce qui se passe dans le cerveau quand la charge mentale déborde, et comment je l'ai allégée.",
    bodyHtml: `
<p>Pendant longtemps, je criais sur mes filles pour une histoire de chaussures qui traînaient. Je répondais sèchement pour une question banale. Et dix minutes plus tard, je me sentais nulle. Je me disais que je n'étais pas à la hauteur, que les autres y arrivaient mieux que moi.</p>
<p>Le jour où j'ai compris ce qui se passait vraiment, ça m'a libérée d'un poids énorme. Parce que j'ai réalisé une chose que personne ne m'avait dite assez tôt : ce n'était pas moi le problème. C'était mon cerveau qui était saturé. Et ça, ça se comprend, ça s'explique, et surtout ça se change.</p>

<h2>J'ai découvert que la charge mentale n'est pas une impression</h2>
<p>Quand je gérais les repas, les rendez-vous, les devoirs, les courses, le linge, l'anniversaire à organiser et le mail à ne pas oublier, je n'étais pas juste "occupée". Mon cerveau gardait une dizaine d'onglets ouverts en permanence, même quand je ne faisais rien d'apparent.</p>
<p>La zone qui gère tout ça s'appelle le cortex préfrontal. C'est notre chef d'orchestre : il planifie, il priorise, il se retient de réagir à chaud. Mais j'ai appris qu'il a une limite physique. Sa mémoire de travail ne tient que quelques éléments à la fois. Quand je lui en demandais vingt en simultané, il ne devenait pas plus performant, il s'épuisait.</p>
<p>C'est pour ça que je me sentais vidée même un jour où je n'avais "rien fait de spécial". Rien de visible. Mais en interne, mon chef d'orchestre avait tourné à plein régime toute la journée.</p>

<h2>Pourquoi je craquais pour un rien</h2>
<p>J'ai compris que quand le cortex préfrontal est épuisé, il lâche les commandes. Et c'est une autre zone qui prend le relais : l'amygdale, notre système d'alerte. Elle est rapide, brutale, faite pour la survie, pas pour la nuance.</p>
<p>Donc la paire de chaussures qui traînait n'était jamais vraiment la cause de mon explosion. C'était la goutte de trop sur un système déjà au maximum. Mon cerveau passait en mode menace, et je réagissais avant même d'avoir réfléchi. Ce n'était pas un défaut de caractère. C'était de la biologie.</p>

<h2>Le vrai piège, pour moi, c'était la culpabilité d'après</h2>
<p>Voilà le moment le plus injuste. Après avoir réagi à chaud, je me jugeais. Je ruminais. Je m'en voulais. Et cette culpabilité, elle ne réparait rien : elle ajoutait encore de la charge sur un cerveau déjà à terre.</p>
<p>Je payais donc deux fois : une fois pour la fatigue, une fois pour le procès que je me faisais. C'est cette double peine que j'ai dû casser en premier.</p>

<h2>Ce qui m'a vraiment aidée</h2>
<p>Pas des injonctions à "lâcher prise" ou à "relativiser". Des choses concrètes, que j'ai testées sur moi et que la recherche valide.</p>
<p><strong>Sortir les onglets de ma tête.</strong> Tant qu'une tâche restait dans ma mémoire de travail, elle continuait de consommer de l'énergie. La poser noir sur blanc, quelque part de fiable, m'a littéralement libéré de la ressource mentale. Mon cerveau pouvait enfin relâcher la vigilance sur ce point.</p>
<p><strong>Nommer l'émotion au lieu de la subir.</strong> J'ai découvert qu'une étude de référence avait montré que mettre un mot sur ce qu'on ressent ("là je suis débordée", "là je suis en colère") calme l'amygdale. On appelle ça l'étiquetage affectif. Me dire "je suis à bout" était déjà un premier pas pour reprendre la main.</p>
<p><strong>Des micro-pauses, pas des grandes résolutions.</strong> Mon cerveau ne récupérait pas avec une promesse de week-end au spa dans trois semaines. Il récupérait avec deux minutes de vraie pause, plusieurs fois par jour. Moins glamour, mais c'est ce qui a marché pour moi.</p>
<p>Je n'avais pas un problème de volonté. J'avais un cerveau qui portait trop, depuis trop longtemps, sans système pour l'alléger. Le jour où j'ai compris ça, j'ai arrêté de me battre contre moi-même. Et j'ai commencé à me construire des outils. Si tu te reconnais, sache que toi non plus, ce n'est pas toi le problème.</p>
${CTA}
`,
    faq: [
      {
        q: "La charge mentale, c'est vraiment dans le cerveau ou c'est psychologique ?",
        a: "Les deux sont liés. La charge mentale correspond à une sollicitation continue du cortex préfrontal, la zone qui gère la planification et la priorisation. Sa capacité est limitée physiquement, donc la fatigue ressentie est réelle, pas une simple impression.",
      },
      {
        q: 'Pourquoi je réagis à chaud puis je culpabilise ?',
        a: "Quand le cortex préfrontal est saturé, l'amygdale prend le relais et déclenche des réactions rapides et émotionnelles. La culpabilité qui suit ajoute encore de la charge. Casser ce cycle commence par arrêter de se juger.",
      },
      {
        q: 'Comment alléger sa charge mentale concrètement ?',
        a: "Externaliser les tâches hors de sa tête, nommer ses émotions pour calmer le système d'alerte, et s'accorder de courtes pauses régulières plutôt que d'attendre un grand repos lointain.",
      },
    ],
  },

  {
    slug: 'motivation-neurosciences',
    tag: 'CBT',
    readTime: '4 min',
    title: "La motivation n'existe pas et c'est une bonne nouvelle",
    excerpt:
      "J'ai attendu des années d'être motivée avant d'agir. Et des années à me juger de ne pas l'être. La neuroscience m'a appris que j'avais tout faux.",
    image: 'https://images.unsplash.com/photo-1517960413843-0aee8e2b3285?w=1200&q=80',
    imageAlt: 'Femme face au lever du soleil, motivation',
    date: '2026-06-14',
    metaTitle: "La motivation n'existe pas : ce qui marche vraiment (neurosciences) | NOVAÉ",
    metaDescription:
      "J'ai attendu d'être motivée pour agir pendant des années. Voici ce que les neurosciences et la thérapie comportementale m'ont appris, et comment j'ai fini par passer à l'action sans attendre l'envie.",
    bodyHtml: `
<p>Pendant des années, j'ai attendu. J'attendais d'avoir l'énergie, l'envie, le déclic. Je me disais : quand je serai motivée, je m'y mettrai. Et comme le déclic ne venait pas, je me jugeais. Je me trouvais paresseuse, pas assez disciplinée, pas assez sérieuse.</p>
<p>Le jour où j'ai compris comment fonctionne vraiment la motivation, tout a changé pour moi. Parce que j'ai réalisé qu'on m'avait appris l'ordre des choses à l'envers.</p>

<h2>Le mensonge que je croyais dur comme fer</h2>
<p>On nous vend cette idée : d'abord la motivation, ensuite l'action. Tu attends d'avoir envie, puis tu agis. J'y ai cru pendant des années. Sauf que c'est faux dans l'immense majorité des cas. Et tant que j'y croyais, je restais bloquée à la première étape, à attendre une envie qui ne venait jamais.</p>

<h2>Ce que les neurosciences m'ont appris</h2>
<p>La motivation est largement portée par un neurotransmetteur, la dopamine. Or j'ai découvert que la dopamine ne monte pas en restant assise à espérer. Elle monte quand on commence, quand on avance, quand on perçoit une petite avancée concrète.</p>
<p>Autrement dit : l'action vient en premier, et l'envie suit. Je n'agissais pas parce que j'étais motivée. Je devenais motivée parce que j'avais commencé à agir. C'est exactement l'inverse de ce que je croyais.</p>
<p>Ça m'a aussi expliqué pourquoi les premières minutes étaient toujours les plus dures. Une fois lancée, je recevais la récompense chimique, et continuer devenait nettement plus facile.</p>

<h2>L'outil que j'ai emprunté à la thérapie comportementale</h2>
<p>En thérapie cognitive et comportementale, il existe un principe qui résume tout ça : l'activation comportementale. Le mouvement précède l'envie. On ne cherche pas à se sentir prête. On agit en petit, et l'état d'esprit suit.</p>
<p>Pour moi, la clé a été la taille du premier pas. Mon cerveau résistait à "je range toute la maison". Il ne résistait pas à "je range juste cette étagère". Je ne mettais pas mes baskets pour courir 10 km, je les mettais juste pour sortir devant chez moi. Le seul objectif du premier pas, c'était de démarrer le moteur.</p>

<h2>Ce que ça a changé pour moi</h2>
<p>Quand j'ai arrêté d'attendre la motivation, j'ai aussi arrêté de me juger de ne pas l'avoir. Je ne me demandais plus "est-ce que j'ai envie ?", je me demandais "quel est le plus petit pas possible, là, maintenant ?".</p>
<p>Je ne dépendais plus d'un état émotionnel imprévisible. Je m'appuyais sur un mécanisme fiable : commencer petit, recevoir l'élan, continuer. Moins romantique que "le déclic", mais c'est ce qui a tenu sur la durée.</p>
<p>La bonne nouvelle, donc, c'est celle-ci : je n'avais jamais manqué de motivation. J'attendais juste au mauvais endroit. Et l'envie, elle, m'attendait de l'autre côté du premier geste. La tienne aussi.</p>
${CTA}
`,
    faq: [
      {
        q: "Pourquoi je n'arrive pas à me motiver ?",
        a: "Parce que la motivation ne précède pas l'action, elle la suit. La dopamine, qui soutient la motivation, augmente quand on commence et qu'on perçoit une avancée, pas quand on attend d'avoir envie.",
      },
      {
        q: "Comment passer à l'action sans motivation ?",
        a: "En réduisant le premier pas à sa plus petite version possible. L'objectif n'est pas de tout faire, mais de démarrer. Une fois lancée, l'élan et l'envie suivent naturellement.",
      },
      {
        q: "C'est quoi l'activation comportementale ?",
        a: "Un principe de la thérapie cognitive et comportementale selon lequel le mouvement précède l'envie. On agit en petit d'abord, et l'état d'esprit positif suit le passage à l'action.",
      },
    ],
  },

  {
    slug: 'ruminations-vider-sa-tete',
    tag: 'Bien-être',
    readTime: '6 min',
    title: "Comment j'ai arrêté de tourner en rond dans ma tête",
    excerpt:
      "Les pensées qui revenaient en boucle à 23h, les scénarios que je rejouais cent fois. J'y étais. Voici ce que j'ai appris sur les ruminations et la technique qui m'a vraiment aidée.",
    image: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=1200&q=80',
    imageAlt: 'Femme qui se libère de ses pensées',
    date: '2026-06-14',
    metaTitle: "Ruminations : comment vider sa tête pour de vrai | NOVAÉ",
    metaDescription:
      "Les pensées en boucle m'épuisaient autant que les tâches. Voici ce que j'ai compris sur pourquoi mon cerveau ruminait surtout le soir, et la technique simple qui m'a vraiment aidée à poser tout ça.",
    bodyHtml: `
<p>Il est 23h. Je suis enfin allongée. Et là, mon cerveau décide que c'est le moment parfait pour rejouer la conversation de l'après-midi, anticiper la journée du lendemain, et me rappeler ce truc gênant que j'ai dit il y a trois ans.</p>
<p>Les pensées tournaient, revenaient, s'enchaînaient. Je savais que ça ne servait à rien, mais je n'arrivais pas à arrêter. J'y suis restée des mois. Voici ce que j'ai fini par comprendre.</p>

<h2>Pourquoi mon cerveau ruminait surtout le soir</h2>
<p>Dans la journée, j'étais occupée. Mon attention était tournée vers l'extérieur : les tâches, les gens, les écrans. Le soir, tout ça s'arrêtait. Et j'ai appris que le cerveau bascule alors sur un autre mode de fonctionnement, actif justement quand on ne fait rien de précis.</p>
<p>Ce mode adore une chose : ressasser. Repasser le passé, simuler le futur, tourner autour de ce qui n'est pas résolu. Ce n'était pas moi qui choisissais de ruminer à 23h. C'était mon cerveau qui, privé de stimulation extérieure, se rabattait sur ses boucles internes.</p>

<h2>La différence que j'ignorais : réfléchir n'est pas ruminer</h2>
<p>Réfléchir, ça avance vers une décision ou une action. Ruminer, ça tourne en rond sans jamais conclure. C'est la même pensée qui repasse, encore et encore, sans rien résoudre. J'ai mis du temps à voir que je faisais surtout la deuxième.</p>
<p>Et c'est épuisant. J'ai compris qu'une pensée en boucle consomme autant d'énergie qu'une vraie tâche, sauf qu'elle ne produit rien. Je me couchais déjà fatiguée, et je me réveillais sans avoir vraiment posé mon esprit.</p>

<h2>La technique qui m'a vraiment aidée</h2>
<p>Elle est simple, presque trop pour que j'y croie au début : écrire. Pas tenir un beau journal, pas faire de la littérature. Juste sortir ce qui tourne, sur le papier ou dans une note, sans filtre.</p>
<p>J'ai découvert les travaux du chercheur James Pennebaker, qui a passé des années à étudier l'écriture expressive. Son constat : poser ses pensées et ses émotions par écrit, même quelques minutes, réduit la rumination et apaise le mental. Le simple fait de transformer une pensée floue en mots structurés aide le cerveau à la traiter, puis à la lâcher.</p>
<p>Il y a une logique nette derrière, et elle m'a parlé tout de suite. Tant qu'une préoccupation reste dans ma tête, mon cerveau la maintient active, comme une alarme que je n'ai pas éteinte. La déposer quelque part de fiable, c'est dire à mon cerveau : "c'est noté, tu peux relâcher". Et il relâche.</p>

<h2>Comment je fais, concrètement</h2>
<p>Le soir, avant de me coucher, je vide ma tête. Tout ce qui tourne, je le pose : les tâches du lendemain, ce qui m'a contrariée, ce que je n'ai pas dit. Sans me relire, sans me corriger. L'objectif n'est pas le résultat, c'est la décharge.</p>
<p>Ce qui doit devenir une action, je le transforme en une vraie tâche, datée, hors de ma tête. Ce qui est juste une émotion, je la nomme et je la laisse là. Et ce qui revient quand même, je sais maintenant que c'est juste mon cerveau en mode boucle, pas une urgence à traiter à 23h.</p>
<p>Je ne peux pas empêcher les pensées d'arriver. Mais j'ai appris à leur donner un endroit où aller, autre que ma tête au moment de dormir. C'est ça qui m'a sortie du tourbillon. Et c'est ce que j'ai voulu transmettre dans NOVAÉ.</p>
${CTA}
`,
    faq: [
      {
        q: 'Pourquoi je rumine surtout le soir au moment de dormir ?',
        a: "Le soir, l'attention n'est plus captée par l'extérieur. Le cerveau bascule sur un mode interne qui ressasse le passé et anticipe le futur. Les ruminations ne sont pas un choix, c'est ce mode qui s'active au repos.",
      },
      {
        q: 'Quelle est la différence entre réfléchir et ruminer ?',
        a: "Réfléchir avance vers une décision ou une action. Ruminer tourne en rond sur la même pensée sans jamais conclure, ce qui épuise autant qu'une tâche réelle sans rien produire.",
      },
      {
        q: 'Comment arrêter de tourner en rond dans sa tête ?',
        a: "Écrire ce qui tourne, sans filtre, pour sortir les pensées de sa tête. La recherche sur l'écriture expressive montre que poser ses pensées par écrit réduit la rumination et apaise le mental.",
      },
    ],
  },
]

export function getArticle(slug: string): BlogArticle | undefined {
  return blogArticles.find((a) => a.slug === slug)
}

export function getAllSlugs(): string[] {
  return blogArticles.map((a) => a.slug)
}