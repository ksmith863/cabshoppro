// netlify/functions/send-email/send-email.js
// Attaches all supporting docs (T&C HTML + uploaded files) to the email

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const {
      toEmail, toName, subject, body, htmlBody,
      fromName, fromEmail, attachmentHtml, attachmentName,
      supportingDocs, userApiKey
    } = JSON.parse(event.body || "{}");

    if (!toEmail || !subject || !body) {
      return { statusCode: 400, body: JSON.stringify({ error: "toEmail, subject, and body are required" }) };
    }

    const apiKey = userApiKey || process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "No email API key configured." }) };
    }

    const senderEmail = fromEmail || process.env.SENDGRID_FROM_EMAIL || "noreply@cabshoppro.com";
    const senderName  = fromName  || process.env.SENDGRID_FROM_NAME  || "CabShop Pro";

    const attachmentInstructions = attachmentHtml ? `
      <div style="margin-top:40px;padding:16px 20px;background:#f8f7f3;border:1px solid #e0e0d0;border-radius:8px;font-family:Arial,sans-serif;font-size:12px;color:#666;line-height:1.7;">
        <strong style="color:#333;">📎 About the attached document</strong><br/>
        To save or print a PDF copy: open the attachment in your browser → Ctrl+P / ⌘+P → Save as PDF.
      </div>` : "";

    const emailHtml = htmlBody
      ? htmlBody.replace("</body>", attachmentInstructions + "</body>")
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

    const attachments = [];

    // Main quote/invoice HTML
    if (attachmentHtml) {
      attachments.push({
        content: Buffer.from(attachmentHtml, "utf-8").toString("base64"),
        filename: attachmentName || "document.html",
        type: "text/html",
        disposition: "attachment"
      });
    }

    // Supporting documents — attach each one
    if (Array.isArray(supportingDocs) && supportingDocs.length > 0) {
      for (const doc of supportingDocs) {
        try {
          if (doc.htmlContent) {
            // T&C or resource doc — attach as HTML file
            attachments.push({
              content: Buffer.from(doc.htmlContent, "utf-8").toString("base64"),
              filename: doc.name.replace(/[^a-zA-Z0-9 \-_]/g, "").trim() + ".html",
              type: "text/html",
              disposition: "attachment"
            });
          } else if (doc.url && !doc.url.startsWith("data:")) {
            // Uploaded file — fetch and attach
            const res = await fetch(doc.url);
            if (res.ok) {
              const buffer = await res.arrayBuffer();
              const base64 = Buffer.from(buffer).toString("base64");
              // Detect MIME type from URL extension
              const ext = doc.url.split(".").pop().toLowerCase().split("?")[0];
              const mimeMap = { pdf:"application/pdf", jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", gif:"image/gif", webp:"image/webp", doc:"application/msword", docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls:"application/vnd.ms-excel", xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", txt:"text/plain", csv:"text/csv" };
              const mimeType = mimeMap[ext] || "application/octet-stream";
              attachments.push({
                content: base64,
                filename: doc.name,
                type: mimeType,
                disposition: "attachment"
              });
            }
          }
        } catch (docErr) {
          console.warn("Could not attach doc:", doc.name, docErr.message);
        }
      }
    }

    if (attachments.length) payload.attachments = attachments;

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
