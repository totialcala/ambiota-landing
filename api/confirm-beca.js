// api/confirm-beca.js — Vercel Serverless Function
// Rep les dades del formulari confirmacio-beca.html,
// dispara el webhook de GHL (workflow: tags + emails + Skool)
// i actualitza els camps del contacte via GHL API.
//
// Variable d'entorn necessària a Vercel:
//   GHL_API_KEY  →  la teva clau privada de GHL
 
const GHL_WEBHOOK =
  'https://services.leadconnectorhq.com/hooks/OtSoCnSUJJBfnTX1qznq/webhook-trigger/ee342d57-617a-457c-912e-d19c52481081';
 
module.exports = async function handler(req, res) {
  // CORS — mateixa origin, però per si de cas
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 
  const {
    contact_id,
    first_name,
    last_name,
    email,
    specialty,
    firma_nombre,
    dni_cif,
    timestamp_confirmacion,
    accepted_terms,
    accepted_compromis,
    accepted_privacy,
    marketing_consent,
    programa,
  } = req.body || {};
 
  const GHL_API_KEY = process.env.GHL_API_KEY;
 
  // ── 1. Disparar webhook GHL (workflow: tags, emails, Skool) ──────────────
  try {
    await fetch(GHL_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id, first_name, last_name, email, specialty,
        firma_nombre, dni_cif, timestamp_confirmacion,
        accepted_terms, accepted_compromis, accepted_privacy,
        marketing_consent, programa,
      }),
    });
  } catch (err) {
    console.error('[webhook] error:', err.message);
  }
 
  // ── 2. Actualitzar camps del contacte via GHL API ────────────────────────
  if (contact_id && GHL_API_KEY) {
    try {
      const apiRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/${contact_id}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${GHL_API_KEY}`,
            'Content-Type': 'application/json',
            Version: '2021-07-28',
          },
          body: JSON.stringify({
            customFields: [
              { key: 'firma_nombre',           field_value: firma_nombre || '' },
              { key: 'dni',                    field_value: dni_cif || '' },
              { key: 'fecha_confirmacion_beca', field_value: timestamp_confirmacion || '' },
            ],
          }),
        }
      );
      const data = await apiRes.json();
      console.log('[ghl-api] update result:', JSON.stringify(data));
    } catch (err) {
      console.error('[ghl-api] error:', err.message);
    }
  } else {
    console.warn('[ghl-api] saltat — contact_id o GHL_API_KEY buit');
  }
 
  return res.status(200).json({ success: true });
};
 
