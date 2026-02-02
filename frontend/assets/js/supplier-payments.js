// ============================================
// SUPPLIER PAYMENTS MODULE
// ============================================

window.SupplierPayments = {
  state: {
    balance: {
      available: 0,
      pending: 0,
      total: 0
    },
    transactions: []
  },

  init: async () => {
    await SupplierPayments.loadPayments();
  },

  loadPayments: async () => {
    try {
      DashboardApp.showLoading(true);
      const response = await BrandiaAPI.Supplier.getPayments();
      const data = response.data || {};
      
      SupplierPayments.state.balance = {
        available: data.available || 0,
        pending: data.pending || 0,
        total: data.total || 0
      };
      SupplierPayments.state.transactions = data.transactions || [];
      
      SupplierPayments.render();
    } catch (error) {
      console.error('Erreur paiements:', error);
      DashboardApp.showToast('Erreur de chargement des paiements', 'error');
    } finally {
      DashboardApp.showLoading(false);
    }
  },

  render: () => {
    // KPIs
    document.getElementById('balance-available').textContent = DashboardApp.formatPrice(SupplierPayments.state.balance.available);
    document.getElementById('balance-pending').textContent = DashboardApp.formatPrice(SupplierPayments.state.balance.pending);
    document.getElementById('balance-total').textContent = DashboardApp.formatPrice(SupplierPayments.state.balance.total);

    // Transactions
    const container = document.getElementById('transactions-list');
    if (!container) return;

    if (SupplierPayments.state.transactions.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="4" class="py-8 text-center text-slate-500">Aucune transaction</td>
        </tr>
      `;
      return;
    }

    container.innerHTML = SupplierPayments.state.transactions.map(t => `
      <tr class="border-b border-slate-800 last:border-0">
        <td class="py-4 px-6 text-slate-400">${DashboardApp.formatDate(t.created_at)}</td>
        <td class="py-4 px-6">
          <div>
            <p class="text-white">${t.description || 'Vente'}</p>
            ${t.order_number ? `<p class="text-xs text-slate-500">Commande #${t.order_number}</p>` : ''}
          </div>
        </td>
        <td class="py-4 px-6 text-right ${t.amount > 0 ? 'text-emerald-400' : 'text-white'}">
          ${t.amount > 0 ? '+' : ''}${DashboardApp.formatPrice(t.amount)}
        </td>
        <td class="py-4 px-6 text-center">
          <span class="badge badge-${t.status} text-xs capitalize">
            ${t.status === 'available' ? 'Disponible' : 
              t.status === 'pending' ? 'En attente' : 
              t.status === 'paid' ? 'Payé' : t.status}
          </span>
        </td>
      </tr>
    `).join('');
  },

  requestPayout: () => {
    const maxAmount = SupplierPayments.state.balance.available;
    if (maxAmount <= 0) {
      DashboardApp.showToast('Aucun solde disponible', 'error');
      return;
    }

    const amount = prompt(`Montant à retirer (max: ${DashboardApp.formatPrice(maxAmount)}):`, maxAmount);
    if (!amount || isNaN(amount) || amount <= 0) return;
    if (parseFloat(amount) > maxAmount) {
      DashboardApp.showToast('Montant supérieur au solde disponible', 'error');
      return;
    }

    // Simulation
    DashboardApp.showToast('Demande de virement envoyée', 'success');
    SupplierPayments.loadPayments();
  },

  export: () => {
    // Export CSV
    const csv = [
      ['Date', 'Description', 'Montant', 'Statut'].join(';'),
      ...SupplierPayments.state.transactions.map(t => [
        new Date(t.created_at).toLocaleDateString('fr-FR'),
        t.description || 'Vente',
        t.amount,
        t.status
      ].join(';'))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    DashboardApp.showToast('Export téléchargé', 'success');
  }
};

window.requestPayout = () => SupplierPayments.requestPayout();
window.exportTransactions = () => SupplierPayments.export();