(async () => {
  const $ = s => document.querySelector(s);
  const vs = $('#visit'), vc = $('#visitCustom');
  function fill(info) {
    const S = info.settings;
    document.querySelectorAll('[data-k]').forEach(el => {
      if (el.type === 'checkbox') el.checked = !!S[el.dataset.k]; else el.value = S[el.dataset.k];
    });
    if (['5', '10', '15', '30', '60'].includes(String(S.visitMinutes))) { vs.value = String(S.visitMinutes); vc.style.display = 'none'; }
    else { vs.value = 'custom'; vc.value = S.visitMinutes; vc.style.display = 'inline-block'; }
    $('#st').textContent = info.hasKey ? 'API key is saved (stored encrypted on this computer).' : 'No API key saved - Basic mode will be used.';
  }
  document.querySelectorAll('[data-k]').forEach(el => el.addEventListener('change', () => {
    const v = el.type === 'checkbox' ? el.checked : (el.type === 'range' || el.dataset.num) ? Number(el.value) : el.value;
    api.set({ [el.dataset.k]: v });
  }));
  vs.onchange = () => {
    if (vs.value === 'custom') { vc.style.display = 'inline-block'; vc.focus(); }
    else { vc.style.display = 'none'; api.set({ visitMinutes: Number(vs.value) }); }
  };
  vc.onchange = () => api.set({ visitMinutes: Math.max(1, Number(vc.value) || 5) });
  $('#saveKey').onclick = async () => {
    const ok = await api.setKey($('#key').value); $('#key').value = '';
    $('#st').textContent = ok ? 'API key saved. Turn on "AI chat" to use it.' : 'API key removed.';
  };
  api.onSettings(fill);
  fill(await api.info());
})();
