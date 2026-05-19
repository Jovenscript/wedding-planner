/* ============================================================
 *  auth.js — Fluxos de autenticação
 *  Login, signup, recuperação de senha, logout.
 * ============================================================ */

const Auth = {
  isLoginMode: true,

  init() {
    const form = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    const forgotBtn = document.getElementById('auth-forgot');

    form.addEventListener('submit', e => {
      e.preventDefault();
      this.handleSubmit();
    });

    toggleBtn.addEventListener('click', e => {
      e.preventDefault();
      this.toggleMode();
    });

    forgotBtn.addEventListener('click', e => {
      e.preventDefault();
      this.recoverPassword();
    });

    // Observador global de mudança de auth
    auth.onAuthStateChanged(user => this.handleAuthChange(user));
  },

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    document.getElementById('auth-title').innerText =
      this.isLoginMode ? 'Acesse sua conta' : 'Crie sua conta SaaS';
    document.getElementById('auth-submit').innerHTML =
      this.isLoginMode
        ? 'Entrar <i class="fa-solid fa-arrow-right"></i>'
        : 'Cadastrar <i class="fa-solid fa-user-plus"></i>';
    document.getElementById('auth-toggle-text').innerText =
      this.isLoginMode ? 'Não tem uma conta?' : 'Já possui uma conta?';
    document.getElementById('auth-toggle-btn').innerText =
      this.isLoginMode ? 'Criar agora' : 'Fazer Login';
    document.getElementById('auth-name-wrapper').classList.toggle('hidden', this.isLoginMode);
  },

  async handleSubmit() {
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value.trim();

    UI.loading('Autenticando…');
    try {
      if (this.isLoginMode) {
        await auth.signInWithEmailAndPassword(email, pass);
      } else {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        if (name) await cred.user.updateProfile({ displayName: name });
      }
      Swal.close();
    } catch (err) {
      Swal.fire('Ops!', this.friendlyError(err), 'error');
    }
  },

  async recoverPassword() {
    const { value: email } = await Swal.fire({
      title: 'Recuperar senha',
      input: 'email',
      inputLabel: 'Informe seu e-mail',
      showCancelButton: true,
      confirmButtonText: 'Enviar link'
    });
    if (!email) return;
    try {
      await auth.sendPasswordResetEmail(email);
      Swal.fire('Pronto!', 'Enviamos um link de recuperação pro teu e-mail.', 'success');
    } catch (err) {
      Swal.fire('Erro', this.friendlyError(err), 'error');
    }
  },

  async logout() {
    const ok = await UI.confirm('Sair?', 'Você precisará entrar de novo na próxima.');
    if (!ok) return;
    DB.detachAllListeners();
    await auth.signOut();
  },

  friendlyError(err) {
    const map = {
      'auth/user-not-found': 'E-mail não encontrado.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/email-already-in-use': 'Esse e-mail já tem conta.',
      'auth/weak-password': 'Senha precisa de ao menos 6 caracteres.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um instante.'
    };
    return map[err.code] || err.message || 'Erro ao autenticar.';
  },

  async handleAuthChange(user) {
    if (!user) {
      // Deslogado
      State.set('user', null);
      State.set('profile', null);
      State.clearWeddingData();
      App.showAuthScreen();
      return;
    }

    // Logado — carrega perfil
    State.set('user', user);
    const profile = await DB.getOrCreateProfile(user);
    State.set('profile', profile);

    if (!profile.weddings || profile.weddings.length === 0) {
      // Primeiro acesso — mostra onboarding
      App.showOnboarding();
    } else {
      // Tem casamento(s) — carrega o ativo
      const activeId = profile.currentWedding || profile.weddings[0];
      await App.loadWedding(activeId);
    }
  }
};

window.Auth = Auth;
