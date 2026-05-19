/* ============================================================
 *  db.js — Camada de acesso ao Firestore
 *  Toda interação com banco passa por aqui. Os módulos chamam
 *  DB.add(), DB.update(), DB.delete() — nunca db.collection() direto.
 *  Isso permite trocar Firebase por outro backend no futuro sem
 *  refatorar 13 módulos.
 * ============================================================ */

const DB = {
  // Listeners ativos pra fazer cleanup ao trocar de casamento
  _unsubscribers: [],

  // -------- USUÁRIO --------
  async getOrCreateProfile(user) {
    const ref = db.collection('users').doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      const profile = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        plan: 'free',
        weddings: [],
        currentWedding: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await ref.set(profile);
      return profile;
    }
    return snap.data();
  },

  async updateProfile(uid, data) {
    await db.collection('users').doc(uid).update(data);
  },

  // -------- CASAMENTOS --------
  async createWedding({ names, date, place, ownerUid }) {
    const wedding = {
      names,
      date,
      place: place || '',
      ownerUid,
      plan: 'free',
      members: { [ownerUid]: { role: 'owner', joinedAt: Date.now() } },
      memberUids: [ownerUid],   // array pra usar em queries
      settings: { metaRifa: 5000, nextRaffleNumber: 1 },
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection('weddings').add(wedding);

    // Adiciona casamento à lista do usuário
    await db.collection('users').doc(ownerUid).update({
      weddings: firebase.firestore.FieldValue.arrayUnion(ref.id),
      currentWedding: ref.id
    });
    return ref.id;
  },

  async getMyWeddings(uid) {
    const snap = await db.collection('weddings')
      .where('memberUids', 'array-contains', uid)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async inviteCollaborator(weddingId, email, role) {
    // Em produção: criar pending invite + Cloud Function envia email.
    // Por ora: cria registro de convite pendente.
    await db.collection('weddings').doc(weddingId)
      .collection('invites_pending').add({
        email: email.toLowerCase().trim(),
        role,
        invitedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      });
  },

  async removeCollaborator(weddingId, uid) {
    const ref = db.collection('weddings').doc(weddingId);
    await ref.update({
      [`members.${uid}`]: firebase.firestore.FieldValue.delete(),
      memberUids: firebase.firestore.FieldValue.arrayRemove(uid)
    });
  },

  // -------- SUBSCRIPTIONS (reactive) --------
  /**
   * Inscreve numa subcoleção do casamento ativo e popula State automaticamente.
   * Retorna função de cleanup.
   */
  subscribeCollection(collection, stateKey) {
    if (!State.weddingId) return () => {};
    const unsub = db.collection('weddings').doc(State.weddingId)
      .collection(collection)
      .onSnapshot(snap => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        State.set(stateKey, items);
      }, err => console.error(`Erro listener ${collection}:`, err));
    this._unsubscribers.push(unsub);
    return unsub;
  },

  /** Inscreve no documento do casamento ativo */
  subscribeWedding() {
    if (!State.weddingId) return () => {};
    const unsub = db.collection('weddings').doc(State.weddingId)
      .onSnapshot(snap => {
        if (!snap.exists) return;
        const w = { id: snap.id, ...snap.data() };
        State.set('wedding', w);
        State.set('plan', w.plan || 'free');
        // Calcula papel do usuário atual
        if (State.user && w.members && w.members[State.user.uid]) {
          State.set('role', w.members[State.user.uid].role);
        }
      });
    this._unsubscribers.push(unsub);
    return unsub;
  },

  /** Liga TODAS as subscriptions do casamento ativo */
  attachAllListeners() {
    this.detachAllListeners();
    this.subscribeWedding();
    this.subscribeCollection('guests',    'guests');
    this.subscribeCollection('families',  'families');
    this.subscribeCollection('vendors',   'vendors');
    this.subscribeCollection('finances',  'finances');
    this.subscribeCollection('tasks',     'tasks');
    this.subscribeCollection('raffles',   'raffles');
    this.subscribeCollection('timeline',  'timeline');
    this.subscribeCollection('contracts', 'contracts');
    this.subscribeCollection('messages',  'messages');
    this.subscribeCollection('invites',   'invites');
  },

  /** Desliga TODOS os listeners (ex.: ao trocar de casamento) */
  detachAllListeners() {
    this._unsubscribers.forEach(unsub => { try { unsub(); } catch(_){} });
    this._unsubscribers = [];
  },

  // -------- CRUD genérico --------
  async add(collection, data) {
    if (!State.weddingId) throw new Error('Nenhum casamento ativo');
    const payload = {
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: State.user ? State.user.uid : null
    };
    return db.collection('weddings').doc(State.weddingId)
      .collection(collection).add(payload);
  },

  async update(collection, id, data) {
    if (!State.weddingId) throw new Error('Nenhum casamento ativo');
    return db.collection('weddings').doc(State.weddingId)
      .collection(collection).doc(id).update(data);
  },

  async remove(collection, id) {
    if (!State.weddingId) throw new Error('Nenhum casamento ativo');
    return db.collection('weddings').doc(State.weddingId)
      .collection(collection).doc(id).delete();
  },

  async updateWedding(data) {
    if (!State.weddingId) throw new Error('Nenhum casamento ativo');
    return db.collection('weddings').doc(State.weddingId).update(data);
  }
};

window.DB = DB;
