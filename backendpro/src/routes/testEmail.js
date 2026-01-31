const express = require('express');
const router = express.Router();

router.get('/test-email', async (req, res) => {
  try {
    // Vérifier que les vars existent
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({
        success: false,
        error: 'Variables SMTP_USER ou SMTP_PASS manquantes sur Render'
      });
    }

    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      debug: true, // Logs détaillés dans la console Render
      logger: true
    });

    console.log('Tentative connexion Brevo...');
    await transporter.verify();
    console.log('Connexion OK');
    
    const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER;
    
    const info = await transporter.sendMail({
      from: `"Brandia" <${fromEmail}>`,
      to: process.env.SMTP_USER,
      subject: 'Test Brandia',
      html: '<h2>Email OK</h2>'
    });

    res.json({ 
      success: true, 
      message: 'Email envoyé',
      to: process.env.SMTP_USER
    });

  } catch (error) {
    console.error('ERREUR SMTP:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      solution: 'Si ECONNREFUSED: Brevo bloque peut-être Render. Essayez SendGrid ou Mailgun.'
    });
  }
});

module.exports = router;