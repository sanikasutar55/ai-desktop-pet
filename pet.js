(async () => {
  const $ = id => document.getElementById(id);
  const PANEL = 282, FACES_RIGHT = true;           // set FACES_RIGHT=false if your sprite faces left
  const body = $('body');
  let S, px, wa, x = -999, side = 'right', facing = 1;
  let panelOpen = false, chatOpen = false, active = false, walking = null, leavePromise = null;
  let stayT, wanderT, lastBubble = '', cur = { w: 150, h: 174 };
  const history = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);

  function apply(info) {
    S = info.settings; px = info.petPx; wa = info.workArea;
    document.documentElement.style.setProperty('--spd', S.animSpeed);
    $('petbox').style.width = px + 'px';
  }
  function place() {
    api.bounds({ x: Math.round(panelOpen && side === 'left' ? x - PANEL : x), y: Math.round(wa.y + wa.height - cur.h),
      width: cur.w, height: cur.h });
  }
  function layout() {
    cur = { w: px + (panelOpen ? PANEL : 0), h: chatOpen ? Math.max(px + 24, 300) : px + 24 };
    $('stage').className = side;
    $('panel').style.display = panelOpen ? 'block' : 'none';
    $('panel').style.marginBottom = (chatOpen ? 6 : Math.round(px * 0.35)) + 'px';
    place();
  }
  function setFacing(f) { facing = f; $('flip').style.transform = 'scaleX(' + (FACES_RIGHT ? f : -f) + ')'; }

  function walkTo(tx, speed) {
    return new Promise(res => {
      cancelAnimationFrame(walking);
      setFacing(tx >= x ? 1 : -1);
      body.classList.add('walk');
      let last = performance.now(), lastSend = 0;
      const step = t => {
        const dt = Math.min((t - last) / 1000, 0.1); last = t;
        const dir = Math.sign(tx - x);
        x += dir * speed * S.animSpeed * dt;
        if (dir === 0 || (dir > 0 && x >= tx) || (dir < 0 && x <= tx)) {
          x = tx; place(); body.classList.remove('walk'); walking = null; return res();
        }
        if (t - lastSend > 30) { place(); lastSend = t; }
        walking = requestAnimationFrame(step);
      };
      walking = requestAnimationFrame(step);
    });
  }

  function beep() {
    if (!S.sound) return;
    try {
      const c = new AudioContext(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
      o.frequency.setValueAtTime(660, t); o.frequency.exponentialRampToValueAtTime(990, t + .12);
      g.gain.setValueAtTime(.08, t); g.gain.exponentialRampToValueAtTime(.001, t + .25);
      o.connect(g).connect(c.destination); o.start(); o.stop(t + .26); setTimeout(() => c.close(), 400);
    } catch {}
  }

  function showBubble(text) {
    lastBubble = text; $('bubble').textContent = text;
    $('bubble').style.display = 'block'; $('chat').style.display = 'none';
    panelOpen = true; chatOpen = false; layout();
  }
  function hidePanel() { panelOpen = false; chatOpen = false; layout(); }
  function addMsg(role, text) {
    const d = document.createElement('div'); d.className = 'm ' + role; d.textContent = text;
    $('msgs').appendChild(d); $('msgs').scrollTop = 1e6;
    history.push({ role: role === 'me' ? 'user' : 'assistant', content: text });
    return d;
  }
  function openChat() {
    clearTimeout(stayT);
    if (lastBubble) { addMsg('pet', lastBubble); lastBubble = ''; }
    chatOpen = true; panelOpen = true;
    $('bubble').style.display = 'none'; $('chat').style.display = 'flex';
    layout(); api.focus(); setTimeout(() => $('inp').focus(), 50);
  }
  function closeChat() {
    hidePanel();
    if (active) { clearTimeout(stayT); stayT = setTimeout(leave, 4000); }
  }

  async function visit(d) {
    if (leavePromise) await leavePromise;
    if (active) {                                    // already on screen
      clearTimeout(stayT);
      body.classList.add('happy'); setTimeout(() => body.classList.remove('happy'), 450);
      if (d.openChat) openChat();
      else if (!chatOpen) { showBubble(d.message || 'Hi!'); stayT = setTimeout(leave, rand(10000, 30000)); }
      return;
    }
    active = true; api.busy(true); beep();
    const lo = wa.x + PANEL, hi = Math.max(lo, wa.x + wa.width - px - PANEL);
    const target = rand(lo, hi);
    side = target < wa.x + wa.width / 2 ? 'right' : 'left';
    panelOpen = false; chatOpen = false;
    x = Math.random() < .5 ? wa.x - px - 20 : wa.x + wa.width + 20;   // enter from a screen edge
    layout(); api.show();
    await walkTo(target, 130);
    setFacing(side === 'right' ? 1 : -1);
    await sleep(500);
    if (!active) return;
    if (d.openChat) { lastBubble = d.message || 'Hi!'; openChat(); }
    else { showBubble(d.message || 'Hi!'); stayT = setTimeout(leave, rand(10000, 30000)); }
    wanderLoop();
  }
  function leave() {
    if (!active || chatOpen || leavePromise) return leavePromise;
    leavePromise = (async () => {
      clearTimeout(stayT); clearTimeout(wanderT); hidePanel(); await sleep(250);
      const toLeft = x + px / 2 < wa.x + wa.width / 2;
      await walkTo(toLeft ? wa.x - px - 20 : wa.x + wa.width + 20, 140);   // leave through nearest edge
      finish(); leavePromise = null;
    })();
    return leavePromise;
  }
  function finish() { active = false; panelOpen = false; chatOpen = false; api.hide(); api.busy(false); }

  function wanderLoop() {
    clearTimeout(wanderT);
    wanderT = setTimeout(async () => {
      if (active && !walking && !chatOpen && !leavePromise) {
        const lo = wa.x + PANEL, hi = Math.max(lo, wa.x + wa.width - px - PANEL);
        await walkTo(Math.min(hi, Math.max(lo, x + (Math.random() < .5 ? -1 : 1) * rand(40, 120))), 45);
        setFacing(side === 'right' ? 1 : -1);
      }
      if (active) wanderLoop();
    }, rand(5000, 12000));
  }
  (function blinkLoop() {
    setTimeout(() => {
      if (active && !walking) { body.classList.add('blink'); setTimeout(() => body.classList.remove('blink'), 170); }
      blinkLoop();
    }, rand(2500, 6000));
  })();

  // ---- UI events ----
  $('petbox').onclick = () => {
    if (!active || leavePromise) return;
    body.classList.add('happy'); setTimeout(() => body.classList.remove('happy'), 450);
    chatOpen ? closeChat() : openChat();
  };
  $('close').onclick = closeChat;
  async function send() {
    const t = $('inp').value.trim(); if (!t) return;
    $('inp').value = ''; addMsg('me', t);
    const dots = document.createElement('div'); dots.className = 'm pet'; dots.textContent = '...';
    $('msgs').appendChild(dots); $('msgs').scrollTop = 1e6;
    const r = await api.chat(t, history);
    dots.remove(); addMsg('pet', r.reply + (r.note || ''));
  }
  $('send').onclick = send;
  $('inp').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  apply(await api.info());
  api.onSettings(i => { apply(i); if (active) layout(); });
  api.onVisit(visit);
  api.onForceHide(() => {
    cancelAnimationFrame(walking); walking = null; clearTimeout(stayT); clearTimeout(wanderT);
    body.classList.remove('walk'); leavePromise = null; finish();
  });
  api.ready();
})();
