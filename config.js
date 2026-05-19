/* ============================================================
 *  config.js — Configuração central
 *  Tudo que é "constante do produto" mora aqui.
 *  Trocar plano, papel ou regra de permissão? Só mexer aqui.
 * ============================================================ */

// -------------------- FIREBASE --------------------
const firebaseConfig = {
  apiKey: "AIzaSyAsW2-Mu3u7SGRJMDtgvtvmI0JkCIi2QgI",
  authDomain: "widding-planner.firebaseapp.com",
  projectId: "widding-planner",
  storageBucket: "widding-planner.firebasestorage.app",
  messagingSenderId: "769857893910",
  appId: "1:769857893910:web:5c6cd69609c74638b26737"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// -------------------- PAPÉIS (RBAC) --------------------
const ROLES = {
  OWNER: 'owner',       // noivo/noiva — controle total
  ADMIN: 'admin',       // co-organizador com poderes
  PLANNER: 'planner',   // cerimonialista — operacional, sem financeiro
  FAMILY: 'family',     // família ajudando com tarefas pontuais
  VIEWER: 'viewer'      // só leitura
};

const ROLE_LABELS = {
  owner: 'Noivo(a)',
  admin: 'Administrador',
  planner: 'Cerimonialista',
  family: 'Família',
  viewer: 'Convidado de honra'
};

// -------------------- PLANOS --------------------
const PLANS = {
  FREE: 'free',
  PREMIUM: 'premium'
};

const PLAN_LIMITS = {
  free: {
    maxGuests: 50,
    maxWeddings: 1,
    maxCollaborators: 1,
    hasAds: true,
    modules: ['dashboard', 'guests', 'rsvp', 'tasks', 'settings']
  },
  premium: {
    maxGuests: Infinity,
    maxWeddings: 5,
    maxCollaborators: 10,
    hasAds: false,
    modules: '*'  // tudo liberado
  }
};

// -------------------- MÓDULOS --------------------
// Cada módulo tem id, label, ícone, rota, e quais papéis podem acessar.
// A ordem aqui é a ordem da sidebar.
const MODULES = [
  { id: 'dashboard',  label: 'Resumo',        icon: 'fa-chart-pie',     roles: ['owner','admin','planner','family','viewer'] },
  { id: 'guests',     label: 'Convidados',    icon: 'fa-users',         roles: ['owner','admin','planner','family'] },
  { id: 'rsvp',       label: 'RSVP Tinder',   icon: 'fa-heart',         roles: ['owner','admin','planner'] },
  { id: 'invites',    label: 'Convites',      icon: 'fa-envelope-open-text', roles: ['owner','admin'] },
  { id: 'vendors',    label: 'Fornecedores',  icon: 'fa-store',         roles: ['owner','admin','planner'] },
  { id: 'finances',   label: 'Finanças',      icon: 'fa-wallet',        roles: ['owner','admin'] },
  { id: 'contracts',  label: 'Contratos',     icon: 'fa-file-signature',roles: ['owner','admin'] },
  { id: 'raffles',    label: 'Rifa / Gravata',icon: 'fa-ticket',        roles: ['owner','admin'] },
  { id: 'timeline',   label: 'Cronograma',    icon: 'fa-calendar-days', roles: ['owner','admin','planner','family','viewer'] },
  { id: 'tasks',      label: 'Checklist',     icon: 'fa-list-check',    roles: ['owner','admin','planner','family'] },
  { id: 'messages',   label: 'Mensagens',     icon: 'fa-paper-plane',   roles: ['owner','admin','planner'] },
  { id: 'settings',   label: 'Ajustes',       icon: 'fa-gear',          roles: ['owner','admin'] }
];

// -------------------- AÇÕES & PERMISSÕES --------------------
// Granularidade fina: quais ações cada papel pode executar.
// Modelo: 'modulo.acao' -> [papéis permitidos]
const PERMISSIONS = {
  // Convidados
  'guests.view':   ['owner','admin','planner','family'],
  'guests.create': ['owner','admin','planner'],
  'guests.edit':   ['owner','admin','planner'],
  'guests.delete': ['owner','admin'],
  'guests.import': ['owner','admin'],

  // Finanças (cerimonialista NÃO vê)
  'finances.view':   ['owner','admin'],
  'finances.create': ['owner','admin'],
  'finances.edit':   ['owner','admin'],
  'finances.delete': ['owner'],

  // RSVP
  'rsvp.swipe':  ['owner','admin','planner'],

  // Fornecedores
  'vendors.view':   ['owner','admin','planner'],
  'vendors.create': ['owner','admin'],
  'vendors.delete': ['owner','admin'],

  // Contratos
  'contracts.view':   ['owner','admin'],
  'contracts.create': ['owner','admin'],

  // Rifa
  'raffles.view':   ['owner','admin','planner'],
  'raffles.create': ['owner','admin'],
  'raffles.draw':   ['owner','admin'],

  // Cronograma
  'timeline.view':   ['owner','admin','planner','family','viewer'],
  'timeline.edit':   ['owner','admin','planner'],

  // Mensagens
  'messages.send':   ['owner','admin','planner'],

  // Convites
  'invites.create':  ['owner','admin'],
  'invites.publish': ['owner','admin'],

  // Configurações
  'settings.edit':       ['owner','admin'],
  'settings.invite':     ['owner','admin'],
  'settings.changePlan': ['owner'],
  'settings.deleteWedding': ['owner']
};

// -------------------- CATEGORIAS PADRÃO --------------------
const EXPENSE_CATEGORIES = [
  'Buffet','Decoração','DJ/Som','Fotografia','Filmagem','Vestido','Terno',
  'Lua de mel','Convites','Espaço','Cerimônia','Doces','Bebidas','Lembrancinhas','Outros'
];

const VENDOR_CATEGORIES = [
  'Buffet','Decoração','DJ/Som','Fotografia','Filmagem','Vestido/Terno',
  'Espaço','Cerimonialista','Bolo','Doces','Bebidas','Floricultura','Transporte','Outros'
];

// -------------------- DETECÇÃO ESTADO FIREBASE --------------------
const IS_PRODUCTION = firebaseConfig.apiKey && firebaseConfig.apiKey !== "SUA_API_KEY";

// Exporta tudo no escopo global (script tradicional, sem ES modules)
window.WP_CONFIG = {
  ROLES, ROLE_LABELS, PLANS, PLAN_LIMITS, MODULES, PERMISSIONS,
  EXPENSE_CATEGORIES, VENDOR_CATEGORIES, IS_PRODUCTION
};
