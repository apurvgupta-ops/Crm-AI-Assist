const nodemailer = require("nodemailer");
const path = require("path");

/**
 * Sends an email using nodemailer.
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} [options.html] - HTML body (optional)
 * @returns {Promise<Object>} - Result of sending mail
 */

// const signatureImagePath = path.resolve(__dirname, '../../email-signature.jpeg');

async function sendMail({ to, subject, text, attachments }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html: `${text.replace(/\n/g, "<br>")}<br><br>
      <img src="cid:signature_img" alt="Signature" style="width:300px; height:auto;" />`,
    attachments: attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    throw new Error("Failed to send email: " + error.message);
  }
}

module.exports = sendMail;
