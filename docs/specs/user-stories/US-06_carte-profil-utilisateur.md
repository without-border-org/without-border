# US-06 — Carte profil utilisateur (bas de sidebar)

## Description
En tant qu'utilisateur authentifié, je veux voir ma carte profil en bas de la sidebar gauche, avec mon avatar, mon nom, ma langue et mon statut, afin d'identifier rapidement mon compte actif.

## Critères d'acceptation

- [ ] La carte profil est ancrée en bas de la sidebar gauche, au-dessus du bord inférieur, séparée par une bordure horizontale
- [ ] Elle affiche : un avatar carré arrondi (`rounded-lg`) généré depuis `ui-avatars.com` ou une URL d'avatar stockée en base, le nom complet de l'utilisateur (tronqué si nécessaire), la langue native + rôle (ex. `FR · Designer`), et un indicateur de statut en ligne (point vert)
- [ ] Les données sont issues de l'utilisateur courant retourné par `GET /api/v1/users/me`
- [ ] La langue affichée utilise le code ISO de `preferred_language` (ex. `FR`, `EN`, `ES`)
- [ ] Un survol de la carte affiche un effet d'opacité (`hover:opacity-80`)
- [ ] Cliquer sur la carte navigue vers la page `/profile` (ou ouvre un panneau profil — à confirmer en US-profile)
