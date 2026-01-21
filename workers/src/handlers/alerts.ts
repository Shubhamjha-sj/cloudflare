/**
 * Alerts API Handler
 * Manages alert operations for the Cerebro Platform
 */

import { Hono } from 'hono';
import { Env, Alert } from '../types';
import { listAlerts, acknowledgeAlert, createAlert } from '../services/database';
import { sendAlertEmail, isEmailEnabled } from '../services/email';
import { sendSlackNotification, isSlackEnabled } from '../services/slack';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/alerts
 * List all alerts with optional filtering
 */
app.get('/', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10');
    const includeAcknowledged = c.req.query('include_acknowledged') === 'true';
    
    const alerts = await listAlerts(c.env, limit, includeAcknowledged);
    
    return c.json({
      success: true,
      data: alerts,
      meta: {
        count: alerts.length,
        limit,
      }
    });
  } catch (error) {
    console.error('Error listing alerts:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list alerts'
    }, 500);
  }
});

/**
 * POST /api/alerts
 * Create a new alert with optional email notification
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json<{
      type: 'critical' | 'warning' | 'info';
      message: string;
      product: string;
      feedback_ids?: string[];
      send_email?: boolean;
    }>();

    const alert: Omit<Alert, 'created_at'> = {
      id: `alert_${Date.now()}`,
      type: body.type,
      message: body.message,
      product: body.product,
      acknowledged: false,
      feedback_ids: body.feedback_ids || [],
    };

    await createAlert(c.env, alert);

    // Send Slack notification for all alerts
    const slackResult = await sendSlackNotification(alert);

    // Send email notification for critical alerts (or if explicitly requested)
    let emailResult = null;
    if (body.send_email || body.type === 'critical') {
      emailResult = await sendAlertEmail(c.env, alert);
    }

    return c.json({
      success: true,
      data: alert,
      slack: slackResult,
      email: emailResult,
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create alert'
    }, 500);
  }
});

/**
 * POST /api/alerts/test-slack
 * Test Slack notification (does not create alert)
 */
app.post('/test-slack', async (c) => {
  try {
    const testAlert: Omit<Alert, 'created_at'> = {
      id: `test_${Date.now()}`,
      type: 'info',
      message: '👋 This is a test notification from Cerebro Platform. If you see this, Slack notifications are working!',
      product: 'cerebro-platform',
      acknowledged: false,
      feedback_ids: [],
    };

    const result = await sendSlackNotification(testAlert);

    return c.json({
      success: result.success,
      message: result.success 
        ? 'Test Slack notification sent successfully!' 
        : 'Failed to send Slack notification',
      error: result.error,
      slackEnabled: isSlackEnabled(),
    });
  } catch (error) {
    console.error('Error testing Slack:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test Slack'
    }, 500);
  }
});

/**
 * POST /api/alerts/test-email
 * Test email notification (does not create alert)
 */
app.post('/test-email', async (c) => {
  try {
    const testAlert: Omit<Alert, 'created_at'> = {
      id: `test_${Date.now()}`,
      type: 'info',
      message: 'This is a test email from Cerebro Platform. If you received this, email notifications are working!',
      product: 'cerebro-platform',
      acknowledged: false,
      feedback_ids: [],
    };

    const result = await sendAlertEmail(c.env, testAlert);

    return c.json({
      success: result.success,
      message: result.success 
        ? 'Test email sent successfully' 
        : 'Failed to send test email',
      error: result.error,
      emailEnabled: isEmailEnabled(c.env),
    });
  } catch (error) {
    console.error('Error testing email:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test email'
    }, 500);
  }
});

/**
 * POST /api/alerts/:id/acknowledge
 * Acknowledge an alert
 */
app.post('/:id/acknowledge', async (c) => {
  try {
    const id = c.req.param('id');
    
    await acknowledgeAlert(c.env, id);
    
    return c.json({
      success: true,
      message: 'Alert acknowledged'
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to acknowledge alert'
    }, 500);
  }
});

/**
 * POST /api/alerts/seed
 * Seed sample alerts for testing
 */
app.post('/seed', async (c) => {
  try {
    const now = new Date();
    
    const sampleAlerts: Omit<Alert, 'created_at'>[] = [
      {
        id: `alert_${Date.now()}_1`,
        type: 'critical',
        message: 'High-value customer TechCorp Inc ($250k ARR) reported critical deployment failures on Workers',
        product: 'workers',
        acknowledged: false,
        feedback_ids: ['fb_sample_1'],
      },
      {
        id: `alert_${Date.now()}_2`,
        type: 'critical',
        message: 'Enterprise customer CloudFirst ($320k ARR) experiencing data loss issues with R2',
        product: 'r2',
        acknowledged: false,
        feedback_ids: ['fb_sample_2'],
      },
      {
        id: `alert_${Date.now()}_3`,
        type: 'warning',
        message: 'Multiple customers reporting slow build times on Pages in the last hour',
        product: 'pages',
        acknowledged: false,
        feedback_ids: ['fb_sample_3', 'fb_sample_4'],
      },
      {
        id: `alert_${Date.now()}_4`,
        type: 'warning',
        message: 'Spike in negative sentiment detected for Workers KV (-0.7 avg sentiment)',
        product: 'kv',
        acknowledged: false,
        feedback_ids: ['fb_sample_5', 'fb_sample_6', 'fb_sample_7'],
      },
      {
        id: `alert_${Date.now()}_5`,
        type: 'info',
        message: 'New feature request trending: "Add support for streaming responses in Workers AI"',
        product: 'workers',
        acknowledged: false,
        feedback_ids: ['fb_sample_8'],
      },
      {
        id: `alert_${Date.now()}_6`,
        type: 'critical',
        message: 'GlobalMedia Ltd ($180k ARR) reports authentication failures with Access integration',
        product: 'workers',
        acknowledged: true,
        feedback_ids: ['fb_sample_9'],
      },
      {
        id: `alert_${Date.now()}_7`,
        type: 'warning',
        message: '15% increase in error rate for D1 queries in the past 24 hours',
        product: 'd1',
        acknowledged: false,
        feedback_ids: ['fb_sample_10', 'fb_sample_11'],
      },
      {
        id: `alert_${Date.now()}_8`,
        type: 'info',
        message: 'Positive feedback spike: Customers praising new Vectorize performance improvements',
        product: 'workers',
        acknowledged: true,
        feedback_ids: ['fb_sample_12', 'fb_sample_13'],
      },
    ];

    // Clear existing alerts and insert new ones
    await c.env.DB.prepare('DELETE FROM alerts').run();
    
    for (const alert of sampleAlerts) {
      await createAlert(c.env, alert);
    }

    return c.json({
      success: true,
      message: `Seeded ${sampleAlerts.length} sample alerts`,
      data: {
        critical: sampleAlerts.filter(a => a.type === 'critical').length,
        warning: sampleAlerts.filter(a => a.type === 'warning').length,
        info: sampleAlerts.filter(a => a.type === 'info').length,
      }
    });
  } catch (error) {
    console.error('Error seeding alerts:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to seed alerts'
    }, 500);
  }
});

export default app;
