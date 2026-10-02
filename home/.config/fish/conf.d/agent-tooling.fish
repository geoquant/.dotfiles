# Use the portable clone adapter, not the Muster author's private helper path.
if not set -q MUSTER_WORKER_WORKTREE
    set -gx MUSTER_WORKER_WORKTREE "$HOME/.local/bin/muster-worker-worktree"
end
# Desk queues are built into Muster. An optional custom desk extension stays local.
