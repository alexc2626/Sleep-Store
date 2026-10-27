// Fallback product illustrations, used until real supplier photos are added.
export const ICONS = {
  mask:'<svg viewBox="0 0 100 60" fill="none"><path d="M5 30c0-14 20-22 45-22s45 8 45 22-14 22-28 22c-8 0-11-8-17-8s-9 8-17 8C19 52 5 44 5 30z" fill="#f7dcb4"/><circle cx="30" cy="30" r="6" fill="#4b3f8f"/><circle cx="70" cy="30" r="6" fill="#4b3f8f"/></svg>',
  headband:'<svg viewBox="0 0 100 60" fill="none"><rect x="4" y="16" width="92" height="28" rx="14" fill="#c9c3f0"/><path d="M30 30h40" stroke="#4b3f8f" stroke-width="4" stroke-linecap="round"/><circle cx="22" cy="30" r="5" fill="#4b3f8f"/><circle cx="78" cy="30" r="5" fill="#4b3f8f"/></svg>',
  gun:'<svg viewBox="0 0 100 100" fill="none"><rect x="20" y="18" width="52" height="26" rx="13" fill="#f7dcb4"/><rect x="38" y="40" width="16" height="44" rx="8" fill="#f7dcb4"/><circle cx="82" cy="31" r="10" fill="#f0ad55"/></svg>',
  lamp:'<svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="40" r="28" fill="#ffd59a"/><circle cx="50" cy="40" r="16" fill="#f0ad55"/><rect x="46" y="66" width="8" height="22" fill="#f7dcb4"/><rect x="30" y="86" width="40" height="6" rx="3" fill="#f7dcb4"/></svg>',
  clock:'<svg viewBox="0 0 100 100" fill="none"><path d="M14 74a36 36 0 0172 0z" fill="#ffd59a"/><rect x="10" y="74" width="80" height="10" rx="5" fill="#f7dcb4"/><path d="M50 30v-12M26 40l-8-8M74 40l8-8" stroke="#ffd59a" stroke-width="4" stroke-linecap="round"/></svg>',
  neck:'<svg viewBox="0 0 100 100" fill="none"><path d="M14 38c0 30 16 46 36 46s36-16 36-46" stroke="#f7dcb4" stroke-width="16" stroke-linecap="round"/><circle cx="36" cy="72" r="5" fill="#f0ad55"/><circle cx="64" cy="72" r="5" fill="#f0ad55"/></svg>',
  mat:'<svg viewBox="0 0 100 100" fill="none"><rect x="14" y="20" width="72" height="60" rx="6" fill="#c9c3f0"/><g fill="#4b3f8f">'+Array.from({length:20},(_,i)=>`<circle cx="${24+(i%5)*13}" cy="${30+Math.floor(i/5)*13}" r="3.5"/>`).join('')+'</g></svg>',
  eye:'<svg viewBox="0 0 100 60" fill="none"><rect x="6" y="14" width="88" height="32" rx="16" fill="#f7dcb4"/><ellipse cx="32" cy="30" rx="12" ry="7" fill="#c66a6a"/><ellipse cx="68" cy="30" rx="12" ry="7" fill="#c66a6a"/></svg>',
  diffuser:'<svg viewBox="0 0 100 100" fill="none"><path d="M50 14c8 10 12 18 0 30-12-12-8-20 0-30z" fill="#ffd59a"/><path d="M28 50h44l-6 36H34z" fill="#f7dcb4"/></svg>',
  noise:'<svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="34" fill="#c9c3f0"/><circle cx="50" cy="50" r="20" fill="#4b3f8f"/><path d="M50 40v20M42 45v10M58 45v10" stroke="#c9c3f0" stroke-width="3" stroke-linecap="round"/></svg>',
  pillow:'<svg viewBox="0 0 100 100" fill="none"><path d="M14 30q36-14 72 0 6 20 0 40-36 14-72 0-6-20 0-40z" fill="#f2e6f7"/><path d="M28 50q22 8 44 0" stroke="#c9c3f0" stroke-width="3"/></svg>',
  roller:'<svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="34" r="20" fill="#d9f0ff"/><rect x="45" y="52" width="10" height="36" rx="5" fill="#f7dcb4"/></svg>'
};
