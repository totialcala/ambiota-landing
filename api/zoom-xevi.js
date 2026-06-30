// Compat tracking link - Webinar Xevi Verdaguer 2026-07-01
//
// Aquesta ruta ja no envia directament a Zoom.
// Redirigeix a la landing AMBIOTA amb font/UTMs perquè el registre principal
// passi per AMBIOTA -> Zoom individual -> GHL.

const LANDING_URL = '/webinar-xevi-salut-femenina.html';
const CAMPAIGN = 'webinar_xevi_salud_femenina_20260701';

const SOURCES = {
  landing: {
    utm_source: 'ambiota_landing',
    utm_medium: 'web',
    utm_content: 'landing_cta',
  },
  xevi: {
    utm_source: 'xevi_verdaguer',
    utm_medium: 'social',
    utm_content: 'xevi_share',
  },
  equip: {
    utm_source: 'ambiota_team',
    utm_medium: 'direct',
    utm_content: 'team_contacts',
  },
  academy: {
    utm_source: 'ambiota_academy',
    utm_medium: 'community',
    utm_content: 'skool_academy',
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const sourceKey = String(req.query.src || 'landing').toLowerCase();
  const sourceConfig = SOURCES[sourceKey] || SOURCES.landing;
  const origin = `https://${req.headers.host}`;
  const url = new URL(LANDING_URL, origin);

  url.searchParams.set('src', SOURCES[sourceKey] ? sourceKey : 'landing');
  url.searchParams.set('utm_source', sourceConfig.utm_source);
  url.searchParams.set('utm_medium', sourceConfig.utm_medium);
  url.searchParams.set('utm_campaign', CAMPAIGN);
  url.searchParams.set('utm_content', sourceConfig.utm_content);

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.redirect(302, url.toString());
};
