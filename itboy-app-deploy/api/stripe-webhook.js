// IT BOY - Vercel Serverless Function
// Recoit les evenements Stripe (abonnement Premium) et met a jour
// profiles.plan dans Supabase. Necessite le corps brut de la requete
// pour verifier la signature, donc le bodyParser Vercel est desactive.
//
// Variables d'environnement requises :
//   STRIPE_SECRET_KEY     cle secrete Stripe
//   STRIPE_WEBHOOK_SECRET signature du endpoint (whsec_..., recuperee
//                          dans Stripe -> Developers -> Webhooks une fois
//                          ce endpoint enregistre)
//   SUPABASE_URL
//   SUPABASE_SECRET_KEY

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] signature invalide', err.message);
    res.status(400).send('Webhook signature invalide: ' + err.message);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = (session.metadata && session.metadata.supabase_user_id) || session.client_reference_id;
        if (userId) {
          await supabase.from('profiles').update({
            plan: 'premium',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription
          }).eq('id', userId);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const active = sub.status === 'active' || sub.status === 'trialing';
        const userId = sub.metadata && sub.metadata.supabase_user_id;
        if (userId) {
          await supabase.from('profiles').update({
            plan: active ? 'premium' : 'free',
            stripe_subscription_id: sub.id
          }).eq('id', userId);
        } else {
          await supabase.from('profiles').update({
            plan: active ? 'premium' : 'free'
          }).eq('stripe_customer_id', sub.customer);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata && sub.metadata.supabase_user_id;
        if (userId) {
          await supabase.from('profiles').update({ plan: 'free', stripe_subscription_id: null }).eq('id', userId);
        } else {
          await supabase.from('profiles').update({ plan: 'free', stripe_subscription_id: null }).eq('stripe_customer_id', sub.customer);
        }
        break;
      }
      default:
        break;
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook] erreur traitement', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
};
