import { $, esc } from "./util.js";
import { api } from "./api.js";
import { topicChart, activityChart, topicLabel } from "./charts.js";

/**
 * The stats panel at the foot of a subject page. Present only when there is a backend
 * to answer for it and someone signed in — otherwise the section stays hidden.
 */
export async function mountStats(subject){
  const section = $("#subject-stats");
  if (!section) return;

  const show = state => {
    section.hidden = state !== "stats";
    const prompt = $("#stats-prompt");
    if (prompt) prompt.hidden = state !== "prompt";
  };

  if (!(await api.detect()) || !api.signedIn) return show(api.available ? "prompt" : "none");

  const res = await api.stats();
  if (!res.ok) return show("prompt");

  const topics = res.data.topics.filter(t => t.subject === subject);
  const answered = topics.reduce((n, t) => n + t.total, 0);
  const right = topics.reduce((n, t) => n + (t.right || 0), 0);
  const prog = (res.data.progress || {})[subject] || {};
  const done = Object.values(prog.days || {}).filter(d => d && d.done).length;

  $("#stat-tiles").innerHTML = [
    ["Days complete", done, "of 21"],
    ["Current streak", prog.streak || 0, (prog.streak === 1 ? "day" : "days") + " in a row"],
    ["Problems answered", answered, "all time"],
    ["Accuracy", (answered ? Math.round(right / answered * 100) : 0) + "%", right + " correct"]
  ].map(([l, v, n]) =>
    `<div class="tile"><span class="tile-label">${l}</span><span class="tile-value">${v}</span><span class="tile-note">${n}</span></div>`
  ).join("");

  topicChart($("#chart-topics"), topics);
  activityChart($("#chart-activity"), res.data.daily);

  $("#topic-table").innerHTML = topics.length
    ? `<table><caption>Accuracy by topic</caption><thead><tr><th>Topic</th><th>Correct</th><th>Attempts</th><th>Accuracy</th></tr></thead><tbody>` +
      topics.map(t => `<tr><td>${esc(topicLabel(t.topic))}</td><td>${t.right || 0}</td><td>${t.total}</td><td>${Math.round((t.right || 0) / t.total * 100)}%</td></tr>`).join("") +
      `</tbody></table>`
    : `<p class="viz-empty">Nothing recorded yet.</p>`;

  show("stats");
}
