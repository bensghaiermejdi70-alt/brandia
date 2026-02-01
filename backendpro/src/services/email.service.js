const BrevoAPI = require('../utils/brevo-api');
const logger = require('../utils/logger');

class EmailService {
  
  // ==========================================
  // 1. CONFIRMATION COMMANDE CLIENT
  // ==========================================
  static async sendOrderConfirmation(customerEmail, orderData) {
    try {
      const template = this.getOrderConfirmationTemplate(orderData);
      
      const result = await BrevoAPI.sendEmail(
        customerEmail,
        template.subject,
        template.html
      );
      
      logger.info(`📧 Confirmation commande envoyée à ${customerEmail} - Order #${orderData.orderNumber}`);
      return { success: true, messageId: result.messageId };
      
    } catch (error) {
      logger.error(`❌ Erreur email confirmation: ${error.message}`);
      // On ne bloque pas la commande si l'email échoue
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // 2. NOTIFICATION NOUVELLE COMMANDE (FOURNISSEUR)
  // ==========================================
  static async sendNewOrderNotification(supplierEmail, orderData, supplierData) {
    try {
      const template = this.getSupplierNotificationTemplate(orderData, supplierData);
      
      const result = await BrevoAPI.sendEmail(
        supplierEmail,
        template.subject,
        template.html
      );
      
      logger.info(`📧 Notification fournisseur envoyée à ${supplierEmail} - Order #${orderData.orderNumber}`);
      return { success: true, messageId: result.messageId };
      
    } catch (error) {
      logger.error(`❌ Erreur notification fournisseur: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // 3. EXPÉDITION COMMANDE (CLIENT)
  // ==========================================
  static async sendShippingConfirmation(customerEmail, orderData, trackingInfo) {
    try {
      const template = this.getShippingTemplate(orderData, trackingInfo);
      
      const result = await BrevoAPI.sendEmail(
        customerEmail,
        template.subject,
        template.html
      );
      
      logger.info(`📧 Email expédition envoyé à ${customerEmail}`);
      return { success: true, messageId: result.messageId };
      
    } catch (error) {
      logger.error(`❌ Erreur email expédition: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // TEMPLATES HTML
  // ==========================================
  
  static getOrderConfirmationTemplate(order) {
    const itemsHtml = order.items.map(item => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; text-align: left;">
          <img src="${item.image}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px;" />
        </td>
        <td style="padding: 12px; text-align: left;">
          <strong style="color: #111827;">${item.name}</strong><br/>
          <span style="color: #6b7280; font-size: 14px;">${item.supplierName}</span>
        </td>
        <td style="padding: 12px; text-align: center;">x${item.quantity}</td>
        <td style="padding: 12px; text-align: right; font-weight: 600;">${(item.price * item.quantity).toFixed(2)} €</td>
      </tr>
    `).join('');

    return {
      subject: `✅ Commande confirmée #${order.orderNumber} - Brandia`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 20px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
            .content { padding: 40px 30px; }
            .order-box { background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e5e7eb; }
            .btn { display: inline-block; background-color: #6366f1; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .footer { background-color: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
            table { width: 100%; border-collapse: collapse; }
            .total-row { font-size: 18px; font-weight: 700; color: #6366f1; margin-top: 20px; text-align: right; padding-top: 20px; border-top: 2px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Merci pour votre commande !</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Commande #${order.orderNumber}</p>
            </div>
            
            <div class="content">
              <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                Bonjour <strong>${order.customerName}</strong>,<br><br>
                Nous avons bien reçu votre commande du <strong>${new Date(order.date).toLocaleDateString('fr-FR')}</strong>.
                Votre paiement a été accepté et la commande est en cours de préparation.
              </p>
              
              <div class="order-box">
                <h3 style="margin-top: 0; color: #111827; font-size: 18px;">📦 Récapitulatif</h3>
                <table>
                  ${itemsHtml}
                </table>
                <div class="total-row">
                  Total payé : ${order.total.toFixed(2)} €
                </div>
              </div>
              
              <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #065f46; font-size: 15px;">
                  <strong>✓ Paiement confirmé</strong><br>
                  Votre commande sera expédiée sous 24-48h directement par ${order.supplierName || 'la marque'}.
                </p>
              </div>
              
              <center>
                <a href="https://brandia.company/orders/${order.id}" class="btn">Suivre ma commande</a>
              </center>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                Une question ? Répondez simplement à cet email ou contactez-nous à support@brandia.company
              </p>
            </div>
            
            <div class="footer">
              <p style="margin: 0 0 10px 0;"><strong>Brandia</strong> - La marketplace des marques officielles</p>
              <p style="margin: 0; font-size: 12px;">© 2026 Brandia. Tous droits réservés.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  static getSupplierNotificationTemplate(order, supplier) {
    const commission = (order.total * 0.15).toFixed(2);
    const netAmount = (order.total * 0.85).toFixed(2);
    
    const itemsHtml = order.items.map(item => `
      <li style="margin-bottom: 8px; color: #374151;">
        ${item.name} (x${item.quantity}) - ${(item.price * item.quantity).toFixed(2)} €
      </li>
    `).join('');

    return {
      subject: `📦 Nouvelle commande #${order.orderNumber} - ${supplier.companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center; color: white; }
            .content { padding: 40px 30px; }
            .info-box { background-color: #ecfdf5; border-radius: 12px; padding: 24px; margin: 24px 0; border: 2px solid #10b981; }
            .btn { display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .financial { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .row { display: flex; justify-content: space-between; margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Nouvelle vente !</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Une commande vient d'être passée</p>
            </div>
            
            <div class="content">
              <p style="font-size: 16px; color: #374151;">
                Bonjour <strong>${supplier.companyName}</strong>,<br><br>
                Félicitations ! Un client vient de commander vos produits sur Brandia.
              </p>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #065f46;">Commande #${order.orderNumber}</h3>
                <p style="margin-bottom: 0; color: #065f46;"><strong>Client :</strong> ${order.customerName}</p>
              </div>
              
              <h3 style="color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Produits commandés :</h3>
              <ul style="padding-left: 20px; line-height: 1.8;">
                ${itemsHtml}
              </ul>
              
              <div class="financial">
                <div class="row">
                  <span style="color: #6b7280;">Montant total :</span>
                  <span style="font-weight: 600;">${order.total.toFixed(2)} €</span>
                </div>
                <div class="row">
                  <span style="color: #6b7280;">Commission Brandia (15%) :</span>
                  <span style="color: #ef4444; font-weight: 600;">-${commission} €</span>
                </div>
                <div class="row" style="border-top: 2px solid #e5e7eb; padding-top: 10px; margin-top: 10px; font-size: 18px; font-weight: 700; color: #10b981;">
                  <span>Votre revenu :</span>
                  <span>${netAmount} €</span>
                </div>
              </div>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #92400e; font-size: 15px;">
                  <strong>⚡ Action requise :</strong><br>
                  Préparez et expédiez la commande sous 48h pour maintenir votre excellente réputation.
                </p>
              </div>
              
              <center>
                <a href="https://brandia.company/supplier/orders/${order.id}" class="btn">Voir la commande</a>
              </center>
            </div>
          </div>
        </body>
        </html>
      `
    };
  }

  static getShippingTemplate(order, tracking) {
    return {
      subject: `🚚 Votre commande #${order.orderNumber} a été expédiée`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Votre commande est en route ! 🚚</h2>
          <p>Bonjour ${order.customerName},</p>
          <p>Bonne nouvelle ! Votre commande <strong>#${order.orderNumber}</strong> vient d'être expédiée.</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Transporteur :</strong> ${tracking.carrier}</p>
            <p><strong>Numéro de suivi :</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 4px;">${tracking.number}</code></p>
            <a href="${tracking.url}" style="display: inline-block; margin-top: 10px; color: #6366f1; text-decoration: none; font-weight: 600;">
              Suivre mon colis →
            </a>
          </div>
          
          <p>Date de livraison estimée : <strong>${tracking.estimatedDate}</strong></p>
        </div>
      `
    };
  }
}

module.exports = EmailService;