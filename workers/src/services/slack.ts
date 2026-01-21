/**
 * Slack Notification Service
 * Sends alert notifications to Slack via webhooks
 */

import { Env, Alert } from '../types';

const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/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';

/**
 * Build Slack message blocks for an alert
 */
function buildSlackMessage(alert: Omit<Alert, 'created_at'>) {
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

  return {
    attachments: [
      {
        color: color,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${emoji} ${alert.type.toUpperCase()} ALERT`,
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: alert.message
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Product:*\n\`${alert.product}\``
              },
              {
                type: 'mrkdwn',
                text: `*Alert ID:*\n\`${alert.id}\``
              }
            ]
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Cerebro Platform Alert • ${new Date().toISOString()}`
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Send an alert notification to Slack
 */
export async function sendSlackNotification(
  alert: Omit<Alert, 'created_at'>
): Promise<{ success: boolean; error?: string }> {
  try {
    const message = buildSlackMessage(alert);

    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Slack API error: ${response.status} - ${errorText}`);
    }

    console.log(`Slack notification sent successfully: ${alert.id}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending Slack notification'
    };
  }
}

/**
 * Check if Slack notifications are enabled
 */
export function isSlackEnabled(): boolean {
  return !!SLACK_WEBHOOK_URL;
}
