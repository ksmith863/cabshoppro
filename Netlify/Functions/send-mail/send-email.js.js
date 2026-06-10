// netlify/functions/send-email.js
// General-purpose email sender for CabShop Pro
// Used by: Quote emails, Invoice emails, Purchase Order emails
// Matches the SendGrid setup used by send-approval-email.js

const sgMail = require("@sendgrid/mail");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { toEmail, toName, subject, body, fromName, fromEmail } = JSON.parse(event.body || "{}");

    if (!toEmail || !subject || !body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "toEmail, subject, and body are required" }),
      };
    }

    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Email service not configured (missing SENDGRID_API_KEY)" }),
      };
    }

    sgMail.setApiKey(apiKey);

    // Use the verified sender from env, falling back to fromEmail if set
    const senderEmail = process.env.SENDGRID_FROM_EMAIL || fromEmail || "noreply@cabshoppro.com";
    const senderName  = fromName || process.env.SENDGRID_FROM_NAME || "CabShop Pro";

    const msg = {
      to:   toName ? { email: toEmail, name: toName } : toEmail,
      from: { email: senderEmail, name: senderName },
      subject,
      // Plain text body — preserves line breaks from the composer
      text: body,
      // Simple HTML version wrapping the plain text
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:24px;">
        ${body.replace(/\n/g, "<br/>")}
        <hr style="margin-top:32px;border:none;border-top:1px solid #eee;"/>
        <p style="font-size:11px;color:#aaa;margin-top:8px;">Sent via CabShop Pro</p>
      </div>`,
    };

    await sgMail.send(msg);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("send-email error:", err?.response?.body || err);
    const message = err?.response?.body?.errors?.[0]?.message || err.message || "Unknown error";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: message }),
    };
  }
};
