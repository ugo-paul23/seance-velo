# Écran de séance vélo

Page unique (`index.html`) : on colle une séance de home trainer, l'écran avance tout seul.

## Routine de test

```
npm install
npx playwright install chromium
npm test
```

- `tests/lecture.test.mjs` : textes de séance réels (format du guide IA, réponses d'IA avec guillemets, puces, gras, numéros, sous-listes, % FTP, espaces insécables…) et le résultat attendu.
- `tests/ecran.test.mjs` : parcours complet sur iPhone simulé (coller, démarrer, changement de bloc, pause, rechargement, copie du guide IA, affichage sur plusieurs tailles d'écran).

Les tests tournent aussi automatiquement sur GitHub à chaque push (onglet *Actions*).

**Quand quelqu'un dit « ça marche pas »** : demande-lui le texte exact qu'il a collé, ajoute-le dans `CASES` de `tests/lecture.test.mjs` avec le résultat attendu, lance `npm test`, corrige jusqu'à ce que ça passe.

Tester la version en ligne plutôt que le fichier local : `SEANCE_URL=https://ugo-paul23.github.io/seance-velo/ npm test`.
