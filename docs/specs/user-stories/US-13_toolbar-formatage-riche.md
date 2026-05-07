# US-13 — Toolbar de formatage riche du compositeur

## Description
En tant qu'utilisateur, je veux accéder à des outils de formatage et d'actions dans le compositeur, afin d'enrichir mes messages ou joindre des éléments.

## Critères d'acceptation

- [ ] **Toolbar supérieure** (au-dessus du textarea, séparée par une bordure) affiche dans l'ordre : `B` (gras), `I` (italique), `U` (souligné), `S` (barré), séparateur, lien (icône), séparateur, liste ordonnée (icône), liste à puces (icône), séparateur, indenter (icône), code inline (icône), citation (icône)
- [ ] **Toolbar inférieure** (sous le textarea) affiche : joindre fichier (`+`), format (`Aa`), emoji (icône smiley), mention (`@`), séparateur, clip vidéo (icône), message vocal (icône), commandes slash (`/`), espace flexible, bouton envoi
- [ ] Chaque bouton de toolbar est un carré 28×28px, `border-radius: 6px`, opacité 45% au repos, 100% au survol avec fond subtil
- [ ] Les boutons de formatage (B, I, U, S) appliquent la balise correspondante autour du texte sélectionné dans le textarea (ou encapsulent la saisie future si rien n'est sélectionné)
- [ ] Les boutons sans implémentation fonctionnelle dans cette version (vidéo, vocal, lien, listes avancées) sont affichés mais non fonctionnels (cursor:pointer, aucune action)
- [ ] Le bouton `@` peut ouvrir un futur panneau de mention (non requis dans cette version — bouton présent mais inactif)
