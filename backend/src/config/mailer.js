const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const enviarEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL SIMULADO] Para: ${to} | Asunto: ${subject}`);
    return;
  }
  await transporter.sendMail({
    from: `"${process.env.NOMBRE_NEGOCIO || 'RefriElectri Pro'}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = { enviarEmail };
