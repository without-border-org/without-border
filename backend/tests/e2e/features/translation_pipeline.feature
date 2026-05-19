# language: fr
Feature: Pipeline de traduction via Gemma 4

  En tant qu'utilisateur avec une langue configurée,
  Je veux recevoir les messages dans ma propre langue
  Afin de collaborer sans barrière linguistique.

  Scenario: Un message en anglais est traduit en français pour Sophie
    Given l'application est démarrée sur la démo
    And John est l'utilisateur actif dans le contexte A
    And John navigue vers le canal "Annonces Générales" dans le contexte A
    When John envoie le message "The sprint review is scheduled for Friday at 3pm"
    And Sophie est l'utilisateur actif dans le contexte B
    And Sophie navigue vers le canal "Annonces Générales" dans le contexte B
    Then Sophie voit le dernier message dans le canal
    And le message affiché à Sophie est différent du texte original anglais
