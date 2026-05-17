# US-20 — Seed des données de test

## Description
En tant que développeur, je veux disposer d'un jeu de données de test réaliste et complet en base de données, afin de pouvoir tester toutes les fonctionnalités de l'interface sans saisie manuelle.

## Critères d'acceptation

### Utilisateurs (5)
- [ ] `sophie` (sophie@withoutborder.app) — langue `fr`, statut `active`, rôle Designer UI/UX, couleur orange
- [ ] `john` (john@withoutborder.app) — langue `en`, statut `active`, rôle Product Manager, couleur blue
- [ ] `maria` (maria@withoutborder.app) — langue `es`, statut `agentic`, rôle Lead Developer, couleur emerald
- [ ] `kevin` (kevin@withoutborder.app) — langue `ko`, statut `inactive`, rôle Fullstack Dev, couleur zinc
- [ ] `sarah` (sarah@withoutborder.app) — langue `en`, statut `active`, rôle Marketing Lead, couleur purple
- [ ] Tous les utilisateurs ont le mot de passe `demo1234` dans le realm Keycloak `without-border`

### Canaux d'équipe (4)
- [ ] `Annonces Générales` — tous les membres — sous-titre "TechCorp Workspace"
- [ ] `Équipe Développement Front` — sophie, john, maria, kevin — sous-titre "Projet Apollo"
- [ ] `Design System` — sophie, maria, john — sous-titre "Charte graphique"
- [ ] `Marketing & Com` — sarah, john, sophie, kevin — sous-titre "Campagnes 2025"

### Conversations directes (3 binômes)
- [ ] sophie ↔ john (DM)
- [ ] sophie ↔ maria (DM, maria est en mode agentic)
- [ ] sophie ↔ kevin (DM)

### Messages (au moins 2-3 par canal/DM)
- [ ] Les messages reprennent fidèlement les contenus de la maquette fonctionnelle (`maquette-fonctionnelle.html`) avec les bons auteurs, heures, langues et réactions
- [ ] Les réactions sont seedées (`MessageReaction`) pour les messages qui en ont dans la maquette (ex. 🔥×2, 👋×4 sur le premier message du canal Annonces)
- [ ] Les traductions des messages non-FR sont pré-calculées et seedées dans `MessageTranslation` pour la langue `fr` (sophie) afin de tester l'affichage sans LLM

### Exécution du seed
- [ ] Le script de seed (`backend/app/seed.py`) est idempotent : il vérifie l'existence des données avant d'insérer (pas de doublons si relancé)
- [ ] Il peut être exécuté via `docker compose exec backend python -m app.seed` ou automatiquement au démarrage si la base est vide
- [ ] Les UUIDs des utilisateurs sont fixés (ex. `00000000-0000-0000-0000-00000000000X`) pour rester cohérents avec le realm Keycloak
