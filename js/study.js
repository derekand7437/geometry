import { $, esc } from "./util.js";
import { store } from "./store.js";
import { initDrill } from "./engine.js";

/**
 * The full-screen question runner: one question on screen at a time.
 *
 * Nothing here re-implements a question. It mounts the same drill the page used to embed,
 * so the generators, answer checking and worked steps are unchanged — the difference is
 * that a question now gets the whole screen, and "Next question" brings the following one.
 */
export function mountStudy(app){
  const plan = app.plan;
  const el = document.createElement("div");
  el.className = "study";
  el.id = "study";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  document.body.appendChild(el);

  let mode = null;        // "day" | "topic"
  let dayN = 0, topic = null, topicTitle = "";
  let drill = null;

  /* Every page in here shares one frame: a bar to leave by, and a single card. */
  function frame(title, sub, bodyHtml){
    el.innerHTML =
      `<div class="study-bar">
         <button class="study-leave" id="study-close" aria-label="Leave practice">&larr; Leave</button>
         <div class="study-where"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</div>
       </div>
       <div class="study-body">${bodyHtml}</div>`;
    $("#study-close", el).addEventListener("click", close);
    el.scrollTop = 0;
  }

  /* ---------- day: the lesson gets its own page, then the questions ---------- */
  function lessonPage(n){
    const d = plan[n - 1];
    frame(`Day ${n}`, d.t,
      `<div class="study-card">
         <span class="study-kicker">Day ${n} of ${plan.length}</span>
         <h2 class="study-h">${esc(d.t)}</h2>
         <p class="study-goal">${esc(d.goal)}</p>
         <div class="study-teach">${d.teach.map(t => `<div class="step"><h4>${t[0]}</h4><p>${t[1]}</p></div>`).join("")}</div>
         ${d.tip ? `<div class="tip"><b>Worth knowing</b>${d.tip}</div>` : ""}
         <button class="btn primary study-go" id="study-go">Start the questions</button>
         <p class="study-note">${d.drill.target} correct finishes the day &mdash; one question at a time.</p>
       </div>`);
    $("#study-go", el).addEventListener("click", () => questionPage());
  }

  function lockedPage(n){
    frame(`Day ${n}`, "Locked",
      `<div class="study-card">
         <h2 class="study-h">Day ${n} is still locked</h2>
         <p class="study-goal">Finish Day ${store.nextOpen()} first &mdash; each day leans on the one before it.</p>
         <button class="btn primary study-go" id="study-go">Go to Day ${store.nextOpen()}</button>
       </div>`);
    $("#study-go", el).addEventListener("click", () => openDay(store.nextOpen()));
  }

  /* ---------- one question, filling the screen ---------- */
  function questionPage(){
    const day = mode === "day";
    const d = day ? plan[dayN - 1] : null;
    frame(day ? `Day ${dayN}` : topicTitle, day ? d.t : "Unlimited practice",
      `<div class="study-card"><div class="drill" id="study-drill"></div></div>`);

    const cfg = day
      ? { topic: d.drill.topic, opt: d.drill.opt, day: dayN, target: d.drill.target,
          nextLabel: "Next question",
          onAnswer: ok => {
            if (!ok) return;
            const got = store.countCorrect(dayN);
            if (got >= d.drill.target && store.completeDay(dayN)) showDone(dayN);
          } }
      : { topic, nextLabel: "Next question" };

    drill = initDrill($("#study-drill", el), cfg, app);
    if (day && store.dayDone(dayN)) showDone(dayN);
  }

  /* Finishing a day does not yank the screen away — the banner joins the answer. */
  function showDone(n){
    if (!drill) return;
    const last = n >= plan.length;
    drill.banner(
      `<div class="done-banner">
         <h4>${last ? "That is the whole path." : `Day ${n} complete.`}</h4>
         <p>${last ? app.finale : `Come back tomorrow, or keep going &mdash; Day ${n + 1} is ${plan[n].t.toLowerCase()}.`}</p>
         <div class="done-btns">
           ${last ? "" : `<button class="btn primary" id="study-next-day">Start Day ${n + 1}</button>`}
           <button class="btn" id="study-leave-done">Back to the site</button>
         </div>
       </div>`);
    const nx = $("#study-next-day", el);
    if (nx) nx.addEventListener("click", () => openDay(n + 1));
    $("#study-leave-done", el).addEventListener("click", close);
  }

  /* ---------- open / close ---------- */
  function open(){
    el.hidden = false;
    document.body.classList.add("study-open");
    document.documentElement.scrollTop = 0;
  }
  function close(){
    el.hidden = true;
    document.body.classList.remove("study-open");
    drill = null;
    el.innerHTML = "";
  }

  function openDay(n){
    mode = "day"; dayN = n; open();
    if (!store.isOpen(n)) return lockedPage(n);
    store.dayDone(n) ? questionPage() : lessonPage(n);
  }
  function openTopic(t, title){
    mode = "topic"; topic = t; topicTitle = title || "Practice"; open();
    questionPage();
  }

  addEventListener("keydown", e => { if (e.key === "Escape" && !el.hidden) close(); });

  return { openDay, openTopic, close, get isOpen(){ return !el.hidden; } };
}
