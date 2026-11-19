/* Table page + Users page: ALL sample data, example configurations, simulated server and demo actions live here.
   The reusable engine is table.js (no demo data, no backend knowledge). Everything below is fake demo data. */
(() => {
  if (!window.AppTable) return;
  const T = AppTable, $ = id => document.getElementById(id);
  const pick = (arr, i) => arr[i % arr.length];
  const clone = id => $(id)?.content.cloneNode(true);

  // ======================= SAMPLE DATASETS =======================
  const ROLES = ['Admin', 'Manager', 'Editor', 'Viewer'], STATUSES = ['active', 'inactive', 'pending'];
  const TONE = { active: 'ok', inactive: 'neutral', pending: 'warn', Paid: 'ok', Pending: 'warn', Refunded: 'bad', Delivered: 'ok', Shipped: 'info', Processing: 'info', Returned: 'bad', 'In stock': 'ok', 'Low stock': 'warn', 'Out of stock': 'bad' };
  const SEED = [['Nina', 'Rossi', 'Manager', 'inactive', 140, '2023-09-16'], ['Ava', 'Novak', 'Manager', 'inactive', 80, '2023-09-25'], ['Theo', 'Rossi', 'Admin', 'active', 163, '2023-10-04'], ['Omar', 'Kim', 'Editor', 'inactive', 10, '2023-07-20'],
    ['Omar', 'Novak', 'Admin', 'inactive', 118, '2023-03-23'], ['Mia', 'Kim', 'Manager', 'active', 7, '2023-12-04'], ['Kai', 'Haddad', 'Editor', 'pending', 18, '2023-01-11'], ['Diego', 'Rossi', 'Editor', 'pending', 38, '2023-12-16'],
    ['Leo', 'Silva', 'Viewer', 'inactive', 142, '2023-10-26'], ['Omar', 'Okafor', 'Editor', 'pending', 143, '2023-03-13'], ['Ava', 'Nguyen', 'Editor', 'pending', 68, '2023-12-01']];
  const FIRST = ['Priya', 'Lucas', 'Ana', 'Ravi', 'Sara', 'Noah', 'Mei', 'Hana', 'Zoe', 'Liam', 'Sam', 'Iris'], LAST = ['Sharma', 'Haddad', 'Tanaka', 'Patel', 'Torres', 'Brown', 'Chen', 'Silva', 'Okafor', 'Nguyen'];
  const emails = new Set();
  const mkUser = (id, f, l, role, status, orders, joined) => { let e = `${f}.${l}`.toLowerCase(), n = 1, em = `${e}@example.com`; while (emails.has(em)) em = `${e}${++n}@example.com`; emails.add(em); return { id, name: `${f} ${l}`, email: em, role, status, orders, joined }; };
  const users = SEED.map((s, i) => mkUser(i + 1, ...s)).concat(Array.from({ length: 76 }, (_, i) => { const n = i + 12; return mkUser(n, pick(FIRST, n * 5), pick(LAST, n * 7), pick(ROLES, n * 3), pick(STATUSES, n * 5 + (n % 3)), (n * 37) % 190, new Date(Date.UTC(2023, 0, 1 + (n * 17) % 360)).toISOString().slice(0, 10)); }));   // 87 users in total
  const CATS = ['Lighting', 'Furniture', 'Stationery', 'Audio'];
  const products = Array.from({ length: 28 }, (_, i) => { const stock = (i * 13) % 60; return { id: i + 1, sku: `SKU-${1000 + i}`, name: `${pick(['Aria', 'Nova', 'Orbit', 'Pixel', 'Terra', 'Zen'], i)} ${pick(['Desk Lamp', 'Chair', 'Notebook', 'Speaker', 'Shelf', 'Mug'], i * 5)}`, category: pick(CATS, i * 3), price: +(9 + (i * 17) % 190 + .99).toFixed(2), stock, status: stock === 0 ? 'Out of stock' : stock < 10 ? 'Low stock' : 'In stock' }; });
  const day = i => new Date(Date.UTC(2026, 0, 3 + i * 5)).toISOString().slice(0, 10);
  const orders = Array.from({ length: 40 }, (_, i) => ({ id: `#${10400 + i}`, customer: `${pick(['Priya', 'Noah', 'Hana', 'Omar', 'Zoe', 'Liam', 'Mei'], i)} ${pick(LAST, i * 7)}`, date: day(i + 20), amount: +(20 + (i * 37) % 480 + .5).toFixed(2), payment: pick(['Paid', 'Paid', 'Pending', 'Refunded'], i), status: pick(['Delivered', 'Shipped', 'Processing', 'Returned'], i * 3) }));
  const roles = [['Admin', 3, ['users.manage', 'roles.manage', 'orders.manage', 'products.manage', 'settings.manage']], ['Editor', 6, ['products.manage', 'content.edit']], ['Support', 8, ['orders.view', 'orders.update', 'users.view']], ['Viewer', 12, ['orders.view', 'products.view']],
    ['Auditor', 2, ['logs.view', 'reports.view']], ['Manager', 5, ['users.view', 'orders.manage', 'products.manage', 'reports.view']], ['Developer', 4, ['logs.view', 'settings.view', 'api.manage', 'users.view']], ['Guest', 21, ['products.view']]]
    .map(([name, count, permissions], i) => ({ id: i + 1, name, users: count, permissions, updated: `2026-06-${String(1 + i * 3).padStart(2, '0')}` }));

  // ======================= SHARED DEMO HELPERS =======================
  const badge = v => T.badge(v, TONE[v] || 'info'), money = v => '$' + Number(v).toFixed(2), opts = a => a.map(v => ({ value: v, label: v }));
  const confirm = (title, text, button = 'Delete') => AppAlert.fire({ icon: 'warning', title, text, showCancelButton: true, confirmButtonText: button });
  const form = (tplId, values) => { const f = clone(tplId); Object.entries(values || {}).forEach(([k, v]) => { const el = f.querySelector(`[name="${k}"]`); if (el) el.value = v; }); return f; };
  const asModal = (title, tplId, formId, button, values, size = 'md') => AppModal.open({ title, size, body: form(tplId, values), footer: [{ label: 'Cancel' }, { label: button, variant: 'primary', closes: false, onClick: () => $(formId).requestSubmit() }] });
  const pending = {};   // callbacks waiting for a modal form to be submitted: { formId: values => void }
  document.addEventListener('appform:valid', e => { const cb = pending[e.target.id]; if (cb) { cb(e.detail.values); delete pending[e.target.id]; AppModal.closeAll(); } });
  const modalForm = (title, tplId, formId, button, values, done) => { pending[formId] = done; const m = asModal(title, tplId, formId, button, values); m.closed.then(() => { delete pending[formId]; }); };
  const details = r => AppDrawer.open({ side: 'right', title: r.name, body: T.details([{ value: r.email, label: 'email' }, { value: r.role, label: 'role' }, { value: r.status, label: 'status' }, { value: r.orders, label: 'lifetime orders' }, { value: r.joined, label: 'joined' }]), footer: [{ label: 'Close' }] });
  const refresh = (t, list) => t.setData(list);

  // ======================= CONFIGURATIONS (same engine, different options) =======================
  const usersConfig = (extra = {}) => ({
    variant: 'compact', title: 'Users', showCount: true, data: users, getRowId: r => r.id, selectable: true, maxHeight: '520px', exportName: 'users',
    columns: [
      { id: 'name', header: 'Name', filter: { type: 'text', placeholder: 'Search Name...' } },
      { id: 'email', header: 'Email', filter: { type: 'text', placeholder: 'Search Email...' } },
      { id: 'role', header: 'Role', filter: { type: 'text', placeholder: 'Search Role...' } },
      { id: 'status', header: 'Status', filter: { type: 'select', options: STATUSES, allLabel: 'All' }, render: (r, v) => badge(v) },
      { id: 'orders', header: 'Orders', type: 'number', filter: { type: 'number' } },
      { id: 'joined', header: 'Joined', type: 'date', filter: { type: 'date' } }
    ],
    expandable: r => T.details([{ value: r.orders, label: 'lifetime orders' }, { value: r.joined, label: 'joined' }, { value: r.role, label: 'role' }, { value: r.email, label: 'email' }]),
    rowActionsVariant: 'compact',
    rowActions: [{ label: 'View', icon: 'eye', onClick: r => details(r) },
      { label: 'Edit', icon: 'pencil', onClick: (r, t) => modalForm('Edit user', 'tpl-tb-edit', 'tb-edit-form', 'Save changes', r, v => { Object.assign(r, v); refresh(t, users); toast.success(`${r.name} updated (demo).`); }) },
      { label: 'Delete', icon: 'trash', danger: true, onClick: async (r, t) => { const a = await confirm(`Delete ${r.name}?`, 'This user will be permanently removed.'); if (a.isConfirmed) { users.splice(users.indexOf(r), 1); refresh(t, users); toast.success('User deleted (demo).'); } } }],
    bulkActions: [
      { label: 'Delete', icon: 'trash', danger: true, onClick: async (rows, t) => { const a = await confirm(`Delete ${rows.length} user${rows.length > 1 ? 's' : ''}?`, 'The selected users will be permanently removed.'); if (a.isConfirmed) { rows.forEach(x => users.splice(users.indexOf(x), 1)); refresh(t, users); toast.success(`${rows.length} user(s) deleted (demo).`); } } },
      { label: 'Assign role', icon: 'users', onClick: (rows, t) => modalForm(`Assign role to ${rows.length} user${rows.length > 1 ? 's' : ''}`, 'tpl-tb-role', 'tb-role-form', 'Assign role', null, v => { rows.forEach(r => { r.role = v.role; }); t.clearSelection(); refresh(t, users); toast.success(`Role "${v.role}" assigned to ${rows.length} user(s) (demo).`); }) }],
    toolbar: { export: ['csv', 'xls'], print: true, import: { expectedHeaders: ['name', 'email', 'role'], validateRow: r => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) ? 'invalid email' : !ROLES.includes(r.role) ? 'unknown role' : '',
      onImport: (rows, t) => { rows.forEach(r => users.push(mkUser(Math.max(...users.map(u => u.id)) + 1, ...r.name.split(' '), r.role, 'pending', 0, new Date().toISOString().slice(0, 10)))); refresh(t, users); toast.success(`${rows.length} user(s) imported (demo, nothing is saved).`); } } },
    ...extra
  });
  const productsConfig = () => ({
    variant: 'compact', title: 'Products', showCount: true, data: products, selectable: true, defaultPageSize: 10, maxHeight: '520px', exportName: 'products', rowActionsVariant: 'compact',
    columns: [{ id: 'sku', header: 'SKU', filter: 'text' }, { id: 'name', header: 'Product', filter: 'text' }, { id: 'category', header: 'Category', filter: { type: 'select', options: CATS, allLabel: 'All' } },
      { id: 'price', header: 'Price', type: 'number', align: 'right', filter: { type: 'number' }, render: (r, v) => money(v), exportValue: r => r.price },
      { id: 'stock', header: 'Stock', type: 'number', align: 'right', filter: { type: 'number' }, render: (r, v) => { const w = document.createElement('span'); const d = document.createElement('span'); d.className = 'at-dot ' + (v === 0 ? 'bad' : v < 10 ? 'warn' : 'ok'); w.append(d, String(v)); return w; }, exportValue: r => r.stock },
      { id: 'status', header: 'Status', filter: { type: 'select', options: ['In stock', 'Low stock', 'Out of stock'], allLabel: 'All' }, render: (r, v) => badge(v) }],
    rowActions: [{ label: 'Edit', icon: 'pencil', onClick: r => toast.info(`Edit ${r.name} (demo)`) },
      { label: 'Delete', icon: 'trash', danger: true, onClick: async (r, t) => { const a = await confirm(`Delete ${r.name}?`, 'This product will be removed.'); if (a.isConfirmed) { products.splice(products.indexOf(r), 1); refresh(t, products); toast.success('Product deleted (demo).'); } } }],
    bulkActions: [{ label: 'Delete', icon: 'trash', danger: true, onClick: async (rows, t) => { const a = await confirm(`Delete ${rows.length} product(s)?`, 'This cannot be undone.'); if (a.isConfirmed) { rows.forEach(x => products.splice(products.indexOf(x), 1)); refresh(t, products); toast.success('Products deleted (demo).'); } } },
      { label: 'Change category', onClick: (rows, t) => modalForm('Change category', 'tpl-tb-category', 'tb-cat-form', 'Apply', null, v => { rows.forEach(r => { r.category = v.category; }); t.clearSelection(); refresh(t, products); toast.success(`Category set to ${v.category} (demo).`); }) }],
    toolbar: { search: true, export: ['csv', 'xls'], print: true }
  });
  const ordersConfig = () => ({
    variant: 'compact', title: 'Orders', showCount: true, data: orders, getRowId: r => r.id, selectable: true, defaultPageSize: 10, maxHeight: '520px', exportName: 'orders', rowActionsVariant: 'compact',
    columns: [{ id: 'id', header: 'Order', required: true, filter: 'text' }, { id: 'customer', header: 'Customer', filter: 'text' }, { id: 'date', header: 'Date', type: 'date', filter: { type: 'date' } },
      { id: 'amount', header: 'Amount', type: 'number', align: 'right', filter: { type: 'number' }, render: (r, v) => money(v), exportValue: r => r.amount },
      { id: 'payment', header: 'Payment', filter: { type: 'select', options: ['Paid', 'Pending', 'Refunded'], allLabel: 'All' }, render: (r, v) => badge(v) },
      { id: 'status', header: 'Status', filter: { type: 'select', options: ['Delivered', 'Shipped', 'Processing', 'Returned'], allLabel: 'All' }, render: (r, v) => badge(v) }],
    rowActions: [{ label: 'View order', icon: 'eye', onClick: r => toast.info(`View order ${r.id} (demo)`) }, { label: 'Mark shipped', icon: 'check', onClick: (r, t) => { r.status = 'Shipped'; refresh(t, orders); toast.success(`${r.id} marked as shipped (demo).`); } }],
    bulkActions: [{ label: 'Mark shipped', icon: 'check', onClick: (rows, t) => { rows.forEach(r => { r.status = 'Shipped'; }); t.clearSelection(); refresh(t, orders); toast.success(`${rows.length} order(s) marked as shipped (demo).`); } }],
    toolbar: { search: true, export: ['csv', 'xls'], print: true }
  });
  const rolesConfig = () => ({
    variant: 'compact', title: 'Roles and permissions', showCount: true, data: roles, defaultPageSize: 5, pageSizes: [5, 10, 25], rowActionsVariant: 'compact', exportName: 'roles',
    columns: [{ id: 'name', header: 'Role', required: true, filter: 'text' }, { id: 'users', header: 'Users', type: 'number', align: 'right', filter: { type: 'number' } },
      { id: 'permissions', header: 'Permissions', sortable: false, filter: 'text', accessor: r => r.permissions.join(', '),   // long lists collapse into "+N" so the column never overcrowds
        render: r => { const w = document.createElement('span'); r.permissions.slice(0, 3).forEach(p => { const b = T.badge(p, 'info'); b.style.marginRight = '4px'; w.append(b); });
          if (r.permissions.length > 3) { const m = T.badge(`+${r.permissions.length - 3}`, 'neutral'); m.className += ' at-more'; m.dataset.tooltip = r.permissions.slice(3).join(', '); w.append(m); } return w; } },
      { id: 'updated', header: 'Updated', type: 'date', filter: { type: 'date' } }],
    rowActions: [{ label: 'Edit permissions', icon: 'pencil', onClick: r => toast.info(`Edit permissions for ${r.name} (demo)`) },
      { label: 'Delete role', icon: 'trash', danger: true, onClick: async (r, t) => { const a = await confirm(`Delete role ${r.name}?`, `${r.users} user(s) will lose it.`); if (a.isConfirmed) { roles.splice(roles.indexOf(r), 1); refresh(t, roles); toast.success('Role deleted (demo).'); } } }],
    toolbar: { search: true, export: ['csv'] }
  });

  // ======================= SIMULATED SERVER (demo only: stands in for your Laravel endpoint) =======================
  const fakeServer = {
    latencyMs: 450,
    query(q) {   // q = AppTable query: { page, pageSize, search, columnSearch, sortField, sortDirection, ... } -> { data, total }
      return new Promise(res => setTimeout(() => {
        let rows = users.filter(u => (!q.search || (u.name + u.email).toLowerCase().includes(q.search.toLowerCase())) &&
          Object.entries(q.columnSearch).every(([k, v]) => k === 'role' || k === 'status' ? u[k] === v : String(u[k]).toLowerCase().includes(String(v).toLowerCase())));
        if (q.sortField) rows.sort((a, b) => (q.sortDirection === 'asc' ? 1 : -1) * String(a[q.sortField]).localeCompare(String(b[q.sortField]), undefined, { numeric: true }));
        res({ data: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length });
      }, fakeServer.latencyMs));
    }
  };
  const serverConfig = () => {
    let t; return { cfg: () => ({
      variant: 'compact', title: 'Server-side users (simulated)', showCount: true, serverSide: true, totalRows: 0, defaultPageSize: 10, pageSizes: [5, 10, 25], toolbar: { search: true, columns: false },
      columns: [{ id: 'name', header: 'Name', filter: 'text' }, { id: 'email', header: 'Email', filter: 'text' }, { id: 'role', header: 'Role', filter: { type: 'select', options: ROLES, allLabel: 'All' } }, { id: 'status', header: 'Status', filter: { type: 'select', options: STATUSES, allLabel: 'All' }, render: (r, v) => badge(v) }],
      onRetry: () => { t.setState('normal'); t.reload(); },
      onQuery: q => {   // <- the reusable contract: swap fakeServer.query for your fetch / Laravel endpoint
        t.setLoading(true); $('tb-server-log').textContent = JSON.stringify({ page: q.page, pageSize: q.pageSize, search: q.search, columnSearch: q.columnSearch, sortField: q.sortField, sortDirection: q.sortDirection });
        fakeServer.query(q).then(r => t.setData(r.data, r.total));
      } }), bind: x => { t = x; } };
  };

  // Users page (replaces the old placeholder filter table)
  if ($('users-table')) T.create($('users-table'), usersConfig({ maxHeight: '560px' }));
  if (!$('tb-users')) return;

  // ======================= PREVIEW PAGE =======================
  const instances = {}, stateOf = {}, KEYS = ['users', 'products', 'orders', 'roles', 'server'];
  let active = 'users';
  instances.users = T.create($('tb-users'), usersConfig({ onRetry: () => setState('normal') }));
  instances.products = T.create($('tb-products'), { ...productsConfig(), onRetry: () => setState('normal') });
  instances.orders = T.create($('tb-orders'), { ...ordersConfig(), onRetry: () => setState('normal') });
  instances.roles = T.create($('tb-roles'), { ...rolesConfig(), onRetry: () => setState('normal') });
  const srv = serverConfig(); instances.server = T.create($('tb-server'), srv.cfg()); srv.bind(instances.server);

  function setState(name, key = active) {
    stateOf[key] = name; instances[key].setState(name);
    if (key === active) document.querySelectorAll('#tb-states [data-state]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.state === name)));
    if (name === 'normal' && key === 'server') instances.server.refresh();
  }
  $('tb-states')?.addEventListener('click', e => { const b = e.target.closest('[data-state]'); if (b) setState(b.dataset.state); });
  document.addEventListener('click', e => {   // follow the active tab and keep the state buttons in sync with it
    const tab = e.target.closest('.cx-tabs [role=tab][data-tab^="tb-"]'); if (!tab) return;
    active = tab.id.replace('tab-', ''); if (!KEYS.includes(active)) return;
    const cur = stateOf[active] || 'normal'; document.querySelectorAll('#tb-states [data-state]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.state === cur)));
  });
  const themeBtn = $('tb-theme'), syncTheme = () => { if (themeBtn) themeBtn.querySelector('span').textContent = document.documentElement.classList.contains('dark') ? 'dark' : 'light'; };
  themeBtn?.addEventListener('click', () => AdminPrefs.set('theme', document.documentElement.classList.contains('dark') ? 'light' : 'dark'));
  document.addEventListener('prefs:change', syncTheme); syncTheme();
  $('tb-add-user')?.addEventListener('click', () => modalForm('Add user', 'tpl-tb-user', 'tb-user-form', 'Create', null, v => { users.unshift(mkUser(Math.max(...users.map(u => u.id)) + 1, ...v.name.split(' '), v.role, 'pending', 0, new Date().toISOString().slice(0, 10))); instances.users.setData(users); toast.success(`User ${v.name} created (demo, nothing is saved).`); }));
  setState('normal');
})();
