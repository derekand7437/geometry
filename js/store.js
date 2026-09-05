import { api } from "./api.js";
import { debounce } from "./util.js";

/**
 * Progress for one subject. Local-first: localStorage is written synchronously so the page
 * is correct offline and on first paint, and the server copy is merged in and pushed behind it.
 */
class Store {
  constructor(){
    this.subject = null;
    this.planLength = 0;
    this.state = { stats: {}, days: {}, all: false, last: null, streak: 0 };
    this.queue = [];
    this.listeners = [];
    this.push = debounce(() => this.pushRemote(), 700);
    this.flushAttempts = debounce(() => this.sendAttempts(), 2500);
  }

  init(subject, planLength){
    this.subject = subject;
    this.planLength = planLength;
    this.key = "studyapp." + subject;
    this.readLocal();
    addEventListener("pagehide", () => { this.push.flush(); this.sendAttempts(true); });
    return this;
  }

  onChange(fn){ this.listeners.push(fn); }
  emit(){ this.listeners.forEach(fn => fn(this.state)); }

  /* ---------- persistence ---------- */
  readLocal(){
    try {
      const raw = JSON.parse(localStorage.getItem(this.key) || "{}");
      this.state = Object.assign(this.state, raw);
    } catch {}
  }
  writeLocal(){ try { localStorage.setItem(this.key, JSON.stringify(this.state)); } catch {} }

  save(){ this.writeLocal(); this.emit(); if (api.signedIn) this.push(); }

  async pushRemote(){ if (api.signedIn) await api.putProgress(this.subject, this.state); }

  /** Merge two progress blobs conservatively: never lose a completed day or a correct answer. */
  static merge(a, b){
    const out = { stats: {}, days: {}, all: a.all || b.all, last: null, streak: Math.max(a.streak || 0, b.streak || 0) };
    for (const src of [a, b]){
      for (const t in (src.stats || {})){
        const cur = out.stats[t] || { c: 0, t: 0 };
        out.stats[t] = { c: Math.max(cur.c, src.stats[t].c || 0), t: Math.max(cur.t, src.stats[t].t || 0) };
      }
      for (const d in (src.days || {})){
        const cur = out.days[d] || { c: 0 };
        out.days[d] = { c: Math.max(cur.c, src.days[d].c || 0), done: !!(cur.done || src.days[d].done) };
      }
    }
    out.last = [a.last, b.last].filter(Boolean).sort().pop() || null;
    return out;
  }

  /** Called after sign-in and on load: pull the server copy and reconcile it with local. */
  async sync(){
    if (!api.signedIn || !this.subject || !(await api.detect())) return false;
    const res = await api.getProgress(this.subject);
    if (!res.ok) return false;
    const remote = (res.data && res.data.data) || {};
    this.state = Store.merge(this.state, remote);
    this.writeLocal();
    this.emit();
    await this.pushRemote();
    return true;
  }

  /* ---------- topic accuracy ---------- */
  bump(topic, correct){
    const s = this.state.stats[topic] || (this.state.stats[topic] = { c: 0, t: 0 });
    s.t++; if (correct) s.c++;
    this.queue.push({ subject: this.subject, topic, correct: correct ? 1 : 0, at: Date.now() });
    if (api.signedIn) this.flushAttempts();
    this.save();
  }
  async sendAttempts(sync){
    if (!api.signedIn || !this.queue.length) return;
    const rows = this.queue.splice(0, this.queue.length);
    if (sync && navigator.sendBeacon){
      navigator.sendBeacon("/api/attempts?token=" + encodeURIComponent(api.token),
        new Blob([JSON.stringify({ attempts: rows })], { type: "application/json" }));
      return;
    }
    const res = await api.postAttempts(rows);
    if (!res.ok) this.queue.unshift(...rows);
  }
  totals(){
    let c = 0, t = 0;
    for (const k in this.state.stats){ c += this.state.stats[k].c; t += this.state.stats[k].t; }
    return { c, t };
  }

  /* ---------- the day path ---------- */
  dayDone(n){ return !!(this.state.days[n] && this.state.days[n].done); }
  dayCount(n){ return (this.state.days[n] && this.state.days[n].c) || 0; }
  doneTotal(){ let t = 0; for (let i = 1; i <= this.planLength; i++) if (this.dayDone(i)) t++; return t; }
  nextOpen(){ for (let i = 1; i <= this.planLength; i++) if (!this.dayDone(i)) return i; return this.planLength; }
  isOpen(n){ return this.state.all || n <= this.nextOpen(); }

  countCorrect(n){
    const d = this.state.days[n] || (this.state.days[n] = { c: 0 });
    d.c = (d.c || 0) + 1;
    this.save();
    return d.c;
  }
  completeDay(n){
    const d = this.state.days[n] || (this.state.days[n] = { c: 0 });
    if (d.done) return false;
    d.done = true;
    const today = Store.stamp(new Date());
    if (this.state.last !== today){
      const gap = this.gapDays();
      this.state.streak = gap === 1 ? (this.state.streak || 0) + 1 : 1;
      this.state.last = today;
    }
    this.save();
    return true;
  }
  toggleAll(){ this.state.all = !this.state.all; this.save(); return this.state.all; }
  reset(){
    this.state = { stats: {}, days: {}, all: this.state.all, last: null, streak: 0 };
    this.save();
  }

  static stamp(d){ return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  static dnum(s){ const q = s.split("-"); return Math.round(Date.UTC(+q[0], +q[1] - 1, +q[2]) / 864e5); }
  gapDays(){ return this.state.last ? Store.dnum(Store.stamp(new Date())) - Store.dnum(this.state.last) : null; }
}

export const store = new Store();
export const bump = (topic, ok) => store.bump(topic, ok);
