# Security notes

This project starts or reconnects to the desktop client through a local Chrome
DevTools Protocol endpoint on `127.0.0.1:19347`. The cold-start launcher checks
the listening process; reconnecting locates the compatible desktop page through
the existing local endpoint.

The companion can read the contents of the currently rendered desktop client
page because that access is required to locate selected text and native branch
controls. Review the source before running it, keep the debugging endpoint local,
and do not expose port `19347` through a proxy, port forward, or firewall rule.

Branch metadata is stored locally in `branch-state.json`; bookmark metadata is
stored in `bookmark-state.json`. Both files and their backups can contain quoted
conversation text and chat identifiers. They are ignored by Git and must not be
published.

The bookmark link service listens only on `127.0.0.1:19348`. Links refer to local
bookmark identifiers and can navigate the connected desktop app. The service
does not expose a bookmark listing or return the saved quote. Jump requests
require the service's own origin and request header. Keep both ports local and
stop the assistant when local access is no longer needed.

Please report vulnerabilities through GitHub's private vulnerability reporting
feature when it is enabled for the repository.
