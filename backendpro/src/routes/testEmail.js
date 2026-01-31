const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

router.get('/test-email', async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: `"Brandia" <${process.env.EMAIL_FROM}>`,
      to: process.env.SMTP_USER, // tu t’envoies à toi-même
      subject: '✅ Test email Brandia',
      html: `<h2>Email OK 🎉</h2><p>Brevo fonctionne correctement.</p>`
    });

    res.json({ success: true, message: 'Email envoyé avec succès' });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur envoi email',
      error: error.message
    });
  }
});

module.exports = router;
