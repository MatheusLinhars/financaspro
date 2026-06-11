/* ============================================
   FinançasPro — Application Logic
   ============================================ */

(function () {
  'use strict';

  // ─── State ───
  const STORAGE_KEY = 'corefinance_data';
  const PIN_KEY = 'corefinance_pin';
  const PIN_DISABLED_KEY = 'corefinance_pin_disabled';
  let state = loadState();
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  let chartCategoria = null;
  let chartPagamento = null;
  let chartComparar = null;
  let depositTargetId = null;
  let pinInput = '';
  let pinMode = 'login';
  let pendingNewPin = '';
  // Comparison state
  let cmpAMonth = new Date().getMonth();
  let cmpAYear = new Date().getFullYear();
  let cmpBMonth = new Date().getMonth() > 0 ? new Date().getMonth() - 1 : 11;
  let cmpBYear = new Date().getMonth() > 0 ? new Date().getFullYear() : new Date().getFullYear() - 1;

  function defaultState() {
    return {
      receitas: [],
      despesas: [],
      investimentos: [],
      metas: [],
      customFontes: [],
      creditCards: [],
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...defaultState(), ...parsed };
      }
    } catch (e) {
      console.error('Error loading state:', e);
    }
    return defaultState();
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  // ─── Formatting ───
  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function getMonthLabel(month, year) {
    const d = new Date(year, month);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  function isInMonth(dateStr, month, year) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  }

  // ─── Toast ───
  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
    toast.innerHTML = `<i data-lucide="${iconName}"></i><span>${message}</span>`;
    container.appendChild(toast);
    lucide.createIcons({ nodes: [toast] });
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ─── Navigation ───
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.content-section');
  const pageTitle = document.getElementById('pageTitle');
  const sectionTitles = {
    dashboard: 'Dashboard',
    receitas: 'Receitas',
    despesas: 'Despesas',
    faturas: 'Faturas',
    investimentos: 'Investimentos',
    metas: 'Metas Financeiras',
  };

  function navigateTo(sectionId) {
    navItems.forEach(n => n.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    const navBtn = document.querySelector(`[data-section="${sectionId}"]`);
    const sectionEl = document.getElementById(`section-${sectionId}`);
    if (navBtn) navBtn.classList.add('active');
    if (sectionEl) sectionEl.classList.add('active');
    pageTitle.textContent = sectionTitles[sectionId] || sectionId;
    closeSidebar();
  }

  navItems.forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.section));
  });

  // ─── Sidebar Toggle ───
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const menuToggle = document.getElementById('menuToggle');
  const sidebarClose = document.getElementById('sidebarClose');

  function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  }

  menuToggle.addEventListener('click', openSidebar);
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  // ─── Month Navigation ───
  const monthLabel = document.getElementById('currentMonthLabel');
  const monthBadge = document.getElementById('monthBadge');

  function updateMonthDisplay() {
    const label = getMonthLabel(currentMonth, currentYear);
    monthLabel.textContent = label;
    monthBadge.textContent = label;
  }

  document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    updateMonthDisplay();
    refreshAll();
  });

  document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    updateMonthDisplay();
    refreshAll();
  });

  // ─── RECEITAS ───
  const btnAddReceita = document.getElementById('btnAddReceita');
  const formReceita = document.getElementById('formReceita');
  const receitaForm = document.getElementById('receitaForm');
  const btnCancelReceita = document.getElementById('btnCancelReceita');
  const receitaFonte = document.getElementById('receitaFonte');
  const customFonteGroup = document.getElementById('customFonteGroup');
  const receitaFonteCustom = document.getElementById('receitaFonteCustom');
  const receitaEditId = document.getElementById('receitaEditId');

  btnAddReceita.addEventListener('click', () => {
    receitaEditId.value = '';
    receitaForm.reset();
    document.getElementById('receitaData').value = todayStr();
    formReceita.classList.remove('hidden');
    customFonteGroup.classList.add('hidden');
    updateReceitaFonteOptions();
  });

  btnCancelReceita.addEventListener('click', () => {
    formReceita.classList.add('hidden');
    receitaForm.reset();
  });

  receitaFonte.addEventListener('change', () => {
    if (receitaFonte.value === '__custom__') {
      customFonteGroup.classList.remove('hidden');
      receitaFonteCustom.focus();
    } else {
      customFonteGroup.classList.add('hidden');
    }
  });

  function updateReceitaFonteOptions() {
    // Rebuild select options with custom fonts
    const currentVal = receitaFonte.value;
    const defaults = ['Salário', 'Vale Refeição', 'BlaBlaCar'];
    const allFontes = [...defaults, ...state.customFontes];

    // Clear
    receitaFonte.innerHTML = '<option value="">Selecione...</option>';
    allFontes.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      receitaFonte.appendChild(opt);
    });
    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '+ Outra Receita...';
    receitaFonte.appendChild(customOpt);

    if (currentVal) receitaFonte.value = currentVal;
  }

  receitaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let fonte = receitaFonte.value;
    if (fonte === '__custom__') {
      fonte = receitaFonteCustom.value.trim();
      if (!fonte) {
        showToast('Informe o nome da fonte de receita.', 'error');
        return;
      }
      if (!state.customFontes.includes(fonte)) {
        state.customFontes.push(fonte);
      }
    }

    const data = {
      id: receitaEditId.value || generateId(),
      valor: parseFloat(document.getElementById('receitaValor').value),
      fonte,
      data: document.getElementById('receitaData').value,
      descricao: document.getElementById('receitaDescricao').value.trim(),
    };

    if (receitaEditId.value) {
      const idx = state.receitas.findIndex(r => r.id === receitaEditId.value);
      if (idx >= 0) state.receitas[idx] = data;
      showToast('Receita atualizada!');
    } else {
      state.receitas.push(data);
      showToast('Receita adicionada!');
    }

    saveState();
    formReceita.classList.add('hidden');
    receitaForm.reset();
    refreshAll();
  });

  function renderReceitas() {
    const body = document.getElementById('receitasBody');
    const empty = document.getElementById('receitasEmpty');
    const filtered = state.receitas
      .filter(r => isInMonth(r.data, currentMonth, currentYear))
      .sort((a, b) => b.data.localeCompare(a.data));

    body.innerHTML = '';
    if (filtered.length === 0) {
      empty.style.display = 'block';
      document.getElementById('receitasTable').style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    document.getElementById('receitasTable').style.display = 'table';

    filtered.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(r.data)}</td>
        <td><span class="badge badge-pix">${r.fonte}</span></td>
        <td>${r.descricao || '—'}</td>
        <td class="text-right value-positive">${formatCurrency(r.valor)}</td>
        <td class="text-center">
          <button class="btn-icon edit" data-id="${r.id}" title="Editar"><i data-lucide="pencil"></i></button>
          <button class="btn-icon delete" data-id="${r.id}" title="Excluir"><i data-lucide="trash-2"></i></button>
        </td>
      `;
      body.appendChild(tr);
    });

    body.querySelectorAll('.edit').forEach(btn => {
      btn.addEventListener('click', () => editReceita(btn.dataset.id));
    });
    body.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteReceita(btn.dataset.id));
    });

    lucide.createIcons({ nodes: [body] });
    renderReceitaTags();
  }

  function editReceita(id) {
    const r = state.receitas.find(x => x.id === id);
    if (!r) return;
    updateReceitaFonteOptions();
    receitaEditId.value = r.id;
    document.getElementById('receitaValor').value = r.valor;
    receitaFonte.value = r.fonte;
    document.getElementById('receitaData').value = r.data;
    document.getElementById('receitaDescricao').value = r.descricao || '';
    customFonteGroup.classList.add('hidden');
    formReceita.classList.remove('hidden');
    formReceita.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function deleteReceita(id) {
    if (!confirm('Excluir esta receita?')) return;
    state.receitas = state.receitas.filter(r => r.id !== id);
    saveState();
    showToast('Receita excluída.', 'info');
    refreshAll();
  }

  function renderReceitaTags() {
    const container = document.getElementById('receitaTagsList');
    const defaults = ['Salário', 'Vale Refeição', 'BlaBlaCar'];
    const all = [...defaults, ...state.customFontes];
    container.innerHTML = '';
    all.forEach(tag => {
      const isCustom = state.customFontes.includes(tag);
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${tag}${isCustom ? `<button class="tag-remove" data-tag="${tag}"><i data-lucide="x"></i></button>` : ''}`;
      container.appendChild(chip);
    });
    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        state.customFontes = state.customFontes.filter(t => t !== btn.dataset.tag);
        saveState();
        renderReceitaTags();
        updateReceitaFonteOptions();
        showToast('Tag removida.', 'info');
      });
    });
    lucide.createIcons({ nodes: [container] });
  }

  // ─── DESPESAS ───
  const btnAddDespesa = document.getElementById('btnAddDespesa');
  const formDespesa = document.getElementById('formDespesa');
  const despesaForm = document.getElementById('despesaForm');
  const btnCancelDespesa = document.getElementById('btnCancelDespesa');
  const despesaPagamento = document.getElementById('despesaPagamento');
  const despesaEditId = document.getElementById('despesaEditId');

  btnAddDespesa.addEventListener('click', () => {
    despesaEditId.value = '';
    despesaForm.reset();
    document.getElementById('despesaData').value = todayStr();
    updatePagamentoOptions();
    formDespesa.classList.remove('hidden');
  });

  btnCancelDespesa.addEventListener('click', () => {
    formDespesa.classList.add('hidden');
    despesaForm.reset();
    document.getElementById('parcelasGroup').classList.add('hidden');
  });

  function updatePagamentoOptions() {
    const currentVal = despesaPagamento.value;
    despesaPagamento.innerHTML = `
      <option value="">Selecione...</option>
      <option value="PIX">PIX</option>
      <option value="Débito">Débito</option>
      <option value="Vale Refeição">Vale Refeição</option>
    `;
    state.creditCards.forEach(card => {
      const opt = document.createElement('option');
      opt.value = `Crédito - ${card}`;
      opt.textContent = `Crédito - ${card}`;
      despesaPagamento.appendChild(opt);
    });
    if (currentVal) despesaPagamento.value = currentVal;

    // Show/hide parcelas based on current value
    toggleParcelasGroup(despesaPagamento.value);
  }

  function toggleParcelasGroup(pagValue) {
    const parcelasGroup = document.getElementById('parcelasGroup');
    if (pagValue && pagValue.startsWith('Crédito')) {
      parcelasGroup.classList.remove('hidden');
    } else {
      parcelasGroup.classList.add('hidden');
      document.getElementById('despesaParcelas').value = '1';
    }
  }

  despesaPagamento.addEventListener('change', () => {
    toggleParcelasGroup(despesaPagamento.value);
  });

  despesaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const totalValor = parseFloat(document.getElementById('despesaValor').value);
    const parcelas = parseInt(document.getElementById('despesaParcelas').value) || 1;
    const pagamento = despesaPagamento.value;
    const isParceled = pagamento.startsWith('Crédito') && parcelas > 1;
    const dataStr = document.getElementById('despesaData').value;
    const descricao = document.getElementById('despesaDescricao').value.trim();
    const categoria = document.getElementById('despesaCategoria').value;

    // If editing, remove old entries (including group if parcelada)
    if (despesaEditId.value) {
      const existing = state.despesas.find(d => d.id === despesaEditId.value);
      if (existing && existing.grupoId) {
        // Remove all entries from this group
        state.despesas = state.despesas.filter(d => d.grupoId !== existing.grupoId);
      } else if (existing) {
        state.despesas = state.despesas.filter(d => d.id !== despesaEditId.value);
      }
    }

    if (isParceled) {
      // Split across months
      const grupoId = despesaEditId.value ? (state.despesas.find(d => d.id === despesaEditId.value)?.grupoId || generateId()) : generateId();
      const valorParcela = Math.round((totalValor / parcelas) * 100) / 100;
      const [year, month, day] = dataStr.split('-').map(Number);

      for (let i = 0; i < parcelas; i++) {
        const d = new Date(year, month - 1 + i, day);
        const parcelaDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        state.despesas.push({
          id: generateId(),
          valor: valorParcela,
          descricao,
          categoria,
          pagamento,
          parcelas,
          parcelaNum: i + 1,
          grupoId,
          data: parcelaDateStr,
        });
      }
      showToast(`${parcelas}x de ${formatCurrency(valorParcela)} lançado nos próximos ${parcelas} meses!`);
    } else {
      state.despesas.push({
        id: despesaEditId.value || generateId(),
        valor: totalValor,
        descricao,
        categoria,
        pagamento,
        parcelas: 1,
        data: dataStr,
      });
      showToast(despesaEditId.value ? 'Despesa atualizada!' : 'Despesa registrada!');
    }

    saveState();
    formDespesa.classList.add('hidden');
    despesaForm.reset();
    document.getElementById('parcelasGroup').classList.add('hidden');
    refreshAll();
  });

  function renderDespesas() {
    const body = document.getElementById('despesasBody');
    const empty = document.getElementById('despesasEmpty');
    const filtered = state.despesas
      .filter(d => isInMonth(d.data, currentMonth, currentYear))
      .sort((a, b) => b.data.localeCompare(a.data));

    body.innerHTML = '';
    if (filtered.length === 0) {
      empty.style.display = 'block';
      document.getElementById('despesasTable').style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    document.getElementById('despesasTable').style.display = 'table';

    filtered.forEach(d => {
      const catClass = d.categoria === 'Fixo' ? 'badge-fixo' : d.categoria === 'Necessário' ? 'badge-necessario' : 'badge-lazer';
      let pagClass = 'badge-pix';
      if (d.pagamento === 'Débito') pagClass = 'badge-debito';
      else if (d.pagamento.startsWith('Crédito')) pagClass = 'badge-credito';
      else if (d.pagamento === 'Vale Refeição') pagClass = 'badge-vale';

      const parcelaTag = d.grupoId
        ? `<span class="badge-parcelas">${d.parcelaNum}/${d.parcelas}</span>`
        : (d.parcelas && d.parcelas > 1 ? `<span class="badge-parcelas">${d.parcelas}x</span>` : '');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(d.data)}</td>
        <td>${d.descricao}</td>
        <td class="hide-xs"><span class="badge ${catClass}">${d.categoria}</span></td>
        <td><span class="badge ${pagClass}">${d.pagamento}</span>${parcelaTag}</td>
        <td class="text-right value-negative">${formatCurrency(d.valor)}</td>
        <td class="text-center">
          <button class="btn-icon edit" data-id="${d.id}" title="Editar"><i data-lucide="pencil"></i></button>
          <button class="btn-icon delete" data-id="${d.id}" title="Excluir"><i data-lucide="trash-2"></i></button>
        </td>
      `;
      body.appendChild(tr);
    });

    body.querySelectorAll('.edit').forEach(btn => {
      btn.addEventListener('click', () => editDespesa(btn.dataset.id));
    });
    body.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteDespesa(btn.dataset.id));
    });

    lucide.createIcons({ nodes: [body] });
  }

  function editDespesa(id) {
    const d = state.despesas.find(x => x.id === id);
    if (!d) return;
    updatePagamentoOptions();
    despesaEditId.value = d.id;
    document.getElementById('despesaValor').value = d.valor;
    document.getElementById('despesaDescricao').value = d.descricao;
    document.getElementById('despesaCategoria').value = d.categoria;
    despesaPagamento.value = d.pagamento;
    document.getElementById('despesaParcelas').value = d.parcelas || 1;
    toggleParcelasGroup(d.pagamento);
    document.getElementById('despesaData').value = d.data;
    formDespesa.classList.remove('hidden');
    formDespesa.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function deleteDespesa(id) {
    const d = state.despesas.find(x => x.id === id);
    if (!d) return;

    if (d.grupoId) {
      const grupo = state.despesas.filter(x => x.grupoId === d.grupoId);
      const futuras = grupo.filter(x => x.parcelaNum >= d.parcelaNum);
      const choice = confirm(`Esta é a parcela ${d.parcelaNum}/${d.parcelas}.\n\nClicar OK exclui esta e todas as próximas parcelas (${futuras.length}x).\nClicar Cancelar exclui apenas esta parcela.`);
      if (choice) {
        // Delete this and all future installments
        state.despesas = state.despesas.filter(x => !(x.grupoId === d.grupoId && x.parcelaNum >= d.parcelaNum));
        showToast(`${futuras.length} parcela(s) excluída(s).`, 'info');
      } else {
        state.despesas = state.despesas.filter(x => x.id !== id);
        showToast('Parcela excluída.', 'info');
      }
    } else {
      if (!confirm('Excluir esta despesa?')) return;
      state.despesas = state.despesas.filter(x => x.id !== id);
      showToast('Despesa excluída.', 'info');
    }

    saveState();
    refreshAll();
  }

  // ─── Credit Cards ───
  const btnAddCard = document.getElementById('btnAddCard');
  const newCardName = document.getElementById('newCardName');

  btnAddCard.addEventListener('click', () => {
    const name = newCardName.value.trim();
    if (!name) {
      showToast('Informe o nome do cartão.', 'error');
      return;
    }
    if (state.creditCards.includes(name)) {
      showToast('Cartão já cadastrado.', 'error');
      return;
    }
    state.creditCards.push(name);
    saveState();
    newCardName.value = '';
    renderCreditCards();
    updatePagamentoOptions();
    showToast(`Cartão "${name}" adicionado!`);
  });

  function renderCreditCards() {
    const container = document.getElementById('creditCardsList');
    container.innerHTML = '';
    state.creditCards.forEach(card => {
      const chip = document.createElement('span');
      chip.className = 'card-chip';
      chip.innerHTML = `💳 ${card} <button class="card-remove" data-card="${card}"><i data-lucide="x"></i></button>`;
      container.appendChild(chip);
    });
    container.querySelectorAll('.card-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm(`Remover o cartão "${btn.dataset.card}"?`)) return;
        state.creditCards = state.creditCards.filter(c => c !== btn.dataset.card);
        saveState();
        renderCreditCards();
        updatePagamentoOptions();
        showToast('Cartão removido.', 'info');
      });
    });
    lucide.createIcons({ nodes: [container] });
  }

  // ─── INVESTIMENTOS ───
  const btnAddInvestimento = document.getElementById('btnAddInvestimento');
  const formInvestimento = document.getElementById('formInvestimento');
  const investimentoForm = document.getElementById('investimentoForm');
  const btnCancelInvest = document.getElementById('btnCancelInvest');
  const investEditId = document.getElementById('investEditId');

  btnAddInvestimento.addEventListener('click', () => {
    investEditId.value = '';
    investimentoForm.reset();
    document.getElementById('investData').value = todayStr();
    formInvestimento.classList.remove('hidden');
  });

  btnCancelInvest.addEventListener('click', () => {
    formInvestimento.classList.add('hidden');
    investimentoForm.reset();
  });

  investimentoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      id: investEditId.value || generateId(),
      nome: document.getElementById('investNome').value.trim(),
      valor: parseFloat(document.getElementById('investValor').value),
      data: document.getElementById('investData').value,
      descricao: document.getElementById('investDescricao').value.trim(),
    };

    if (investEditId.value) {
      const idx = state.investimentos.findIndex(i => i.id === investEditId.value);
      if (idx >= 0) state.investimentos[idx] = data;
      showToast('Aporte atualizado!');
    } else {
      state.investimentos.push(data);
      showToast('Aporte registrado!');
    }

    saveState();
    formInvestimento.classList.add('hidden');
    investimentoForm.reset();
    refreshAll();
  });

  function renderInvestimentos() {
    const body = document.getElementById('investBody');
    const empty = document.getElementById('investEmpty');
    const summaryDiv = document.getElementById('investSummary');
    const sorted = [...state.investimentos].sort((a, b) => b.data.localeCompare(a.data));

    body.innerHTML = '';
    if (sorted.length === 0) {
      empty.style.display = 'block';
      document.getElementById('investTable').style.display = 'none';
      summaryDiv.innerHTML = '';
      return;
    }
    empty.style.display = 'none';
    document.getElementById('investTable').style.display = 'table';

    sorted.forEach(inv => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(inv.data)}</td>
        <td>${inv.nome}</td>
        <td>${inv.descricao || '—'}</td>
        <td class="text-right" style="color: var(--accent-yellow); font-weight: 600;">${formatCurrency(inv.valor)}</td>
        <td class="text-center">
          <button class="btn-icon edit" data-id="${inv.id}" title="Editar"><i data-lucide="pencil"></i></button>
          <button class="btn-icon delete" data-id="${inv.id}" title="Excluir"><i data-lucide="trash-2"></i></button>
        </td>
      `;
      body.appendChild(tr);
    });

    body.querySelectorAll('.edit').forEach(btn => {
      btn.addEventListener('click', () => editInvestimento(btn.dataset.id));
    });
    body.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteInvestimento(btn.dataset.id));
    });

    // Summary cards by investment name
    const totals = {};
    state.investimentos.forEach(inv => {
      totals[inv.nome] = (totals[inv.nome] || 0) + inv.valor;
    });

    summaryDiv.innerHTML = '';
    Object.entries(totals).sort((a, b) => b[1] - a[1]).forEach(([nome, total]) => {
      const card = document.createElement('div');
      card.className = 'invest-card';
      card.innerHTML = `<h4>${nome}</h4><div class="invest-total">${formatCurrency(total)}</div>`;
      summaryDiv.appendChild(card);
    });

    lucide.createIcons({ nodes: [body] });
  }

  function editInvestimento(id) {
    const inv = state.investimentos.find(x => x.id === id);
    if (!inv) return;
    investEditId.value = inv.id;
    document.getElementById('investNome').value = inv.nome;
    document.getElementById('investValor').value = inv.valor;
    document.getElementById('investData').value = inv.data;
    document.getElementById('investDescricao').value = inv.descricao || '';
    formInvestimento.classList.remove('hidden');
    formInvestimento.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function deleteInvestimento(id) {
    if (!confirm('Excluir este aporte?')) return;
    state.investimentos = state.investimentos.filter(i => i.id !== id);
    saveState();
    showToast('Aporte excluído.', 'info');
    refreshAll();
  }

  // ─── METAS ───
  const btnAddMeta = document.getElementById('btnAddMeta');
  const formMeta = document.getElementById('formMeta');
  const metaForm = document.getElementById('metaForm');
  const btnCancelMeta = document.getElementById('btnCancelMeta');
  const metaEditId = document.getElementById('metaEditId');

  const emojiMap = {
    car: '🚗',
    home: '🏠',
    plane: '✈️',
    shield: '🛡️',
    graduation: '🎓',
    gift: '🎁',
  };

  btnAddMeta.addEventListener('click', () => {
    metaEditId.value = '';
    metaForm.reset();
    formMeta.classList.remove('hidden');
  });

  btnCancelMeta.addEventListener('click', () => {
    formMeta.classList.add('hidden');
    metaForm.reset();
  });

  metaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      id: metaEditId.value || generateId(),
      nome: document.getElementById('metaNome').value.trim(),
      alvo: parseFloat(document.getElementById('metaAlvo').value),
      atual: parseFloat(document.getElementById('metaAtual').value),
      icone: document.getElementById('metaIcone').value,
    };

    if (metaEditId.value) {
      const idx = state.metas.findIndex(m => m.id === metaEditId.value);
      if (idx >= 0) state.metas[idx] = data;
      showToast('Meta atualizada!');
    } else {
      state.metas.push(data);
      showToast('Meta criada!');
    }

    saveState();
    formMeta.classList.add('hidden');
    metaForm.reset();
    renderMetas();
  });

  function renderMetas() {
    const grid = document.getElementById('goalsGrid');
    const empty = document.getElementById('metasEmpty');

    if (state.metas.length === 0) {
      grid.innerHTML = '';
      grid.appendChild(empty);
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    grid.innerHTML = '';

    state.metas.forEach(m => {
      const pct = Math.min(100, (m.atual / m.alvo) * 100);
      const isCompleted = pct >= 100;
      const card = document.createElement('div');
      card.className = 'goal-card';
      card.innerHTML = `
        <div class="goal-header">
          <div class="goal-header-left">
            <span class="goal-emoji">${emojiMap[m.icone] || '🎯'}</span>
            <span class="goal-name">${m.nome}</span>
          </div>
          <div class="goal-header-actions">
            <button class="btn-icon deposit" data-id="${m.id}" title="Depositar"><i data-lucide="plus-circle"></i></button>
            <button class="btn-icon edit" data-id="${m.id}" title="Editar"><i data-lucide="pencil"></i></button>
            <button class="btn-icon delete" data-id="${m.id}" title="Excluir"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
        <div class="goal-amounts">
          <span class="goal-current">${formatCurrency(m.atual)}</span>
          <span class="goal-target">de ${formatCurrency(m.alvo)}</span>
        </div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill ${isCompleted ? 'completed' : ''}" style="width: ${pct}%"></div>
        </div>
        <div class="goal-percentage ${isCompleted ? 'completed' : ''}">${pct.toFixed(1)}% ${isCompleted ? '✓ Concluída!' : ''}</div>
      `;
      grid.appendChild(card);
    });

    grid.querySelectorAll('.deposit').forEach(btn => {
      btn.addEventListener('click', () => openDepositModal(btn.dataset.id));
    });
    grid.querySelectorAll('.edit').forEach(btn => {
      btn.addEventListener('click', () => editMeta(btn.dataset.id));
    });
    grid.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteMeta(btn.dataset.id));
    });

    lucide.createIcons({ nodes: [grid] });
  }

  function editMeta(id) {
    const m = state.metas.find(x => x.id === id);
    if (!m) return;
    metaEditId.value = m.id;
    document.getElementById('metaNome').value = m.nome;
    document.getElementById('metaAlvo').value = m.alvo;
    document.getElementById('metaAtual').value = m.atual;
    document.getElementById('metaIcone').value = m.icone;
    formMeta.classList.remove('hidden');
    formMeta.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function deleteMeta(id) {
    if (!confirm('Excluir esta meta?')) return;
    state.metas = state.metas.filter(m => m.id !== id);
    saveState();
    showToast('Meta excluída.', 'info');
    renderMetas();
  }

  // Deposit Modal
  const depositModal = document.getElementById('depositModal');
  const btnCancelDeposit = document.getElementById('btnCancelDeposit');
  const btnConfirmDeposit = document.getElementById('btnConfirmDeposit');
  const depositValor = document.getElementById('depositValor');
  const depositGoalName = document.getElementById('depositGoalName');

  function openDepositModal(id) {
    const m = state.metas.find(x => x.id === id);
    if (!m) return;
    depositTargetId = id;
    depositGoalName.textContent = `Meta: ${m.nome}`;
    depositValor.value = '';
    depositModal.classList.remove('hidden');
    lucide.createIcons({ nodes: [depositModal] });
    depositValor.focus();
  }

  btnCancelDeposit.addEventListener('click', () => {
    depositModal.classList.add('hidden');
    depositTargetId = null;
  });

  btnConfirmDeposit.addEventListener('click', () => {
    const val = parseFloat(depositValor.value);
    if (!val || val <= 0) {
      showToast('Informe um valor válido.', 'error');
      return;
    }
    const m = state.metas.find(x => x.id === depositTargetId);
    if (m) {
      m.atual += val;
      saveState();
      showToast(`${formatCurrency(val)} depositado em "${m.nome}"!`);
    }
    depositModal.classList.add('hidden');
    depositTargetId = null;
    renderMetas();
  });

  depositModal.addEventListener('click', (e) => {
    if (e.target === depositModal) {
      depositModal.classList.add('hidden');
      depositTargetId = null;
    }
  });

  // ─── DASHBOARD ───
  function renderDashboard() {
    const receitasMes = state.receitas.filter(r => isInMonth(r.data, currentMonth, currentYear));
    const despesasMes = state.despesas.filter(d => isInMonth(d.data, currentMonth, currentYear));

    const totalRec = receitasMes.reduce((s, r) => s + r.valor, 0);
    const totalDesp = despesasMes.reduce((s, d) => s + d.valor, 0);
    const totalInv = state.investimentos.reduce((s, i) => s + i.valor, 0);

    document.getElementById('totalReceitas').textContent = formatCurrency(totalRec);
    document.getElementById('totalDespesas').textContent = formatCurrency(totalDesp);
    document.getElementById('totalBalanco').textContent = formatCurrency(totalRec - totalDesp);
    document.getElementById('totalInvestido').textContent = formatCurrency(totalInv);

    // Balance color
    const balEl = document.getElementById('totalBalanco');
    balEl.style.color = (totalRec - totalDesp) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

    // Charts
    renderChartCategoria(despesasMes);
    renderChartPagamento(despesasMes);

    // Recent transactions
    renderRecent(receitasMes, despesasMes);
  }

  function renderChartCategoria(despesas) {
    const canvas = document.getElementById('chartCategoria');
    const emptyMsg = document.getElementById('chartCategoriaEmpty');
    const totals = { 'Fixo': 0, 'Necessário': 0, 'Lazer': 0 };
    despesas.forEach(d => { totals[d.categoria] = (totals[d.categoria] || 0) + d.valor; });

    const labels = Object.keys(totals).filter(k => totals[k] > 0);
    const data = labels.map(l => totals[l]);

    if (data.length === 0) {
      canvas.style.display = 'none';
      emptyMsg.style.display = 'block';
      if (chartCategoria) { chartCategoria.destroy(); chartCategoria = null; }
      return;
    }
    canvas.style.display = 'block';
    emptyMsg.style.display = 'none';

    if (chartCategoria) chartCategoria.destroy();
    chartCategoria = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: ['#818cf8', '#22d3ee', '#c084fc'],
          borderColor: '#1a2235',
          borderWidth: 3,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#8b95a8',
              font: { family: 'Inter', size: 12, weight: 500 },
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          tooltip: {
            backgroundColor: '#232e45',
            titleColor: '#f0f2f5',
            bodyColor: '#f0f2f5',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleFont: { family: 'Inter', weight: 600 },
            bodyFont: { family: 'Inter' },
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`,
            },
          },
        },
      },
    });
  }

  function renderChartPagamento(despesas) {
    const canvas = document.getElementById('chartPagamento');
    const emptyMsg = document.getElementById('chartPagamentoEmpty');
    const totals = {};
    despesas.forEach(d => {
      const key = d.pagamento.startsWith('Crédito') ? 'Crédito' : d.pagamento;
      totals[key] = (totals[key] || 0) + d.valor;
    });

    const labels = Object.keys(totals).filter(k => totals[k] > 0);
    const data = labels.map(l => totals[l]);

    if (data.length === 0) {
      canvas.style.display = 'none';
      emptyMsg.style.display = 'block';
      if (chartPagamento) { chartPagamento.destroy(); chartPagamento = null; }
      return;
    }
    canvas.style.display = 'block';
    emptyMsg.style.display = 'none';

    const colorMap = {
      'PIX': '#4ade80',
      'Débito': '#60a5fa',
      'Crédito': '#c084fc',
      'Vale Refeição': '#fbbf24',
    };
    const colors = labels.map(l => colorMap[l] || '#94a3b8');

    if (chartPagamento) chartPagamento.destroy();
    chartPagamento = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.map(c => c + '33'),
          borderColor: colors,
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#232e45',
            titleColor: '#f0f2f5',
            bodyColor: '#f0f2f5',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleFont: { family: 'Inter', weight: 600 },
            bodyFont: { family: 'Inter' },
            callbacks: {
              label: (ctx) => ` ${formatCurrency(ctx.raw)}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#8b95a8', font: { family: 'Inter', size: 12 } },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            ticks: {
              color: '#5a6478',
              font: { family: 'Inter', size: 11 },
              callback: (v) => formatCurrency(v),
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
            border: { display: false },
          },
        },
      },
    });
  }

  function renderRecent(receitas, despesas) {
    const container = document.getElementById('recentList');
    const all = [
      ...receitas.map(r => ({ ...r, type: 'income' })),
      ...despesas.map(d => ({ ...d, type: 'expense' })),
    ].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);

    if (all.length === 0) {
      container.innerHTML = '<p class="empty-state">Nenhuma movimentação registrada.</p>';
      return;
    }

    container.innerHTML = '';
    all.forEach(item => {
      const div = document.createElement('div');
      div.className = 'recent-item';
      const isIncome = item.type === 'income';
      div.innerHTML = `
        <div class="recent-icon ${isIncome ? 'income' : 'expense'}">
          <i data-lucide="${isIncome ? 'arrow-up-right' : 'arrow-down-right'}"></i>
        </div>
        <div class="recent-info">
          <div class="recent-desc">${isIncome ? item.fonte : item.descricao}</div>
          <div class="recent-date">${formatDate(item.data)}</div>
        </div>
        <div class="recent-amount ${isIncome ? 'value-positive' : 'value-negative'}">
          ${isIncome ? '+' : '-'} ${formatCurrency(item.valor)}
        </div>
      `;
      container.appendChild(div);
    });

    lucide.createIcons({ nodes: [container] });
  }

  // ─── Helpers ───
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ─── FATURAS ───
  function renderFaturas() {
    const container = document.getElementById('faturasContainer');
    const emptyMsg = document.getElementById('faturasEmpty');

    if (state.creditCards.length === 0) {
      container.innerHTML = '';
      container.appendChild(emptyMsg);
      emptyMsg.style.display = 'block';
      return;
    }

    const cardData = {};
    state.creditCards.forEach(card => {
      const key = `Crédito - ${card}`;
      cardData[card] = state.despesas
        .filter(d => d.pagamento === key)
        .sort((a, b) => b.data.localeCompare(a.data));
    });

    const hasAny = Object.values(cardData).some(arr => arr.length > 0);
    emptyMsg.style.display = 'none';
    container.innerHTML = '';

    if (!hasAny) {
      emptyMsg.style.display = 'block';
      container.appendChild(emptyMsg);
      return;
    }

    state.creditCards.forEach(card => {
      const despesasCard = cardData[card];
      if (despesasCard.length === 0) return;

      const total = despesasCard.reduce((s, d) => s + d.valor, 0);

      // Group by month/year
      const byMonth = {};
      despesasCard.forEach(d => {
        const key = d.data.substring(0, 7);
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(d);
      });

      const cardEl = document.createElement('div');
      cardEl.className = 'fatura-card';

      const monthsHtml = Object.keys(byMonth).sort((a, b) => b.localeCompare(a)).map(monthKey => {
        const [y, m] = monthKey.split('-').map(Number);
        const mlabel = new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const monthTotal = byMonth[monthKey].reduce((s, d) => s + d.valor, 0);
        const rows = byMonth[monthKey].map(d => {
          const parcelaTag = d.grupoId
            ? `<span class="badge-parcelas">${d.parcelaNum}/${d.parcelas}</span>`
            : '';
          return `
            <div class="fatura-row">
              <span class="fatura-date">${formatDate(d.data)}</span>
              <span class="fatura-desc">${d.descricao}${parcelaTag}</span>
              <span class="fatura-valor">${formatCurrency(d.valor)}</span>
            </div>`;
        }).join('');

        return `
          <div class="fatura-month-block">
            <div class="fatura-month-header">
              <span class="fatura-month-name">${mlabel.charAt(0).toUpperCase() + mlabel.slice(1)}</span>
              <span class="fatura-month-total">Total: ${formatCurrency(monthTotal)}</span>
            </div>
            <div class="fatura-rows">${rows}</div>
          </div>`;
      }).join('');

      cardEl.innerHTML = `
        <div class="fatura-card-header">
          <div class="fatura-card-title">
            <span class="fatura-card-icon">💳</span>
            <span class="fatura-card-name">${card}</span>
          </div>
          <div class="fatura-card-total">
            <span class="fatura-total-label">Total acumulado</span>
            <span class="fatura-total-valor">${formatCurrency(total)}</span>
          </div>
        </div>
        <div class="fatura-months">${monthsHtml}</div>
      `;
      container.appendChild(cardEl);
    });
  }

  // ─── COMPARAR MESES ───
  function updateCmpLabels() {
    document.getElementById('cmpALabel').textContent = getMonthLabel(cmpAMonth, cmpAYear);
    document.getElementById('cmpBLabel').textContent = getMonthLabel(cmpBMonth, cmpBYear);
  }

  function renderComparar() {
    const recA = state.receitas.filter(r => isInMonth(r.data, cmpAMonth, cmpAYear));
    const despA = state.despesas.filter(d => isInMonth(d.data, cmpAMonth, cmpAYear));
    const recB = state.receitas.filter(r => isInMonth(r.data, cmpBMonth, cmpBYear));
    const despB = state.despesas.filter(d => isInMonth(d.data, cmpBMonth, cmpBYear));

    const totRecA = recA.reduce((s, r) => s + r.valor, 0);
    const totDespA = despA.reduce((s, d) => s + d.valor, 0);
    const totRecB = recB.reduce((s, r) => s + r.valor, 0);
    const totDespB = despB.reduce((s, d) => s + d.valor, 0);
    const balA = totRecA - totDespA;
    const balB = totRecB - totDespB;

    const labelA = getMonthLabel(cmpAMonth, cmpAYear);
    const labelB = getMonthLabel(cmpBMonth, cmpBYear);

    function diffArrow(a, b, reverse = false) {
      if (a === b) return '<span class="cmp-equal">—</span>';
      const better = reverse ? (a < b) : (a > b);
      const pct = b !== 0 ? Math.abs(((a - b) / b) * 100).toFixed(1) : '∞';
      return better
        ? `<span class="cmp-better">▲ ${pct}%</span>`
        : `<span class="cmp-worse">▼ ${pct}%</span>`;
    }

    const grid = document.getElementById('compareGrid');
    grid.innerHTML = `
      <div class="cmp-table-wrap">
        <table class="cmp-table">
          <thead>
            <tr>
              <th>Indicador</th>
              <th>${labelA.charAt(0).toUpperCase() + labelA.slice(1)}</th>
              <th>${labelB.charAt(0).toUpperCase() + labelB.slice(1)}</th>
              <th>Variação (A vs B)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="cmp-label income"><i data-lucide="trending-up"></i> Receitas</span></td>
              <td class="value-positive">${formatCurrency(totRecA)}</td>
              <td class="value-positive">${formatCurrency(totRecB)}</td>
              <td>${diffArrow(totRecA, totRecB)}</td>
            </tr>
            <tr>
              <td><span class="cmp-label expense"><i data-lucide="trending-down"></i> Despesas</span></td>
              <td class="value-negative">${formatCurrency(totDespA)}</td>
              <td class="value-negative">${formatCurrency(totDespB)}</td>
              <td>${diffArrow(totDespA, totDespB, true)}</td>
            </tr>
            <tr>
              <td><span class="cmp-label balance"><i data-lucide="scale"></i> Balanço</span></td>
              <td class="${balA >= 0 ? 'value-positive' : 'value-negative'}">${formatCurrency(balA)}</td>
              <td class="${balB >= 0 ? 'value-positive' : 'value-negative'}">${formatCurrency(balB)}</td>
              <td>${diffArrow(balA, balB)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    lucide.createIcons({ nodes: [grid] });

    // Chart
    const canvas = document.getElementById('chartComparar');
    if (chartComparar) { chartComparar.destroy(); chartComparar = null; }
    chartComparar = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Receitas', 'Despesas', 'Balanço'],
        datasets: [
          {
            label: labelA,
            data: [totRecA, totDespA, balA],
            backgroundColor: ['rgba(74,222,128,0.25)', 'rgba(248,113,113,0.25)', 'rgba(34,197,94,0.25)'],
            borderColor: ['#4ade80', '#f87171', '#22c55e'],
            borderWidth: 2,
            borderRadius: 8,
          },
          {
            label: labelB,
            data: [totRecB, totDespB, balB],
            backgroundColor: ['rgba(74,222,128,0.1)', 'rgba(248,113,113,0.1)', 'rgba(34,197,94,0.1)'],
            borderColor: ['#4ade8060', '#f8717160', '#22c55e60'],
            borderWidth: 2,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#8ba894', font: { family: 'Inter', size: 12 } } },
          tooltip: {
            backgroundColor: '#1a2a1d',
            titleColor: '#f0f5f1',
            bodyColor: '#f0f5f1',
            borderColor: 'rgba(34,197,94,0.2)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` },
          },
        },
        scales: {
          x: { ticks: { color: '#8ba894' }, grid: { display: false }, border: { display: false } },
          y: {
            ticks: { color: '#4f6655', callback: v => formatCurrency(v), font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
            border: { display: false },
          },
        },
      },
    });
  }

  function initComparar() {
    updateCmpLabels();

    function cmpNav(monthRef, yearRef, delta, setM, setY, update) {
      let m = monthRef() + delta;
      let y = yearRef();
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      setM(m); setY(y);
      updateCmpLabels();
      renderComparar();
    }

    document.getElementById('cmpAPrev').addEventListener('click', () =>
      cmpNav(() => cmpAMonth, () => cmpAYear, -1, m => cmpAMonth = m, y => cmpAYear = y));
    document.getElementById('cmpANext').addEventListener('click', () =>
      cmpNav(() => cmpAMonth, () => cmpAYear, +1, m => cmpAMonth = m, y => cmpAYear = y));
    document.getElementById('cmpBPrev').addEventListener('click', () =>
      cmpNav(() => cmpBMonth, () => cmpBYear, -1, m => cmpBMonth = m, y => cmpBYear = y));
    document.getElementById('cmpBNext').addEventListener('click', () =>
      cmpNav(() => cmpBMonth, () => cmpBYear, +1, m => cmpBMonth = m, y => cmpBYear = y));
  }

  function refreshAll() {
    renderDashboard();
    renderReceitas();
    renderDespesas();
    renderFaturas();
    renderInvestimentos();
    renderMetas();
    renderCreditCards();
    renderComparar();
  }


  // ─── PIN Security ───
  async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + 'corefinance_salt_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getStoredPinHash() {
    return localStorage.getItem(PIN_KEY);
  }

  function updatePinDots() {
    const dots = document.querySelectorAll('#pinDisplay .pin-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < pinInput.length);
      dot.classList.remove('error');
    });
  }

  function shakePin() {
    const dots = document.querySelectorAll('#pinDisplay .pin-dot');
    dots.forEach(dot => dot.classList.add('error'));
    setTimeout(() => dots.forEach(dot => dot.classList.remove('error')), 500);
  }

  function setLockSubtitle(text) {
    document.getElementById('lockSubtitle').textContent = text;
  }

  function showLockError(msg) {
    const el = document.getElementById('lockError');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideLockError() {
    document.getElementById('lockError').classList.add('hidden');
  }

  function unlockApp() {
    const lockScreen = document.getElementById('lockScreen');
    lockScreen.classList.add('unlocked');
    setTimeout(() => {
      lockScreen.classList.add('hidden');
      lockScreen.classList.remove('unlocked');
    }, 500);
  }

  function lockApp() {
    pinInput = '';
    pinMode = 'login';
    hideLockError();
    setLockSubtitle('Digite sua senha para acessar');
    updatePinDots();
    const lockScreen = document.getElementById('lockScreen');
    lockScreen.classList.remove('hidden', 'unlocked');
    lucide.createIcons({ nodes: [lockScreen] });
  }

  async function handlePinSubmit() {
    if (pinInput.length < 4) {
      showLockError('A senha deve ter 4 dígitos.');
      shakePin();
      return;
    }

    const hash = await hashPin(pinInput);

    switch (pinMode) {
      case 'setup':
        pendingNewPin = pinInput;
        pinInput = '';
        pinMode = 'confirm_setup';
        setLockSubtitle('Confirme sua nova senha');
        hideLockError();
        updatePinDots();
        break;

      case 'confirm_setup':
        if (pinInput === pendingNewPin) {
          const newHash = await hashPin(pinInput);
          localStorage.setItem(PIN_KEY, newHash);
          pendingNewPin = '';
          showToast('Senha criada com sucesso! 🔒');
          unlockApp();
        } else {
          showLockError('As senhas não coincidem. Tente novamente.');
          shakePin();
          pinInput = '';
          pinMode = 'setup';
          setLockSubtitle('Crie uma senha de 4 dígitos');
          updatePinDots();
        }
        break;

      case 'login':
        if (hash === getStoredPinHash()) {
          hideLockError();
          unlockApp();
        } else {
          showLockError('Senha incorreta. Tente novamente.');
          shakePin();
          pinInput = '';
          updatePinDots();
        }
        break;

      case 'change_old':
        if (hash === getStoredPinHash()) {
          pinInput = '';
          pinMode = 'change_new';
          setLockSubtitle('Digite a nova senha');
          hideLockError();
          updatePinDots();
        } else {
          showLockError('Senha atual incorreta.');
          shakePin();
          pinInput = '';
          updatePinDots();
        }
        break;

      case 'change_new':
        pendingNewPin = pinInput;
        pinInput = '';
        pinMode = 'change_confirm';
        setLockSubtitle('Confirme a nova senha');
        hideLockError();
        updatePinDots();
        break;

      case 'change_confirm':
        if (pinInput === pendingNewPin) {
          const newHash = await hashPin(pinInput);
          localStorage.setItem(PIN_KEY, newHash);
          pendingNewPin = '';
          pinInput = '';
          pinMode = 'login';
          showToast('Senha alterada com sucesso! 🔒');
          unlockApp();
        } else {
          showLockError('As senhas não coincidem. Tente novamente.');
          shakePin();
          pinInput = '';
          pinMode = 'change_new';
          setLockSubtitle('Digite a nova senha');
          updatePinDots();
        }
        break;
    }
  }

  function initLockScreen() {
    const lockScreen = document.getElementById('lockScreen');
    const storedHash = getStoredPinHash();
    const pinDisabled = localStorage.getItem(PIN_DISABLED_KEY) === 'true';

    // Update toggle button label
    function updateToggleBtnLabel() {
      const isDisabled = localStorage.getItem(PIN_DISABLED_KEY) === 'true';
      const label = document.getElementById('togglePinLabel');
      const btn = document.getElementById('btnTogglePin');
      if (isDisabled) {
        label.textContent = 'Ativar Senha';
        btn.querySelector('i').setAttribute('data-lucide', 'shield-check');
      } else {
        label.textContent = 'Desativar';
        btn.querySelector('i').setAttribute('data-lucide', 'shield-off');
      }
      lucide.createIcons({ nodes: [btn] });
    }
    updateToggleBtnLabel();

    if (pinDisabled) {
      // Skip lock screen entirely
      unlockApp();
    } else if (!storedHash) {
      pinMode = 'setup';
      setLockSubtitle('Crie uma senha de 4 dígitos');
      document.getElementById('btnSkipPin').classList.remove('hidden');
    } else {
      pinMode = 'login';
      setLockSubtitle('Digite sua senha para acessar');
      document.getElementById('btnSkipPin').classList.add('hidden');
    }

    document.getElementById('btnSkipPin').addEventListener('click', () => {
      localStorage.setItem(PIN_DISABLED_KEY, 'true');
      updateToggleBtnLabel();
      showToast('Acesso sem senha ativado.', 'info');
      unlockApp();
    });

    // Pin pad clicks
    document.querySelectorAll('.pin-key').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (key === 'clear') {
          pinInput = pinInput.slice(0, -1);
          hideLockError();
          updatePinDots();
        } else if (key === 'enter') {
          handlePinSubmit();
        } else {
          if (pinInput.length < 4) {
            pinInput += key;
            hideLockError();
            updatePinDots();
            // Auto-submit when 4 digits are entered
            if (pinInput.length === 4) {
              setTimeout(() => handlePinSubmit(), 100);
            }
          }
        }
      });
    });

    // Keyboard support
    document.addEventListener('keydown', (e) => {
      if (lockScreen.classList.contains('hidden')) return;
      if (e.key >= '0' && e.key <= '9') {
        if (pinInput.length < 4) {
          pinInput += e.key;
          hideLockError();
          updatePinDots();
          if (pinInput.length === 4) {
            setTimeout(() => handlePinSubmit(), 100);
          }
        }
      } else if (e.key === 'Backspace') {
        pinInput = pinInput.slice(0, -1);
        hideLockError();
        updatePinDots();
      } else if (e.key === 'Enter') {
        handlePinSubmit();
      }
    });

    // Lock button
    document.getElementById('btnLockApp').addEventListener('click', () => {
      if (localStorage.getItem(PIN_DISABLED_KEY) === 'true' || !getStoredPinHash()) {
        showToast('Nenhuma senha configurada para bloquear.', 'info');
        return;
      }
      lockApp();
      closeSidebar();
    });

    // Change PIN button
    document.getElementById('btnChangePin').addEventListener('click', () => {
      if (localStorage.getItem(PIN_DISABLED_KEY) === 'true' || !getStoredPinHash()) {
        showToast('Ative a senha primeiro para poder alterá-la.', 'info');
        return;
      }
      pinInput = '';
      pinMode = 'change_old';
      setLockSubtitle('Digite sua senha atual');
      hideLockError();
      updatePinDots();
      const lockScreen = document.getElementById('lockScreen');
      lockScreen.classList.remove('hidden', 'unlocked');
      lucide.createIcons({ nodes: [lockScreen] });
      closeSidebar();
    });
    // Toggle PIN button
    document.getElementById('btnTogglePin').addEventListener('click', () => {
      const isDisabled = localStorage.getItem(PIN_DISABLED_KEY) === 'true';
      if (isDisabled) {
        // Re-enable: go to setup flow
        localStorage.removeItem(PIN_DISABLED_KEY);
        localStorage.removeItem(PIN_KEY);
        pinInput = '';
        pinMode = 'setup';
        setLockSubtitle('Crie uma nova senha de 4 dígitos');
        hideLockError();
        updatePinDots();
        lockScreen.classList.remove('hidden', 'unlocked');
        lucide.createIcons({ nodes: [lockScreen] });
        showToast('Crie uma nova senha para ativar a proteção.', 'info');
      } else {
        localStorage.setItem(PIN_DISABLED_KEY, 'true');
        showToast('Senha desativada. O app abrirá sem senha.', 'info');
      }
      // Update label
      const isNowDisabled = localStorage.getItem(PIN_DISABLED_KEY) === 'true';
      const label = document.getElementById('togglePinLabel');
      const btn = document.getElementById('btnTogglePin');
      if (isNowDisabled) {
        label.textContent = 'Ativar Senha';
        btn.querySelector('i').setAttribute('data-lucide', 'shield-check');
      } else {
        label.textContent = 'Desativar';
        btn.querySelector('i').setAttribute('data-lucide', 'shield-off');
      }
      lucide.createIcons({ nodes: [btn] });
      closeSidebar();
    });
  }

  // ─── Initialize ───
  function init() {
    initLockScreen();
    initComparar();
    updateMonthDisplay();
    updateReceitaFonteOptions();
    updatePagamentoOptions();
    refreshAll();
    lucide.createIcons();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
