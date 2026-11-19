/* Toaster Notification page: live preview controls and runnable usage examples. The reusable system lives in toast-notification.js. */
(() => {
  const preview = document.getElementById('td-preview');
  if (!preview || !window.toast) return;
  const $ = id => document.getElementById(id);
  const status = text => { $('td-status').textContent = text; };
  const settings = () => {
    const d = $('td-duration').value;
    return { position: $('td-position').value, theme: $('td-theme').value, duration: d === 'false' ? false : Number(d), showProgressBar: $('td-progress').checked, showCloseButton: $('td-close').checked, pauseOnHover: $('td-hover').checked };
  };
  const loadingSettings = () => { const { duration, showProgressBar, ...rest } = settings(); return rest; };   // loading toasts are persistent
  const content = fallback => ({ title: $('td-title').value.trim() || undefined, message: $('td-message').value.trim() || fallback, description: $('td-desc').value.trim() || undefined });
  const fire = (type, fallback, extra = {}) => { const c = content(fallback); return toast[type](c.message, { ...settings(), title: c.title, description: c.description, ...extra }); };
  const startLoading = fallback => { const c = content(fallback); return toast.loading(c.message, { ...loadingSettings(), title: c.title, description: c.description }); };
  const later = (ms, fn) => setTimeout(fn, ms);
  const resultOptions = () => { const s = settings(); return { duration: s.duration, showProgressBar: s.showProgressBar }; };
  const TYPES = ['success', 'error', 'warning', 'info'];

  const DEMOS = {
    success: () => fire('success', 'Profile updated successfully.'),
    error: () => fire('error', 'Unable to connect to the server.'),
    warning: () => fire('warning', 'Please fill all required fields.'),
    info: () => fire('info', 'New notification available.'),
    loading: () => startLoading('Uploading...'),
    'loading-success': () => { const id = startLoading('Uploading...'); later(2000, () => toast.update(id, { type: 'success', title: 'Completed', message: 'Upload complete.', ...resultOptions() })); },
    'loading-error': () => { const id = startLoading('Uploading...'); later(2000, () => toast.update(id, { type: 'error', title: 'Failed', message: 'Upload failed. Please try again.', ...resultOptions() })); },
    promise: () => toast.promise(new Promise(res => later(1800, () => res({ name: 'Alex' }))), { loading: 'Saving...', success: u => `Saved ${u.name}'s profile.`, error: 'Unable to save profile.' }, loadingSettings()).then(() => status('Promise resolved.')),
    'promise-error': () => toast.promise(new Promise((_, rej) => later(1800, () => rej(new Error('Network error')))), { loading: 'Saving...', success: 'Saved.', error: err => `Unable to save: ${err.message}` }, loadingSettings()).catch(() => status('Promise rejected (the rejection is passed through).')),
    persistent: () => fire('info', 'This stays until you dismiss it.', { title: 'Persistent', duration: false }),
    duration: () => { const d = settings().duration; const ms = d === false ? 10000 : d; fire('info', `This closes after ${ms / 1000} seconds.`, { duration: ms }); },
    position: () => fire('info', `Showing at ${$('td-position').value}.`, { title: 'Custom position' }),
    light: () => fire('info', 'This toast uses the light theme.', { theme: 'light' }),
    dark: () => fire('info', 'This toast uses the dark theme.', { theme: 'dark' }),
    multiple: () => TYPES.forEach((t, i) => later(i * 200, () => fire(t, `Notification ${i + 1} of ${TYPES.length} (${t}).`))),
    queue: () => { for (let i = 1; i <= 8; i++) fire('info', `Queued toast ${i} of 8`); status('8 toasts fired; only maxVisible are shown, the rest wait in the queue.'); },
    duplicate: () => { const a = toast.info('Duplicate prevention test.', { ...settings(), preventDuplicates: true }); const b = toast.info('Duplicate prevention test.', { ...settings(), preventDuplicates: true }); status(a === b ? 'Second identical toast was blocked (same id returned).' : 'Duplicate was shown.'); },
    clear: () => { toast.clear(); status('All notifications cleared.'); }
  };
  preview.addEventListener('click', e => { const b = e.target.closest('[data-demo]'); if (b && DEMOS[b.dataset.demo]) DEMOS[b.dataset.demo](); });
  $('td-max').addEventListener('change', e => toast.configure({ maxVisible: Number(e.target.value) }));
  $('td-form').addEventListener('submit', e => {   // custom test configuration
    e.preventDefault();
    const t = $('td-type').value;
    if (t === 'loading') startLoading('Working...'); else fire(t, `Test ${t} notification.`);
  });

  // Usage examples: each runner below is generated from the same code that is shown in the example block.
  const RUNNERS = {
    'user-created': () => {
      toast.success("User created successfully.");
    },
    'user-updated': () => {
      toast.success("User updated successfully.");
    },
    'user-deleted': () => {
      toast.success("User deleted successfully.");
    },
    'user-failed': () => {
      toast.error("Failed to create user.", { title: "Create user" });
    },
    'prod-added': () => {
      toast.success("Product added.");
    },
    'prod-updated': () => {
      toast.success("Product updated.");
    },
    'prod-deleted': () => {
      toast.success("Product deleted.");
    },
    'order-updated': () => {
      toast.success("Order status updated.", { title: "Order #10482" });
    },
    'order-failed': () => {
      toast.error("Order processing failed.", { title: "Order #10482", duration: 6000 });
    },
    'set-saved': () => {
      toast.success("Settings saved successfully.");
    },
    'set-reset': () => {
      toast.success("Settings reset successfully.");
    },
    'ajax-ok': () => {
      const id = toast.loading("Saving changes...");
      
      setTimeout(() => {
        toast.update(id, { type: "success", title: "Saved", message: "Changes saved successfully." });
      }, 1500);
    },
    'ajax-fail': () => {
      const id = toast.loading("Saving changes...");
      
      setTimeout(() => {
        toast.update(id, { type: "error", title: "Save failed", message: "The server could not save your changes." });
      }, 1500);
    },
    'ajax-promise': () => {
      toast.promise(
        new Promise(resolve => setTimeout(() => resolve({ name: "Alex" }), 1500)),
        { loading: "Saving...", success: user => `Saved ${user.name}`, error: "Unable to save." }
      );
    }
  };
  const examples = document.getElementById('td-examples');
  examples?.addEventListener('click', async e => {
    const run = e.target.closest('[data-run]'), copy = e.target.closest('[data-copy]');
    if (run && RUNNERS[run.dataset.run]) RUNNERS[run.dataset.run]();
    if (copy) {
      const text = copy.closest('.td-ex').querySelector('code').textContent;
      try { await navigator.clipboard.writeText(text); }
      catch (err) { const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
    }
  });
})();
