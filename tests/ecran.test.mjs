// Parcours complet sur un iPhone simulé : coller, ouvrir l'écran, pédaler, pause, rechargement.
// L'horloge est simulée : 20 minutes de séance se testent en une seconde.
import { test } from "node:test";
import assert from "node:assert/strict";
import { openApp, paste, cockpit } from "./helpers.mjs";

const SHORT = "Échauffement: 10sec @ 150W\n2x 5sec @ 100rpm, 300W, 5sec @ 120W";

test("coller par-dessus l'exemple remplace l'exemple au lieu de l'additionner", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    const example = await page.evaluate(() => window.SeanceVelo.EXAMPLE);
    assert.equal(await page.inputValue("#seance"), example);
    // Sur téléphone, on tape dans le champ puis « Coller » : le texte arrive souvent après l'exemple.
    await page.evaluate(() => { const t = document.getElementById("seance"); t.setSelectionRange(t.value.length, t.value.length); });
    await page.focus("#seance");
    await page.evaluate(() => { const t = document.getElementById("seance"); t.setSelectionRange(t.value.length, t.value.length); });
    await page.keyboard.insertText("\n10min @ 200W");
    await page.clock.runFor(400);
    assert.equal(await page.inputValue("#seance"), "10min @ 200W");
    assert.match(await page.textContent("#sumTotal"), /^1 blocs · 10:00$/);
  } finally { await browser.close(); }
});

test("le chrono avance, change de bloc, se met en pause et s'arrête à la fin", async () => {
  const { browser, page, errors } = await openApp({ fakeClock: true });
  try {
    await paste(page, SHORT, { fake: true });
    assert.equal(await page.textContent("#sumTotal"), "5 blocs · 0:30");
    assert.equal(await page.isDisabled("#go"), false);
    await page.click("#go");
    let s = await cockpit(page);
    assert.deepEqual([s.name, s.count, s.watts, s.left, s.play], ["Échauffement", "bloc 1/5", "150", "0:10", "Démarrer"]);

    await page.click("#play");
    await page.clock.runFor(4000);
    s = await cockpit(page);
    assert.deepEqual([s.left, s.elapsed, s.play], ["0:06", "0:04", "Pause"]);

    await page.clock.runFor(7000);
    s = await cockpit(page);
    assert.deepEqual([s.name, s.watts, s.rpm, s.count], ["Sprint 1/2", "300", "100", "bloc 2/5"]);

    await page.click("#play"); // pause
    const frozen = (await cockpit(page)).elapsed;
    await page.clock.runFor(5000);
    s = await cockpit(page);
    assert.equal(s.elapsed, frozen, "le temps ne doit pas avancer en pause");
    assert.equal(s.play, "Reprendre");

    await page.click("#play");
    await page.clock.runFor(30000);
    s = await cockpit(page);
    assert.equal(s.done, true, "écran de fin attendu");
    assert.equal(await page.textContent("#doneTime"), "0:30");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("boutons bloc suivant / précédent", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    await paste(page, SHORT, { fake: true });
    await page.click("#go");
    await page.click("#nextb");
    assert.equal((await cockpit(page)).count, "bloc 2/5");
    await page.click("#nextb");
    assert.equal((await cockpit(page)).count, "bloc 3/5");
    await page.click("#prev");
    assert.equal((await cockpit(page)).count, "bloc 2/5");
  } finally { await browser.close(); }
});

test("recharger la page en pleine séance la rouvre au bon endroit", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    await paste(page, SHORT, { fake: true });
    await page.click("#go");
    await page.click("#play");
    await page.clock.runFor(12000);
    await page.reload();
    await page.clock.runFor(500);
    const s = await cockpit(page);
    assert.equal(await page.isVisible("#ride"), true, "l'écran de séance doit se rouvrir");
    assert.equal(s.play, "Reprendre", "rouvert en pause");
    // Le temps du rechargement compte (on a continué à pédaler) : au moins 12 s, pas remis à zéro.
    const [m, sec] = s.elapsed.split(":").map(Number);
    assert.ok(m * 60 + sec >= 12 && m * 60 + sec < 30, `temps écoulé : ${s.elapsed}`);
  } finally { await browser.close(); }
});

test("séance en % sans FTP : bouton bloqué et message clair, puis débloqué avec la FTP", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    await paste(page, "10min @ 60%", { fake: true });
    assert.equal(await page.isDisabled("#go"), true);
    assert.match(await page.textContent("#warnings"), /FTP/);
    await page.fill("#ftp", "250");
    await page.clock.runFor(100);
    assert.equal(await page.isDisabled("#go"), false);
    assert.match(await page.textContent("#rows"), /150 W/);
  } finally { await browser.close(); }
});

test("le texte du guide IA se copie", async () => {
  const { browser, context, page } = await openApp();
  try {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "null" }).catch(() => {});
    await page.click("summary");
    await page.click("#copy");
    await page.waitForFunction(() => document.getElementById("copy").textContent !== "Copier le texte", null, { timeout: 3000 });
    const label = await page.textContent("#copy");
    assert.ok(["Copié", "Texte sélectionné : copie-le"].includes(label), `bouton : ${label}`);
  } finally { await browser.close(); }
});

test("signalement de bug : contient la séance collée, la lecture et le message", async () => {
  const { browser, page } = await openApp();
  try {
    await paste(page, "10min @ 200W\n4x 1min @ 400W, 1min @ 100W");
    await page.click("#bug summary");
    await page.fill("#bugMsg", "les watts sont faux");
    const report = await page.evaluate(() => window.SeanceVelo.bugReport());
    assert.match(report, /les watts sont faux/);
    assert.match(report, /4x 1min @ 400W, 1min @ 100W/);
    assert.match(report, /9 blocs, 18:00/);
    // Sans partage natif (Chromium bureau) : copie + message affiché.
    await page.evaluate(() => { delete navigator.share; });
    await page.click("#bugSend");
    await page.waitForFunction(() => document.getElementById("bugStatus").textContent !== "", null, { timeout: 3000 });
    assert.match(await page.textContent("#bugStatus"), /copié|Copie impossible/i);
  } finally { await browser.close(); }
});

for (const device of ["iPhone SE", "Pixel 7", "iPad Mini landscape"]) {
  test(`l'écran de séance tient sans débordement sur ${device}`, async () => {
    const { browser, page } = await openApp({ device, fakeClock: true });
    try {
      await paste(page, SHORT, { fake: true });
      await page.click("#go");
      const over = await page.evaluate(() => {
        const vw = innerWidth, vh = innerHeight;
        return ["watts", "play", "nextb", "prev", "cd"].filter(id => {
          const r = document.getElementById(id).getBoundingClientRect();
          return r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.width === 0;
        });
      });
      assert.deepEqual(over, [], "éléments hors écran");
    } finally { await browser.close(); }
  });
}
