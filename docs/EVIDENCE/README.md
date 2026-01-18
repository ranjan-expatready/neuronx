# Integration Evidence Capture

**Purpose:** Store non-secret proof of successful integration verification for compliance and debugging.

## Folder Structure

```
docs/EVIDENCE/
├── README.md                          # This file
├── screenshots/                       # UI screenshots (no secrets)
├── logs/                             # Redacted log snippets
├── responses/                        # API response captures (no tokens)
├── configs/                          # Configuration examples (redacted)
└── verification/                     # Step-by-step verification evidence
```

## Naming Convention

Files are named with timestamps and descriptions:

```
YYYY-MM-DD_HH-MM_description.ext
```

Examples:

- `2024-01-03_14-30_tunnel_url_screenshot.png`
- `2024-01-03_14-35_oauth_success_response.json`
- `2024-01-03_14-40_ghl_app_settings.png`

## Evidence Types

### Screenshots (PNG/JPG)

**Location:** `docs/EVIDENCE/screenshots/`
**Purpose:** Capture UI states without exposing secrets
**Rules:**

- ✅ Show URLs, buttons, status messages
- ✅ Show configuration panels
- ❌ Never show passwords, API keys, tokens
- ❌ Never show full credit card numbers
- ❌ Never show personal identifiable information

**Examples:**

- GHL app settings page
- OAuth authorization screen (before entering credentials)
- Success/failure pages
- Tunnel URL display

### Redacted Logs

**Location:** `docs/EVIDENCE/logs/`
**Purpose:** Capture debugging information safely
**Rules:**

- ✅ Include correlation IDs, timestamps, operation names
- ✅ Include HTTP status codes, error messages
- ✅ Include performance metrics (latency, throughput)
- ❌ Never include raw tokens, passwords, API keys
- ❌ Never include full request/response bodies with secrets

**Examples:**

```
2024-01-03T14:30:15Z INFO GHL OAuth callback processed
  correlation_id: corr_oauth_123
  tenant_id: tenant_test
  tokens_stored: 2
  processing_time: 245ms

2024-01-03T14:31:20Z ERROR Webhook signature verification failed
  correlation_id: corr_webhook_456
  verification_error: signature_invalid
  signature_length: 71
  headers_present: ["x-webhook-signature"]
```

### API Responses

**Location:** `docs/EVIDENCE/responses/`
**Purpose:** Capture API behavior for verification
**Rules:**

- ✅ Include HTTP status codes, headers (safe ones)
- ✅ Include response structure and field names
- ✅ Include pagination info, rate limit headers
- ❌ Never include authentication tokens
- ❌ Never include sensitive business data

**Examples:**

```json
{
  "status": "processed",
  "eventId": "evt_123456",
  "processingTime": 45,
  "correlationId": "corr_webhook_789"
}
```

### Configuration Examples

**Location:** `docs/EVIDENCE/configs/`
**Purpose:** Show configuration state without secrets
**Rules:**

- ✅ Include environment variable names
- ✅ Include configuration structure
- ✅ Include feature flags and their values
- ❌ Never include actual secret values
- ❌ Never include database connection strings

**Examples:**

```bash
# .env configuration (redacted)
NEURONX_ENV=dev
BASE_URL=https://abc123.trycloudflare.com
GHL_CLIENT_ID=***configured***
GHL_CLIENT_SECRET=***configured***
DATABASE_URL=***configured***
```

## Verification Evidence

### Tunnel Setup

- Screenshot: `tunnel_url_display.png`
- Log: `tunnel_startup.log` (redacted)

### OAuth Flow

- Screenshot: `ghl_oauth_authorization.png`
- Screenshot: `neuronx_oauth_success.png`
- Response: `oauth_callback_response.json`
- Database: `token_credential_created.png` (Prisma Studio screenshot, redacted)

### Webhook Processing

- Screenshot: `ghl_webhook_settings.png`
- Log: `webhook_signature_verification.log` (redacted)
- Response: `webhook_processing_response.json`
- Log: `webhook_replay_detection.log` (redacted)

### Token Management

- Log: `token_refresh_success.log` (redacted)
- Log: `token_rotation_applied.log` (redacted)

## Compliance Notes

### FAANG Standards

- Evidence must support audit requirements
- Chain of custody for verification steps
- Timestamped and signed evidence where required
- Secure storage with access controls

### Security

- No sensitive data in evidence files
- Evidence stored in version control (safe data only)
- Access logs for evidence review
- Regular cleanup of outdated evidence

### Automation

- Scripts should output evidence to this directory
- Evidence collection integrated into CI/CD
- Automated validation of evidence completeness
- Alerts for missing evidence

## Usage

### During Verification

```bash
# Scripts automatically save evidence
./scripts/verify/tunnel_cloudflared.sh  # Saves to docs/EVIDENCE/screenshots/
./scripts/verify/verify_oauth_install_url.sh  # Saves to docs/EVIDENCE/responses/
```

### Manual Capture

```bash
# Save current evidence
cp /path/to/screenshot.png docs/EVIDENCE/screenshots/2024-01-03_14-30_tunnel_url.png

# Save redacted logs
grep "correlation_id" logs/app.log > docs/EVIDENCE/logs/2024-01-03_webhook_processing.log
```

### Review Process

```bash
# View all evidence for a verification run
find docs/EVIDENCE -name "2024-01-03*" -type f | sort

# Check evidence completeness
ls docs/EVIDENCE/screenshots/ | wc -l  # Should match expected count
```

## Cleanup

### Automatic Cleanup

- Old evidence (>90 days) moved to archive
- Failed verification evidence deleted
- Temporary files cleaned up

### Manual Cleanup

```bash
# Remove evidence for failed verification
rm -rf docs/EVIDENCE/verification/failed_run_2024-01-03/

# Archive completed verifications
mkdir -p docs/EVIDENCE/archive/2024-01/
mv docs/EVIDENCE/verification/completed_* docs/EVIDENCE/archive/2024-01/
```

This evidence structure ensures comprehensive, secure documentation of integration verification while maintaining compliance with security and privacy requirements.
