# Prompt : Landing Page HTML autonome — WithoutBorder

  ## Contexte de la plateforme

  **WithoutBorder** est une plateforme de collaboration internationale en temps réel, propulsée par une IA locale (Gemma 4 via Ollama/LiteRT). Son identité repose sur une idée
   centrale : **le talent n'a pas de frontières, mais la langue et la souveraineté des données en créent**. La plateforme s'adresse aux équipes globales — du Sud global, des
  secteurs médicaux, légaux, gouvernementaux — qui ne peuvent pas se permettre de faire fuiter leurs données vers des clouds tiers.

  **Proposition de valeur en une phrase** : WithoutBorder élimine la "Language Tax" — ce coût cognitif et économique que paient les non-anglophones pour participer à
  l'innovation — en offrant une collaboration multilingue instantanée avec une IA souveraine et locale.

  ### Les trois problèmes résolus
  1. **La "Language Tax"** : Quand on force des équipes à communiquer dans une langue étrangère, la nuance se perd, la contribution est sous-estimée, et la charge cognitive
  freine l'innovation.
  2. **Le fossé d'adoption de l'IA** : L'ingénierie de prompts est un privilège technique. WithoutBorder rend l'IA délégable par n'importe qui, en langue naturelle.
  3. **Risques de souveraineté** : Les secteurs médicaux, légaux ou gouvernementaux ne peuvent pas envoyer leurs données à un cloud centralisé. WithoutBorder tourne
  entièrement en local.

  ---

  ## Architecture de la plateforme (pour inspirer les visuels)

  ### Structure de l'espace de travail
  - **Canaux d'équipe (Canals)** : Espaces projet collectifs (ex : "Équipe Dev Front", "Projet Mobile App") avec badges de notifications numériques
  - **Binômes (Pairs)** : Espaces d'échange privés peer-to-peer pour la collaboration technique directe
  - **Agents IA** : Assistants spécialisés intégrés directement dans les canaux (ProjectBot pour la gestion, TransBot pour la traduction technique profonde)

  ### Les acteurs de la plateforme
  | Acteur | Description | Visuel clé |
  |---|---|---|
  | Utilisateur humain | Collaborateur projet, identifié par sa langue natale (ex : Sophie Martin, 🇫🇷 FR - Designer) | Avatar coloré aux initiales |
  | Agent IA dédié | Bot spécialisé dans un canal (ProjectBot, TransBot) | Avatar bleu/teal avec point vert |
  | Utilisateur en Mode Agent | Humain dont l'IA gère temporairement les réponses | Point orange + badge violet AGENTIC |

  ### Le protocole couleur des statuts (fondamental — à visualiser)
  Ce système est au cœur de la transparence de la plateforme :
  - 🟢 **Actif** : L'utilisateur est en ligne, présent
  - 🟡 **Absent/Inactif** : L'utilisateur est parti, l'IA de backup est désactivée
  - 🔵 **En communication** : L'utilisateur est en réunion/appel
  - 🟠 **Mode Agent** (point orange) + badge **AGENTIC** (violet) : L'IA répond à la place de l'utilisateur

  Ce dernier état — Mode Agent — est la feature phare : quand un utilisateur est indisponible, l'IA (Gemma 4) analyse l'historique des échanges et répond de façon contextuelle
   en son nom. Le badge violet **AGENTIC** apparaît obligatoirement sur chaque message IA pour éviter toute confusion humain/machine.

  ### La traduction à la volée
  Chaque message porte un badge de langue (🇫🇷 FR, 🇬🇧 GB, 🇨🇳 CN…). Quand les langues source et destination diffèrent, Gemma 4 traduit en zéro-shot tout en préservant le
  contexte technique. Un badge **文 traduit** signale les messages traduits. L'utilisateur peut basculer entre version originale et traduction d'un clic.

  ### La génération de livrables intelligents
  Via le function calling natif de Gemma 4, la plateforme génère des livrables structurés à la demande en langage naturel : plans d'action, présentations, résumés de canal.
  L'IA identifie l'intention ("fais-moi un résumé de la semaine"), appelle l'outil interne, et livre le document formaté sans interrompre le fil de discussion.

  ### La souveraineté (le backbone éthique)
  Le déploiement on-premise de Gemma 4 garantit que **aucune donnée ne quitte le périmètre organisationnel**. Cela rend le Mode Agent éthiquement viable : l'utilisateur peut
  faire confiance à l'IA pour le représenter parce que ses données restent chez lui. Fonctionne même en connectivité intermittente.

  ---

  ## Direction artistique

  **Univers visuel** : Dark-tech + équité globale. Pense à une interface de salle de contrôle nocturne qui serait aussi ouverte sur le monde — sophistiquée mais accessible.
  Pas corporate. Pas startup générique. Quelque chose qui ressemble à ce que des équipes de Dakar, Mumbai et Buenos Aires utiliseraient ensemble à 2h du matin pour livrer un
  projet critique.

  **Palette libre** — suggestions d'inspiration :
  - Fond très sombre (presque noir, pas #000 pur — quelque chose comme #0C0C10 ou un navy très profond)
  - Un accent principal chaud et distinctif (l'orange #F97316 est la couleur actuelle de l'app, mais Claude Design peut proposer une alternative cohérente avec l'univers)
  - Violet/lavande pour les éléments "Agent IA" (badges AGENTIC, avatars d'agents)
  - Vert, ambre, bleu, orange pour les dots de statut (ces couleurs sont fonctionnelles et doivent rester reconnaissables)
  - Des glassmorphism légers sur les cards, pas agressifs

  **Typographie** : Inter ou similaire sans-serif moderne, titles bold et serrés (letter-spacing négatif), hiérarchie claire

  **Ton copywriting** : Direct, engagé, multiculturel. Pas de "révolution" ou "game-changer". Parler de réalité concrète : une développeuse à Casablanca qui peut enfin
  reviewer du code avec une équipe à Berlin sans perdre ses nuances techniques.

  ---

  ## Sections de la landing page

  ### 1. Navigation (sticky, glassmorphism)
  - Logo "WithoutBorder" à gauche
  - Liens : Features / How it works / Sovereignty / Agents
  - CTA droit : "Essayer maintenant" (bouton accent)

  ### 2. Hero
  **Headline principale** : Quelque chose qui capture la "Language Tax" et la souveraineté en une phrase percutante. Exemples de direction (pas obligatoire) :
  - *"Collaborate in your language. Own your data."*
  - *"The AI that speaks your language. Stays on your servers."*
  - *"Break the Language Tax."*

  **Sous-titre** : 2 lignes max expliquant : IA locale (Gemma 4), traduction temps réel, collaboration multilingue sans cloud.

  **CTA group** : 2 boutons — "Démarrer gratuitement" (accent) + "Voir la démo" (ghost)

  **Visuel hero** : Un mockup stylisé d'une conversation dans l'interface — montre idéalement :
  - 2-3 bulles de messages avec des badges de langue différents (🇫🇷 FR, 🇬🇧 GB, 🇧🇷 BR)
  - Un badge **文 traduit** sur une bulle
  - Un badge **AGENTIC** violet sur une bulle
  - Les points de statut colorés dans une sidebar gauche épurée

  ### 3. Le Problème (section narrative, pas de features)
  Raconter en 2-3 paragraphes courts et percutants la réalité vécue : la développeuse qui réécrit son message trois fois pour le rendre "acceptable" en anglais, le médecin qui
   hésite à adopter un LLM cloud pour la confidentialité de ses patients, le manager qui ne peut pas déléguer à l'IA parce que ses données ne peuvent pas quitter
  l'organisation.

  ### 4. Features (3 cards principales)
  Chaque card : icône, titre court, description 2 lignes, couleur accent distincte

  **Card 1 — Traduction temps réel**
  - Icône : globe avec ondes / caractères multilingues
  - Titre : "Zero-latency translation"
  - Desc : "Gemma 4 translates technical context in real time. Your message arrives in their language, with your nuance intact. Verified by the 文 badge."
  - Accent : couleur chaude (orange ou amber)

  **Card 2 — Mode Agent (la feature signature)**
  - Icône : avatar avec badge violet + point orange
  - Titre : "Agentic Backup — Never miss a collaboration"
  - Desc : "When you're unavailable, Gemma 4 reads your conversation history and responds contextually in your name. Every AI message is transparently badged AGENTIC in
  purple."
  - Accent : violet
  - Note : c'est la feature la plus différenciante — lui donner plus de place visuellement

  **Card 3 — Souveraineté locale**
  - Icône : serveur local / lock
  - Titre : "Your data never leaves your walls"
  - Desc : "Deploy Gemma 4 on-premise via Ollama or LiteRT. Medical, legal, governmental teams can trust the AI because the data stays hardware-enforced within their
  perimeter."
  - Accent : vert ou teal

  ### 5. How it works (3 étapes numérotées)
  1. **Connect your team** — Créer des canaux d'équipe, inviter des collaborateurs depuis n'importe quel pays, chacun configure sa langue natale
  2. **Collaborate in your language** — Chaque message est automatiquement traduit si nécessaire. Le badge 文 garantit la transparence. Les fichiers partagés sont traduits
  aussi.
  3. **Let AI back you up** — Quand tu pars, active le Mode Agent. Gemma 4 maintient la collaboration en ton absence, avec un badge violet sur chaque message pour que personne
   ne soit trompé.

  ### 6. Section Souveraineté (pleine largeur, fond légèrement différent)
  Mettre en avant l'architecture locale. 2 colonnes :
  - Gauche : texte — "Built for organizations that can't compromise on privacy"
  - Droite : liste de cas d'usage : Secteur médical / Juridique / Gouvernemental / Recherche confidentielle
  - Mention technique : "Powered by Gemma 4 · Runs on LiteRT (edge) or Ollama (26B/31B) · Zero cloud dependency"

  ### 7. Social proof / Impact (chiffres ou citations)
  Si pas de vrais chiffres : afficher 3 quotes stylisées de personas fictifs typiques :
  - Une développeuse à Casablanca
  - Un chef de projet à São Paulo
  - Un médecin à Bangalore

  ### 8. CTA final
  Grande section centrée, fond accent ou dégradé :
  - Headline : "Start collaborating without borders"
  - Sous-titre : "Deploy in minutes. Own your AI. Speak your language."
  - Bouton unique : "Get started for free"

  ### 9. Footer
  - Liens : GitHub / Docs / Kaggle Challenge / Contact
  - Mention Gemma 4 + Google DeepMind
  - Copyright WithoutBorder

  ---

  ## Contraintes techniques

  - **HTML/CSS/JS entièrement autonome** : zéro dépendance externe (pas de CDN, pas de framework), un seul fichier `.html`
  - **CSS custom properties** pour toute la palette (définies dans `:root`)
  - **Responsive mobile-first** (breakpoints 375px → 768px → 1280px)
  - **Dark mode par défaut** (l'univers de la plateforme est dark)
  - **Animations légères** : `@keyframes` pour le hero (fade-in-up), hover sur les cards (translate-y), scroll reveal en IntersectionObserver si possible
  - **Mockup de chat stylisé en pur CSS** : pas de screenshot, construire les bulles de messages en HTML/CSS avec les vrais badges (langue, traduit, AGENTIC violet) pour que
  ça soit fidèle à l'interface réelle
  - **Performance** : tout inline, chargement instantané, pas d'images (utiliser des SVG inline ou des formes CSS)
  - **Accessibilité** : contraste WCAG AA minimum, focus visible, rôles aria sur la nav