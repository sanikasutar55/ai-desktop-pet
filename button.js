let down = false, moved = false, sx = 0, sy = 0;
document.getElementById('b').addEventListener('mousedown', e => {
  down = true; moved = false; sx = e.screenX; sy = e.screenY; api.btnStart();
});
window.addEventListener('mousemove', e => {
  if (!down) return;
  if (Math.abs(e.screenX - sx) + Math.abs(e.screenY - sy) > 4) moved = true;
  if (moved) api.btnDrag();
});
window.addEventListener('mouseup', () => {
  if (!down) return; down = false;
  if (moved) api.btnDrop(); else api.btnClick();
});
