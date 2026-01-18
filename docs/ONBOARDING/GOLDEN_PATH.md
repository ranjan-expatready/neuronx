# NeuronX Enterprise Onboarding Golden Path

**Version:** 1.0.0
**Last Updated:** 2026-01-05
**Target Time:** <60 minutes
**Audience:** Solutions Engineers, Customer Success, Sales Engineering

## Overview

This document provides the definitive, step-by-step process for onboarding a new enterprise customer to NeuronX. The process is designed to be:

- **Repeatable**: Same steps for every customer
- **Safe**: No data loss, no security breaches, no customer impact
- **Auditable**: Every action logged and attributable
- **Reversible**: Clear rollback steps for any issues
- **Non-Engineering**: No code changes or database manipulation required

## Prerequisites Checklist

### Customer Requirements

- [ ] **GHL Account**: Active GoHighLevel account with admin access
- [ ] **GHL Locations**: At least one location configured in GHL
- [ ] **API Access**: GHL API keys with full permissions
- [ ] **Test Data**: At least 3 test opportunities/contacts ready
- [ ] **Org Structure**: Defined team/agency hierarchy (see Appendix A)

### NeuronX Platform Requirements

- [ ] **Tenant Provisioned**: Customer tenant exists in NeuronX platform
- [ ] **Admin Access**: Bootstrap credentials provided (API key or admin token)
- [ ] **Platform Ready**: NeuronX core systems operational
- [ ] **No Active Workflows**: No existing GHL workflows that conflict with NeuronX

## Step-by-Step Onboarding Process

### Step 1: Environment Validation (5 minutes)

**Goal:** Confirm the tenant environment is ready for onboarding.

**Actions:**

1. Run readiness check:

   ```bash
   cd neuronx-platform
   npm run check-readiness -- --tenant-id YOUR_TENANT_ID
   ```

2. Expected output:

   ```
   ✅ Onboarding Readiness Check
   Tenant: YOUR_TENANT_ID
   Status: BLOCKED

   Issues Found:
   - No org hierarchy configured
   - No GHL integration mappings
   - No active playbooks

   Resolution Required:
   Run: npm run bootstrap-tenant -- --tenant-id YOUR_TENANT_ID
   ```

3. If status shows `BLOCKED`, proceed to Step 2.
4. If status shows `READY`, skip to Step 3.

**Validation:**

- Readiness check completes without errors
- Output clearly shows current status and next steps

**Rollback:** None required (read-only operation)

---

### Step 2: Tenant Bootstrap (15 minutes)

**Goal:** Establish the complete org structure, roles, and basic configuration.

**Actions:**

1. Run the bootstrap script in dry-run mode first:

   ```bash
   npm run bootstrap-tenant -- \
     --tenant-id YOUR_TENANT_ID \
     --org-name "Customer Company Name" \
     --admin-email "admin@customer.com" \
     --dry-run
   ```

2. Review the output carefully:

   ```
   🔍 DRY RUN MODE - No changes made

   Planned Actions:
   ✅ Create Enterprise: Customer Company Name
   ✅ Create Agency: Sales Agency
   ✅ Create Teams: Inbound Sales, Outbound Sales, Enterprise Sales
   ✅ Assign Roles: admin@customer.com as ENTERPRISE_ADMIN
   ✅ Create Default Playbook Bindings

   ⚠️ Prerequisites Check:
   - Ensure GHL API credentials are configured
   - Verify tenant has execution permissions

   Run without --dry-run to execute.
   ```

3. If dry-run output looks correct, execute the bootstrap:

   ```bash
   npm run bootstrap-tenant -- \
     --tenant-id YOUR_TENANT_ID \
     --org-name "Customer Company Name" \
     --admin-email "admin@customer.com"
   ```

4. Expected success output:

   ```
   ✅ Tenant Bootstrap Complete

   Created:
   - Enterprise: ent_abc123 (Customer Company Name)
   - Agency: agency_xyz789 (Sales Agency)
   - Teams: team_001 (Inbound), team_002 (Outbound), team_003 (Enterprise)
   - Member: member_def456 (admin@customer.com) as ENTERPRISE_ADMIN

   Next Steps:
   1. Configure GHL integration mappings
   2. Import existing opportunities
   3. Set up team-specific playbooks
   ```

**Validation:**

- Bootstrap completes with SUCCESS status
- All expected org entities created
- Admin user has ENTERPRISE_ADMIN role
- No errors in the output

**Rollback:**

```bash
# The bootstrap script is idempotent - re-run with different parameters
# Or manually delete created entities via API (see Appendix B)
```

---

### Step 3: GHL Integration Setup (10 minutes)

**Goal:** Connect GHL and map locations to teams.

**Actions:**

1. Configure GHL OAuth connection (if not already done):

   ```bash
   # This is typically done during initial tenant setup
   # Verify it's working by checking GHL health endpoint
   curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
        -H "x-tenant-id: YOUR_TENANT_ID" \
        http://localhost:3001/api/integrations/ghl/health
   ```

2. Create location-to-team mappings:

   ```bash
   # For each GHL location, map to appropriate team
   curl -X POST http://localhost:3001/api/org/integrations/ghl/location-mappings \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "x-tenant-id: YOUR_TENANT_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "locationId": "ghl_location_id_123",
       "teamId": "team_001",
       "description": "Main Office - Inbound Sales"
     }'
   ```

3. Verify mappings are created:
   ```bash
   curl http://localhost:3001/api/org/integrations/ghl/location-mappings \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "x-tenant-id: YOUR_TENANT_ID"
   ```

**Validation:**

- GHL health check returns success
- At least one location mapping exists per team
- API calls complete without errors

**Rollback:**

```bash
# Delete mappings
curl -X DELETE http://localhost:3001/api/org/integrations/location-mappings/MAPPING_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "x-tenant-id: YOUR_TENANT_ID"
```

---

### Step 4: Data Migration (10 minutes)

**Goal:** Import existing opportunities and assign teams.

**Actions:**

1. Check current opportunity statistics:

   ```bash
   curl http://localhost:3001/api/sales/opportunities/backfill-stats \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "x-tenant-id: YOUR_TENANT_ID"
   ```

2. Run backfill in dry-run mode:

   ```bash
   curl -X POST http://localhost:3001/api/sales/opportunities/backfill-teams \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "x-tenant-id: YOUR_TENANT_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "dryRun": true,
       "batchSize": 50,
       "maxRows": 100
     }'
   ```

3. Execute actual backfill:
   ```bash
   curl -X POST http://localhost:3001/api/sales/opportunities/backfill-teams \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "x-tenant-id: YOUR_TENANT_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "dryRun": false,
       "batchSize": 50,
       "maxRows": 1000
     }'
   ```

**Validation:**

- Backfill completes successfully
- Statistics show reduced unassigned opportunities
- Audit logs show backfill events

**Rollback:**

```bash
# Backfill is idempotent - can be re-run
# To undo: manually reassign opportunities via API (see Appendix B)
```

---

### Step 5: Go-Live Readiness Check (5 minutes)

**Goal:** Final validation before enabling live operations.

**Actions:**

1. Run final readiness check:

   ```bash
   cd neuronx-platform
   npm run check-readiness -- --tenant-id YOUR_TENANT_ID
   ```

2. Expected READY output:

   ```
   ✅ Onboarding Readiness Check
   Tenant: YOUR_TENANT_ID
   Status: READY

   Configuration Verified:
   ✅ Org hierarchy valid (3 teams, 1 agency, 1 enterprise)
   ✅ GHL integration connected
   ✅ Location mappings configured (3 mappings)
   ✅ Active playbooks available
   ✅ Decision Engine: monitor_only mode
   ✅ Execution tokens enabled
   ✅ Voice adapter configured

   🚀 Ready for production go-live
   ```

3. If BLOCKED, address issues and re-run check.

**Validation:**

- Status shows `READY`
- All configuration items checked
- No blocking issues

**Rollback:** None required (read-only operation)

---

### Step 6: First Execution Test (5 minutes)

**Goal:** Safely test the first customer interaction.

**Actions:**

1. Create a test opportunity in GHL with low value ($100-500)

2. Wait for webhook processing (NeuronX should automatically:
   - Receive webhook from GHL
   - Assign team based on location mapping
   - Create opportunity record)

3. Verify opportunity appears in Operator UI for the correct team

4. Execute a safe first action:

   ```bash
   # Find the opportunity ID from Operator UI or API
   # Execute with human approval (first execution must be approved)
   curl -X POST http://localhost:3001/api/execution/approve \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "x-tenant-id: YOUR_TENANT_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "planId": "opp_123",
       "notes": "First execution test - approved by admin",
       "correlationId": "first_execution_test_001"
     }'
   ```

5. Monitor the execution in Operator UI and audit logs

**Validation:**

- Opportunity created with correct team assignment
- Execution plan generated
- Approval required and granted
- Execution completes successfully
- Audit trail shows complete attribution

**First Success Event:**
Look for this audit event:

```
{
  "eventType": "execution_completed",
  "details": {
    "firstExecution": true,
    "correlationId": "first_execution_test_001"
  }
}
```

**Rollback:**

```bash
# If execution fails, it can be retried
# No customer impact from test execution
```

---

### Step 7: Production Enablement (5 minutes)

**Goal:** Enable live operations and handoff to customer.

**Actions:**

1. Switch Decision Engine to production mode (if desired):

   ```bash
   # This would be done via admin configuration
   # Default is monitor_only for safety
   ```

2. Enable customer access to Operator UI

3. Provide customer with:
   - Operator UI access credentials
   - Team assignments documentation
   - Escalation procedures
   - Support contact information

4. Log successful onboarding:
   ```bash
   # This creates the official go-live event
   curl -X POST http://localhost:3001/api/admin/onboarding-complete \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "x-tenant-id: YOUR_TENANT_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "goLiveTimestamp": "'$(date -Iseconds)'",
       "onboardedBy": "solutions_engineer@neuronx.com",
       "notes": "Successful enterprise onboarding"
     }'
   ```

**Validation:**

- Customer can access Operator UI
- Appropriate team members see their work queues
- Audit logs show go-live event

**Post-Go-Live Monitoring:**

- Monitor first 24 hours of customer usage
- Be available for questions/support
- Track key metrics (execution success rate, team adoption)

---

## Go-Live Readiness Checklist

### Pre-Go-Live

- [ ] Tenant bootstrap completed successfully
- [ ] Org hierarchy matches customer requirements
- [ ] GHL integration connected and tested
- [ ] Location-to-team mappings configured
- [ ] Opportunity backfill completed
- [ ] Readiness check shows READY status
- [ ] First execution test successful

### Go-Live Day

- [ ] Customer admin accounts created
- [ ] Team assignments communicated
- [ ] Operator UI access tested
- [ ] Support processes documented
- [ ] Escalation paths established
- [ ] Monitoring alerts configured

### Post-Go-Live

- [ ] First customer execution monitored
- [ ] Team adoption tracked
- [ ] Performance metrics established
- [ ] Support tickets monitored
- [ ] Success metrics reported

---

## Common Issues and Troubleshooting

### Issue: Bootstrap script fails

**Symptoms:** Bootstrap returns FAILED status
**Solution:**

1. Check error message in output
2. Verify tenant exists and credentials are valid
3. Ensure no conflicting org entities exist
4. Re-run in dry-run mode to diagnose

### Issue: GHL integration not connecting

**Symptoms:** Health check fails, webhooks not received
**Solution:**

1. Verify GHL API credentials
2. Check webhook URLs are registered in GHL
3. Validate tenant permissions
4. Check NeuronX GHL adapter logs

### Issue: Opportunities not assigned to teams

**Symptoms:** Backfill shows high "skipped" count
**Solution:**

1. Verify location mappings exist
2. Check opportunity locationId/pipelineId fields
3. Run backfill with smaller batch sizes
4. Manually create missing mappings

### Issue: Operator UI shows empty queues

**Symptoms:** Teams see no opportunities
**Solution:**

1. Verify user has correct role assignments
2. Check team scope includes opportunity locations
3. Validate opportunity team assignments
4. Check work queue filtering logic

---

## Rollback Procedures

### Complete Tenant Reset

```bash
# WARNING: This deletes all tenant data
curl -X DELETE http://localhost:3001/api/admin/tenant-reset \
  -H "Authorization: Bearer SUPER_ADMIN_TOKEN" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{"confirmDeletion": true}'
```

### Partial Rollbacks

- **Org Structure:** Delete specific entities via API
- **Mappings:** Delete individual mappings
- **Opportunities:** Reassign teams individually
- **Backfill:** Re-run with different parameters

### Emergency Stop

```bash
# Disable all executions for tenant
curl -X POST http://localhost:3001/api/admin/emergency-stop \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "x-tenant-id: YOUR_TENANT_ID"
```

---

## Success Metrics

### Onboarding Success

- **Time to Go-Live:** <60 minutes from start to finish
- **Bootstrap Success Rate:** 100% (no failures)
- **Data Migration Coverage:** >95% opportunities assigned
- **First Execution Success:** 100% within first 24 hours

### Operational Readiness

- **Audit Trail Completeness:** 100% actions attributable
- **Scope Compliance:** 100% operations within team boundaries
- **Execution Safety:** No unauthorized or unsafe executions
- **Support Ticket Volume:** <2 tickets in first week

---

## Appendices

### Appendix A: Org Structure Planning

Define team/agency hierarchy before onboarding:

- Enterprise: Company name
- Agencies: Regional or functional divisions
- Teams: Specific sales groups (inbound, outbound, enterprise, etc.)

### Appendix B: Manual API Operations

Common API endpoints for manual operations:

- Org management: `/api/org/*`
- Opportunity management: `/api/sales/opportunities/*`
- Integration management: `/api/org/integrations/*`

### Appendix C: Monitoring and Alerts

Key metrics to monitor post-go-live:

- Execution success rate
- Work queue adoption
- Team utilization
- Error rates by component

### Appendix D: Support Escalation

- **P1 Issues:** Platform down, data loss, security breach
- **P2 Issues:** Execution failures, scope violations
- **P3 Issues:** UI issues, performance degradation
- **P4 Issues:** Feature requests, training needs

---

## Version History

- **v1.0.0 (2026-01-05)**: Initial golden path documentation
  - Automated bootstrap script integration
  - Readiness validation gates
  - Comprehensive rollback procedures
  - First execution safety protocols
