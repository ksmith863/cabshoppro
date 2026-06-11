// netlify/functions/create-payment-link/create-payment-link.js
// Creates a Stripe Payment Link for a specific invoice amount

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { amount, currency, description, invoiceNumber, customerEmail, customerName, successUrl } = JSON.parse(event.body || "{}");

    if (!amount || amount <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Valid amount is required" }) };
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Stripe not configured" }) };
    }

    // Step 1: Create a Price object for this one-time amount
    const priceRes = await fetch("https://api.stripe.com/v1/prices", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        unit_amount: String(Math.round(amount * 100)), // convert to cents
        currency: currency || "usd",
        "product_data[name]": description || `Invoice ${invoiceNumber}`,
        "product_data[metadata][invoice_number]": invoiceNumber || "",
      }).toString(),
    });

    const priceData = await priceRes.json();
    if (priceData.error) {
      return { statusCode: 500, body: JSON.stringify({ error: priceData.error.message }) };
    }

    // Step 2: Create the Payment Link
    const params = new URLSearchParams({
      "line_items[0][price]": priceData.id,
      "line_items[0][quantity]": "1",
      "after_completion[type]": "redirect",
      "after_completion[redirect][url]": successUrl || "https://cabshoppro.com",
      "metadata[invoice_number]": invoiceNumber || "",
      "metadata[customer_email]": customerEmail || "",
    });

    // Pre-fill customer email if provided
    if (customerEmail) {
      params.append("customer_creation", "always");
    }

    const linkRes = await fetch("https://api.stripe.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const linkData = await linkRes.json();
    if (linkData.error) {
      return { statusCode: 500, body: JSON.stringify({ error: linkData.error.message }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: linkData.url, id: linkData.id }),
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "Unknown error" }) };
  }
};
