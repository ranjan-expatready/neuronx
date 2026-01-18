# Capturing Real Webhook Headers for Signature Verification

**Purpose:** Safely capture webhook request details to verify signature algorithm without exposing secrets.

## When to Use

Use this when you need to verify the GHL webhook signature algorithm against official documentation. This happens after:

1. ✅ Tunnel is running with public URL
2. ✅ GHL webhook URL is configured
3. ✅ Real webhook is triggered in GHL
4. ❌ Webhook signature verification fails

## Safety First

⚠️ **NEVER paste or share:**

- Raw signature values
- Authentication tokens
- API keys or secrets
- Full request bodies with sensitive data

✅ **SAFE to share:**

- Header names present
- Signature length/format
- Request IDs and timestamps
- HTTP status codes

## Step 1: Trigger Real Webhook

1. **Configure webhook URL in GHL:**
   - Go to GHL app settings
   - Set webhook URL to your tunnel URL: `https://xxxxx.trycloudflare.com/integrations/ghl/webhooks`

2. **Trigger webhook event:**
   - Create a new contact in GHL
   - Or update an existing contact
   - This should trigger the webhook

3. **Verify webhook was received:**
   ```bash
   # Check NeuronX logs for webhook processing
   # Look for lines like:
   # "GHL webhook received - webhook_id=wh_123, event=contact.created"
   ```

## Step 2: Capture Headers from Logs

### Option A: Grep NeuronX Logs

```bash
# Search for webhook signature validation failures
grep -A 10 -B 5 "signature_invalid" logs/neuronx.log

# Or search for webhook processing
grep -A 20 "GHL webhook received" logs/neuronx.log
```

### Option B: Check Real-time Logs

```bash
# Tail logs while triggering webhook
tail -f logs/neuronx.log | grep -E "(webhook|signature)"
```

### Option C: Check Application Logs

If using structured logging, look for log entries with:

- `correlationId` containing webhook request ID
- `operation: "ghl.webhook.process"`
- `verification` object with error details

## Step 3: Extract Safe Information

From the logs, extract ONLY these safe details:

### Headers Present

```
✅ x-webhook-signature: present (length: 71)
❌ x-webhook-signature: sha256=ABC123... (NEVER share)
```

### Signature Format

```
✅ Signature format: starts with "sha256="
✅ Signature length: 71 characters
✅ Algorithm prefix: sha256
```

### Request Context

```
✅ Request ID: req_webhook_1643723400_123
✅ Timestamp: 2024-01-03T12:00:00Z
✅ Correlation ID: corr_webhook_abc123
✅ HTTP method: POST
✅ Content-Type: application/json
```

### Verification Failure Details

```
✅ Verification result: signature_invalid
✅ Expected algorithm: sha256
✅ Headers checked: x-webhook-signature, x-signature
✅ Payload size: 1234 bytes
✅ Hash input description: "Raw JSON payload, UTF-8 encoded"
```

## Step 4: Analyze Captured Data

### Compare with Documentation

1. **Check algorithm:** Is it really HMAC-SHA256?
2. **Check payload:** Raw JSON or canonical form?
3. **Check encoding:** UTF-8 or different?
4. **Check secret:** Shared secret or different mechanism?

### Common Issues

- **Wrong algorithm:** MD5 instead of SHA256
- **Wrong payload:** URL-encoded or form data instead of raw JSON
- **Wrong encoding:** Base64 vs hex digest
- **Wrong secret:** Per-webhook secret instead of shared secret

## Step 5: Update Implementation

Based on analysis, update the signature verification:

```typescript
// Current implementation
const expected = createHmac('sha256', secret)
  .update(payload, 'utf8')
  .digest('base64');

// If analysis shows different algorithm
const expected = createHmac('md5', secret)
  .update(payload, 'utf8')
  .digest('hex');
```

## Step 6: Test Updated Implementation

1. **Update code** with verified algorithm
2. **Restart NeuronX** with changes
3. **Trigger webhook again** to test
4. **Verify logs** show successful verification

## Step 7: Document Findings

Update `docs/ghl_capability_map/14_VERIFICATION_CHECKLIST.md`:

```
## 2. Webhook Signature Algorithm Verification
**Status:** VERIFIED ✅
**Confirmed Algorithm:** HMAC-SHA256
**Confirmed Payload:** Raw JSON, UTF-8
**Confirmed Format:** sha256=<base64_digest>
**Evidence:** Webhook logs from 2024-01-03, correlation_id=corr_webhook_abc123
```

## Emergency Debugging

If webhooks aren't reaching NeuronX at all:

1. **Check tunnel:** Is cloudflared still running?
2. **Test public URL:** `curl https://your-tunnel-url.trycloudflare.com/health`
3. **Check GHL settings:** Is webhook URL correct and saved?
4. **Check GHL logs:** Does GHL show webhook delivery attempts?

## Security Notes

- Never commit webhook payloads with real data
- Never log or share signature values
- Use correlation IDs to trace requests safely
- Implement proper audit logging for compliance

## Related Files

- `packages/adapters/webhooks/src/verify.ts` - Signature verification logic
- `test/fixtures/ghl/signature_example.txt` - Expected format documentation
- `docs/ghl_capability_map/14_VERIFICATION_CHECKLIST.md` - Verification checklist
