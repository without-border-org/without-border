# US-02 — Basculement dark/light mode

## Description
En tant qu'utilisateur, je veux pouvoir basculer entre le thème sombre et le thème clair via un bouton dans la sidebar, afin d'adapter l'interface à mes préférences visuelles.

## Critères d'acceptation

- [ ] Un bouton icône soleil/lune est affiché en haut à droite de la sidebar gauche (couleur `brand-orange`)
- [ ] Un clic bascule la classe `dark` sur l'élément `<html>`, déclenchant le thème sombre via Tailwind `darkMode: 'class'`
- [ ] Le thème par défaut est **sombre** (`dark` présent au chargement initial)
- [ ] La préférence de thème est persistée en `localStorage` et restaurée au rechargement de page
- [ ] En mode sombre : arrière-plan `#0E0E11`, sidebar `#18181B`, panneaux `#27272A`, bordures `rgba(255,255,255,0.06)`
- [ ] En mode clair : arrière-plan `#FFFFFF`, sidebar `#F4F4F5`, panneaux `#E4E4E7`, bordures `rgba(0,0,0,0.08)`
- [ ] La transition entre thèmes est animée (`transition-colors duration-300`)
- [ ] Le header (glassmorphism) adapte son fond selon le thème : `rgba(14,14,17,.8)` en dark, `rgba(255,255,255,.8)` en light avec `backdrop-filter: blur(12px)`
