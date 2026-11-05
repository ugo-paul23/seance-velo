// Parcours complet sur un iPhone simulé : coller, ouvrir l'écran, pédaler, pause, rechargement.
// L'horloge est simulée : 20 minutes de séance se testent en une seconde.
import { test } from "node:test";
import assert from "node:assert/strict";
import { openApp, paste, cockpit, PAGE_URL } from "./helpers.mjs";

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
    // 4,3 s et pas 4 s pile : à 4 s, le compte à rebours est pile sur la limite 0:06/0:07 et dépend de la vitesse de la machine.
    await page.clock.runFor(4300);
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

const LONG = "Échauffement: 10min @ 150W\n6x 6min @ 264W, 2min @ 156W"; // > 45 min : affiche aussi « Rappel boire »
for (const device of ["iPhone SE", "iPhone 13", "Pixel 7", "iPhone SE landscape", "iPhone 13 landscape", "Pixel 7 landscape", "iPad Mini landscape"]) {
  test(`l'écran de séance tient sans débordement ni chevauchement sur ${device}`, async () => {
    const { browser, page } = await openApp({ device, fakeClock: true });
    try {
      await paste(page, LONG, { fake: true });
      await page.click("#go");
      await page.clock.runFor(300);
      const r = await page.evaluate(() => {
        const box = el => el.getBoundingClientRect();
        const out = ["watts", "cd", "rpm", "nextTxt", "play", "nextb", "prev", "back", "mute", "hydrOn", "bugRide", "reset"].filter(id => {
          const b = box(document.getElementById(id));
          return b.right > innerWidth + 1 || b.bottom > innerHeight + 1 || b.left < -1 || b.top < -1 || b.width === 0;
        });
        // Partie visible du graphique (sa zone peut être rognée par son conteneur).
        const pb = box(document.querySelector(".prof-box")), g = box(document.querySelector(".global"));
        const p = { left: pb.left, right: pb.right, top: Math.max(pb.top, g.top), bottom: Math.min(pb.bottom, g.bottom) };
        p.height = Math.max(0, p.bottom - p.top);
        const hits = [".controls", ".opts", ".next"].filter(sel => {
          const c = box(document.querySelector(sel));
          return p.left < c.right - 1 && c.left < p.right - 1 && p.top < c.bottom - 1 && c.top < p.bottom - 1;
        });
        return { out, hits, profH: Math.round(p.height) };
      });
      assert.deepEqual(r.out, [], "éléments hors écran");
      assert.deepEqual(r.hits, [], "le graphique recouvre des boutons");
      // 40 px minimum : laisse de la marge aux écarts de polices entre machines (GitHub n'a pas les mêmes).
      assert.ok(r.profH >= 40, `graphique trop écrasé (${r.profH}px)`);
    } finally { await browser.close(); }
  });
}

// ---------- Cas limites ----------

test("un nom de bloc piégé (HTML) s'affiche comme du texte, sans s'exécuter", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    let dialog = false;
    page.on("dialog", d => { dialog = true; d.dismiss(); });
    await paste(page, "<img src=x onerror=alert(1)>: 10min @ 200W", { fake: true });
    await page.click("#go");
    await page.clock.runFor(500);
    assert.equal(dialog, false);
    assert.equal(await page.locator("#rows img, #ride img").count(), 0);
  } finally { await browser.close(); }
});

test("stockage local bloqué (navigation privée) : l'app marche quand même", async () => {
  const { chromium, devices } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    await context.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error("SecurityError"); };
      Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); };
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(PAGE_URL);
    await page.fill("#seance", "10sec @ 200W");
    await page.waitForTimeout(400);
    await page.click("#go");
    await page.click("#play");
    await page.waitForTimeout(1200);
    assert.notEqual((await cockpit(page)).elapsed, "0:00");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("sauvegarde abîmée ou périmée : l'app repart proprement", async () => {
  const { browser, page, errors } = await openApp({ fakeClock: true });
  try {
    for (const bad of ["{pas du json", JSON.stringify({ text: "1min @ 200W", elapsed: 999999999, running: true, at: 0 }), JSON.stringify({ text: null })]) {
      await page.evaluate(v => localStorage.setItem("velo-timer-v1", v), bad);
      await page.reload();
      await page.clock.runFor(500);
      assert.ok(await page.isVisible("#setup") || await page.isVisible("#ride"));
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("sans maintien d'écran possible : prévient, et le chrono tourne quand même", async () => {
  const { chromium, devices } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    await context.addInitScript(() => {
      delete Navigator.prototype.wakeLock;
      HTMLCanvasElement.prototype.captureStream = undefined;
    });
    const page = await context.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.clock.install();
    await page.goto(PAGE_URL);
    await paste(page, SHORT, { fake: true });
    await page.click("#go");
    await page.click("#play");
    await page.clock.runFor(3300);
    assert.match(await page.textContent("#wakeTxt"), /non maintenu/);
    assert.equal((await cockpit(page)).elapsed, "0:03");
  } finally { await browser.close(); }
});

test("rappel « Bois une gorgée » toutes les 15 min, pendant 20 s", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    await paste(page, "50min @ 200W", { fake: true });
    await page.click("#go");
    await page.click("#play");
    // fastForward saute directement à l'instant voulu (runFor rejouerait chaque image : trop lent).
    await page.clock.fastForward(15 * 60000 + 5000);
    await page.clock.runFor(300);
    assert.equal(await page.isVisible("#hydr"), true);
    await page.clock.fastForward(30000);
    await page.clock.runFor(300);
    assert.equal(await page.isVisible("#hydr"), false);
  } finally { await browser.close(); }
});

test("bloc suivant au dernier bloc et précédent au premier : pas de saut hors séance", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    await paste(page, SHORT, { fake: true });
    await page.click("#go");
    await page.click("#prev");
    assert.equal((await cockpit(page)).count, "bloc 1/5");
    for (let i = 0; i < 8; i++) await page.click("#nextb");
    const s = await cockpit(page);
    assert.equal(s.count, "bloc 5/5");
    assert.equal(s.done, false);
  } finally { await browser.close(); }
});

test("fin de séance, retour, puis nouvelle séance : repart de zéro", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    await paste(page, SHORT, { fake: true });
    await page.click("#go");
    await page.click("#play");
    await page.clock.runFor(31000);
    await page.click("#doneBack");
    assert.equal(await page.isVisible("#resume"), false);
    await page.click("#go");
    const s = await cockpit(page);
    assert.deepEqual([s.elapsed, s.count, s.play, s.done], ["0:00", "bloc 1/5", "Démarrer", false]);
  } finally { await browser.close(); }
});

test("modifier la séance après une pause remet le chrono à zéro", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    await paste(page, SHORT, { fake: true });
    await page.click("#go");
    await page.click("#play");
    await page.clock.runFor(12300);
    await page.click("#back");
    assert.equal(await page.isVisible("#resume"), true);
    await paste(page, SHORT + "\n10sec @ 100W", { fake: true });
    assert.equal(await page.isVisible("#resume"), false);
    await page.click("#go");
    assert.equal((await cockpit(page)).elapsed, "0:00");
  } finally { await browser.close(); }
});

test("« Remettre à zéro » demande une confirmation", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    await paste(page, SHORT, { fake: true });
    await page.click("#go");
    await page.click("#play");
    await page.clock.runFor(5300);
    await page.click("#reset");
    assert.notEqual((await cockpit(page)).elapsed, "0:00", "un seul appui ne doit rien effacer");
    await page.click("#reset");
    assert.equal((await cockpit(page)).elapsed, "0:00");
  } finally { await browser.close(); }
});

test("pause / reprise en rafale : le temps reste juste", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    await paste(page, "10min @ 200W", { fake: true });
    await page.click("#go");
    for (let i = 0; i < 10; i++) {
      await page.click("#play");          // marche
      await page.clock.runFor(1000);
      await page.click("#play");          // pause
      await page.clock.runFor(5000);
    }
    const [m, sec] = (await cockpit(page)).elapsed.split(":").map(Number);
    assert.ok(Math.abs(m * 60 + sec - 10) <= 1, `attendu ~0:10, obtenu ${m}:${sec}`);
  } finally { await browser.close(); }
});

test("séance de 300 lignes : lue vite et affichée sans erreur", async () => {
  const { browser, page, errors } = await openApp({ fakeClock: true });
  try {
    const big = Array.from({ length: 300 }, (_, i) => `${(i % 5) + 1}min @ ${150 + i}W`).join("\n");
    const ms = await page.evaluate(t => { const t0 = performance.now(); window.SeanceVelo.read(t); return performance.now() - t0; }, big);
    assert.ok(ms < 300, `lecture en ${Math.round(ms)} ms`);
    await paste(page, big, { fake: true });
    assert.match(await page.textContent("#sumTotal"), /^300 blocs/);
    await page.click("#go");
    await page.click("#play");
    await page.clock.fastForward(60000);
    await page.clock.runFor(300);
    assert.equal((await cockpit(page)).count, "bloc 2/300");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("rotation du téléphone en pleine séance : tout reste à l'écran", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    await paste(page, SHORT, { fake: true });
    await page.click("#go");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.clock.runFor(300);
    const over = await page.evaluate(() => ["watts", "play", "nextb", "prev", "cd"].filter(id => {
      const r = document.getElementById(id).getBoundingClientRect();
      return r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.width === 0;
    }));
    assert.deepEqual(over, []);
  } finally { await browser.close(); }
});

test("bouton « ← Retour » visible sur l'écran de séance", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    await paste(page, SHORT, { fake: true });
    await page.click("#go");
    assert.match(await page.textContent("#back"), /Retour/);
    await page.click("#back");
    assert.equal(await page.isVisible("#setup"), true);
  } finally { await browser.close(); }
});

// ---------- Signaler un problème : copie du rapport + DM Instagram ----------
// On capture le presse-papiers et l'ouverture de la messagerie au lieu de quitter la page.
async function spyBug(page) {
  await page.evaluate(() => {
    window.__copied = null; window.__dm = null;
    navigator.clipboard.writeText = async t => { window.__copied = t; };
    window.SeanceVelo.openDM = url => { window.__dm = url; };
  });
}

test("« Un problème ? Écris-moi » : copie la séance et ouvre le DM Instagram, sans formulaire", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    assert.equal(await page.locator("#bugMsg, #bugSend, details#bug").count(), 0, "plus de formulaire");
    const box = await page.locator("#bugTop").boundingBox();
    assert.ok(box && box.y < 200, "bouton visible en haut sans faire défiler");
    await paste(page, "10min @ 200W\n4x 1min @ 400W, 1min @ 100W", { fake: true });
    await spyBug(page);
    await page.click("#bugTop");
    await page.clock.runFor(300);
    assert.match(await page.textContent("#toast"), /copiée.*@ugo_paul23/);
    const copied = await page.evaluate(() => window.__copied);
    assert.match(copied, /4x 1min @ 400W, 1min @ 100W/, "séance collée dans le rapport");
    assert.match(copied, /9 blocs, 18:00/, "lecture de l'écran dans le rapport");
    assert.doesNotMatch(copied, /Signalé pendant la séance/);
    await page.clock.runFor(2000);
    assert.equal(await page.evaluate(() => window.__dm), "https://ig.me/m/ugo_paul23");
  } finally { await browser.close(); }
});

test("« Bug ? » pendant la séance : met en pause, note la position et ouvre le DM", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    await paste(page, SHORT, { fake: true });
    await page.click("#go");
    await page.click("#play");
    await page.clock.runFor(12300);
    await spyBug(page);
    await page.click("#bugRide");
    await page.clock.runFor(300);
    assert.match(await page.evaluate(() => window.__copied), /Signalé pendant la séance : 0:12 \/ 0:30, bloc 2\/5/);
    const before = (await cockpit(page)).elapsed;
    await page.clock.runFor(5000);
    const s = await cockpit(page);
    assert.equal(s.elapsed, before, "le chrono doit être en pause");
    assert.equal(s.play, "Reprendre");
    assert.equal(await page.evaluate(() => window.__dm), "https://ig.me/m/ugo_paul23");
  } finally { await browser.close(); }
});

test("copie impossible : donne quand même le compte Instagram et ouvre le DM", async () => {
  const { browser, page } = await openApp({ fakeClock: true });
  try {
    await page.evaluate(() => {
      window.__dm = null;
      navigator.clipboard.writeText = async () => { throw new Error("refusé"); };
      document.execCommand = () => false;
      window.SeanceVelo.openDM = url => { window.__dm = url; };
    });
    await page.click("#bugTop");
    await page.clock.runFor(300);
    assert.match(await page.textContent("#toast"), /@ugo_paul23.*capture/);
    await page.clock.runFor(3200);
    assert.equal(await page.evaluate(() => window.__dm), "https://ig.me/m/ugo_paul23");
  } finally { await browser.close(); }
});
