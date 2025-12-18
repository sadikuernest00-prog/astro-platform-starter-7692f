import type { APIRoute } from "astro";
import Stripe from "stripe";
import { CATALOG } from "../../lib/catalog";

const secret = import.meta.env.STRIPE_SECRET_KEY;
if (!secret) throw new Error("Missing STRIPE_SECRET_KEY env var");

const stripe = new Stripe(secret);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const items: Array<{ id: string; quantity?: number; size?: string; color?: string }> = body?.items ?? [];

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Cart is empty." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const line_items = items.map((it) => {
      const p = CATALOG[it.id];
      if (!p) throw new Error(`Unknown product id: ${it.id}`);

      const qty = Math.max(1, Math.min(99, Number(it.quantity ?? 1)));

      return {
        quantity: qty,
        price_data: {
          currency: p.currency,
          unit_amount: p.amount,
          product_data: {
            name: p.name,
            metadata: {
              size: it.size ?? "",
              color: it.color ?? "",
            },
          },
        },
      };
    });

    const siteUrl = import.meta.env.PUBLIC_SITE_URL;
    if (!siteUrl) throw new Error("Missing PUBLIC_SITE_URL env var");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel`,
      billing_address_collection: "required",
      shipping_address_collection: { allowed_countries: ["NO", "SE", "DK"] },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Error creating checkout session." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};

