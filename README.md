# Écran de séance vélo

Page unique (`index.html`) : on colle une séance de home trainer, l'écran avance tout seul.

## Routine de test

```
npm install
npx playwright install chromium
npm test
```

- `tests/lecture.test.mjs` : textes de séance réels (format du guide IA, réponses d'IA avec guillemets, puces, gras, numéros, sous-listes, % FTP, espaces insécables…) et le résultat attendu.
- `tests/ecran.test.mjs` : parcours complet sur iPhone simulé (coller, démarrer, changement de bloc, pause, rechargement, copie du guide IA, signalement par DM, affichage sur plusieurs tailles d'écran).

## Signalements

« Un problème ? Écris-moi » (en haut du réglage) et « Bug ? » (pendant la séance) copient un rapport dans le presse-papiers : séance collée, blocs lus, téléphone, et la position dans la séance si on était en train de pédaler. Ensuite, la messagerie Instagram de @ugo_paul23 s'ouvre (`IG_HANDLE` dans `index.html`). La personne colle le rapport et écrit ce qui ne va pas. Ajoute ensuite le texte reçu dans `CASES` de `tests/lecture.test.mjs`.

## Plein écran

- **Android, iPad, ordinateur** : bouton ⛶ en haut de l'écran de séance (API plein écran du navigateur).
- **iPhone** : Safari ne permet pas le plein écran d'une page. Il faut l'ajouter à l'écran d'accueil (Partager → « Sur l'écran d'accueil ») : l'app s'ouvre alors sans barres, grâce à `manifest.webmanifest` et `apple-touch-icon.png`. Une aide s'affiche sous le bouton principal, sur iPhone seulement (avec une variante pour le navigateur d'Instagram, d'où l'ajout est impossible).
