// Vercel Serverless Function - captacio professional AMBIOTA
// Variable d'entorn recomanada:
//   GHL_WEBHOOK_PRO_LEAD_URL
//
// Aquesta funcio evita exposar el webhook de GoHighLevel al navegador.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookUrl = process.env.GHL_WEBHOOK_PRO_LEAD_URL;
  const payload = req.body || {};

  const cleanPayload = {
    ...payload,
    event_name: payload.event_name || 'pro_ambiota_lead',
    source_page: payload.source_page || 'pro-ambiota',
    tags: payload.tags || ['lead-professional', 'pro-ambiota-landing', 'demo-informe-solicitada'],
  };

  if (!webhookUrl) {
    console.warn('[pro-lead] GHL_WEBHOOK_PRO_LEAD_URL no configurat');
    return res.status(200).json({
      success: true,
      configured: false,
      message: 'Webhook not configured. Payload accepted in preview mode.',
    });
  }

  try {
    const ghlRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanPayload),
    });

    if (!ghlRes.ok) {
      console.error('[pro-lead] GHL error status:', ghlRes.status);
      return res.status(502).json({ success: false, error: 'GHL webhook error' });
    }

    return res.status(200).json({ success: true, configured: true });
  } catch (error) {
    console.error('[pro-lead] error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
};
