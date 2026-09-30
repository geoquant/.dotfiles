function install-uidotsh -d "Install global ui.sh skills using a private, user-supplied token"
    if test (count $argv) -gt 1
        echo 'Usage: install-uidotsh [--force]' >&2
        return 2
    end
    for argument in $argv
        if test "$argument" != --force
            echo 'Usage: install-uidotsh [--force]' >&2
            return 2
        end
    end

    if not set -q UIDOTSH_TOKEN; or test -z "$UIDOTSH_TOKEN"; or test "$UIDOTSH_TOKEN" = REPLACE_WITH_YOUR_UI_SH_TOKEN
        echo 'ui.sh token required: set UIDOTSH_TOKEN in your gitignored secrets.fish (see UPDATING.md).' >&2
        return 1
    end

    # Paid content must stay in the private skills tree, never the public repo.
    for skill in add-dark-mode brand-kit canonicalize-tailwind componentize dark-mode-image design ideas make-responsive markup-from-image
        if not test -L "$HOME/.agents/skills/$skill"; or not test -d "$HOME/.agents/skills/$skill"
            echo "ui.sh skill link missing: $skill. Restore the private skills and Stow links first (see UPDATING.md)." >&2
            return 1
        end
    end

    # Codex selects the shared ~/.agents/skills location, also used by other agents.
    command npx --yes @uidotsh/install --scope=global --agent=codex --all-skills --token="$UIDOTSH_TOKEN" $argv
end
