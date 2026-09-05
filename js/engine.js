import { $, $$ } from "./util.js";
import { store } from "./store.js";
import { api } from "./api.js";

/**
 * One drill panel. `cfg.target` switches it from library mode (running accuracy)
 * into day mode (progress pips and a completion banner).
 */
function initDrill(host, cfg, app){
  const gen = app.generators[cfg.topic];
  if (!gen) throw new Error("no generator for topic: " + cfg.topic);
  let current = null, locked = false, selected = null;

  host.innerHTML =
    `<div class="drill-head"><span class="${app.labelClass}">Practice</span><span class="score"></span></div>` +
    `<div class="${app.bodyClass}">` +
      `<figure class="qfig" hidden></figure>` +
      `<p class="qtext"></p>` +
      `<div class="qbody"></div>` +
      `<div class="fb" role="status" aria-live="polite"></div>` +
      `<div class="steps" hidden><ol></ol></div>` +
      `<div class="btns">` +
        `<button class="btn primary" data-a="check">Check answer</button>` +
        `<button class="btn" data-a="steps">Show steps</button>` +
        `<button class="btn" data-a="next">New problem</button>` +
      `</div>` +
      `<div class="banner-slot"></div>` +
    `</div>`;

  const elFig = $(".qfig", host), elQ = $(".qtext", host), elB = $(".qbody", host),
        elF = $(".fb", host), elS = $(".steps", host), elScore = $(".score", host),
        elSlot = $(".banner-slot", host);
  const bCheck = $('[data-a="check"]', host), bSteps = $('[data-a="steps"]', host), bNext = $('[data-a="next"]', host);

  function score(){
    if (cfg.target){
      const got = Math.min(store.dayCount(cfg.day), cfg.target);
      let pips = "";
      for (let i = 0; i < cfg.target; i++) pips += `<span class="pip${i < got ? " on" : ""}"></span>`;
      elScore.className = "tgt";
      elScore.innerHTML = pips + `<span class="tgtxt">${got} of ${cfg.target} to finish</span>`;
    } else {
      const st = store.state.stats[cfg.topic] || { c: 0, t: 0 };
      elScore.className = "score";
      elScore.textContent = st.t ? `${st.c} / ${st.t} correct` : "no attempts yet";
    }
  }

  function next(){
    current = gen(cfg.opt || null);
    locked = false; selected = null;
    elF.className = "fb"; elF.textContent = "";
    elS.hidden = true; $("ol", elS).innerHTML = "";
    bCheck.disabled = false;

    if (current.fig){ elFig.hidden = false; elFig.innerHTML = current.fig; }
    else { elFig.hidden = true; elFig.innerHTML = ""; }

    elQ.innerHTML = current.prompt;

    let h = "";
    if (current.big) h += `<div class="bigwrap"><span class="big">${current.big}</span></div>`;
    if (current.kind === "mc"){
      h += `<div class="choices">${current.choices.map((c, i) => `<button class="choice" data-i="${i}">${c}</button>`).join("")}</div>`;
    } else if (current.kind === "coefs"){
      h += `<div class="eqline">`;
      current.terms.forEach((t, i) => {
        if (i > 0) h += `<span class="op">${i === current.react ? "→" : "+"}</span>`;
        const label = app.formatTerm ? app.formatTerm(t) : t;
        h += `<span class="term"><input class="in tiny" type="text" inputmode="numeric" autocomplete="off" aria-label="Coefficient for ${t}"> ${label}</span>`;
      });
      h += `</div>`;
    } else if (current.kind === "point"){
      h += `<div class="ansrow"><input class="in mono" type="text" autocomplete="off" placeholder="(x, y)" aria-label="Your answer"><span class="unitlabel">as a point</span></div>`;
    } else {
      h += `<div class="ansrow"><input class="in${current.mono ? " mono" : ""}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${current.placeholder || "your answer"}" aria-label="Your answer">` +
           (current.unit ? `<span class="unitlabel">${current.unit}</span>` : "") + `</div>`;
    }
    elB.innerHTML = h;

    if (current.kind === "mc"){
      $$(".choice", elB).forEach(b => b.addEventListener("click", () => {
        if (locked) return;
        $$(".choice", elB).forEach(x => x.classList.remove("sel"));
        b.classList.add("sel");
        selected = b.innerHTML;
      }));
    }
    $$("input", elB).forEach(i => i.addEventListener("keydown", e => {
      if (e.key === "Enter"){ e.preventDefault(); check(); }
    }));
  }

  function reveal(){
    elS.hidden = false;
    $("ol", elS).innerHTML = current.steps.map(s => `<li>${s}</li>`).join("");
  }

  function check(){
    if (locked || !current) return;
    let ok = false, note = "";

    if (current.kind === "mc"){
      if (!selected){ elF.className = "fb bad show"; elF.textContent = "Pick one first."; return; }
      ok = selected === current.correct;
      $$(".choice", elB).forEach(b => {
        b.classList.remove("sel");
        if (b.innerHTML === current.correct) b.classList.add("right");
        else if (b.innerHTML === selected) b.classList.add("wrong");
      });
    } else if (current.kind === "coefs"){
      const vals = $$("input", elB).map(i => i.value.trim());
      if (vals.some(v => v === "")){
        elF.className = "fb bad show";
        elF.textContent = "Fill in every coefficient — including the ones that are 1.";
        return;
      }
      ok = current.check(vals);
    } else {
      const v = $("input", elB).value.trim();
      if (!v){ elF.className = "fb bad show"; elF.textContent = "Type an answer first."; return; }
      ok = current.check(v);
      if (!ok && current.near && current.near(v))
        note = "So close &mdash; check your capitalization. An element symbol is one capital letter, then lowercase.";
    }

    locked = true;
    bCheck.disabled = true;
    store.bump(cfg.topic, ok);
    elF.className = "fb " + (ok ? "good" : "bad") + " show";
    elF.innerHTML = ok ? `Correct &mdash; ${current.answer}.` : (note || `Not quite. The answer is ${current.answer}.`);
    reveal();
    if (cfg.onAnswer) cfg.onAnswer(ok);
    score();
  }

  bCheck.addEventListener("click", check);
  bSteps.addEventListener("click", () => { if (current) reveal(); });
  bNext.addEventListener("click", () => { next(); const i = $("input", elB); if (i) i.focus(); });

  score(); next();
  return { refresh: score, banner: html => { elSlot.innerHTML = html; } };
}

/** Boot the whole page: library drills, the day path, the resume banner and the nav. */
export function mountApp(app){
  const plan = app.plan;
  store.init(app.id, plan.length);

  /* library drills — full difficulty, no day target */
  const libraryDrills = $$(".drill[data-topic]").map(h => initDrill(h, { topic: h.dataset.topic }, app));

  /* session totals in the header */
  function paintTotals(){
    const { c, t } = store.totals();
    const n = $("#pnum"), bar = $("#pbar-fill");
    if (n) n.textContent = `${c} correct of ${t}`;
    if (bar) bar.style.width = (t ? Math.round(c / t * 100) : 0) + "%";
  }

  /* ---------- the day path ---------- */
  let curDay = store.nextOpen(), dayApi = null;
  const resume = document.createElement("div");
  resume.className = "resume";
  $("#path").insertBefore(resume, $(".path-top"));

  function renderResume(){
    const done = store.doneTotal(), gap = store.gapDays();
    let when = "";
    if (gap === 0) when = "You already studied today.";
    else if (gap === 1) when = "You were last here yesterday.";
    else if (gap > 1) when = `You were last here ${gap} days ago.`;

    let msg;
    if (done === 0) msg = `<b>First time here?</b> <span>${app.firstVisit}</span>`;
    else if (done >= plan.length) msg = `<b>You finished all ${plan.length} days.</b> <span>${when}</span>`;
    else msg = `<b>Welcome back &mdash; you are on Day ${store.nextOpen()}.</b> <span>${when} ${done} of ${plan.length} days done.</span>`;

    const sync = api.signedIn ? `<span class="synced">synced to ${api.user ? api.user.username : "your account"}</span>` : "";
    resume.innerHTML = msg + (store.state.streak > 1 ? `<span class="streak">${store.state.streak}-day streak</span>` : "") + sync;
    document.title = `Day ${store.nextOpen()} · ${app.name}`;
  }

  function renderStrip(){
    $("#daystrip").innerHTML = plan.map((d, i) => {
      const n = i + 1;
      const cls = store.dayDone(n) ? "done" : (n === curDay ? "now" : (store.isOpen(n) ? "" : "locked"));
      const title = d.t.replace(/"/g, "");
      return `<button class="dbtn ${cls}" data-n="${n}" title="Day ${n} — ${title}" aria-label="Day ${n}: ${title}">${store.dayDone(n) && n !== curDay ? "✓" : n}</button>`;
    }).join("");
    $$("#daystrip .dbtn").forEach(b => b.addEventListener("click", () => openDay(+b.dataset.n)));
    $("#day-progress").textContent = `${store.doneTotal()} of ${plan.length} days complete`;
  }

  function completeBanner(n){
    if (n >= plan.length)
      return `<div class="done-banner"><h4>That is the whole path.</h4><p>${app.finale}</p></div>`;
    return `<div class="done-banner"><h4>Day ${n} complete.</h4>` +
           `<p>Come back tomorrow, or keep going now &mdash; Day ${n + 1} is ${plan[n].t.toLowerCase()}.</p>` +
           `<button class="btn primary" id="go-next">Start Day ${n + 1}</button></div>`;
  }

  function showComplete(n){
    if (!dayApi) return;
    dayApi.banner(completeBanner(n));
    const go = $("#go-next");
    if (go) go.addEventListener("click", () => {
      openDay(n + 1);
      const top = $("#path");
      if (top.scrollIntoView) top.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openDay(n){
    if (!store.isOpen(n)){
      $("#lesson").innerHTML =
        `<div class="step"><h4>Day ${n} is still locked</h4><p>Finish Day ${store.nextOpen()} first &mdash; each day leans on the one before it. ` +
        `If you already know this material, use <b>Unlock every day</b> above.</p></div>`;
      return;
    }
    curDay = n;
    const d = plan[n - 1];
    $("#day-eyebrow").textContent = `Day ${n} of ${plan.length}`;
    $("#day-title").textContent = d.t;
    $("#day-goal").textContent = d.goal;
    $("#day-meta").textContent = `${d.min} · ${store.dayDone(n) ? "completed" : "in progress"}`;
    $("#lesson").innerHTML =
      d.teach.map(t => `<div class="step"><h4>${t[0]}</h4><p>${t[1]}</p></div>`).join("") +
      (d.tip ? `<div class="tip"><b>Worth knowing</b>${d.tip}</div>` : "");

    dayApi = initDrill($("#daydrill"), {
      topic: d.drill.topic,
      opt: d.drill.opt,
      day: n,
      target: d.drill.target,
      onAnswer: ok => {
        if (!ok) return;
        const got = store.countCorrect(n);
        if (got >= d.drill.target && store.completeDay(n)) showComplete(n);
        renderStrip(); renderResume();
      }
    }, app);

    if (store.dayDone(n)) showComplete(n);
    renderStrip(); renderResume();
  }

  function renderAll(){
    paintTotals(); renderStrip(); renderResume();
    libraryDrills.forEach(d => d.refresh());
    if (dayApi) dayApi.refresh();
  }
  store.onChange(renderAll);

  $("#unlock-all").addEventListener("click", function(){
    const on = store.toggleAll();
    renderStrip();
    this.textContent = on ? "Follow the path in order" : "Unlock every day";
  });
  if (store.state.all) $("#unlock-all").textContent = "Follow the path in order";

  const resetBtn = $("#reset");
  if (resetBtn) resetBtn.addEventListener("click", () => {
    store.reset();
    curDay = 1;
    openDay(1);
  });

  /* sticky nav highlighting */
  if ("IntersectionObserver" in window){
    const chips = $$(".chip");
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) chips.forEach(c => c.classList.toggle("on", c.getAttribute("href") === "#" + e.target.id));
      });
    }, { rootMargin: "-70px 0px -70% 0px" });
    $$(".unit, #path").forEach(u => { if (u.id) io.observe(u); });
  }

  openDay(curDay);
  paintTotals();

  /* pull the server copy in the background; re-render whatever it changes */
  store.sync().then(changed => { if (changed){ curDay = store.nextOpen(); openDay(curDay); } });

  return { openDay, renderAll };
}
