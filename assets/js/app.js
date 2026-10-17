(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const CONFIG_KEY = 'mrall_personal_supabase_config_v1';
  let sb = null, user = null;
  let accounts = [], tx = [], goals = [], budgets = [], debts = [];
  let savingMoves = [], debtPayments = [], bills = [], billPayments = [];

  const rp = value => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const localDate = date => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const normalizeText = value => String(value ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

  const CATEGORY_GROUPS = [
    { key: 'makan', label: 'Makan', aliases: ['makan', 'makanan', 'makan minum', 'makan and minum', 'makanan and minuman', 'food'] },
    { key: 'transportasi', label: 'Transportasi/bensin', aliases: ['transportasi', 'transportasi bensin', 'bensin', 'transport', 'ojek', 'gojek', 'grab', 'parkir'] },
    { key: 'tagihan', label: 'Tagihan rutin', aliases: ['tagihan', 'tagihan rutin', 'listrik', 'internet', 'wifi', 'pulsa', 'air', 'pln', 'kos', 'sewa'] },
    { key: 'utang', label: 'Utang/cicilan', aliases: ['utang', 'hutang', 'cicilan', 'utang cicilan', 'hutang cicilan', 'pembayaran utang'] },
    { key: 'belanja', label: 'Belanja pribadi', aliases: ['belanja', 'belanja pribadi', 'shopping', 'keperluan pribadi'] },
    { key: 'tabungan', label: 'Tabungan', aliases: ['tabungan', 'menabung', 'saving'] },
    { key: 'bisnis', label: 'Gaji/WD dari bisnis', aliases: ['gaji wd dari bisnis', 'wd bisnis', 'gaji bisnis', 'owner draw'] },
    { key: 'piutang', label: 'Pengembalian piutang', aliases: ['pengembalian piutang', 'piutang kembali'] },
    { key: 'income_other', label: 'Pendapatan lain', aliases: ['pendapatan lain', 'pemasukan lain', 'income other'] },
    { key: 'lainnya', label: 'Lainnya', aliases: ['lainnya', 'other', 'lain lain'] }
  ];
  const CATEGORY_ALIAS_TO_GROUP = new Map();
  for (const group of CATEGORY_GROUPS) for (const alias of [group.label, ...group.aliases]) CATEGORY_ALIAS_TO_GROUP.set(normalizeText(alias), group);
  const EXPENSE_CATEGORIES = ['Makan', 'Transportasi/bensin', 'Tagihan rutin', 'Utang/cicilan', 'Belanja pribadi', 'Tabungan', 'Lainnya'];
  const INCOME_CATEGORIES = ['Gaji/WD dari bisnis', 'Pengembalian piutang', 'Pendapatan lain', 'Lainnya'];
  const canonicalCategory = value => CATEGORY_ALIAS_TO_GROUP.get(normalizeText(value))?.label || String(value ?? '').trim();
  const categoryKey = value => CATEGORY_ALIAS_TO_GROUP.get(normalizeText(value))?.key || normalizeText(value);
  const addUp = values => values.reduce((sum, value) => sum + (Number(value) || 0), 0);

  function msg(message, error = false) {
    for (const id of ['msg', 'appStatus']) {
      const element = $(id);
      if (element) {
        element.textContent = message;
        element.classList.toggle('error', error);
        element.classList.remove('hidden');
      }
    }
  }
  function configFromForm() {
    return { url: $('url').value.trim().replace(/\/+$/, ''), key: $('key').value.trim() };
  }
  function validConfig(config) {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url) &&
      /^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._-]+)$/.test(config.key);
  }
  function saveConfig() {
    const config = configFromForm();
    if (!validConfig(config)) { msg('Project URL atau publishable/anon key belum benar.', true); return false; }
    if (!window.supabase?.createClient) { msg('Library Supabase belum selesai dimuat. Refresh halaman lalu coba lagi.', true); return false; }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    sb = window.supabase.createClient(config.url, config.key);
    msg('Konfigurasi tersimpan aman di browser ini.');
    return true;
  }
  function loadConfig() {
    try {
      const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
      if (config) {
        $('url').value = config.url || '';
        $('key').value = config.key || '';
        if (validConfig(config) && window.supabase?.createClient) sb = window.supabase.createClient(config.url, config.key);
      }
    } catch (error) { console.error('Konfigurasi tidak bisa dibaca:', error); }
  }
  function showApp() {
    $('state').textContent = 'Login aktif';
    $('logout').classList.remove('hidden');
    $('loginPanel').classList.add('hidden');
    document.querySelector('.intro-hero')?.classList.add('hidden');
    $('app').classList.remove('hidden');
  }
  async function login() {
    if (!sb && !saveConfig()) return;
    const email = $('email').value.trim().toLowerCase();
    const password = $('password').value;
    if (!email || !password) { msg('Isi email dan password.', true); return; }
    try {
      const result = await sb.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      user = result.data.user;
      showApp();
      await loadData();
      $('app').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { msg(`Login gagal: ${error.message}`, true); }
  }
  async function logout() {
    try { if (sb) await sb.auth.signOut(); } catch (error) { console.error(error); }
    user = null;
    accounts = []; tx = []; goals = []; budgets = []; debts = []; savingMoves = []; debtPayments = []; bills = []; billPayments = [];
    $('app').classList.add('hidden');
    $('loginPanel').classList.remove('hidden');
    document.querySelector('.intro-hero')?.classList.remove('hidden');
    $('logout').classList.add('hidden');
    $('state').textContent = 'Belum login';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    msg('Sudah keluar.');
  }

  async function fetchAllRows(table, buildQuery) {
    const allRows = [];
    const pageSize = 1000; // Supabase projects commonly cap one REST response to 1,000 rows.
    for (let from = 0; ; from += pageSize) {
      const query = buildQuery(sb.from(table).select('*'));
      const result = await query.range(from, from + pageSize - 1);
      if (result.error) throw new Error(`${table}: ${result.error.message}`);
      const page = result.data || [];
      allRows.push(...page);
      if (page.length < pageSize) break;
    }
    return allRows;
  }
  async function loadData() {
    if (!sb || !user) { msg('Login terlebih dahulu.', true); return; }
    try {
      const results = await Promise.all([
        fetchAllRows('personal_accounts', q => q.order('created_at').order('id')),
        fetchAllRows('personal_transactions', q => q.order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false })),
        fetchAllRows('personal_savings_goals', q => q.order('created_at', { ascending: false }).order('id', { ascending: false })),
        fetchAllRows('personal_budgets', q => q.order('category').order('id')),
        fetchAllRows('personal_debts', q => q.order('created_at', { ascending: false }).order('id', { ascending: false })),
        fetchAllRows('personal_savings_movements', q => q.order('movement_date', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false })),
        fetchAllRows('personal_debt_payments', q => q.order('payment_date', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false })),
        fetchAllRows('personal_bills', q => q.order('due_date').order('id')),
        fetchAllRows('personal_bill_payments', q => q.order('payment_date', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }))
      ]);
      [accounts, tx, goals, budgets, debts, savingMoves, debtPayments, bills, billPayments] = results;
      render();
      msg(`Data keuangan berhasil dimuat (${tx.length} transaksi terverifikasi dalam daftar).`);
    } catch (error) {
      msg(`Gagal memuat data: ${error.message}. Periksa koneksi, izin RLS, dan migration 005.`, true);
    }
  }

  function transactionAccountBalance(account) {
    return Number(account?.opening_balance || 0) + tx.filter(item => item.status === 'posted').reduce((sum, item) => {
      const amount = Number(item.amount) || 0;
      if (item.account_id === account.id) {
        if (item.transaction_type === 'income') return sum + amount;
        return sum - amount;
      }
      if (item.transaction_type === 'transfer' && item.transfer_to_account_id === account.id) return sum + amount;
      return sum;
    }, 0);
  }
  function goalSaved(goal) {
    const movementTotal = addUp(savingMoves.filter(move => move.goal_id === goal.id)
      .map(move => (move.movement_type === 'deposit' ? 1 : -1) * Number(move.amount)));
    return Math.max(0, Number(goal.saved_amount || 0) + movementTotal);
  }
  function allGoalAllocated() { return addUp(goals.map(goalSaved)); }
  function totalAccountBalance() { return addUp(accounts.filter(account => account.active).map(transactionAccountBalance)); }
  function availableToSpend() { return totalAccountBalance() - allGoalAllocated(); }
  function reportPeriodBounds() {
    const now = new Date();
    const mode = $('reportPeriod')?.value || 'week';
    let start = new Date(now);
    if (mode === 'day') start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (mode === 'week') { start.setDate(start.getDate() - 6); start = new Date(start.getFullYear(), start.getMonth(), start.getDate()); }
    else if (mode === 'year') start = new Date(now.getFullYear(), 0, 1);
    else start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startKey: localDate(start), endKey: localDate(now) };
  }
  function transactionsForPeriod(bounds = reportPeriodBounds()) {
    return tx.filter(item => item.status === 'posted' && item.transaction_date >= bounds.startKey && item.transaction_date <= bounds.endKey);
  }
  function cashflowBuckets(mode, periodTransactions) {
    const now = new Date();
    const buckets = [];
    if (mode === 'day') {
      const key = localDate(now);
      buckets.push({ key, label: 'Hari ini' });
    } else if (mode === 'week') {
      for (let offset = 6; offset >= 0; offset--) {
        const date = new Date(now); date.setDate(date.getDate() - offset);
        buckets.push({ key: localDate(date), label: date.toLocaleDateString('id-ID', { weekday: 'short' }) });
      }
    } else if (mode === 'month') {
      for (let day = 1; day <= now.getDate(); day++) {
        const date = new Date(now.getFullYear(), now.getMonth(), day);
        buckets.push({ key: localDate(date), label: String(day) });
      }
    } else {
      for (let month = 0; month <= now.getMonth(); month++) {
        const date = new Date(now.getFullYear(), month, 1);
        buckets.push({ key: localDate(date).slice(0, 7), label: date.toLocaleDateString('id-ID', { month: 'short' }) });
      }
    }
    for (const bucket of buckets) {
      const matches = periodTransactions.filter(item => mode === 'year'
        ? String(item.transaction_date).startsWith(bucket.key)
        : item.transaction_date === bucket.key);
      bucket.income = addUp(matches.filter(item => item.transaction_type === 'income').map(item => item.amount));
      bucket.expense = addUp(matches.filter(item => item.transaction_type === 'expense').map(item => item.amount));
    }
    return buckets;
  }
  function renderCashflowChart(mode, periodTransactions) {
    const target = $('cashflowChart');
    if (!target) return;
    const buckets = cashflowBuckets(mode, periodTransactions);
    const maximum = Math.max(0, ...buckets.flatMap(bucket => [bucket.income, bucket.expense]));
    if (!maximum) {
      target.innerHTML = '<div class="chart-empty">Belum ada pemasukan/pengeluaran pada periode ini. Setelah transaksi dicatat, grafik akan terisi otomatis.</div>';
      return;
    }
    target.innerHTML = `<div class="cashflow-scroll"><div class="cashflow-bars">${buckets.map(bucket => {
      const incomeHeight = bucket.income ? Math.max(5, bucket.income / maximum * 100) : 0;
      const expenseHeight = bucket.expense ? Math.max(5, bucket.expense / maximum * 100) : 0;
      return `<div class="cashflow-bucket" title="${esc(bucket.label)} · Pemasukan ${rp(bucket.income)} · Pengeluaran ${rp(bucket.expense)}"><div class="cashflow-column-stack"><span class="cashflow-bar cashflow-income" style="height:${incomeHeight}%"></span><span class="cashflow-bar cashflow-expense" style="height:${expenseHeight}%"></span></div><small>${esc(bucket.label)}</small></div>`;
    }).join('')}</div></div><div class="cashflow-legend"><span><i class="cashflow-income"></i> Pemasukan</span><span><i class="cashflow-expense"></i> Pengeluaran</span></div>`;
  }
  function fillAccountSelect(id, { includeInactive = false } = {}) {
    const element = $(id);
    if (!element) return;
    const previous = element.value;
    const usable = accounts.filter(account => includeInactive || account.active);
    element.innerHTML = usable.map(account => `<option value="${esc(account.id)}">${esc(account.name)}${account.active ? '' : ' (nonaktif)'}</option>`).join('') || '<option value="">Tambahkan akun terlebih dahulu</option>';
    if (usable.some(account => account.id === previous)) element.value = previous;
  }
  function updateCategoryOptions() {
    const element = $('category');
    if (!element) return;
    const categories = $('type').value === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const previous = element.value;
    element.innerHTML = categories.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join('');
    if (categories.includes(canonicalCategory(previous))) element.value = canonicalCategory(previous);
  }
  function imageForGoal(name) {
    const key = normalizeText(name);
    if (key.includes('rumah')) return 'assets/img/dream-home.jpg';
    if (key.includes('libur') || key.includes('travel') || key.includes('jepang')) return 'assets/img/dream-japan.jpg';
    if (key.includes('mobil') || key.includes('motor') || key.includes('kendaraan')) return 'assets/img/dream-car.jpg';
    if (key.includes('laptop') || key.includes('setup') || key.includes('pc') || key.includes('komputer')) return 'assets/img/dream-setup.jpg';
    return 'assets/img/hero-sunset.jpg';
  }
  function spendingTotalsByCategory(source) {
    const totals = new Map();
    for (const item of source.filter(txn => txn.status === 'posted' && txn.transaction_type === 'expense')) {
      const label = canonicalCategory(item.category) || 'Lainnya';
      const key = categoryKey(label);
      const current = totals.get(key) || { label, amount: 0 };
      current.amount += Number(item.amount) || 0;
      totals.set(key, current);
    }
    return [...totals.values()].sort((a, b) => b.amount - a.amount);
  }
  function budgetGroups() {
    const groups = new Map();
    for (const budget of budgets.filter(item => item.active)) {
      const key = categoryKey(budget.category);
      const current = groups.get(key);
      const candidate = { ...budget, displayCategory: canonicalCategory(budget.category) };
      // Prefer the exact canonical row if legacy rows used other spelling/case.
      if (!current || budget.category === candidate.displayCategory || current.category !== current.displayCategory) groups.set(key, candidate);
    }
    return [...groups.values()].sort((a, b) => a.displayCategory.localeCompare(b.displayCategory, 'id'));
  }
  function render() {
    const activeAccounts = accounts.filter(account => account.active);
    for (const id of ['account', 'fromAccount', 'toAccount', 'paymentAccount', 'billPaymentAccount']) fillAccountSelect(id);
    const priorSavingSource = $('savingSourceAccount').value;
    fillAccountSelect('savingSourceAccount');
    if (!$('savingSourceAccount').querySelector('option[value="__unassigned__"]')) {
      const legacyOption = document.createElement('option'); legacyOption.value = '__unassigned__'; legacyOption.textContent = 'Alokasi lama / belum dipetakan'; $('savingSourceAccount').appendChild(legacyOption);
    }
    if (priorSavingSource === '__unassigned__') $('savingSourceAccount').value = priorSavingSource;
    updateCategoryOptions();

    const accountTotal = totalAccountBalance();
    const goalTotal = allGoalAllocated();
    const available = accountTotal - goalTotal;
    $('balance').textContent = rp(accountTotal);
    $('availableBalance').textContent = rp(available);
    $('availableBalance').classList.toggle('negative-number', available < 0);
    $('availableHint').textContent = available < 0 ? 'Alokasi melebihi saldo tercatat' : `Setelah alokasi ${rp(goalTotal)} untuk target`;

    $('accounts').innerHTML = accounts.map(account => {
      const amount = transactionAccountBalance(account);
      return `<div class="row account-row"><div><b>${esc(account.name)} ${account.active ? '' : '<span class="soft-label">Nonaktif</span>'}</b><small><br>${esc(account.account_type)} · Saldo awal ${rp(account.opening_balance)}</small></div><b class="${amount < 0 ? 'minus' : ''}">${rp(amount)}</b></div>`;
    }).join('') || '<p class="muted">Belum ada akun.</p>';

    const periodBounds = reportPeriodBounds();
    const periodTx = transactionsForPeriod(periodBounds);
    const periodSavingsMoves = savingMoves.filter(move => move.movement_date >= periodBounds.startKey && move.movement_date <= periodBounds.endKey);
    const netSavingsAllocated = addUp(periodSavingsMoves.map(move => (move.movement_type === 'deposit' ? 1 : -1) * Number(move.amount || 0)));
    const income = addUp(periodTx.filter(item => item.transaction_type === 'income').map(item => item.amount));
    const expense = addUp(periodTx.filter(item => item.transaction_type === 'expense').map(item => item.amount));
    const transferTotal = addUp(periodTx.filter(item => item.transaction_type === 'transfer').map(item => item.amount));
    $('income').textContent = rp(income); $('expense').textContent = rp(expense);
    $('reportIncome').textContent = rp(income); $('reportExpense').textContent = rp(expense); $('reportNet').textContent = rp(income - expense);
    $('reportTransfers').textContent = rp(transferTotal); $('reportCount').textContent = String(periodTx.length); $('reportSavings').textContent = rp(netSavingsAllocated);
    $('reportRange').textContent = $('reportPeriod').selectedOptions[0]?.textContent || '7 hari terakhir';
    renderCashflowChart($('reportPeriod').value || 'week', periodTx);
    const periodSpending = spendingTotalsByCategory(periodTx);
    const periodExpenseTotal = addUp(periodSpending.map(item => item.amount));
    $('reportCategories').innerHTML = periodSpending.map(item => {
      const percent = periodExpenseTotal > 0 ? Math.round(item.amount / periodExpenseTotal * 100) : 0;
      return `<div class="category-spend-row"><div class="category-spend-top"><span>${esc(item.label)}</span><b class="minus">${rp(item.amount)} · ${percent}%</b></div><div class="category-spend-bar"><span style="width:${percent}%"></span></div></div>`;
    }).join('') || '<p class="muted">Belum ada pengeluaran pada periode ini.</p>';

    const accountMap = new Map(accounts.map(account => [account.id, account]));
    $('transactions').innerHTML = tx.slice(0, 80).map(item => {
      const type = item.transaction_type;
      const isBusinessWD = type === 'income' && (item.source === 'business_transfer' || item.source_transfer_id);
      const label = type === 'transfer' ? `Transfer: ${accountMap.get(item.account_id)?.name || 'Akun'} → ${accountMap.get(item.transfer_to_account_id)?.name || 'Akun tujuan'}` : (isBusinessWD ? 'WD / Gaji Pemilik dari MR ALL IN Business' : canonicalCategory(item.category));
      const sign = type === 'income' ? '+' : type === 'expense' ? '−' : '↔';
      const css = type === 'income' ? 'plus' : type === 'expense' ? 'minus' : 'transfer';
      const detailParts = [item.transaction_date, accountMap.get(item.account_id)?.name || 'Akun'];
      if (isBusinessWD) detailParts.push('Pemasukan hasil penarikan pemilik dari kas bisnis');
      if (item.note) detailParts.push(item.note);
      if (isBusinessWD && item.source_transfer_id) detailParts.push('ID WD: ' + String(item.source_transfer_id).slice(0, 8).toUpperCase());
      return `<div class="row"><div><b>${esc(label)}</b><small><br>${detailParts.map(esc).join(' · ')}</small></div><b class="${css}">${sign} ${rp(item.amount)}</b></div>`;
    }).join('') || '<p class="muted">Belum ada transaksi.</p>';

    const goalSavedMap = new Map(goals.map(goal => [goal.id, goalSaved(goal)]));
    const selectableGoals = goals.filter(goal => goal.status === 'active' || goalSaved(goal) > 0);
    $('savingGoal').innerHTML = selectableGoals.map(goal => `<option value="${esc(goal.id)}">${esc(goal.name)}${goal.status !== 'active' ? ' (penarikan saja)' : ''}</option>`).join('') || '<option value="">Buat target terlebih dahulu</option>';
    $('goals').innerHTML = goals.map(goal => {
      const saved = goalSavedMap.get(goal.id) || 0;
      const target = Number(goal.target_amount) || 0;
      const percentage = target > 0 ? Math.min(100, Math.round(saved / target * 100)) : 0;
      const statusText = goal.status === 'completed' || saved >= target ? 'Tercapai' : goal.status === 'paused' ? 'Dijeda' : 'Berjalan';
      const canDeposit = goal.status === 'active' && saved < target;
      const canWithdraw = saved > 0;
      const goalActions = `${canDeposit ? `<button type="button" class="mini-action" data-goal-action="deposit" data-goal-id="${esc(goal.id)}">＋ Setor</button>` : ''}${canWithdraw ? `<button type="button" class="mini-action secondary" data-goal-action="withdrawal" data-goal-id="${esc(goal.id)}">− Tarik</button>` : ''}${!canDeposit && !canWithdraw ? '<span class="goal-status">Belum ada alokasi</span>' : ''}`;
      return `<article class="goal-record"><img src="${imageForGoal(goal.name)}" alt="Ilustrasi ${esc(goal.name)}" loading="lazy"><div class="goal-record-body"><div class="goal-title-row"><b>${esc(goal.name)}</b><span class="goal-status">${statusText}</span></div><small>${rp(saved)} terkumpul dari ${rp(target)} · ${percentage}%${goal.target_date ? ' · target ' + esc(goal.target_date) : ''}</small><div class="progress"><span style="width:${percentage}%"></span></div><div class="goal-actions">${goalActions}<span class="goal-remaining">Sisa ${rp(Math.max(0, target - saved))}</span></div></div></article>`;
    }).join('') || '<p class="muted">Belum ada target tabungan. Pilih salah satu inspirasi, lalu simpan target pertamamu.</p>';
    $('savingMoves').innerHTML = savingMoves.slice(0, 30).map(move => {
      const goal = goals.find(item => item.id === move.goal_id);
      const source = accountMap.get(move.source_account_id)?.name || (move.source_account_id ? '' : 'Alokasi lama / belum dipetakan');
      return `<div class="row"><div><b>${esc(goal?.name || 'Target tabungan')}</b><small><br>${esc(move.movement_date)}${source ? ' · Rujukan ' + esc(source) : ''}${move.note ? ' · ' + esc(move.note) : ''}</small></div><b class="${move.movement_type === 'deposit' ? 'plus' : 'minus'}">${move.movement_type === 'deposit' ? '+' : '−'}${rp(move.amount)}</b></div>`;
    }).join('') || '<p class="muted">Belum ada setoran atau penarikan.</p>';
    const completedGoals = goals.filter(goal => goalSaved(goal) >= Number(goal.target_amount || 0)).length;
    $('goalMotivation').textContent = !goals.length
      ? 'Pilih gambar impian, tentukan target yang realistis, lalu catat setoran nyata untuk melihat progres.'
      : completedGoals === goals.length
        ? 'Keren, semua target yang tercatat sudah tercapai. Pastikan kebutuhan wajib dan saldo darurat tetap aman.'
        : `Sudah mengalokasikan ${rp(goalTotal)} untuk ${goals.length} target. Saldo tersedia untuk belanja sekarang ${rp(available)}.`;

    const monthKey = localDate(new Date()).slice(0, 7);
    const currentMonthExpenses = tx.filter(item => item.status === 'posted' && item.transaction_type === 'expense' && String(item.transaction_date).startsWith(monthKey));
    const budgetSpent = new Map();
    for (const item of currentMonthExpenses) {
      const key = categoryKey(item.category);
      budgetSpent.set(key, (budgetSpent.get(key) || 0) + Number(item.amount || 0));
    }
    // Apply net savings allocation once, independent of database sort order.
    // Clamping after each row is order-dependent (a withdrawal may sort before its deposit).
    const savingsKey = categoryKey('Tabungan');
    const netSavingsAllocation = addUp(savingMoves
      .filter(item => String(item.movement_date).startsWith(monthKey))
      .map(move => (move.movement_type === 'deposit' ? 1 : -1) * Number(move.amount || 0)));
    budgetSpent.set(savingsKey, Math.max(0, (budgetSpent.get(savingsKey) || 0) + netSavingsAllocation));
    const activeBudgets = budgetGroups();
    const budgetAlerts = [];
    $('budgets').innerHTML = activeBudgets.map(budget => {
      const used = Math.max(0, budgetSpent.get(categoryKey(budget.displayCategory)) || 0);
      const limit = Number(budget.monthly_limit) || 0;
      const pct = limit > 0 ? Math.round(used / limit * 100) : 0;
      const remaining = limit - used;
      if (remaining < 0) budgetAlerts.push(`${budget.displayCategory} melewati batas ${rp(Math.abs(remaining))}`);
      const displayPct = Math.min(100, Math.max(0, pct));
      return `<div class="budget-record"><div class="budget-top"><b>${esc(budget.displayCategory)}</b><strong class="${remaining < 0 ? 'minus' : ''}">${pct}%</strong></div><small>Terpakai ${rp(used)} dari ${rp(limit)} · ${remaining >= 0 ? 'sisa ' + rp(remaining) : 'lebih ' + rp(Math.abs(remaining))}</small><div class="progress"><span class="${remaining < 0 ? 'over' : ''}" style="width:${displayPct}%"></span></div></div>`;
    }).join('') || '<p class="muted">Belum ada anggaran. Buat anggaran, misalnya Makan Rp1.500.000/bulan. Pengeluaran yang cocok akan dihitung otomatis.</p>';

    const paidByDebt = new Map();
    debtPayments.forEach(payment => paidByDebt.set(payment.debt_id, (paidByDebt.get(payment.debt_id) || 0) + Number(payment.amount || 0)));
    $('paymentDebt').innerHTML = debts.filter(debt => debt.status !== 'paid').map(debt => `<option value="${esc(debt.id)}">${esc(debt.name)}</option>`).join('') || '<option value="">Tidak ada utang aktif</option>';
    $('debts').innerHTML = debts.map(debt => {
      const paid = Number(debt.paid_amount || 0) + (paidByDebt.get(debt.id) || 0);
      const principal = Number(debt.principal_amount) || 0;
      const remaining = Math.max(0, principal - paid);
      const isPaid = debt.status === 'paid' || remaining <= 0;
      const pct = principal > 0 ? Math.min(100, Math.round(paid / principal * 100)) : 0;
      const todayKey = localDate(new Date());
      const soonKey = localDate(new Date(Date.now() + 7 * 86400000));
      const debtLate = Boolean(debt.due_date && debt.due_date < todayKey && !isPaid);
      const debtSoon = Boolean(debt.due_date && debt.due_date >= todayKey && debt.due_date <= soonKey && !isPaid);
      const dueLabel = debt.due_date ? `${debt.due_date}${debtLate ? ' · TERLAMBAT' : debtSoon ? ' · SEGERA JATUH TEMPO' : ''}` : 'Tanpa tanggal jatuh tempo';
      const actionButtons = !isPaid ? `<div class="goal-actions"><button type="button" class="mini-action" data-debt-action="partial" data-debt-id="${esc(debt.id)}">Cicil</button><button type="button" class="mini-action danger-action" data-debt-action="full" data-debt-id="${esc(debt.id)}">Bayar penuh ${rp(remaining)}</button></div>` : '<span class="goal-status success-status">LUNAS</span>';
      return `<article class="debt-record"><div class="debt-record-top"><div><b>${esc(debt.name)}</b><small><br>Awal ${rp(principal)} · sudah dibayar ${rp(paid)}</small></div><strong class="${isPaid ? 'plus' : 'minus'}">${rp(remaining)}</strong></div><small>Jatuh tempo: ${esc(dueLabel)}</small><div class="progress"><span style="width:${pct}%"></span></div>${actionButtons}</article>`;
    }).join('') || '<p class="muted">Belum ada utang pribadi tercatat.</p>';
    const unlinkedLegacyDebtPayments = debtPayments.filter(payment => !payment.transaction_id);
    const legacyDebtWarning = unlinkedLegacyDebtPayments.length
      ? `<div class="inline-note warning-note">⚠️ ${unlinkedLegacyDebtPayments.length} pembayaran utang lama belum ditautkan ke transaksi rekening. Tidak ada transaksi historis yang dibuat otomatis karena rekening sumbernya belum diketahui; cocokkan satu per satu agar tidak menggandakan pengeluaran.</div>`
      : '';
    $('debtPayments').innerHTML = legacyDebtWarning + (debtPayments.slice(0, 30).map(payment => {
      const debt = debts.find(item => item.id === payment.debt_id);
      const source = accountMap.get(payment.account_id)?.name;
      const legacy = !payment.transaction_id;
      return `<div class="row"><div><b>${esc(debt?.name || 'Utang')}${legacy ? ' · riwayat lama belum direkonsiliasi' : ''}</b><small><br>${esc(payment.payment_date)}${source ? ' · ' + esc(source) : ''}${payment.note ? ' · ' + esc(payment.note) : ''}</small></div><b class="minus">−${rp(payment.amount)}</b></div>`;
    }).join('') || '<p class="muted">Belum ada pembayaran utang.</p>');

    const activeBills = bills.filter(bill => bill.status === 'active');
    $('billPaymentBill').innerHTML = activeBills.map(bill => `<option value="${esc(bill.id)}">${esc(bill.name)} · sisa ${rp(Number(bill.amount) - Number(bill.paid_this_cycle || 0))}</option>`).join('') || '<option value="">Tidak ada tagihan aktif</option>';
    $('bills').innerHTML = bills.map(bill => {
      const amount = Number(bill.amount) || 0, paid = Number(bill.paid_this_cycle) || 0, remaining = Math.max(0, amount - paid);
      const isPaid = bill.status === 'paid';
      const overdue = bill.status === 'active' && bill.due_date < localDate(new Date());
      const due = isPaid ? 'LUNAS' : overdue ? `TERLAMBAT · ${bill.due_date}` : `Jatuh tempo ${bill.due_date}`;
      const recurrenceLabel = { none: 'Sekali bayar', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' }[bill.recurrence] || 'Tagihan';
      const progress = amount ? Math.min(100, Math.round(paid / amount * 100)) : 0;
      const paused = bill.status === 'paused';
      const toggleAction = !isPaid ? `<button type="button" class="mini-action secondary" data-bill-toggle="${paused ? 'active' : 'paused'}" data-bill-id="${esc(bill.id)}">${paused ? 'Lanjutkan' : 'Jeda'}</button>` : '';
      const action = isPaid ? '<span class="goal-status success-status">LUNAS</span>' : paused ? '<span class="goal-status">DIJEDA</span>' : `<button type="button" class="mini-action" data-bill-action="partial" data-bill-id="${esc(bill.id)}">Bayar sebagian</button><button type="button" class="mini-action danger-action" data-bill-action="full" data-bill-id="${esc(bill.id)}">Bayar sisa ${rp(remaining)}</button>`;
      const dueClass = overdue ? 'minus' : (!isPaid && bill.due_date >= localDate(new Date()) && bill.due_date <= localDate(new Date(Date.now() + 7 * 86400000)) ? 'due-soon' : '');
      return `<article class="bill-record"><div class="debt-record-top"><div><b>${esc(bill.name)}</b><small><br>${esc(recurrenceLabel)} · ${esc(canonicalCategory(bill.category))}</small></div><strong>${rp(remaining)}</strong></div><small class="${dueClass}">${esc(paused ? 'Jadwal dijeda' : due)}</small>${paid > 0 && !isPaid ? `<small>Sudah dibayar periode ini: ${rp(paid)}</small><div class="progress"><span style="width:${progress}%"></span></div>` : ''}<div class="goal-actions">${action}${toggleAction}</div></article>`;
    }).join('') || '<p class="muted">Belum ada jadwal tagihan. Tambahkan tagihan rutin agar jatuh tempo dan pembayaran dapat dilacak.</p>';
    $('billPayments').innerHTML = billPayments.slice(0, 30).map(payment => {
      const bill = bills.find(item => item.id === payment.bill_id);
      const source = accountMap.get(payment.account_id)?.name;
      return `<div class="row"><div><b>${esc(bill?.name || 'Tagihan')}</b><small><br>${esc(payment.payment_date)}${source ? ' · ' + esc(source) : ''}${payment.note ? ' · ' + esc(payment.note) : ''}</small></div><b class="minus">−${rp(payment.amount)}</b></div>`;
    }).join('') || '<p class="muted">Belum ada pembayaran tagihan.</p>';

    const spending = spendingTotalsByCategory(periodTx);
    const top = spending[0];
    const activeOverdueBills = activeBills.filter(bill => bill.due_date < localDate(new Date()));
    const overdueDebts = debts.filter(debt => debt.status !== 'paid' && debt.due_date && debt.due_date < localDate(new Date()));
    let insight = `${$('reportRange').textContent}: ${periodTx.length} transaksi; pemasukan ${rp(income)}, pengeluaran ${rp(expense)}, arus bersih ${rp(income - expense)}. Alokasi tabungan bersih ${rp(netSavingsAllocated)} ditampilkan terpisah; transfer internal ${rp(transferTotal)} tidak dihitung sebagai pemasukan/pengeluaran.`;
    if (top) insight += ` Kategori pengeluaran terbesar: ${top.label} (${rp(top.amount)}).`;
    if (budgetAlerts.length) insight += ` Peringatan anggaran: ${budgetAlerts.join('; ')}.`;
    if (activeOverdueBills.length || overdueDebts.length) insight += ` Perlu dicek: ${activeOverdueBills.length} tagihan dan ${overdueDebts.length} utang melewati tanggal jatuh tempo.`;
    const unlinkedDebtCount = debtPayments.filter(payment => !payment.transaction_id).length;
    if (unlinkedDebtCount) insight += ` Audit riwayat: ada ${unlinkedDebtCount} pembayaran utang lama yang belum tertaut ke transaksi rekening. Data lama dipertahankan; cocokkan manual sebelum mengandalkan laporan historis.`;
    if (available < 0) insight += ` PERINGATAN: alokasi tabungan melebihi saldo rekening tercatat sebesar ${rp(Math.abs(available))}.`;
    $('insights').textContent = insight;
  }

  async function addAccount(event) {
    event.preventDefault();
    if (!user) return msg('Login terlebih dahulu.', true);
    const name = $('aname').value.trim();
    if (!name) return msg('Nama akun wajib diisi.', true);
    try {
      const result = await sb.from('personal_accounts').insert({ user_id: user.id, name, account_type: $('atype').value, opening_balance: Number($('opening').value) || 0, active: true });
      if (result.error) throw result.error;
      $('af').reset(); $('opening').value = '0'; await loadData(); msg('Akun berhasil ditambahkan.');
    } catch (error) { msg(`Gagal menambah akun: ${error.message}`, true); }
  }
  async function addTransaction(event) {
    event.preventDefault();
    if (!user) return msg('Login terlebih dahulu.', true);
    const accountId = $('account').value, amount = Number($('amount').value), type = $('type').value;
    if (!accountId) return msg('Tambahkan dan pilih rekening terlebih dahulu.', true);
    if (!Number.isFinite(amount) || amount <= 0) return msg('Nominal harus lebih dari nol.', true);
    const category = canonicalCategory($('category').value);
    try {
      const result = await sb.rpc('record_personal_transaction', {
        p_account_id: accountId, p_transaction_type: type, p_amount: amount,
        p_transaction_date: $('date').value || localDate(new Date()), p_category: category,
        p_note: $('note').value.trim() || null, p_transfer_to_account_id: null
      });
      if (result.error) throw result.error;
      const savedAmount = amount; $('amount').value = ''; $('note').value = '';
      await loadData();
      if (type === 'expense') {
        const matchingBudget = budgetGroups().find(budget => categoryKey(budget.displayCategory) === categoryKey(category));
        if (matchingBudget) {
          const used = addUp(tx.filter(item => item.status === 'posted' && item.transaction_type === 'expense' && String(item.transaction_date).startsWith(localDate(new Date()).slice(0, 7)) && categoryKey(item.category) === categoryKey(category)).map(item => item.amount));
          const limit = Number(matchingBudget.monthly_limit) || 0;
          msg(`${rp(savedAmount)} tersimpan sebagai pengeluaran ${category}. Anggaran terpakai ${rp(used)} dari ${rp(limit)}${used > limit ? ' — batas anggaran terlampaui!' : '.'}`, used > limit);
        } else msg(`${rp(savedAmount)} tersimpan sebagai pengeluaran ${category}. Belum ada anggaran untuk kategori ini.`);
      } else msg(`${rp(savedAmount)} tersimpan sebagai pemasukan.`);
    } catch (error) { msg(`Gagal menyimpan transaksi: ${error.message}`, true); }
  }
  async function addTransfer(event) {
    event.preventDefault();
    if (!user) return msg('Login terlebih dahulu.', true);
    const from = $('fromAccount').value, to = $('toAccount').value, amount = Number($('transferAmount').value);
    if (!from || !to) return msg('Tambahkan minimal dua akun terlebih dahulu.', true);
    if (from === to) return msg('Rekening asal dan tujuan harus berbeda.', true);
    if (!Number.isFinite(amount) || amount <= 0) return msg('Nominal transfer harus lebih dari nol.', true);
    try {
      const result = await sb.rpc('record_personal_transaction', {
        p_account_id: from, p_transfer_to_account_id: to, p_transaction_type: 'transfer', p_amount: amount,
        p_transaction_date: $('transferDate').value || localDate(new Date()), p_category: 'Transfer antar-rekening',
        p_note: $('transferNote').value.trim() || null
      });
      if (result.error) throw result.error;
      $('transferAmount').value = ''; $('transferNote').value = ''; await loadData(); msg('Transfer tersimpan. Saldo asal berkurang, saldo tujuan bertambah; laporan pemasukan/pengeluaran tidak berubah.');
    } catch (error) { msg(`Gagal menyimpan transfer. Periksa migration 002 dan saldo akun: ${error.message}`, true); }
  }
  async function addGoal(event) {
    event.preventDefault();
    if (!user) return msg('Login terlebih dahulu.', true);
    const name = $('goalName').value.trim(), target = Number($('goalTarget').value);
    if (!name) return msg('Nama target wajib diisi.', true);
    if (!Number.isFinite(target) || target <= 0) return msg('Target harus lebih dari nol.', true);
    try {
      const result = await sb.from('personal_savings_goals').insert({ user_id: user.id, name, target_amount: target, target_date: $('goalDate').value || null, saved_amount: 0, status: 'active' });
      if (result.error) throw result.error;
      $('goalForm').reset(); await loadData(); msg(`Target ${name} berhasil dibuat. Gunakan tombol Setor di kartu target untuk mengalokasikan dana.`);
    } catch (error) { msg(`Gagal menyimpan target: ${error.message}`, true); }
  }
  async function addSavingMovement(event) {
    event.preventDefault();
    if (!user) return msg('Login terlebih dahulu.', true);
    const goalId = $('savingGoal').value, sourceAccountId = $('savingSourceAccount').value;
    const amount = Number($('savingMoveAmount').value), type = $('savingMoveType').value;
    if (!goalId) return msg('Buat dan pilih target tabungan terlebih dahulu.', true);
    if (!sourceAccountId) return msg('Pilih rekening sumber/rujukan.', true);
    if (!Number.isFinite(amount) || amount <= 0) return msg('Nominal harus lebih dari nol.', true);
    const goal = goals.find(item => item.id === goalId);
    const legacySource = sourceAccountId === '__unassigned__';
    const account = accounts.find(item => item.id === sourceAccountId);
    const currentSaved = goal ? goalSaved(goal) : 0;
    if (type === 'deposit' && legacySource) return msg('Untuk setoran baru, pilih rekening sumber yang sebenarnya.', true);
    if (type === 'deposit' && goal && goal.status !== 'active') return msg('Target ini tidak aktif. Aktifkan kembali atau buat target baru sebelum menambah setoran.', true);
    if (type === 'deposit' && goal && currentSaved >= Number(goal.target_amount || 0)) return msg('Target sudah tercapai. Bebaskan alokasi atau buat target baru sebelum menambah tabungan.', true);
    if (type === 'deposit' && goal && currentSaved + amount > Number(goal.target_amount || 0)) return msg(`Setoran melebihi sisa target ${rp(Math.max(0, Number(goal.target_amount || 0) - currentSaved))}.`, true);
    if (type === 'withdrawal' && amount > currentSaved) return msg('Penarikan melebihi dana yang dialokasikan untuk target ini.', true);
    // Savings allocations are virtual, so a target withdrawal releases its own allocation
    // even if the physical cash has since been moved between accounts. The source field is a reference.
    if (type === 'deposit') {
      if (amount > availableToSpend()) return msg(`Saldo tersedia hanya ${rp(availableToSpend())}. Kurangi nominal alokasi agar tidak melebihi dana yang tercatat.`, true);
      if (amount > transactionAccountBalance(account)) return msg(`Saldo fisik ${account?.name || 'rekening'} tidak cukup.`, true);
    }
    try {
      const result = await sb.rpc('record_personal_savings_movement', { p_goal_id: goalId, p_source_account_id: legacySource ? null : sourceAccountId, p_movement_type: type, p_amount: amount, p_movement_date: $('savingMoveDate').value || localDate(new Date()), p_note: $('savingMoveNote').value.trim() || null });
      if (result.error) throw result.error;
      $('savingMoveAmount').value = ''; $('savingMoveNote').value = ''; await loadData();
      msg(type === 'deposit' ? `Alokasi ${rp(amount)} masuk ke target. Saldo rekening fisik tidak diubah; saldo tersedia berkurang.` : `Alokasi ${rp(amount)} dibebaskan dari target. Saldo tersedia bertambah; saldo rekening fisik tidak diubah.`);
    } catch (error) { msg(`Gagal mencatat pergerakan tabungan: ${error.message}`, true); }
  }
  async function addBudget(event) {
    event.preventDefault();
    if (!user) return msg('Login terlebih dahulu.', true);
    const category = canonicalCategory($('budgetCategory').value), limit = Number($('budgetLimit').value);
    if (!category) return msg('Pilih kategori anggaran.', true);
    if (!Number.isFinite(limit) || limit <= 0) return msg('Batas anggaran harus lebih dari nol.', true);
    try {
      // Reuse an existing semantically equivalent budget row (e.g. legacy 'Makan & Minum')
      // instead of creating a second row that competes with the canonical 'Makan' budget.
      const equivalentRows = budgets.filter(item => categoryKey(item.category) === categoryKey(category));
      const existing = equivalentRows.find(item => item.category === category) || equivalentRows.find(item => normalizeText(item.category) === normalizeText(category)) || equivalentRows[0];
      const result = existing
        ? await sb.from('personal_budgets').update({ category, monthly_limit: limit, active: true, updated_at: new Date().toISOString() }).eq('id', existing.id).eq('user_id', user.id)
        : await sb.from('personal_budgets').insert({ user_id: user.id, category, monthly_limit: limit, active: true });
      if (result.error) throw result.error;
      $('budgetLimit').value = ''; await loadData();
      const spent = addUp(tx.filter(item => item.status === 'posted' && item.transaction_type === 'expense' && String(item.transaction_date).startsWith(localDate(new Date()).slice(0, 7)) && categoryKey(item.category) === categoryKey(category)).map(item => item.amount));
      msg(`Anggaran ${category} disimpan: ${rp(spent)} terpakai dari ${rp(limit)} bulan ini.`);
    } catch (error) { msg(`Gagal menyimpan anggaran: ${error.message}`, true); }
  }
  async function addDebt(event) {
    event.preventDefault();
    if (!user) return msg('Login terlebih dahulu.', true);
    const name = $('debtName').value.trim(), amount = Number($('debtPrincipal').value);
    if (!name || !Number.isFinite(amount) || amount <= 0) return msg('Nama utang dan total awal yang valid wajib diisi.', true);
    try {
      const result = await sb.from('personal_debts').insert({ user_id: user.id, name, principal_amount: amount, paid_amount: 0, due_date: $('debtDue').value || null, status: 'active' });
      if (result.error) throw result.error;
      $('debtForm').reset(); await loadData(); msg('Utang tersimpan. Gunakan tombol Cicil atau Bayar penuh pada kartu utang untuk menautkan pembayaran ke saldo rekening.');
    } catch (error) { msg(`Gagal menyimpan utang: ${error.message}`, true); }
  }
  async function addDebtPayment(event) {
    event.preventDefault();
    if (!user) return msg('Login terlebih dahulu.', true);
    const debtId = $('paymentDebt').value, accountId = $('paymentAccount').value, amount = Number($('paymentAmount').value);
    if (!debtId) return msg('Pilih utang terlebih dahulu.', true);
    if (!accountId) return msg('Pilih rekening pembayaran.', true);
    if (!Number.isFinite(amount) || amount <= 0) return msg('Nominal pembayaran harus lebih dari nol.', true);
    try {
      const result = await sb.rpc('record_personal_debt_payment', { p_debt_id: debtId, p_account_id: accountId, p_amount: amount, p_payment_date: $('paymentDate').value || localDate(new Date()), p_note: $('paymentNote').value.trim() || null });
      if (result.error) throw result.error;
      $('paymentAmount').value = ''; $('paymentNote').value = ''; await loadData(); msg(`Pembayaran utang ${rp(amount)} tersimpan. Saldo rekening, riwayat pembayaran, laporan, dan anggaran diperbarui bersama.`);
    } catch (error) { msg(`Pembayaran utang gagal: ${error.message}`, true); }
  }
  async function addBill(event) {
    event.preventDefault();
    if (!user) return msg('Login terlebih dahulu.', true);
    const name = $('billName').value.trim(), amount = Number($('billAmount').value);
    if (!name || !Number.isFinite(amount) || amount <= 0 || !$('billDue').value) return msg('Nama, nominal, dan tanggal jatuh tempo wajib valid.', true);
    try {
      const result = await sb.from('personal_bills').insert({ user_id: user.id, name, amount, category: canonicalCategory($('billCategory').value), due_date: $('billDue').value, recurrence: $('billRecurrence').value, paid_this_cycle: 0, status: 'active' });
      if (result.error) throw result.error;
      $('billForm').reset(); await loadData(); msg(`Tagihan ${name} tersimpan. Pilih Bayar sisa pada kartu ketika ingin membayar.`);
    } catch (error) { msg(`Gagal menyimpan tagihan: ${error.message}`, true); }
  }
  async function addBillPayment(event) {
    event.preventDefault();
    if (!user) return msg('Login terlebih dahulu.', true);
    const billId = $('billPaymentBill').value, accountId = $('billPaymentAccount').value, amount = Number($('billPaymentAmount').value);
    if (!billId) return msg('Pilih tagihan terlebih dahulu.', true);
    if (!accountId) return msg('Pilih rekening pembayaran.', true);
    if (!Number.isFinite(amount) || amount <= 0) return msg('Nominal pembayaran harus lebih dari nol.', true);
    try {
      const result = await sb.rpc('record_personal_bill_payment', { p_bill_id: billId, p_account_id: accountId, p_amount: amount, p_payment_date: $('billPaymentDate').value || localDate(new Date()), p_note: $('billPaymentNote').value.trim() || null });
      if (result.error) throw result.error;
      $('billPaymentAmount').value = ''; $('billPaymentNote').value = ''; await loadData(); msg(`Pembayaran tagihan ${rp(amount)} tersimpan. Saldo rekening, tagihan, laporan, dan anggaran diperbarui bersama.`);
    } catch (error) { msg(`Pembayaran tagihan gagal: ${error.message}`, true); }
  }
  function prefillDebtPayment(debtId, action) {
    const debt = debts.find(item => item.id === debtId);
    if (!debt) return;
    const paid = Number(debt.paid_amount || 0) + addUp(debtPayments.filter(payment => payment.debt_id === debtId).map(payment => payment.amount));
    const remaining = Math.max(0, Number(debt.principal_amount || 0) - paid);
    $('paymentDebt').value = debtId;
    if (action === 'full') $('paymentAmount').value = String(remaining);
    $('paymentDate').value = localDate(new Date());
    $('debtPaymentForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => (action === 'full' ? $('paymentAccount') : $('paymentAmount')).focus({ preventScroll: true }), 180);
    msg(action === 'full' ? `Nominal pelunasan ${rp(remaining)} sudah diisi. Pilih rekening lalu konfirmasi.` : `Mode cicil untuk ${debt.name}. Isi nominal cicilan, pilih rekening, lalu simpan.`);
  }
  function prefillBillPayment(billId, action) {
    const bill = bills.find(item => item.id === billId);
    if (!bill) return;
    const remaining = Math.max(0, Number(bill.amount || 0) - Number(bill.paid_this_cycle || 0));
    $('billPaymentBill').value = billId;
    if (action === 'full') $('billPaymentAmount').value = String(remaining);
    $('billPaymentDate').value = localDate(new Date());
    $('billPaymentForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => (action === 'full' ? $('billPaymentAccount') : $('billPaymentAmount')).focus({ preventScroll: true }), 180);
    msg(action === 'full' ? `Nominal sisa tagihan ${rp(remaining)} sudah diisi. Pilih rekening lalu konfirmasi.` : `Isi nominal pembayaran sebagian untuk ${bill.name}.`);
  }
  function downloadJson(data, fileName) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }
  function backup() {
    if (!user) return msg('Login terlebih dahulu.', true);
    const data = {
      format: 'MR_ALL_IN_PERSONAL_BACKUP', version: 3, exportedAt: new Date().toISOString(), userId: user.id,
      accounts, transactions: tx, savingsGoals: goals, budgets, debts, savingsMovements: savingMoves,
      debtPayments, bills, billPayments
    };
    downloadJson(data, `mr-all-personal-backup-${localDate(new Date())}.json`);
    $('backupMsg').textContent = 'Backup berhasil dibuat. Simpan file secara privat di lokasi aman.';
  }
  async function restoreBackup() {
    if (!user) return msg('Login terlebih dahulu.', true);
    const file = $('restoreFile').files?.[0];
    if (!file) return msg('Pilih file backup JSON terlebih dahulu.', true);
    if (!confirm('Pulihkan dengan menggabungkan data berdasarkan ID? Data yang sudah ada tidak dihapus. Buat backup baru terlebih dahulu.')) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.format !== 'MR_ALL_IN_PERSONAL_BACKUP' || !Array.isArray(data.accounts) || !Array.isArray(data.transactions)) throw new Error('Format backup tidak dikenali.');
      const tables = [
        ['personal_accounts', data.accounts], ['personal_savings_goals', data.savingsGoals || []],
        ['personal_budgets', data.budgets || []], ['personal_debts', data.debts || []],
        ['personal_bills', data.bills || []], ['personal_transactions', data.transactions],
        ['personal_savings_movements', data.savingsMovements || []], ['personal_debt_payments', data.debtPayments || []],
        ['personal_bill_payments', data.billPayments || []]
      ];
      for (const [table, rows] of tables) {
        if (!rows.length) continue;
        const safeRows = rows.map(({ id, ...row }) => ({ ...row, ...(id ? { id } : {}), user_id: user.id }));
        const result = await sb.from(table).upsert(safeRows, { onConflict: 'id' });
        if (result.error) throw new Error(`${table}: ${result.error.message}`);
      }
      $('backupMsg').textContent = 'Pemulihan selesai. Data lama tidak dihapus; periksa jumlah transaksi, saldo, target, dan tagihan.';
      await loadData(); msg('Pemulihan backup selesai. Pastikan saldo dan jumlah tiap tabel cocok dengan sumber backup.');
    } catch (error) { msg(`Pemulihan gagal: ${error.message}`, true); }
  }

  function guardedSubmit(handler) {
    return async event => {
      const form = event.currentTarget;
      if (form.dataset.submitting === 'true') { event.preventDefault(); return; }
      form.dataset.submitting = 'true';
      form.setAttribute('aria-busy', 'true');
      const buttons = [...form.querySelectorAll('button[type="submit"],button:not([type])')];
      const priorStates = buttons.map(button => button.disabled);
      buttons.forEach(button => { button.disabled = true; });
      try { await handler(event); }
      finally {
        form.dataset.submitting = 'false';
        form.removeAttribute('aria-busy');
        buttons.forEach((button, index) => { button.disabled = priorStates[index]; });
      }
    };
  }

  function init() {
    if (!$('date') || !$('msg') || !$('url') || !$('key')) { console.error('Elemen inti MR ALL IN Personal tidak ditemukan.'); return; }
    const today = localDate(new Date());
    for (const id of ['date', 'transferDate', 'savingMoveDate', 'paymentDate', 'billDue', 'billPaymentDate']) if ($(id)) $(id).value = today;
    $('save').addEventListener('click', saveConfig);
    $('login').addEventListener('click', login);
    $('logout').addEventListener('click', logout);
    $('af').addEventListener('submit', guardedSubmit(addAccount));
    $('tf').addEventListener('submit', guardedSubmit(addTransaction));
    $('transferForm').addEventListener('submit', guardedSubmit(addTransfer));
    $('refresh').addEventListener('click', loadData);
    $('reportPeriod').addEventListener('change', render);
    $('type').addEventListener('change', updateCategoryOptions);
    $('goalForm').addEventListener('submit', guardedSubmit(addGoal));
    $('savingMoveForm').addEventListener('submit', guardedSubmit(addSavingMovement));
    $('budgetForm').addEventListener('submit', guardedSubmit(addBudget));
    $('debtForm').addEventListener('submit', guardedSubmit(addDebt));
    $('debtPaymentForm').addEventListener('submit', guardedSubmit(addDebtPayment));
    $('billForm').addEventListener('submit', guardedSubmit(addBill));
    $('billPaymentForm').addEventListener('submit', guardedSubmit(addBillPayment));
    $('backupBtn').addEventListener('click', backup);
    $('restoreBtn').addEventListener('click', restoreBackup);
    $('savingMoveDate').value = today; $('paymentDate').value = today; $('billDue').value = today; $('billPaymentDate').value = today;
    const hour = new Date().getHours();
    $('greeting').textContent = hour < 11 ? 'Selamat pagi,' : hour < 15 ? 'Selamat siang,' : hour < 18 ? 'Selamat sore,' : 'Selamat malam,';

    document.querySelectorAll('[data-goal-preset]').forEach(card => card.addEventListener('click', () => {
      $('goalName').value = card.getAttribute('data-goal-preset') || '';
      $('goalTarget').focus({ preventScroll: true });
      $('goalForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      msg('Inspirasi dipilih. Masukkan target nominal dan tanggal yang realistis.');
    }));
    document.querySelectorAll('[data-quick-type]').forEach(card => card.addEventListener('click', () => {
      $('type').value = card.getAttribute('data-quick-type') || 'expense'; updateCategoryOptions();
      $('tf').scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => $('amount').focus({ preventScroll: true }), 180);
    }));
    $('goals').addEventListener('click', event => {
      const button = event.target.closest('[data-goal-action]');
      if (!button) return;
      $('savingGoal').value = button.dataset.goalId;
      $('savingMoveType').value = button.dataset.goalAction;
      $('savingMoveAmount').value = '';
      $('savingMoveForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => $('savingMoveAmount').focus({ preventScroll: true }), 180);
    });
    $('debts').addEventListener('click', event => {
      const button = event.target.closest('[data-debt-action]');
      if (button) prefillDebtPayment(button.dataset.debtId, button.dataset.debtAction);
    });
    $('bills').addEventListener('click', async event => {
      const toggle = event.target.closest('[data-bill-toggle]');
      if (toggle) {
        try {
          const result = await sb.from('personal_bills').update({ status: toggle.dataset.billToggle, updated_at: new Date().toISOString() }).eq('id', toggle.dataset.billId).eq('user_id', user.id);
          if (result.error) throw result.error;
          await loadData(); msg(toggle.dataset.billToggle === 'paused' ? 'Jadwal tagihan dijeda. Riwayat pembayaran tetap tersimpan.' : 'Jadwal tagihan diaktifkan kembali.');
        } catch (error) { msg(`Gagal mengubah jadwal: ${error.message}`, true); }
        return;
      }
      const button = event.target.closest('[data-bill-action]');
      if (button) prefillBillPayment(button.dataset.billId, button.dataset.billAction);
    });
    document.querySelectorAll('.side-nav a,.mobile-dock a').forEach(link => link.addEventListener('click', () => {
      document.querySelectorAll('.side-nav a').forEach(item => item.classList.toggle('active', item.getAttribute('href') === link.getAttribute('href')));
      document.querySelectorAll('.mobile-dock a').forEach(item => item.classList.toggle('dock-active', item.getAttribute('href') === link.getAttribute('href')));
    }));

    loadConfig();
    if (sb) {
      sb.auth.getSession().then(({ data, error }) => {
        if (error) throw error;
        if (data?.session?.user) {
          user = data.session.user; showApp(); loadData();
        }
      }).catch(error => console.warn('Sesi belum dipulihkan:', error.message));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
