/* Shared behaviour for the component documentation pages: Copy buttons on code blocks and tab panels. */
(() => {
  document.addEventListener('click', async e => {
    const copy = e.target.closest('.cx-ex [data-copy]');
    if (copy) {
      const text = copy.closest('.cx-ex').querySelector('code').textContent;
      try { await navigator.clipboard.writeText(text); }
      catch (err) { const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
    }
    const tab = e.target.closest('.cx-tabs [role=tab]');
    if (tab) {
      const tabs = tab.closest('.cx-tabs');
      tabs.querySelectorAll('[role=tab]').forEach(t => { const on = t === tab; t.setAttribute('aria-selected', String(on)); document.getElementById(t.getAttribute('aria-controls')).hidden = !on; });
    }
  });
})();
