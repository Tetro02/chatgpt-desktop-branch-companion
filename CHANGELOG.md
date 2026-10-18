# Changelog

## 0.3.3 - 2026-10-18

- Use the visible conversation content as the authoritative active thread during native fork transitions.
- Wait for the forked transcript and composer before inserting the selected quote.
- Derive branch node titles from the selected text.
- Normalize temporary local conversation prefixes before navigation and tree grouping.
- Prevent invalid local routes when a fork identifier is not ready.

## 0.3.2 - 2026-10-18

- Support current ChatGPT and local Codex-style response message selectors.
- Add native persistent conversation forking from selected response text.
- Add an explorer-style branch tree, source markers, navigation, removal, and undo.
- Match the desktop client's typography and add hover, active, focus, and tooltip feedback.
- Bind the debugging endpoint to localhost and validate the owning process before attaching.
