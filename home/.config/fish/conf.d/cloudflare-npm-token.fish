# Refresh the Cloudflare internal npm registry token when Fish starts — work machines only.
# conf.d loads alphabetically, so machine.fish (MACHINE_PROFILE) hasn't run yet: read it first.
if not set -q MACHINE_PROFILE; and test -f ~/.config/fish/conf.d/machine.fish
    source ~/.config/fish/conf.d/machine.fish
end

if test "$MACHINE_PROFILE" = work; and command -q cloudflared
    set -gx NPM_TOKEN (cloudflared access login --no-verbose https://registry.cloudflare-ui.com)
end
