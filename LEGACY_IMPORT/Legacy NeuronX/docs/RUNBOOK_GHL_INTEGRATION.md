# GHL Integration Runbook

**Last verified:** 2026-01-03
**Audience:** Developers setting up GHL integration for NeuronX

## Overview

This runbook provides step-by-step instructions for setting up GoHighLevel (GHL) integration across development, staging, and production environments. The integration includes OAuth authentication, webhook processing, and API synchronization.

## Prerequisites

- [ ] NeuronX codebase cloned and dependencies installed
- [ ] PostgreSQL database running (for production token storage)
- [ ] GoHighLevel account with admin access
- [ ] Publicly accessible URL for webhooks/callbacks (ngrok for local dev)

## Step 1: Environment Setup

### 1.1 Copy Environment Template

```bash
cp .env.example .env
```

### 1.2 Configure Application Environment

Edit `.env` with your environment:

```bash
# For development
NEURONX_ENV=dev
BASE_URL=http://localhost:3000

# For staging/production
NEURONX_ENV=stage  # or prod
BASE_URL=https://your-staging-domain.com
```

### 1.3 Database Configuration

Ensure PostgreSQL is running and configure connection:

```bash
DATABASE_URL="postgresql://username:password@localhost:5432/neuronx?schema=public"
```

For production, use a managed PostgreSQL service (AWS RDS, Google Cloud SQL, etc.).

### 1.4 Generate Security Keys

#### Token Vault Master Key

```bash
# Generate 32-byte base64 key
openssl rand -base64 32
# Example output: AbCdEfGhIjKlMnOpQrStUvWxYz...
```

Add to `.env`:

```bash
TOKEN_VAULT_MASTER_KEY=your_generated_key_here
TOKEN_VAULT_KEY_ID=v1
```

#### Webhook Secret (Optional)

```bash
# Generate webhook signing secret
openssl rand -base64 32
```

Add to `.env`:

```bash
GHL_WEBHOOK_SECRET=your_webhook_secret_here
```

## Step 2: GoHighLevel App Configuration

### 2.1 Create GHL OAuth App

1. Log into GoHighLevel: https://app.gohighlevel.com
2. Navigate to Settings → OAuth
3. Click "Create OAuth App"
4. Fill in app details:
   - **Name:** NeuronX Integration
   - **Description:** Sales orchestration and AI platform
   - **Redirect URI:** `https://your-domain.com/integrations/ghl/auth/callback`
   - **Scopes:** Select required scopes (see scope matrix below)

### 2.2 Required Scopes by Environment

#### Development (Minimal)

```
contacts.readonly
contacts.write
opportunities.readonly
opportunities.write
locations.readonly
```

#### Production (Full)

```
contacts.readonly
contacts.write
opportunities.readonly
opportunities.write
campaigns.readonly
campaigns.write
workflows.readonly
workflows.write
conversations.readonly
conversations.write
conversations.message.send
locations.readonly
users.readonly
calendars.readonly
calendars.write
```

### 2.3 Get OAuth Credentials

After creating the app, copy:

- **Client ID:** Add to `GHL_CLIENT_ID` in `.env`
- **Client Secret:** Add to `GHL_CLIENT_SECRET` in `.env`

### 2.4 Configure Webhooks (Optional)

If using webhooks, configure the webhook URL in GHL:

- **URL:** `https://your-domain.com/integrations/ghl/webhooks`
- **Events:** Select events to monitor (contacts, opportunities, etc.)

## Step 3: Environment-Specific Setup

### Development Environment

#### 3.1.1 Local Development

```bash
# Start NeuronX core API
cd apps/core-api
npm run start:dev

# Expose local server (if needed for webhooks)
npx ngrok http 3000
# Copy ngrok URL to BASE_URL in .env
```

#### 3.1.2 GHL Agency Setup

- Create a separate GHL agency for development
- Naming convention: `neuronx-dev-{developer-name}`
- Set pricing to Starter ($97/month) for cost efficiency
- Create 1-3 sub-accounts for testing

### Staging Environment

#### 3.2.1 Infrastructure Setup

```bash
# Deploy to staging environment
# Ensure BASE_URL points to staging domain
# Configure production-grade PostgreSQL
```

#### 3.2.2 GHL Agency Setup

- Agency name: `neuronx-stage`
- Pricing: Unlimited ($297/month)
- Create sub-accounts mirroring production structure
- Use sanitized test data

### Production Environment

#### 3.3.1 Infrastructure Setup

```bash
# Deploy to production
# Configure production PostgreSQL
# Set up monitoring and alerting
# Configure backup strategies
```

#### 3.3.2 GHL Agency Setup

- Agency name: `neuronx-prod`
- Pricing: Unlimited ($297/month) minimum
- Create sub-accounts based on customer segmentation
- Enable all required scopes
- Set up billing alerts

## Step 4: Integration Testing

### 4.1 OAuth Flow Testing

#### Install URL Generation

Visit the install URL (NeuronX will generate this):

```
https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https://your-domain.com/integrations/ghl/auth/callback&scope=contacts.readonly%20contacts.write
```

#### Complete OAuth

1. Select your GHL agency/location
2. Click "Authorize" to grant permissions
3. Verify redirect to NeuronX callback
4. Check logs for successful token exchange

### 4.2 Webhook Testing

#### Test Webhook Delivery

```bash
# Create a test contact in GHL
# Verify webhook received in NeuronX logs
# Check event processing and data transformation
```

#### Signature Verification

```bash
# If webhook signatures enabled, verify proper validation
# Check logs for signature verification status
```

### 4.3 API Integration Testing

#### Token Retrieval

```bash
# Verify tokens stored securely
# Test token refresh functionality
# Check token scope validation
```

#### Data Synchronization

```bash
# Create test data in GHL
# Verify sync to NeuronX
# Test bidirectional updates
```

## Step 5: Monitoring and Troubleshooting

### Health Checks

#### Application Health

```bash
curl https://your-domain.com/health
# Expected: {"status": "healthy", "integrations": {"ghl": "connected"}}
```

#### GHL API Health

```bash
curl https://your-domain.com/integrations/ghl/health
# Expected: Token status, rate limit info, last successful call
```

### Common Issues

#### OAuth Issues

- **"Invalid redirect URI"**: Ensure URI matches GHL app configuration exactly
- **"Invalid client"**: Verify Client ID and Secret
- **"Access denied"**: Check user permissions in GHL

#### Webhook Issues

- **"Signature verification failed"**: Check webhook secret configuration
- **"Webhook not received"**: Verify public URL accessibility
- **"Event processing failed"**: Check NeuronX logs for processing errors

#### Token Issues

- **"Token expired"**: Automatic refresh should handle this
- **"Insufficient scope"**: Request additional scopes in GHL app
- **"Invalid token"**: May require re-authorization

### Log Analysis

#### Key Log Patterns

```
# OAuth Success
[INFO] GHL OAuth callback processed - tenant_id: xxx, location_count: 2

# Webhook Processing
[INFO] GHL webhook verified and processed - event: contact.created, correlation_id: xxx

# Token Refresh
[INFO] GHL token refreshed successfully - tenant_id: xxx, expires_in: 3600

# API Errors
[WARN] GHL API rate limited - retrying in 60s - correlation_id: xxx
[ERROR] GHL API authentication failed - tenant_id: xxx - requires re-auth
```

## Step 6: Security Validation

### 6.1 Token Security

- [ ] Verify tokens encrypted at rest
- [ ] Confirm token refresh working
- [ ] Validate scope restrictions

### 6.2 Webhook Security

- [ ] Confirm signature verification active
- [ ] Test replay attack prevention
- [ ] Verify HTTPS enforcement

### 6.3 Access Control

- [ ] Test tenant isolation
- [ ] Verify location-specific access
- [ ] Confirm audit logging

## Step 7: Go-Live Checklist

### Pre-Launch

- [ ] All environment variables configured
- [ ] GHL app created with correct scopes
- [ ] OAuth flow tested end-to-end
- [ ] Webhook endpoints verified
- [ ] Token vault operational
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery tested

### Launch Day

- [ ] Deploy to production environment
- [ ] Enable production GHL agency
- [ ] Monitor initial synchronization
- [ ] Validate customer data flow
- [ ] Confirm all integrations working

### Post-Launch

- [ ] Monitor error rates and performance
- [ ] Set up regular health checks
- [ ] Establish incident response procedures
- [ ] Plan for scaling and scope expansion

## Emergency Procedures

### OAuth Re-authorization

If tokens become invalid:

1. Guide customer to re-authorize via install URL
2. Monitor token refresh logs
3. Implement fallback for degraded operation

### Webhook Failures

If webhooks stop working:

1. Check GHL webhook configuration
2. Verify endpoint accessibility
3. Review signature verification logs
4. Implement manual sync as temporary workaround

### API Outages

During GHL API issues:

1. Implement exponential backoff
2. Switch to read-only mode if possible
3. Notify customers of temporary issues
4. Monitor for service restoration

## Cost Optimization

### Pricing Strategy

- **Development:** Starter plan ($97/month)
- **Staging:** Unlimited plan ($297/month)
- **Production:** Unlimited plan ($297/month) minimum

### Usage Monitoring

- Track API call volumes
- Monitor rate limit usage
- Set up cost alerts
- Optimize synchronization frequency

## Support and Escalation

### Internal Support

- **Logs:** Check application logs with correlation IDs
- **Metrics:** Monitor integration health dashboards
- **Runbooks:** Refer to this document for procedures

### External Support

- **GHL Support:** Contact for API issues or account problems
- **Documentation:** Refer to official GHL developer docs
- **Community:** Check GHL developer forums for known issues

This runbook ensures consistent, secure setup of GHL integration across all NeuronX environments.
