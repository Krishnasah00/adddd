/* Forms page: demo wiring only (feedback via the existing AppAlert / toast systems). Nothing is sent to a server. */
(() => {
  if (!window.AppForms) return;
  AppForms.rules.noSpaces = value => /\s/.test(value) ? 'Spaces are not allowed.' : '';
  AppForms.rules.strongPassword = value => (/[A-Z]/.test(value) && /\d/.test(value)) ? '' : 'Use at least one capital letter and one number.';
  const later = (ms, fn) => new Promise(res => setTimeout(() => res(fn()), ms));
  document.addEventListener('appform:valid', async e => {
    const id = e.target.id, v = e.detail.values;
    if (id === 'ff-basic') toast.success('Basic form is valid (demo).');
    if (id === 'ff-login') toast.success(`Signed in as ${v.email} (demo, no authentication).`);
    if (id === 'ff-register') AppAlert.fire({ icon: 'success', title: 'Account created', text: `Welcome, ${v.first}! (frontend demo, nothing was saved)` });
    if (id === 'ff-contact') toast.promise(later(1500, () => v), { loading: 'Sending...', success: 'Message sent (simulated).', error: 'Unable to send.' }, {});
    if (id === 'ff-validation') toast.success('All validation rules passed.');
    if (id === 'ff-select') toast.info(`Collected: ${JSON.stringify(v)}`, { duration: 6000 });
    if (id === 'ff-gallery') toast.success('Gallery form collected ' + Object.keys(v).length + ' fields (see the values box).');
    const out = e.target.querySelector('[data-ff-output]'); if (out) out.textContent = JSON.stringify(v, null, 2);
  });
  document.addEventListener('appform:invalid', e => { if (e.target.dataset.ffDemo !== undefined) toast.error(`${Object.keys(e.detail.errors).length} field(s) need attention.`); });
  document.addEventListener('click', e => {
    const r = e.target.closest('[data-ff-reset]'); if (r) AppForms.reset(r.closest('form'));
    if (e.target.closest('[data-ff-server-error]')) { const f = document.getElementById('ff-validation'); AppForms.setErrors(f, { errors: { email: ['This email address is already registered.'], username: ['That username is taken.'] } }); toast.error('Server validation failed (simulated 422).'); }
  });
})();
