# Routing Trigger Truth

## Conclusion
Routing triggers on: **LeadCreated (Synchronous Orchestration)**

## Evidence
1.  **LeadCreated Handling**:
    *   **File**: [`apps/core-api/src/sales/sales.service.ts`](file:///Users/ranjansingh/Desktop/NeuronX/apps/core-api/src/sales/sales.service.ts)
    *   **Method**: `handle(event)` (lines 28-112)
    *   **Logic**: Subscribes to `sales.lead.created` (line 25).

2.  **Scoring & Qualification**:
    *   **File**: [`apps/core-api/src/sales/sales.service.ts`](file:///Users/ranjansingh/Desktop/NeuronX/apps/core-api/src/sales/sales.service.ts)
    *   **Method**: `handle(event)` -> `leadScorer.evaluateLead` (line 82)
    *   **Logic**: If `scoringResult.shouldRoute` is true, it calls `executeQualificationAction` (emits `sales.lead.qualified`) AND `executeCountryRouting`.

3.  **Routing Invocation**:
    *   **File**: [`apps/core-api/src/sales/sales.service.ts`](file:///Users/ranjansingh/Desktop/NeuronX/apps/core-api/src/sales/sales.service.ts)
    *   **Method**: `executeCountryRouting` (lines 172-238)
    *   **Logic**: Calls `this.leadRouter.routeLead(event)` directly. `LeadRouterService` does NOT subscribe to any events itself.

## Analysis
The system uses a **Synchronous Orchestration** pattern within `SalesService`, not an Event-Driven Choreography pattern for this specific flow.
*   **Architecture Expectation**: `Created` -> (Event) -> `Qualified` -> (Event) -> `Routed`.
*   **Current Reality**: `Created` -> `SalesService` -> (`Qualified` Event + `Routed` Event).

## Decision
**Align Requirements to Reality.**
For "Ship Readiness" (Phase 1), we will validate the current synchronous orchestration. Refactoring to a fully decoupled event-driven architecture (where `LeadRouter` listens to `Qualified`) is a future enhancement (Phase 2+), as it introduces complexity (eventual consistency, retry queues) not needed for the $1M MVP.

**Implication for Testing**:
The "Real Chain" test must verify that `SalesService` correctly orchestrates both outcomes when given a `LeadCreated` event.
