const INK = '#0e0e14';
const S = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
const SHINE = 'stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"';

const ICONS = {

  coin: `
    <circle cx="28" cy="30" r="20" fill="#ffc83d" ${S}/>
    <circle cx="28" cy="30" r="12" fill="none" stroke="#c98f12" stroke-width="4"/>
    <path d="M18 22 a12 12 0 0 1 7 -5" ${SHINE}/>
    <path d="M42 40 h16 l-3 16 h-10z" fill="#40405a" ${S}/>
    <path d="M46 40 a4 4 0 0 1 8 0" fill="none" ${S}/>
    <text x="50" y="53" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="11" fill="#fff">KG</text>`,

  ticket: `
    <path d="M8 16 h48 v10 a6 6 0 0 0 0 12 v10 h-48 v-10 a6 6 0 0 0 0 -12z" fill="#ff6fb5" ${S}/>
    <path d="M22 16 v32" stroke="${INK}" stroke-width="3" stroke-dasharray="4 4"/>
    <circle cx="38" cy="27" r="5" fill="#3bd497" ${S}/><circle cx="46" cy="27" r="5" fill="#3bd497" ${S}/>
    <circle cx="38" cy="35" r="5" fill="#3bd497" ${S}/><circle cx="46" cy="35" r="5" fill="#3bd497" ${S}/>`,

  reels: `
    <rect x="14" y="6" width="36" height="52" rx="8" fill="#f6f1e7" ${S}/>
    <path d="M14 32 h36" stroke="#e5484d" stroke-width="3" stroke-dasharray="4 3"/>
    <path d="M24 12 h16 l5 6 -13 13 -13 -13z" fill="#4fd1ff" ${S} stroke-width="3"/>
    <path d="M21 35 h22 v6 l-10 14 h-7 l9 -14 h-14z" fill="#e5484d" ${S} stroke-width="3"/>`,

  cherry: `
    <path d="M30 26 C34 18 40 14 46 12" fill="none" ${S}/>
    <path d="M46 12 l4 -4 M46 12 l6 1 M46 12 l1 -6" stroke="#ffc83d" stroke-width="3" stroke-linecap="round"/>
    <circle cx="28" cy="40" r="17" fill="#e5484d" ${S}/>
    <path d="M18 34 a10 10 0 0 1 7 -6" ${SHINE}/>
    <path d="M30 24 C24 18 18 18 14 20 C18 26 24 26 30 24z" fill="#3bd497" ${S}/>`,

  wheel: `
    <circle cx="28" cy="34" r="22" fill="#ff9f43" ${S}/>
    <path d="M28 12 v44 M6 34 h44 M12 18 l32 32 M44 18 l-32 32" stroke="${INK}" stroke-width="3"/>
    <circle cx="28" cy="34" r="6" fill="#ffc83d" ${S}/>
    <path d="M52 6 C46 16 44 20 44 24 a8 8 0 0 0 16 0 C60 20 58 16 52 6z" fill="#2a2a38" ${S}/>
    <path d="M48 22 a4 4 0 0 0 2 4" ${SHINE}/>`,

  dice: `
    <rect x="8" y="12" width="40" height="40" rx="10" fill="#4f8cff" ${S}/>
    <circle cx="18" cy="22" r="4" fill="#fff"/><circle cx="28" cy="32" r="4" fill="#fff"/><circle cx="38" cy="42" r="4" fill="#fff"/>
    <path d="M42 42 h16 l-3 16 h-10z" fill="#40405a" ${S}/>
    <path d="M46 42 a4 4 0 0 1 8 0" fill="none" ${S}/>`,

  mines: `
    <path d="M14 10 L36 40" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <rect x="8" y="4" width="12" height="12" rx="3" fill="#a4a2b4" ${S} stroke-width="3"/>
    <ellipse cx="40" cy="44" rx="16" ry="7" fill="#9b6bff" ${S}/>
    <path d="M30 56 h20 l4 -5 -14 -9 -14 9z" fill="#4fd1ff" ${S} stroke-width="3"/>
    <path d="M52 22 a8 8 0 0 1 4 8 M56 16 a14 14 0 0 1 6 14" fill="none" stroke="#3bd497" stroke-width="3" stroke-linecap="round"/>`,

  crash: `
    <rect x="12" y="18" width="32" height="40" rx="6" fill="#e5484d" ${S}/>
    <path d="M18 18 v-8 h16 v8" fill="#a4a2b4" ${S} stroke-width="3"/>
    <path d="M20 30 L36 46 M36 30 L20 46" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <path d="M52 34 C44 24 50 14 54 8 C56 16 62 20 60 30 C59 36 54 38 52 34z" fill="#ffc83d" ${S} stroke-width="3"/>`,

  cards: `
    <rect x="8" y="10" width="34" height="46" rx="6" fill="#f6f1e7" ${S}/>
    <text x="25" y="40" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="22" fill="#e5484d">A</text>
    <path d="M30 56 C36 36 46 22 60 18 C56 30 56 44 60 56z" fill="#3bd497" ${S}/>`,

  clover: `
    <path d="M32 34 C34 46 38 52 44 58" fill="none" ${S}/>
    <circle cx="22" cy="22" r="11" fill="#3bd497" ${S}/><circle cx="42" cy="22" r="11" fill="#3bd497" ${S}/>
    <circle cx="22" cy="42" r="11" fill="#3bd497" ${S}/><circle cx="42" cy="42" r="11" fill="#3bd497" ${S}/>
    <circle cx="32" cy="32" r="6" fill="#ffc83d" ${S} stroke-width="3"/>`,

  rebate: `
    <rect x="6" y="14" width="44" height="30" rx="6" fill="#4f8cff" ${S}/>
    <path d="M6 22 h44" stroke="${INK}" stroke-width="5"/>
    <rect x="12" y="30" width="12" height="8" rx="2" fill="#ffc83d" ${S} stroke-width="3"/>
    <circle cx="46" cy="44" r="14" fill="#3bd497" ${S}/>
    <path d="M40 42 a7 7 0 1 1 4 7" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M37 38 l3 5 5 -3" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,

  time: `
    <rect x="25" y="4" width="12" height="7" rx="2" fill="#a4a2b4" ${S} stroke-width="3"/>
    <circle cx="31" cy="35" r="23" fill="#f6f1e7" ${S}/>
    <circle cx="31" cy="35" r="17" fill="#9b6bff" stroke="${INK}" stroke-width="3"/>
    <path d="M31 35 v-11 M31 35 l7 5" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <circle cx="51" cy="14" r="9" fill="#3bd497" ${S} stroke-width="3"/>
    <path d="M51 9 v10 M46 14 h10" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,

  grace: `
    <path d="M32 56 C10 42 6 30 8 22 C10 12 24 8 32 20 C40 8 54 12 56 22 C58 30 54 42 32 56z" fill="#e5484d" ${S}/>
    <path d="M16 22 a8 8 0 0 1 6 -6" ${SHINE}/>
    <rect x="18" y="28" width="28" height="10" rx="4" transform="rotate(-30 32 33)" fill="#ffd9a8" ${S} stroke-width="3"/>
    <circle cx="30" cy="34" r="1.5" fill="${INK}"/><circle cx="34" cy="32" r="1.5" fill="${INK}"/>`,

  piggy: `
    <circle cx="40" cy="10" r="7" fill="#ffc83d" ${S} stroke-width="3"/>
    <path d="M10 36 C10 24 20 18 32 18 C44 18 54 24 54 36 C54 46 46 52 34 52 H22 C14 52 10 44 10 36z" fill="#ff8fc3" ${S}/>
    <path d="M14 26 l-4 -8 8 4" fill="#ff8fc3" ${S} stroke-width="3"/>
    <rect x="50" y="30" width="10" height="10" rx="4" fill="#ff6fb5" ${S} stroke-width="3"/>
    <path d="M18 52 v6 M42 52 v6" ${S}/>
    <path d="M30 22 h10" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="22" cy="32" r="2.5" fill="${INK}"/>`,

  payday: `
    <rect x="6" y="26" width="40" height="26" rx="6" fill="#ffe14d" ${S}/>
    <circle cx="16" cy="36" r="2" fill="#c98f12"/><circle cx="30" cy="44" r="2" fill="#c98f12"/><circle cx="36" cy="34" r="2" fill="#c98f12"/>
    <circle cx="14" cy="18" r="5" fill="#f6f1e7" ${S} stroke-width="3"/><circle cx="24" cy="12" r="4" fill="#f6f1e7" ${S} stroke-width="3"/>
    <rect x="34" y="8" width="26" height="16" rx="3" transform="rotate(14 47 16)" fill="#3bd497" ${S} stroke-width="3"/>
    <text x="47" y="21" text-anchor="middle" transform="rotate(14 47 16)" font-family="Lilita One, sans-serif" font-size="13" fill="#fff" stroke="${INK}" stroke-width="3" paint-order="stroke">$</text>`,
};

export function perkIcon(id, size = 48) {
  return `<svg class="perk-icon" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${ICONS[id] || ''}</svg>`;
}
