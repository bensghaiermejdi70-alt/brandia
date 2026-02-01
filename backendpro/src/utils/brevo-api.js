// utils/brevo-api.js
const SibApiV3Sdk = require('sib-api-v3-sdk');

const defaultClient = SibApiV3Sdk.ApiClient.instance;

// ---------- DEBUG / Vérification des variables d'environnement ----------
console.log('🔹 BREVO_KEY OK ?', process.env.BREVO_API_KEY?.startsWith('xkeysib-'));
console.log('🔹 EMAIL_FROM:', process.env.EMAIL_FROM);

// ---------- Configuration clé API ----------
const apiKey = defaultClient.authentications['api-key'];
if (!process.env.BREVO_API_KEY || !process.env.BREVO_API_KEY.startsWith('xkeysib-')) {
  throw new Error('Clé BREVO_API_KEY manquante ou invalide !');
}
apiKey.apiKey = process.env.BREVO_API_KEY; // Clé API v3 (pas SMTP)

// ---------- Création de l'instance API ----------
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// ---------- Fonction d'envoi d'email ----------
const sendEmail = async (to, subject, htmlContent) => {

  if (!process.env.EMAIL_FROM) {
    throw new Error('Variable EMAIL_FROM non définie !');
  }

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.sender = {
    name: "Brandia",
    email: process.env.EMAIL_FROM
  };
  sendSmtpEmail.to = [{ email: to }];

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Email envoyé:', data);
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error('❌ Erreur API Brevo:', error.response?.body || error.message || error);
    throw new Error('Échec de l’envoi de l’email. Vérifiez BREVO_API_KEY et EMAIL_FROM.');
  }
};

module.exports = { sendEmail };
