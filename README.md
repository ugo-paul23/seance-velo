# Écran de séance vélo

Page unique (`index.html`) : on colle une séance de home trainer, l'écran avance tout seul.

## Routine de test

```
npm install
npx playwright install chromium
npm test
```

- `tests/lecture.test.mjs` : textes de séance réels (format du guide IA, réponses d'IA avec guillemets, puces, gras, numéros, sous-listes, % FTP, espaces insécables…) et le résultat attendu.
- `tests/ecran.test.mjs` : parcours complet sur iPhone simulé (coller, démarrer, changement de bloc, pause, rechargement, copie du guide IA, signalement de bug, affichage sur plusieurs tailles d'écran).

## Signalements

Le bloc « Ça ne marche pas ? » prépare un texte (séance collée, lecture de l'écran, appareil) que la personne t'envoie via le partage du téléphone ou en message privé. Pour ouvrir directement ta messagerie Instagram après la copie, renseigne `CONTACT` dans `index.html` (ex. `https://ig.me/m/ton_compte`). Colle ensuite le texte reçu dans `CASES` de `tests/lecture.test.mjs`.

Les tests tournent aussi automatiquement sur GitHub à chaque push (onglet *Actions*).

**Quand quelqu'un dit « ça marche pas »** : demande-lui le texte exact qu'il a collé, ajoute-le dans `CASES` de `tests/lecture.test.mjs` avec le résultat attendu, lance `npm test`, corrige jusqu'à ce que ça passe.

Tester la version en ligne plutôt que le fichier local : `SEANCE_URL=https://ugo-paul23.github.io/seance-velo/ npm test`.
