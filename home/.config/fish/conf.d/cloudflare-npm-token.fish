# Refresh the Cloudflare internal npm registry token when Fish starts.
set -gx NPM_TOKEN (cloudflared access login --no-verbose https://registry.cloudflare-ui.com)
