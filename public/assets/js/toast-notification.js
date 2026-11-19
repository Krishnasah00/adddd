/* Toast notification system: vanilla JS port of the React toast-system (store + container + item).
   API: toast.success|error|warning|info|loading(message, options), toast.show(options), toast.update(id, patch),
        toast.promise(promiseOrFn, { loading, success, error }, options), toast.dismiss(id), toast.clear([position]),
        toast.configure(patch), toast.getConfig(), toast.init(). No framework, no dependencies. */
(() => {
  if (window.toast) return;
  const POSITIONS = ['top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right'];
  const DEFAULT_CONFIG = {
    theme: 'auto',            // 'light' | 'dark' | 'auto' (auto follows the dashboard theme)
    position: 'top-right', duration: 4000,   // ms, or false for a persistent toast
    maxVisible: 5, pauseOnHover: true, showProgressBar: true, showCloseButton: true, showIcon: true,
    preventDuplicates: false, gap: 10, width: 340, zIndex: 9999   // above AppAlert (z-index 1000)
  };
  const ACCENT = { success: '#22c55e', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6', loading: '#9ca3af', custom: '#8b5cf6' };
  const ANIMATION_MS = 280;   // keep in sync with the 280ms transition in toast-notification.css

  let toasts = [], config = { ...DEFAULT_CONFIG }, counter = 0;
  const items = new Map();    // id -> runtime state of a rendered toast
  const root = document.documentElement;

  // ---- helpers ----
  const generateId = () => `toast-${Date.now().toString(36)}-${++counter}`;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || root.dataset.animations === 'off' || root.dataset.reduced === 'on';
  const isDark = theme => theme === 'dark' || (theme === 'auto' && root.classList.contains('dark'));
  const el = (tag, cls, attrs = {}) => { const n = document.createElement(tag); if (cls) n.className = cls; for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  function normalizeOptionNames(options) {
    const patch = { ...options };
    if ('showProgressBar' in patch) { patch.progressBar = patch.showProgressBar; delete patch.showProgressBar; }
    if ('showCloseButton' in patch) { patch.closable = patch.showCloseButton; delete patch.showCloseButton; }
    return patch;
  }
  function mergeToastOptions(cfg, options) {   // explicit duration:false survives because only ?? falls back
    const o = normalizeOptionNames(options);
    return {
      id: o.id || generateId(), type: o.type || 'info', title: o.title, message: o.message ?? '', description: o.description,
      theme: o.theme || cfg.theme, position: o.position || cfg.position, duration: o.duration ?? cfg.duration,
      closable: o.closable ?? cfg.showCloseButton, pauseOnHover: o.pauseOnHover ?? cfg.pauseOnHover,
      progressBar: o.progressBar ?? cfg.showProgressBar, icon: o.icon ?? cfg.showIcon, customIcon: o.customIcon,
      onDismiss: o.onDismiss, createdAt: Date.now()
    };
  }

  // ---- icons (same SVG shapes as the original icons.js) ----
  const white = { stroke: 'white', 'stroke-width': 1.8, 'stroke-linecap': 'round' };
  const ICONS = {
    success: c => [sv('circle', { cx: 11, cy: 11, r: 11, fill: c }), sv('path', { d: 'M6.5 11.3l2.6 2.6 6-6', ...white, 'stroke-linejoin': 'round', fill: 'none' })],
    error: c => [sv('circle', { cx: 11, cy: 11, r: 11, fill: c }), sv('path', { d: 'M11 6.2v5.4', ...white }), sv('circle', { cx: 11, cy: 15.3, r: 1, fill: 'white' })],
    warning: c => [sv('path', { d: 'M11 1.5l10 18.5H1L11 1.5z', fill: c }), sv('path', { d: 'M11 8.2v5', ...white }), sv('circle', { cx: 11, cy: 16, r: 1, fill: 'white' })],
    info: c => [sv('circle', { cx: 11, cy: 11, r: 11, fill: c }), sv('circle', { cx: 11, cy: 6.8, r: 1.05, fill: 'white' }), sv('path', { d: 'M11 9.8v6', ...white })],
    loading: () => [sv('circle', { cx: 11, cy: 11, r: 9, stroke: 'currentColor', 'stroke-opacity': .25, 'stroke-width': 2.2, fill: 'none' }), sv('path', { d: 'M20 11a9 9 0 00-9-9', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', fill: 'none' })],
    custom: c => [sv('path', { d: 'M11 1.8c-1.1 3-4.3 4.6-4.3 8.7a4.9 4.9 0 009.8 0c0-1.3-.5-2.2-1.1-2.7.3 1.2.1 2.3-.7 2.9a2.7 2.7 0 11-3.5-4c1.1-.9 1.4-2.7-.2-4.9z', fill: c })]
  };
  function buildIcon(type, color, custom) {
    if (custom) return typeof custom === 'function' ? custom(color) : custom.cloneNode(true);   // customIcon: (color) => Node, or a Node
    const svg = sv('svg', { width: 22, height: 22, viewBox: '0 0 22 22', 'aria-hidden': 'true', focusable: 'false' });
    if (type === 'loading') svg.setAttribute('class', 'tn-spin');
    svg.append(...(ICONS[type] || ICONS.info)(color));
    return svg;
  }

  // ---- toast element: content, theme, timer, dismissal ----
  function applyTheme(rt) {
    rt.el.classList.toggle('tn-dark', isDark(rt.data.theme));
    rt.el.style.boxShadow = `0 10px 15px -3px rgba(0,0,0,0.12), 0 0 0 1px ${ACCENT[rt.data.type] || ACCENT.custom}26`;
  }
  function fill(rt) {   // rebuilds the inside of the toast; the outer element keeps its phase, hover and timer state
    const d = rt.data, accent = ACCENT[d.type] || ACCENT.custom, persistent = d.duration === false || d.duration == null;
    rt.el.dataset.type = d.type;
    rt.el.classList.toggle('tn-reduced', reducedMotion());
    applyTheme(rt);
    const row = el('div', 'tn-row');
    if (d.icon) { const ic = el('span', 'tn-icon'); ic.append(buildIcon(d.type, accent, d.customIcon)); row.append(ic); }
    const body = el('div', 'tn-body');
    if (d.title) { const t = el('p', 'tn-title'); t.textContent = d.title; body.append(t); }
    if (d.message) { const m = el('p', 'tn-msg', d.message.length > 34 ? { 'data-tooltip': d.message } : {}); m.textContent = d.message; body.append(m); }
    if (d.description) { const x = el('p', 'tn-desc'); x.textContent = d.description; body.append(x); }
    row.append(body);
    rt.el.replaceChildren(row);
    if (d.closable) {
      const b = el('button', 'tn-close', { type: 'button', 'aria-label': 'Dismiss notification', 'data-tooltip': 'Dismiss' });
      const g = sv('svg', { width: 13, height: 13, viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': 'true' });
      g.append(sv('path', { d: 'M2.5 2.5l9 9M11.5 2.5l-9 9', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
      b.append(g); rt.el.append(b);
    }
    rt.bar = null;
    if (d.progressBar && !persistent && d.duration > 0) {
      const track = el('div', 'tn-bar-track'), bar = el('div', 'tn-bar');
      bar.style.background = accent; bar.style.transform = `scaleX(${rt.fraction ?? 1})`;
      track.append(bar); rt.el.append(track); rt.bar = bar;
    }
  }
  // One rAF loop drives progress + auto-dismiss. Hover only stops the clock, so resuming continues from the same fraction.
  function syncTimer(rt) {
    const d = rt.data, persistent = d.duration === false || d.duration == null, key = persistent ? 'p' : d.duration;
    if (rt.timerKey === key) return;   // same duration: keep the running timer (matches the React effect dependencies)
    rt.timerKey = key; cancelAnimationFrame(rt.raf);
    if (persistent || !d.duration || d.duration <= 0) return;
    rt.elapsed = 0; rt.paused = false; rt.fraction = 1; rt.last = performance.now();
    if (rt.bar) rt.bar.style.transform = 'scaleX(1)';
    const tick = now => {
      const delta = now - rt.last; rt.last = now;
      if (!rt.paused) rt.elapsed += delta;
      const remaining = Math.max(d.duration - rt.elapsed, 0);
      rt.fraction = remaining / d.duration;
      if (rt.bar) rt.bar.style.transform = `scaleX(${rt.fraction})`;
      if (remaining <= 0) { requestDismiss(rt); return; }
      rt.raf = requestAnimationFrame(tick);
    };
    rt.raf = requestAnimationFrame(tick);
  }
  function requestDismiss(rt) {
    if (rt.phase === 'exiting') return;
    rt.phase = 'exiting'; cancelAnimationFrame(rt.raf);
    rt.el.classList.add('tn-hidden');
    rt.exitTimer = setTimeout(() => removeFromStore(rt.id), reducedMotion() ? 0 : ANIMATION_MS);
  }
  function createItem(data) {
    const rt = { id: data.id, data, el: el('div', 'tn-toast tn-hidden', { role: 'alert', 'aria-live': 'polite', 'aria-atomic': 'true', 'data-toast-id': data.id }), phase: 'entering', timerKey: undefined };
    rt.el.dataset.side = data.position.endsWith('right') ? 'right' : data.position.endsWith('left') ? 'left' : 'center';
    rt.el.addEventListener('mouseenter', () => { if (rt.data.pauseOnHover) rt.paused = true; });
    rt.el.addEventListener('mouseleave', () => { if (rt.data.pauseOnHover) rt.paused = false; });
    rt.el.addEventListener('click', e => { if (e.target.closest('.tn-close')) requestDismiss(rt); });
    return rt;
  }
  function destroyItem(rt) { cancelAnimationFrame(rt.raf); clearTimeout(rt.exitTimer); rt.el.remove(); items.delete(rt.id); }

  // ---- container: one fixed layer per occupied position, newest first, capped by maxVisible (the rest queue) ----
  function ensureRoot() {
    let r = document.getElementById('toast-root');
    if (!r) { r = el('div', 'tn-root', { id: 'toast-root', role: 'region', 'aria-label': 'Notifications' }); document.body.append(r); }
    return r;
  }
  function render() {
    if (!document.body) return;
    const host = ensureRoot(), groups = {}, wanted = new Set();
    for (const t of toasts) (groups[t.position || config.position] ||= []).push(t);
    for (const pos of POSITIONS) {
      const list = (groups[pos] || []).slice(0, config.maxVisible);
      let layer = host.querySelector(`.tn-pos-${pos}`);
      if (!list.length) { layer?.remove(); continue; }
      if (!layer) { layer = el('div', `tn-layer tn-pos-${pos}`); host.append(layer); }
      layer.style.zIndex = config.zIndex; layer.style.gap = config.gap + 'px'; layer.style.setProperty('--tn-width', config.width + 'px');
      list.forEach((t, i) => {
        wanted.add(t.id);
        let rt = items.get(t.id), isNew = !rt;
        if (isNew) { rt = createItem(t); items.set(t.id, rt); }
        if (isNew || rt.src !== t) { rt.data = t; rt.src = t; fill(rt); syncTimer(rt); }
        if (layer.children[i] !== rt.el) layer.insertBefore(rt.el, layer.children[i] || null);
        if (isNew) {   // enter: paint the hidden state first, then transition in on the next frame
          void rt.el.offsetWidth;
          requestAnimationFrame(() => { if (rt.phase === 'entering') { rt.phase = 'visible'; rt.el.classList.remove('tn-hidden'); } });
        }
      });
    }
    for (const rt of [...items.values()]) if (!wanted.has(rt.id)) destroyItem(rt);
  }

  // ---- store + public API ----
  const findByMessage = (message, type) => toasts.find(t => t.message === message && t.type === type);
  function show(options = {}) {
    if ((options.preventDuplicates ?? config.preventDuplicates) && options.message) {
      const existing = findByMessage(options.message, options.type || 'info');
      if (existing) return existing.id;
    }
    const data = mergeToastOptions(config, options);
    toasts = [data, ...toasts]; render();
    return data.id;
  }
  function update(id, patch) {   // patches in place: loading -> success flows, restarts the timer when duration changes
    const normalized = normalizeOptionNames(patch);
    let found = false;
    toasts = toasts.map(t => t.id !== id ? t : (found = true, { ...t, ...normalized, id: t.id, createdAt: Date.now() }));
    if (found) render();
    return found;
  }
  function removeFromStore(id) {
    const target = toasts.find(t => t.id === id);
    toasts = toasts.filter(t => t.id !== id); render();
    if (target && target.onDismiss) target.onDismiss(id);
  }
  function dismiss(id) { const rt = items.get(id); if (rt) requestDismiss(rt); else removeFromStore(id); }
  function clear(position) {
    for (const t of [...toasts]) if (!position || t.position === position) dismiss(t.id);
  }
  const typed = type => (message, options = {}) => show({ ...options, type, message });
  const loading = (message, options = {}) => show({ duration: false, showProgressBar: false, ...options, type: 'loading', message });
  function promise(maybePromise, messages = {}, options = {}) {
    const id = loading(messages.loading ?? 'Loading...', options);
    const run = typeof maybePromise === 'function' ? maybePromise() : maybePromise;
    const finish = (type, text, fallback) => update(id, { type, message: text ?? fallback, duration: options.duration ?? config.duration, showProgressBar: options.showProgressBar ?? config.showProgressBar });
    return Promise.resolve(run).then(
      result => { finish('success', typeof messages.success === 'function' ? messages.success(result) : messages.success, 'Done'); return result; },
      err => { finish('error', typeof messages.error === 'function' ? messages.error(err) : messages.error, 'Something went wrong'); throw err; });
  }
  function configure(patch) { config = { ...config, ...patch }; render(); }
  function init() { if (document.body) ensureRoot(); return window.toast; }

  document.addEventListener('prefs:change', () => items.forEach(rt => { applyTheme(rt); rt.el.classList.toggle('tn-reduced', reducedMotion()); }));   // follow dashboard theme / motion prefs live
  window.toast = { show, success: typed('success'), error: typed('error'), warning: typed('warning'), info: typed('info'), loading, promise, update, dismiss, clear, configure, getConfig: () => ({ ...config }), init };
})();
