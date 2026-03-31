// Magic Link — Aprovar Plaça
// Quan l'Eli clica el botó de l'email intern, aquesta funció:
// 1. Rep el contact_id per GET
// 2. Crida el webhook de GHL per moure el contacte a "Plaça Reservada"
// 3. Redirigeix a una pàgina de confirmació

export default async function handler(req, res) {
  const { contact_id } = req.query;

  if (!contact_id) {
    return res.status(400).send('Falta el contact_id');
  }

  const GHL_WEBHOOK_URL =
    'https://services.leadconnectorhq.com/hooks/OtSoCnSUJJBfnTX1qznq/webhook-trigger/57b74a85-04f2-4523-a789-19af14cfa913';

  try {
    await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id }),
    });

    // Redirigeix a pàgina de confirmació
    res.redirect(302, `/aprovada.html?contact_id=${contact_id}`);
  } catch (error) {
    console.error('Error cridant webhook GHL:', error);
    res.status(500).send('Error intern. Torna-ho a intentar.');
  }
}
