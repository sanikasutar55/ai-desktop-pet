const { contextBridge, ipcRenderer: r } = require('electron');
contextBridge.exposeInMainWorld('api', {
  info: () => r.invoke('settings:get'),
  set: p => r.invoke('settings:set', p),
  setKey: k => r.invoke('key:set', k),
  chat: (text, history) => r.invoke('chat:send', { text, history }),
  ready: () => r.send('pet:ready'),
  bounds: b => r.send('pet:bounds', b),
  show: () => r.send('pet:show'),
  hide: () => r.send('pet:hide'),
  busy: v => r.send('pet:busy', v),
  focus: () => r.send('pet:focus'),
  onVisit: cb => r.on('pet:visit', (e, d) => cb(d)),
  onSettings: cb => r.on('settings:changed', (e, d) => cb(d)),
  onForceHide: cb => r.on('pet:forceHide', () => cb()),
  btnStart: () => r.send('btn:start'),
  btnDrag: () => r.send('btn:drag'),
  btnDrop: () => r.send('btn:drop'),
  btnClick: () => r.send('btn:click')
});
