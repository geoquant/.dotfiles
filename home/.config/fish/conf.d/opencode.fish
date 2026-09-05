# OpenCode experimental features
set -gx OPENCODE_EXPERIMENTAL_LSP_TOOL 1
set -gx OPENCODE_EXPERIMENTAL_PLAN_MODE 1
set -gx OPENCODE_ENABLE_EXA 1

# Do not hardcode OPENCODE_API_KEY here.
# pi reads ~/.pi/agent/auth.json, which resolves $OPENCODE_API_KEY from
# the current environment so personal/work auth can be selected by the caller.
