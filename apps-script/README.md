# Manual Apps Script deployment

For the browser-based Apps Script editor, this directory has exactly two files to copy:

1. `Code.gs` → replace the Apps Script file named **Code.gs**.
2. `Index.html` → replace the Apps Script HTML file named **Index**.

Those files are complete and generated together. Do not paste any file from `source/` into the same Apps Script project; that would duplicate global functions already bundled in `Code.gs` and `Index.html`.

The `source/` folder is only for repository maintenance and optional `clasp` deployment. It is not part of the manual copy/paste workflow.
