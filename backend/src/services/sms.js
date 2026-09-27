export async function sendSms(to, body) {
  if (!to) return { sent: false, reason: 'recipient_missing' };
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.warn(`[sms] Twilio not configured; dispatch retained without sending to ${to}.`);
    return { sent: false, reason: 'twilio_not_configured' };
  }

  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const bodyParams = new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams,
  });
  if (!response.ok) throw new Error(`Twilio responded ${response.status}`);
  const result = await response.json();
  return { sent: true, messageId: result.sid };
}