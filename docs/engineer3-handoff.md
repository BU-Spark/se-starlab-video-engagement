# Engineer 3 API Handoff

> **Superseded for study creation (2026-10-28).** The team schema uses Supabase tables `studies` and `blocks`, and the researcher frontend now writes them directly. See [supabase-alignment.md](supabase-alignment.md). The FastAPI contract below is kept for reference only.

Page: `/researcher/studies/new`  
Frontend owner: Engineer 1 / Louis  
Backend owner: Engineer 3  
Date: 2026-10-16

## 1. Current Implementation and Integration Points

The creation page supports three block types, settings, reordering, deletion confirmation, local file previews, and validation. **There are currently no backend requests, uploads, or persistent saves. Save buttons are disabled, and refreshing clears the data.** The previous simulated-save implementation has been removed.

Relevant files:

- [StudyBuilder.tsx](../app/researcher/_components/StudyBuilder.tsx): page interface and save integration point.
- [study-model.ts](../app/researcher/_components/study-model.ts): frontend models, validation, `StudyPayload`, and `buildStudyPayload`.
- Save requests are not implemented. Implement real requests in a separate API service and connect it to page actions during integration.
- [researcher.md](researcher.md): feature scope and demonstration steps.

The following is a proposed API contract requiring agreement between frontend and backend, not an implemented backend. Complete the upload → create study → read-back verification flow first. Study lists, historical runs, and exports are outside this page's initial integration scope.

## 2. Routes

Use the proposed prefix `/api/v1` and snake_case JSON fields.

| Priority | Method and Path | Engineer 3 Responsibilities | Success Response |
| --- | --- | --- | --- |
| Initial integration | POST /api/v1/assets/upload-url | Validate researcher permissions, asset purpose, file type, and size; create an asset record and return restricted upload credentials | 201; see upload contract |
| Initial integration | POST /api/v1/assets/{asset_id}/complete | Verify the actual uploaded object and its type/size; mark the asset ready for references; repeated calls must not create duplicate assets | 200; asset details |
| Initial integration | POST /api/v1/studies | Validate the full study and asset ownership; atomically save settings and all blocks | 201; StudyRead |
| Save verification | GET /api/v1/studies/{study_id} | Check permissions and return the complete study in its original order | 200; StudyRead |
| Later editing | PUT /api/v1/studies/{study_id} | Validate base_revision, atomically replace study configuration, and increment revision | 200; StudyRead |

The current frontend has only a creation page, not a study list or an existing-study editor. GET/PUT form hydration and update calls require later integration. Do not directly assign API responses to the local form model containing File objects.

All Study and Asset routes require researcher authentication and resource-level authorization. Use the authentication provider agreed by the team. Local accessibility does not justify omitting authorization from deployment.

## 3. Create Study Request

Use the following JSON for `POST /api/v1/studies`. UUIDs are illustrative; the video's asset_id must come from a real completed upload.

```json
{
  "name": "Short-form video attention",
  "settings": {
    "randomization": { "mode": "videos_only" },
    "show_video_progress": true,
    "allow_back_navigation": false,
    "allow_pause": false,
    "response_buttons": {
      "enabled": true,
      "left": {
        "label": "",
        "default_icon": "thumbs_down",
        "icon_asset_id": null
      },
      "right": {
        "label": "",
        "default_icon": "thumbs_up",
        "icon_asset_id": null
      }
    }
  },
  "blocks": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "type": "instruction",
      "text": "Please watch each video at your own pace."
    },
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "type": "video",
      "asset_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    },
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "type": "survey",
      "question": "How engaging was the video?",
      "options": [
        { "id": "44444444-4444-4444-8444-444444444444", "label": "Not engaging" },
        { "id": "55555555-5555-4555-8555-555555555555", "label": "Neutral" },
        { "id": "66666666-6666-4666-8666-666666666666", "label": "Very engaging" }
      ]
    }
  ]
}
```

StudyRead returns all fields above and adds:

| Field | Type | Contract |
| --- | --- | --- |
| id | UUID string | Backend-generated Study ID |
| revision | Positive integer | Starts at 1; increments after each successful update |
| created_at | ISO 8601 string | UTC, including timezone |
| updated_at | ISO 8601 string | UTC, including timezone |

Updates use the same configuration plus `base_revision`. The study ID belongs in the URL; requests must not overwrite ownership. Return 409 on a revision mismatch instead of silently overwriting changes.

### Field and Behavior Rules

- name, instruction.text, survey.question, and each option label must be nonempty after trimming whitespace.
- Require at least one block. The survey prototype requires at least two options; the team must confirm the upper limit.
- block.type discriminates instruction / video / survey. Prefer Pydantic discriminated unions over unstructured dictionaries.
- The frontend generates UUIDs for blocks and options. Reordering preserves IDs; the backend validates duplicate IDs.
- Array order matters for blocks and options. Do not maintain a separate, potentially conflicting order field.
- randomization.mode is none / all / videos_only. This page only configures it; it does not calculate randomized results. Proposed videos_only behavior preserves non-video positions and shuffles only videos, subject to agreement by all three engineers.
- A custom icon takes precedence over default_icon; null uses the default. Left defaults to thumbs-down and right to thumbs-up.
- Disabling response_buttons preserves labels and icons but hides buttons in the runner. Retained custom icon references must still be valid when saving.
- If back navigation is allowed, the runner creates a new record for repeat viewing without changing the original block ID. Engineer 2 and Engineer 3 implement immutable video responses and changeable survey responses together.
- Actual study runs should reference a saved configuration revision or snapshot so later edits cannot change the meaning of historical runs.

## 4. File Upload Contract

### Request Upload Credentials

Example request:

```json
{
  "kind": "video",
  "filename": "attention-stimulus.webm",
  "mime_type": "video/webm",
  "size_bytes": 2400000
}
```

kind is video or button_icon. Engineer 3 must confirm supported formats and size limits based on storage and target-tablet capabilities. Browser file-type hints are not security validation.

Proposed response:

```json
{
  "asset_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "upload_url": "https://storage.example/signed-upload",
  "method": "PUT",
  "headers": { "Content-Type": "video/webm" },
  "expires_at": "2026-10-16T16:30:00Z"
}
```

upload_url is dynamically signed by the backend; the example URL is not usable. Return the method and headers required by the storage provider, agreeing on PUT or POST. The frontend must not construct storage URLs or automatically forward the application Bearer token to the storage domain.

Send raw file bytes using the returned method and headers. After upload succeeds, call complete; its request body may be empty. Proposed completion response:

```json
{
  "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "kind": "video",
  "status": "ready",
  "filename": "attention-stimulus.webm",
  "mime_type": "video/webm",
  "size_bytes": 2400000
}
```

The server must verify the object during complete rather than trust a frontend claim. Incomplete or unready assets cannot be referenced by a Study. If processing requires a 202 response, also provide a status endpoint and agree on this with Engineer 1; do not silently switch to an asynchronous flow.

### Frontend Integration Sequence

1. Request upload credentials for each LocalMedia item.
2. Upload the file and call complete.
3. Store the `LocalMedia.id → asset_id` mapping.
4. Call the existing `buildStudyPayload(draft, uploadedAssets)`.
5. Send the resulting StudyPayload to the create endpoint.
6. Show cloud-save success only after a successful create response; preserve edits on failure.
7. Enable Save after integration and display actual uploading, saving, and error states.

The adapter throws for missing uploaded assets. It never disguises File objects, blob URLs, or local filenames as asset IDs. The existing local-preview ready state means the browser can read the file, not that a backend upload has completed.

## 5. Errors and Authorization

Proposed shared application-error structure:

```json
{
  "detail": {
    "code": "REVISION_CONFLICT",
    "message": "This study has changed. Reload before saving.",
    "current_revision": 4
  }
}
```

| Status | Situation | Frontend Behavior |
| --- | --- | --- |
| 401 | Unauthenticated or expired credentials | Request authentication again and preserve edits |
| 403 | Insufficient permissions | Explain the permission issue; do not retry automatically |
| 404 | Study or Asset does not exist | Show that the resource is unavailable |
| 409 | Revision conflict or asset not ready | Preserve edits; request conflict resolution or upload completion |
| 413 | File too large | Explain the size limit and request another file |
| 422 | Field validation failure | Display field errors |
| 5xx / network failure | Backend or network error | Preserve edits and allow retry |

422 may retain FastAPI's default detail array (loc / msg / type). Normalize errors in the frontend request layer. For example, map a blocks index in loc to block.id in the submitted snapshot. Do not assume every error uses the same detail shape.

The backend must validate asset ownership, researcher permissions, asset purpose, and readiness. Database secret keys belong only on the backend. Configure CORS for the local frontend origin; permissive CORS is not authentication. Prefer private storage buckets with restricted upload and read credentials.

Create requests should support Idempotency-Key. Reuse the same key for retries of the same save to avoid duplicate studies when the server saves successfully but the response is lost. Reject the same key with a different payload. Implement matching frontend retry behavior during integration.

## 6. FastAPI Router Organization

Add the following files without modifying the existing click-test endpoint:

```text
backend/app/routers/studies.py
backend/app/routers/assets.py
backend/app/schemas/study.py
backend/app/schemas/asset.py
backend/app/services/studies.py
backend/app/services/assets.py
```

This is a structural example only. Engineer 3 must implement the referenced schemas, authentication dependency, and services:

```python
from uuid import UUID
from fastapi import APIRouter, Depends
from app.auth import require_researcher
from app.schemas.study import StudyCreate, StudyUpdate, StudyRead
from app.services import studies

router = APIRouter(prefix="/api/v1/studies", tags=["studies"])

@router.post("", response_model=StudyRead, status_code=201)
def create_study(payload: StudyCreate, user=Depends(require_researcher)):
    return studies.create(payload, user)

@router.get("/{study_id}", response_model=StudyRead)
def read_study(study_id: UUID, user=Depends(require_researcher)):
    return studies.get(study_id, user)

@router.put("/{study_id}", response_model=StudyRead)
def update_study(
    study_id: UUID,
    payload: StudyUpdate,
    user=Depends(require_researcher),
):
    return studies.update(study_id, payload, user)
```

Register the studies and assets routers in main.py using app.include_router. Align StudyCreate with the frontend StudyPayload; add base_revision to StudyUpdate and the response metadata from Section 3 to StudyRead. The example omits Idempotency-Key and error handling; the actual implementation must complete those parts of the contract.

## 7. Minimum Integration Acceptance Checks

- Create a study with Instructions; GET returns matching content and order.
- Add a completed video upload; the tablet can resolve its saved asset reference.
- Survey options and stable IDs survive saving, reading, and reordering.
- Reject empty names, empty block content, duplicate IDs, and unready or unauthorized assets.
- Preserve frontend edits after failed saves; retrying the same creation must not duplicate the study.
- PUT succeeds with the correct revision and returns 409 for an outdated revision.
- Unauthenticated or unauthorized requests cannot read or write Studies or Assets.
- Deliver OpenAPI documentation, sanitized request/response examples, migrations, backend tests, and an environment-variable template. Do not deliver real secrets.

The page currently provides a static frontend with real local editing only. The backend endpoints and integration checks above are not yet implemented.

