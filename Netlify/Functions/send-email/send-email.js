// netlify/functions/send-email/send-email.js
// Uses fetch to call SendGrid API directly — no node_modules needed

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { toEmail, toName, subject, body, fromName, fromEmail, attachmentHtml, attachmentName } = JSON.parse(event.body || "{}");

    if (!toEmail || !subject || !body) {
      return { statusCode: 400, body: JSON.stringify({ error: "toEmail, subject, and body are required" }) };
    }

    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Email service not configured (missing SENDGRID_API_KEY)" }) };
    }

    const senderEmail = process.env.SENDGRID_FROM_EMAIL || fromEmail || "noreply@cabshoppro.com";
    const senderName  = fromName || process.env.SENDGRID_FROM_NAME || "CabShop Pro";

    const payload = {
      personalizations: [{ to: [{ email: toEmail, name: toName || "" }] }],
      from: { email: senderEmail, name: senderName },
      subject,
      content: [
        { type: "text/plain", value: body },
        { type: "text/html", value: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:24px;">${body.replace(/\n/g, "<br/>")}<hr style="margin-top:32px;border:none;border-top:1px solid #eee;"/><p style="font-size:11px;color:#aaa;margin-top:8px;">Sent via CabShop Pro</p></div>` }
      ]
    };

    // Attach HTML document if provided (quote or invoice)
    if (attachmentHtml) {
      const base64 = Buffer.from(attachmentHtml, "utf-8").toString("base64");
      payload.attachments = [{
        content: base64,
        filename: attachmentName || "document.html",
        type: "text/html",
        disposition: "attachment"
      }];
    }

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 202) {
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true }) };
    }

    const errText = await res.text();
    return { statusCode: 500, body: JSON.stringify({ error: errText || "SendGrid error" }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "Unknown error" }) };
  }
};
