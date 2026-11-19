/* Modal page: live preview. The reusable component is modal.js (AppAlert stays the alert system; it is used here for the destructive confirmation). */
(() => {
  const root = document.getElementById('mo-preview');
  if (!root || !window.AppModal) return;
  const $ = id => document.getElementById(id);
  const parts = id => { const tpl = $(id), frag = tpl.content.cloneNode(true); return { tpl, body: frag.querySelector('[data-slot=body]') || frag, foot: frag.querySelector('[data-slot=footer]') }; };
  const open = (id, extra = {}) => {
    const { tpl, body, foot } = parts(id);
    const inst = AppModal.open({ title: tpl.dataset.title, description: tpl.dataset.description, size: tpl.dataset.size, body, footer: foot ? [...foot.childNodes] : null,
      closeOnBackdrop: $('mo-backdrop').checked, closeOnEscape: $('mo-esc').checked, ...extra });
    inst.el.addEventListener('click', e => { if (e.target.closest('[data-modal-close]')) inst.close('button'); });
    return inst;
  };
  const DEMOS = {
    basic: () => open('tpl-mo-basic'), small: () => open('tpl-mo-small'), large: () => open('tpl-mo-large'), full: () => open('tpl-mo-full'), form: () => open('tpl-mo-form'),
    footer: () => open('tpl-mo-footer'), long: () => open('tpl-mo-long'),
    confirm: () => AppModal.open({ title: 'Delete project?', description: 'Confirm with a generic modal; the destructive step asks AppAlert.', size: 'sm', body: 'Deleting a project removes its tasks and files.',
      closeOnBackdrop: $('mo-backdrop').checked, closeOnEscape: $('mo-esc').checked,
      footer: [{ label: 'Cancel' }, { label: 'Delete', variant: 'danger', closes: false, onClick: async inst => { const r = await AppAlert.fire({ icon: 'warning', title: 'Are you sure?', text: "You won't be able to undo this action.", showCancelButton: true, confirmButtonText: 'Yes, delete it!' }); if (r.isConfirmed) { inst.close(); toast.success('Project deleted (demo).'); } } }] }),
    loading: () => { const m = AppModal.open({ title: 'Loading content', size: 'sm', loading: true, footer: [{ label: 'Close' }] }); setTimeout(() => m.setBody('Loaded after a simulated delay (setLoading / setBody).') || m.setLoading(false), 1500); }
  };
  root.addEventListener('click', e => { const b = e.target.closest('[data-demo]'); if (b && DEMOS[b.dataset.demo]) DEMOS[b.dataset.demo](); });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-mo-save]')) { toast.success('Changes saved (demo).'); AppModal.closeAll(); }
    if (e.target.closest('[data-mo-draft]')) toast.info('Draft saved (demo). The modal stays open.');
  });
  document.addEventListener('appform:valid', e => { if (e.target.id === 'mo-contact-form') { toast.success(`Message from ${e.detail.values.name} accepted (demo).`); AppModal.closeAll(); } });
  document.addEventListener('appform:invalid', e => { if (e.target.id === 'mo-contact-form') toast.error('Please fix the highlighted fields.'); });
})();
