// Ouvre index.html dans un Chromium qui imite un iPhone (taille, tactile, user agent).
import { chromium, devices } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PAGE_URL = process.env.SEANCE_URL || pathToFileURL(path.join(ROOT, "index.html")).href;

export async function openApp({ device = "iPhone 13", fakeClock = false } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices[device] });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  // Les polices Google ne changent rien au fonctionnement : on les coupe pour que les tests marchent hors ligne.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (fakeClock) await page.clock.install();
  await page.goto(PAGE_URL);
  return { browser, context, page, errors };
}

// Résultat de lecture d'un texte, tel que l'app le calcule.
export async function read(page, text, ftp) {
  return page.evaluate(([t, f]) => {
    const r = window.SeanceVelo.read(t, f);
    return {
      total: Math.round(r.total / 1000),
      warnings: r.warnings,
      blocks: r.blocks.map(b => ({ dur: b.dur, a: b.a, b: b.b, rpm: b.rpm ? (b.rpm.lo === b.rpm.hi ? b.rpm.lo : `${b.rpm.lo}-${b.rpm.hi}`) : null, name: b.name }))
    };
  }, [text, ftp ?? null]);
}

// Tape un texte dans le champ comme le ferait quelqu'un, et attend la mise à jour.
export async function paste(page, text, { fake = false } = {}) {
  await page.fill("#seance", text);
  if (fake) await page.clock.runFor(400); else await page.waitForTimeout(400);
}

export const cockpit = page => page.evaluate(() => {
  const t = id => document.getElementById(id).textContent;
  return { name: t("bname"), count: t("bcount"), watts: t("watts"), rpm: t("rpm"), left: t("cd"), elapsed: t("elapsed"), play: t("play"), done: !document.getElementById("done").hidden };
});
