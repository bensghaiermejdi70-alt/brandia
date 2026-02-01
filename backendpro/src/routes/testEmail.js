const express = require('express');
const router = express.Router();
const BrevoAPI = require('../utils/brevo-api');

router.get('/test-email', async (req, res) => {
  try {
    // Vérifier la clé API
    if (!process.env.BREVO_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'BREVO_API_KEY manquante dans les variables d\'environnement'
      });
    }

    // Test envoi simple
    const result = await BrevoAPI.sendEmail(
      process.env.EMAIL_FROM || 'test@brandia.company', // S'envoyer à soi-même
      'Test Brandia - API Brevo',
      '<h2>Ça marche ! 🎉</h2><p>L\'API Brevo fonctionne sur Render.</p>'
    );

    res.json({
      success: true,
      message: 'Email envoyé via API Brevo',
      messageId: result.messageId
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Vérifiez BREVO_API_KEY (commence par xkeysib-...)'
    });
  }
});

module.exports = router;