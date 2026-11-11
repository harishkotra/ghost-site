import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });
for (const path of ["/", "/graveyard", "/p/nope", "/p/the-premise"]) {
  await p.goto("http://localhost:8787" + path, { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 600));
  const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 260));
  console.log(`\n${path} → ${t}`);
}
await b.close();
