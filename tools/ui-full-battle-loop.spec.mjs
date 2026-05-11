import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from 'playwright/test';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function pickKeyLines(proofText) {
  const lines = String(proofText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const keys = [
    'DriverComboFinished',
    'BladeComboFinished',
    'TokenCreated',
    'SpecialHit',
    'SpecialConsumed',
    'BladeComboStarted',
    'BladeComboAdvanced',
  ];
  const picked = [];
  for (const k of keys) {
    const hit = lines.find((l) => l.includes(k));
    if (hit) picked.push(hit);
  }
  return picked;
}

test('Run Full Battle Loop keeps paused and shows token HUD', async ({ page }) => {
  const url = process.env.E2E_URL || 'http://127.0.0.1:8000/';
  const outDir = process.env.E2E_OUT_DIR || path.resolve('artifacts');
  ensureDir(outDir);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  await page.locator('#scFullBattleLoop').click();

  const scResult = page.locator('#scResult');
  await expect(scResult).toHaveText(/PASS|FAIL/, { timeout: 30_000 });

  const result = (await scResult.textContent())?.trim() || '-';
  const proof = (await page.locator('#scProof').textContent()) || '';

  const frame1 = Number(((await page.locator('#frame').textContent()) || '0').trim()) | 0;
  await page.waitForTimeout(350);
  const frame2 = Number(((await page.locator('#frame').textContent()) || '0').trim()) | 0;
  const paused = frame1 === frame2;

  await expect(page.locator('#c')).toBeVisible();
  await page.locator('#c').screenshot({ path: path.join(outDir, 'ui-full-battle-loop-canvas.png') });
  await page.screenshot({ path: path.join(outDir, 'ui-full-battle-loop-page.png'), fullPage: true });

  const keyLines = pickKeyLines(proof);
  const report = [
    `url: ${url}`,
    `result: ${result}`,
    `paused: ${paused} (frame ${frame1} -> ${frame2})`,
    '',
    'key proof lines:',
    ...keyLines.map((l) => `- ${l}`),
    '',
    'full proof:',
    proof.trimEnd(),
    '',
    `canvas_screenshot: ${path.join(outDir, 'ui-full-battle-loop-canvas.png')}`,
    `page_screenshot: ${path.join(outDir, 'ui-full-battle-loop-page.png')}`,
  ].join('\n');

  fs.writeFileSync(path.join(outDir, 'ui-full-battle-loop-proof.txt'), report, 'utf8');
  process.stdout.write(`${report}\n`);

  expect(result).toBe('PASS');
  expect(paused).toBe(true);
});
