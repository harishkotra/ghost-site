import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const url = process.argv[2] || "http://localhost:8787/";
const out = process.argv[3] || "/tmp/gs.png";
const w = Number(process.argv[4] || 1440);
const h = Number(process.argv[5] || 1000);
const full = process.argv[6] === "full";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1"],
});
const page = await browser.newPage();
await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("requestfailed", (r) => errors.push("reqfail: " + r.url() + " " + r.failure()?.errorText));

await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: out, fullPage: full });

const audit = await page.evaluate(() => {
  const docW = document.documentElement.clientWidth;
  const overflowing = [...document.querySelectorAll("body *")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > docW + 1.5 || r.left < -1.5);
    })
    .slice(0, 12)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} [${Math.round(r.left)},${Math.round(r.right)}] "${(el.textContent || "").trim().slice(0, 40)}"`;
    });

  const docH = document.documentElement.scrollHeight;

  return {
    title: document.title,
    docW,
    docH,
    overflowing,
    count: document.querySelectorAll("body *").length,
    hero: (() => {
      const el = document.querySelector("h1");
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { text: el.textContent?.slice(0, 80), size: cs.fontSize, family: cs.fontFamily, w: Math.round(r.width), h: Math.round(r.height) };
    })(),
    buttons: [...document.querySelectorAll("button, a.btn")].slice(0, 10).map((b) => {
      const cs = getComputedStyle(b);
      const r = b.getBoundingClientRect();
      return `${b.tagName.toLowerCase()} "${(b.textContent || "").trim().slice(0, 28)}" bg=${cs.backgroundColor} fg=${cs.color} ${Math.round(r.width)}x${Math.round(r.height)}`;
    }),
    fonts: [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`).slice(0, 8),
  };
});

console.log(JSON.stringify({ audit, errors: errors.slice(0, 10) }, null, 2));
await browser.close();
