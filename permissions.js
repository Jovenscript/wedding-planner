/* ============================================================
 *  permissions.js — Sistema de permissões
 *  Combina RBAC (papéis) + plan gating (free/premium).
 *  Use Permissions.can(action) antes de qualquer ação sensível.
 * ============================================================ */

const Permissions = {

  /**
   * Verifica se o usuário atual pode executar uma ação.
   * Ex: Permissions.can('finances.create')
   */
  can(action) {
    if (!State.role) return false;
    const allowed = WP_CONFIG.PERMISSIONS[action];
    if (!allowed) {
      console.warn(`Ação desconhecida: ${action}`);
      return false;
    }
    return allowed.includes(State.role);
  },

  /**
   * Verifica se o módulo está disponível pro papel atual.
   */
  hasRoleForModule(moduleId) {
    const mod = WP_CONFIG.MODULES.find(m => m.id === moduleId);
    if (!mod) return false;
    return mod.roles.includes(State.role);
  },

  /**
   * Verifica se o plano atual libera o módulo.
   */
  hasPlanForModule(moduleId) {
    const plan = State.plan || 'free';
    const limits = WP_CONFIG.PLAN_LIMITS[plan];
    if (limits.modules === '*') return true;
    return limits.modules.includes(moduleId);
  },

  /**
   * Verifica acesso completo (papel + plano).
   */
  canAccessModule(moduleId) {
    return this.hasRoleForModule(moduleId) && this.hasPlanForModule(moduleId);
  },

  /**
   * Devolve só os módulos visíveis pro usuário atual.
   * Os bloqueados por plano aparecem com cadeado; os bloqueados
   * por papel não aparecem nem na navegação.
   */
  visibleModules() {
    return WP_CONFIG.MODULES.filter(m => this.hasRoleForModule(m.id));
  },

  /**
   * Limite do plano atual.
   */
  getLimit(key) {
    const plan = State.plan || 'free';
    return WP_CONFIG.PLAN_LIMITS[plan][key];
  },

  /**
   * Helper: dispara modal de upgrade se ação for premium-only.
   */
  enforcePlan(moduleId) {
    if (this.hasPlanForModule(moduleId)) return true;
    UI.showUpgradePrompt(moduleId);
    return false;
  },

  /**
   * Helper: bloqueia se não tem permissão por papel.
   */
  enforceRole(action) {
    if (this.can(action)) return true;
    UI.toast('Você não tem permissão para essa ação.', 'error');
    return false;
  }
};

window.Permissions = Permissions;
