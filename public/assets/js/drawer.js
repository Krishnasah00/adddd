/* AppDrawer: vanilla JS port of the React AppDrawer.
   API: AppDrawer.open({ side, title, body, footer, width, height, closeOnBackdrop, closeOnEscape, onOpen, onClose }) -> instance
   instance: { el, panel, body, foot, close(), closed (Promise) }. Declarative: [data-drawer-open="#template"]. */
(() => {
  if (window.AppDrawer) return;
  const CONFIG = { closeAnimationMs: 160 };
  const SIDES = ['left', 'right', 'top', 'bottom'];
  const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input:not([type=hidden]),select,[tabindex]:not([tabindex="-1"])';
  const stack = [];
  const layers = (window.__appLayers = window.__appLayers || []);   // shared by Drawer and Modal so Escape / Tab only affect the topmost layer
  let uid = 0;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, cls, attrs = {}) => { const n = document.createElement(tag); if (cls) n.className = cls; for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  const fill = (node, content) => { node.replaceChildren(); if (content instanceof Node) node.append(content); else if (Array.isArray(content)) node.append(...content); else if (content != null) node.textContent = content; };
  const lock = () => { const d = document.documentElement, n = +d.dataset.scrollLocks || 0; if (n === 0) d.dataset.prevOverflow = document.body.style.overflow; d.dataset.scrollLocks = n + 1; document.body.style.overflow = 'hidden'; };
  const unlock = () => { const d = document.documentElement, n = Math.max((+d.dataset.scrollLocks || 1) - 1, 0); d.dataset.scrollLocks = n; if (n === 0) document.body.style.overflow = d.dataset.prevOverflow || ''; };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.animations === 'off' || document.documentElement.dataset.reduced === 'on';
  function buttons(list, inst) {   // footer: array of { label, variant: 'primary'|'secondary'|'danger', onClick(inst, e), closes }
    return list.map(b => {
      const n = el('button', 'btn' + (b.variant === 'primary' ? ' btn-primary' : b.variant === 'danger' ? ' btn-danger' : ''), { type: 'button' });
      n.textContent = b.label;
      n.addEventListener('click', async e => { const r = b.onClick ? await b.onClick(inst, e) : undefined; if (b.closes !== false && r !== false) inst.close(); });
      return n;
    });
  }
  function open(opts = {}) {
    const side = SIDES.includes(opts.side) ? opts.side : 'right', id = `ad-title-${++uid}`;
    const previous = document.activeElement;
    const root = el('div', 'ad-root', { role: 'dialog', 'aria-modal': 'true' });
    const backdrop = el('div', 'ad-backdrop', { 'aria-hidden': 'true' });
    const panel = el('div', `ad-panel ad-${side}`, { tabindex: '-1' });
    if (opts.width && (side === 'left' || side === 'right')) { panel.style.width = opts.width; panel.style.maxWidth = '100vw'; }   // enhancement: custom size
    if (opts.height && (side === 'top' || side === 'bottom')) { panel.style.height = opts.height; panel.style.maxHeight = '100vh'; }
    const head = el('div', 'ad-head'), title = el('h2', 'ad-title', { id });
    title.textContent = opts.title || '';
    const x = el('button', 'ad-close', { type: 'button', 'aria-label': 'Close', 'data-tooltip': 'Close' });
    const g = document.createElementNS(NS, 'svg'); g.setAttribute('viewBox', '0 0 20 20'); g.setAttribute('fill', 'none');
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', 'M5 5l10 10M15 5L5 15'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.75'); p.setAttribute('stroke-linecap', 'round');
    g.append(p); x.append(g); head.append(title, x);
    const body = el('div', 'ad-body'); fill(body, opts.body);
    panel.append(head, body);
    if (opts.title) root.setAttribute('aria-labelledby', id); else root.setAttribute('aria-label', 'Drawer');
    const inst = { el: root, panel, body, foot: null, closing: false };
    if (opts.footer && (!Array.isArray(opts.footer) || opts.footer.length)) {
      const foot = el('div', 'ad-foot');
      if (Array.isArray(opts.footer) && !opts.footer.every(x => x instanceof Node)) foot.append(...buttons(opts.footer, inst)); else fill(foot, opts.footer);   // button definitions, or ready-made Nodes
      panel.append(foot); inst.foot = foot;
    }
    root.append(backdrop, panel);
    let resolveClosed; inst.closed = new Promise(r => { resolveClosed = r; });
    const onKey = e => {
      if (layers[layers.length - 1] !== inst) return;
      if (e.key === 'Escape' && opts.closeOnEscape !== false) { e.stopPropagation(); inst.close('escape'); }
      if (e.key === 'Tab') {
        const items = [...panel.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null);
        if (!items.length) { e.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    inst.close = reason => {
      if (inst.closing) return inst.closed;
      inst.closing = true; root.classList.add('ad-closing');
      setTimeout(() => {
        window.removeEventListener('keydown', onKey, true);
        root.remove(); stack.splice(stack.indexOf(inst), 1); layers.splice(layers.indexOf(inst), 1); unlock();
        previous?.focus?.();
        opts.onClose?.(reason || 'close'); resolveClosed(reason || 'close');
      }, reduced() ? 0 : CONFIG.closeAnimationMs);
      return inst.closed;
    };
    x.addEventListener('click', () => inst.close('button'));
    backdrop.addEventListener('click', () => { if (opts.closeOnBackdrop !== false) inst.close('backdrop'); });
    window.addEventListener('keydown', onKey, true);
    stack.push(inst); layers.push(inst); lock(); document.body.append(root); panel.focus();
    opts.onOpen?.(inst);
    return inst;
  }
  // Declarative use: <button data-drawer-open="#tpl"> opens <template id="tpl" data-side data-title data-width data-height>
  // whose content may contain [data-slot=body] / [data-slot=footer]; any [data-drawer-close] inside closes the drawer.
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-drawer-open]');
    if (t) {
      const tpl = document.querySelector(t.dataset.drawerOpen); if (!tpl) return;
      const frag = tpl.content.cloneNode(true), b = frag.querySelector('[data-slot=body]'), f = frag.querySelector('[data-slot=footer]');
      const inst = open({ side: tpl.dataset.side, title: tpl.dataset.title, width: tpl.dataset.width, height: tpl.dataset.height, body: b || frag, footer: f ? [...f.childNodes] : null });
      inst.el.addEventListener('click', ev => { if (ev.target.closest('[data-drawer-close]')) inst.close('button'); });
      return;
    }
  });
  window.AppDrawer = Object.freeze({ open, closeAll: () => [...stack].forEach(i => i.close('api')) });
})();
