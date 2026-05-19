# language: fr
Feature: Mode agentique — L'IA répond au nom de l'utilisateur absent

  En tant qu'utilisateur avec le mode agentique activé,
  Je veux que mon agent IA réponde automatiquement
  Afin que mes collègues obtiennent une réponse même si je suis absent.

  Scenario: L'agent de María répond automatiquement lorsqu'elle est en mode agentique
    Given l'application est démarrée sur la démo
    And María est configurée en mode agentique et n'est pas connectée
    And John est l'utilisateur actif
    And John navigue vers le canal "Équipe Développement Front"
    When John envoie le message "Maria, can you review the latest PR before end of day?"
    Then un message agentique de María apparaît dans le canal dans les 30 secondes
    And le message est marqué comme généré par l'IA
