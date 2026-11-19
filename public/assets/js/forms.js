/* AppForms: vanilla JS companion to forms.css.
   Validation: AppForms.validate(form) -> { valid, errors }, AppForms.values(form), AppForms.setErrors(form, errors) (Laravel 422 shape),
   AppForms.clearErrors(form), AppForms.reset(form), AppForms.rules (register custom rules).
   <form data-ff-form> validates on submit and dispatches 'appform:valid' ({ detail: { values } }) or 'appform:invalid' ({ detail: { errors } }).
   Widgets are enhanced from markup: [data-ff=password|number|multiselect|combobox|tags|otp|file|color|repeater|phone]. */
(() => {
  if (window.AppForms) return;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const MESSAGES = { required: 'This field is required.', email: 'Enter a valid email address.', url: 'Enter a valid URL.', tel: 'Enter a valid phone number.', pattern: 'Invalid format.', match: 'Values do not match.',
    min: n => `Must be at least ${n}.`, max: n => `Must be at most ${n}.`, minlength: n => `Use at least ${n} characters.`, maxlength: n => `Use at most ${n} characters.` };
  const rules = {};   // custom rules: AppForms.rules.strongPassword = (value, field, form) => 'message' | ''
  const uid = (() => { let i = 0; return p => `${p}-${++i}`; })();
  const fieldName = f => f.dataset.ffName || f.querySelector('[name]')?.name || '';
  const agg = f => f.querySelector('[data-ff-value]');

  // ---- values ----
  function fieldValue(field) {
    const a = agg(field);
    if (a) return a.dataset.ffType === 'array' ? JSON.parse(a.value || '[]') : a.value;
    const radios = $$('input[type=radio]', field), boxes = $$('input[type=checkbox]', field), file = field.querySelector('input[type=file]');
    if (radios.length) return radios.find(r => r.checked)?.value ?? '';
    if (boxes.length > 1) return boxes.filter(b => b.checked).map(b => b.value);
    if (boxes.length === 1) return boxes[0].checked;
    if (file) return [...file.files].map(f => f.name);
    return field.querySelector('input,select,textarea')?.value ?? '';
  }
  const isEmpty = v => v === '' || v == null || v === false || (Array.isArray(v) && !v.length);
  function values(form) {   // nested names like items[0][name] become nested objects
    const out = {};
    $$('.ff-field', form).forEach(f => {
      if (f.closest('[data-ff-skip]') || f.closest('template') || f.querySelector('.ff-field')) return;
      const first = f.querySelector('input:not([type=hidden]),select,textarea'); if (first && first.disabled) return;   // disabled controls are not collected
      const name = fieldName(f); if (!name) return;
      const parts = name.replace(/\]/g, '').split('['); let o = out;
      parts.forEach((p, i) => { if (i === parts.length - 1) o[p] = fieldValue(f); else o = o[p] ||= {}; });
    });
    const arrayify = o => { if (o && typeof o === 'object' && !Array.isArray(o)) { for (const k in o) o[k] = arrayify(o[k]); const ks = Object.keys(o); if (ks.length && ks.every(k => /^\d+$/.test(k))) return ks.sort((x, y) => x - y).map(k => o[k]); } return o; };
    return arrayify(out);
  }

  // ---- validation ----
  function checkField(field, form) {
    const ctl = field.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea') || field.querySelector('input');
    if (!ctl || ctl.disabled || field.dataset.ffDisabled !== undefined) return '';
    if (field.querySelector('.ff-field')) return '';   // wrappers of nested fields (repeater) are validated through their inner fields
    const v = fieldValue(field), required = ctl.required || field.dataset.required !== undefined || field.querySelector('[required]');
    if (required && isEmpty(v)) return MESSAGES.required;
    if (isEmpty(v)) return '';
    const a = agg(field);
    if (a) return a.dataset.rule && rules[a.dataset.rule] ? rules[a.dataset.rule](v, field, form) || '' : '';   // composite widgets (OTP, tags, multi-select, phone): only required + custom rule
    const s = typeof v === 'string' ? v : '';
    if (ctl.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return MESSAGES.email;
    if (ctl.type === 'url') { try { new URL(s); } catch (e) { return MESSAGES.url; } }
    if (ctl.type === 'tel' && !/^[0-9+()\-\s.]{7,}$/.test(s)) return MESSAGES.tel;
    if (ctl.pattern && !new RegExp(`^(?:${ctl.pattern})$`).test(s)) return ctl.dataset.patternMessage || MESSAGES.pattern;
    if (ctl.minLength > 0 && s.length < ctl.minLength) return MESSAGES.minlength(ctl.minLength);
    if (ctl.maxLength > 0 && s.length > ctl.maxLength) return MESSAGES.maxlength(ctl.maxLength);
    if (ctl.type === 'number' || ctl.dataset.ffNumber !== undefined) {
      if (ctl.min !== '' && +s < +ctl.min) return MESSAGES.min(ctl.min);
      if (ctl.max !== '' && +s > +ctl.max) return MESSAGES.max(ctl.max);
    }
    if (ctl.dataset.match) { const other = form.querySelector(ctl.dataset.match); if (other && other.value !== s) return MESSAGES.match; }
    if (ctl.dataset.rule && rules[ctl.dataset.rule]) { const m = rules[ctl.dataset.rule](v, field, form); if (m) return m; }
    return '';
  }
  function showError(field, message) {
    let err = field.querySelector('.ff-error');
    if (!err) { err = document.createElement('p'); err.className = 'ff-error'; err.setAttribute('role', 'alert'); field.append(err); }
    if (!err.id) err.id = uid('ff-err');
    err.textContent = message; err.hidden = !message;
    field.classList.toggle('ff-invalid', !!message);
    $$('input:not([type=hidden]),select,textarea,.ff-ms-trigger', field).forEach(c => {
      if (message) { c.setAttribute('aria-invalid', 'true'); c.setAttribute('aria-describedby', err.id); } else { c.removeAttribute('aria-invalid'); c.removeAttribute('aria-describedby'); }
    });
  }
  function validate(form) {
    const errors = {};
    $$('.ff-field', form).forEach(f => {
      if (f.closest('template')) return;
      const m = checkField(f, form); showError(f, m);
      if (m) errors[fieldName(f) || f.id] = m;
    });
    return { valid: !Object.keys(errors).length, errors };
  }
  function setErrors(form, errors = {}) {   // Laravel: { errors: { email: ['msg'] } } or just the inner object
    const map = errors.errors || errors;
    $$('.ff-field', form).forEach(f => { const m = map[fieldName(f)]; showError(f, Array.isArray(m) ? m[0] : m || ''); });
    const first = form.querySelector('.ff-invalid input:not([type=hidden]),.ff-invalid select,.ff-invalid textarea,.ff-invalid button'); first?.focus();
  }
  const clearErrors = form => $$('.ff-field', form).forEach(f => showError(f, ''));
  function reset(form) { form.reset(); clearErrors(form); $$('[data-ff-value]', form).forEach(a => { a.value = a.dataset.ffType === 'array' ? '[]' : ''; }); form.dispatchEvent(new CustomEvent('appform:reset')); $$('[data-ff]', form).forEach(w => w.dispatchEvent(new CustomEvent('ff:reset'))); }

  document.addEventListener('submit', e => {
    const form = e.target.closest('[data-ff-form]'); if (!form) return;
    e.preventDefault();
    const r = validate(form);
    if (r.valid) form.dispatchEvent(new CustomEvent('appform:valid', { bubbles: true, detail: { values: values(form) } }));
    else { form.querySelector('.ff-invalid input:not([type=hidden]),.ff-invalid select,.ff-invalid textarea,.ff-invalid button')?.focus(); form.dispatchEvent(new CustomEvent('appform:invalid', { bubbles: true, detail: { errors: r.errors } })); }
  });
  const touch = e => { const f = e.target.closest('.ff-field'), form = e.target.closest('[data-ff-form]'); if (f && form && (e.type === 'focusout' || f.classList.contains('ff-invalid'))) showError(f, checkField(f, form)); };
  document.addEventListener('focusout', touch); document.addEventListener('input', touch); document.addEventListener('change', touch);

  // ---- widget enhancers ----
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const emit = a => { a.dispatchEvent(new Event('input', { bubbles: true })); a.dispatchEvent(new Event('change', { bubbles: true })); };
  const setAgg = (a, v) => { a.value = Array.isArray(v) ? JSON.stringify(v) : v; emit(a); };
  const closeOnOutside = (root, pop) => document.addEventListener('click', e => { if (!root.contains(e.target)) pop.hidden = true; });
  const ENH = {
    password(w) {
      const input = w.querySelector('input'), b = w.querySelector('.ff-eye'); if (!b) return;
      b.addEventListener('click', () => { const show = input.type === 'password'; input.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; b.setAttribute('aria-pressed', String(show)); });
    },
    number(w) {
      const input = w.querySelector('input'), step = dir => { dir > 0 ? input.stepUp() : input.stepDown(); emit(input); };
      w.addEventListener('click', e => { const b = e.target.closest('[data-dir]'); if (b && !input.disabled && !input.readOnly) step(+b.dataset.dir); });
    },
    multiselect(w) {
      const trig = w.querySelector('.ff-ms-trigger'), pop = w.querySelector('.ff-pop'), a = agg(w), ph = trig.dataset.placeholder || 'Select...';
      const sync = () => {
        const sel = $$('input:checked', pop); trig.replaceChildren();
        if (!sel.length) trig.append(mk('span', 'ff-help', ph));
        sel.forEach(i => { const c = mk('span', 'ff-chip', i.parentElement.textContent.trim()); trig.append(c); });
        setAgg(a, sel.map(i => i.value));
      };
      trig.addEventListener('click', () => { if (!trig.disabled) pop.hidden = !pop.hidden; });
      pop.addEventListener('change', sync); closeOnOutside(w, pop);
      w.addEventListener('keydown', e => { if (e.key === 'Escape') { pop.hidden = true; trig.focus(); } });
      w.addEventListener('ff:reset', () => setTimeout(sync)); sync();
    },
    combobox(w) {
      const input = w.querySelector('input.ff-c'), list = w.querySelector('.ff-pop'), a = agg(w), opts = $$('[role=option]', list);
      const show = q => { let n = 0; opts.forEach(o => { const hit = o.textContent.toLowerCase().includes(q.toLowerCase()); o.hidden = !hit; n += hit; }); list.hidden = !n; };
      input.addEventListener('input', () => { a.value = ''; show(input.value); });
      input.addEventListener('focus', () => show(''));
      list.addEventListener('click', e => { const o = e.target.closest('[role=option]'); if (!o) return; input.value = o.textContent.trim(); setAgg(a, o.dataset.value); list.hidden = true; });
      input.addEventListener('keydown', e => { if (e.key === 'Escape') list.hidden = true; if (e.key === 'Enter' && !list.hidden) { e.preventDefault(); const o = opts.find(x => !x.hidden); o?.click(); } });
      closeOnOutside(w, list); w.addEventListener('ff:reset', () => { input.value = ''; });
    },
    tags(w) {
      const input = w.querySelector('input:not([type=hidden])'), a = agg(w); let tags = JSON.parse(a.value || '[]');
      const render = () => { $$('.ff-chip', w).forEach(c => c.remove()); tags.forEach(t => { const c = mk('span', 'ff-chip', t); const x = mk('button', null, '×'); x.type = 'button'; x.setAttribute('aria-label', `Remove ${t}`); x.addEventListener('click', () => { tags = tags.filter(v => v !== t); render(); }); c.append(x); w.insertBefore(c, input); }); setAgg(a, tags); };
      const add = () => { const v = input.value.trim().replace(/,$/, ''); if (v && !tags.includes(v)) tags.push(v); input.value = ''; render(); };
      input.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } else if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); render(); } });
      input.addEventListener('blur', () => { if (input.value.trim()) add(); });
      w.addEventListener('ff:reset', () => { tags = []; render(); }); render();
    },
    otp(w) {
      const boxes = $$('.ff-otp-i', w), a = agg(w), sync = () => setAgg(a, boxes.map(b => b.value).join(''));
      boxes.forEach((b, i) => {
        b.addEventListener('input', () => { b.value = b.value.replace(/\D/g, '').slice(-1); if (b.value && boxes[i + 1]) boxes[i + 1].focus(); sync(); });
        b.addEventListener('keydown', e => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus(); });
        b.addEventListener('paste', e => { const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, boxes.length); if (!t) return; e.preventDefault(); [...t].forEach((c, k) => { boxes[k].value = c; }); boxes[Math.min(t.length, boxes.length - 1)].focus(); sync(); });
      });
      w.addEventListener('ff:reset', () => boxes.forEach(b => { b.value = ''; }));
    },
    file(w) {
      const input = w.querySelector('input[type=file]'), drop = w.querySelector('.ff-drop'), list = w.querySelector('.ff-files'), image = w.dataset.ffMode === 'image';
      const render = () => {
        list.replaceChildren();
        [...input.files].forEach((f, i) => {
          const li = mk('li'); if (image && f.type.startsWith('image/')) { const im = mk('img'); im.alt = ''; im.src = URL.createObjectURL(f); li.append(im); }
          const n = mk('span', null, f.name), sz = mk('span', 'ff-help', `${(f.size / 1024).toFixed(1)} KB`), rm = mk('button', 'ff-ibtn', '×'); rm.type = 'button'; rm.setAttribute('aria-label', `Remove ${f.name}`);
          rm.addEventListener('click', () => { const dt = new DataTransfer(); [...input.files].forEach((x, k) => { if (k !== i) dt.items.add(x); }); input.files = dt.files; render(); emit(input); });
          li.append(n, sz, rm); list.append(li);
        });
      };
      const take = files => { const dt = new DataTransfer(); (input.multiple ? [...input.files, ...files] : [files[0]]).filter(Boolean).forEach(f => dt.items.add(f)); input.files = dt.files; render(); emit(input); };
      drop.addEventListener('click', () => input.click());
      drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('ff-over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('ff-over'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('ff-over'); take([...e.dataTransfer.files]); });
      input.addEventListener('change', render); w.addEventListener('ff:reset', () => setTimeout(render));
    },
    color(w) {
      const pick = w.querySelector('input[type=color]'), text = w.querySelector('input[type=text]');
      pick.addEventListener('input', () => { text.value = pick.value; emit(text); });
      text.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(text.value)) pick.value = text.value; });
      w.addEventListener('click', e => { const s = e.target.closest('.ff-sw'); if (s) { pick.value = text.value = s.dataset.color; emit(text); } });
    },
    phone(w) {
      const sel = w.querySelector('select'), input = w.querySelector('input[type=tel]'), a = agg(w), sync = () => setAgg(a, input.value ? `${sel.value} ${input.value}` : '');
      sel.addEventListener('change', sync); input.addEventListener('input', sync);
    },
    repeater(w) {
      const tpl = w.querySelector('template'), host = w.querySelector('.ff-rep-rows'), max = +w.dataset.max || Infinity;
      const reindex = () => $$('.ff-rep-row', host).forEach((row, i) => $$('[name],[for],[id],[data-ff-name]', row).forEach(n => { ['name', 'for', 'id', 'data-ff-name'].forEach(at => { const v = n.getAttribute(at); if (v) n.setAttribute(at, v.replace(/\[\d+\]/, `[${i}]`).replace(/__i__/, i)); }); }));
      const add = () => { if ($$('.ff-rep-row', host).length >= max) return; host.append(tpl.content.cloneNode(true)); reindex(); enhance(host); };
      w.addEventListener('click', e => { if (e.target.closest('[data-ff-add]')) add(); const r = e.target.closest('[data-ff-remove]'); if (r) { r.closest('.ff-rep-row').remove(); reindex(); } });
      if (!host.children.length) add();
    }
  };
  function enhance(root = document) {
    $$('[data-ff]', root).forEach(w => { if (w.dataset.ffReady) return; w.dataset.ffReady = '1'; ENH[w.dataset.ff]?.(w); });
  }
  function init(root) { enhance(root); return window.AppForms; }
  window.AppForms = { init, validate, values, setErrors, clearErrors, reset, rules, messages: MESSAGES };
  document.addEventListener('DOMContentLoaded', () => init());
})();
