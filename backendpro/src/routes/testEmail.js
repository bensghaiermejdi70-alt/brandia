// backendpro/src/routes/testEmail.js
const express = require('express');
const router = express.Router();

router.get('/test-email', async (req, res) => {
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 465,        // Port SSL obligatoire sur Render
      secure: true,     // true pour 465, false pour 587
      auth: {
        user: process.env.SMTP_USER,  // xsmtpsib-...
        pass: process.env.SMTP_PASS   // xsmtpsib-... (identique)
      }
    });

    await transporter.verify();
    
    const info = await transporter.sendMail({
      from: `"Brandia" <${process.env.EMAIL_FROM}>`,
      to: process.env.SMTP_USER, // S'envoyer à soi-même
      subject: '✅ Test Brandia - Email OK',
      html: '<h2>Configuration réussie ! 🎉</h2><p>Les emails fonctionnent sur Render.</p>'
    });

    res.json({ 
      success: true, 
      message: 'Email envoyé',
      messageId: info.messageId 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Vérifiez SMTP_USER et SMTP_PASS identiques (clé xsmtpsib-...)'
    });
  }
});

module.exports = router;