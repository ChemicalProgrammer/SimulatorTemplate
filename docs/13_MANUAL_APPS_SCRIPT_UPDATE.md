# Manual Apps Script update

The repository remains modular for maintenance and testing. For a manual Apps Script update, use the generated two-file package at the repository root:

- `Code.gs`
- `Index.html`

They contain the same tested code as the modular sources, including the Case Editor, Run Workspace, and the real-format `processData` support. These two root files are the **only** manual copy/paste entry point.

## Safe update path

Use a new blank Apps Script project for this package. Do not paste `Code.gs` alongside the older modular server files: duplicate global functions can make deployment behaviour ambiguous.

1. Create a blank standalone Apps Script project in the browser.
2. Replace its default `Code.gs` with the repository-root `Code.gs`.
3. Add one HTML file named `Index` and paste the repository-root `Index.html` into it.
4. Deploy it as a web app with the same Google account that owns the intended Drive workspace. Keep access restricted to yourself for the single-user MVP.
5. On first use, authorize the requested Google permissions, then enter the existing workspace Drive folder ID in the console.

The Case JSON files stay in that Drive workspace. A new Apps Script project has its own user settings, so the workspace folder ID must be entered once again.

## Updating a deployment

For a test deployment, use the editor's current saved code. For the stable `/exec` URL, create a new deployment version through **Manage deployments** after pasting the files.

## Source of truth

Do not hand-edit the generated root files in GitHub. The editable sources are the modular files in `apps-script/`; its page template is named `WebApp.html` specifically so it is not confused with the manual `Index.html`. The generated bundle is rebuilt and verified by the repository tests.

## Current release: replace the root pair

For an existing manual Apps Script project, replace both:

- repository-root `Code.gs` → your Apps Script file named `Code.gs`
- repository-root `Index.html` → your Apps Script HTML file named `Index`

This release adds Case deletion and changes the simulation contract: physical geometry is mandatory on every conveyor. Old Cases that use abstract buffers or `accumulationZone` overrides must be deleted or rebuilt from the new public demo.

Do not copy files from `apps-script/`, `src/`, `test/`, or `docs/` into Apps Script. There is no third file for sensor control, the browser engine, styles, or charts: all browser code is embedded in the root `Index.html`.

After pasting, save, then update the existing web-app deployment to a new version. This changes application code only; it does not create a Git branch or a Drive Case copy.
