# Security and data

## Identity and access

- Deploy the web app so Apps Script identifies the active Google user; do not build a separate password store.
- Restrict access with an explicit allowlist/organization policy in the deployment and validate identity server-side.
- Every server request resolves the current user; never accept an owner ID or Drive folder ID from the client as authorization.
- The initial product is single-user, but all persisted data includes `ownerUserId` to prevent accidental cross-user access later.

## Drive boundaries

- A global administrator-configured folder holds approved knowledge sources and templates. It is read-only to the application user unless a separately authorized admin workflow exists.
- Each user configures one workspace root folder. The app creates or verifies controlled subfolders such as `Cases`, `Artifacts`, and `Exports`.
- Persisted IDs are validated to ensure they belong to the authorized workspace or fixed library before read, write, export, or cache reuse.
- Maintain a Sheets-backed index; do not recursively scan Drive during ordinary app use.

## Gemini boundary

- Gemini credentials remain server-side in approved Script Properties / organization-managed configuration; never expose keys in HTML, client JS, logs, Drive files, or cached browser state.
- `AIManager` receives only the minimum structured evidence needed for the task.
- Retrieval is restricted to permitted sources. Cache entries include user and authorization scope; never share private findings or keys between users.
- Gemini returns structured suggestions with citations/provenance. It cannot mutate a Case, launch an export, or execute code without an explicit server-side action and validation.

## Data and audit

- Store schema version, creator, timestamps, source provenance, simulation seed, engine version, and input hash with each run.
- Preserve original artifacts; create versioned outputs instead of overwriting.
- Log security-relevant actions minimally (user, action, object ID, timestamp, result), excluding secrets and raw confidential content.
- Validate all JSON against schemas and escape/sanitize HTML before it enters the viewer or PDF pipeline.
