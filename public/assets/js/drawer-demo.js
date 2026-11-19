/* Drawer page: live preview controls. The reusable component is drawer.js. */
(() => {
  const root = document.getElementById('dr-preview');
  if (!root || !window.AppDrawer) return;
  const $ = id => document.getElementById(id);
  const open = (tplId, extra = {}) => {
    const tpl = $(tplId), frag = tpl.content.cloneNode(true), b = frag.querySelector('[data-slot=body]'), f = frag.querySelector('[data-slot=footer]');
    const side = $('dr-side').value, w = $('dr-width').value, h = $('dr-height').value;
    const inst = AppDrawer.open({ side, title: tpl.dataset.title, body: b || frag, footer: f ? [...f.childNodes] : null, width: w || undefined, height: h || undefined,
      closeOnBackdrop: $('dr-backdrop').checked, closeOnEscape: $('dr-esc').checked, ...extra });
    inst.el.addEventListener('click', e => { if (e.target.closest('[data-drawer-close]')) inst.close('button'); });
    return inst;
  };
  const DEMOS = {
    basic: () => open('tpl-dr-basic'), nav: () => open('tpl-dr-nav'), filter: () => open('tpl-dr-filter'), form: () => open('tpl-dr-form'), action: () => open('tpl-dr-action'),
    custom: () => { $('dr-side').value = 'right'; open('tpl-dr-basic', { width: '560px' }); }
  };
  root.addEventListener('click', e => { const b = e.target.closest('[data-demo]'); if (b && DEMOS[b.dataset.demo]) DEMOS[b.dataset.demo](); });
  document.addEventListener('click', async e => {
    if (e.target.closest('[data-dr-apply]')) { toast.success('Filters applied (demo).'); AppDrawer.closeAll(); }
    if (e.target.closest('[data-dr-reset]')) { const f = e.target.closest('.ad-root').querySelector('form'); if (f) AppForms.reset(f); }
    if (e.target.closest('[data-dr-archive]')) { AppDrawer.closeAll(); toast.success('Item archived (demo).'); }
    if (e.target.closest('[data-dr-delete]')) {
      const r = await AppAlert.fire({ icon: 'warning', title: 'Delete item?', text: 'This cannot be undone.', showCancelButton: true, confirmButtonText: 'Delete' });
      if (r.isConfirmed) { AppDrawer.closeAll(); toast.success('Item deleted (demo).'); }
    }
  });
  document.addEventListener('appform:valid', e => { if (e.target.id === 'dr-user-form') { toast.success(`User ${e.detail.values.name} created (demo, nothing is saved).`); AppDrawer.closeAll(); } });
  document.addEventListener('appform:invalid', e => { if (e.target.id === 'dr-user-form') toast.error('Please fix the highlighted fields.'); });
})();
