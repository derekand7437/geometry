export const $  = (sel, root) => (root || document).querySelector(sel);
export const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

export const rnd = a => a[Math.floor(Math.random() * a.length)];
export const ri  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

export function shuffle(a){
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** Pick one mode from opt.modes, or from the generator's full list when unconstrained. */
export function modeOf(opt, all){
  const m = (opt && opt.modes && opt.modes.length) ? opt.modes : all;
  return rnd(m);
}

/** Build a shuffled multiple-choice list: the right answer plus n-1 wrong ones. */
export function withDistractors(correct, pool, n){
  const out = [correct];
  let guard = 0;
  while (out.length < n && guard++ < 400){
    const c = rnd(pool);
    if (out.indexOf(c) < 0) out.push(c);
  }
  return shuffle(out);
}

export function debounce(fn, ms){
  let t = null;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.flush = () => { if (t){ clearTimeout(t); t = null; fn(); } };
  return wrapped;
}

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
