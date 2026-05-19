/* ============================================================
 *  state.js — Estado central da aplicação
 *  Padrão simples de pub/sub: módulos se inscrevem e renderizam
 *  quando algo muda. Sem framework, mas com clareza.
 * ============================================================ */

const State = {
  // -------- Estado atual --------
  user: null,           // firebase user object
  profile: null,        // perfil do usuário (doc /users/{uid})
  weddingId: null,      // id do casamento ativo
  wedding: null,        // doc do casamento ativo
  role: null,           // papel do usuário no casamento ativo
  plan: 'free',         // plano do dono do casamento (não do user logado!)

  // Coleções (espelham subcollections do Firestore)
  guests: [],
  families: [],
  vendors: [],
  finances: [],
  tasks: [],
  raffles: [],
  timeline: [],
  contracts: [],
  messages: [],
  invites: [],

  // -------- Subscribers --------
  _subscribers: new Map(),  // key -> Set<callback>

  /**
   * Inscreve um callback para mudanças.
   * keys: 'user' | 'wedding' | 'guests' | 'families' | etc. | '*' (qualquer)
   */
  subscribe(key, callback) {
    if (!this._subscribers.has(key)) this._subscribers.set(key, new Set());
    this._subscribers.get(key).add(callback);
    return () => this._subscribers.get(key).delete(callback);
  },

  /**
   * Atualiza um campo do estado e notifica subscribers.
   */
  set(key, value) {
    this[key] = value;
    this._notify(key);
    this._notify('*');
  },

  /**
   * Notifica todos os subscribers de uma chave.
   */
  _notify(key) {
    const subs = this._subscribers.get(key);
    if (subs) subs.forEach(cb => {
      try { cb(this[key], key); } catch (e) { console.error('Subscriber error:', e); }
    });
  },

  /**
   * Limpa listeners e dados ao trocar de casamento ou deslogar.
   */
  clearWeddingData() {
    ['guests','families','vendors','finances','tasks','raffles','timeline','contracts','messages','invites']
      .forEach(k => { this[k] = []; this._notify(k); });
    this.wedding = null;
    this.weddingId = null;
    this.role = null;
    this._notify('wedding');
  }
};

window.State = State;
