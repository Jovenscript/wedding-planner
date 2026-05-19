/* ============================================================
 *  app.js — Ponto de entrada da aplicação.
 *  Orquestra: auth → onboarding → carregamento de casamento →
 *  renderização da app shell.
 * ============================================================ */

const App = {

  init() {
    // Auth (faz redirect interno baseado em estado)
    Auth.init();
    Router.init();
    this._bindShellEvents();
    this._handleInviteLink();
  },

  // ----------------- TELAS -----------------
  showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('onboarding-screen').classList.add('hidden');
    document.querySelectorAll('.hidden-app').forEach(el => {});
    document.getElementById('sidebar').classList.add('hidden-app');
    document.getElementById('main-content').classList.add('hidden-app');
    document.getElementById('fab-btn').classList.add('hidden-app');
  },

  showOnboarding() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('onboarding-screen').classList.remove('hidden');
    document.getElementById('sidebar').classList.add('hidden-app');
    document.getElementById('main-content').classList.add('hidden-app');

    const form = document.getElementById('onboarding-form');
    // Limpa listeners antigos clonando o nó
    const clone = form.cloneNode(true);
    form.parentNode.replaceChild(clone, form);
    clone.addEventListener('submit', async e => {
      e.preventDefault();
      const data = {
        names: document.getElementById('onb-names').value.trim(),
        date: document.getElementById('onb-date').value,
        place: document.getElementById('onb-place').value.trim(),
        ownerUid: State.user.uid
      };
      UI.loading('Criando teu casamento…');
      try {
        const wid = await DB.createWedding(data);
        Swal.close();
        await this.loadWedding(wid);
        UI.toast('Casamento criado! 🎉');
        confetti({ particleCount: 80, spread: 70 });
      } catch (err) {
        console.error(err);
        Swal.fire('Erro', err.message, 'error');
      }
    });
  },

  showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('onboarding-screen').classList.add('hidden');
    document.getElementById('sidebar').classList.remove('hidden-app');
    document.getElementById('main-content').classList.remove('hidden-app');
    document.getElementById('fab-btn').classList.remove('hidden-app');
  },

  // ----------------- CARREGAR CASAMENTO -----------------
  async loadWedding(weddingId) {
    UI.loading('Sincronizando dados…');
    try {
      // Limpa estado anterior
      DB.detachAllListeners();
      State.clearWeddingData();
      State.set('weddingId', weddingId);

      // Atualiza preferência do usuário
      if (State.profile.currentWedding !== weddingId) {
        await DB.updateProfile(State.user.uid, { currentWedding: weddingId });
        State.set('profile', { ...State.profile, currentWedding: weddingId });
      }

      // Liga listeners reativos
      DB.attachAllListeners();

      // Aguarda uma renderização inicial do wedding
      await new Promise((resolve) => {
        const unsub = State.subscribe('wedding', w => {
          if (w) { unsub(); resolve(); }
        });
        setTimeout(resolve, 2000); // fallback timeout
      });

      Swal.close();
      this.showApp();
      this._renderShell();
    } catch (err) {
      console.error(err);
      Swal.fire('Erro ao carregar', err.message, 'error');
    }
  },

  _renderShell() {
    UI.refreshUserUI();
    UI.refreshHeader();
    Router.renderSidebar();

    // Reage a mudanças do wedding doc pra atualizar header
    State.subscribe('wedding', () => {
      UI.refreshHeader();
      UI.refreshUserUI();
      Router.renderSidebar();
    });

    // Vai pra rota atual ou dashboard
    const target = window.location.hash.replace('#', '') || 'dashboard';
    Router.navigate(target);
  },

  // ----------------- WEDDING SWITCHER -----------------
  async showWeddingSwitcher() {
    const weddings = await DB.getMyWeddings(State.user.uid);
    const html = `
      <div class="space-y-2">
        ${weddings.map(w => `
          <button data-pick="${w.id}" class="w-full text-left p-3 rounded-xl border ${w.id === State.weddingId ? 'border-gold bg-blush/30' : 'border-gray-200'} hover:border-gold transition">
            <div class="font-bold">${UI.escape(w.names)}</div>
            <div class="text-xs text-muted">${UI.date(w.date)} ${w.place ? '· ' + UI.escape(w.place) : ''}</div>
          </button>
        `).join('')}
        <button id="create-new-wedding" class="w-full p-3 rounded-xl border-2 border-dashed border-gold text-gold hover:bg-blush/30 transition font-semibold">
          <i class="fa-solid fa-plus mr-2"></i>Criar novo casamento
        </button>
      </div>
    `;
    Swal.fire({
      title: 'Seus casamentos',
      html,
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        document.querySelectorAll('[data-pick]').forEach(b => {
          b.addEventListener('click', () => { Swal.close(); this.loadWedding(b.dataset.pick); });
        });
        document.getElementById('create-new-wedding').addEventListener('click', () => {
          Swal.close();
          // Checa limite
          const max = Permissions.getLimit('maxWeddings');
          if (weddings.length >= max) {
            UI.showUpgradePrompt('settings');
            return;
          }
          this.showOnboarding();
        });
      }
    });
  },

  // ----------------- FAB -----------------
  openFabMenu() {
    const map = {
      guests: () => Modules.guests.addGuest(),
      finances: () => Modules.finances.add(),
      vendors: () => Modules.vendors.add(),
      tasks: () => Modules.tasks.add(),
      timeline: () => Modules.timeline.add(),
      contracts: () => Modules.contracts.add(),
      raffles: () => Modules.raffles.add()
    };
    const action = map[Router.current];
    if (action) action();
    else UI.toast('Use o botão "+" dentro do módulo', 'info');
  },

  // ----------------- UPGRADE -----------------
  startUpgradeFlow() {
    Swal.fire({
      title: '✨ Upgrade Premium',
      html: `
        <div class="text-left bg-blush/30 p-4 rounded-xl text-sm">
          <p class="mb-3 text-muted">Por enquanto, a cobrança não está integrada (Stripe ou Mercado Pago entram na próxima fase). Pra simular o upgrade no teu próprio casamento durante a validação:</p>
          <button id="simulate-upgrade" class="w-full bg-gradient-to-r from-gold to-yellow-400 text-white py-3 rounded-xl font-bold">Ativar Premium (teste)</button>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        document.getElementById('simulate-upgrade').addEventListener('click', async () => {
          await DB.updateWedding({ plan: 'premium' });
          Swal.close();
          UI.toast('Premium ativado! 👑');
          confetti({ particleCount: 150, spread: 80 });
        });
      }
    });
  },

  // ----------------- BIND SHELL EVENTS -----------------
  _bindShellEvents() {
    document.getElementById('wedding-switcher-btn')?.addEventListener('click', () => this.showWeddingSwitcher());
    document.getElementById('user-menu-btn')?.addEventListener('click', () => this._userMenu());
    document.getElementById('mobile-logout')?.addEventListener('click', () => Auth.logout());
    document.getElementById('fab-btn')?.addEventListener('click', () => this.openFabMenu());
    document.getElementById('upgrade-btn')?.addEventListener('click', () => this.startUpgradeFlow());

    // Subscribe: quando muda casamento ativo, refresca switcher label
    State.subscribe('wedding', w => {
      if (w) document.getElementById('active-wedding-name').innerText = w.names;
    });
  },

  _userMenu() {
    Swal.fire({
      title: State.profile?.name || 'Minha conta',
      html: `
        <div class="space-y-2 text-left">
          <button id="m-switcher" class="w-full p-3 bg-white border border-gray-200 rounded-xl text-left hover:border-gold"><i class="fa-solid fa-rings-wedding mr-2 text-gold"></i>Trocar de casamento</button>
          <button id="m-profile" class="w-full p-3 bg-white border border-gray-200 rounded-xl text-left hover:border-gold"><i class="fa-solid fa-user mr-2 text-gold"></i>Meu perfil</button>
          <button id="m-logout" class="w-full p-3 bg-white border border-red-200 rounded-xl text-left text-red-600 hover:bg-red-50"><i class="fa-solid fa-right-from-bracket mr-2"></i>Sair</button>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        document.getElementById('m-switcher').addEventListener('click', () => { Swal.close(); this.showWeddingSwitcher(); });
        document.getElementById('m-profile').addEventListener('click', () => this._editProfile());
        document.getElementById('m-logout').addEventListener('click', () => { Swal.close(); Auth.logout(); });
      }
    });
  },

  async _editProfile() {
    const html = `
      <input id="p-name" class="swal2-input" value="${UI.escape(State.profile?.name||'')}" placeholder="Nome">
    `;
    const data = await UI.modal({
      title: 'Meu perfil', html,
      preConfirm: () => ({ name: document.getElementById('p-name').value.trim() })
    });
    if (!data) return;
    await DB.updateProfile(State.user.uid, { name: data.name });
    State.set('profile', { ...State.profile, name: data.name });
    UI.refreshUserUI();
    UI.toast('Perfil atualizado');
  },

  // ----------------- INVITE PÚBLICO (RSVP por link) -----------------
  // Quando o link ?invite=<weddingId> é aberto, mostra tela pública de confirmação
  // SEM exigir login (futuro: lookup do convidado por nome/telefone).
  _handleInviteLink() {
    const params = new URLSearchParams(window.location.search);
    const inviteId = params.get('invite');
    if (!inviteId) return;
    // Por ora: redireciona pra fluxo padrão. Próxima fase: tela pública.
    console.log('[invite] Convite detectado:', inviteId, '(fluxo público vem na próxima fase)');
  }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
