// ============================================
// SUPPLIER PAYMENTS MODULE - v2.0 Production Ready
// ============================================

window.SupplierPayments = {
  state: {
    balance: {
      available: 0,
      pending: 0,
      total: 0
    },
    transactions: [],
    payouts: []
  },

  init: async () => {
    console.log('[Payments] Initializing...');
    await SupplierPayments.loadPayments();
    SupplierPayments.setupEventListeners();
  },

  setupEventListeners: () => {
    // Bouton de demande de virement
    const payoutBtn = document.getElementById('btn-request-payout');
    if (payoutBtn) {
      payoutBtn.addEventListener('click', SupplierPayments.requestPayout);
    }

    // Bouton d'export
    const exportBtn = document.getElementById('btn-export-transactions');
    if (exportBtn) {
      exportBtn.addEventListener('click', SupplierPayments.export);
    }
  },

  loadPayments: async () => {
    try {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(true);
      }

      console.log('[Payments] Loading from API...');
      
      if (!window.BrandiaAPI || !window.BrandiaAPI.Supplier) {
        throw new Error('API non disponible');
      }

      const response = await window.BrandiaAPI.Supplier.getPayments();
      console.log('[Payments] API Response:', response);

      if (!response.success) {
        throw new Error(response.message || 'Erreur de chargement');
      }

      const data = response.data || {};
      
      SupplierPayments.state.balance = {
        available: parseFloat(data.balance?.available) || 0,
        pending: parseFloat(data.balance?.pending) || 0,
        total: parseFloat(data.balance?.total) || 0
      };
      
      SupplierPayments.state.transactions = data.transactions || [];
      
      console.log('[Payments] Balance:', SupplierPayments.state.balance);
      console.log('[Payments] Transactions:', SupplierPayments.state.transactions.length);
      
      SupplierPayments.render();
    } catch (error) {
      console.error('[Payments] Error loading:', error);
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Erreur de chargement des paiements: ' + error.message, 'error');
      }
      SupplierPayments.renderEmpty();
    } finally {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(false);
      }
    }
  },

  render: () => {
    // KPIs - avec vérification d'existence
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText('balance-available', SupplierPayments.formatPrice(SupplierPayments.state.balance.available));
    setText('balance-pending', SupplierPayments.formatPrice(SupplierPayments.state.balance.pending));
    setText('balance-total', SupplierPayments.formatPrice(SupplierPayments.state.balance.total));

    // Transactions
    const container = document.getElementById('transactions-list');
    if (!container) {
      console.warn('[Payments] Container #transactions-list not found');
      return;
    }

    if (SupplierPayments.state.transactions.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="4" class="py-12 text-center">
            <div class="text-slate-500">
              <i class="fas fa-wallet text-4xl mb-4 opacity-50"></i>
              <p>Aucune transaction pour le moment</p>
              <p class="text-sm text-slate-600 mt-1">Les paiements apparaîtront ici après vos ventes</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = SupplierPayments.state.transactions.map(t => {
      const date = t.created_at 
        ? new Date(t.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })
        : '-';
      
      const statusConfig = {
        pending: { label: 'En attente', class: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
        available: { label: 'Disponible', class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
        paid: { label: 'Payé', class: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
        payout_requested: { label: 'En cours', class: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
        cancelled: { label: 'Annulé', class: 'bg-red-500/20 text-red-400 border-red-500/30' }
      };
      
      const status = statusConfig[t.status] || { label: t.status, class: 'bg-slate-500/20 text-slate-400' };

      return `
        <tr class="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
          <td class="py-4 px-6 text-slate-400 whitespace-nowrap">${date}</td>
          <td class="py-4 px-6">
            <div>
              <p class="text-white font-medium">${t.description || 'Vente'}</p>
              ${t.order_number ? `<p class="text-xs text-slate-500 mt-0.5">Commande #${t.order_number}</p>` : ''}
            </div>
          </td>
          <td class="py-4 px-6 text-right">
            <span class="text-emerald-400 font-medium">+${SupplierPayments.formatPrice(t.amount)}</span>
            ${t.commission > 0 ? `<p class="text-xs text-slate-500">Commission: -${SupplierPayments.formatPrice(t.commission)}</p>` : ''}
          </td>
          <td class="py-4 px-6 text-center">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.class}">
              ${status.label}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderEmpty: () => {
    const container = document.getElementById('transactions-list');
    if (container) {
      container.innerHTML = `
        <tr>
          <td colspan="4" class="py-12 text-center text-slate-500">
            <i class="fas fa-exclamation-circle text-3xl mb-3"></i>
            <p>Erreur de chargement</p>
            <button onclick="SupplierPayments.loadPayments()" class="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">
              Réessayer
            </button>
          </td>
        </tr>
      `;
    }
  },

  requestPayout: async () => {
    const maxAmount = SupplierPayments.state.balance.available;
    
    if (maxAmount <= 0) {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Aucun solde disponible pour le moment', 'error');
      }
      return;
    }

    const amount = prompt(
      `Montant à retirer (max: ${SupplierPayments.formatPrice(maxAmount)}):`, 
      maxAmount.toFixed(2)
    );
    
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return;
    
    if (parseFloat(amount) > maxAmount) {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Montant supérieur au solde disponible', 'error');
      }
      return;
    }

    try {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(true);
      }

      const response = await window.BrandiaAPI.Supplier.requestPayout(parseFloat(amount));
      
      if (!response.success) {
        throw new Error(response.message);
      }

      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Demande de virement envoyée avec succès !', 'success');
      }
      
      // Recharger les données
      await SupplierPayments.loadPayments();
      
      // Afficher les détails du virement
      if (response.data) {
        alert(`Virement demandé:\nMontant: ${SupplierPayments.formatPrice(response.data.amount)}\nStatut: En traitement\nDate estimée: ${new Date(response.data.estimated_date).toLocaleDateString('fr-FR')}`);
      }

    } catch (error) {
      console.error('[Payments] Payout error:', error);
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Erreur: ' + error.message, 'error');
      }
    } finally {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showLoading(false);
      }
    }
  },

  export: () => {
    if (SupplierPayments.state.transactions.length === 0) {
      if (typeof DashboardApp !== 'undefined') {
        DashboardApp.showToast('Aucune transaction à exporter', 'error');
      }
      return;
    }

    // Export CSV avec BOM pour Excel
    const BOM = '\uFEFF';
    const csv = [
      ['Date', 'Description', 'Commande', 'Montant', 'Commission', 'Net', 'Statut'].join(';'),
      ...SupplierPayments.state.transactions.map(t => [
        t.created_at ? new Date(t.created_at).toLocaleDateString('fr-FR') : '-',
        `"${(t.description || 'Vente').replace(/"/g, '""')}"`,
        t.order_number || '-',
        t.total?.toFixed(2)?.replace('.', ',') || '0,00',
        t.commission?.toFixed(2)?.replace('.', ',') || '0,00',
        t.amount?.toFixed(2)?.replace('.', ',') || '0,00',
        t.status
      ].join(';'))
    ].join('\n');

    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_brandia_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    if (typeof DashboardApp !== 'undefined') {
      DashboardApp.showToast('Export téléchargé', 'success');
    }
  },

  formatPrice: (amount) => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }
};

console.log('[SupplierPayments] Module loaded v2.0');

// Exposer globalement
window.requestPayout = () => SupplierPayments.requestPayout();
window.exportTransactions = () => SupplierPayments.export();