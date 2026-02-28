// ============================================
// AD ROTATION SERVICE - Round Robin System
// Un seul ad par session, rotation par connexion
// ============================================

const db = require("../../config/db");

class AdRotationService {
  constructor() {
    // Map: supplierId -> { currentIndex: number, lastReset: Date }
    this.rotationState = new Map();
    // Durée d'une "session" avant reset (24 heures)
    this.SESSION_DURATION = 24 * 60 * 60 * 1000; 
  }

  /**
   * Récupère la prochaine publicité active pour un fournisseur
   * Système round-robin: chaque appel retourne la pub suivante
   */
  async getNextAd(supplierId) {
    try {
      // Récupérer toutes les campagnes actives et valides (dates)
      const result = await db.query(`
        SELECT * FROM supplier_campaigns 
        WHERE supplier_id = $1 
        AND status = 'active'
        AND start_date <= CURRENT_DATE
        AND end_date >= CURRENT_DATE
        ORDER BY created_at ASC
      `, [supplierId]);

      const campaigns = result.rows;
      
      if (campaigns.length === 0) {
        return null;
      }

      // Si une seule campagne, la retourner toujours
      if (campaigns.length === 1) {
        return campaigns[0];
      }

      // Gérer l'état de rotation pour ce fournisseur
      const now = new Date();
      let state = this.rotationState.get(supplierId);

      // Reset si nouvelle session (24h écoulées) ou première fois
      if (!state || (now - state.lastReset) > this.SESSION_DURATION) {
        state = {
          currentIndex: 0,
          lastReset: now
        };
        this.rotationState.set(supplierId, state);
      }

      // Retourner la campagne courante et incrémenter l'index
      const campaign = campaigns[state.currentIndex % campaigns.length];
      state.currentIndex++;
      
      console.log(`[AdRotation] Supplier ${supplierId}: Showing ad ${campaign.id} (index: ${state.currentIndex - 1}, total: ${campaigns.length})`);
      
      return campaign;

    } catch (error) {
      console.error('[AdRotation] Error:', error);
      return null;
    }
  }

  /**
   * Réinitialise manuellement la rotation pour un fournisseur
   */
  resetRotation(supplierId) {
    this.rotationState.delete(supplierId);
    console.log(`[AdRotation] Reset rotation for supplier ${supplierId}`);
  }

  /**
   * Récupère toutes les publicités actives (pour affichage multiple si besoin)
   */
  async getAllActiveAds(supplierId) {
    try {
      const result = await db.query(`
        SELECT * FROM supplier_campaigns 
        WHERE supplier_id = $1 
        AND status = 'active'
        AND start_date <= CURRENT_DATE
        AND end_date >= CURRENT_DATE
        ORDER BY created_at ASC
      `, [supplierId]);

      return result.rows;
    } catch (error) {
      console.error('[AdRotation] Error getting all ads:', error);
      return [];
    }
  }
}

module.exports = new AdRotationService();