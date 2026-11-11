/** Renders public/og.png from the home hero using the fixture payload. */
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const { state } = JSON.parse(readFileSync("/tmp/fixtures.json", "utf8"));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });
await page.setRequestInterception(true);
page.on("request", (req) => {
  if (req.url().includes("/api/state")) {
    return req.respond({ contentType: "application/json", body: JSON.stringify(state) });
  }
  req.continue();
});
await page.goto("http://localhost:8787/", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: "public/og.png" });
console.log("og.png written");
await browser.close();
