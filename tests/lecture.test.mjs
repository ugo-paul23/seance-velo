// Lecture des séances : chaque cas est un texte que des gens (ou leur IA) collent vraiment.
// Pour ajouter un cas signalé sur Instagram : copie le texte exact dans CASES avec le résultat attendu.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openApp, read } from "./helpers.mjs";

const IA_OK = `Échauffement: 10min from 118 to 215W
4x 3min @ 100rpm, 264W, 2min @ 85rpm, 156W
Retour au calme: 5min @ 85rpm, 140W
FTP: 300W
Total: 35min`;

// blocks : nombre de blocs attendu, total : durée en secondes, first : début attendu [durée s, W début, W fin, rpm]
const CASES = [
  { name: "format exact du guide IA", text: IA_OK, blocks: 10, total: 2100, first: [[600, 118, 215, null], [180, 264, 264, 100], [120, 156, 156, 85], [180, 264, 264, 100]], noWarn: true },
  { name: "réponse IA avec intro et bloc de code", text: "Voici ta séance :\n\n```\n" + IA_OK + "\n```\n\nBonne séance !", blocks: 10, total: 2100 },
  { name: "IA qui garde les guillemets « » du guide", text: "« Échauffement: 10min from 118 to 215W »\n« 4x 3min @ 100rpm, 264W, 2min @ 85rpm, 156W »", blocks: 9, total: 1800 },
  { name: "guillemets droits", text: '"10min @ 200W"\n"4x 1min @ 300W, 1min @ 100W"', blocks: 9, total: 1080 },
  { name: "puces + gras markdown", text: "- **Échauffement** : 10min from 118 to 215W\n- **Bloc principal** : 4x 3min @ 100rpm, 264W, 2min @ 85rpm, 156W", blocks: 9, total: 1800, names: ["Échauffement"] },
  { name: "liste numérotée", text: "1. Échauffement: 10min from 118 to 215W\n2. 4x 3min @ 264W, 2min @ 156W\n3) 5min @ 140W", blocks: 10, total: 2100 },
  { name: "répétition annoncée puis sous-liste", text: "Échauffement: 10min @ 150W\n4x :\n- 3min @ 264W\n- 2min @ 156W\nRetour au calme: 5min @ 140W", blocks: 10, total: 2100 },
  { name: "répétition en sous-liste indentée", text: "- 10min @ 150W\n- Répéter 3 fois :\n  - 3min @ 264W\n  - 2min @ 156W\n- 5min @ 140W", blocks: 8, total: 1800 },
  { name: "« 4 séries de »", text: "4 séries de 3min @ 264W, 2min @ 156W", blocks: 8, total: 1200 },
  { name: "répétition en fin de ligne", text: "3min @ 264W, 2min @ 156W x4", blocks: 8, total: 1200 },
  { name: "% FTP avec ligne FTP", text: "10min from 50% to 75%\n5x 4min @ 105%, 3min @ 55%\nFTP: 250W", blocks: 11, total: 2700, first: [[600, 125, 188, null], [240, 263, 263, null]] },
  { name: "% FTP avec le champ FTP", text: "10min @ 60%", ftp: 300, blocks: 1, total: 600, first: [[600, 180, 180, null]] },
  { name: "% FTP sans FTP : avertit au lieu d'inventer", text: "10min @ 60%", blocks: 0, total: 0, warn: /FTP/ },
  { name: "espaces insécables (ChatGPT en français)", text: "10 min @ 60 %\nFTP : 250 W", blocks: 1, total: 600 },
  { name: "caractères invisibles", text: "﻿10min @ 200W\n5min​ @ 250W", blocks: 2, total: 900 },
  { name: "fins de ligne Windows", text: "10min @ 200W\r\n5min @ 250W\r\n", blocks: 2, total: 900 },
  { name: "formats de durée", text: "1:30 @ 300W\n1'30\" @ 300W\n1min30 @ 300W\n1min 30sec @ 300W\n90sec @ 300W\n1h @ 180W\n1h30 @ 180W\n1h05 @ 150W", blocks: 8, total: 90 * 5 + 3600 + 5400 + 3900 },
  { name: "rampes : from/to, de/à, flèches", text: "10min from 118W to 215W\n10min de 118 à 215 W\n10min 118→215W\n10min 118 -> 215 W", blocks: 4, total: 2400, first: [[600, 118, 215, null], [600, 118, 215, null], [600, 118, 215, null], [600, 118, 215, null]] },
  { name: "plage de watts et cadence", text: "20min @ 85–95rpm, 200-220W", blocks: 1, total: 1200, first: [[1200, 210, 210, "85-95"]] },
  { name: "majuscules", text: "10MIN @ 200W\n5 MIN @ 90RPM, 250 WATTS", blocks: 2, total: 900 },
  { name: "texte libre en français", text: "Échauffement 15 min progressif de 100 à 200 W\n3 x 8 min à 280 W récup 4 min à 150 W\nRetour au calme 10 min 120 W", blocks: 8, total: 3660 },
  { name: "nom de bloc contenant un chiffre", text: "Bloc 1: 5min @ 200W\nZ2: 20min @ 180W", blocks: 2, total: 1500, names: ["Bloc 1", "Z2"] },
  { name: "ligne sans puissance : signalée, pas avalée en silence", text: "10min Z2\n5min @ 200W", blocks: 1, total: 300, warn: /Ligne 1 ignorée/ },
  { name: "répétition collée « 4x3min »", text: "4x3min @ 264W, 2min @ 156W", blocks: 8, total: 1200 },
  { name: "apostrophes automatiques de l'iPhone (8’ 30’’)", text: "4×8’ à 105%\n3’30’’ à 50%", ftp: 300, blocks: 5, total: 4 * 480 + 210, first: [[480, 315, 315, null]], noWarn: true },
  { name: "secondes avec ″", text: "1’30″ @ 300W", blocks: 1, total: 90 },
  { name: "tableau markdown (Gemini)", text: "| Bloc | Durée | Puissance | Cadence |\n|---|---|---|---|\n| Échauffement | 10min | 118 → 215W | |\n| 4x | 3min | 264W | 100rpm |\n| Retour au calme | 5min | 140W | 85rpm |", blocks: 6, total: 1620 },
  { name: "format vertical Durée / Puissance", text: "Échauffement\nDurée : 10 min\nPuissance : 150 W\n\nBloc\nDurée : 5 min\nPuissance : 250 W\nCadence : 95", blocks: 2, total: 900, names: ["Échauffement", "Bloc"], first: [[600, 150, 150, null], [300, 250, 250, 95]] },
  { name: "puissance écrite avant la durée", text: "200W pendant 10min\n250W x 5min", blocks: 2, total: 900 },
  { name: "% suivi de FTP", text: "10min @ 55-75% FTP\n20min à 90 % de FTP", ftp: 300, blocks: 2, total: 1800, first: [[600, 195, 195, null], [1200, 270, 270, null]] },
  { name: "FTP à 4 chiffres lue en entier", text: "FTP: 1000W\n10min @ 50%", blocks: 1, total: 600, first: [[600, 500, 500, null]] },
  { name: "répétition imbriquée : avertit", text: "2x (3x 1min @ 400W, 1min @ 150W), 5min @ 120W", warn: /répétition dans une répétition/, blocks: 6, total: 840 },
  { name: "effort sous la FTP reste nommé Effort", text: "4x 3min @ 264W, 2min @ 156W\nFTP: 300W", blocks: 8, total: 1200, names: ["Effort 1/4", "Récup 1/4"] }
];

let app;
before(async () => { app = await openApp(); });
after(async () => { await app.browser.close(); });

for (const c of CASES) {
  test(c.name, async () => {
    const r = await read(app.page, c.text, c.ftp);
    const show = `\n${r.blocks.map(b => `  ${b.name} ${b.dur}s ${b.a}→${b.b}W rpm=${b.rpm}`).join("\n")}\n  avertissements: ${JSON.stringify(r.warnings)}`;
    assert.equal(r.blocks.length, c.blocks, "nombre de blocs" + show);
    assert.equal(r.total, c.total, "durée totale (s)" + show);
    (c.first || []).forEach(([dur, a, b, rpm], i) => assert.deepEqual([r.blocks[i].dur, r.blocks[i].a, r.blocks[i].b, r.blocks[i].rpm], [dur, a, b, rpm], `bloc ${i + 1}` + show));
    (c.names || []).forEach((n, i) => assert.equal(r.blocks[i].name, n, `nom du bloc ${i + 1}` + show));
    if (c.warn) assert.ok(r.warnings.some(w => c.warn.test(w)), "avertissement attendu" + show);
    if (c.noWarn) assert.deepEqual(r.warnings, [], "aucun avertissement" + show);
  });
}

test("aucune erreur JavaScript au chargement", () => assert.deepEqual(app.errors, []));
