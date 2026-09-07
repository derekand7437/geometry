import { $ } from "./util.js";
import { api } from "./api.js";
import { store } from "./store.js";

let openDialog = null;
let pendingOpen = null;
let doSignOut = null;
const authListeners = [];

/** Sign out from anywhere; repaints the top bar and tells every listener. */
export async function signOut(){ if (doSignOut) await doSignOut(); }

/**
 * Open the auth dialog from elsewhere (the home screen), in "login" or "register" mode.
 * The dialog is only built once the backend check resolves, so a tap that lands before
 * then is remembered and honoured the moment it is ready rather than being dropped.
 */
export function openSignIn(mode){
  if (openDialog) openDialog(mode);
  else pendingOpen = mode || "login";
}

/** Notified whenever the signed-in user changes, so other screens can repaint. */
export function onAuthChange(fn){ authListeners.push(fn); }

/**
 * Sign-in control. Signed out, the app is fully usable and saves locally;
 * signing in merges that local progress into the account and keeps them in step.
 *
 * Both ways in are two steps when the backend can send a text: username and password (plus
 * a phone number when signing up), then the code. The server decides — it answers 202 with
 * a pending/challenge id instead of a token — so the browser never has to know whether
 * texting is switched on.
 */
export async function mountAccount(){
  const host = $("#account");
  if (!host) return;

  if (!(await api.detect())){
    host.innerHTML = `<span class="who offline">Progress saves in this browser</span>`;
    pendingOpen = null;
    authListeners.forEach(fn => fn(null));   // no account here — let the home screen move on
    return;
  }

  const dialog = document.createElement("dialog");
  dialog.className = "auth";
  dialog.innerHTML = `
    <form method="dialog" class="auth-card">
      <h3 id="auth-title">Log in</h3>
      <p class="auth-why" id="auth-why">Your progress is saved in this browser either way. An account carries it to your phone, your school computer, anywhere.</p>

      <div id="auth-step-creds">
        <label>Username<input id="auth-user" name="username" autocomplete="username" required minlength="3" maxlength="24" spellcheck="false"></label>
        <label>Password<input id="auth-pass" name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="200"></label>
        <label id="auth-confirm-row" hidden>Type your password again
          <input id="auth-confirm" name="confirm-password" type="password" autocomplete="new-password" maxlength="200">
        </label>
        <label id="auth-phone-row" hidden>Phone number
          <input id="auth-phone" name="tel" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" placeholder="(555) 123-4567">
          <span class="auth-hint" id="auth-phone-hint">We text a code to make sure it is really you.</span>
        </label>
      </div>

      <div id="auth-step-code" hidden>
        <p class="auth-sent" id="auth-sent"></p>
        <label>Verification code
          <input id="auth-code" name="one-time-code" type="text" inputmode="numeric" autocomplete="one-time-code"
                 maxlength="8" placeholder="123456" spellcheck="false">
        </label>
        <button type="button" class="linkbtn" id="auth-resend">Send the code again</button>
      </div>

      <p class="auth-err" id="auth-err" hidden></p>
      <div class="auth-btns">
        <button class="btn primary" id="auth-go" value="go" type="submit">Log in</button>
        <button class="btn" id="auth-cancel" value="cancel" formnovalidate>Cancel</button>
      </div>
      <p class="auth-swap"><span id="auth-swap-text">New here?</span> <button type="button" class="linkbtn" id="auth-toggle">Create an account</button></p>
    </form>`;
  document.body.appendChild(dialog);

  let mode = "login";        // "login" | "register"
  let step = "creds";        // "creds" | "code"
  let ticket = null;         // { pending } or { challenge }

  const err       = $("#auth-err", dialog);
  const stepCreds = $("#auth-step-creds", dialog);
  const stepCode  = $("#auth-step-code", dialog);
  const phoneRow  = $("#auth-phone-row", dialog);
  const confirmRow= $("#auth-confirm-row", dialog);
  const elConfirm = $("#auth-confirm", dialog);
  const elUser    = $("#auth-user", dialog);
  const elPass    = $("#auth-pass", dialog);
  const elPhone   = $("#auth-phone", dialog);
  const elCode    = $("#auth-code", dialog);
  const go        = $("#auth-go", dialog);

  const fail = msg => { err.hidden = false; err.textContent = msg; };

  /* A hidden required field still blocks submission and cannot be focused to complain,
     so every field that is out of view is disabled as well. */
  function showStep(which){
    step = which;
    const onCode = which === "code";
    stepCreds.hidden = onCode;
    stepCode.hidden  = !onCode;

    const registering = mode === "register";
    // Only ask for a number the backend can actually text; otherwise it is a field that
    // collects a phone number and does nothing with it.
    const wantsPhone = registering && api.twoFactor;

    elUser.disabled = elPass.disabled = onCode;

    confirmRow.hidden = !registering;
    elConfirm.disabled = onCode || !registering;
    elConfirm.required = !onCode && registering;

    phoneRow.hidden = !wantsPhone;
    elPhone.disabled = onCode || !wantsPhone;
    elPhone.required = !onCode && wantsPhone;

    elCode.disabled = !onCode;
    elCode.required = onCode;

    go.textContent = onCode ? "Verify" : (mode === "login" ? "Log in" : "Create account");
    $("#auth-why", dialog).hidden = onCode;
    // Swapping login/signup mid-code would strand the ticket, so hide the offer.
    $(".auth-swap", dialog).hidden = onCode;
    err.hidden = true;
  }

  function setMode(m){
    mode = m;
    ticket = null;
    const login = m === "login";
    $("#auth-title", dialog).textContent = login ? "Log in" : "Create an account";
    elPass.autocomplete = login ? "current-password" : "new-password";
    // The prompt has to change with the mode — "New here? I already have one" reads backwards.
    $("#auth-swap-text", dialog).textContent = login ? "New here?" : "Already have an account?";
    $("#auth-toggle", dialog).textContent = login ? "Create an account" : "Log in";
    showStep("creds");
  }

  $("#auth-toggle", dialog).addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));

  $("#auth-resend", dialog).addEventListener("click", async () => {
    if (!ticket) return;
    const btn = $("#auth-resend", dialog);
    btn.disabled = true; btn.textContent = "Sending…";
    const res = await api.resend(ticket);
    btn.disabled = false; btn.textContent = "Send the code again";
    if (!res.ok) return fail(reason(res));
    err.hidden = true;
    $("#auth-sent", dialog).textContent = `We sent a new code to ${res.data.phoneHint}.`;
  });

  const reason = res => res.status === 0
    ? "Cannot reach the server. You can keep working — progress still saves in this browser."
    : ((res.data && res.data.error) || "That did not work.");

  function toCodeStep(data){
    ticket = data.pending ? { pending: data.pending } : { challenge: data.challenge };
    $("#auth-sent", dialog).textContent = `We texted a code to ${data.phoneHint}. Enter it below.`;
    showStep("code");
    elCode.value = "";
    elCode.focus();
  }

  async function succeed(data){
    api.remember(data.token, data.user);
    dialog.close("go");
    await store.sync();
    render();
    store.emit();
  }

  $(".auth-card", dialog).addEventListener("submit", async e => {
    const btn = e.submitter;
    if (btn && btn.value === "cancel") return;
    e.preventDefault();
    err.hidden = true;

    if (step === "creds" && mode === "register" && elPass.value !== elConfirm.value){
      elConfirm.focus();
      return fail("Those two passwords are not the same.");
    }

    const label = go.textContent;
    go.disabled = true; go.textContent = "Working…";

    let res;
    if (step === "code"){
      res = await api.verify(Object.assign({ code: elCode.value.trim() }, ticket));
    } else if (mode === "login"){
      res = await api.login(elUser.value.trim(), elPass.value);
    } else {
      res = await api.register(elUser.value.trim(), elPass.value, elPhone.value.trim());
    }

    go.disabled = false; go.textContent = label;

    if (!res.ok){
      // A dead or expired ticket sends you back to the start rather than stranding you.
      if (step === "code" && [404, 410, 429].includes(res.status)){
        const msg = reason(res);
        setMode(mode);
        return fail(msg);
      }
      return fail(reason(res));
    }

    if (res.data && (res.data.pending || res.data.challenge)) return toCodeStep(res.data);
    if (res.data && res.data.token) return succeed(res.data);
    fail("That did not work.");
  });

  function render(){
    if (api.signedIn){
      const u = api.user ? api.user.username : "your account";
      host.innerHTML = `<span class="who">Signed in as <b>${u}</b></span><button class="linkbtn" id="sign-out">Log out</button>`;
      $("#sign-out").addEventListener("click", () => signOut());
    } else {
      host.innerHTML = `<button class="linkbtn" id="sign-in">Sign in to sync across devices</button>`;
      $("#sign-in").addEventListener("click", () => openDialog("login"));
    }
    authListeners.forEach(fn => fn(api.user));
  }

  doSignOut = async () => { await api.logout(); render(); store.emit(); };

  openDialog = m => {
    setMode(m === "register" ? "register" : "login");
    elUser.value = ""; elPass.value = ""; elConfirm.value = ""; elPhone.value = "";
    dialog.showModal();
    elUser.focus();
  };
  if (pendingOpen){ const m = pendingOpen; pendingOpen = null; openDialog(m); }

  render();
}
