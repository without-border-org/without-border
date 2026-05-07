# Suivi des tâches — Intégration maquette fonctionnelle

## Sommaire
- [1. Objectif](#1-objectif)
- [2. Statuts](#2-statuts)
- [3. Layout et navigation](#3-layout-et-navigation)
- [4. Messages](#4-messages)
- [5. Compositeur](#5-compositeur)
- [6. Participants](#6-participants)
- [7. Intégration backend](#7-intégration-backend)
- [8. Données de test](#8-données-de-test)
- [9. Notes d'architecture](#9-notes-darchitecture)

---

## 1. Objectif

Intégrer la maquette fonctionnelle HTML (`docs/specs/maquette-fonctionnelle.html`) dans le projet Angular existant en conservant l'authentification Keycloak et les services backend FastAPI déjà en place.

> L'authentification Keycloak fonctionne. Le design Angular actuel est remplacé intégralement par celui de la maquette.

---

## 2. Statuts

| Icône | Signification |
|-------|---------------|
| ⬜ | À faire |
| 🔄 | En cours |
| ✅ | Terminé |
| 🚫 | Bloqué |

---

## 3. Layout et navigation

| # | User Story | Statut | Notes |
|---|-----------|--------|-------|
| US-01 | [Layout principal 3 colonnes](user-stories/US-01_layout-principal-3-colonnes.md) | ⬜ | Nouveau composant shell `ChatLayoutComponent` |
| US-02 | [Dark/Light mode](user-stories/US-02_dark-light-mode.md) | ⬜ | Classe `dark` sur `<html>`, persistée en localStorage |
| US-03 | [Liste canaux d'équipe](user-stories/US-03_liste-canaux-equipe.md) | ⬜ | Filtre `type = 'team'` sur `GET /channels` |
| US-04 | [Liste conversations directes](user-stories/US-04_liste-conversations-directes.md) | ⬜ | Filtre `type = 'pair'` sur `GET /channels` |
| US-05 | [Recherche dans la sidebar](user-stories/US-05_recherche-sidebar.md) | ⬜ | Filtrage local, pas d'appel API supplémentaire |
| US-06 | [Carte profil utilisateur](user-stories/US-06_carte-profil-utilisateur.md) | ⬜ | Données via `GET /users/me` |

---

## 4. Messages

| # | User Story | Statut | Notes |
|---|-----------|--------|-------|
| US-07 | [Header de canal](user-stories/US-07_header-canal.md) | ⬜ | Glassmorphism, avatars empilés, toggle sidebar droite |
| US-08 | [Affichage liste de messages](user-stories/US-08_affichage-liste-messages.md) | ⬜ | Auto-scroll bas, zone scrollable custom |
| US-09 | [Bulle de message + métadonnées](user-stories/US-09_bulle-message-metadonnees.md) | ⬜ | Avatar, nom, heure, badge langue, label "traduit" |
| US-10 | [Réactions aux messages](user-stories/US-10_reactions-messages.md) | ⬜ | Pills emoji, toggle via `POST /messages/{id}/reactions` |
| US-11 | [Messages Agentic](user-stories/US-11_messages-agentic.md) | ⬜ | Style orange, badge AGENTIC |

---

## 5. Compositeur

| # | User Story | Statut | Notes |
|---|-----------|--------|-------|
| US-12 | [Compositeur de messages](user-stories/US-12_compositeur-messages.md) | ⬜ | Textarea, Enter envoie, bouton orange si contenu |
| US-13 | [Toolbar de formatage riche](user-stories/US-13_toolbar-formatage-riche.md) | ⬜ | Toolbars haut et bas, B/I/U/S fonctionnels |

---

## 6. Participants

| # | User Story | Statut | Notes |
|---|-----------|--------|-------|
| US-14 | [Panel participants (sidebar droite)](user-stories/US-14_panel-participants.md) | ⬜ | Toggle, animation slide, 340px |
| US-15 | [Indicateurs de statut](user-stories/US-15_indicateurs-statut-utilisateur.md) | ⬜ | online/agentic/offline, points colorés |

---

## 7. Intégration backend

| # | User Story | Statut | Notes |
|---|-----------|--------|-------|
| US-16 | [Chargement canaux API](user-stories/US-16_chargement-canaux-api.md) | ⬜ | Lazy load membres au clic canal |
| US-17 | [Pagination des messages](user-stories/US-17_chargement-pagination-messages.md) | ⬜ | page_size=50, "Charger plus" ou scroll infini |
| US-18 | [WebSocket temps réel](user-stories/US-18_envoi-messages-websocket.md) | ⬜ | Reconnexion auto, fallback REST |
| US-19 | [Traductions automatiques](user-stories/US-19_traduction-automatique-messages.md) | ⬜ | `translated_content` backend, badge `文 traduit` |

---

## 8. Données de test

| # | User Story | Statut | Notes |
|---|-----------|--------|-------|
| US-20 | [Seed données de test](user-stories/US-20_seed-donnees-test.md) | ⬜ | 5 users, 4 canaux équipe, 3 DMs, messages + réactions + traductions seedés |

---

## 9. Notes d'architecture

### Ce qui est conservé du projet actuel
- Authentification Keycloak (`auth.service.ts`, `auth.guard.ts`, `jwt.interceptor.ts`)
- Services backend (`channel.service.ts`, `chat-ws.service.ts`, `user.service.ts`)
- Modèles TypeScript (`core/models/index.ts`)
- Route structure (`/chat/:channelId`, `/profile`)

### Ce qui est remplacé
- Tous les composants de présentation (layout, conversation, message-bubble, etc.)
- Le design CSS/SCSS → remplacé par Tailwind CSS (déjà en place via CDN dans la maquette, à intégrer via `tailwind.config.js`)
- La palette de couleurs → brand colors orange/dark définie dans `tailwind.config.js`

### Ordre d'implémentation recommandé
1. US-20 (seed) — données disponibles pour tous les tests
2. US-01 (layout) — shell de base
3. US-02 (thème) — dark/light transversal
4. US-03 + US-04 (navigation sidebar) — canaux + DMs
5. US-08 + US-09 (messages) — affichage core
6. US-12 (compositeur) — envoi de messages
7. US-16 + US-17 + US-18 (intégration API/WS) — données réelles
8. US-07 + US-14 (header + sidebar droite) — finitions navigation
9. US-05 + US-06 + US-10 + US-11 + US-13 + US-15 + US-19 — détails et polish
