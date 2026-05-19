/* ============================================================
 *  ui.js — Componentes de UI reutilizáveis e formatadores.
 *  Tudo que era SweetAlert solto vira função clara aqui.
 * ============================================================ */

const UI = {

  // ---------- TOAST ----------
  toast(msg, type = 'success') {
    const icon = type === 'success' ? 'success'
                : type === 'error' ? 'error'
                : type === 'warning' ? 'warning' : 'info';
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title: msg,
      showConfirmButton: false,
      timer: 2800,
      timerProgressBar: true
    });
  },

  // ---------- LOADING ----------
  loading(msg = 'Processando…') {
    Swal.fire({
      title: msg,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
  },

  // ---------- CONFIRM ----------
  async confirm(title, text, confirmText = 'Sim') {
    const result = await Swal.fire({
      title,
      text,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar'
    });
    return result.isConfirmed;
  },

  // ---------- PROMPT (input) ----------
  async prompt(title, opts = {}) {
    const result = await Swal.fire({
      title,
      input: opts.type || 'text',
      inputLabel: opts.label,
      inputValue: opts.value || '',
      inputPlaceholder: opts.placeholder,
      showCancelButton: true,
      confirmButtonText: opts.confirmText || 'Salvar',
      cancelButtonText: 'Cancelar',
      inputValidator: opts.validator
    });
    return result.isConfirmed ? result.value : null;
  },

  // ---------- MODAL CUSTOM (HTML) ----------
  async modal({ title, html, confirmText = 'Salvar', preConfirm }) {
    const result = await Swal.fire({
      title,
      html,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      preConfirm,
      width: '32rem'
    });
    return result.isConfirmed ? result.value : null;
  },

  // ---------- UPGRADE PROMPT ----------
  showUpgradePrompt(moduleId) {
    const mod = WP_CONFIG.MODULES.find(m => m.id === moduleId);
    Swal.fire({
      title: '✨ Recurso Premium',
      html: `
        <p class="mb-4 text-muted">O módulo <b>${mod?.label || moduleId}</b> está disponível apenas no plano <b>Premium</b>.</p>
        <div class="text-left bg-blush/30 p-4 rounded-xl text-sm">
          <div class="font-bold text-gold mb-2">No Premium você tem:</div>
          <ul class="space-y-1 text-muted">
            <li>✓ Convidados ilimitados</li>
            <li>✓ Até 5 casamentos por conta</li>
            <li>✓ Cerimonialista + colaboradores</li>
            <li>✓ Convites digitais interativos</li>
            <li>✓ Fornecedores, contratos, finanças</li>
            <li>✓ Sem anúncios</li>
          </ul>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'Fazer upgrade',
      showCancelButton: true,
      cancelButtonText: 'Agora não'
    }).then(r => { if (r.isConfirmed) App.startUpgradeFlow(); });
  },

  // ---------- FORMATTERS ----------
  money(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  date(value) {
    if (!value) return '—';
    const d = value.toDate ? value.toDate() : new Date(value);
    return d.toLocaleDateString('pt-BR');
  },

  daysUntil(dateString) {
    if (!dateString) return 0;
    const target = new Date(dateString + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  },

  initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  },

  escape(str) {
    return String(str || '').replace(/[<>&"']/g, ch => ({
      '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'
    }[ch]));
  },

  // ---------- HEADER UPDATES ----------
  refreshHeader() {
    if (!State.wedding) return;
    document.getElementById('couple-name').innerText = State.wedding.names || '—';
    const days = this.daysUntil(State.wedding.date);
    const countdown = document.getElementById('countdown');
    if (days > 0) countdown.innerHTML = `<i class="fa-regular fa-clock"></i> Faltam <b>${days}</b> dias`;
    else if (days === 0) countdown.innerHTML = `<i class="fa-solid fa-heart text-red-500"></i> <b>É hoje!</b>`;
    else countdown.innerHTML = `<i class="fa-solid fa-check"></i> Já aconteceu`;

    document.getElementById('role-badge').innerText = WP_CONFIG.ROLE_LABELS[State.role] || '—';
  },

  refreshUserUI() {
    if (!State.profile) return;
    document.getElementById('user-name-display').innerText = State.profile.name || '—';
    document.getElementById('user-email-display').innerText = State.profile.email || '—';
    document.getElementById('user-avatar').innerText = this.initials(State.profile.name);

    const plan = State.plan || 'free';
    const badge = document.getElementById('plan-badge');
    badge.innerText = plan.toUpperCase();
    badge.classList.toggle('bg-blush', plan === 'free');
    badge.classList.toggle('text-gold', plan === 'free');
    badge.classList.toggle('badge-premium', plan === 'premium');

    document.getElementById('ad-banner').classList.toggle('hidden', plan !== 'free');
  }
};

window.UI = UI;
