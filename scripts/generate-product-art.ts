import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { seedProducts, type SeedProduct } from '../src/lib/db/seed/data';

const W = 600;
const H = 750;
const palette = {
  espresso: '#4A2C24',
  latte: '#A08977',
  cream: '#F6F1EB',
  foam: '#FFFDFA',
  copper: '#C8763A',
};

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wrap(text: string, max = 16): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function textContrast(hex: string) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16),
    g = parseInt(c.slice(2, 4), 16),
    b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? palette.espresso : palette.foam;
}

function roastDots(level: SeedProduct['roastLevel']) {
  const n = { light: 1, medium: 2, medium_dark: 3, dark: 4 }[level ?? 'medium'];
  return Array.from(
    { length: 4 },
    (_, i) =>
      `<circle cx="${230 + i * 36}" cy="560" r="9" fill="${i < n ? palette.espresso : 'none'}" stroke="${palette.espresso}" stroke-width="3"/>`,
  ).join('');
}

function bag(p: SeedProduct): string {
  const fg = textContrast(p.art.accent);
  const nameLines = wrap(p.name);
  const nameY = 300 - (nameLines.length - 1) * 26;
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.cream}"/><stop offset="1" stop-color="#EDE4DA"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="${palette.espresso}" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g filter="url(#shadow)">
    <path d="M150 150 h300 a20 20 0 0 1 20 20 v470 a28 28 0 0 1 -28 28 h-284 a28 28 0 0 1 -28 -28 v-470 a20 20 0 0 1 20 -20z" fill="${palette.espresso}"/>
    <rect x="130" y="130" width="340" height="52" rx="10" fill="${palette.espresso}"/>
    <rect x="130" y="176" width="340" height="14" fill="#33201A"/>
    <rect x="165" y="230" width="270" height="380" rx="14" fill="${p.art.accent}"/>
  </g>
  <text x="300" y="262" text-anchor="middle" font-family="Georgia, serif" font-size="14" letter-spacing="4" fill="${fg}" opacity="0.85">COFRESSO</text>
  ${nameLines
    .map(
      (l, i) =>
        `<text x="300" y="${nameY + i * 42}" text-anchor="middle" font-family="Georgia, serif" font-weight="600" font-size="34" fill="${fg}">${esc(l)}</text>`,
    )
    .join('')}
  <line x1="220" y1="${nameY + nameLines.length * 42 - 8}" x2="380" y2="${nameY + nameLines.length * 42 - 8}" stroke="${fg}" stroke-opacity="0.5"/>
  ${p.origin ? `<text x="300" y="${nameY + nameLines.length * 42 + 26}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="${fg}" opacity="0.9">${esc(p.origin.toUpperCase())}</text>` : ''}
  ${p.tastingNotes.length ? `<text x="300" y="${nameY + nameLines.length * 42 + 54}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="${fg}" opacity="0.8">${esc(p.tastingNotes.join(' · '))}</text>` : ''}
  <g transform="translate(0,0)">${roastDots(p.roastLevel).replaceAll(palette.espresso, fg)}</g>
  <text x="300" y="595" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12" letter-spacing="2" fill="${fg}" opacity="0.7">${esc(p.process?.toUpperCase() ?? 'WHOLE BEAN')}</text>`;
}

function gear(p: SeedProduct): string {
  const a = p.art.accent;
  const shapes: Record<string, string> = {
    dripper: `<path d="M170 250 h260 l-90 250 h-80z" fill="${a}" stroke="${palette.espresso}" stroke-width="6"/><rect x="220" y="500" width="160" height="30" rx="8" fill="${palette.espresso}"/><rect x="255" y="530" width="90" height="70" rx="6" fill="${palette.latte}"/>`,
    kettle: `<path d="M190 330 q110 -40 220 0 v200 a30 30 0 0 1 -30 30 h-160 a30 30 0 0 1 -30 -30z" fill="${a}"/><path d="M410 380 q90 -60 60 -140" stroke="${a}" stroke-width="22" fill="none" stroke-linecap="round"/><rect x="150" y="300" width="60" height="150" rx="14" fill="${palette.latte}"/><circle cx="300" cy="320" r="18" fill="${palette.foam}"/>`,
    grinder: `<rect x="230" y="260" width="140" height="300" rx="28" fill="${a}"/><rect x="250" y="300" width="100" height="120" rx="12" fill="${palette.foam}" opacity="0.7"/><rect x="290" y="200" width="20" height="70" fill="${palette.espresso}"/><path d="M300 200 h110 a14 14 0 0 1 0 28 h-110" fill="${palette.espresso}"/>`,
    scale: `<rect x="150" y="380" width="300" height="160" rx="22" fill="${a}"/><rect x="180" y="400" width="240" height="60" rx="8" fill="${palette.latte}"/><rect x="200" y="480" width="160" height="34" rx="6" fill="#1a1a1a"/><text x="280" y="505" text-anchor="middle" font-family="monospace" font-size="24" fill="#8CFFB0">18.0 g</text>`,
    filters: `<path d="M160 240 h280 l-90 250 h-100z" fill="${a}" stroke="${palette.latte}" stroke-width="4"/><path d="M175 255 h250 l-85 225 h-80z" fill="${palette.foam}" stroke="${palette.latte}" stroke-width="3"/><path d="M190 270 h220 l-80 200 h-60z" fill="${a}" stroke="${palette.latte}" stroke-width="3"/>`,
    mug: `<rect x="190" y="280" width="200" height="260" rx="26" fill="${a}"/><path d="M390 330 h30 a45 45 0 0 1 0 110 h-30" fill="none" stroke="${a}" stroke-width="28"/><rect x="230" y="330" width="120" height="120" rx="60" fill="${palette.latte}" opacity="0.35"/>`,
  };
  return `
  <rect width="${W}" height="${H}" fill="${palette.cream}"/>
  <ellipse cx="300" cy="590" rx="190" ry="26" fill="${palette.espresso}" opacity="0.12"/>
  ${shapes[p.art.shape] ?? shapes.mug}
  <text x="300" y="660" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="${palette.espresso}">${esc(p.name)}</text>
  <text x="300" y="690" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="14" letter-spacing="3" fill="${palette.latte}">COFRESSO EQUIPMENT</text>`;
}

function render(p: SeedProduct): string {
  const body = p.art.shape === 'bag' ? bag(p) : gear(p);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(p.name)}">${body}\n</svg>\n`;
}

const outDir = path.resolve(process.cwd(), 'public/products');
mkdirSync(outDir, { recursive: true });
for (const p of seedProducts) {
  writeFileSync(path.join(outDir, `${p.slug}.svg`), render(p));
}
console.log(`Wrote ${seedProducts.length} product images to ${outDir}`);
