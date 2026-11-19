/* AppAlert: vanilla JS port of the React AppAlert system (V1.2.2).
   Public API: AppAlert.fire(options) -> Promise<{ isConfirmed, isDenied, isDismissed, value, dismiss }>
   Also: confirm(), deny(), dismiss(reason), close(), init(), DISMISS. One alert at a time; no framework, no dependencies. */
(() => {
  if (window.AppAlert) return;
  const CONFIG = { closeAnimationMs: 160 };
  const DISMISS = Object.freeze({ CANCEL: 'cancel', ESC: 'esc', BACKDROP: 'backdrop', CLOSE: 'close' });
  const DEFAULTS = Object.freeze({
    title: '', text: '', icon: undefined,
    showConfirmButton: true, confirmButtonText: 'OK',
    showCancelButton: false, cancelButtonText: 'Cancel',
    allowOutsideClick: true, allowEscapeKey: true, allowEnterKey: true,
    showCloseButton: false, focusConfirm: true, focusCancel: false, reverseButtons: false,
    confirmButtonColor: undefined, cancelButtonColor: undefined
  });
  const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICON_COLORS = { success: '#22c55e', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

  let uid = 0, state = null, ui = null, closeTimer = null, ready = false;

  const buildResult = ({ isConfirmed = false, isDenied = false, isDismissed = false, value, dismiss } = {}) => ({ isConfirmed, isDenied, isDismissed, value, dismiss });
  const el = (tag, cls, attrs = {}) => { const n = document.createElement(tag); if (cls) n.className = cls; for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  const svg = (tag, attrs, cls) => { const n = document.createElementNS(SVG_NS, tag); if (cls) n.setAttribute('class', cls); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

  // ---- State manager (same contract as the React store) ----
  function forceFinalize() {
    if (!state) return;
    const { _resolve: resolve, _resolved: resolved } = state;
    const result = state._pendingResult || buildResult({ isDismissed: true, dismiss: DISMISS.CLOSE });
    state = null;
    render();
    if (!resolved && resolve) resolve(result);
  }
  function finalizeClose(id) { if (state && state._id === id) forceFinalize(); }
  function requestClose(result) {
    if (!state || state.phase === 'closing') return;
    const resolve = state._resolve;
    state = { ...state, phase: 'closing', _pendingResult: result, _resolved: true };
    render();
    if (resolve) resolve(result);   // the caller continues now; the UI plays its exit animation
  }
  function fire(options = {}) {
    if (state) forceFinalize();   // never stack backdrops; the previous promise resolves as dismissed/close
    return new Promise(resolve => {
      uid += 1;
      state = { ...DEFAULTS, ...options, _id: uid, phase: 'open', _resolved: false, _resolve: resolve, _pendingResult: null };
      render();
    });
  }
  const confirm = (value = true) => requestClose(buildResult({ isConfirmed: true, value }));
  const deny = value => requestClose(buildResult({ isDenied: true, value }));
  const dismiss = reason => requestClose(buildResult({ isDismissed: true, dismiss: reason }));
  const close = () => dismiss(DISMISS.CLOSE);

  // ---- UI ----
  function buildIcon(type) {
    const color = ICON_COLORS[type];
    if (!color) return null;
    const wrap = el('div', 'aa-icon-wrap aa-icon-ring-in');
    const root = svg('svg', { viewBox: '0 0 52 52', fill: 'none' }, 'aa-icon-svg');
    const stroke = { stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round' };
    root.append(svg('circle', { cx: 26, cy: 26, r: 23, ...stroke }, 'aa-icon-ring'));
    if (type === 'success') root.append(svg('path', { d: 'M15 27.5 L22.5 35 L38 18', ...stroke, 'stroke-linejoin': 'round', fill: 'none' }, 'aa-icon-draw-mark aa-icon-success-check'));
    if (type === 'error') root.append(
      svg('line', { x1: 18, y1: 18, x2: 34, y2: 34, ...stroke }, 'aa-icon-draw-mark aa-icon-error-line aa-icon-error-line-1'),
      svg('line', { x1: 34, y1: 18, x2: 18, y2: 34, ...stroke }, 'aa-icon-draw-mark aa-icon-error-line aa-icon-error-line-2'));
    if (type === 'warning') root.append(
      svg('line', { x1: 26, y1: 15, x2: 26, y2: 29, ...stroke, 'stroke-width': 2.75 }, 'aa-icon-draw-mark aa-icon-warning-line'),
      svg('circle', { cx: 26, cy: 36, r: 1.6, fill: color, style: 'transform-origin:26px 36px' }, 'aa-icon-dot-pop'));
    if (type === 'info') root.append(
      svg('line', { x1: 26, y1: 23.5, x2: 26, y2: 35, ...stroke }, 'aa-icon-draw-mark aa-icon-info-line'),
      svg('circle', { cx: 26, cy: 17.5, r: 1.9, fill: color, style: 'transform-origin:26px 17.5px' }, 'aa-icon-dot-pop'));
    wrap.append(root);
    return wrap;
  }

  function build(a) {
    const prevFocus = document.activeElement, prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';   // scroll lock
    const backdrop = el('div', 'aa-backdrop');
    const popup = el('div', 'aa-popup', { role: 'dialog', 'aria-modal': 'true', tabindex: '-1' });
    if (a.title) popup.setAttribute('aria-labelledby', 'aa-title');
    if (a.text) popup.setAttribute('aria-describedby', 'aa-text');
    backdrop.append(popup);

    if (a.showCloseButton) {
      const x = el('button', 'aa-close', { type: 'button', 'aria-label': 'Close' });
      const glyph = svg('svg', { viewBox: '0 0 20 20', fill: 'none' });
      glyph.append(svg('path', { d: 'M5 5l10 10M15 5L5 15', stroke: 'currentColor', 'stroke-width': 1.75, 'stroke-linecap': 'round' }));
      x.append(glyph);
      x.addEventListener('click', () => dismiss(DISMISS.CLOSE));
      popup.append(x);
    }
    const icon = a.icon && buildIcon(a.icon);
    if (icon) { const row = el('div', 'aa-icon'); row.append(icon); popup.append(row); }
    if (a.title) { const t = el('h2', 'aa-title', { id: 'aa-title' }); t.textContent = a.title; popup.append(t); }
    if (a.text) { const p = el('p', 'aa-text', { id: 'aa-text' }); p.textContent = a.text; popup.append(p); }

    let confirmBtn = null, cancelBtn = null;
    if (a.showConfirmButton) {
      confirmBtn = el('button', 'aa-btn aa-confirm', { type: 'button' });
      if (a.confirmButtonColor) confirmBtn.style.backgroundColor = a.confirmButtonColor;
      else if (a.icon === 'warning' && a.showCancelButton) confirmBtn.classList.add('aa-destructive');   // delete-confirmation look
      confirmBtn.textContent = a.confirmButtonText;
      confirmBtn.addEventListener('click', () => confirm(true));
    }
    if (a.showCancelButton) {
      cancelBtn = el('button', 'aa-btn aa-cancel', { type: 'button' });
      if (a.cancelButtonColor) { cancelBtn.style.backgroundColor = a.cancelButtonColor; cancelBtn.style.color = '#fff'; cancelBtn.dataset.custom = ''; }
      cancelBtn.textContent = a.cancelButtonText;
      cancelBtn.addEventListener('click', () => dismiss(DISMISS.CANCEL));
    }
    if (confirmBtn || cancelBtn) {
      const actions = el('div', 'aa-actions');
      // Default order is Cancel (left) then Confirm (right); reverseButtons flips it.
      actions.append(...(a.reverseButtons ? [confirmBtn, cancelBtn] : [cancelBtn, confirmBtn]).filter(Boolean));
      popup.append(actions);
    }
    backdrop.addEventListener('mousedown', e => { if (e.target === backdrop && state && state.allowOutsideClick) dismiss(DISMISS.BACKDROP); });

    const onKeyDown = e => {   // Escape dismisses, Enter confirms, Tab stays inside the popup
      if (!state || state.phase === 'closing') return;
      if (e.key === 'Escape' && state.allowEscapeKey) { e.stopPropagation(); dismiss(DISMISS.ESC); return; }
      if (e.key === 'Enter' && state.allowEnterKey) {
        if (document.activeElement === cancelBtn) return;   // let Enter activate a focused Cancel button
        e.preventDefault(); confirmBtn?.click(); return;
      }
      if (e.key === 'Tab') {
        const items = [...popup.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null);
        if (!items.length) { e.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.body.append(backdrop);

    const target = (a.focusCancel && cancelBtn) || confirmBtn || popup;
    ui = { id: a._id, backdrop, popup, prevFocus, prevOverflow, onKeyDown, closing: false, raf: requestAnimationFrame(() => target.focus()) };
  }

  function teardown() {
    clearTimeout(closeTimer);
    cancelAnimationFrame(ui.raf);
    document.removeEventListener('keydown', ui.onKeyDown, true);
    ui.backdrop.remove();
    document.body.style.overflow = ui.prevOverflow;   // restore scrolling
    ui.prevFocus?.focus?.();                           // restore focus to the trigger
    ui = null;
  }

  function render() {
    if (!state) { if (ui) teardown(); return; }
    if (ui && ui.id !== state._id) teardown();
    if (!ui) build(state);
    if (state.phase === 'closing' && !ui.closing) {
      ui.closing = true;
      ui.backdrop.classList.add('aa-closing'); ui.popup.classList.add('aa-closing');
      const id = state._id;
      closeTimer = setTimeout(() => finalizeClose(id), CONFIG.closeAnimationMs);
    }
  }

  // Idempotent: called once from app.js. Alerts are created on demand, so every page can call fire() without setup.
  function init() { if (!ready) { ready = true; document.documentElement.dataset.appAlert = 'ready'; } return window.AppAlert; }

  window.AppAlert = Object.freeze({ fire, confirm, deny, dismiss, close, init, DISMISS });
})();
