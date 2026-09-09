# Manual Apps Script update

The repository remains modular for maintenance and testing. For a manual Apps Script update, use the generated two-file package:

- `apps-script/manual/Code.gs`
- `apps-script/manual/Index.html`

They contain the same tested code as the modular sources, including the Case Editor, Run Workspace, and the real-format `processData` support.

## Safe update path

Use a new blank Apps Script project for this package. Do not paste `Code.gs` alongside the older modular server files: duplicate global functions can make deployment behaviour ambiguous.

1. Create a blank standalone Apps Script project in the browser.
2. Replace its default `Code.gs` with the repository's generated `Code.gs`.
3. Add one HTML file named `Index` and paste the generated `Index.html` into it.
4. Deploy it as a web app with the same Google account that owns the intended Drive workspace. Keep access restricted to yourself for the single-user MVP.
5. On first use, authorize the requested Google permissions, then enter the existing workspace Drive folder ID in the console.

The Case JSON files stay in that Drive workspace. A new Apps Script project has its own user settings, so the workspace folder ID must be entered once again.

## Updating a deployment

For a test deployment, use the editor's current saved code. For the stable `/exec` URL, create a new deployment version through **Manage deployments** after pasting the files.

## Source of truth

Do not hand-edit the generated files in GitHub. The editable sources are the modular files in `apps-script/`; the generated bundle is rebuilt and verified by the repository tests.
