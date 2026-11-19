/* AppTooltip: the single tooltip used across the dashboard (collapsed sidebar, header and icon buttons, component close buttons, toasts).
   Declarative: add data-tooltip="Text" (optional data-tooltip-placement="top|bottom|left|right") to any element.
   API: AppTooltip.show(target, text, { placement, delay }), AppTooltip.hide(). One element, themed by --tt-* tokens, flips/clamps inside the viewport. */
(() => {
  if (window.AppTooltip) return;
  const CONFIG = { delay: 300, gap: 8, margin: 8, arrowInset: 10 };
  const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
  let tip = null, label = null, timer = 0, hideTimer = 0, current = null, desired = null;
  const ensure = () => {
    if (tip) return;
    tip = document.createElement('div'); tip.id = 'app-tooltip'; tip.className = 'app-tooltip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
    label = document.createElement('span'); const arrow = document.createElement('span'); arrow.className = 'app-tooltip-arrow';
    tip.append(label, arrow); document.body.append(tip);
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  function place(target, preferred) {
    const r = target.getBoundingClientRect(), t = { w: tip.offsetWidth, h: tip.offsetHeight }, g = CONFIG.gap, m = CONFIG.margin;
    const fits = { top: r.top - t.h - g >= m, bottom: r.bottom + t.h + g <= innerHeight - m, left: r.left - t.w - g >= m, right: r.right + t.w + g <= innerWidth - m };
    let p = preferred;
    if (!fits[p]) p = fits[OPPOSITE[p]] ? OPPOSITE[p] : (['bottom', 'top', 'right', 'left'].find(k => fits[k]) || p);   // flip, then any side that fits
    let x, y, arrow;
    if (p === 'top' || p === 'bottom') {
      x = clamp(r.left + r.width / 2 - t.w / 2, m, innerWidth - t.w - m); y = p === 'top' ? r.top - t.h - g : r.bottom + g;
      arrow = clamp(r.left + r.width / 2 - x, CONFIG.arrowInset, t.w - CONFIG.arrowInset);
    } else {
      y = clamp(r.top + r.height / 2 - t.h / 2, m, innerHeight - t.h - m); x = p === 'left' ? r.left - t.w - g : r.right + g;
      arrow = clamp(r.top + r.height / 2 - y, CONFIG.arrowInset, t.h - CONFIG.arrowInset);
    }
    tip.dataset.placement = p; tip.style.left = Math.round(x) + 'px'; tip.style.top = Math.round(y) + 'px'; tip.style.setProperty('--tt-arrow', Math.round(arrow) + 'px');
  }
  function hide(owner) {   // optional owner element: only hides a tooltip that belongs to it (the sidebar must not cancel a header tooltip)
    if (owner instanceof Node && desired && !owner.contains(desired)) return;
    clearTimeout(timer); clearTimeout(hideTimer); desired = null;
    if (!tip) return;
    tip.classList.remove('is-visible'); tip.hidden = true;
    if (current) current.removeAttribute('aria-describedby');
    current = null;
  }
  function show(target, text, opts = {}) {
    if (!target || !text) return;
    ensure(); clearTimeout(timer); clearTimeout(hideTimer); desired = target;
    const delay = tip.hidden ? (opts.delay ?? CONFIG.delay) : 0;   // moving between neighbours switches instantly (no flicker)
    const run = () => {
      if (current && current !== target) current.removeAttribute('aria-describedby');
      current = target; label.textContent = text; tip.hidden = false;
      place(target, opts.placement || 'bottom'); target.setAttribute('aria-describedby', 'app-tooltip');
      requestAnimationFrame(() => tip.classList.add('is-visible'));
    };
    delay ? (timer = setTimeout(run, delay)) : run();
  }
  const softHide = () => { clearTimeout(timer); clearTimeout(hideTimer); hideTimer = setTimeout(hide, 80); };   // short grace so moving between neighbours does not flicker
  const fromEvent = e => e.target.closest?.('[data-tooltip]');
  document.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const t = fromEvent(e); if (t && t !== current) show(t, t.dataset.tooltip, { placement: t.dataset.tooltipPlacement }); });
  document.addEventListener('pointerout', e => { const t = fromEvent(e); if (t && !t.contains(e.relatedTarget)) softHide(); });
  document.addEventListener('focusin', e => { const t = fromEvent(e); if (t && t.matches(':focus-visible')) show(t, t.dataset.tooltip, { placement: t.dataset.tooltipPlacement, delay: 0 }); });
  document.addEventListener('focusout', e => { if (fromEvent(e)) softHide(); });
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); }, true);
  addEventListener('scroll', hide, true); addEventListener('resize', hide);
  window.AppTooltip = Object.freeze({ show, hide, CONFIG });
})();
