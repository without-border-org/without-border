# US-15 — Indicateurs de statut utilisateur

## Description
En tant qu'utilisateur, je veux voir le statut (en ligne, agentic, hors ligne) de mes collègues sur leurs avatars dans l'interface, afin de savoir qui est disponible pour communiquer.

## Critères d'acceptation

- [ ] Trois statuts sont supportés, correspondant au champ `status` du modèle `User` côté backend :
  - `online` / `active` → point **vert** (`bg-green-500`)
  - `agentic` → point **orange** (`bg-brand-orange`)
  - `offline` / `inactive` → point **gris** (`bg-zinc-400`)
- [ ] Le point de statut est affiché : en bas à droite de l'avatar dans la sidebar gauche (section Binômes), en bas à droite de l'avatar dans la sidebar droite (participants), en bas à droite de l'avatar dans la carte profil (utilisateur courant)
- [ ] Le point est encerclé d'une bordure couleur background (`border-2 dark:border-brand-darkSidebar border-white`) pour le détacher visuellement de l'avatar
- [ ] Le statut de l'utilisateur courant est `online` par défaut dès connexion
- [ ] Les statuts des autres utilisateurs sont issus du backend ; une mise à jour temps réel via WebSocket est idéale mais pas obligatoire dans cette version (polling toutes les 30s acceptable)
