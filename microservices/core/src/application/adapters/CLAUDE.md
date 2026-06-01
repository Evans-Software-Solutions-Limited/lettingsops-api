# CLAUDE.md — Adapters

Port-and-adapter pattern for outbound integrations. Provider-agnostic
business logic talks to **ports** (TypeScript interfaces in this
folder); concrete **adapters** in `crm/<provider>.ts` and
`booking/<provider>.ts` implement them.

Phase 2 of `01-platform-hardening`'s sibling spec (`.kiro/specs/02-crm-and-booking-adapters/`)
owns this module. Block A landed the ports + the `IntegrationError`
class; subsequent blocks add the registry, retry helper, reference
adapters, and contract tests.

## The two ports

| Port                | File                           | Designed for                                                |
| ------------------- | ------------------------------ | ----------------------------------------------------------- |
| `CrmAdapter`        | `crm/crmAdapter.ts`            | Pushing leads / qualifications / viewings to a tenant's CRM |
| `SlotSourceAdapter` | `booking/slotSourceAdapter.ts` | Listing available viewing slots + booking against them      |

Both port files are **type-only**: they declare interfaces and payload
shapes, no implementation. They live alone in their files so any new
implementation in the same provider directory can import the
interface without dragging in a reference implementation's
transitive dependencies.

## When to add a new adapter

Only when there's a new provider that needs supporting. Two questions
before adding:

1. **Does the existing port surface cover what the provider needs?** If
   not, propose the port change first (one PR), get it reviewed, then
   add the adapter in a follow-up. Resist the temptation to bolt
   provider-specific methods onto the port — that's how the abstraction
   tax compounds.
2. **Is the provider going to be used by at least one real agency?**
   If not, hold. The mock / noop adapters in this folder cover testing
   and "we haven't picked a provider yet" cases.

Adapter `kind` strings are the configured-provider identifiers in
`agency_integrations.crm_adapter_kind` and `slot_adapter_kind`.
**Don't rename them once they're live** — the values are persisted
per-agency. Add new kinds; deprecate old ones with a migration if
you must.

## The contract-test rule

Every adapter that implements a port MUST register itself in the
parameterised suite at
`__tests__/crmAdapterContract.test.ts` (or `slotSourceAdapterContract.test.ts`).
The suite runs the same battery of cases against every registered
implementation, so a new adapter can't land with a behavioural drift
the existing adapters wouldn't have. A convention test in CI fails the
build if a new adapter constructor in `crm/` or `booking/` isn't in
its sibling contract list.

The contract tests aren't a replacement for adapter-specific tests —
real adapters still get their own unit tests for provider-specific
quirks (auth, pagination, error mapping). The contract suite locks
the **shared** behaviour.

## Errors

Adapters throw `IntegrationError` (in `integrationError.ts`) for any
caller-recoverable failure — network timeouts, 429s, transient 5xx.
The retry helper (Block C) reads `attempt` and `retryable` off the
error to drive backoff. Unrecoverable failures (auth misconfig,
invalid request shape) throw plain `Error` so the retry helper
doesn't waste backoff time on them.

## Cross-references

- Spec: `.kiro/specs/02-crm-and-booking-adapters/`
- Ports: `crm/crmAdapter.ts`, `booking/slotSourceAdapter.ts`
- Errors: `integrationError.ts`
- Registry (Block C): `registry.ts` _(not in this PR)_
- Retry helper (Block C): `retry.ts` _(not in this PR)_
- Reference adapters (Block D): `crm/{noop,csvExport,mock}.ts`, `booking/{mock,googleCalendar}.ts` _(not in this PR)_
- Contract suites (Block E): `__tests__/{crm,slotSource}AdapterContract.test.ts` _(not in this PR)_
