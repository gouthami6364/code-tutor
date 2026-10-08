# Code Tutor UI Redesign

Replace your existing `App.jsx` and `App.css` with the files in this folder.
`checkSyntax.js` is included unchanged because the redesign keeps your existing
Acorn-based syntax detection and concept classification.

The redesign keeps:
- Monaco editor
- Acorn syntax checking
- line/column error markers
- Nudge / Explain / Show fix API
- localStorage concept counts
- your existing hint endpoint

It adds the IDE-style navigation, file explorer, welcome/quick-actions area,
editor toolbar, detailed error inspector, and bottom status bar shown in the
reference design.
