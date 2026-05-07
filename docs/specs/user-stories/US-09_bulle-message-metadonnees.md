# US-09 — Bulle de message avec métadonnées

## Description
En tant qu'utilisateur, je veux que chaque message affiché comporte un avatar, le nom de l'auteur, l'heure, un badge de langue et un indicateur de traduction, afin de comprendre d'où vient chaque message et si il a été traduit.

## Critères d'acceptation

- [ ] Chaque bulle de message suit la structure : avatar (gauche, 36px carré arrondi `rounded-xl`) + bloc contenu (droite)
- [ ] **Avatar** : initiales 2 lettres, fond coloré par utilisateur (orange/blue/emerald/zinc/purple selon la seed), style `bg-{color}-500/10 text-{color}-500 border border-{color}-500/10`
- [ ] **Ligne de métadonnées** (au-dessus du contenu) : nom de l'auteur (gras, 12px), heure d'envoi (`HH:MM`, gris, 10px), badge langue (code ISO ex. `FR`, `GB`, `ES`, fond panel, 9px), label "traduit" avec icône `文` (orange, 9px) si la langue originale ≠ langue de l'utilisateur courant
- [ ] **Contenu** : fond panel (`dark:bg-brand-darkPanel bg-white`), border, arrondi `rounded-2xl rounded-tl-sm`, taille 14px, `leading-relaxed`, padding `p-3.5`
- [ ] Les messages Agentic ont un style différent — voir US-11
- [ ] Les réactions s'affichent sous le contenu — voir US-10
- [ ] Le champ `translated_content` du endpoint `GET /channels/{id}/messages` est utilisé si disponible (traduction préalablement calculée côté backend)
