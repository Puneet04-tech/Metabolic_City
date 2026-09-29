/**
 * Normalizes phone numbers to standard E.164 format.
 * Defaults to India (+91) if 10 digits provided without country code.
 */
function normalizePhoneNumber(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
  return cleaned;
}

export async function sendSms(to, body) {
  const normalizedPhone = normalizePhoneNumber(to);
  if (!normalizedPhone) {
    return { sent: false, reason: 'recipient_missing_or_invalid' };
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[sms-mock] To: ${normalizedPhone} | Message: "${body}"`);
      return { sent: true, mocked: true, messageId: `mock_${Date.now()}` };
    }
    console.warn(`[sms] Twilio credentials not configured; SMS notification bypassed for ${normalizedPhone}.`);
    return { sent: false, reason: 'twilio_not_configured' };
  }

  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const bodyParams = new URLSearchParams({
    To: normalizedPhone,
    From: TWILIO_FROM_NUMBER,
    Body: body,
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Twilio HTTP ${response.status}: ${errBody}`);
    }

    const result = await response.json();
    return { sent: true, messageId: result.sid };
  } catch (error) {
    console.error(`[sms] Failed to send SMS to ${normalizedPhone}:`, error.message);
    return { sent: false, error: error.message };
  }
}
