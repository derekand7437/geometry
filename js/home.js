import { $, $$, esc } from "./util.js";
import { store } from "./store.js";
import { api } from "./api.js";
import { prefs, SIZES, BG_PRESETS, INK_PRESETS } from "./prefs.js";
import { openSignIn, onAuthChange, signOut } from "./account.js";

/**
 * The full-screen home screen. It opens on every visit, says which day you are on, and
 * offers the two ways in: start learning, or change how the site looks.
 *
 * It reads the same store the rest of the page does, so signing in — which pulls your
 * progress down from the account — moves the day number here too.
 */
export function mountHome(app, ui, study){
  const plan = app.plan;
  const el = document.createElement("div");
  el.className = "home";
  el.id = "home";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", app.name + " home");
  document.body.appendChild(el);

  let view = location.hash === "#settings" ? "settings" : "main";
  let open = true;
  document.body.classList.add("home-open");

  const SLOGAN = "Helping you learn faster than teachers.";
  let skipped = false;          // set by "keep going without an account"
  let paid = false;             // cleared on every load and on logout

  /* ---------- the screen you land on ---------- */
  function mainView(){
    // A backend-less deploy has no account to sign into, so never show a gate
    // nobody can pass — go straight to the day.
    if (api.available !== false && !api.signedIn && !skipped) return welcomeView();
    // Signing up goes straight to the course; coming back to an account does not.
    if (api.signedIn && api.how === "login" && !paid) return payView();
    return dayView();
  }

  /* Shown once you are signed in, before the course opens. */
  function payView(){
    el.innerHTML =
      `<div class="home-inner welcome">
         <div class="welcome-mid">
           <h1 class="welcome-title">Pay 5 dollars<br><em>to learn</em></h1>
           <p class="welcome-slogan">${esc(app.name)} \u2014 the whole course, every problem.</p>
           <div class="welcome-actions">
             <button class="home-btn go wide" id="pay-yes"><span class="home-btn-main">Pay</span></button>
             <button class="home-btn wide" id="pay-no"><span class="home-btn-main">Exit</span></button>
           </div>
         </div>
       </div>`;
    $("#pay-yes", el).addEventListener("click", () => { paid = true; render(); });
    $("#pay-no", el).addEventListener("click", leaveSite);
  }

  /* A tab can only close itself if a script opened it, which is almost never true here,
     so blanking the page is the fallback that actually leaves the site. */
  function leaveSite(){
    try { window.close(); } catch {}
    setTimeout(() => { try { location.replace("about:blank"); } catch { location.href = "about:blank"; } }, 120);
  }

  /* Signed out: the name of the place, what it is for, and the two ways in. */
  function welcomeView(){
    el.innerHTML =
      `<div class="home-inner welcome">
         <div class="welcome-mid">
           <h1 class="welcome-title">Welcome to<br><em>${esc(app.name)}</em></h1>
           <p class="welcome-slogan">${esc(app.slogan || SLOGAN)}</p>
           <div class="welcome-actions">
             <button class="home-btn go wide" id="welcome-login"><span class="home-btn-main">Log in</span></button>
             <button class="home-btn wide" id="welcome-signup"><span class="home-btn-main">Sign up</span></button>
           </div>
           <button class="home-link welcome-skip" id="welcome-skip">Keep going without an account</button>
         </div>
       </div>`;

    $("#welcome-login", el).addEventListener("click", () => openSignIn("login"));
    $("#welcome-signup", el).addEventListener("click", () => openSignIn("register"));
    $("#welcome-skip", el).addEventListener("click", () => { skipped = true; render(); });
  }

  /* Signed in (or carrying on without an account): where you are, and the way on. */
  function dayView(){
    const day = store.nextOpen();
    const done = store.doneTotal();
    const finished = done >= plan.length;
    const d = plan[day - 1];
    const gap = store.gapDays();

    let when = "Welcome.";
    if (done === 0) when = "Let\u2019s begin.";
    else if (gap === 0) when = "You already studied today.";
    else if (gap === 1) when = "You were last here yesterday.";
    else if (gap > 1) when = "You were last here " + gap + " days ago.";

    const who = api.available === false
      ? `<span class="home-who-note">Progress saves in this browser</span>`
      : (api.signedIn
          ? `<span class="home-who-note">Signed in as <b>${esc(api.user ? api.user.username : "your account")}</b></span>` +
            `<button class="home-link" id="home-signout">Log out</button>`
          : `<button class="home-link" id="home-signin">Sign in or create an account</button>`);

    const pct = Math.round(done / plan.length * 100);

    el.innerHTML =
      `<div class="home-inner">
         <div class="home-top">
           <span class="home-eyebrow">${esc(app.name)}</span>
           <div class="home-who">${who}</div>
         </div>

         <div class="home-day">
           <span class="home-kicker">${esc(when)}</span>
           ${finished
             ? `<strong class="home-num">All ${plan.length} days done</strong>
                <span class="home-title">The whole path is behind you \u2014 the library below never runs out of problems.</span>`
             : `<span class="home-kicker-2">You are on</span>
                <strong class="home-num">Day ${day}</strong>
                <span class="home-title">${esc(d ? d.t : "")}</span>`}
           <div class="home-meter" role="img" aria-label="${done} of ${plan.length} days complete">
             <span class="home-meter-fill" style="width:${pct}%"></span>
           </div>
           <span class="home-sub">${done} of ${plan.length} days complete${store.state.streak > 1 ? ` \u00b7 ${store.state.streak}-day streak` : ""}</span>
         </div>

         <div class="home-actions">
           <button class="home-btn go" id="home-start">
             <span class="home-btn-main">${finished ? "Keep practising" : (done === 0 ? "Start learning" : "Continue learning")}</span>
             <span class="home-btn-sub">${finished ? "Every topic, unlimited problems" : (d ? esc(d.t) : "")}</span>
           </button>
           <button class="home-btn set" id="home-settings">
             <span class="home-btn-main">Settings</span>
             <span class="home-btn-sub">Colours and text size</span>
           </button>
         </div>
       </div>`;

    const signin = $("#home-signin", el);
    if (signin) signin.addEventListener("click", () => openSignIn("login"));

    const signout = $("#home-signout", el);
    if (signout) signout.addEventListener("click", async () => {
      skipped = false;              // logging out lands you back on the welcome screen
      paid = false;
      await signOut();
      render();
    });
    $("#home-start", el).addEventListener("click", () => close(day));
    $("#home-settings", el).addEventListener("click", () => { view = "settings"; render(); });
  }

  /* ---------- settings ---------- */
  function swatches(kind, presets, chosen){
    return presets.map(p =>
      `<button class="sw${p.v.toLowerCase() === String(chosen).toLowerCase() ? " on" : ""}" data-kind="${kind}" data-v="${p.v}"
               style="background:${p.v}" title="${esc(p.n)}" aria-label="${esc(p.n)}"></button>`).join("");
  }

  function settingsView(){
    const cur = prefs.current();
    const size = prefs.size;

    el.innerHTML =
      `<div class="home-inner set-view">
         <div class="set-head">
           <h2>Settings</h2>
           <button class="home-link" id="set-back">&larr; Back</button>
         </div>

         <div class="set-body">
           <section class="set-row">
             <div class="set-label"><h3>Background colour</h3><p>The page behind everything.</p></div>
             <div class="set-controls">
               <input type="color" id="set-bg" value="${cur.bg}" aria-label="Background colour">
               <div class="sw-row">${swatches("bg", BG_PRESETS, cur.bg)}</div>
             </div>
           </section>

           <section class="set-row">
             <div class="set-label"><h3>Text colour</h3><p>Headings, body text and answers.</p></div>
             <div class="set-controls">
               <input type="color" id="set-ink" value="${cur.ink}" aria-label="Text colour">
               <div class="sw-row">${swatches("ink", INK_PRESETS, cur.ink)}</div>
             </div>
           </section>

           <section class="set-row">
             <div class="set-label"><h3>Text size</h3><p>Scales the whole page, figures included.</p></div>
             <div class="set-controls">
               <div class="size-row">
                 ${SIZES.map(s => `<button class="size-btn${s.id === size ? " on" : ""}" data-size="${s.id}"
                    style="font-size:${Math.round(14 * s.id / 100)}px">${s.label}</button>`).join("")}
               </div>
             </div>
           </section>
         </div>

         <div class="set-foot">
           <button class="home-btn wide" id="set-done"><span class="home-btn-main">Done</span></button>
           <div class="set-foot-side">
             <button class="home-link" id="set-reset">Reset to defaults</button>
             <span class="set-note">Saved in this browser${api.signedIn ? " and to your account" : ""}, and shared with the other study site.</span>
           </div>
         </div>
       </div>`;

    // Live preview: every control applies immediately, so the screen you are looking at is the preview.
    $("#set-bg", el).addEventListener("input", e => prefs.set({ bg: e.target.value, ink: prefs.current().ink }));
    $("#set-ink", el).addEventListener("input", e => prefs.set({ ink: e.target.value, bg: prefs.current().bg }));
    $$(".sw", el).forEach(b => b.addEventListener("click", () => {
      const now = prefs.current();
      prefs.set(b.dataset.kind === "bg" ? { bg: b.dataset.v, ink: now.ink } : { ink: b.dataset.v, bg: now.bg });
      render();
    }));
    $$(".size-btn", el).forEach(b => b.addEventListener("click", () => {
      prefs.set({ size: Number(b.dataset.size) });
      render();
    }));
    $("#set-reset", el).addEventListener("click", () => { prefs.reset(); render(); });
    $("#set-back", el).addEventListener("click", () => { view = "main"; render(); });
    $("#set-done", el).addEventListener("click", () => { view = "main"; render(); });
  }

  function render(){ if (!open) return; view === "settings" ? settingsView() : mainView(); }

  function close(day){
    open = false;
    el.hidden = true;
    document.body.classList.remove("home-open");
    if (ui && ui.openDay) ui.openDay(day);
    // Straight into the questions, one screen at a time.
    if (study && study.openDay) study.openDay(day);
    else {
      const path = document.getElementById("path");
      if (path && path.scrollIntoView) path.scrollIntoView({ block: "start" });
    }
  }

  function show(which){
    view = which || "main";
    open = true;
    el.hidden = false;
    document.body.classList.add("home-open");
    render();
  }

  /* A way back in, once you have dismissed it. */
  const bar = document.querySelector(".topbar-inner");
  if (bar){
    const btn = document.createElement("button");
    btn.className = "linkbtn home-reopen";
    btn.id = "open-home";
    btn.textContent = "Home & settings";
    bar.insertBefore(btn, document.getElementById("account"));
    btn.addEventListener("click", () => show("main"));
  }

  el.addEventListener("keydown", e => { if (e.key === "Escape" && view === "settings"){ view = "main"; render(); } });

  // #settings opens straight to the settings screen, even from an already-open page.
  addEventListener("hashchange", () => { if (location.hash === "#settings") show("settings"); });

  store.onChange(() => { if (open && view === "main") render(); });
  onAuthChange(() => {
    prefs.sync();                       // settings follow the account too
    if (open && view === "main") render();
  });
  prefs.onChange(() => { if (open && view === "settings") { /* colours already applied live */ } });

  render();
  return { show, close, render };
}
