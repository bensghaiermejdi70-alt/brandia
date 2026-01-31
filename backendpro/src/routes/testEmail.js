// backendpro/src/routes/testEmail.js - VERSION DEBUG
const express = require('express');
const router = express.Router();

router.get('/test-email', async (req, res) => {
  try {
    // Vérifier les variables d'environnement
    const requiredEnv = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'];
    const missing = requiredEnv.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      return res.status(500).json({
        success: false,
        message: 'Variables manquantes sur Render',
        missing: missing
      });
    }

    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.verify();
    
    const info = await transporter.sendMail({
      from: `"Brandia" <${process.env.EMAIL_FROM}>`,
      to: process.env.SMTP_USER,
      subject: 'Test Brandia',
      html: '<h2>Email OK</h2>'
    });

    res.json({ success: true, messageId: info.messageId });

  } catch (error) {
    console.error('[EMAIL ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message,
      type: error.code || 'UNKNOWN'
    });
  }
});

module.exports = router;