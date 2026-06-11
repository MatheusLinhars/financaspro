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
  
  const categoriasMap = {
    '🏠 Moradia': ['🏠 Aluguel', '🏢 Condomínio', '⚡ Energia Elétrica', '🚰 Água', '🌐 Internet', '🏛️ IPTU', '🔥 Gás', '🔧 Manutenção Residencial', '🛋️ Móveis', '📦 Outros'],
    '🚗 Transporte': ['⛽ Combustível', '🚕 Uber', '🚌 Ônibus', '🛣️ Pedágio', '🅿️ Estacionamento', '🔧 Manutenção do Veículo', '🛡️ Seguro do Veículo', '📦 Outros'],
    '🍔 Alimentação': ['🛒 Supermercado', '🍽️ Restaurante', '🛵 Delivery', '🥖 Padaria', '🍔 Lanche', '📦 Outros'],
    '🎮 Lazer': ['📺 Assinaturas', '🎬 Cinema', '📡 Streaming', '🎮 Jogos', '✈️ Viagens', '🎟️ Eventos', '🎨 Hobbies', '📦 Outros'],
    '🏥 Saúde': ['❤️ Plano de Saúde', '👨‍⚕️ Consulta Médica', '💊 Medicamentos', '🧪 Exames', '🧠 Terapia', '💪 Academia', '📦 Outros'],
    '🎓 Educação': ['🏫 Faculdade', '📚 Curso', '📖 Livros', '✏️ Material Escolar', '🏆 Certificações', '📦 Outros']
  };

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
      orcamentos: [],
      customFontes: [],
      creditCards: [],
      perfil: { nome: '', sobrenome: '', idade: '', profissao: '', email: '' }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged = { ...defaultState(), ...parsed };
        if (parsed.perfil) {
          merged.perfil = { ...defaultState().perfil, ...parsed.perfil };
        }
        
        let needsSave = false;
        
        if (merged.creditCards.length > 0 && typeof merged.creditCards[0] === 'string') {
          merged.creditCards = merged.creditCards.map(c => ({
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
            nome: c,
            bandeira: '',
            cor: '#c084fc',
            ultimosDigitos: '0000',
            limite: 2000,
            diaVencimento: 10,
            diaFechamento: 3,
            dataCriacao: new Date().toISOString().split('T')[0]
          }));
          needsSave = true;
        }

        merged.despesas.forEach(d => {
          if (d.categoria === 'Fixo') { d.categoria = '🏠 Moradia'; d.subcategoria = '📦 Outros'; needsSave = true; }
          else if (d.categoria === 'Necessário') { d.categoria = '🍔 Alimentação'; d.subcategoria = '📦 Outros'; needsSave = true; }
          else if (d.categoria === 'Lazer') { d.categoria = '🎮 Lazer'; d.subcategoria = '📦 Outros'; needsSave = true; }
          else if (d.categoria && !Object.keys(categoriasMap).includes(d.categoria)) {
            d.categoria = '🏠 Moradia';
            d.subcategoria = '📦 Outros';
            needsSave = true;
          }
        });

        const origMetasLen = merged.metas.length;
        merged.metas = merged.metas.filter(m => m.tipo !== 'fatura');
        if (merged.metas.length !== origMetasLen) needsSave = true;

        if (!merged.orcamentos) { merged.orcamentos = []; needsSave = true; }

        if (needsSave) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
        
        return merged;
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
  function formatCurrency(val) {
    if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
    try {
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch(e) { return `R$ ${val}`; }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch(e) { return dateStr; }
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
    cartoes: 'Cartões',
    investimentos: 'Investimentos',
    metas: 'Metas Financeiras',
    configuracoes: 'Configurações',
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
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

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
    despesaPagamento.innerHTML = '';
    
    // 1. Cartões no topo
    if (state.creditCards && state.creditCards.length > 0) {
      state.creditCards.forEach(card => {
        const opt = document.createElement('option');
        opt.value = `Crédito - ${card.nome}`;
        opt.textContent = `Crédito - ${card.nome}`;
        despesaPagamento.appendChild(opt);
      });
    }

    // 2. Outras opções fixas
    const fixas = ["PIX", "Dinheiro", "Boleto", "Débito", "Vale Refeição"];
    fixas.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      despesaPagamento.appendChild(opt);
    });
    if (currentVal) despesaPagamento.value = currentVal;
    else despesaPagamento.value = state.creditCards.length > 0 ? `Crédito - ${state.creditCards[0].nome}` : 'PIX';

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

  const despesaIsRecorrente = document.getElementById('despesaIsRecorrente');
  const recorrenciaGroup = document.getElementById('recorrenciaGroup');
  
  despesaIsRecorrente.addEventListener('change', () => {
    if (despesaIsRecorrente.checked) {
      recorrenciaGroup.classList.remove('hidden');
    } else {
      recorrenciaGroup.classList.add('hidden');
    }
  });

  const despesaCategoria = document.getElementById('despesaCategoria');
  const subcategoriaGroup = document.getElementById('subcategoriaGroup');
  const despesaSubcategoria = document.getElementById('despesaSubcategoria');

  despesaCategoria.addEventListener('change', () => {
    updateSubcategorias();
  });

  function updateSubcategorias(currentSub = '') {
    const cat = despesaCategoria.value;
    despesaSubcategoria.innerHTML = '<option value="">Selecione...</option>';
    if (cat && categoriasMap[cat]) {
      subcategoriaGroup.classList.remove('hidden');
      categoriasMap[cat].forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = sub;
        despesaSubcategoria.appendChild(opt);
      });
      if (currentSub) despesaSubcategoria.value = currentSub;
    } else {
      subcategoriaGroup.classList.add('hidden');
    }
  }

  despesaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const totalValor = parseFloat(document.getElementById('despesaValor').value);
    const parcelas = parseInt(document.getElementById('despesaParcelas').value) || 1;
    const pagamento = despesaPagamento.value;
    const isParceled = pagamento.startsWith('Crédito') && parcelas > 1;
    const dataStr = document.getElementById('despesaData').value;
    const descricao = document.getElementById('despesaDescricao').value.trim();
    const categoria = document.getElementById('despesaCategoria').value;
    const subcategoria = document.getElementById('despesaSubcategoria').value;
    
    const isRecorrente = document.getElementById('despesaIsRecorrente').checked;
    const frequencia = document.getElementById('despesaFrequencia').value;
    const repeticoes = parseInt(document.getElementById('despesaRepeticoes').value) || 2;

    // If editing, remove old entries (including group if parcelada or recorrente)
    if (despesaEditId.value) {
      const existing = state.despesas.find(d => d.id === despesaEditId.value);
      if (existing && existing.grupoId) {
        state.despesas = state.despesas.filter(d => d.grupoId !== existing.grupoId);
      } else if (existing) {
        state.despesas = state.despesas.filter(d => d.id !== despesaEditId.value);
      }
    }

    if (isParceled && !isRecorrente) {
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
          subcategoria,
          pagamento,
          parcelas,
          parcelaNum: i + 1,
          grupoId,
          data: parcelaDateStr,
        });
      }
      showToast(`${parcelas}x de ${formatCurrency(valorParcela)} lançado nos próximos ${parcelas} meses!`);
      
    } else if (isRecorrente) {
      // Recorrencia multiplas datas com mesmo valor integral
      const grupoId = despesaEditId.value ? (state.despesas.find(d => d.id === despesaEditId.value)?.grupoId || generateId()) : generateId();
      let currentDate = new Date(dataStr + 'T00:00:00');

      for (let i = 0; i < repeticoes; i++) {
        const parcelaDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        
        state.despesas.push({
          id: generateId(),
          valor: totalValor,
          descricao: descricao ? `${descricao} (${i + 1}/${repeticoes})` : '',
          categoria,
          subcategoria,
          pagamento,
          grupoId,
          data: parcelaDateStr,
        });

        if (frequencia === 'Mensal') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (frequencia === 'Quinzenal') {
          currentDate.setDate(currentDate.getDate() + 15);
        } else if (frequencia === 'Semanal') {
          currentDate.setDate(currentDate.getDate() + 7);
        }
      }
      showToast(`${repeticoes} lançamentos recorrentes gerados!`);

    } else {
      state.despesas.push({
        id: despesaEditId.value || generateId(),
        valor: totalValor,
        descricao,
        categoria,
        subcategoria,
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
    subcategoriaGroup.classList.add('hidden');
    if (document.getElementById('recorrenciaGroup')) {
      document.getElementById('recorrenciaGroup').classList.add('hidden');
    }
    refreshAll();
  });

  function renderDespesas() {
    const body = document.getElementById('despesasBody');
    const empty = document.getElementById('despesasEmpty');
    const filtered = state.despesas
      .filter(d => isInMonth(d.data, currentMonth, currentYear))
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    body.innerHTML = '';
    if (filtered.length === 0) {
      empty.style.display = 'block';
      document.getElementById('despesasTable').style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    document.getElementById('despesasTable').style.display = 'table';

    filtered.forEach(d => {
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
        <td>
          ${d.descricao}
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
            ${d.subcategoria || ''}
          </div>
        </td>
        <td class="hide-xs"><span class="badge-cat">${d.categoria}</span></td>
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
    updateSubcategorias(d.subcategoria);
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

  // ─── Credit Cards (Novo Modal) ───
  const btnOpenAddCardModal = document.getElementById('btnOpenAddCardModal');
  const ccFormModal = document.getElementById('ccFormModal');
  const ccFormModalClose = document.getElementById('ccFormModalClose');
  const btnCancelCardForm = document.getElementById('btnCancelCardForm');
  const cardForm = document.getElementById('cardForm');
  const cardEditId = document.getElementById('cardEditId');
  const btnDeleteCard = document.getElementById('btnDeleteCard');

  if (btnOpenAddCardModal) {
    btnOpenAddCardModal.addEventListener('click', () => {
      cardEditId.value = '';
      cardForm.reset();
      document.getElementById('ccFormModalTitle').textContent = 'Adicionar Cartão';
      btnDeleteCard.style.display = 'none';
      ccFormModal.classList.remove('hidden');
    });
  }

  function closeCardModal() {
    ccFormModal.classList.add('hidden');
    cardForm.reset();
  }

  if (ccFormModalClose) ccFormModalClose.addEventListener('click', closeCardModal);
  if (btnCancelCardForm) btnCancelCardForm.addEventListener('click', closeCardModal);
  if (ccFormModal) {
    ccFormModal.addEventListener('click', (e) => {
      if (e.target === ccFormModal) closeCardModal();
    });
  }

  if (cardForm) {
    cardForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const nome = document.getElementById('cardNome').value.trim();
      const bandeira = document.getElementById('cardBandeira').value.trim();
      const ultimosDigitos = document.getElementById('cardDigitos').value.trim();
      const limite = parseFloat(document.getElementById('cardLimite').value) || 0;
      const diaFechamento = parseInt(document.getElementById('cardDiaFechamento').value) || 1;
      const diaVencimento = parseInt(document.getElementById('cardDiaVencimento').value) || 1;
      const cor = document.getElementById('cardCor').value;
      
      if (!nome) {
        showToast('Informe o nome do cartão.', 'error');
        return;
      }
      
      if (cardEditId.value) {
        // Edit
        const cardIndex = state.creditCards.findIndex(c => c.id === cardEditId.value);
        if (cardIndex > -1) {
          const oldName = state.creditCards[cardIndex].nome;
          state.creditCards[cardIndex] = {
            ...state.creditCards[cardIndex],
            nome, bandeira, ultimosDigitos, limite, diaFechamento, diaVencimento, cor
          };
          // Update transactions with new name if name changed
          if (oldName !== nome) {
            state.despesas.forEach(d => {
              if (d.pagamento === `Crédito - ${oldName}`) {
                d.pagamento = `Crédito - ${nome}`;
              }
            });
          }
          showToast('Cartão atualizado com sucesso!');
        }
      } else {
        // Add
        if (state.creditCards.some(c => c.nome.toLowerCase() === nome.toLowerCase())) {
          showToast('Cartão com esse nome já cadastrado.', 'error');
          return;
        }
        state.creditCards.push({
          id: generateId(),
          nome, bandeira, ultimosDigitos, limite, diaFechamento, diaVencimento, cor,
          dataCriacao: new Date().toISOString().split('T')[0]
        });
        showToast('Cartão adicionado com sucesso!');
      }
      
      saveState();
      closeCardModal();
      refreshAll();
    });
  }

  if (btnDeleteCard) {
    btnDeleteCard.addEventListener('click', () => {
      const id = cardEditId.value;
      if (!id) return;
      if (!confirm('Deseja realmente excluir este cartão? Isso NÃO apagará as compras já feitas nele, mas ele não aparecerá mais na lista de cartões.')) return;
      
      state.creditCards = state.creditCards.filter(c => c.id !== id);
      saveState();
      closeCardModal();
      refreshAll();
      showToast('Cartão removido.', 'info');
    });
  }

  function renderCreditCards() {
    const container = document.getElementById('creditCardsList');
    container.innerHTML = '';
    state.creditCards.forEach(card => {
      const chip = document.createElement('span');
      chip.className = 'card-chip';
      chip.innerHTML = `💳 ${card.nome} <button class="card-edit" data-id="${card.id}"><i data-lucide="edit-2"></i></button>`;
      container.appendChild(chip);
    });
    container.querySelectorAll('.card-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        renderCartoes();
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
    const sorted = [...state.investimentos].sort((a, b) => (b.data || '').localeCompare(a.data || ''));

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
    'credit-card': '💳',
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
      tipo: 'economia',
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

    if (!grid) return;

    if (state.metas.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    grid.innerHTML = '';

    state.metas.forEach(m => {
      const pct = Math.min(100, m.alvo > 0 ? (m.atual / m.alvo) * 100 : 0);
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
          <div class="goal-progress-fill ${isCompleted ? 'completed' : ''}" style="width: ${pct}%;"></div>
        </div>
        <div class="goal-percentage ${isCompleted ? 'completed' : ''}">
          ${pct.toFixed(1)}% ${isCompleted ? '✓ Concluída!' : ''}
        </div>
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

  // ─── ORÇAMENTOS ───
  const btnAddOrcamento = document.getElementById('btnAddOrcamento');
  const formOrcamento = document.getElementById('formOrcamento');
  const orcamentoForm = document.getElementById('orcamentoForm');
  const btnCancelOrcamento = document.getElementById('btnCancelOrcamento');
  const orcamentoEditId = document.getElementById('orcamentoEditId');

  if (btnAddOrcamento) {
    btnAddOrcamento.addEventListener('click', () => {
      orcamentoEditId.value = '';
      orcamentoForm.reset();
      formOrcamento.classList.remove('hidden');
    });

    btnCancelOrcamento.addEventListener('click', () => {
      formOrcamento.classList.add('hidden');
      orcamentoForm.reset();
    });

    orcamentoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = {
        id: orcamentoEditId.value || generateId(),
        categoria: document.getElementById('orcCategoria').value,
        valor: parseFloat(document.getElementById('orcValor').value)
      };

      if (orcamentoEditId.value) {
        const idx = state.orcamentos.findIndex(o => o.id === orcamentoEditId.value);
        if (idx >= 0) state.orcamentos[idx] = data;
        showToast('Orçamento atualizado!');
      } else {
        if (state.orcamentos.some(o => o.categoria === data.categoria)) {
          showToast('Já existe um orçamento para esta categoria!', 'error');
          return;
        }
        state.orcamentos.push(data);
        showToast('Orçamento criado!');
      }

      saveState();
      formOrcamento.classList.add('hidden');
      orcamentoForm.reset();
      renderOrcamentos();
      renderDashboard();
    });
  }

  function getGastosCategoria(cat) {
    const despesasMes = state.despesas.filter(d => isInMonth(d.data, currentMonth, currentYear));
    return despesasMes.filter(d => d.categoria === cat).reduce((s, d) => s + d.valor, 0);
  }

  function renderOrcamentos() {
    const grid = document.getElementById('orcamentosGrid');
    const empty = document.getElementById('orcamentosEmpty');

    if (!grid) return;

    if (!state.orcamentos || state.orcamentos.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    grid.innerHTML = '';

    state.orcamentos.forEach(o => {
      const gasto = getGastosCategoria(o.categoria);
      const pct = Math.min(100, o.valor > 0 ? (gasto / o.valor) * 100 : 0);
      const limitReached = pct >= 100;
      
      let progressColor = 'budget-green';
      if (pct >= 90) progressColor = 'budget-red';
      else if (pct >= 70) progressColor = 'budget-yellow';

      const card = document.createElement('div');
      card.className = 'goal-card';
      card.innerHTML = `
        <div class="goal-header">
          <div class="goal-header-left">
            <span class="goal-name">${o.categoria}</span>
          </div>
          <div class="goal-header-actions">
            <button class="btn-icon edit-orc" data-id="${o.id}" title="Editar"><i data-lucide="pencil"></i></button>
            <button class="btn-icon delete-orc" data-id="${o.id}" title="Excluir"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
        <div class="goal-amounts">
          <span class="goal-current ${limitReached ? 'budget-text-red' : ''}">${formatCurrency(gasto)}</span>
          <span class="goal-target">Orçamento: ${formatCurrency(o.valor)}</span>
        </div>
        <div class="budget-progress-bg">
          <div class="budget-progress-fill ${progressColor}" style="width: ${pct}%;"></div>
        </div>
        <div class="goal-percentage ${limitReached ? 'budget-text-red' : ''}">
          ${pct.toFixed(1)}% utilizado
          ${!limitReached ? `<span style="float:right">Restante: ${formatCurrency(o.valor - gasto)}</span>` : ''}
        </div>
      `;
      grid.appendChild(card);
    });

    grid.querySelectorAll('.edit-orc').forEach(btn => {
      btn.addEventListener('click', () => editOrcamento(btn.dataset.id));
    });
    grid.querySelectorAll('.delete-orc').forEach(btn => {
      btn.addEventListener('click', () => deleteOrcamento(btn.dataset.id));
    });

    lucide.createIcons({ nodes: [grid] });
  }

  function editOrcamento(id) {
    const o = state.orcamentos.find(x => x.id === id);
    if (!o) return;
    orcamentoEditId.value = o.id;
    document.getElementById('orcCategoria').value = o.categoria;
    document.getElementById('orcValor').value = o.valor;
    formOrcamento.classList.remove('hidden');
    formOrcamento.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function deleteOrcamento(id) {
    if (!confirm('Excluir este orçamento?')) return;
    state.orcamentos = state.orcamentos.filter(o => o.id !== id);
    saveState();
    showToast('Orçamento excluído.', 'info');
    renderOrcamentos();
    renderDashboard();
  }

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

    // Budget Table
    renderDashboardBudget();
  }

  function renderDashboardBudget() {
    const table = document.getElementById('dashboardBudgetTable');
    const tbody = document.getElementById('dashboardBudgetBody');
    const empty = document.getElementById('dashboardBudgetEmpty');

    if (!table) return;

    if (!state.orcamentos || state.orcamentos.length === 0) {
      table.style.display = 'none';
      empty.style.display = 'block';
      return;
    }

    table.style.display = 'table';
    empty.style.display = 'none';
    tbody.innerHTML = '';

    state.orcamentos.forEach(o => {
      const gasto = getGastosCategoria(o.categoria);
      const pct = Math.min(100, o.valor > 0 ? (gasto / o.valor) * 100 : 0);
      const restante = o.valor - gasto;

      let colorClass = 'budget-text-green';
      if (pct >= 90) colorClass = 'budget-text-red';
      else if (pct >= 70) colorClass = 'budget-text-yellow';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="badge-cat">${o.categoria}</span></td>
        <td class="text-right">${formatCurrency(o.valor)}</td>
        <td class="text-right">${formatCurrency(gasto)}</td>
        <td class="text-right hide-xs ${restante < 0 ? 'budget-text-red' : ''}">${formatCurrency(restante)}</td>
        <td class="text-right ${colorClass}" style="font-weight: 700;">${pct.toFixed(1)}%</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderChartCategoria(despesas) {
    const canvas = document.getElementById('chartCategoria');
    const emptyMsg = document.getElementById('chartCategoriaEmpty');
    const totals = {};
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

    // Generates pleasant random colors for the dynamic categories
    const backgroundColors = labels.map((_, i) => `hsl(${(i * 50) % 360}, 70%, 60%)`);

    if (chartCategoria) chartCategoria.destroy();
    chartCategoria = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: backgroundColors,
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
    ].sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 8);

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
          <div class="recent-desc">${isIncome ? item.fonte : (item.subcategoria || item.categoria)}</div>
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

  // ─── CARTÕES (V1.2.0) ───
  function renderCartoes() {
    const grid = document.getElementById('ccCardsGrid');
    const emptyMsg = document.getElementById('ccEmptyState');

    if (!grid) return;

    if (!state.creditCards || state.creditCards.length === 0) {
      grid.innerHTML = '';
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';
    grid.innerHTML = '';

    state.creditCards.forEach(card => {
      const isCC = 'Crédito - ' + card.nome;
      const compras = state.despesas.filter(d => d.pagamento === isCC && isInMonth(d.data, currentMonth, currentYear));
      const spent = compras.reduce((s, d) => s + d.valor, 0);
      const disponivel = card.limite - spent;
      const pct = Math.min(100, card.limite > 0 ? (spent / card.limite) * 100 : 0);

      const cardEl = document.createElement('div');
      cardEl.className = 'cc-card';
      cardEl.style.setProperty('--card-color', card.cor || '#c084fc');
      
      cardEl.innerHTML = `
        <div class="cc-header">
          <div class="cc-name">${card.nome}</div>
          <div class="cc-digits">**** ${card.ultimosDigitos || '0000'}</div>
        </div>
        <div class="cc-limits">
          <div class="cc-limit-row">
            <span class="cc-limit-label">Limite Total</span>
            <span class="cc-limit-value">${formatCurrency(card.limite)}</span>
          </div>
        </div>
        <div class="cc-limit-bar-bg">
          <div class="cc-limit-bar-fill" style="width: ${pct}%"></div>
        </div>
        <div class="cc-limit-row">
          <span class="cc-limit-label">Disponível: ${formatCurrency(disponivel)}</span>
          <span class="cc-pct">${pct.toFixed(1)}%</span>
        </div>
        <div class="cc-limit-row" style="margin-top: 10px; font-size: 0.75rem; color: var(--text-muted);">
          <span>Vence dia ${card.diaVencimento || 10}</span>
          <span>Fecha dia ${card.diaFechamento || 3}</span>
        </div>
      `;

      cardEl.addEventListener('click', () => openCardDetailsModal(card, spent, compras.length, disponivel));
      grid.appendChild(cardEl);
    });
  }

  const ccDetailsModal = document.getElementById('ccDetailsModal');
  const ccModalClose = document.getElementById('ccModalClose');

  if (ccModalClose) {
    ccModalClose.addEventListener('click', () => {
      ccDetailsModal.classList.add('hidden');
    });
    ccDetailsModal.addEventListener('click', (e) => {
      if (e.target === ccDetailsModal) ccDetailsModal.classList.add('hidden');
    });
  }

  let currentCardViewing = null;
  const btnEditCard = document.getElementById('btnEditCard');

  if (btnEditCard) {
    btnEditCard.addEventListener('click', () => {
      if (!currentCardViewing) return;
      
      // Close details modal
      ccDetailsModal.classList.add('hidden');
      
      // Populate form
      document.getElementById('cardEditId').value = currentCardViewing.id;
      document.getElementById('cardNome').value = currentCardViewing.nome;
      document.getElementById('cardBandeira').value = currentCardViewing.bandeira || '';
      document.getElementById('cardDigitos').value = currentCardViewing.ultimosDigitos || '';
      document.getElementById('cardLimite').value = currentCardViewing.limite;
      document.getElementById('cardDiaFechamento').value = currentCardViewing.diaFechamento;
      document.getElementById('cardDiaVencimento').value = currentCardViewing.diaVencimento;
      document.getElementById('cardCor').value = currentCardViewing.cor || '#c084fc';
      
      document.getElementById('ccFormModalTitle').textContent = 'Editar Cartão';
      document.getElementById('btnDeleteCard').style.display = 'block';
      
      // Open form modal
      document.getElementById('ccFormModal').classList.remove('hidden');
    });
  }

  function openCardDetailsModal(card, faturaAtual, comprasCount, limiteDisp) {
    currentCardViewing = card;
    document.getElementById('ccModalTitle').innerHTML = `<i data-lucide="credit-card" style="color: ${card.cor}"></i> ${card.nome}`;
    document.getElementById('ccModalFaturaAtual').textContent = formatCurrency(faturaAtual);
    document.getElementById('ccModalComprasCount').textContent = comprasCount;
    document.getElementById('ccModalLimiteDisp').textContent = formatCurrency(limiteDisp);

    const historyContainer = document.getElementById('ccFaturasHistory');
    historyContainer.innerHTML = '';

    const isCC = 'Crédito - ' + card.nome;
    const cardDespesas = state.despesas.filter(d => d.pagamento === isCC).sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    if (cardDespesas.length === 0) {
      historyContainer.innerHTML = '<p class="empty-state">Nenhuma compra no histórico deste cartão.</p>';
    } else {
      const byMonth = {};
      cardDespesas.forEach(d => {
        const key = d.data.substring(0, 7);
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(d);
      });

      const monthsHtml = Object.keys(byMonth).sort((a, b) => (b || '').localeCompare(a || '')).map(monthKey => {
        const [y, m] = monthKey.split('-').map(Number);
        const mlabel = new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const monthTotal = byMonth[monthKey].reduce((s, d) => s + d.valor, 0);
        
        const rows = byMonth[monthKey].map(d => {
          const parcelaTag = d.grupoId ? `<span class="badge-parcelas">${d.parcelaNum}/${d.parcelas}</span>` : '';
          return `
            <div class="fatura-row" style="padding: 6px 0;">
              <span class="fatura-date" style="min-width: 60px;">${d.data.substring(8,10)}/${d.data.substring(5,7)}</span>
              <span class="fatura-desc" style="font-size: 0.8rem;">${d.descricao}${parcelaTag}</span>
              <span class="fatura-valor" style="font-size: 0.8rem;">${formatCurrency(d.valor)}</span>
            </div>`;
        }).join('');

        return `
          <div class="fatura-card" style="margin-bottom: 12px; background: rgba(0,0,0,0.2);">
            <div class="fatura-month-header" style="padding: 8px 16px;">
              <span class="fatura-month-name">${mlabel.charAt(0).toUpperCase() + mlabel.slice(1)}</span>
              <span class="fatura-month-total">${formatCurrency(monthTotal)}</span>
            </div>
            <div class="fatura-rows" style="padding: 4px 16px;">${rows}</div>
          </div>`;
      }).join('');
      
      historyContainer.innerHTML = monthsHtml;
    }

    ccDetailsModal.classList.remove('hidden');
    lucide.createIcons({ nodes: [ccDetailsModal] });
  }

  // ─── HISTÓRICO (DASHBOARD) ───
  function renderHistoricoDashboard() {
    const canvas = document.getElementById('chartHistorico');
    if (!canvas) return;
    
    const filterEl = document.getElementById('histFilter');
    const monthsToShow = filterEl ? parseInt(filterEl.value) : 6;
    
    const labels = [];
    const dataRec = [];
    const dataDesp = [];
    const dataBal = [];
    
    for (let i = monthsToShow - 1; i >= 0; i--) {
      let m = currentMonth - i;
      let y = currentYear;
      if (m < 0) { m += 12; y--; }
      
      labels.push(getMonthLabel(m, y).substring(0, 3) + '/' + String(y).substring(2));
      
      const rec = state.receitas.filter(r => isInMonth(r.data, m, y)).reduce((s, r) => s + r.valor, 0);
      const desp = state.despesas.filter(d => isInMonth(d.data, m, y)).reduce((s, d) => s + d.valor, 0);
      
      dataRec.push(rec);
      dataDesp.push(desp);
      dataBal.push(rec - desp);
    }
    
    if (chartHistorico) { chartHistorico.destroy(); chartHistorico = null; }
    chartHistorico = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Receitas',
            data: dataRec,
            backgroundColor: 'rgba(74,222,128,0.25)',
            borderColor: '#4ade80',
            borderWidth: 2,
            borderRadius: 6,
          },
          {
            label: 'Despesas',
            data: dataDesp,
            backgroundColor: 'rgba(248,113,113,0.25)',
            borderColor: '#f87171',
            borderWidth: 2,
            borderRadius: 6,
          },
          {
            type: 'line',
            label: 'Balanço',
            data: dataBal,
            borderColor: '#60a5fa',
            backgroundColor: '#60a5fa',
            borderWidth: 2,
            tension: 0.3,
            pointBackgroundColor: '#1a2a1d',
          }
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

  function refreshAll() {
    const safeRun = (fn, name) => {
      try { fn(); } catch(e) { console.error(`Error in ${name}:`, e); }
    };
    safeRun(renderDashboard, 'renderDashboard');
    safeRun(renderReceitas, 'renderReceitas');
    safeRun(renderDespesas, 'renderDespesas');
    safeRun(renderCartoes, 'renderCartoes');
    safeRun(renderInvestimentos, 'renderInvestimentos');
    safeRun(renderMetas, 'renderMetas');
    safeRun(renderOrcamentos, 'renderOrcamentos');
    safeRun(renderCreditCards, 'renderCreditCards');
    safeRun(renderHistoricoDashboard, 'renderHistoricoDashboard');
    safeRun(updateSidebarTitle, 'updateSidebarTitle');

    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) {
      pageTitle.textContent = sectionTitles[activeNav.dataset.section] || activeNav.dataset.section;
    }
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

      case 'confirm_disable':
        const disableStoredHash = getStoredPinHash();
        if (hash === disableStoredHash) {
          localStorage.setItem(PIN_DISABLED_KEY, 'true');
          const btn = document.getElementById('btnTogglePin');
          if (btn) {
            btn.innerHTML = `<i data-lucide="shield-check"></i> <span id="togglePinLabel">Ativar Senha</span>`;
            lucide.createIcons({ nodes: [btn] });
          }
          showToast('Senha desativada.', 'info');
          pinInput = '';
          pinMode = 'login';
          updatePinDots();
          unlockApp();
        } else {
          showLockError('Senha incorreta.');
          shakePin();
          pinInput = '';
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
      const btn = document.getElementById('btnTogglePin');
      if (isDisabled) {
        btn.innerHTML = `<i data-lucide="shield-check"></i> <span id="togglePinLabel">Ativar Senha</span>`;
      } else {
        btn.innerHTML = `<i data-lucide="shield-off"></i> <span id="togglePinLabel">Desativar Senha</span>`;
      }
      lucide.createIcons({ nodes: [btn] });
    }
    updateToggleBtnLabel();

    if (pinDisabled) {
      // Skip lock screen entirely
      unlockApp();
    } else if (!storedHash) {
      pinMode = 'setup';
      setLockSubtitle('Crie uma senha de 4 dígitos para acessar o app');
    } else {
      pinMode = 'login';
      setLockSubtitle('Digite sua senha para acessar');
    }

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

  }

  function updateSidebarTitle() {
    const titleEl = document.getElementById('sidebarAppTitle');
    const lockTitleEl = document.getElementById('lockAppTitle');
    
    let text = 'Core Finance';
    if (state.perfil && state.perfil.nome) {
      text = `${state.perfil.nome} ${state.perfil.sobrenome || ''}`.trim();
    }

    if (titleEl) {
      titleEl.textContent = text;
      // Auto-shrink logic
      titleEl.style.fontSize = '1.15rem';
      requestAnimationFrame(() => {
        let size = 1.15;
        while (titleEl.scrollWidth > titleEl.clientWidth && size > 0.7) {
          size -= 0.05;
          titleEl.style.fontSize = size + 'rem';
        }
      });
    }

    if (lockTitleEl) {
      lockTitleEl.textContent = text;
    }
  }

  // ─── CONFIGURAÇÕES ───
  function initConfiguracoes() {
    // 1. Perfil
    const inputs = ['cfgNome', 'cfgSobrenome', 'cfgIdade', 'cfgProfissao', 'cfgEmail'];
    if (!state.perfil) state.perfil = { nome: '', sobrenome: '', idade: '', profissao: '', email: '' };
    
    // Load existing
    inputs.forEach(id => {
      const key = id.replace('cfg', '').toLowerCase();
      document.getElementById(id).value = state.perfil[key] || '';
    });
    
    // Save on change
    inputs.forEach(id => {
      document.getElementById(id).addEventListener('input', (e) => {
        const key = id.replace('cfg', '').toLowerCase();
        state.perfil[key] = e.target.value;
        saveState();
        updateSidebarTitle();
      });
    });

    // 2. Segurança Actions
    const lockScreen = document.getElementById('lockScreen');
    
    document.getElementById('btnLockApp').addEventListener('click', () => {
      if (localStorage.getItem(PIN_DISABLED_KEY) === 'true' || !getStoredPinHash()) {
        showToast('Nenhuma senha configurada para bloquear.', 'info');
        return;
      }
      lockApp();
      closeSidebar();
      navigateTo('dashboard');
    });

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
      lockScreen.classList.remove('hidden', 'unlocked');
      lucide.createIcons({ nodes: [lockScreen] });
      closeSidebar();
    });

    document.getElementById('btnTogglePin').addEventListener('click', () => {
      const isDisabled = localStorage.getItem(PIN_DISABLED_KEY) === 'true';
      if (isDisabled) {
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
        pinInput = '';
        pinMode = 'confirm_disable';
        setLockSubtitle('Digite sua senha atual para desativar');
        hideLockError();
        updatePinDots();
        lockScreen.classList.remove('hidden', 'unlocked');
        lucide.createIcons({ nodes: [lockScreen] });
      }
      
      const isNowDisabled = localStorage.getItem(PIN_DISABLED_KEY) === 'true';
      const btn = document.getElementById('btnTogglePin');
      if (isNowDisabled) {
        btn.innerHTML = `<i data-lucide="shield-check"></i> <span id="togglePinLabel">Ativar Senha</span>`;
      } else {
        btn.innerHTML = `<i data-lucide="shield-off"></i> <span id="togglePinLabel">Desativar Senha</span>`;
      }
      lucide.createIcons({ nodes: [btn] });
    });
  }

  // ─── Initialize ───
  function init() {
    initLockScreen();
    initConfiguracoes();
    updateMonthDisplay();
    updateReceitaFonteOptions();
    updatePagamentoOptions();
    refreshAll();
    lucide.createIcons();
    
    const histFilter = document.getElementById('histFilter');
    if (histFilter) {
      histFilter.addEventListener('change', renderHistoricoDashboard);
    }
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
