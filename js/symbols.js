const INK = '#0e0e14';
const S = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

const ART = {
  cherry: `
    <path d="M24 40 C26 26 32 16 44 10 M44 40 C42 28 42 18 44 10" fill="none" ${S}/>
    <path d="M44 10 C52 8 58 12 58 18 C50 20 46 16 44 10z" fill="#3bd497" ${S}/>
    <circle cx="22" cy="44" r="12" fill="#e5484d" ${S}/>
    <circle cx="44" cy="46" r="12" fill="#e5484d" ${S}/>
    <path d="M17 40 a5 5 0 0 1 5 -4 M39 42 a5 5 0 0 1 5 -4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  lemon: `
    <path d="M4 34 C10 20 20 14 32 14 C44 14 54 20 60 34 C54 46 44 52 32 52 C20 52 10 46 4 34z" fill="#ffe14d" ${S}/>
    <path d="M32 14 C30 8 34 4 42 4 C42 10 38 14 32 14z" fill="#3bd497" ${S}/>
    <path d="M16 28 C20 23 25 21 30 20" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  bell: `
    <path d="M32 8 C20 8 16 20 16 30 L16 40 L10 48 L54 48 L48 40 L48 30 C48 20 44 8 32 8z" fill="#ffc83d" ${S}/>
    <circle cx="32" cy="53" r="6" fill="#ff9f43" ${S}/>
    <circle cx="32" cy="7" r="4" fill="#ffc83d" ${S}/>
    <path d="M23 22 C24 18 26 16 29 15" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  clover: `
    <path d="M32 34 C34 44 38 50 46 56" fill="none" ${S}/>
    <circle cx="22" cy="22" r="11" fill="#3bd497" ${S}/>
    <circle cx="42" cy="22" r="11" fill="#3bd497" ${S}/>
    <circle cx="22" cy="40" r="11" fill="#3bd497" ${S}/>
    <circle cx="42" cy="40" r="11" fill="#3bd497" ${S}/>
    <circle cx="32" cy="31" r="5" fill="#21a67a" ${S}/>`,
  diamond: `
    <path d="M18 10 L46 10 L58 26 L32 56 L6 26z" fill="#4fd1ff" ${S}/>
    <path d="M6 26 L58 26 M18 10 L26 26 L32 56 L38 26 L46 10" fill="none" ${S}/>
    <path d="M14 22 L20 14" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  seven: `
    <path d="M10 10 L54 10 L54 20 L34 56 L18 56 L36 22 L10 22z" fill="#e5484d" ${S}/>
    <path d="M14 14 L30 14" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  star: `
    <path d="M32 6 L39 23 L58 24 L43 36 L48 55 L32 44 L16 55 L21 36 L6 24 L25 23z" fill="#ffc83d" ${S}/>
    <path d="M28 16 L26 22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  coin: `
    <circle cx="32" cy="32" r="24" fill="#ffc83d" ${S}/>
    <circle cx="32" cy="32" r="16" fill="none" stroke="#c98f12" stroke-width="4"/>
    <text x="32" y="41" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="26" fill="#fff" stroke="${INK}" stroke-width="4" paint-order="stroke">$</text>`,
  bomb: `
    <path d="M40 16 C44 8 52 8 56 4" fill="none" ${S}/>
    <path d="M56 4 l3 -2 M56 4 l3 3 M56 4 l-1 -4" stroke="#ffc83d" stroke-width="3" stroke-linecap="round"/>
    <rect x="34" y="14" width="12" height="10" rx="2" transform="rotate(40 40 19)" fill="#40405a" ${S}/>
    <circle cx="28" cy="38" r="20" fill="#2a2a38" ${S}/>
    <path d="M18 30 a12 12 0 0 1 8 -7" fill="none" stroke="#a4a2b4" stroke-width="4" stroke-linecap="round"/>`,
  horseshoe: `
    <path d="M14 54 L14 30 C14 16 22 8 32 8 C42 8 50 16 50 30 L50 54 L40 54 L40 30 C40 22 37 18 32 18 C27 18 24 22 24 30 L24 54z" fill="#a4a2b4" ${S}/>
    <circle cx="19" cy="40" r="2" fill="${INK}"/><circle cx="45" cy="40" r="2" fill="${INK}"/>`,
};

export const SYMBOLS = Object.keys(ART);

export function symbolSvg(name, size = 64) {
  return `<svg class="sym" viewBox="0 0 64 64" width="${size}" height="${size}" aria-label="${name}" role="img">${ART[name]}</svg>`;
}
