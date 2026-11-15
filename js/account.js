/* The Teacher's Phrasebook — sign-in, account sheet, saving the user's data, installable app.
   Same sign-in design as Wordrobe: email + emailed code, email/username + password, or sign-up with a username.
   Server: the Apps Script web app at window.PB_API_URL (POST {fn, args}, see src/Core.gs pbApi_()).

   Storage in this browser (all optional; the app works without it):
     pb_token   the session token
     pb_cache   {user_id, user, hasPassword, state, dirty}: opens the app at once and offline; dirty = not yet on the server
     pb_theme   system | light | dark (read before first paint in index.html)
     pb_nudge   last time the "add an email" sheet was shown to a username account */
(function () {
  'use strict';
  var NET_MSG = 'Koneksi bermasalah. Periksa internet Anda lalu coba lagi.';
  var SESSION_RE = /Sesi Anda sudah berakhir/;
  var SAVE_DELAY = 1500;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- server ---------- */
  function apiUrl() { return String(window.PB_API_URL || ''); }
  function api(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (/SET_AFTER_FIRST_DEPLOY/.test(apiUrl()) || !apiUrl()) return Promise.reject(new Error('Server belum diatur. Hubungi pengelola aplikasi.'));
    return fetch(apiUrl(), { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args }) })
      .then(function (r) { return r.json(); }, function () { throw new Error(NET_MSG); })
      .then(function (o) {
        if (o && o.ok) return o.result;
        throw new Error((o && o.error) || 'Terjadi kesalahan. Coba lagi sebentar lagi.');
      }, function (e) { throw e && e.message === NET_MSG ? e : new Error(NET_MSG); });
  }
  function isNet(e) { return !!e && e.message === NET_MSG; }
  function isSession(e) { return !!e && SESSION_RE.test(e.message); }

  /* ---------- storage (may be unavailable) ---------- */
  var mem = {};
  function getItem(k) { try { var v = localStorage.getItem(k); return v === null ? (k in mem ? mem[k] : null) : v; } catch (e) { return k in mem ? mem[k] : null; } }
  function setItem(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) { /* memory only */ } }
  function removeItem(k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  function readCache() { try { var c = JSON.parse(getItem('pb_cache') || 'null'); return c && c.user_id && c.state ? c : null; } catch (e) { return null; } }
  function writeCache(c) { try { setItem('pb_cache', JSON.stringify(c)); } catch (e) { /* too big or blocked: the server still has it */ } }

  /* ---------- state ---------- */
  var me = null, hasPassword = false, pendingEmail = '', cooldownTimer = null, saveTimer = null, saving = false, dirty = false;

  /* ---------- screens before sign-in ---------- */
  var GATE = ['landing', 'restore', 'signin', 'gate-privacy'], privacyFrom = 'landing';
  function showGate(id) {
    $('gate').hidden = false; $('app').hidden = true; $('bottom').hidden = true;
    GATE.forEach(function (s) { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }
  function enterApp(user, state) {
    $('gate').hidden = true; $('bottom').hidden = false;
    if (window.PBApp.isStarted()) window.PBApp.refresh(user, state); else window.PBApp.start(user, state);
  }
  function msg(el, text, kind) { el.textContent = text || ''; el.hidden = !text; el.className = 'msg' + (kind ? ' msg--' + kind : ''); }
  function busy(btn, on, label) {
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.textContent; btn.innerHTML = '<span class="spinner" aria-hidden="true"></span><span></span>'; btn.lastChild.textContent = label || 'Tunggu…'; }
    else if (btn.dataset.label) btn.textContent = btn.dataset.label;
  }
  function toast(t) { if (window.PBApp) window.PBApp.toast(t); }

  try { if (typeof IL === 'function') $('landing-ill').innerHTML = IL('U_u1'); } catch (e) { /* illustration is decoration */ }
  $('gate-privacy-body').innerHTML = $('privacy-tpl').innerHTML;
  Array.prototype.forEach.call(document.querySelectorAll('[data-privacy]'), function (b) {
    b.addEventListener('click', function () { privacyFrom = $('signin').hidden ? 'landing' : 'signin'; showGate('gate-privacy'); });
  });
  $('privacy-back').addEventListener('click', function () { showGate(privacyFrom); });
  $('open-btn').addEventListener('click', function () { openSignin(); });
  $('signin-back').addEventListener('click', function () { showGate('landing'); });

  function openSignin(text) {
    showGate('signin'); step('email');
    if (text) msg($('signin-msg'), text, 'error');
  }
  function step(s) {
    ['email', 'username', 'code', 'password'].forEach(function (x) { $(x + '-form').hidden = x !== s; });
    $('signin-title').textContent = s === 'username' ? 'Buat akun' : s === 'code' ? 'Cek email Anda' : 'Masuk';
    $('signin-sub').hidden = s !== 'email';
    msg($('signin-msg'), '');
    var focus = { email: 'email', username: 'uname', code: 'code', password: 'pw-login' }[s];
    setTimeout(function () { try { $(focus).focus(); } catch (e) { /* ignore */ } }, 50);
  }
  function startCooldown(seconds) {
    var btn = $('resend-btn'), left = Math.max(1, Math.round(seconds || 30));
    clearInterval(cooldownTimer); btn.disabled = true;
    var tick = function () {
      if (left <= 0) { clearInterval(cooldownTimer); btn.disabled = false; btn.textContent = 'Kirim ulang kode'; return; }
      btn.textContent = 'Kirim ulang kode (' + left + ')'; left--;
    };
    tick(); cooldownTimer = setInterval(tick, 1000);
  }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function sendCode(email, btn, fn) {
    busy(btn, true, 'Mengirim…');
    api(fn || 'requestLoginCode', email).then(function (r) {
      busy(btn, false); pendingEmail = email;
      step('code');
      $('code-note').textContent = r.message + ' (' + email + ')';
      startCooldown(r.cooldownSeconds);
    }, function (e) { busy(btn, false); msg($('signin-msg'), e.message, 'error'); });
  }
  $('email-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var email = $('email').value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { msg($('signin-msg'), 'Tulis alamat email yang benar.', 'error'); return; }
    sendCode(email, $('send-btn'));
  });
  $('signup-btn').addEventListener('click', function () {
    var email = $('email').value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { msg($('signin-msg'), 'Tulis email Anda dulu, lalu tekan Daftar gratis.', 'error'); $('email').focus(); return; }
    sendCode(email, $('signup-btn'), 'signUp');
  });
  $('to-username').addEventListener('click', function () { step('username'); });
  $('uname-back').addEventListener('click', function () { step('email'); });
  $('username-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var name = $('uname').value.trim().toLowerCase().replace(/^@/, ''), pw = $('uname-pw').value;
    if (!/^[a-z][a-z0-9._]{2,19}$/.test(name)) { msg($('signin-msg'), 'Username 3–20 karakter: huruf kecil, angka, titik atau garis bawah, diawali huruf.', 'error'); $('uname').focus(); return; }
    if (pw.length < 8) { msg($('signin-msg'), 'Password minimal 8 karakter.', 'error'); $('uname-pw').focus(); return; }
    busy($('uname-btn'), true, 'Membuat akun…');
    api('signUpUsername', name, pw).then(function (r) {
      busy($('uname-btn'), false); $('uname-pw').value = ''; signedIn(r, 'username');
    }, function (e) { busy($('uname-btn'), false); msg($('signin-msg'), e.message, 'error'); });
  });
  $('resend-btn').addEventListener('click', function () { if (pendingEmail) sendCode(pendingEmail, $('resend-btn')); });
  $('change-email').addEventListener('click', function () { clearInterval(cooldownTimer); step('email'); });
  $('code').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 6);
    if (this.value.length === 6) $('code-form').requestSubmit ? $('code-form').requestSubmit() : verify();
  });
  $('code-form').addEventListener('submit', function (ev) { ev.preventDefault(); verify(); });
  function verify() {
    var code = $('code').value.trim();
    if (!/^\d{6}$/.test(code)) { msg($('signin-msg'), 'Kodenya 6 angka.', 'error'); return; }
    if ($('verify-btn').disabled) return;
    busy($('verify-btn'), true, 'Memeriksa…');
    api('verifyLoginCode', pendingEmail, code).then(function (r) {
      busy($('verify-btn'), false); $('code').value = ''; clearInterval(cooldownTimer); signedIn(r, 'code');
    }, function (e) { busy($('verify-btn'), false); msg($('signin-msg'), e.message, 'error'); $('code').select(); });
  }
  $('to-password').addEventListener('click', function () {
    var email = $('email').value.trim(); if (email) $('pw-login').value = email; step('password');
  });
  $('to-code').addEventListener('click', function () { step('email'); });
  $('password-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var login = $('pw-login').value.trim(), pw = $('pw').value;
    if (!login || !pw) { msg($('signin-msg'), 'Isi email/username dan password terlebih dahulu.', 'error'); return; }
    busy($('pw-btn'), true, 'Memeriksa…');
    api('loginWithPassword', login, pw).then(function (r) {
      busy($('pw-btn'), false); $('pw').value = ''; signedIn(r, 'password');
    }, function (e) { busy($('pw-btn'), false); msg($('signin-msg'), e.message, 'error'); });
  });

  /* ---------- after sign-in: load the user's data, open the app ---------- */
  function signedIn(r, how) {
    setItem('pb_token', r.token);
    me = r.user; hasPassword = !!r.hasPassword;
    var old = readCache();
    if (old && old.user_id !== me.user_id) removeItem('pb_cache');
    showGate('restore'); restoreBusy();
    api('getState', r.token).then(function (s) {
      me = s.user; hasPassword = !!s.hasPassword;
      var st = s.state;
      // first sign-in on this device after using it offline with the same account: keep unsent local changes
      var c = readCache();
      if (c && c.user_id === me.user_id && c.dirty) { st = c.state; dirty = true; }
      writeCache({ user_id: me.user_id, user: me, hasPassword: hasPassword, state: st, dirty: dirty });
      applyTheme(st.prefs && st.prefs.theme);
      enterApp(me, st);
      if (dirty) scheduleSave(0);
      if (how === 'code' && !hasPassword) setTimeout(function () { openPassword(true); }, 400);
      else if (how === 'username' && r.isNew) toast('Akun dibuat. Selamat datang!');
    }, function (e) { restoreFailed(e); });
  }

  function restoreBusy() {
    $('restore-spin').hidden = false; $('restore-actions').hidden = true;
    $('restore-text').textContent = 'Membuka Phrasebook Anda…';
  }
  function restoreFailed(e) {
    if (isSession(e)) { signOutLocal(); openSignin(e.message); return; }
    $('restore-spin').hidden = true; $('restore-actions').hidden = false;
    $('restore-text').textContent = e.message;
  }
  $('restore-retry').addEventListener('click', function () { restore(); });
  $('restore-other').addEventListener('click', function () { signOutLocal(); openSignin(); });

  /* Opening the app with a saved token: from the cache at once (also offline), then refreshed from the server. */
  function restore() {
    var token = getItem('pb_token');
    if (!token) { showGate('landing'); return; }
    var c = readCache();
    if (c) {
      me = c.user; hasPassword = !!c.hasPassword; dirty = !!c.dirty;
      applyTheme(c.state.prefs && c.state.prefs.theme);
      enterApp(me, c.state);
      if (dirty) { scheduleSave(0); return; }   // local changes win; the push answers for the session too
      api('getState', token).then(function (s) {
        me = s.user; hasPassword = !!s.hasPassword;
        if (dirty) return;                        // the user changed something meanwhile: keep it, it is being sent
        writeCache({ user_id: me.user_id, user: me, hasPassword: hasPassword, state: s.state, dirty: false });
        if (JSON.stringify(s.state) !== JSON.stringify(c.state)) { applyTheme(s.state.prefs && s.state.prefs.theme); window.PBApp.refresh(me, s.state); }
        maybeNudge();
      }, function (e) {
        if (isSession(e)) { signOutLocal(); openSignin(e.message); }
        else if (isNet(e)) toast('Anda sedang offline. Perubahan akan disimpan saat tersambung lagi.');
      });
      return;
    }
    showGate('restore'); restoreBusy();
    api('getState', token).then(function (s) {
      me = s.user; hasPassword = !!s.hasPassword;
      writeCache({ user_id: me.user_id, user: me, hasPassword: hasPassword, state: s.state, dirty: false });
      applyTheme(s.state.prefs && s.state.prefs.theme);
      enterApp(me, s.state);
      maybeNudge();
    }, restoreFailed);
  }

  /* ---------- saving changes (called by app.js through PBSync.changed) ---------- */
  function scheduleSave(delay) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushNow, delay === undefined ? SAVE_DELAY : delay);
  }
  function pushNow(keepalive) {
    var token = getItem('pb_token');
    if (!token || !me || !dirty) return;
    if (saving && !keepalive) { scheduleSave(); return; }
    var st = window.PBApp.state();
    if (keepalive) {
      try {
        fetch(apiUrl(), { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: 'saveState', args: [token, st] }) });
      } catch (e) { /* the next open sends it */ }
      return;
    }
    saving = true;
    var sent = JSON.stringify(st);
    api('saveState', token, st).then(function () {
      saving = false;
      if (JSON.stringify(window.PBApp.state()) === sent) { dirty = false; writeCache({ user_id: me.user_id, user: me, hasPassword: hasPassword, state: st, dirty: false }); }
      else scheduleSave();
    }, function (e) {
      saving = false;
      if (isSession(e)) { signOutLocal(); openSignin(e.message); return; }
      if (!isNet(e)) toast(e.message);   // offline: stays dirty, sent when back online or on the next open
    });
  }
  window.PBSync = {
    changed: function () {
      if (!me) return;
      dirty = true;
      writeCache({ user_id: me.user_id, user: me, hasPassword: hasPassword, state: window.PBApp.state(), dirty: true });
      scheduleSave();
    },
    flush: function () { clearTimeout(saveTimer); pushNow(); }
  };
  window.addEventListener('online', function () { if (dirty) scheduleSave(0); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && dirty && !saving) { clearTimeout(saveTimer); pushNow(true); } });

  /* ---------- sign out ---------- */
  function signOutLocal() {
    clearTimeout(saveTimer);
    removeItem('pb_token'); removeItem('pb_cache');
    me = null; hasPassword = false; dirty = false;
    closeSheets(true);
    try { if (history.state && history.state.pbSheet) history.replaceState(null, ''); } catch (e) { /* ignore */ }
    if (window.PBApp) window.PBApp.stop();
    try { if (location.hash) history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  }
  $('menu-logout').addEventListener('click', function () {
    var token = getItem('pb_token');
    var finish = function () { signOutLocal(); showGate('landing'); };
    if (dirty && token) {
      busy($('menu-logout'), true, 'Menyimpan…');
      api('saveState', token, window.PBApp.state()).then(null, function () { /* sign out anyway */ })
        .then(function () { return api('logout', token).catch(function () {}); })
        .then(function () { busy($('menu-logout'), false); finish(); });
      return;
    }
    if (token) api('logout', token).catch(function () { /* the session expires anyway */ });
    finish();
  });

  /* ---------- theme ---------- */
  var THEMES = [['system', 'Ikuti HP'], ['light', 'Terang'], ['dark', 'Gelap']];
  function applyTheme(t) {
    t = t === 'light' || t === 'dark' ? t : 'system';
    setItem('pb_theme', t);
    if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    var dark = t === 'dark' || (t === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = $('theme-color'); if (meta) meta.setAttribute('content', dark ? '#111311' : '#ECEEE9');
    renderThemeChips(t);
  }
  function renderThemeChips(t) {
    $('theme-chips').innerHTML = THEMES.map(function (x) { return '<button type="button" data-theme-pick="' + x[0] + '" aria-pressed="' + (x[0] === t) + '">' + x[1] + '</button>'; }).join('');
  }
  $('theme-chips').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-theme-pick]'); if (!b) return;
    applyTheme(b.getAttribute('data-theme-pick'));
    window.PBApp.setPref('theme', b.getAttribute('data-theme-pick'));
  });

  /* ---------- sheets (Back closes them) ---------- */
  var SHEETS = ['menu-sheet', 'pw-sheet', 'email-sheet'];
  function openSheet(id) {
    SHEETS.forEach(function (s) { $(s).hidden = s !== id; });
    try { if (!(history.state && history.state.pbSheet)) history.pushState({ pbSheet: 1 }, ''); } catch (e) { /* ignore */ }
  }
  var afterBack = null;
  /* Closes any open sheet. The extra history entry of a sheet is removed with history.back(); `then` runs after that,
     so a navigation started from a sheet (privacy) is not undone by the late back step. */
  function closeSheets(fromPop, then) {
    var any = SHEETS.some(function (s) { return !$(s).hidden; });
    SHEETS.forEach(function (s) { $(s).hidden = true; });
    var back = false;
    if (any && !fromPop) { try { if (history.state && history.state.pbSheet) { back = true; afterBack = then || null; history.back(); } } catch (e) { back = false; } }
    if (!back && then) then();
  }
  window.addEventListener('popstate', function () {
    if (SHEETS.some(function (s) { return !$(s).hidden; })) closeSheets(true);
    if (afterBack) { var f = afterBack; afterBack = null; f(); }
  });
  SHEETS.forEach(function (s) { $(s).addEventListener('click', function (ev) { if (ev.target === $(s)) closeSheets(); }); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeSheets(); });

  /* ---------- account sheet ---------- */
  function initials(n) { return String(n || 'Guru').trim().split(/\s+/).map(function (w) { return w.charAt(0); }).slice(0, 2).join('').toUpperCase(); }
  function openMenu() {
    if (!me) return;
    var name = me.display_name || me.username || 'Guru';
    $('menu-avatar').textContent = initials(name);
    $('menu-name').textContent = name;
    $('menu-login').textContent = me.email ? me.email : '@' + me.username + ' · belum ada email';
    $('menu-add-email').hidden = !!me.email;
    renderThemeChips(getItem('pb_theme') || 'system');
    $('menu-install').hidden = isStandalone();
    $('menu-install-note').hidden = true;
    openSheet('menu-sheet');
  }
  $('menu-close').addEventListener('click', function () { closeSheets(); });
  $('menu-privacy').addEventListener('click', function () { closeSheets(false, function () { location.hash = 'privacy'; }); });
  window.PBAccount = { open: openMenu, relabel: function () { /* account screens are in Indonesian only */ } };

  /* ---------- password ---------- */
  function openPassword(offer) {
    $('pw-sheet-title').textContent = offer ? 'Buat password?' : (hasPassword ? 'Ganti password' : 'Buat password');
    $('pw-sheet-note').textContent = 'Agar lain kali bisa langsung masuk tanpa menunggu kode email.';
    $('setpw-skip').textContent = offer ? 'Nanti saja' : 'Batal';
    $('current-pw-field').hidden = true; $('current-pw').value = ''; $('new-pw').value = ''; msg($('setpw-msg'), '');
    openSheet('pw-sheet');
    if (!offer) api('getPasswordInfo', getItem('pb_token')).then(function (i) { $('current-pw-field').hidden = !i.needs_current; }, function () { /* the server asks again if needed */ });
  }
  $('menu-password').addEventListener('click', function () { openPassword(false); });
  $('setpw-skip').addEventListener('click', function () { closeSheets(); });
  $('setpw-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var pw = $('new-pw').value;
    if (pw.length < 8) { msg($('setpw-msg'), 'Password minimal 8 karakter.', 'error'); return; }
    busy($('setpw-btn'), true, 'Menyimpan…');
    api('setPassword', getItem('pb_token'), pw, $('current-pw').value).then(function () {
      busy($('setpw-btn'), false); hasPassword = true;
      if (me) writeCache({ user_id: me.user_id, user: me, hasPassword: true, state: window.PBApp.state(), dirty: dirty });
      closeSheets(); toast('Password tersimpan.');
    }, function (e) {
      busy($('setpw-btn'), false);
      if (/Password lama/.test(e.message)) $('current-pw-field').hidden = false;
      msg($('setpw-msg'), e.message, 'error');
    });
  });

  /* ---------- add an email (username accounts) ---------- */
  var addEmail = '';
  function openAddEmail() {
    $('addemail-form').hidden = false; $('addcode-form').hidden = true; msg($('addemail-msg'), '');
    openSheet('email-sheet');
  }
  function maybeNudge() {
    if (!me || me.email) return;
    var last = Number(getItem('pb_nudge') || 0);
    if (Date.now() - last < 7 * 86400000) return;
    setItem('pb_nudge', String(Date.now()));
    setTimeout(openAddEmail, 1200);
  }
  $('menu-add-email').addEventListener('click', openAddEmail);
  $('email-sheet-close').addEventListener('click', function () { closeSheets(); });
  $('addemail-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var email = $('add-email').value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { msg($('addemail-msg'), 'Tulis alamat email yang benar.', 'error'); return; }
    busy($('addemail-btn'), true, 'Mengirim…');
    api('requestAddEmail', getItem('pb_token'), email).then(function (r) {
      busy($('addemail-btn'), false); addEmail = email;
      $('addemail-form').hidden = true; $('addcode-form').hidden = false; msg($('addemail-msg'), r.message, 'ok');
      setTimeout(function () { $('add-code').focus(); }, 50);
    }, function (e) { busy($('addemail-btn'), false); msg($('addemail-msg'), e.message, 'error'); });
  });
  $('add-code').addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 6); });
  $('addcode-change').addEventListener('click', function () { $('addemail-form').hidden = false; $('addcode-form').hidden = true; msg($('addemail-msg'), ''); });
  $('addcode-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var code = $('add-code').value.trim();
    if (!/^\d{6}$/.test(code)) { msg($('addemail-msg'), 'Kodenya 6 angka.', 'error'); return; }
    busy($('addcode-btn'), true, 'Menyimpan…');
    api('verifyAddEmail', getItem('pb_token'), addEmail, code).then(function (r) {
      busy($('addcode-btn'), false); me = r.user; $('add-code').value = '';
      writeCache({ user_id: me.user_id, user: me, hasPassword: hasPassword, state: window.PBApp.state(), dirty: dirty });
      closeSheets(); toast('Email tersimpan. Sekarang Anda juga bisa masuk dengan email.');
    }, function (e) { busy($('addcode-btn'), false); msg($('addemail-msg'), e.message, 'error'); });
  });

  /* ---------- installable app ---------- */
  var installEvt = null;
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function isStandalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  // Chrome sends beforeinstallprompt only when it decides (often after some use of the site); without it, the button shows how to install by hand.
  function installSteps() {
    var ua = navigator.userAgent;
    if (/Instagram|FBAN|FBAV|TikTok|Line\/|WhatsApp/i.test(ua)) return 'Buka link ini di Chrome atau Safari dulu, lalu pasang dari sana.';
    if (isIOS()) return 'Di iPhone/iPad: buka di Safari, ketuk tombol Bagikan, lalu pilih "Tambah ke Layar Utama".';
    if (/Android/i.test(ua)) return 'Di Chrome: ketuk menu ⋮ di kanan atas, lalu pilih "Instal aplikasi" atau "Tambahkan ke layar utama".';
    return 'Di Chrome atau Edge: klik ikon pasang di ujung kanan kolom alamat, atau buka menu ⋮ lalu "Transmisikan, simpan, dan bagikan" > "Instal halaman sebagai aplikasi".';
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
  window.addEventListener('appinstalled', function () { installEvt = null; $('menu-install').hidden = true; $('menu-install-note').hidden = true; toast('Phrasebook sudah terpasang di layar utama.'); });
  $('menu-install').addEventListener('click', function () {
    if (!installEvt) { $('menu-install-note').textContent = installSteps(); $('menu-install-note').hidden = false; return; }
    installEvt.prompt();
    installEvt.userChoice.then(function () { installEvt = null; }, function () { /* ignore */ });
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* the app works without it */ }); });
  }

  restore();
})();
