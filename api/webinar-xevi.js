// Registro webinar Xevi Verdaguer 2026-07-01
//
// Flux:
// 1. Rep dades del formulari AMBIOTA.
// 2. Registra la persona a Zoom i obté join_url individual.
// 3. Envia dades + font + join_url a GoHighLevel.
//
// Variables d'entorn:
//   GHL_WEBHOOK_WEBINAR_XEVI_URL
//   ZOOM_ACCOUNT_ID
//   ZOOM_CLIENT_ID
//   ZOOM_CLIENT_SECRET
//   ZOOM_MEETING_ID

const CAMPAIGN = 'webinar_xevi_salud_femenina_20260701';

const SOURCE_MAP = {
  landing: {
    label: 'Landing AMBIOTA',
    utm_source: 'ambiota_landing',
    utm_medium: 'web',
    utm_content: 'landing_form',
    tag: 'webinar-xevi-src-landing',
  },
  xevi: {
    label: 'Xarxes Xevi Verdaguer',
    utm_source: 'xevi_verdaguer',
    utm_medium: 'social',
    utm_content: 'xevi_share',
    tag: 'webinar-xevi-src-xevi',
  },
  equip: {
    label: 'Contactes equip AMBIOTA',
    utm_source: 'ambiota_team',
    utm_medium: 'direct',
    utm_content: 'team_contacts',
    tag: 'webinar-xevi-src-equip',
  },
  academy: {
    label: 'AMBIOTA Academy',
    utm_source: 'ambiota_academy',
    utm_medium: 'community',
    utm_content: 'skool_academy',
    tag: 'webinar-xevi-src-academy',
  },
};

function normalizeSource(value) {
  const key = String(value || 'landing').toLowerCase();
  if (SOURCE_MAP[key]) return key;
  const found = Object.entries(SOURCE_MAP).find(([, config]) => config.utm_source === key);
  return found ? found[0] : 'landing';
}

function buildTags(sourceKey, extraTags) {
  return [...new Set([
    'webinar-xevi-20260701-registrat',
    'lead-professional',
    'salut-femenina',
    SOURCE_MAP[sourceKey].tag,
    ...(Array.isArray(extraTags) ? extraTags : []),
  ].filter(Boolean))];
}

function requireEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

async function getZoomAccessToken() {
  const accountId = requireEnv('ZOOM_ACCOUNT_ID');
  const clientId = requireEnv('ZOOM_CLIENT_ID');
  const clientSecret = requireEnv('ZOOM_CLIENT_SECRET');

  if (!accountId || !clientId || !clientSecret) {
    return { configured: false, missing: ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'].filter((name) => !requireEnv(name)) };
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`;

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const tokenData = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Zoom OAuth error ${tokenRes.status}: ${JSON.stringify(tokenData)}`);
  }

  return { configured: true, accessToken: tokenData.access_token };
}

async function findExistingZoomRegistrant(accessToken, meetingId, email) {
  const encodedMeetingId = encodeURIComponent(meetingId);
  let nextPageToken = '';

  for (let page = 0; page < 5; page += 1) {
    const url = new URL(`https://api.zoom.us/v2/meetings/${encodedMeetingId}/registrants`);
    url.searchParams.set('status', 'approved');
    url.searchParams.set('page_size', '300');
    if (nextPageToken) url.searchParams.set('next_page_token', nextPageToken);

    const listRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) return null;

    const listData = await listRes.json().catch(() => ({}));
    const registrants = Array.isArray(listData.registrants) ? listData.registrants : [];
    const match = registrants.find((item) => String(item.email || '').toLowerCase() === String(email || '').toLowerCase());
    if (match) return match;

    nextPageToken = listData.next_page_token || '';
    if (!nextPageToken) break;
  }

  return null;
}

async function registerZoomRegistrant(payload) {
  const meetingId = requireEnv('ZOOM_MEETING_ID');
  const tokenResult = await getZoomAccessToken();

  if (!meetingId || !tokenResult.configured) {
    return {
      configured: false,
      missing: [
        ...(!meetingId ? ['ZOOM_MEETING_ID'] : []),
        ...(tokenResult.missing || []),
      ],
    };
  }

  const encodedMeetingId = encodeURIComponent(meetingId);
  const body = {
    email: payload.email,
    first_name: payload.first_name || payload.email,
    last_name: payload.last_name || '',
    org: payload.organization || 'AMBIOTA',
    job_title: payload.specialty || '',
    comments: [
      payload.question ? `Pregunta: ${payload.question}` : '',
      payload.interest ? `Interes: ${payload.interest}` : '',
      payload.source_label ? `Fuente: ${payload.source_label}` : '',
    ].filter(Boolean).join('\n'),
  };

  const zoomRes = await fetch(`https://api.zoom.us/v2/meetings/${encodedMeetingId}/registrants`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenResult.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const zoomData = await zoomRes.json().catch(() => ({}));

  if (zoomRes.ok) {
    return {
      configured: true,
      success: true,
      meeting_id: meetingId,
      registrant_id: zoomData.registrant_id || zoomData.id || '',
      join_url: zoomData.join_url || '',
      start_time: zoomData.start_time || '',
      status: zoomData.status || 'created',
      raw_status: zoomRes.status,
    };
  }

  const message = JSON.stringify(zoomData).toLowerCase();
  if (zoomRes.status === 409 || message.includes('already') || message.includes('registrant exists')) {
    const existing = await findExistingZoomRegistrant(tokenResult.accessToken, meetingId, payload.email);
    if (existing) {
      return {
        configured: true,
        success: true,
        duplicate: true,
        meeting_id: meetingId,
        registrant_id: existing.id || existing.registrant_id || '',
        join_url: existing.join_url || '',
        status: existing.status || 'existing',
        raw_status: zoomRes.status,
      };
    }
  }

  throw new Error(`Zoom registrant error ${zoomRes.status}: ${JSON.stringify(zoomData)}`);
}

async function sendToGhl(cleanPayload) {
  const webhookUrl = requireEnv('GHL_WEBHOOK_WEBINAR_XEVI_URL');

  if (!webhookUrl) {
    console.warn('[webinar-xevi] GHL_WEBHOOK_WEBINAR_XEVI_URL no configurat');
    return { configured: false };
  }

  const ghlRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanPayload),
  });

  if (!ghlRes.ok) {
    throw new Error(`GHL webhook error ${ghlRes.status}`);
  }

  return { configured: true };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const payload = req.body || {};
  const sourceKey = normalizeSource(payload.source_key || payload.src || payload.utm_source);
  const sourceConfig = SOURCE_MAP[sourceKey];

  if (!payload.email || !payload.first_name) {
    return res.status(400).json({ success: false, error: 'Falten nom i email' });
  }

  const basePayload = {
    ...payload,
    event_name: payload.event_name || CAMPAIGN,
    event_type: 'webinar_registration',
    source_page: payload.source_page || 'webinar-xevi-salut-femenina',
    source_key: sourceKey,
    source_label: sourceConfig.label,
    utm_source: payload.utm_source || sourceConfig.utm_source,
    utm_medium: payload.utm_medium || sourceConfig.utm_medium,
    utm_campaign: payload.utm_campaign || CAMPAIGN,
    utm_content: payload.utm_content || sourceConfig.utm_content,
    registered_at: payload.registered_at || new Date().toISOString(),
    tags: buildTags(sourceKey, payload.tags),
  };

  const allowMissingGhl = process.env.ALLOW_WEBINAR_PREVIEW_WITHOUT_GHL === 'true';
  if (!requireEnv('GHL_WEBHOOK_WEBINAR_XEVI_URL') && !allowMissingGhl) {
    return res.status(503).json({
      success: false,
      error: 'GHL not configured',
      zoom_configured: 'not_checked',
      message: 'Falta configurar GHL. No es poden acceptar registres reals sense CRM, emails i tracking comercial.',
    });
  }

  let zoomResult;
  try {
    zoomResult = await registerZoomRegistrant(basePayload);
  } catch (error) {
    console.error('[webinar-xevi] zoom error:', error.message);
    return res.status(502).json({
      success: false,
      error: 'Zoom registration error',
      detail: error.message,
    });
  }

  const cleanPayload = {
    ...basePayload,
    zoom_configured: Boolean(zoomResult.configured),
    zoom_meeting_id: zoomResult.meeting_id || requireEnv('ZOOM_MEETING_ID') || '',
    zoom_registrant_id: zoomResult.registrant_id || '',
    zoom_join_url: zoomResult.join_url || '',
    zoom_registration_status: zoomResult.status || (zoomResult.configured ? 'created' : 'pending_configuration'),
    zoom_duplicate: Boolean(zoomResult.duplicate),
    zoom_missing_env: zoomResult.missing || [],
  };

  const allowIncompleteZoom = process.env.ALLOW_WEBINAR_PREVIEW_WITHOUT_ZOOM === 'true';
  if (!zoomResult.configured && !allowIncompleteZoom) {
    return res.status(503).json({
      success: false,
      error: 'Zoom not configured',
      zoom_configured: false,
      zoom_missing_env: zoomResult.missing || [],
      message: 'Falten credencials de Zoom. No es poden acceptar registres reals sense link individual.',
    });
  }

  let ghlResult;
  try {
    ghlResult = await sendToGhl(cleanPayload);
  } catch (error) {
    console.error('[webinar-xevi] GHL error:', error.message);
    return res.status(502).json({
      success: false,
      error: 'GHL webhook error',
      zoom: zoomResult,
    });
  }

  if (!ghlResult.configured && !allowMissingGhl) {
    return res.status(503).json({
      success: false,
      error: 'GHL not configured',
      zoom_configured: Boolean(zoomResult.configured),
      zoom_registration_status: cleanPayload.zoom_registration_status,
      message: 'Falta configurar GHL. No es poden acceptar registres reals sense CRM, emails i tracking comercial.',
    });
  }

  return res.status(200).json({
    success: true,
    ghl_configured: Boolean(ghlResult.configured),
    zoom_configured: Boolean(zoomResult.configured),
    zoom_missing_env: zoomResult.missing || [],
    zoom_join_url: zoomResult.join_url || '',
    zoom_registration_status: cleanPayload.zoom_registration_status,
    source_key: sourceKey,
    tags: cleanPayload.tags,
  });
};
