/* ============================================================
 *  modules.js — Todos os módulos da aplicação.
 *  Cada módulo expõe pelo menos um render(container) e suas
 *  ações (add, edit, delete) usando DB.* + Permissions.*.
 *
 *  Padrão de cada módulo:
 *  const Modules.X = {
 *    render(container)        // monta o HTML inicial
 *    _bindReactive(container) // re-renderiza ao mudar State
 *    add() / edit() / del()   // ações
 *  }
 * ============================================================ */

const Modules = {};

// ============================================================
//  DASHBOARD
// ============================================================
Modules.dashboard = {
  _chart: null,
  _unsubs: [],

  render(container) {
    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="module-card text-center">
          <i class="fa-solid fa-users text-2xl text-gold mb-2"></i>
          <div class="text-xs text-muted uppercase tracking-wider">Convidados</div>
          <div id="dash-guests" class="text-2xl font-bold mt-1">—</div>
        </div>
        <div class="module-card text-center">
          <i class="fa-solid fa-heart text-2xl text-gold mb-2"></i>
          <div class="text-xs text-muted uppercase tracking-wider">Confirmados</div>
          <div id="dash-confirmed" class="text-2xl font-bold mt-1">—</div>
        </div>
        <div class="module-card text-center" id="dash-fin-card">
          <i class="fa-solid fa-wallet text-2xl text-gold mb-2"></i>
          <div class="text-xs text-muted uppercase tracking-wider">Gastos</div>
          <div id="dash-spent" class="text-2xl font-bold mt-1">—</div>
        </div>
        <div class="module-card text-center">
          <i class="fa-solid fa-list-check text-2xl text-gold mb-2"></i>
          <div class="text-xs text-muted uppercase tracking-wider">Checklist</div>
          <div id="dash-tasks" class="text-2xl font-bold mt-1">—</div>
          <div class="w-full h-1.5 bg-gray-200 rounded-full mt-2">
            <div id="dash-tasks-bar" class="h-full bg-gold rounded-full" style="width:0%"></div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="module-card">
          <h3 class="font-bold mb-3">Gastos por categoria</h3>
          <canvas id="dash-chart" height="220"></canvas>
        </div>
        <div class="module-card">
          <h3 class="font-bold mb-3">Próximas tarefas</h3>
          <ul id="dash-upcoming" class="space-y-2"></ul>
        </div>
      </div>
    `;

    // Esconde gastos pra quem não tem permissão de finanças
    if (!Permissions.can('finances.view')) {
      document.getElementById('dash-fin-card').style.display = 'none';
    }

    this.refresh();
    this._unsubs.forEach(u => u());
    this._unsubs = [
      State.subscribe('guests', () => this.refresh()),
      State.subscribe('finances', () => this.refresh()),
      State.subscribe('tasks', () => this.refresh())
    ];
  },

  refresh() {
    const total = State.guests.length + State.guests.reduce((a,g) => a + (g.companions||0), 0);
    const confirmed = State.guests.filter(g => g.status === 'confirmed').length
                    + State.guests.filter(g => g.status === 'confirmed').reduce((a,g) => a + (g.companions||0), 0);
    document.getElementById('dash-guests').innerText = total;
    document.getElementById('dash-confirmed').innerText = confirmed;

    if (Permissions.can('finances.view')) {
      const spent = State.finances.reduce((a,e) => a + Number(e.amount||0), 0);
      document.getElementById('dash-spent').innerText = UI.money(spent);
    }

    const done = State.tasks.filter(t => t.done).length;
    const totalT = State.tasks.length || 1;
    const pct = Math.round((done/totalT) * 100);
    document.getElementById('dash-tasks').innerText = pct + '%';
    document.getElementById('dash-tasks-bar').style.width = pct + '%';

    // Próximas tarefas (não concluídas, máx 5)
    const upcoming = State.tasks.filter(t => !t.done).slice(0, 5);
    const ul = document.getElementById('dash-upcoming');
    if (upcoming.length === 0) {
      ul.innerHTML = `<li class="empty-state"><i class="fa-solid fa-check-double"></i><p>Tudo em dia!</p></li>`;
    } else {
      ul.innerHTML = upcoming.map(t => `
        <li class="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
          <i class="fa-regular fa-circle text-muted"></i>
          <span class="text-sm">${UI.escape(t.title)}</span>
        </li>`).join('');
    }

    // Chart
    if (Permissions.can('finances.view')) {
      const ctx = document.getElementById('dash-chart');
      if (!ctx) return;
      const byCat = {};
      State.finances.forEach(e => { byCat[e.category||'Outros'] = (byCat[e.category||'Outros']||0) + Number(e.amount||0); });
      const labels = Object.keys(byCat);
      const data = Object.values(byCat);
      if (this._chart) this._chart.destroy();
      this._chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels.length ? labels : ['Sem gastos ainda'],
          datasets: [{ data: data.length ? data : [1],
            backgroundColor: ['#D4AF37','#F8E8E8','#1F1F1F','#9CA3AF','#FBBF24','#E6C76B','#B57B7B','#1E40AF','#15803D','#DC2626','#7C3AED','#0EA5E9','#F97316','#10B981','#6B7280'],
            borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels:{font:{size:11}} } } }
      });
    }
  }
};

// ============================================================
//  GUESTS + FAMILIES
// ============================================================
Modules.guests = {
  _unsubs: [],

  render(container) {
    const canEdit = Permissions.can('guests.create');
    const canImport = Permissions.can('guests.import');

    container.innerHTML = `
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <h2 class="text-2xl font-bold font-serif">Convidados &amp; Famílias</h2>
          <p class="text-sm text-muted">Organize por família. Cada família = uma unidade de RSVP.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${canEdit ? `<button id="btn-add-family" class="bg-dark text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-black"><i class="fa-solid fa-people-roof mr-2"></i>Família</button>` : ''}
          ${canEdit ? `<button id="btn-add-guest" class="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-semibold"><i class="fa-solid fa-user-plus mr-2"></i>Convidado</button>` : ''}
          ${canImport ? `<button id="btn-import" class="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-xl text-sm font-semibold"><i class="fa-solid fa-file-excel mr-2"></i>Importar planilha</button><input type="file" id="import-file" accept=".xlsx,.xls,.csv" class="hidden">` : ''}
        </div>
      </div>

      <div class="glass-card p-4 rounded-2xl mb-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-muted uppercase tracking-widest"><i class="fa-solid fa-inbox mr-1"></i> Sem família</span>
          <span id="unassigned-count" class="text-xs text-muted">0</span>
        </div>
        <div id="unassigned-guests" class="flex flex-wrap gap-2 min-h-[44px]"></div>
      </div>

      <div id="families-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>
    `;

    if (canEdit) {
      document.getElementById('btn-add-family').addEventListener('click', () => this.addFamily());
      document.getElementById('btn-add-guest').addEventListener('click', () => this.addGuest());
    }
    if (canImport) {
      document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
      document.getElementById('import-file').addEventListener('change', e => this.importExcel(e));
    }

    this.refresh();
    this._unsubs.forEach(u => u());
    this._unsubs = [
      State.subscribe('guests', () => this.refresh()),
      State.subscribe('families', () => this.refresh())
    ];
  },

  refresh() {
    const canEdit = Permissions.can('guests.edit');
    const canDel = Permissions.can('guests.delete');

    // Sem família
    const orphans = State.guests.filter(g => !g.familyId);
    document.getElementById('unassigned-count').innerText = orphans.length;
    const ug = document.getElementById('unassigned-guests');
    ug.innerHTML = orphans.length === 0
      ? `<span class="text-xs text-gray-400 italic">Todos os convidados estão alocados.</span>`
      : orphans.map(g => this._pill(g, canEdit, canDel)).join('');
    this._attachPillEvents(ug);

    // Famílias
    const grid = document.getElementById('families-grid');
    if (State.families.length === 0) {
      grid.innerHTML = `<div class="empty-state col-span-full"><i class="fa-solid fa-people-roof"></i><p>Crie sua primeira família pra começar.</p></div>`;
      return;
    }

    grid.innerHTML = State.families.map(f => {
      const members = State.guests.filter(g => g.familyId === f.id);
      const total = members.length + members.reduce((a,m) => a + (m.companions||0), 0);
      const confirmed = members.filter(m => m.status === 'confirmed').length;
      const pending = members.filter(m => m.status === 'pending').length;
      return `
        <div class="module-card" data-family="${f.id}">
          <div class="flex justify-between items-start mb-3">
            <div class="overflow-hidden">
              <h3 class="font-bold truncate">${UI.escape(f.name)}</h3>
              <div class="text-xs text-muted mt-0.5">${total} pessoa${total!==1?'s':''}</div>
            </div>
            ${canEdit ? `<button data-edit-family="${f.id}" class="text-gray-300 hover:text-gold p-1"><i class="fa-solid fa-pen text-xs"></i></button>` : ''}
            ${canDel ? `<button data-del-family="${f.id}" class="text-gray-300 hover:text-red-500 p-1"><i class="fa-solid fa-trash text-xs"></i></button>` : ''}
          </div>
          ${f.phone ? `<div class="text-[11px] text-green-600 mb-3"><i class="fa-brands fa-whatsapp mr-1"></i>${UI.escape(f.phone)}</div>` : ''}
          <div class="flex gap-2 mb-3">
            <span class="badge badge-green">${confirmed} sim</span>
            <span class="badge badge-gray">${pending} aguarda</span>
          </div>
          <div class="space-y-1.5">
            ${members.map(g => this._pill(g, canEdit, canDel)).join('') || '<span class="text-xs text-gray-400 italic">Sem integrantes ainda.</span>'}
          </div>
        </div>
      `;
    }).join('');

    this._attachPillEvents(grid);
    grid.querySelectorAll('[data-del-family]').forEach(btn => {
      btn.addEventListener('click', () => this.delFamily(btn.dataset.delFamily));
    });
    grid.querySelectorAll('[data-edit-family]').forEach(btn => {
      btn.addEventListener('click', () => this.editFamily(btn.dataset.editFamily));
    });
  },

  _pill(g, canEdit, canDel) {
    const bg = { pending:'bg-white border-gray-200', confirmed:'bg-green-50 border-green-200', declined:'bg-red-50 border-red-200' };
    const dot = { pending:'text-gray-400', confirmed:'text-green-500', declined:'text-red-500' };
    const comp = (g.companions||0) > 0 ? `<span class="text-[10px] bg-gray-200 px-1.5 rounded-full ml-1">+${g.companions}</span>` : '';
    return `
      <div class="flex items-center justify-between px-3 py-2 rounded-xl border shadow-sm ${bg[g.status]||bg.pending}" data-guest="${g.id}">
        <div class="flex items-center gap-2 overflow-hidden">
          <i class="fa-solid fa-circle text-[7px] ${dot[g.status]||dot.pending}"></i>
          <span class="text-sm truncate ${canEdit?'cursor-pointer hover:underline':''}" ${canEdit?`data-edit-guest="${g.id}"`:''}>${UI.escape(g.name)}${comp}</span>
        </div>
        ${canDel ? `<button data-del-guest="${g.id}" class="text-gray-300 hover:text-red-500"><i class="fa-solid fa-xmark text-xs"></i></button>` : ''}
      </div>
    `;
  },

  _attachPillEvents(scope) {
    scope.querySelectorAll('[data-edit-guest]').forEach(el => {
      el.addEventListener('click', () => this.editGuest(el.dataset.editGuest));
    });
    scope.querySelectorAll('[data-del-guest]').forEach(btn => {
      btn.addEventListener('click', () => this.delGuest(btn.dataset.delGuest));
    });
  },

  // ----- AÇÕES -----
  async addFamily() {
    if (!Permissions.enforceRole('guests.create')) return;
    const html = `
      <input id="m-fam-name" class="swal2-input" placeholder="Nome da família">
      <input id="m-fam-phone" class="swal2-input" placeholder="WhatsApp (opcional)">
    `;
    const data = await UI.modal({
      title: 'Nova família', html,
      preConfirm: () => ({
        name: document.getElementById('m-fam-name').value.trim(),
        phone: document.getElementById('m-fam-phone').value.replace(/\D/g, '')
      })
    });
    if (!data || !data.name) return;
    await DB.add('families', data);
    UI.toast('Família criada');
  },

  async editFamily(id) {
    const f = State.families.find(x => x.id === id); if (!f) return;
    const html = `
      <input id="m-fam-name" class="swal2-input" value="${UI.escape(f.name)}">
      <input id="m-fam-phone" class="swal2-input" value="${UI.escape(f.phone||'')}" placeholder="WhatsApp">
    `;
    const data = await UI.modal({
      title: 'Editar família', html,
      preConfirm: () => ({
        name: document.getElementById('m-fam-name').value.trim(),
        phone: document.getElementById('m-fam-phone').value.replace(/\D/g, '')
      })
    });
    if (!data) return;
    await DB.update('families', id, data);
    UI.toast('Família atualizada');
  },

  async delFamily(id) {
    if (!Permissions.enforceRole('guests.delete')) return;
    const ok = await UI.confirm('Excluir família?', 'Os integrantes ficarão sem família mas não serão excluídos.');
    if (!ok) return;
    // Desvincula integrantes
    const members = State.guests.filter(g => g.familyId === id);
    await Promise.all(members.map(m => DB.update('guests', m.id, { familyId: null })));
    await DB.remove('families', id);
    UI.toast('Família removida');
  },

  async addGuest() {
    if (!Permissions.enforceRole('guests.create')) return;

    // Checa limite do plano
    const limit = Permissions.getLimit('maxGuests');
    if (State.guests.length >= limit) {
      UI.showUpgradePrompt('guests');
      return;
    }

    const famOptions = State.families.map(f =>
      `<option value="${f.id}">${UI.escape(f.name)}</option>`
    ).join('');
    const html = `
      <input id="m-g-name" class="swal2-input" placeholder="Nome">
      <input id="m-g-comp" type="number" min="0" class="swal2-input" placeholder="Acompanhantes" value="0">
      <select id="m-g-fam" class="swal2-select"><option value="">Sem família</option>${famOptions}</select>
      <select id="m-g-status" class="swal2-select">
        <option value="pending">Pendente</option>
        <option value="confirmed">Confirmado</option>
        <option value="declined">Recusou</option>
      </select>
    `;
    const data = await UI.modal({
      title: 'Novo convidado', html,
      preConfirm: () => ({
        name: document.getElementById('m-g-name').value.trim(),
        companions: parseInt(document.getElementById('m-g-comp').value) || 0,
        familyId: document.getElementById('m-g-fam').value || null,
        status: document.getElementById('m-g-status').value
      })
    });
    if (!data || !data.name) return;
    await DB.add('guests', data);
    UI.toast('Convidado adicionado');
  },

  async editGuest(id) {
    const g = State.guests.find(x => x.id === id); if (!g) return;
    const famOptions = State.families.map(f =>
      `<option value="${f.id}" ${f.id===g.familyId?'selected':''}>${UI.escape(f.name)}</option>`
    ).join('');
    const html = `
      <input id="m-g-name" class="swal2-input" value="${UI.escape(g.name)}">
      <input id="m-g-comp" type="number" min="0" class="swal2-input" value="${g.companions||0}">
      <select id="m-g-fam" class="swal2-select"><option value="" ${!g.familyId?'selected':''}>Sem família</option>${famOptions}</select>
      <select id="m-g-status" class="swal2-select">
        <option value="pending" ${g.status==='pending'?'selected':''}>Pendente</option>
        <option value="confirmed" ${g.status==='confirmed'?'selected':''}>Confirmado</option>
        <option value="declined" ${g.status==='declined'?'selected':''}>Recusou</option>
      </select>
    `;
    const data = await UI.modal({
      title: 'Editar', html,
      preConfirm: () => ({
        name: document.getElementById('m-g-name').value.trim(),
        companions: parseInt(document.getElementById('m-g-comp').value) || 0,
        familyId: document.getElementById('m-g-fam').value || null,
        status: document.getElementById('m-g-status').value
      })
    });
    if (!data) return;
    await DB.update('guests', id, data);
    UI.toast('Atualizado');
  },

  async delGuest(id) {
    if (!Permissions.enforceRole('guests.delete')) return;
    const ok = await UI.confirm('Excluir convidado?', 'Essa ação não pode ser desfeita.');
    if (!ok) return;
    await DB.remove('guests', id);
    UI.toast('Removido');
  },

  // ----- IMPORTAÇÃO EXCEL -----
  importExcel(event) {
    const file = event.target.files[0]; if (!file) return;
    UI.loading('Lendo planilha…');
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        const detected = this._detectColumns(rows);
        if (detected.colName === -1) {
          Swal.fire('Formato incompatível', 'Não encontrei a coluna "Nome".', 'error');
          return;
        }
        const parsed = this._parseRows(rows, detected);
        const dupes = this._findDuplicates(parsed);

        Swal.close();
        if (dupes.length > 0) {
          const ok = await UI.confirm(
            `${dupes.length} possíveis duplicatas encontradas`,
            'Quer revisar uma a uma antes de importar?',
            'Revisar'
          );
          if (ok) {
            await this._reviewDuplicates(parsed, dupes);
          } else {
            await this._commitImport(parsed.filter(p => !dupes.find(d => d.idx === p.idx)));
          }
        } else {
          await this._commitImport(parsed);
        }
        UI.toast(`${parsed.length} convidados processados`);
      } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao processar planilha.', 'error');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  },

  _detectColumns(rows) {
    let headRow = -1, colName = -1, colFam = -1, colComp = -1, colStatus = -1, colPhone = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i] || [];
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j]||'').toLowerCase().trim();
        if (['nome','convidado','guest'].includes(cell)) colName = j;
        else if (['família','familia','family'].includes(cell)) colFam = j;
        else if (['acompanhantes','acomp','quantidade','+'].includes(cell)) colComp = j;
        else if (['status','confirmação','confirmacao'].includes(cell)) colStatus = j;
        else if (['telefone','celular','whatsapp','phone'].includes(cell)) colPhone = j;
      }
      if (colName !== -1) { headRow = i; break; }
    }
    return { headRow, colName, colFam, colComp, colStatus, colPhone };
  },

  _parseRows(rows, det) {
    const out = [];
    for (let i = det.headRow + 1; i < rows.length; i++) {
      const r = rows[i]; if (!r || !r[det.colName]) continue;
      const name = String(r[det.colName]).trim();
      const famName = det.colFam !== -1 && r[det.colFam] ? String(r[det.colFam]).trim() : null;
      const comp = det.colComp !== -1 && r[det.colComp] ? (parseInt(r[det.colComp])||0) : 0;
      let st = det.colStatus !== -1 && r[det.colStatus] ? String(r[det.colStatus]).toLowerCase().trim() : 'pending';
      if (['sim','confirmado','vai','yes'].includes(st)) st = 'confirmed';
      else if (['não','nao','recusado','no'].includes(st)) st = 'declined';
      else st = 'pending';
      const phone = det.colPhone !== -1 && r[det.colPhone] ? String(r[det.colPhone]).replace(/\D/g,'') : '';
      out.push({ idx: i, name, famName, companions: comp, status: st, phone });
    }
    return out;
  },

  _normalize(s) {
    return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
  },

  _levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n; if (n === 0) return m;
    const dp = Array.from({length: m+1}, () => new Array(n+1));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
    return dp[m][n];
  },

  _findDuplicates(parsed) {
    const dupes = [];
    // Internos
    for (let i = 0; i < parsed.length; i++) {
      for (let j = i+1; j < parsed.length; j++) {
        const a = this._normalize(parsed[i].name), b = this._normalize(parsed[j].name);
        const d = this._levenshtein(a, b);
        if (a && b && d <= Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.15))) {
          dupes.push({ idx: parsed[j].idx, against: parsed[i].name, type: 'internal' });
        }
      }
    }
    // Contra base existente
    parsed.forEach(p => {
      const an = this._normalize(p.name);
      State.guests.forEach(g => {
        const bn = this._normalize(g.name);
        const d = this._levenshtein(an, bn);
        if (an && bn && d <= Math.max(1, Math.floor(Math.max(an.length, bn.length) * 0.15))) {
          if (!dupes.find(x => x.idx === p.idx)) dupes.push({ idx: p.idx, against: g.name, type: 'existing' });
        }
      });
    });
    return dupes;
  },

  async _reviewDuplicates(parsed, dupes) {
    const keep = new Set(parsed.map(p => p.idx));
    for (const d of dupes) {
      const p = parsed.find(x => x.idx === d.idx);
      const choice = await Swal.fire({
        title: 'Possível duplicata',
        html: `Encontrei <b>${UI.escape(p.name)}</b> que parece com <b>${UI.escape(d.against)}</b>.<br><small class="text-muted">${d.type === 'existing' ? 'Já existe na base' : 'Está duplicado na própria planilha'}</small>`,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'É a mesma pessoa (não importar)',
        denyButtonText: 'São pessoas diferentes (importar)',
        cancelButtonText: 'Pular'
      });
      if (choice.isConfirmed) keep.delete(d.idx);
    }
    const finalList = parsed.filter(p => keep.has(p.idx));
    await this._commitImport(finalList);
  },

  async _commitImport(items) {
    // Mapa de famílias por nome (criar as que não existem)
    const familyByName = new Map();
    State.families.forEach(f => familyByName.set(this._normalize(f.name), f.id));

    for (const item of items) {
      let famId = null;
      if (item.famName) {
        const key = this._normalize(item.famName);
        if (familyByName.has(key)) {
          famId = familyByName.get(key);
        } else {
          const ref = await DB.add('families', { name: item.famName, phone: '' });
          familyByName.set(key, ref.id);
          famId = ref.id;
        }
      }
      await DB.add('guests', {
        name: item.name,
        companions: item.companions,
        status: item.status,
        phone: item.phone,
        familyId: famId
      });
    }
  }
};

// ============================================================
//  RSVP TINDER (swipe)
// ============================================================
Modules.rsvp = {
  _unsubs: [],
  _deck: null,

  render(container) {
    container.innerHTML = `
      <div class="text-center mb-6">
        <h2 class="text-2xl font-bold font-serif">RSVP Express</h2>
        <p class="text-sm text-muted">Arraste pra direita pra confirmar, esquerda pra recusar.</p>
      </div>

      <div class="tinder-deck" id="tinder-deck">
        <div id="tinder-empty" class="absolute inset-0 flex flex-col items-center justify-center text-gray-400 glass-card rounded-3xl border-2 border-dashed border-gray-300">
          <i class="fa-solid fa-check-double text-5xl mb-4 text-gray-300"></i>
          <p class="font-semibold">Tudo confirmado!</p>
          <p class="text-xs">Ninguém pendente.</p>
        </div>
      </div>

      <div class="flex justify-center gap-6 mt-8">
        <button id="rsvp-no" class="w-16 h-16 rounded-full bg-white shadow-xl text-red-500 text-2xl flex items-center justify-center hover:scale-110 transition border border-gray-100"><i class="fa-solid fa-xmark"></i></button>
        <button id="rsvp-maybe" class="w-14 h-14 rounded-full bg-white shadow-xl text-yellow-500 text-xl flex items-center justify-center hover:scale-110 transition border border-gray-100"><i class="fa-solid fa-question"></i></button>
        <button id="rsvp-yes" class="w-16 h-16 rounded-full bg-white shadow-xl text-green-500 text-2xl flex items-center justify-center hover:scale-110 transition border border-gray-100"><i class="fa-solid fa-heart"></i></button>
      </div>

      <div id="rsvp-stats" class="mt-8 grid grid-cols-3 gap-3 max-w-md mx-auto"></div>
    `;

    this._deck = document.getElementById('tinder-deck');
    document.getElementById('rsvp-yes').addEventListener('click', () => this.decide('confirmed'));
    document.getElementById('rsvp-no').addEventListener('click', () => this.decide('declined'));
    document.getElementById('rsvp-maybe').addEventListener('click', () => this.decide('pending', true));

    this.refresh();
    this._unsubs.forEach(u => u());
    this._unsubs = [State.subscribe('guests', () => this.refresh())];
  },

  refresh() {
    if (!this._deck) return;
    this._deck.querySelectorAll('.tinder-card').forEach(c => c.remove());

    const pending = State.guests.filter(g => g.status === 'pending');
    const empty = document.getElementById('tinder-empty');
    if (empty) empty.style.display = pending.length === 0 ? 'flex' : 'none';

    [...pending].reverse().slice(-3).forEach((g, idx, arr) => {
      const card = document.createElement('div');
      card.className = 'tinder-card';
      card.dataset.id = g.id;
      const z = idx;
      card.style.zIndex = z;
      card.style.transform = `translateY(-${(arr.length - 1 - idx) * 6}px) scale(${1 - ((arr.length - 1 - idx) * 0.03)})`;
      const fam = g.familyId ? State.families.find(f => f.id === g.familyId)?.name : 'Avulso';
      card.innerHTML = `
        <div class="tinder-overlay yes">SIM</div>
        <div class="tinder-overlay no">NÃO</div>
        <div class="text-xs uppercase tracking-widest text-gold mb-2 font-bold">${UI.escape(fam || 'Avulso')}</div>
        <h3 class="text-3xl font-serif font-bold text-dark mb-2 text-center">${UI.escape(g.name)}</h3>
        ${g.companions > 0 ? `<span class="badge badge-blush mt-2">+${g.companions} acompanhante${g.companions>1?'s':''}</span>` : ''}
      `;
      this._deck.appendChild(card);
      if (idx === arr.length - 1) this._attachSwipe(card);
    });

    // Stats
    const total = State.guests.length;
    const confirmed = State.guests.filter(g => g.status === 'confirmed').length;
    const declined = State.guests.filter(g => g.status === 'declined').length;
    const pendingN = State.guests.filter(g => g.status === 'pending').length;
    document.getElementById('rsvp-stats').innerHTML = `
      <div class="text-center p-3 rounded-xl bg-green-50"><div class="text-2xl font-bold text-green-700">${confirmed}</div><div class="text-[10px] uppercase tracking-wider text-green-600">Sim</div></div>
      <div class="text-center p-3 rounded-xl bg-gray-50"><div class="text-2xl font-bold text-gray-700">${pendingN}</div><div class="text-[10px] uppercase tracking-wider text-gray-500">Aguarda</div></div>
      <div class="text-center p-3 rounded-xl bg-red-50"><div class="text-2xl font-bold text-red-700">${declined}</div><div class="text-[10px] uppercase tracking-wider text-red-600">Não</div></div>
    `;
  },

  _attachSwipe(card) {
    let startX, startY, dx = 0, dy = 0, dragging = false;
    const overlayYes = card.querySelector('.tinder-overlay.yes');
    const overlayNo = card.querySelector('.tinder-overlay.no');

    const onStart = e => {
      dragging = true; card.classList.add('dragging');
      const pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX; startY = pt.clientY;
    };
    const onMove = e => {
      if (!dragging) return;
      const pt = e.touches ? e.touches[0] : e;
      dx = pt.clientX - startX; dy = pt.clientY - startY;
      const rot = dx * 0.06;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
      overlayYes.style.opacity = Math.max(0, Math.min(1, dx / 100));
      overlayNo.style.opacity = Math.max(0, Math.min(1, -dx / 100));
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false; card.classList.remove('dragging');
      if (Math.abs(dx) > 110) {
        const dir = dx > 0 ? 'confirmed' : 'declined';
        card.style.transform = `translate(${dx > 0 ? '150%' : '-150%'}, ${dy}px) rotate(${dx > 0 ? 30 : -30}deg)`;
        card.style.opacity = '0';
        setTimeout(() => this.commit(card.dataset.id, dir), 250);
      } else {
        card.style.transform = ''; overlayYes.style.opacity = 0; overlayNo.style.opacity = 0;
      }
    };

    card.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    card.addEventListener('touchstart', onStart, { passive: true });
    card.addEventListener('touchmove', onMove, { passive: true });
    card.addEventListener('touchend', onEnd);
  },

  decide(status, isMaybe) {
    const top = this._deck.querySelector('.tinder-card:last-child');
    if (!top) return;
    if (status === 'confirmed') {
      top.style.transform = 'translate(150%, -50px) rotate(30deg)';
    } else if (status === 'declined') {
      top.style.transform = 'translate(-150%, -50px) rotate(-30deg)';
    } else {
      top.style.transform = 'translateY(-150%)';
    }
    top.style.opacity = '0';
    setTimeout(() => this.commit(top.dataset.id, status), 250);
  },

  async commit(guestId, status) {
    if (!Permissions.enforceRole('rsvp.swipe')) return;
    await DB.update('guests', guestId, { status });
    if (status === 'confirmed') confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
  }
};

// ============================================================
//  INVITES (convites digitais — preview + público)
// ============================================================
Modules.invites = {
  render(container) {
    const url = `${window.location.origin}${window.location.pathname}?invite=${State.weddingId}`;
    container.innerHTML = `
      <div class="mb-6">
        <h2 class="text-2xl font-bold font-serif">Convite digital</h2>
        <p class="text-sm text-muted">Compartilhe o link com seus convidados pra confirmação automática.</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 class="font-bold mb-3">Pré-visualização</h3>
          <div class="invite-preview">
            <div class="text-xs uppercase tracking-[0.3em] text-gold mb-3">Save the Date</div>
            <h1 class="text-4xl font-serif text-dark mb-2">${UI.escape((State.wedding?.names)||'—')}</h1>
            <div class="w-16 h-px bg-gold mx-auto my-4"></div>
            <p class="text-muted">vão se casar em</p>
            <p class="text-2xl font-bold text-dark my-2">${UI.date(State.wedding?.date)}</p>
            ${State.wedding?.place ? `<p class="text-sm text-muted">${UI.escape(State.wedding.place)}</p>` : ''}
            <button class="mt-6 bg-gold text-white px-6 py-2.5 rounded-full font-semibold shadow-lg">Confirmar presença</button>
          </div>
        </div>

        <div>
          <h3 class="font-bold mb-3">Distribuição</h3>
          <div class="space-y-3">
            <div class="module-card">
              <label class="text-xs font-bold text-muted uppercase">Link do convite</label>
              <div class="flex items-center gap-2 mt-2">
                <input id="invite-url" readonly value="${url}" class="flex-grow p-2 bg-gray-50 rounded-lg text-xs">
                <button id="copy-url" class="bg-dark text-white px-3 py-2 rounded-lg text-xs"><i class="fa-solid fa-copy"></i></button>
              </div>
            </div>
            <div class="module-card">
              <div class="font-bold mb-2"><i class="fa-brands fa-whatsapp text-green-500"></i> Disparo via WhatsApp</div>
              <p class="text-sm text-muted mb-3">Use a aba <b>Mensagens</b> pra disparar pra cada família com link personalizado.</p>
              <button id="go-msg" class="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Ir pra mensagens</button>
            </div>
            <div class="module-card opacity-60">
              <div class="font-bold mb-2"><i class="fa-solid fa-palette text-gold"></i> Personalizar template</div>
              <p class="text-sm text-muted">Em breve: escolher tema, fotos, animações.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('copy-url').addEventListener('click', () => {
      navigator.clipboard.writeText(url);
      UI.toast('Link copiado');
    });
    document.getElementById('go-msg').addEventListener('click', () => Router.navigate('messages'));
  }
};

// ============================================================
//  VENDORS (fornecedores)
// ============================================================
Modules.vendors = {
  _unsubs: [],

  render(container) {
    const canEdit = Permissions.can('vendors.create');
    container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold font-serif">Fornecedores</h2>
          <p class="text-sm text-muted">Compare orçamentos, contatos, status de contrato.</p>
        </div>
        ${canEdit ? `<button id="btn-add-v" class="bg-dark text-white px-4 py-2 rounded-xl text-sm font-semibold"><i class="fa-solid fa-plus mr-2"></i>Novo</button>` : ''}
      </div>
      <div id="vendors-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
    `;
    if (canEdit) document.getElementById('btn-add-v').addEventListener('click', () => this.add());
    this.refresh();
    this._unsubs.forEach(u => u());
    this._unsubs = [State.subscribe('vendors', () => this.refresh())];
  },

  refresh() {
    const grid = document.getElementById('vendors-grid');
    if (State.vendors.length === 0) {
      grid.innerHTML = `<div class="empty-state col-span-full"><i class="fa-solid fa-store"></i><p>Nenhum fornecedor cadastrado.</p></div>`;
      return;
    }
    const canEdit = Permissions.can('vendors.create');
    const canDel = Permissions.can('vendors.delete');
    grid.innerHTML = State.vendors.map(v => `
      <div class="module-card">
        <div class="flex justify-between items-start mb-2">
          <div>
            <h3 class="font-bold">${UI.escape(v.name)}</h3>
            <span class="badge badge-gold">${UI.escape(v.category||'Outros')}</span>
          </div>
          ${canDel ? `<button data-del="${v.id}" class="text-gray-300 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>` : ''}
        </div>
        ${v.phone ? `<div class="text-xs text-muted mt-2"><i class="fa-solid fa-phone mr-1"></i>${UI.escape(v.phone)}</div>` : ''}
        ${v.email ? `<div class="text-xs text-muted"><i class="fa-solid fa-envelope mr-1"></i>${UI.escape(v.email)}</div>` : ''}
        ${v.notes ? `<p class="text-xs text-muted mt-2 line-clamp-2">${UI.escape(v.notes)}</p>` : ''}
        <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span class="text-sm font-bold">${v.budget ? UI.money(v.budget) : '—'}</span>
          <span class="badge ${v.status === 'hired' ? 'badge-green' : v.status === 'considering' ? 'badge-blue' : 'badge-gray'}">
            ${v.status === 'hired' ? 'Contratado' : v.status === 'considering' ? 'Em análise' : 'Pesquisando'}
          </span>
        </div>
      </div>
    `).join('');
    grid.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => this.del(b.dataset.del)));
  },

  async add() {
    const cats = WP_CONFIG.VENDOR_CATEGORIES.map(c => `<option>${c}</option>`).join('');
    const html = `
      <input id="v-name" class="swal2-input" placeholder="Nome">
      <select id="v-cat" class="swal2-select">${cats}</select>
      <input id="v-phone" class="swal2-input" placeholder="Telefone">
      <input id="v-email" class="swal2-input" placeholder="E-mail">
      <input id="v-budget" type="number" class="swal2-input" placeholder="Orçamento R$">
      <select id="v-status" class="swal2-select">
        <option value="researching">Pesquisando</option>
        <option value="considering">Em análise</option>
        <option value="hired">Contratado</option>
      </select>
      <textarea id="v-notes" class="swal2-textarea" placeholder="Observações"></textarea>
    `;
    const data = await UI.modal({
      title: 'Novo fornecedor', html,
      preConfirm: () => ({
        name: document.getElementById('v-name').value.trim(),
        category: document.getElementById('v-cat').value,
        phone: document.getElementById('v-phone').value,
        email: document.getElementById('v-email').value,
        budget: parseFloat(document.getElementById('v-budget').value) || 0,
        status: document.getElementById('v-status').value,
        notes: document.getElementById('v-notes').value
      })
    });
    if (!data || !data.name) return;
    await DB.add('vendors', data);
    UI.toast('Fornecedor adicionado');
  },

  async del(id) {
    const ok = await UI.confirm('Excluir fornecedor?', 'Essa ação não pode ser desfeita.');
    if (!ok) return;
    await DB.remove('vendors', id);
  }
};

// ============================================================
//  FINANCES
// ============================================================
Modules.finances = {
  _unsubs: [],

  render(container) {
    const canEdit = Permissions.can('finances.create');
    container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold font-serif">Controle de custos</h2>
          <p class="text-sm text-muted">Veja em tempo real quanto cada categoria está pesando.</p>
        </div>
        ${canEdit ? `<button id="btn-add-fin" class="bg-dark text-white px-4 py-2 rounded-xl text-sm font-semibold"><i class="fa-solid fa-plus mr-2"></i>Novo gasto</button>` : ''}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div class="module-card text-center"><div class="text-xs text-muted uppercase">Total previsto</div><div id="fin-total" class="text-2xl font-bold text-dark">R$ 0</div></div>
        <div class="module-card text-center"><div class="text-xs text-muted uppercase">Pago</div><div id="fin-paid" class="text-2xl font-bold text-green-600">R$ 0</div></div>
        <div class="module-card text-center"><div class="text-xs text-muted uppercase">A pagar</div><div id="fin-pending" class="text-2xl font-bold text-red-500">R$ 0</div></div>
      </div>

      <div class="glass-card rounded-2xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="bg-gray-50 text-xs uppercase tracking-wider text-muted">
                <th class="p-4">Item</th><th class="p-4">Categoria</th>
                <th class="p-4">Valor</th><th class="p-4">Pago</th>
                <th class="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody id="fin-rows" class="divide-y divide-gray-100 text-sm"></tbody>
          </table>
        </div>
      </div>
    `;
    if (canEdit) document.getElementById('btn-add-fin').addEventListener('click', () => this.add());
    this.refresh();
    this._unsubs.forEach(u => u());
    this._unsubs = [State.subscribe('finances', () => this.refresh())];
  },

  refresh() {
    const total = State.finances.reduce((a,e) => a + Number(e.amount||0), 0);
    const paid = State.finances.reduce((a,e) => a + Number(e.paidAmount||0), 0);
    document.getElementById('fin-total').innerText = UI.money(total);
    document.getElementById('fin-paid').innerText = UI.money(paid);
    document.getElementById('fin-pending').innerText = UI.money(total - paid);

    const tbody = document.getElementById('fin-rows');
    if (State.finances.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-receipt"></i><p>Nenhum gasto ainda.</p></td></tr>`;
      return;
    }
    const canEdit = Permissions.can('finances.edit');
    const canDel = Permissions.can('finances.delete');
    tbody.innerHTML = State.finances.map(e => {
      const pct = (e.amount && e.amount > 0) ? Math.round((e.paidAmount||0)/e.amount*100) : 0;
      return `
        <tr class="hover:bg-gray-50">
          <td class="p-4 font-medium">${UI.escape(e.name)}</td>
          <td class="p-4"><span class="badge badge-gray">${UI.escape(e.category||'Outros')}</span></td>
          <td class="p-4 font-semibold">${UI.money(e.amount)}</td>
          <td class="p-4">
            <div class="flex items-center gap-2">
              <div class="flex-grow h-1.5 bg-gray-200 rounded-full"><div class="h-full bg-green-500 rounded-full" style="width:${pct}%"></div></div>
              <span class="text-xs font-bold">${pct}%</span>
            </div>
          </td>
          <td class="p-4 text-right">
            ${canEdit ? `<button data-pay="${e.id}" class="text-green-600 px-2"><i class="fa-solid fa-money-bill"></i></button>` : ''}
            ${canDel ? `<button data-del="${e.id}" class="text-red-400 px-2"><i class="fa-solid fa-trash"></i></button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
    tbody.querySelectorAll('[data-pay]').forEach(b => b.addEventListener('click', () => this.pay(b.dataset.pay)));
    tbody.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => this.del(b.dataset.del)));
  },

  async add() {
    const cats = WP_CONFIG.EXPENSE_CATEGORIES.map(c => `<option>${c}</option>`).join('');
    const html = `
      <input id="f-name" class="swal2-input" placeholder="Item">
      <select id="f-cat" class="swal2-select">${cats}</select>
      <input id="f-amount" type="number" step="0.01" class="swal2-input" placeholder="Valor total">
    `;
    const data = await UI.modal({
      title: 'Novo gasto', html,
      preConfirm: () => ({
        name: document.getElementById('f-name').value.trim(),
        category: document.getElementById('f-cat').value,
        amount: parseFloat(document.getElementById('f-amount').value) || 0,
        paidAmount: 0
      })
    });
    if (!data || !data.name) return;
    await DB.add('finances', data);
    UI.toast('Gasto registrado');
  },

  async pay(id) {
    const e = State.finances.find(x => x.id === id); if (!e) return;
    const v = await UI.prompt('Registrar pagamento', {
      type: 'number',
      label: `Restante: ${UI.money(e.amount - (e.paidAmount||0))}`,
      placeholder: '0,00'
    });
    if (!v) return;
    const newPaid = Math.min(e.amount, (e.paidAmount||0) + parseFloat(v));
    await DB.update('finances', id, { paidAmount: newPaid });
    UI.toast('Pagamento registrado');
  },

  async del(id) {
    const ok = await UI.confirm('Excluir gasto?'); if (!ok) return;
    await DB.remove('finances', id);
  }
};

// ============================================================
//  CONTRACTS
// ============================================================
Modules.contracts = {
  _unsubs: [],

  render(container) {
    const canEdit = Permissions.can('contracts.create');
    container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold font-serif">Contratos</h2>
          <p class="text-sm text-muted">Acompanhe status, datas de assinatura e prazos.</p>
        </div>
        ${canEdit ? `<button id="btn-add-c" class="bg-dark text-white px-4 py-2 rounded-xl text-sm font-semibold"><i class="fa-solid fa-plus mr-2"></i>Novo</button>` : ''}
      </div>
      <div id="contracts-list" class="space-y-3"></div>
    `;
    if (canEdit) document.getElementById('btn-add-c').addEventListener('click', () => this.add());
    this.refresh();
    this._unsubs.forEach(u => u());
    this._unsubs = [State.subscribe('contracts', () => this.refresh())];
  },

  refresh() {
    const list = document.getElementById('contracts-list');
    if (State.contracts.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-file-signature"></i><p>Nenhum contrato cadastrado.</p></div>`;
      return;
    }
    list.innerHTML = State.contracts.map(c => `
      <div class="module-card flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-blush flex items-center justify-center text-gold"><i class="fa-solid fa-file-signature text-xl"></i></div>
        <div class="flex-grow overflow-hidden">
          <h3 class="font-bold truncate">${UI.escape(c.vendor)}</h3>
          <div class="text-xs text-muted">${UI.escape(c.category||'')} · ${UI.money(c.value)}</div>
        </div>
        <div class="text-right">
          <span class="badge ${c.status==='signed'?'badge-green':c.status==='draft'?'badge-gray':'badge-blue'}">${c.status==='signed'?'Assinado':c.status==='draft'?'Rascunho':'Em revisão'}</span>
          ${c.signedAt ? `<div class="text-[10px] text-muted mt-1">${UI.date(c.signedAt)}</div>` : ''}
        </div>
        <button data-del="${c.id}" class="text-gray-300 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
      </div>
    `).join('');
    list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => this.del(b.dataset.del)));
  },

  async add() {
    const html = `
      <input id="c-vendor" class="swal2-input" placeholder="Fornecedor">
      <input id="c-cat" class="swal2-input" placeholder="Categoria">
      <input id="c-val" type="number" class="swal2-input" placeholder="Valor R$">
      <select id="c-status" class="swal2-select">
        <option value="draft">Rascunho</option>
        <option value="review">Em revisão</option>
        <option value="signed">Assinado</option>
      </select>
    `;
    const data = await UI.modal({
      title: 'Novo contrato', html,
      preConfirm: () => ({
        vendor: document.getElementById('c-vendor').value.trim(),
        category: document.getElementById('c-cat').value,
        value: parseFloat(document.getElementById('c-val').value) || 0,
        status: document.getElementById('c-status').value
      })
    });
    if (!data || !data.vendor) return;
    await DB.add('contracts', data);
    UI.toast('Contrato adicionado');
  },

  async del(id) {
    const ok = await UI.confirm('Excluir contrato?'); if (!ok) return;
    await DB.remove('contracts', id);
  }
};

// ============================================================
//  RAFFLES (rifa/gravata)
// ============================================================
Modules.raffles = {
  _unsubs: [],

  render(container) {
    const canCreate = Permissions.can('raffles.create');
    const canDraw = Permissions.can('raffles.draw');
    container.innerHTML = `
      <div class="glass-card p-6 rounded-3xl text-center max-w-2xl mx-auto mb-6">
        <h2 class="text-2xl font-bold font-serif mb-2">Rifa / Gravata</h2>
        <p class="text-sm text-muted mb-4">Arrecadação organizada por família</p>
        <div class="text-left mb-4">
          <div class="flex justify-between text-sm font-semibold mb-2">
            <span>Arrecadado: <span id="r-current" class="text-green-600 text-lg">R$ 0</span></span>
            <span>Meta: <span id="r-goal">R$ 5.000</span></span>
          </div>
          <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div id="r-bar" class="h-full bg-gradient-to-r from-gold to-yellow-300 transition-all duration-1000" style="width:0%"></div>
          </div>
        </div>
        <div class="flex justify-center gap-3 flex-wrap">
          ${canCreate ? `<button id="r-add" class="bg-gold text-white px-6 py-2 rounded-full font-bold"><i class="fa-solid fa-cart-plus mr-2"></i>Registrar venda</button>` : ''}
          ${canDraw ? `<button id="r-draw" class="bg-dark text-white px-6 py-2 rounded-full font-bold"><i class="fa-solid fa-trophy mr-2"></i>Sortear</button>` : ''}
        </div>
      </div>
      <div class="max-w-2xl mx-auto">
        <h3 class="font-bold mb-3 text-sm uppercase tracking-wider text-muted">Vendas por família</h3>
        <ul id="r-list" class="space-y-2"></ul>
      </div>
    `;
    if (canCreate) document.getElementById('r-add').addEventListener('click', () => this.add());
    if (canDraw) document.getElementById('r-draw').addEventListener('click', () => this.draw());
    this.refresh();
    this._unsubs.forEach(u => u());
    this._unsubs = [State.subscribe('raffles', () => this.refresh())];
  },

  refresh() {
    const meta = State.wedding?.settings?.metaRifa || 5000;
    const total = State.raffles.reduce((a,r) => a + Number(r.amount||0), 0);
    document.getElementById('r-current').innerText = UI.money(total);
    document.getElementById('r-goal').innerText = UI.money(meta);
    document.getElementById('r-bar').style.width = Math.min(100, total/meta*100) + '%';

    const list = document.getElementById('r-list');
    if (State.raffles.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-ticket"></i><p>Nenhuma venda registrada.</p></div>`;
      return;
    }
    list.innerHTML = State.raffles.map(r => {
      const fName = State.families.find(f => f.id === r.familyId)?.name || 'Avulso';
      return `
        <li class="module-card flex justify-between items-center">
          <div>
            <div class="font-bold text-sm"><i class="fa-solid fa-people-roof text-gold mr-1"></i> ${UI.escape(fName)}</div>
            <div class="mt-1">${(r.numbers||[]).map(n => `<span class="raffle-ticket">${n}</span>`).join('')}</div>
          </div>
          <div class="font-bold text-green-600">${UI.money(r.amount)}</div>
        </li>
      `;
    }).join('');
  },

  async add() {
    const fams = State.families.map(f => `<option value="${f.id}">${UI.escape(f.name)}</option>`).join('');
    if (!fams) { UI.toast('Cadastre uma família primeiro', 'warning'); return; }
    const html = `
      <select id="r-fam" class="swal2-select">${fams}</select>
      <input id="r-amt" type="number" class="swal2-input" placeholder="Valor arrecadado">
      <input id="r-qty" type="number" class="swal2-input" placeholder="Quantos números">
    `;
    const data = await UI.modal({
      title: 'Registrar venda', html,
      preConfirm: () => ({
        familyId: document.getElementById('r-fam').value,
        amount: parseFloat(document.getElementById('r-amt').value) || 0,
        qty: parseInt(document.getElementById('r-qty').value) || 0
      })
    });
    if (!data || data.qty <= 0) return;
    const next = State.wedding?.settings?.nextRaffleNumber || 1;
    const numbers = [];
    for (let i = 0; i < data.qty; i++) numbers.push(next + i);
    await DB.add('raffles', { familyId: data.familyId, amount: data.amount, numbers });
    await DB.updateWedding({ 'settings.nextRaffleNumber': next + data.qty });
    confetti({ particleCount: 80, spread: 70 });
    UI.toast('Venda registrada');
  },

  async draw() {
    const all = [];
    State.raffles.forEach(r => (r.numbers||[]).forEach(n => all.push({ num: n, fam: r.familyId })));
    if (all.length === 0) { UI.toast('Nenhum número vendido', 'warning'); return; }
    const win = all[Math.floor(Math.random() * all.length)];
    const famName = State.families.find(f => f.id === win.fam)?.name || 'Avulso';
    Swal.fire({
      title: '🏆 Ganhador!',
      html: `<div class="text-5xl text-gold font-bold my-4">Nº ${win.num}</div><div class="text-xl">${UI.escape(famName)}</div>`,
      icon: 'success'
    });
    confetti({ particleCount: 200, spread: 80 });
  }
};

// ============================================================
//  TIMELINE (cronograma)
// ============================================================
Modules.timeline = {
  _unsubs: [],

  render(container) {
    const canEdit = Permissions.can('timeline.edit');
    container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold font-serif">Cronograma</h2>
          <p class="text-sm text-muted">Marcos importantes até o grande dia.</p>
        </div>
        ${canEdit ? `<button id="tl-add" class="bg-dark text-white px-4 py-2 rounded-xl text-sm font-semibold"><i class="fa-solid fa-plus mr-2"></i>Evento</button>` : ''}
      </div>
      <div id="tl-list"></div>
    `;
    if (canEdit) document.getElementById('tl-add').addEventListener('click', () => this.add());
    this.refresh();
    this._unsubs.forEach(u => u());
    this._unsubs = [State.subscribe('timeline', () => this.refresh())];
  },

  refresh() {
    const list = document.getElementById('tl-list');
    if (State.timeline.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-calendar-days"></i><p>Nenhum evento ainda.</p></div>`;
      return;
    }
    const sorted = [...State.timeline].sort((a,b) => (a.date||'').localeCompare(b.date||''));
    const canEdit = Permissions.can('timeline.edit');
    list.innerHTML = sorted.map(t => `
      <div class="timeline-item">
        <div class="flex justify-between items-start">
          <div>
            <div class="text-xs text-muted">${UI.date(t.date)}</div>
            <h4 class="font-bold mt-0.5">${UI.escape(t.title)}</h4>
            ${t.notes ? `<p class="text-sm text-muted mt-1">${UI.escape(t.notes)}</p>` : ''}
          </div>
          ${canEdit ? `<button data-del="${t.id}" class="text-gray-300 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>` : ''}
        </div>
      </div>
    `).join('');
    list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => this.del(b.dataset.del)));
  },

  async add() {
    const html = `
      <input id="t-title" class="swal2-input" placeholder="Título">
      <input id="t-date" type="date" class="swal2-input">
      <textarea id="t-notes" class="swal2-textarea" placeholder="Observações"></textarea>
    `;
    const data = await UI.modal({
      title: 'Novo evento', html,
      preConfirm: () => ({
        title: document.getElementById('t-title').value.trim(),
        date: document.getElementById('t-date').value,
        notes: document.getElementById('t-notes').value
      })
    });
    if (!data || !data.title) return;
    await DB.add('timeline', data);
    UI.toast('Evento criado');
  },

  async del(id) { const ok = await UI.confirm('Excluir evento?'); if (ok) await DB.remove('timeline', id); }
};

// ============================================================
//  TASKS (checklist kanban)
// ============================================================
Modules.tasks = {
  _unsubs: [],

  render(container) {
    container.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold font-serif">Checklist</h2>
          <p class="text-sm text-muted">Arraste cards entre as colunas.</p>
        </div>
        <button id="task-add" class="bg-dark text-white px-4 py-2 rounded-xl text-sm font-semibold"><i class="fa-solid fa-plus mr-2"></i>Tarefa</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="kanban-col" data-col="todo">
          <h3 class="font-bold text-sm uppercase tracking-wider text-muted mb-3">A fazer</h3>
          <div data-drop="todo"></div>
        </div>
        <div class="kanban-col" data-col="doing">
          <h3 class="font-bold text-sm uppercase tracking-wider text-muted mb-3">Em andamento</h3>
          <div data-drop="doing"></div>
        </div>
        <div class="kanban-col" data-col="done">
          <h3 class="font-bold text-sm uppercase tracking-wider text-muted mb-3">Concluído</h3>
          <div data-drop="done"></div>
        </div>
      </div>
    `;
    document.getElementById('task-add').addEventListener('click', () => this.add());
    this.refresh();
    this._unsubs.forEach(u => u());
    this._unsubs = [State.subscribe('tasks', () => this.refresh())];
  },

  refresh() {
    document.querySelectorAll('[data-drop]').forEach(zone => {
      const col = zone.dataset.drop;
      const items = State.tasks.filter(t => (t.column || (t.done ? 'done' : 'todo')) === col);
      zone.innerHTML = items.map(t => `
        <div class="kanban-card" draggable="true" data-task="${t.id}">
          <div class="flex justify-between items-start">
            <span class="text-sm ${t.done?'line-through text-gray-400':''}">${UI.escape(t.title)}</span>
            <button data-del="${t.id}" class="text-gray-300 hover:text-red-500 text-xs"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `).join('');
      zone.ondragover = e => { e.preventDefault(); zone.parentElement.classList.add('drag-over'); };
      zone.ondragleave = () => zone.parentElement.classList.remove('drag-over');
      zone.ondrop = async e => {
        e.preventDefault();
        zone.parentElement.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        await DB.update('tasks', id, { column: col, done: col === 'done' });
      };
    });
    document.querySelectorAll('[data-task]').forEach(card => {
      card.ondragstart = e => e.dataTransfer.setData('text/plain', card.dataset.task);
    });
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => DB.remove('tasks', b.dataset.del));
  },

  async add() {
    const title = await UI.prompt('Nova tarefa', { placeholder: 'Ex: Marcar prova do vestido' });
    if (!title) return;
    await DB.add('tasks', { title, done: false, column: 'todo' });
  }
};

// ============================================================
//  MESSAGES
// ============================================================
Modules.messages = {
  render(container) {
    container.innerHTML = `
      <div class="mb-6">
        <h2 class="text-2xl font-bold font-serif">Central de comunicação</h2>
        <p class="text-sm text-muted">Use a tag <code class="bg-gray-100 px-1 rounded text-pink-600 font-bold">[Familia]</code> pra personalizar a mensagem.</p>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="module-card">
          <h3 class="font-bold mb-3">Rascunho</h3>
          <textarea id="msg-draft" class="w-full min-h-[200px] p-3 rounded-xl border border-gray-200 text-sm" placeholder="Oi [Familia], passando pra lembrar de confirmar a presença!"></textarea>
          <div class="flex gap-2 mt-3">
            <button id="msg-enhance" class="flex-1 bg-gradient-to-r from-yellow-400 to-gold text-white font-bold py-2.5 rounded-xl"><i class="fa-solid fa-wand-magic-sparkles"></i> Melhorar com IA</button>
            <button id="msg-build" class="bg-dark text-white font-bold px-6 py-2.5 rounded-xl"><i class="fa-solid fa-arrow-right"></i></button>
          </div>
        </div>
        <div class="module-card">
          <h3 class="font-bold mb-3"><i class="fa-brands fa-whatsapp text-green-500 mr-1"></i>Fila de disparo</h3>
          <ul id="msg-queue" class="space-y-2 max-h-[400px] overflow-y-auto">
            <li class="text-center text-muted text-sm italic py-8">Gere o rascunho ao lado.</li>
          </ul>
        </div>
      </div>
    `;
    document.getElementById('msg-enhance').addEventListener('click', () => this.enhance());
    document.getElementById('msg-build').addEventListener('click', () => this.build());
  },

  enhance() {
    const ta = document.getElementById('msg-draft');
    const draft = ta.value.trim();
    if (!draft) { UI.toast('Escreva algo antes', 'warning'); return; }
    let improved = draft;
    if (!improved.includes('[Familia]')) improved = `Oi, família [Familia]!\n\n` + improved;
    improved = improved.charAt(0).toUpperCase() + improved.slice(1);
    if (!improved.toLowerCase().includes('com carinho') && !improved.toLowerCase().includes('abraços')) {
      improved += `\n\nContamos com vocês! 🥂\nCom carinho`;
    }
    ta.value = '';
    let i = 0;
    const iv = setInterval(() => {
      ta.value += improved[i++];
      if (i >= improved.length) clearInterval(iv);
    }, 12);
  },

  build() {
    const draft = document.getElementById('msg-draft').value.trim();
    if (!draft) { UI.toast('Escreva a mensagem primeiro', 'error'); return; }
    const ul = document.getElementById('msg-queue');
    const inviteUrl = `${location.origin}${location.pathname}?invite=${State.weddingId}`;
    const items = State.families.filter(f => f.phone && f.phone.length >= 8);
    if (items.length === 0) {
      ul.innerHTML = `<li class="text-center text-red-500 text-sm py-6">Vincule WhatsApp às famílias primeiro.</li>`;
      return;
    }
    ul.innerHTML = items.map(f => {
      const txt = draft.replace(/\[Familia\]/g, f.name) + `\n\nConfirme aqui: ${inviteUrl}`;
      const url = `https://wa.me/55${f.phone}?text=${encodeURIComponent(txt)}`;
      return `
        <li class="flex justify-between items-center p-3 bg-white rounded-xl border">
          <div><div class="font-bold text-sm">${UI.escape(f.name)}</div><div class="text-[10px] text-muted">${UI.escape(f.phone)}</div></div>
          <a href="${url}" target="_blank" class="bg-green-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold">Disparar</a>
        </li>
      `;
    }).join('');
  }
};

// ============================================================
//  SETTINGS
// ============================================================
Modules.settings = {
  render(container) {
    const w = State.wedding || {};
    container.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-6">
        <h2 class="text-2xl font-bold font-serif">Ajustes do casamento</h2>

        <div class="module-card">
          <h3 class="font-bold mb-4">Informações básicas</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-muted uppercase">Nomes</label>
              <input id="s-names" class="w-full p-2.5 mt-1 border border-gray-200 rounded-lg" value="${UI.escape(w.names||'')}">
            </div>
            <div>
              <label class="text-xs font-bold text-muted uppercase">Data</label>
              <input id="s-date" type="date" class="w-full p-2.5 mt-1 border border-gray-200 rounded-lg" value="${w.date||''}">
            </div>
            <div class="md:col-span-2">
              <label class="text-xs font-bold text-muted uppercase">Local</label>
              <input id="s-place" class="w-full p-2.5 mt-1 border border-gray-200 rounded-lg" value="${UI.escape(w.place||'')}">
            </div>
          </div>
          <button id="s-save" class="mt-4 bg-dark text-white px-5 py-2 rounded-xl text-sm font-semibold">Salvar</button>
        </div>

        <div class="module-card">
          <h3 class="font-bold mb-2">Colaboradores</h3>
          <p class="text-sm text-muted mb-4">Convide cerimonialista, família ou outros administradores. Cada um terá acesso só ao que o papel permite.</p>
          <div id="member-list" class="space-y-2 mb-4"></div>
          ${Permissions.can('settings.invite') ? `<button id="s-invite" class="bg-gold text-white px-4 py-2 rounded-xl text-sm font-semibold"><i class="fa-solid fa-user-plus mr-2"></i>Convidar</button>` : ''}
        </div>

        <div class="module-card">
          <h3 class="font-bold mb-2">Plano</h3>
          <div class="flex items-center justify-between">
            <div>
              <span class="badge ${State.plan==='premium'?'badge-premium':'badge-gold'}">${(State.plan||'free').toUpperCase()}</span>
              <p class="text-sm text-muted mt-2">${State.plan==='premium' ? 'Tudo liberado.' : 'Plano gratuito com limites.'}</p>
            </div>
            ${State.plan!=='premium' ? `<button id="s-upgrade" class="bg-gradient-to-r from-gold to-yellow-400 text-white px-5 py-2.5 rounded-xl font-bold"><i class="fa-solid fa-crown mr-2"></i>Upgrade Premium</button>` : ''}
          </div>
        </div>

        <div class="module-card border border-red-200 bg-red-50/30">
          <h3 class="font-bold mb-2 text-red-700">Zona de perigo</h3>
          <p class="text-sm text-muted mb-4">Cuidado, essas ações não podem ser desfeitas.</p>
          ${Permissions.can('settings.deleteWedding') ? `<button id="s-delete" class="text-red-600 border border-red-300 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-100">Excluir esse casamento</button>` : ''}
        </div>
      </div>
    `;

    document.getElementById('s-save').addEventListener('click', () => this.save());
    document.getElementById('s-invite')?.addEventListener('click', () => this.invite());
    document.getElementById('s-upgrade')?.addEventListener('click', () => App.startUpgradeFlow());
    document.getElementById('s-delete')?.addEventListener('click', () => this.deleteWedding());
    this._renderMembers();
  },

  _renderMembers() {
    const list = document.getElementById('member-list');
    const members = State.wedding?.members || {};
    list.innerHTML = Object.entries(members).map(([uid, m]) => `
      <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
        <div>
          <div class="font-bold text-sm">${uid === State.user.uid ? 'Você' : uid.slice(0,8)+'…'}</div>
          <span class="badge badge-gold">${WP_CONFIG.ROLE_LABELS[m.role]||m.role}</span>
        </div>
        ${uid !== State.user.uid && Permissions.can('settings.invite') ? `<button data-rm="${uid}" class="text-red-500 text-sm hover:underline">Remover</button>` : ''}
      </div>
    `).join('');
    list.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', async () => {
      const ok = await UI.confirm('Remover colaborador?');
      if (ok) await DB.removeCollaborator(State.weddingId, b.dataset.rm);
    }));
  },

  async save() {
    await DB.updateWedding({
      names: document.getElementById('s-names').value.trim(),
      date: document.getElementById('s-date').value,
      place: document.getElementById('s-place').value.trim()
    });
    UI.toast('Salvo');
  },

  async invite() {
    const html = `
      <input id="i-email" type="email" class="swal2-input" placeholder="E-mail do colaborador">
      <select id="i-role" class="swal2-select">
        <option value="admin">Administrador</option>
        <option value="planner">Cerimonialista</option>
        <option value="family">Família</option>
        <option value="viewer">Convidado de honra (só leitura)</option>
      </select>
    `;
    const data = await UI.modal({
      title: 'Convidar colaborador', html,
      preConfirm: () => ({
        email: document.getElementById('i-email').value.trim(),
        role: document.getElementById('i-role').value
      })
    });
    if (!data || !data.email) return;
    await DB.inviteCollaborator(State.weddingId, data.email, data.role);
    UI.toast('Convite registrado (envio por e-mail vai ativar via Cloud Functions)', 'info');
  },

  async deleteWedding() {
    const ok = await UI.confirm('Excluir casamento?', 'Todos os dados serão apagados permanentemente.', 'Sim, excluir');
    if (!ok) return;
    // Soft strategy: marca como deleted; em produção, usar Cloud Function pra apagar subcoleções.
    await DB.updateWedding({ deleted: true });
    UI.toast('Casamento excluído', 'success');
    location.reload();
  }
};

window.Modules = Modules;
