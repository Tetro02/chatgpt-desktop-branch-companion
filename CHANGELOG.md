# Changelog

## 0.5.0 - 2026-10-22

- Unify the product name as GPT助手, with one launcher and a module registry.
- Keep branches and bookmarks in the same runtime and provide a documented extension path.
- Preserve existing records, local links, and legacy launcher compatibility.
- Merge the published repository history while retaining its MIT license, security notes, and historical examples.

## 0.4.6 - 2026-10-22

- Add cross-chat message bookmarks, formatted math previews, local persistence, and external local jump links.
- Align branch and bookmark panels and avoid native file-preview toolbar controls.
- Integrate fraction and boxed-formula selections into the native selection toolbar.
- Shorten jump highlighting to about one second and clear it on user interaction.

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
