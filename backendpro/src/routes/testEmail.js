/const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

// ===============================
// Config SMTP Brevo
// ===============================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,      // ex: "smtp-relay.brevo.com"
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,                     // true si SSL, false pour TLS
  auth: {
    user: process.env.SMTP_USER,     // ton login SMTP Brevo
    pass: process.env.SMTP_PASS      // ton mot de passe SMTP Brevo
  }
});

// ===============================
// Endpoint test
// GET /api/test-email
// ===============================
router.get("/", async (req, res) => {
  try {
    // Message test (optionnel, juste pour vérifier SMTP)
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || "noreply@brandia.company",
      to: process.env.SMTP_USER,   // envoie à toi-même pour tester
      subject: "Test email Brandia",
      text: "✅ Ceci est un email de test depuis l'endpoint /api/test-email",
    });

    res.json({
      success: true,
      message: "Endpoint test-email fonctionne et email envoyé !",
      info: info.response || "Email simulé"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi de l'email",
      error: error.message
    });
  }
});

module.exports = router;
