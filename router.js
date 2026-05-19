/* ============================================================
 *  router.js — Roteamento simples baseado em hash.
 *  Renderiza sidebar dinamicamente baseado em permissões.
 * ============================================================ */

const Router = {
  current: 'dashboard',

  init() {
    window.addEventListener('hashchange', () => this.handleHashChange());
  },

  renderSidebar() {
    const container = document.getElementById('nav-items');
    container.innerHTML = '';

    const visible = Permissions.visibleModules();

    visible.forEach(mod => {
      const planOK = Permissions.hasPlanForModule(mod.id);
      const btn = document.createElement('button');
      btn.className = 'nav-btn';
      if (!planOK) btn.classList.add('locked');
      btn.dataset.target = mod.id;
      btn.innerHTML = `
        <i class="fa-solid ${mod.icon} nav-icon"></i>
        <span class="nav-label">${mod.label}</span>
      `;
      btn.addEventListener('click', () => {
        if (!planOK) { UI.showUpgradePrompt(mod.id); return; }
        this.navigate(mod.id);
      });
      container.appendChild(btn);
    });

    // Marca rota ativa
    this.highlightActive();
  },

  navigate(viewId) {
    if (!Permissions.canAccessModule(viewId)) {
      UI.showUpgradePrompt(viewId);
      return;
    }
    this.current = viewId;
    window.location.hash = viewId;
    this.render();
    this.highlightActive();
  },

  handleHashChange() {
    const target = window.location.hash.replace('#', '') || 'dashboard';
    if (target !== this.current) {
      this.current = target;
      this.render();
      this.highlightActive();
    }
  },

  highlightActive() {
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.target === this.current);
    });
  },

  render() {
    const container = document.getElementById('view-container');
    container.innerHTML = '';

    // Verifica acesso novamente (paranóia)
    if (!Permissions.canAccessModule(this.current)) {
      container.innerHTML = `
        <div class="paywall">
          <i class="fa-solid fa-lock text-4xl mb-4"></i>
          <h2 class="text-2xl font-bold font-serif text-dark mb-2">Acesso restrito</h2>
          <p class="text-muted mb-6">Você não tem permissão pra esse módulo, ou ele é premium.</p>
          <button onclick="Router.navigate('dashboard')" class="bg-dark text-white px-6 py-2 rounded-xl font-semibold">Voltar ao início</button>
        </div>
      `;
      return;
    }

    // Chama o renderer do módulo
    const mod = Modules[this.current];
    if (mod && typeof mod.render === 'function') {
      mod.render(container);
    } else {
      container.innerHTML = `<div class="empty-state">
        <i class="fa-solid fa-hammer"></i>
        <p class="font-bold">Módulo em construção</p>
        <p class="text-sm">${this.current}</p>
      </div>`;
    }
  }
};

window.Router = Router;
