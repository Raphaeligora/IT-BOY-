// IT BOY - Vercel Serverless Function
// Cree une session Stripe Checkout (abonnement Premium) pour
// l'utilisateur authentifie et renvoie l'URL de redirection.
//
// Variables d'environnement requises (Vercel -> Settings -> Environment
// Variables) :
//   STRIPE_SECRET_KEY        cle secrete Stripe (mode test pour commencer)
//   STRIPE_PRICE_ID_PREMIUM  id du Price recurrent Premium (price_...)
//   SUPABASE_URL             URL du projet Supabase
//   SUPABASE_SECRET_KEY      cle secrete Supabase (Project Settings -> API Keys)
//   PUBLIC_SITE_URL          URL publique du site (ex: https://it-boy.vercel.app)

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode non autorisee' });
    return;
  }

  const required = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID_PREMIUM', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    res.status(500).json({ error: 'Configuration serveur incomplete: ' + missing.join(', ') });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Non authentifie' });
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData || !userData.user) {
      res.status(401).json({ error: 'Session invalide' });
      return;
    }
    const user = userData.user;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, plan')
      .eq('id', user.id)
      .single();
    if (profileError) throw profileError;

    let customerId = profile && profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }
      });
      customerId = customer.id;
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const siteUrl = process.env.PUBLIC_SITE_URL || ('https://' + req.headers.host);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: process.env.STRIPE_PRICE_ID_PREMIUM, quantity: 1 }],
      success_url: siteUrl + '/dashboard/?premium=success',
      cancel_url: siteUrl + '/plans/',
      subscription_data: { metadata: { supabase_user_id: user.id } },
      metadata: { supabase_user_id: user.id }
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[create-checkout-session]', err);
    res.status(500).json({ error: 'Impossible de creer la session de paiement' });
  }
};
