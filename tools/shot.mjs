// Headless screenshots: node tools/shot.mjs <outdir> <script.json>
import { chromium } from 'playwright';
const [outDir, stepsJson] = process.argv.slice(2);
const steps = JSON.parse(stepsJson);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1152, height: 648 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await p.goto('http://localhost:4173/?skip=title');
await p.waitForFunction(() => window.game && window.game.mode === 'title', null, { timeout: 60000 });
for (const s of steps) {
  if (s.js) { const r = await p.evaluate(s.js); if (r !== undefined) console.log('JS', JSON.stringify(r)); }
  if (s.wait) await p.waitForTimeout(s.wait);
  if (s.key) await p.keyboard.press(s.key);
  if (s.shot) await p.screenshot({ path: `${outDir}/${s.shot}.png` });
}
await b.close();
