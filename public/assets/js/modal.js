/* AppModal: vanilla JS port of the React AppModal (generic dialog; AppAlert stays the alert/confirmation system).
   API: AppModal.open({ title, description, size: sm|md|lg|xl|full, body, footer, loading, closeOnBackdrop, closeOnEscape, onOpen, onClose }) -> instance
   instance: { el, panel, body, foot, close(), setLoading(bool), setBody(content), closed (Promise) }.
   Declarative: [data-modal-open="#template"] (template data-title / data-description / data-size, slots [data-slot=body|footer]). */
(() => {
  if (window.AppModal) return;
  const CONFIG = { closeAnimationMs: 160 };
  const SIZES = ['sm', 'md', 'lg', 'xl', 'full'];
  const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input:not([type=hidden]),select,[tabindex]:not([tabindex="-1"])';
  const NS = 'http://www.w3.org/2000/svg';
  const stack = [];
  const layers = (window.__appLayers = window.__appLayers || []);   // shared by Drawer and Modal so Escape / Tab only affect the topmost layer
  let uid = 0;
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
    const size = SIZES.includes(opts.size) ? opts.size : 'md', id = `am-title-${++uid}`, previous = document.activeElement;
    const root = el('div', 'am-root' + (size === 'full' ? ' am-isfull' : ''));
    const backdrop = el('div', 'am-backdrop', { 'aria-hidden': 'true' });
    const panel = el('div', `am-panel am-${size}`, { tabindex: '-1', role: 'dialog', 'aria-modal': 'true' });
    if (opts.title) panel.setAttribute('aria-labelledby', id); else panel.setAttribute('aria-label', 'Dialog');
    const body = el('div', 'am-body');
    const inst = { el: root, panel, body, foot: null, closing: false };
    if (opts.title) {
      const head = el('div', 'am-head'), box = el('div'), h = el('h2', 'am-title', { id });
      h.textContent = opts.title; box.append(h);
      if (opts.description) { const p = el('p', 'am-desc'); p.textContent = opts.description; box.append(p); }
      const x = el('button', 'am-close', { type: 'button', 'aria-label': 'Close dialog', 'data-tooltip': 'Close' });
      const g = document.createElementNS(NS, 'svg'); g.setAttribute('viewBox', '0 0 20 20'); g.setAttribute('fill', 'none');
      const p2 = document.createElementNS(NS, 'path'); p2.setAttribute('d', 'M5 5l10 10M15 5L5 15'); p2.setAttribute('stroke', 'currentColor'); p2.setAttribute('stroke-width', '1.75'); p2.setAttribute('stroke-linecap', 'round');
      g.append(p2); x.append(g); head.append(box, x); panel.append(head);
      x.addEventListener('click', () => inst.close('button'));
    }
    let content = opts.body;
    const render = () => {
      if (inst.loading) { body.replaceChildren(); const s = el('span', 'am-spin', { role: 'status', 'aria-label': 'Loading' }); body.append(s); } else fill(body, content);
    };
    inst.setLoading = on => { inst.loading = !!on; render(); };
    inst.setBody = c => { content = c; render(); };
    inst.loading = !!opts.loading; render(); panel.append(body);
    if (opts.footer && (!Array.isArray(opts.footer) || opts.footer.length)) {
      const foot = el('div', 'am-foot');
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
      inst.closing = true; root.classList.add('am-closing');
      setTimeout(() => {
        window.removeEventListener('keydown', onKey, true);
        root.remove(); stack.splice(stack.indexOf(inst), 1); layers.splice(layers.indexOf(inst), 1); unlock();
        previous?.focus?.();
        opts.onClose?.(reason || 'close'); resolveClosed(reason || 'close');
      }, reduced() ? 0 : CONFIG.closeAnimationMs);
      return inst.closed;
    };
    backdrop.addEventListener('mousedown', () => { if (opts.closeOnBackdrop !== false) inst.close('backdrop'); });
    window.addEventListener('keydown', onKey, true);
    stack.push(inst); layers.push(inst); lock(); document.body.append(root); panel.focus();
    opts.onOpen?.(inst);
    return inst;
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-modal-open]');
    if (!t) return;
    const tpl = document.querySelector(t.dataset.modalOpen); if (!tpl) return;
    const frag = tpl.content.cloneNode(true), b = frag.querySelector('[data-slot=body]'), f = frag.querySelector('[data-slot=footer]');
    const inst = open({ title: tpl.dataset.title, description: tpl.dataset.description, size: tpl.dataset.size, body: b || frag, footer: f ? [...f.childNodes] : null });
    inst.el.addEventListener('click', ev => { if (ev.target.closest('[data-modal-close]')) inst.close('button'); });
  });
  window.AppModal = Object.freeze({ open, closeAll: () => [...stack].forEach(i => i.close('api')) });
})();
