# Profile guard — committed to dotfiles, identical on every machine.
# Pairs with machine.fish (gitignored, per-machine) to keep work/personal
# AI accounts from ever crossing over.

if status is-interactive
    if not set -q MACHINE_PROFILE
        echo "⚠  MACHINE_PROFILE not set — create ~/.config/fish/conf.d/machine.fish (see setup-computer README)"
    end
end

function ai-whoami --description "Show which AI identity this machine uses and verify it"
    if not set -q MACHINE_PROFILE
        echo "profile:  UNSET — create ~/.config/fish/conf.d/machine.fish"
        return 1
    end
    echo "profile:  $MACHINE_PROFILE"
    echo "account:  $MACHINE_ACCOUNT"

    set -l auth ~/.pi/agent/auth.json
    if test -f $auth
        set -l actual (python3 -c "import json;print(json.load(open('$auth')).get('opencode',{}).get('key','')[:8])" 2>/dev/null)
        if test -z "$actual"
            echo "opencode: no key in auth.json (run /login in pi)"
        else if test "$actual" = "$OPENCODE_KEY_EXPECTED_PREFIX"
            echo "opencode: ✓ key matches this machine's $MACHINE_PROFILE identity ($actual…)"
        else
            echo "opencode: ✗ MISMATCH — auth.json key ($actual…) is not this machine's $MACHINE_PROFILE key!"
            echo "          Fix: run /logout then /login in pi with the $MACHINE_ACCOUNT account,"
            echo "          or update OPENCODE_KEY_EXPECTED_PREFIX in machine.fish if you rotated keys."
            return 1
        end
    else
        echo "opencode: no auth.json yet"
    end
end
