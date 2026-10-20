import { useEffect } from 'react';

/**
 * Legacy decorative backdrop (neon canvas, grain, ribbons, flares).
 *
 * It belongs to the pages that have not been migrated to the new design
 * system yet. It is rendered by the legacy shell only, so new pages are
 * never affected by it. Removed in the cleanup phase.
 */

const RIBBON_PATHS = [
  'M-120 190 C 220 60, 430 330, 700 205 S 1160 40, 1560 210',
  'M-120 330 C 260 430, 480 180, 760 330 S 1210 470, 1560 300',
  'M-120 500 C 240 580, 470 380, 730 490 S 1180 610, 1560 470',
  'M-120 640 C 200 530, 520 780, 840 650 S 1260 520, 1560 670',
  'M-120 790 C 300 910, 560 690, 880 810 S 1290 910, 1560 770',
  'M 320 -140 C 410 190, 190 410, 330 710 S 430 1040, 300 1140',
];

const ribbonMarkup = (className, withBlur = true, limit = RIBBON_PATHS.length) => `
  <defs>
    <linearGradient id="stream-cyan-${className}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22D3EE" stop-opacity="0" />
      <stop offset="38%" stop-color="#67E8F9" stop-opacity="0.95" />
      <stop offset="58%" stop-color="#22D3EE" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#22D3EE" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="stream-indigo-${className}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4F46E5" stop-opacity="0" />
      <stop offset="45%" stop-color="#818CF8" stop-opacity="0.9" />
      <stop offset="70%" stop-color="#22D3EE" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#4F46E5" stop-opacity="0" />
    </linearGradient>
  </defs>
  ${RIBBON_PATHS.slice(0, limit)
    .map(
      (d, i) => `
      ${withBlur ? `<path class="ribbon ribbon-blur" style="animation-delay: ${-i * 1.7}s; animation-duration: ${13 + i * 2}s" d="${d}" stroke="url(#stream-${i % 2 ? 'indigo' : 'cyan'}-${className})" />` : ''}
      <path class="ribbon" style="animation-delay: ${-i * 1.7}s; animation-duration: ${13 + i * 2}s" d="${d}" stroke="url(#stream-${i % 2 ? 'indigo' : 'cyan'}-${className})" />`
    )
    .join('')}
`;

const createRibbonLayer = (className, withBlur = true, limit = RIBBON_PATHS.length) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 1440 900');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ribbonMarkup(className, withBlur, limit);
  return svg;
};

export default function LegacyBackdrop() {
  useEffect(() => {
    document.body.classList.add('neon-theme');

    const canvas = document.createElement('div');
    canvas.className = 'neon-bg';
    document.body.insertBefore(canvas, document.body.firstChild);

    const grain = document.createElement('div');
    grain.className = 'neon-grain';
    document.body.insertBefore(grain, canvas.nextSibling);

    const ribbons = createRibbonLayer('energy-ribbons');
    document.body.insertBefore(ribbons, grain.nextSibling);

    const flares = document.createElement('div');
    flares.className = 'lens-flares';
    flares.innerHTML = `
      <span class="flare-streak"></span>
      <span class="flare-ghost flare-ghost-1"></span>
      <span class="flare-ghost flare-ghost-2"></span>
      <span class="flare-core"></span>
    `;
    document.body.insertBefore(flares, ribbons.nextSibling);

    const ribbonsFront = createRibbonLayer('energy-ribbons-front', false, 3);
    document.body.insertBefore(ribbonsFront, flares.nextSibling);

    const edge = document.createElement('div');
    edge.className = 'chromatic-edge';
    document.body.appendChild(edge);

    const tints = [
      'rgba(139, 92, 246, 0.5)',
      'rgba(37, 99, 235, 0.45)',
      'rgba(34, 211, 238, 0.34)',
      'rgba(109, 40, 217, 0.42)',
    ];
    for (let i = 0; i < 5; i++) {
      const orb = document.createElement('div');
      orb.className = 'neon-orb';
      const size = 320 + Math.random() * 420;
      orb.style.width = `${size}px`;
      orb.style.height = `${size}px`;
      orb.style.left = `${Math.random() * 100}vw`;
      orb.style.top = `${Math.random() * 100}vh`;
      orb.style.background = tints[i % tints.length];
      orb.style.animationDelay = `${-i * 5.5}s`;
      orb.style.animationDuration = `${24 + i * 4}s`;
      canvas.appendChild(orb);
    }

    return () => {
      [edge, ribbonsFront, flares, ribbons, grain, canvas].forEach((node) => {
        if (node && node.parentNode) node.parentNode.removeChild(node);
      });
    };
  }, []);

  return null;
}
