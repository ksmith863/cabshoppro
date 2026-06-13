// netlify/functions/send-email/send-email.js

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const {
      toEmail, toName, ccEmail, bccEmail, subject, body, htmlBody,
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

    const emailHtml = htmlBody
      ? htmlBody.replace("</body>", "</body>")
      : `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:24px;">
          ${body.replace(/\n/g, "<br/>")}
          <hr style="margin-top:32px;border:none;border-top:1px solid #eee;"/>
          <p style="font-size:11px;color:#aaa;margin-top:8px;">Sent via CabShop Pro</p>
         </div>`;

    const payload = {
      personalizations: [{
        to: [{ email: toEmail, name: toName || "" }],
        ...(ccEmail ? { cc: [{ email: ccEmail }] } : {}),
        ...(bccEmail ? { bcc: [{ email: bccEmail }] } : {}),
      }],
      from: { email: senderEmail, name: senderName },
      reply_to: { email: senderEmail, name: senderName },
      subject,
      content: [
        { type: "text/plain", value: body },
        { type: "text/html",  value: emailHtml }
      ]
    };

    const attachments = [];

    // NOTE: Quote/invoice HTML is sent as the email body (htmlBody), not as an attachment
    // Attaching .html files causes Gmail to display raw HTML code — not user-friendly
    // The formatted quote is already visible directly in the email body

    // Supporting documents — URL always takes priority over docText
    if (Array.isArray(supportingDocs) && supportingDocs.length > 0) {
      for (const doc of supportingDocs) {
        try {
          if (doc.url && !doc.url.startsWith("data:")) {
            // Has a real file URL — fetch and attach as original format
            const res = await fetch(doc.url);
            if (res.ok) {
              const buffer = await res.arrayBuffer();
              const base64 = Buffer.from(buffer).toString("base64");
              const ext = (doc.url.split("?")[0].split(".").pop() || "bin").toLowerCase();
              const mimeMap = {
                pdf: "application/pdf",
                jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
                gif: "image/gif", webp: "image/webp",
                doc: "application/msword",
                docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                xls: "application/vnd.ms-excel",
                xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                txt: "text/plain", csv: "text/csv",
                dwg: "application/acad", dxf: "application/dxf"
              };
              attachments.push({
                content: base64,
                filename: doc.name,
                type: mimeMap[ext] || "application/octet-stream",
                disposition: "attachment"
              });
            }
          } else if (doc.docText) {
            // No file URL — fall back to plain text only as last resort
            const textContent = `${doc.name}\n${"=".repeat(Math.min(doc.name.length, 60))}\n\n${doc.docText}`;
            attachments.push({
              content: Buffer.from(textContent, "utf-8").toString("base64"),
              filename: doc.name.replace(/[^a-zA-Z0-9 \-_]/g, "").trim() + ".txt",
              type: "text/plain",
              disposition: "attachment"
            });
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
