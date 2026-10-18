# Security notes

This project starts the desktop client with a Chrome DevTools Protocol endpoint.
The launcher binds it to `127.0.0.1` and refuses to attach when port `19347` is
owned by an unexpected process.

The companion can read the contents of the currently rendered desktop client
page because that access is required to locate selected text and native branch
controls. Review the source before running it, keep the debugging endpoint local,
and do not expose port `19347` through a proxy, port forward, or firewall rule.

Branch metadata is stored locally in `branch-state.json`. It can contain quoted
conversation text and chat identifiers, so do not publish that file.

Please report vulnerabilities through GitHub's private vulnerability reporting
feature when it is enabled for the repository.
