/**
 * Email Notification Service
 * Uses Cloudflare Email Routing to send alert notifications
 */

// EmailMessage is only available in Cloudflare Workers runtime, not locally
let EmailMessage: any;
try {
  // Dynamic import to prevent build errors in local dev
  EmailMessage = require('cloudflare:email').EmailMessage;
} catch {
  EmailMessage = null;
}

import { createMimeMessage } from 'mimetext';
import { Env, Alert } from '../types';

/**
 * Build email content for an alert using mimetext
 */
function buildAlertEmail(alert: Omit<Alert, 'created_at'>, fromAddress: string, toAddress: string) {
  const alertTypeEmoji = {
    critical: '🚨',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const alertTypeColor = {
    critical: '#dc2626',
    warning: '#d97706',
    info: '#2563eb'
  };

  const emoji = alertTypeEmoji[alert.type];
  const color = alertTypeColor[alert.type];
  const timestamp = new Date().toISOString();

  const msg = createMimeMessage();
  msg.setSender({ name: 'Cerebro Platform', addr: fromAddress });
  msg.setRecipient(toAddress);
  msg.setSubject(`${emoji} [${alert.type.toUpperCase()}] Cerebro Alert: ${alert.product}`);

  // Plain text version
  const textBody = `
${emoji} ${alert.type.toUpperCase()} ALERT

Message: ${alert.message}

Product: ${alert.product}
Alert ID: ${alert.id}
Related Feedback: ${alert.feedback_ids.length} item(s)

---
Cerebro Platform Alert | ${timestamp}
  `.trim();

  // HTML version
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: ${color}; color: white; padding: 20px; }
    .header h1 { margin: 0; font-size: 18px; }
    .content { padding: 24px; }
    .label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
    .value { font-size: 16px; color: #111827; margin-bottom: 16px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .product { background: #f3f4f6; color: #374151; }
    .footer { padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${emoji} ${alert.type.toUpperCase()} ALERT</h1>
    </div>
    <div class="content">
      <div class="label">Message</div>
      <div class="value">${alert.message}</div>
      
      <div class="label">Product</div>
      <div class="value">
        <span class="badge product">${alert.product}</span>
      </div>
      
      <div class="label">Alert ID</div>
      <div class="value" style="font-family: monospace; font-size: 14px;">${alert.id}</div>
      
      ${alert.feedback_ids.length > 0 ? `
      <div class="label">Related Feedback</div>
      <div class="value">${alert.feedback_ids.length} item(s) linked</div>
      ` : ''}
    </div>
    <div class="footer">
      Cerebro Platform Alert &bull; ${timestamp}
    </div>
  </div>
</body>
</html>
  `.trim();

  msg.addMessage({
    contentType: 'text/plain',
    data: textBody,
  });

  msg.addMessage({
    contentType: 'text/html',
    data: htmlBody,
  });

  return msg;
}

/**
 * Send an alert notification email via Cloudflare Email Routing
 */
export async function sendAlertEmail(
  env: Env,
  alert: Omit<Alert, 'created_at'>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if EmailMessage is available (only in Cloudflare runtime)
    if (!EmailMessage) {
      console.log('EmailMessage not available (local dev mode), skipping email');
      return {
        success: false,
        error: 'Email not available in local development. Deploy to Cloudflare to test email.'
      };
    }

    // Check if email binding is configured
    if (!env.ALERT_EMAIL) {
      console.log('Email binding not configured, skipping email notification');
      return { 
        success: false, 
        error: 'Email binding not configured. Enable Email Routing and update wrangler.toml with your domain email.' 
      };
    }

    // IMPORTANT: The sender must be from a domain with Email Routing enabled
    // Update this to your actual domain
    const fromAddress = 'jha70@purdue.edu';
    const toAddress = 'shubhjha.pm@gmail.com'; // This is overridden by the binding destination

    const msg = buildAlertEmail(alert, fromAddress, toAddress);
    
    const message = new EmailMessage(
      fromAddress,
      toAddress,
      msg.asRaw()
    );

    await env.ALERT_EMAIL.send(message);

    console.log(`Alert email sent successfully: ${alert.id}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send alert email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error sending email' 
    };
  }
}

/**
 * Check if email notifications are enabled
 */
export function isEmailEnabled(env: Env): boolean {
  return !!env.ALERT_EMAIL;
}
