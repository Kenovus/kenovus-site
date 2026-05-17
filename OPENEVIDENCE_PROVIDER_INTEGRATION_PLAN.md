# OpenEvidence provider integration plan

Goal: add an evidence-assisted workflow for providers without exposing PHI to third-party systems by default.

## Scope

- Provider-only surface in `provider/` routes.
- Evidence retrieval + citation display for clinical questions.
- Optional patient-context mode with strict redaction and audit logging.

## Architecture

1. **Server-side proxy only**
   - Add Supabase Edge Function `openevidence-query`.
   - Keep OpenEvidence API keys server-side (Supabase secrets).
   - Never call OpenEvidence directly from the mobile app.
2. **Authz**
   - Require authenticated user.
   - Verify role in `user_profiles` is `provider` or `clinic_owner`.
   - Optionally enforce clinic scoping for patient-linked prompts.
3. **Prompt modes**
   - `general_clinical_question`: no patient data.
   - `patient_context_question`: allows context payload, but run redaction first.
4. **Audit trail**
   - Write to a new table `provider_evidence_queries`:
     - `provider_id`, `clinic_id`, `patient_id` (nullable), `question`, `response_summary`,
     - `sources_json`, `tokens_in`, `tokens_out`, `latency_ms`, `created_at`.

## Data protection controls

- Strip direct identifiers before outbound call:
  - name, email, phone, exact DOB, address, MRN-equivalents.
- Transform to coarse descriptors:
  - age range, sex, condition timeline, meds/dose class.
- Add provider confirmation for any patient-context query:
  - “I confirm this is minimum necessary data.”

## UX phases

### Phase 1 (safe baseline)

- New screen: `app/provider/evidence.tsx`.
- Input box + response card + source links.
- “No diagnosis / no prescribing changes” disclaimer.
- Save query log rows.

### Phase 2

- Context chips from patient chart (med list, symptoms, labs trend).
- Toggle: `General` vs `Patient context`.
- Structured response template:
  - key points
  - contraindications/red flags
  - suggested follow-up questions
  - citations

### Phase 3

- “Add to chart note draft” action.
- Team knowledge snippets + saved prompts.
- Outcome tagging for prompt quality loop.

## Implementation checklist

1. Add migration for `provider_evidence_queries` with RLS:
   - providers read their own clinic rows
   - super_admin read-all
2. Add Edge Function `openevidence-query`:
   - role checks
   - redaction
   - OpenEvidence request
   - audit insert
3. Add provider screen + hook:
   - optimistic loading state
   - source rendering
   - safe error handling
4. Add admin metrics:
   - query volume/day
   - median latency
   - top topics
   - error rate

## Open questions

- API contract details for OpenEvidence (request/response schema, rate limits, source fields).
- Whether citation URLs can be opened directly in mobile webview.
- Final compliance position for patient-context mode per clinic policy.
