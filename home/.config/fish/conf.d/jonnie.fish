# Personal overrides — loaded after aliases.fish (alphabetical), so these win.

# eza/bat replacements for core utils
if command -q eza
    alias ls 'eza'
    alias la 'eza -la'
    alias ll 'eza -l'
    alias lt 'eza --tree'
end
if command -q bat
    alias cat 'bat'
end

# tmux
alias ks 'tmux kill-server'

# opencode
alias oc 'opencode'
# Disable automatic completion generation for oc to avoid errors
complete -c oc -e

# claude
alias claude 'claude --dangerously-skip-permissions'

# Dillon aliases npx/bunx to vpx (vite-plus); undo that if vpx isn't installed
if not command -q vpx
    functions -e npx 2>/dev/null
    functions -e bunx 2>/dev/null
end

# python -> python3
function python
    python3 $argv
end

# Extra paths
fish_add_path "$HOME/.bun/bin"
fish_add_path "$HOME/.cargo/bin"

# Chia
fish_add_path "/Applications/Chia.app/Contents/Resources/app.asar.unpacked/daemon"

# Coursier / JVM
set -gx JAVA_HOME "$HOME/Library/Caches/Coursier/arc/https/cdn.azul.com/zulu/bin/zulu21.46.19-ca-jdk21.0.9-macosx_aarch64.tar.gz/zulu21.46.19-ca-jdk21.0.9-macosx_aarch64"
fish_add_path "$HOME/Library/Application Support/Coursier/bin"
