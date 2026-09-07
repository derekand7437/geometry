import { $ } from "./util.js";
import { api } from "./api.js";
import { store } from "./store.js";

let openDialog = null;
const authListeners = [];

/** Open the auth dialog from elsewhere (the home screen), in "login" or "register" mode.
 *  No-op when there is no backend to sign into. */
export function openSignIn(mode){ if (openDialog) openDialog(mode); }

/** Notified whenever the signed-in user changes, so other screens can repaint. */
export function onAuthChange(fn){ authListeners.push(fn); }

/**
 * Sign-in control. Signed out, the app is fully usable and saves locally;
 * signing in merges that local progress into the account and keeps them in step.
 */
export async function mountAccount(){
  const host = $("#account");
  if (!host) return;

  if (!(await api.detect())){
    host.innerHTML = `<span class="who offline">Progress saves in this browser</span>`;
    return;
  }

  const dialog = document.createElement("dialog");
  dialog.className = "auth";
  dialog.innerHTML = `
    <form method="dialog" class="auth-card">
      <h3 id="auth-title">Sign in</h3>
      <p class="auth-why">Your progress is saved in this browser either way. An account carries it to your phone, your school computer, anywhere.</p>
      <label>Username<input id="auth-user" name="username" autocomplete="username" required minlength="3" maxlength="24" spellcheck="false"></label>
      <label>Password<input id="auth-pass" name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="200"></label>
      <p class="auth-err" id="auth-err" hidden></p>
      <div class="auth-btns">
        <button class="btn primary" id="auth-go" value="go" type="submit">Sign in</button>
        <button class="btn" value="cancel" formnovalidate>Cancel</button>
      </div>
      <p class="auth-swap">New here? <button type="button" class="linkbtn" id="auth-toggle">Create an account</button></p>
    </form>`;
  document.body.appendChild(dialog);

  let mode = "login";
  const err = $("#auth-err", dialog);

  function setMode(m){
    mode = m;
    $("#auth-title", dialog).textContent = m === "login" ? "Sign in" : "Create an account";
    $("#auth-go", dialog).textContent = m === "login" ? "Sign in" : "Create account";
    $("#auth-pass", dialog).autocomplete = m === "login" ? "current-password" : "new-password";
    $("#auth-toggle", dialog).textContent = m === "login" ? "Create an account" : "I already have one";
    err.hidden = true;
  }
  $("#auth-toggle", dialog).addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));

  function render(){
    if (api.signedIn){
      const u = api.user ? api.user.username : "your account";
      host.innerHTML = `<span class="who">Signed in as <b>${u}</b></span><button class="linkbtn" id="sign-out">Sign out</button>`;
      $("#sign-out").addEventListener("click", async () => { await api.logout(); render(); store.emit(); });
    } else {
      host.innerHTML = `<button class="linkbtn" id="sign-in">Sign in to sync across devices</button>`;
      $("#sign-in").addEventListener("click", () => openDialog("login"));
    }
    authListeners.forEach(fn => fn(api.user));
  }

  openDialog = mode => {
    setMode(mode === "register" ? "register" : "login");
    dialog.showModal();
    $("#auth-user", dialog).focus();
  };

  dialog.addEventListener("close", () => { if (dialog.returnValue !== "go") return; });

  $(".auth-card", dialog).addEventListener("submit", async e => {
    const btn = e.submitter;
    if (btn && btn.value === "cancel") return;
    e.preventDefault();
    const username = $("#auth-user", dialog).value.trim();
    const password = $("#auth-pass", dialog).value;
    const go = $("#auth-go", dialog);
    go.disabled = true; go.textContent = "Working…";

    const res = mode === "login" ? await api.login(username, password) : await api.register(username, password);
    go.disabled = false;
    setMode(mode);

    if (!res.ok){
      err.hidden = false;
      err.textContent = res.status === 0
        ? "Cannot reach the server. You can keep working — progress still saves in this browser."
        : (res.data && res.data.error) || "That did not work.";
      return;
    }
    api.remember(res.data.token, res.data.user);
    dialog.close("go");
    await store.sync();
    render();
    store.emit();
  });

  render();
}
