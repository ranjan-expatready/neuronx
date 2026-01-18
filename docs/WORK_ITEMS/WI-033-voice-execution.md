# WI-033: Voice Execution Adapter Hardening (Twilio-first)

**Status:** 🟢 Active
**Created:** 2026-01-05
**Priority:** Critical
**Assigned:** Cursor Agent

## Problem Statement

NeuronX can now decide WHAT to do, WHO should do it, HOW it should be done, and WHEN to escalate - but cannot actually execute voice calls safely. Without voice execution:

- AI cannot call customers (blocking autonomous execution)
- Humans cannot get AI assistance for calls (blocking hybrid workflows)
- Voice outcomes cannot feed back into playbooks (blocking evidence-driven progression)
- External voice systems remain untrusted and disconnected
- The entire sales operating system remains theoretical

This prevents NeuronX from being felt by customers and blocks the commercial tipping point.

## Solution Overview

Implement a Twilio-first voice execution adapter with complete NeuronX authority:

1. **Voice Execution Adapter**: Hard-gated execution that only proceeds when Decision Engine allows
2. **Decision Enforcement**: Strict validation of voiceMode (SCRIPTED/CONVERSATIONAL/HUMAN_ONLY) and actor restrictions
3. **Evidence Normalization**: Convert Twilio callbacks into canonical VoiceEvidence for playbook evaluation
4. **Human-in-Loop Integration**: Voice approvals appear in Operator UI work queue
5. **Retry & Escalation Ownership**: NeuronX controls timing, not external systems
6. **Safety Guarantees**: Multiple enforcement layers prevent customer harm

**Non-Negotiable**: External voice systems are pure execution plumbing - NeuronX owns all logic, timing, and decisions.

## Acceptance Criteria

### AC-033.01: Voice Execution Authority

- [x] AI cannot place call without DecisionResult.allowed = true
- [x] voiceMode=HUMAN_ONLY blocks all AI voice execution
- [x] voiceMode=SCRIPTED requires valid scriptId
- [x] voiceMode=CONVERSATIONAL only when explicitly enabled
- [x] actor=HUMAN routes to approval workflow
- [x] actor=HYBRID requires human-in-loop approval

### AC-033.02: Evidence Normalization

- [x] Twilio status callbacks mapped to CanonicalVoiceEvidence
- [x] CALL_CONNECTED, HUMAN_ANSWERED, VOICEMAIL_LEFT, etc. detected
- [x] Evidence feeds into PlaybookEngine.evaluateStageTransition
- [x] Business outcomes (qualification_complete, objection_detected) extracted
- [x] Evidence includes confidence scores and compliance validation

### AC-033.03: Human-in-Loop Integration

- [x] Voice approvals appear in Operator UI work queue
- [x] APPROVAL_REQUIRED mode blocks execution until human approval
- [x] ASSISTED mode allows human to execute with AI suggestions
- [x] All human actions include correlation IDs
- [x] Actions route through Decision Engine for re-evaluation

### AC-033.04: Safety & Compliance

- [x] Webhook signatures validated (REQ-015)
- [x] Callbacks processed idempotently
- [x] Safety violations logged and blocked
- [x] High-risk deals prevent AI voice execution
- [x] Compliance checks before every call

### AC-033.05: External System Boundaries

- [x] Twilio receives only: phone numbers, TwiML URLs, callback URLs
- [x] No business logic in TwiML or callback processing
- [x] NeuronX owns retry timing and escalation decisions
- [x] External systems cannot trigger playbook changes
- [x] All timing controlled by NeuronX runners

## Artifacts Produced

### Code Artifacts

- [x] `packages/adapters/voice-twilio/` - Complete Twilio voice adapter
- [x] `TwilioClient` - Thin HTTP client wrapper
- [x] `TwilioWebhookVerifier` - Signature validation (REQ-015)
- [x] `TwilioVoiceExecutionAdapter` - Decision enforcement gate
- [x] `apps/core-api/src/voice/` - Voice execution endpoints and normalization
- [x] `VoiceExecutionController` - REST API for voice operations
- [x] `VoiceEvidenceNormalizer` - Twilio → CanonicalVoiceEvidence mapping
- [x] `apps/operator-ui/` - Voice approval integration in work queue

### Test Artifacts

- [x] Unit tests for all adapter components
- [x] Signature verification tests
- [x] Decision enforcement boundary tests
- [x] Evidence normalization accuracy tests
- [x] Idempotency and safety tests

### Documentation Artifacts

- [x] Voice execution safety rules and threat model
- [x] Human-in-loop workflow documentation
- [x] Evidence normalization mappings
- [x] External system boundary definitions

## Technical Implementation

### Voice Execution Flow

```
1. PlaybookEngine emits ExecutionCommand (voice)
2. DecisionEngine evaluates → DecisionResult
3. VoiceExecutionAdapter enforces DecisionResult
4. If allowed → TwilioClient.createCall()
5. Twilio callbacks → VoiceEvidenceNormalizer
6. CanonicalVoiceEvidence → PlaybookEngine.evaluateStageTransition()
7. Loop continues based on evidence
```

### Decision Enforcement Gates

```typescript
// Hard gates - no exceptions
if (!decisionResult.allowed) → reject
if (voiceMode === HUMAN_ONLY) → reject AI execution
if (voiceMode === SCRIPTED && !scriptId) → reject
if (actor === HUMAN) → route to approval workflow
if (safetyViolation) → log + block + audit
```

### Evidence Normalization

```typescript
// Twilio status → Canonical evidence
'answered' + answeredBy='human' → HUMAN_ANSWERED
'completed' + duration > 0 → CALL_CONNECTED
'no-answer' → CALL_NO_ANSWER
'machine' + duration < 5 → VOICEMAIL_LEFT

// Business outcomes (future AI analysis)
speech.contains('interested') → INTEREST_DETECTED
speech.contains('not interested') → OBJECTION_DETECTED
```

### Human-in-Loop Modes

```typescript
AUTONOMOUS: AI executes, evidence collected automatically
ASSISTED: AI suggests script, human executes, human gets credit
APPROVAL_REQUIRED: Call blocked until human approves execution
```

## Out of Scope

- Full conversational AI implementation
- Advanced speech analytics
- Multi-language voice support
- Voice recording transcription
- Real-time call monitoring dashboard
- Voice script creation/editing UI

## Dependencies

- **WI-027**: Stage Gate (provides stage validation)
- **WI-028**: Playbook Engine (consumes voice evidence)
- **WI-029**: Decision Engine (provides voice execution decisions)
- **WI-032**: Operator UI (displays voice approvals)
- **REQ-001**: Enterprise-grade reliability
- **REQ-002**: External system boundaries
- **REQ-015**: Webhook signature validation
- **REQ-016**: Idempotent processing

## Risk Mitigation

### Technical Risks

- **Webhook signature validation**: Comprehensive tests for REQ-015 compliance
- **Idempotency failures**: Deduplication logic with correlation IDs
- **Evidence normalization errors**: Extensive mapping tests and validation
- **Decision enforcement bypass**: Multiple validation layers and audit logging
- **External system coupling**: Strict interface boundaries

### Business Risks

- **Customer experience harm**: Safety gates prevent inappropriate calls
- **Failed voice execution**: Fallback to human-only mode with clear indicators
- **Evidence gaps**: Comprehensive logging and monitoring of normalization failures
- **Operator workflow disruption**: Clear UI indicators and escalation paths
- **Compliance violations**: Built-in compliance checks and audit trails

## Success Metrics

- **Execution Safety**: 100% of calls pass decision enforcement gates
- **Evidence Accuracy**: >95% of Twilio callbacks successfully normalized
- **Human-in-Loop Efficiency**: <2 minute average approval time
- **System Reliability**: >99.9% webhook processing success rate
- **Customer Safety**: Zero inappropriate calls reach customers

## Future Extensions

- Advanced conversational AI integration
- Real-time call coaching and assistance
- Multi-channel voice (SMS fallback, etc.)
- Voice analytics and performance insights
- Automated script optimization based on outcomes
- International voice support with localization
