import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { CARDS, ensureDir } from './paths.js';

// pnpm card <name> --text "Line" [--sub "Smaller line"] [--theme dark|light]
// pnpm card <name> --html path/to/card.html    (your own 1920x1080 page)
// pnpm card <name> --url https://...  [--wait 3] [--scroll 400]  (a web page screenshot)
// Writes out/cards/<name>.png at 1920x1080.

const FONT = `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;

export function textCard(text: string, sub = '', theme: 'dark' | 'light' = 'dark'): string {
  const bg = theme === 'dark' ? '#000' : '#f4f4f6';
  const fg = theme === 'dark' ? '#fff' : '#111';
  const dim = theme === 'dark' ? '#9a9aa0' : '#5a5a60';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;width:1920px;height:1080px;background:${bg};color:${fg};font-family:${FONT}}
    main{height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 200px;box-sizing:border-box}
    h1{font-size:76px;line-height:1.12;font-weight:700;letter-spacing:-0.02em;margin:0;max-width:1400px}
    p{font-size:38px;line-height:1.35;color:${dim};margin:36px 0 0;max-width:1400px}
  </style><main><h1>${esc(text)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</main>`;
}

// One caption, bottom-centred on a transparent 1920x1080 frame.
export function captionHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;width:1920px;height:1080px;background:transparent;font-family:${FONT}}
    div{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);max-width:1400px;text-align:center;
      font-size:40px;line-height:1.3;font-weight:600;color:#fff;background:rgba(0,0,0,.72);padding:10px 22px;border-radius:10px}
  </style><div>${esc(text)}</div>`;
}

export async function renderPngs(jobs: Array<{ html: string; out: string; transparent?: boolean }>): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const job of jobs) {
    await page.setContent(job.html, { waitUntil: 'load' });
    await page.screenshot({ path: job.out, omitBackground: job.transparent ?? false });
  }
  await browser.close();
}

async function main(): Promise<void> {
  const [name, ...rest] = process.argv.slice(2);
  const opt = (flag: string) => {
    const i = rest.indexOf(flag);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (!name) {
    console.error('usage: pnpm card <name> --text "..." [--sub "..."] [--theme dark|light] | --html file | --url https://...');
    process.exit(1);
  }
  const out = join(ensureDir(CARDS), `${name}.png`);
  const url = opt('--url');
  if (url) {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForTimeout(Number(opt('--wait') ?? 3) * 1000);
    const scroll = Number(opt('--scroll') ?? 0);
    if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll);
    await page.waitForTimeout(500);
    await page.screenshot({ path: out });
    await browser.close();
  } else {
    const htmlFile = opt('--html');
    const html = htmlFile
      ? readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), htmlFile), 'utf8')
      : textCard(opt('--text') ?? '', opt('--sub') ?? '', (opt('--theme') as 'dark' | 'light') ?? 'dark');
    await renderPngs([{ html, out }]);
  }
  console.log(out);
}

if (process.argv[1]?.endsWith('cards.ts')) await main();
