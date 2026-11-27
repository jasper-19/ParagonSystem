'use strict';

// Keep in sync with frontend/ParagonWebApp/server/email/transactional.cjs.
// Render and Vercel package their application directories independently.

const navy = '#000035';
const honey = '#F4B400';
const sans = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const serif = "Georgia, 'Times New Roman', serif";
const institution = 'The Official Student Publication of Cagayan State University - Gonzaga Campus';
const defaultOrigin = 'https://paragon-system-gvlg.vercel.app';

function siteOrigin(value) {
  try {
    const url = new URL(value || defaultOrigin);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.origin;
  } catch {
    // Use the canonical site when optional configuration is malformed.
  }
  return defaultOrigin;
}

function brandedEmail({ subject, preheader, origin, content }) {
  const site = origin.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${subject}</title>
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .email-background { background-color: #101020 !important; }
    .email-content { background-color: #202038 !important; color: #ffffff !important; }
    .otp-digit { background-color: #30304b !important; color: #ffffff !important; border-color: ${honey} !important; }
  }
</style>
</head>
<body class="email-background" style="margin:0;padding:0;background-color:#efeff4;font-family:${sans};">
<div class="preheader" style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;" aria-hidden="true">${preheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-background" bgcolor="#efeff4" style="background-color:#efeff4;">
<tr><td align="center" style="padding:16px 8px;">
<!--[if mso]><table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
<tr><td bgcolor="#ffffff" style="padding:24px;background-color:#ffffff;color:${navy};border-bottom:4px solid ${honey};">
<table role="presentation" cellspacing="0" cellpadding="0" border="0">
<tr><td valign="middle" style="padding-right:12px;"><img src="${site}/apple-touch-icon.png" alt="" width="48" height="48" style="display:block;width:48px;height:48px;border:0;"></td>
<td valign="middle" style="font-family:${sans};font-size:13px;line-height:19px;color:${navy};">
<strong style="font-family:${serif};font-size:23px;line-height:29px;">PARAGON</strong><br>${institution}
</td></tr>
</table>
</td></tr>
<tr><td class="email-content" bgcolor="#ffffff" style="padding:24px;background-color:#ffffff;color:${navy};font-family:${sans};font-size:16px;line-height:25px;">
${content}
</td></tr>
<tr><td bgcolor="${navy}" style="padding:20px 24px;background-color:${navy};color:#ffffff;font-family:${sans};font-size:14px;line-height:22px;">
Cagayan State University - Gonzaga Campus<br>
<a href="${site}/" style="color:${honey};text-decoration:underline;">PARAGON website</a>&nbsp;&nbsp;|&nbsp;&nbsp;<a href="${site}/privacy-policy" style="color:${honey};text-decoration:underline;">Privacy policy</a>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

function renderSignInEmail({ code, expiresAt, appUrl }) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new Error('Invalid sign-in email code format');
  const origin = siteOrigin(appUrl);
  const subject = 'Your PARAGON sign-in code';
  const preheader = 'Use this one-time code to finish signing in to PARAGON.';
  const expiration = expiresAt === undefined ? 'This code expires in 5 minutes.' :
    `This code expires on ${new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'medium',
    }).format(expiresAt)} Philippine time.`;
  const reminder = 'If you did not try to sign in, you can ignore this email. Never share this code.';
  // Adjacent spans preserve a single text run in the DOM and avoid table-cell separators when copying.
  const digits = [...code].map(digit => `<span class="otp-digit" style="display:inline-block;width:30px;line-height:42px;text-align:center;margin:0 2px;border:1px solid #d9d9e5;border-bottom:2px solid ${honey};border-radius:4px;background-color:#f4f4fa;color:${navy};">${digit}</span>`).join('');

  const content = `<h1 style="margin:0 0 12px;font-family:${serif};font-size:32px;line-height:38px;font-weight:normal;">Verify your sign-in.</h1>
<p style="margin:0 0 16px;">Enter this one-time code to finish signing in to PARAGON.</p>
<!--[if mso]><p align="center" style="margin:0 0 16px;text-align:center;font-family:Consolas,'Courier New',monospace;font-size:28px;line-height:48px;font-weight:bold;color:${navy};" dir="ltr">${code}</p><![endif]-->
<!--[if !mso]><!--><p align="center" style="margin:0 0 16px;text-align:center;white-space:nowrap;font-family:Consolas,'Courier New',monospace;font-size:24px;line-height:48px;font-weight:bold;" dir="ltr">${digits}</p><!--<![endif]-->
<p style="margin:0 0 12px;">${expiration}</p>
<p style="margin:0;">${reminder}</p>`;

  return {
    subject,
    text: `Verify your sign-in.\n\nYour PARAGON verification code is ${code}.\n\n${expiration}\n\n${reminder}\n\nPARAGON website: ${origin}/\nPrivacy policy: ${origin}/privacy-policy`,
    html: brandedEmail({ subject, preheader, origin, content }),
  };
}

module.exports = { renderSignInEmail };
