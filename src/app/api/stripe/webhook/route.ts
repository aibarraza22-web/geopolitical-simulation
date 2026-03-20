import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// =============================================================================
// Stripe webhook handler
// =============================================================================

function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook verification failed";
    console.error("[Stripe Webhook] Verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// Event handlers
// =============================================================================

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const orgId = session.metadata?.org_id;
  if (!orgId) {
    console.warn("[Stripe] checkout.session.completed: missing org_id metadata");
    return;
  }

  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  // In production: update org record in Supabase
  console.log(`[Stripe] Checkout completed for org ${orgId}:`, {
    subscriptionId,
    customerId,
    mode: session.mode,
    amountTotal: session.amount_total,
  });

  // TODO:
  // const supabase = await createServiceClient();
  // await supabase.from("orgs").update({
  //   stripe_customer_id: customerId,
  //   stripe_subscription_id: subscriptionId,
  //   subscription_status: "active",
  //   plan: getPlanFromPriceId(session.metadata?.price_id),
  // }).eq("id", orgId);
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const orgId = subscription.metadata?.org_id;
  const status = subscription.status;
  const priceId = subscription.items.data[0]?.price.id;

  console.log(`[Stripe] Subscription updated for org ${orgId}:`, {
    status,
    priceId,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  // TODO: Update org subscription_status in Supabase
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const orgId = subscription.metadata?.org_id;

  console.log(`[Stripe] Subscription canceled for org ${orgId}`);

  // TODO: Downgrade org to free tier in Supabase
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;

  console.warn(`[Stripe] Payment failed for customer ${customerId}:`, {
    invoiceId: invoice.id,
    amount: invoice.amount_due,
    attemptCount: invoice.attempt_count,
  });

  // TODO:
  // 1. Update subscription_status to "past_due" in Supabase
  // 2. Send payment failure notification email via Resend
}
