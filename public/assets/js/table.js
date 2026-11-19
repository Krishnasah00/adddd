/* AppTable: one reusable, backend-agnostic data table (vanilla JS port of the React DataTable system, extended for AdminKit).
   AppTable.create(host, config) -> instance. Local mode (data[]) and server-side mode (serverSide + onQuery) use the same engine.
   Instance: setData(rows, total), setState(name), setLoading(b), setError(msg), getSelected(), clearSelection(), clearFilters(), getState(), refresh(), destroy().
   Config highlights: columns[{ id, header, type, accessor, render, sortable, filter, align, width, sticky, required, hidden, exportValue }],
   variant ('default' | 'compact'), title + showCount, selectable, expandable(row), rowActions + rowActionsVariant ('menu' | 'icons' | 'compact'),
   bulkActions, bulkBarMode, filters[], toolbar{}, serverSide + onQuery(query), loading / error / empty handling, export / print / import. */
(() => {
  if (window.AppTable) return;
  const CONFIG = { pageSizes: [10, 15, 25, 50, 100], defaultPageSize: 15, minColWidth: 60, maxSkeletonRows: 8, searchDebounceMs: 300, filterDebounceMs: 200, stateToneFallback: 'info' };
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, cls, text, attrs = {}) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  const badge = (text, tone = CONFIG.stateToneFallback) => mk('span', `badge ${tone}`, text);
  const textOf = v => v instanceof Node ? v.textContent : v == null ? '' : String(v);
  const cmp = (a, b) => (typeof a === 'number' && typeof b === 'number') ? a - b : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
  const ICONS = {
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    columns: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    down: '<path d="m6 9 6 6 6-6"/>', up: '<path d="m18 15-6-6-6 6"/>', left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
    sort: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };
  function icon(name, size = 16) {
    const s = document.createElementNS(NS, 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.75, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) s.setAttribute(k, v);
    s.innerHTML = ICONS[name] || '';   // static, trusted path data only
    return s;
  }
  function details(items) {   // helper for expandable rows: [{ value, label }] -> Node
    const w = mk('div', 'at-details');
    items.forEach(i => { const d = mk('div', 'at-dt'); d.append(mk('div', 'at-dv', textOf(i.value)), mk('div', 'at-dl', i.label)); w.append(d); });
    return w;
  }
  // ---- helpers ported from the original utils: CSV parsing, export download ----
  function parseCsv(text) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim() !== ''));
  }
  const download = (name, mime, data) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // ---- individual column filters: text | select | number | date (value strings are what onQuery receives as columnSearch) ----
  const NUM = '-?\\d+(?:\\.\\d+)?';
  function numberTest(expr) {   // "7", ">100", ">=10", "<5", "10-50", "10..50"
    let m;
    if ((m = expr.match(new RegExp(`^(>=|<=|>|<|=)?\\s*(${NUM})$`)))) { const op = m[1] || '=', n = +m[2]; return v => op === '>=' ? v >= n : op === '<=' ? v <= n : op === '>' ? v > n : op === '<' ? v < n : v === n; }
    if ((m = expr.match(new RegExp(`^(${NUM})\\s*(?:-|\\.\\.)\\s*(${NUM})$`)))) { const a = +m[1], b = +m[2]; return v => v >= Math.min(a, b) && v <= Math.max(a, b); }
    return null;
  }
  function dateTest(expr) {   // "2023-01-01..2023-06-30", "2023-01-01..", "..2023-06-30" or an exact "2023-06-30"
    if (!expr.includes('..')) return v => String(v).slice(0, 10) === expr;
    const [a = '', b = ''] = expr.split('..');
    return v => { const s = String(v).slice(0, 10); return (!a || s >= a) && (!b || s <= b); };
  }

  function create(host, opts = {}) {
    const o = { selectable: false, getRowId: r => r.id, pageSizes: CONFIG.pageSizes, defaultPageSize: CONFIG.defaultPageSize, stickyHeader: true, toolbar: {}, filters: [], rowActions: [], bulkActions: [], emptyMessage: 'No records to display.', variant: 'default', ...opts };
    const compact = o.variant === 'compact';
    const tb = { search: !compact, columns: true, pageSize: compact, ...o.toolbar };
    const bulkReplace = (o.bulkBarMode || (compact ? 'replace' : 'below')) === 'replace';
    const bulkClear = o.bulkClear ?? !compact;
    const normFilter = c => { let f = c.filter; if (f === undefined && o.columnSearch && c.searchable !== false) f = 'text'; if (!f) return null; if (typeof f === 'string') f = { type: f }; return { type: 'text', ...f }; };
    const cols = o.columns.map(c => ({ ...c, type: c.type || 'text', filter: normFilter(c) }));
    const colById = id => cols.find(c => c.id === id);
    const S = { data: o.data || [], total: o.totalRows, loading: !!o.loading, error: null, forced: null, page: 1, pageSize: o.defaultPageSize, sort: null, search: '', colSearch: {}, filterValues: {}, selected: new Set(), expanded: new Set(),
      hidden: new Set(cols.filter(c => c.hidden).map(c => c.id)), order: cols.map(c => c.id), widths: {}, lastTotal: 0 };
    const value = (c, r) => c.accessor ? c.accessor(r) : r[c.id];
    const visibleCols = () => S.order.filter(id => !S.hidden.has(id)).map(colById);
    const idOf = r => String(o.getRowId(r));
    const totalRecords = () => o.serverSide ? (S.total ?? S.data.length) : S.data.length;
    let timer, menu = null, head, body, table, titleEl;

    const root = mk('div', 'at' + (compact ? ' at-compact' : '')), bar = mk('div', 'at-bar'), chipsBar = mk('div', 'at-chips'), bulk = mk('div', 'at-bulk'), scroll = mk('div', 'at-scroll' + (o.stickyHeader ? ' at-sticky-head' : '')), foot = mk('div', 'at-foot');
    if (o.maxHeight) scroll.style.maxHeight = o.maxHeight;
    const live = mk('div', 'sr-only', '', { 'aria-live': 'polite' });
    root.append(bar, chipsBar, bulk, scroll, foot, live); host.replaceChildren(root);

    // ---- query pipeline (local mode); in serverSide mode the host app answers onQuery(query) ----
    function testFor(c, expr) {
      const t = c.filter?.type || 'text';
      if (t === 'select') return r => textOf(value(c, r)) === expr;
      if (t === 'number') { const f = numberTest(expr); return f ? r => f(Number(value(c, r))) : () => true; }
      if (t === 'date') return r => dateTest(expr)(textOf(value(c, r)));
      const s = expr.toLowerCase(); return r => textOf(value(c, r)).toLowerCase().includes(s);
    }
    function view() {
      if (o.serverSide) return { rows: S.data, total: totalRecords() };
      let rows = S.data.slice();
      const q = S.search.trim().toLowerCase();
      if (q) rows = rows.filter(r => cols.some(c => c.searchable !== false && textOf(value(c, r)).toLowerCase().includes(q)));
      for (const c of cols) { const expr = (S.colSearch[c.id] || '').trim(); if (expr) rows = rows.filter(testFor(c, expr)); }
      o.filters.forEach(f => { const v = S.filterValues[f.id]; if (v) rows = rows.filter(r => f.match ? f.match(r, v) : String(r[f.id]) === v); });
      if (S.sort) { const c = colById(S.sort.id), d = S.sort.dir === 'asc' ? 1 : -1; rows.sort((a, b) => d * cmp(c.type === 'number' ? Number(value(c, a)) : value(c, a), c.type === 'number' ? Number(value(c, b)) : value(c, b))); }
      const total = rows.length, pages = Math.max(1, Math.ceil(total / S.pageSize));
      if (S.page > pages) S.page = pages;   // never stay on an invalid page after filters or deletions
      return { rows: rows.slice((S.page - 1) * S.pageSize, S.page * S.pageSize), total, all: rows };
    }
    const allFiltered = () => view().all || S.data;
    const activeColSearch = () => Object.fromEntries(Object.entries(S.colSearch).filter(([, v]) => String(v).trim() !== ''));
    function queryState() {   // exactly what a server-side backend needs
      const cs = activeColSearch();
      return { page: S.page, pageSize: S.pageSize, sort: S.sort, sortField: S.sort ? S.sort.id : null, sortDirection: S.sort ? S.sort.dir : null, search: S.search, columnSearch: cs, columnFilters: { ...cs }, filters: { ...S.filterValues } };
    }
    function query() { if (o.serverSide) o.onQuery?.(queryState()); else renderBody(); }
    const anyFilter = () => !!(S.search || Object.keys(activeColSearch()).length || Object.values(S.filterValues).some(Boolean));

    // ---- floating menus (fixed, so scroll containers never clip them) ----
    const closeMenu = () => { menu?.remove(); menu = null; };
    function openMenu(anchor, content) {
      closeMenu(); menu = mk('div', 'at-menu', null, { role: 'menu' }); menu.append(...content); document.body.append(menu);
      const r = anchor.getBoundingClientRect(), m = menu.getBoundingClientRect();
      menu.style.left = Math.max(8, Math.min(r.right - m.width, innerWidth - m.width - 8)) + 'px';
      menu.style.top = (r.bottom + m.height + 8 > innerHeight ? Math.max(8, r.top - m.height - 4) : r.bottom + 4) + 'px';
      menu.querySelector('button,input')?.focus();
    }
    const onDoc = e => { if (menu && !menu.contains(e.target) && !e.target.closest('[data-at-menu]')) closeMenu(); };
    const onKey = e => { if (e.key === 'Escape' && menu) closeMenu(); };
    document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey); addEventListener('scroll', closeMenu, true);

    // ---- toolbar ----
    const tbtn = (label, ic, fn, cls = 'btn', extra = {}) => { const b = mk('button', cls, null, { type: 'button', ...extra }); if (ic) b.append(icon(ic, 15)); b.append(document.createTextNode(label)); b.addEventListener('click', fn); return b; };
    function titleText() {
      const base = typeof o.title === 'function' ? o.title({ total: totalRecords(), filtered: S.lastTotal }) : (o.title || '');
      return o.showCount && typeof o.title !== 'function' ? `${base} (${o.countMode === 'filtered' ? S.lastTotal : totalRecords()})` : base;
    }
    const updateTitle = () => { if (titleEl) titleEl.textContent = titleText(); };
    function pageSizeSelect() {
      const sz = mk('select', 'at-sel at-ps', null, { 'aria-label': 'Rows per page' });
      o.pageSizes.forEach(n => { const op = new Option(`${n} / page`, n); op.selected = n === S.pageSize; sz.append(op); });
      sz.addEventListener('change', () => { S.pageSize = +sz.value; S.page = 1; query(); }); return sz;
    }
    function renderBar() {
      bar.replaceChildren(); titleEl = null;
      if (o.title) { titleEl = mk('div', 'at-title', titleText()); bar.append(titleEl); }
      const tools = mk('div', 'at-tools');
      if (tb.search !== false) {
        const w = mk('div', 'at-search'), i = mk('input', null, null, { type: 'search', placeholder: o.searchPlaceholder || 'Search...', 'aria-label': 'Search table' });
        i.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { S.search = i.value; S.page = 1; query(); }, o.serverSide ? CONFIG.searchDebounceMs : 120); });
        w.append(i); tools.append(w);
      }
      o.filters.forEach(f => {
        const s = mk('select', 'at-sel', null, { 'aria-label': f.label }); s.append(new Option(f.label + ': All', ''));
        f.options.forEach(op => s.append(new Option(op.label, op.value)));
        s.addEventListener('change', () => { S.filterValues[f.id] = s.value; S.page = 1; renderChips(); query(); }); tools.append(s);
      });
      if (tb.pageSize) tools.append(pageSizeSelect());
      if (tb.columns !== false) tools.append(tbtn('Columns', compact ? 'columns' : null, e => columnMenu(e.currentTarget), 'btn', { 'data-at-menu': '' }));
      const exp = tb.export || [];
      if (compact) {   // Columns, Import, CSV, Excel, Print (matches the reference design)
        if (tb.import) tools.append(tbtn('Import', 'upload', importDialog));
        exp.forEach(t => tools.append(tbtn(t === 'xls' ? 'Excel' : t.toUpperCase(), 'download', () => exportRows(t))));
        if (tb.print) tools.append(tbtn('Print', 'printer', print));
      } else {
        exp.forEach(t => tools.append(tbtn('Export ' + t.toUpperCase(), null, () => exportRows(t))));
        if (tb.print) tools.append(tbtn('Print', null, print));
        if (tb.import) tools.append(tbtn('Import CSV', null, importDialog));
      }
      if (o.primaryAction) tools.append(tbtn(o.primaryAction.label, o.primaryAction.icon, o.primaryAction.onClick, 'btn btn-primary'));
      bar.append(tools);
    }
    function columnMenu(anchor) {
      const items = cols.map(c => { const l = mk('label'), i = mk('input', null, null, { type: 'checkbox' }); i.checked = !S.hidden.has(c.id); i.disabled = !!c.required;
        i.addEventListener('change', () => { i.checked ? S.hidden.delete(c.id) : S.hidden.add(c.id); renderTable(); }); l.append(i, document.createTextNode(c.header)); return l; });
      openMenu(anchor, items);
    }
    function renderChips() {
      chipsBar.replaceChildren(); const active = o.filters.filter(f => S.filterValues[f.id]);
      chipsBar.hidden = !active.length; if (!active.length) return;
      active.forEach(f => { const c = mk('span', 'at-chip', `${f.label}: ${f.options.find(x => x.value === S.filterValues[f.id])?.label}`), x = mk('button', null, '×', { type: 'button', 'aria-label': `Remove ${f.label} filter` });
        x.addEventListener('click', () => { S.filterValues[f.id] = ''; S.page = 1; renderBar(); renderChips(); query(); }); c.append(x); chipsBar.append(c); });
      const clr = mk('button', 'at-link', 'Clear all', { type: 'button' }); clr.addEventListener('click', () => { S.filterValues = {}; S.page = 1; renderBar(); renderChips(); query(); }); chipsBar.append(clr);
    }

    // ---- header, filter row and body ----
    function renderTable() { renderHead(); renderBody(); }
    const optList = f => (f.options === 'auto' ? [...new Set(S.data.map(r => String(r[f.field] ?? '')))].sort() : f.options || []).map(x => typeof x === 'string' ? { value: x, label: x } : x);
    function filterCell(c) {
      const th = mk('th', c.sticky === 'right' ? 'at-sr' : ''), f = c.filter;
      if (!f) return th;
      const set = v => { S.colSearch[c.id] = v; S.page = 1; clearTimeout(timer); timer = setTimeout(query, CONFIG.filterDebounceMs); };
      if (f.type === 'select') {
        const s = mk('select', 'at-colsearch', null, { 'aria-label': `Filter ${c.header}` }); s.append(new Option(f.allLabel || 'All', ''));
        optList({ ...f, field: c.id }).forEach(x => s.append(new Option(x.label, x.value))); s.value = S.colSearch[c.id] || '';
        s.addEventListener('change', () => { S.colSearch[c.id] = s.value; S.page = 1; query(); }); th.append(s);
      } else if (f.type === 'date') {
        const w = mk('div', 'at-range'), [a = '', b = ''] = (S.colSearch[c.id] || '').split('..');
        const mkd = (v, label) => { const i = mk('input', 'at-colsearch', null, { type: 'date', 'aria-label': `${c.header} ${label}` }); i.value = v; return i; };
        const from = mkd(a, 'from'), to = mkd(b, 'to'), upd = () => set(from.value || to.value ? `${from.value}..${to.value}` : '');
        from.addEventListener('change', upd); to.addEventListener('change', upd); w.append(from, to); th.append(w);
      } else {
        const i = mk('input', 'at-colsearch', null, { type: 'search', placeholder: f.placeholder || (f.type === 'number' ? 'e.g. >100' : compact ? `Search ${c.header}...` : 'Filter'), 'aria-label': `Filter ${c.header}` });
        if (f.type === 'number') i.title = 'Examples: 7, >100, <=20, 10-50';
        i.value = S.colSearch[c.id] || '';
        i.addEventListener('input', () => { i.toggleAttribute('aria-invalid', f.type === 'number' && !!i.value.trim() && !numberTest(i.value.trim())); set(i.value); });
        th.append(i);
      }
      return th;
    }
    function renderHead() {
      table = mk('table', null, null, { 'aria-label': (typeof o.title === 'string' && o.title) || 'Data table' });
      head = mk('thead'); body = mk('tbody'); table.append(head, body); scroll.replaceChildren(table);
      const tr = mk('tr'), dcols = visibleCols();
      if (o.selectable) { const th = mk('th', 'at-sl at-sel-col'), cb = mk('input', null, null, { type: 'checkbox', 'aria-label': 'Select all rows on this page' }); cb.dataset.atAll = ''; th.append(cb); tr.append(th); }
      if (o.expandable) tr.append(mk('th', 'at-sle at-exp-col', '', { 'aria-label': 'Expand' }));
      dcols.forEach(c => {
        const th = mk('th', (c.sticky === 'left' ? 'at-sl2 ' : c.sticky === 'right' ? 'at-sr ' : '') + (S.sort?.id === c.id ? 'at-sorted' : ''), null, { scope: 'col' });
        if (c.width) th.style.width = typeof c.width === 'number' ? c.width + 'px' : c.width; if (S.widths[c.id]) th.style.width = th.style.minWidth = S.widths[c.id] + 'px';
        if (c.align) th.style.textAlign = c.align;
        if (S.sort?.id === c.id) th.setAttribute('aria-sort', S.sort.dir === 'asc' ? 'ascending' : 'descending');
        if (c.sortable !== false) {
          const b = mk('button', 'at-sort', c.header, { type: 'button' }); b.append(mk('span', 'at-si'));
          b.lastChild.append(icon(S.sort?.id === c.id ? (S.sort.dir === 'asc' ? 'up' : 'down') : 'sort', 13));
          if (S.sort?.id === c.id) b.dataset.dir = S.sort.dir;
          b.addEventListener('click', () => { S.sort = S.sort?.id === c.id ? (S.sort.dir === 'asc' ? { id: c.id, dir: 'desc' } : null) : { id: c.id, dir: 'asc' }; S.page = 1; renderHead(); query(); }); th.append(b);
        } else th.append(document.createTextNode(c.header));
        if (o.reorderable) {
          th.draggable = true; th.classList.add('at-drag');
          th.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', c.id));
          th.addEventListener('dragover', e => { e.preventDefault(); th.classList.add('at-over'); }); th.addEventListener('dragleave', () => th.classList.remove('at-over'));
          th.addEventListener('drop', e => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain'); if (from && from !== c.id) { S.order.splice(S.order.indexOf(from), 1); S.order.splice(S.order.indexOf(c.id), 0, from); renderTable(); } });
        }
        if (o.resizable) { const h = mk('div', 'at-rs', null, { role: 'separator', 'aria-orientation': 'vertical' });
          h.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); const x0 = e.clientX, w0 = th.getBoundingClientRect().width; h.setPointerCapture(e.pointerId);
            const mv = ev => { S.widths[c.id] = Math.max(c.minWidth || CONFIG.minColWidth, w0 + ev.clientX - x0); th.style.width = th.style.minWidth = S.widths[c.id] + 'px'; };
            const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); }; h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); });
          h.addEventListener('click', e => e.stopPropagation()); th.append(h); }
        tr.append(th);
      });
      if (o.rowActions.length) tr.append(mk('th', 'at-sr at-act-col', 'Actions'));
      head.append(tr);
      if (dcols.some(c => c.filter)) {   // individual column filters, sticky under the header
        const r2 = mk('tr', 'at-filters');
        if (o.selectable) r2.append(mk('th', 'at-sl')); if (o.expandable) r2.append(mk('th', 'at-sle'));
        dcols.forEach(c => r2.append(filterCell(c))); if (o.rowActions.length) r2.append(mk('th', 'at-sr')); head.append(r2);
      }
      table.style.setProperty('--at-sle', (o.selectable ? 44 : 0) + 'px'); table.style.setProperty('--at-sl2', (o.selectable ? 44 : 0) + (o.expandable ? 44 : 0) + 'px');
      requestAnimationFrame(() => { const h = head.rows[0]?.offsetHeight; if (h) table.style.setProperty('--at-head-h', h + 'px'); });
    }
    function actionCell(r, id) {
      const td = mk('td', 'at-sr at-act-col');
      if (o.rowActionsVariant === 'compact') {
        const w = mk('div', 'at-act at-act-compact');
        o.rowActions.forEach((a, i) => { const b = mk('button', 'at-ib' + (a.danger ? ' at-ib-danger' : ''), null, { type: 'button', 'aria-label': a.label, 'data-tooltip': a.label });
          if (a.icon) b.append(icon(a.icon, 16)); else b.textContent = a.label; b.dataset.atAct = i + ':' + id; w.append(b); });
        td.append(w);
      } else if (o.rowActionsVariant === 'icons') {
        const w = mk('div', 'at-act'); o.rowActions.forEach((a, i) => { const b = mk('button', 'btn' + (a.danger ? ' btn-danger' : ''), a.label, { type: 'button' }); b.dataset.atAct = i + ':' + id; w.append(b); }); td.append(w);
      } else { const b = mk('button', 'at-kebab', '⋯', { type: 'button', 'aria-label': 'Row actions', 'data-tooltip': 'Row actions', 'aria-haspopup': 'menu', 'data-at-menu': '' }); b.dataset.atMenu = id; td.append(b); }
      return td;
    }
    function stateRow(colspan, title, msg, button) {
      const tr = mk('tr', 'at-state-row'), td = mk('td', null, null, { colspan }), d = mk('div', 'at-state');
      d.append(mk('strong', null, title), document.createTextNode(msg || ''));
      if (button) { const b = mk('button', 'btn', button.label, { type: 'button' }); b.style.marginTop = '12px'; b.addEventListener('click', button.onClick); d.append(mk('br'), b); }
      td.append(d); tr.append(td); body.append(tr);
    }
    function renderBody() {
      const dcols = visibleCols(), colspan = dcols.length + (o.selectable ? 1 : 0) + (o.expandable ? 1 : 0) + (o.rowActions.length ? 1 : 0);
      body.replaceChildren(); table.setAttribute('aria-busy', String(S.loading));
      if (S.loading) { for (let i = 0; i < Math.min(S.pageSize, CONFIG.maxSkeletonRows); i++) { const tr = mk('tr', 'at-skel-row'); for (let k = 0; k < colspan; k++) { const td = mk('td'); td.append(mk('div', 'at-skel')); tr.append(td); } body.append(tr); } updateTitle(); return; }
      if (S.error) { stateRow(colspan, 'Something went wrong', S.error, o.onRetry ? { label: 'Retry', onClick: o.onRetry } : null); updateTitle(); return; }
      const v = S.forced === 'empty' ? { rows: [], total: 0 } : view(); S.lastTotal = v.total; updateTitle();
      if (!v.rows.length) {
        if (S.forced === 'empty' || !anyFilter()) stateRow(colspan, 'No records available', ' ' + o.emptyMessage);
        else stateRow(colspan, 'No results', ' No records match your search or filters.', { label: 'Clear filters', onClick: clearFilters });
        renderFoot(v); syncSelectUI(); return;
      }
      v.rows.forEach(r => {
        const id = idOf(r), tr = mk('tr'); tr.dataset.id = id; if (S.selected.has(id)) tr.setAttribute('aria-selected', 'true');
        if (o.selectable) { const td = mk('td', 'at-sl'), cb = mk('input', null, null, { type: 'checkbox', 'aria-label': 'Select row' }); cb.checked = S.selected.has(id); cb.dataset.atRow = id; td.append(cb); tr.append(td); }
        if (o.expandable) { const open = S.expanded.has(id), td = mk('td', 'at-sle'), b = mk('button', 'at-ib', null, { type: 'button', 'aria-expanded': String(open), 'aria-label': open ? 'Collapse row' : 'Expand row', 'data-tooltip': open ? 'Collapse row' : 'Expand row' }); b.append(icon(open ? 'up' : 'down', 15)); b.dataset.atExp = id; td.append(b); tr.append(td); }
        dcols.forEach((c, k) => { const td = mk('td', (c.sticky === 'left' ? 'at-sl2 ' : c.sticky === 'right' ? 'at-sr ' : '') + (k === 0 ? 'at-pc' : '')); if (c.align) td.style.textAlign = c.align; const val = value(c, r), out = c.render ? c.render(r, val) : val;
          if (out instanceof Node) td.append(out); else td.textContent = out == null ? '' : out; tr.append(td); });
        if (o.rowActions.length) tr.append(actionCell(r, id));
        body.append(tr);
        if (o.expandable && S.expanded.has(id)) { const e = mk('tr', 'at-exp', null, { 'data-detail-for': id }), td = mk('td', null, null, { colspan }), d = mk('div'); const c = o.expandable(r); c instanceof Node ? d.append(c) : d.textContent = c; td.append(d); e.append(td); body.append(e); }
      });
      syncSelectUI(); renderFoot(v);
    }
    function renderFoot(v) {
      foot.replaceChildren(); const pages = Math.max(1, Math.ceil(v.total / S.pageSize));
      const from = v.total ? (S.page - 1) * S.pageSize + 1 : 0, to = Math.min(S.page * S.pageSize, v.total), info = `Showing ${from}–${to} of ${v.total}`;
      foot.append(mk('span', 'at-info', info)); live.textContent = info;
      if (!tb.pageSize) foot.append(pageSizeSelect());
      const nav = mk('nav', 'at-pg' + (compact ? ' at-icons' : ''), null, { 'aria-label': 'Pagination' }), go = p => { S.page = p; query(); };
      const btn = (label, p, dis, cur, aria) => { const b = mk('button', null, typeof label === 'string' || typeof label === 'number' ? label : null, { type: 'button' }); if (label instanceof Node) b.append(label); if (aria) b.setAttribute('aria-label', aria); b.disabled = dis; if (cur) b.setAttribute('aria-current', 'page'); b.addEventListener('click', () => go(p)); return b; };
      nav.append(compact ? btn(icon('left', 15), S.page - 1, S.page <= 1, false, 'Previous page') : btn('Prev', S.page - 1, S.page <= 1));
      const set = new Set([1, pages, S.page - 1, S.page, S.page + 1].filter(p => p >= 1 && p <= pages)); let prev = 0;
      [...set].sort((a, b) => a - b).forEach(p => { if (p - prev > 1) nav.append(mk('span', 'at-gap', '…')); nav.append(btn(p, p, false, p === S.page, `Page ${p}`)); prev = p; });
      nav.append(compact ? btn(icon('right', 15), S.page + 1, S.page >= pages, false, 'Next page') : btn('Next', S.page + 1, S.page >= pages)); foot.append(nav);
    }

    // ---- selection / bulk actions ----
    const selectedRows = () => S.data.filter(r => S.selected.has(idOf(r)));
    function syncSelectUI() {
      const rows = S.forced === 'empty' ? [] : view().rows, ids = rows.map(idOf), n = ids.filter(i => S.selected.has(i)).length, all = head?.querySelector('[data-at-all]');
      if (all) { all.checked = rows.length > 0 && n === rows.length; all.indeterminate = n > 0 && n < rows.length; }
      const count = S.selected.size;
      bulk.hidden = !count; bar.hidden = bulkReplace && count > 0; root.classList.toggle('at-has-sel', count > 0);
      bulk.replaceChildren(); if (!count) return;
      bulk.append(mk('strong', 'at-bsel', `${count} selected`), mk('span', 'at-spacer'));
      o.bulkActions.forEach(a => { const b = mk('button', 'btn' + (a.danger ? ' btn-danger' : ''), null, { type: 'button' }); if (a.icon) b.append(icon(a.icon, 15)); b.append(document.createTextNode(a.label)); b.addEventListener('click', () => a.onClick(selectedRows(), api)); bulk.append(b); });
      if (bulkClear) { const c = mk('button', 'at-link', 'Clear selection', { type: 'button' }); c.addEventListener('click', clearSelection); bulk.append(c); }
    }
    function clearSelection() { S.selected.clear(); renderBody(); o.onSelectionChange?.([]); }
    function clearFilters() { S.search = ''; S.colSearch = {}; S.filterValues = {}; S.page = 1; renderBar(); renderChips(); renderHead(); query(); }
    scroll.addEventListener('change', e => {
      if (e.target.matches('[data-at-all]')) view().rows.forEach(r => e.target.checked ? S.selected.add(idOf(r)) : S.selected.delete(idOf(r)));
      else if (e.target.matches('[data-at-row]')) e.target.checked ? S.selected.add(e.target.dataset.atRow) : S.selected.delete(e.target.dataset.atRow);
      else return;
      renderBody(); o.onSelectionChange?.(selectedRows());
    });
    scroll.addEventListener('click', e => {
      const exp = e.target.closest('[data-at-exp]'); if (exp) { const id = exp.dataset.atExp; S.expanded.has(id) ? S.expanded.delete(id) : S.expanded.add(id); renderBody(); return; }
      const act = e.target.closest('[data-at-act]'); if (act) { e.stopPropagation(); const [i, id] = act.dataset.atAct.split(/:(.*)/); o.rowActions[+i].onClick(S.data.find(r => idOf(r) === id), api); return; }
      const m = e.target.closest('[data-at-menu]'); if (m && m.dataset.atMenu) { e.stopPropagation(); const row = S.data.find(r => idOf(r) === m.dataset.atMenu);
        openMenu(m, o.rowActions.map(a => { const b = mk('button', a.danger ? 'at-danger' : '', a.label, { type: 'button', role: 'menuitem' }); b.addEventListener('click', () => { closeMenu(); a.onClick(row, api); }); return b; })); }
    });

    // ---- export / print / import (all operate on the filtered rows, or the selection when there is one) ----
    function rowsForExport() { const rows = S.selected.size ? selectedRows() : allFiltered(), dcols = visibleCols(); return { cols: dcols, rows: rows.map(r => dcols.map(c => textOf(c.exportValue ? c.exportValue(r) : value(c, r)))) }; }
    function exportRows(type) {
      const { cols: ec, rows } = rowsForExport(), name = (o.exportName || 'table-export');
      if (type === 'csv') download(name + '.csv', 'text/csv;charset=utf-8', [ec.map(c => c.header), ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n'));
      else download(name + '.xls', 'application/vnd.ms-excel', `<table><tr>${ec.map(c => `<th>${esc(c.header)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`);
    }
    function print() {
      const { cols: ec, rows } = rowsForExport(), w = window.open('', '_blank'); if (!w) return;
      w.document.write(`<title>${esc(titleText() || 'Table')}</title><style>body{font:14px system-ui}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}</style><h2>${esc(titleText())}</h2><table><tr>${ec.map(c => `<th>${esc(c.header)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`);
      w.document.close(); w.focus(); w.print();
    }
    function importDialog() {
      if (!window.AppModal) return;
      const cfg = tb.import, mbody = mk('div'), file = mk('input', 'at-colsearch', null, { type: 'file', accept: '.csv,text/csv', 'aria-label': 'CSV file' }), out = mk('div'); out.style.marginTop = '12px';
      mbody.append(mk('p', 'muted', `Expected columns: ${cfg.expectedHeaders.join(', ')}`), file, out); let valid = [];
      AppModal.open({ title: 'Import CSV', description: 'Rows are validated before importing.', body: mbody, footer: [{ label: 'Cancel', closes: true }, { label: 'Import valid rows', variant: 'primary', onClick: () => { if (!valid.length) return false; cfg.onImport(valid, api); } }] });
      file.addEventListener('change', async () => {
        const rows = parseCsv(await file.files[0].text()), hdr = (rows.shift() || []).map(h => h.trim()); out.replaceChildren();
        const missing = cfg.expectedHeaders.filter(h => !hdr.includes(h)); if (missing.length) { out.textContent = `Missing columns: ${missing.join(', ')}`; valid = []; return; }
        const errs = []; valid = [];
        rows.forEach((r, i) => { const rec = Object.fromEntries(hdr.map((h, k) => [h, (r[k] || '').trim()])), e = cfg.validateRow?.(rec, i + 2); e ? errs.push(`Row ${i + 2}: ${e}`) : valid.push(rec); });
        out.append(mk('p', null, `${valid.length} valid, ${errs.length} invalid`)); errs.slice(0, 5).forEach(e => out.append(mk('div', 'muted', e)));
      });
    }

    // ---- public instance ----
    const api = {
      setData(rows, total) {
        S.data = rows; if (total != null) S.total = total; S.loading = false; S.error = null;
        if (!o.serverSide) { const ids = new Set(rows.map(idOf)); S.selected = new Set([...S.selected].filter(i => ids.has(i))); S.expanded = new Set([...S.expanded].filter(i => ids.has(i))); }
        renderBody();
      },
      setState(name, message) {   // 'normal' | 'loading' | 'error' | 'empty' (data is kept, so 'normal' restores it)
        S.loading = name === 'loading'; S.error = name === 'error' ? (message || 'Something went wrong.') : null; S.forced = name === 'empty' ? 'empty' : null; renderBody();
      },
      setLoading(b) { S.loading = !!b; renderBody(); }, setError(m) { S.error = m; S.loading = false; renderBody(); },
      getSelected: selectedRows, clearSelection, clearFilters, getState: () => ({ ...queryState(), hidden: [...S.hidden], order: [...S.order], selected: [...S.selected], total: totalRecords() }),
      refresh: renderTable, reload: query, destroy() { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); removeEventListener('scroll', closeMenu, true); closeMenu(); host.replaceChildren(); }
    };
    renderBar(); renderChips(); renderTable();
    if (o.serverSide && !o.data) queueMicrotask(query);   // after create() returns, so onQuery can use the instance
    return api;
  }
  window.AppTable = { create, badge, details, icon, parseCsv };
})();
