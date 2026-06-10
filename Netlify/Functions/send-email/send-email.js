// netlify/functions/send-email/send-email.js
// Uses fetch to call SendGrid API directly — no node_modules needed
// Supports per-user API keys (Option A multi-tenant)
// Sends full HTML quote/invoice as email body when available

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const {
      toEmail, toName, subject, body, htmlBody,
      fromName, fromEmail, attachmentHtml, attachmentName, userApiKey
    } = JSON.parse(event.body || "{}");

    if (!toEmail || !subject || !body) {
      return { statusCode: 400, body: JSON.stringify({ error: "toEmail, subject, and body are required" }) };
    }

    const apiKey = userApiKey || process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "No email API key configured. Please add your SendGrid API key in Admin Settings → Email." }) };
    }

    const senderEmail = fromEmail || process.env.SENDGRID_FROM_EMAIL || "noreply@cabshoppro.com";
    const senderName  = fromName  || process.env.SENDGRID_FROM_NAME  || "CabShop Pro";

    // Build HTML body — use full quote/invoice HTML if provided, otherwise simple formatted body
    const emailHtml = htmlBody
      ? htmlBody  // Full rendered quote or invoice HTML
      : `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:24px;">
          ${body.replace(/\n/g, "<br/>")}
          <hr style="margin-top:32px;border:none;border-top:1px solid #eee;"/>
          <p style="font-size:11px;color:#aaa;margin-top:8px;">Sent via CabShop Pro</p>
         </div>`;

    const payload = {
      personalizations: [{ to: [{ email: toEmail, name: toName || "" }] }],
      from: { email: senderEmail, name: senderName },
      reply_to: { email: senderEmail, name: senderName },
      subject,
      content: [
        { type: "text/plain", value: body },
        { type: "text/html",  value: emailHtml }
      ]
    };

    // Also attach the HTML document so clients can download/print it
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
