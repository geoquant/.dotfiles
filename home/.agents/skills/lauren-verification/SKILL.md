---
name: lauren-verification
description: Verify changed behavior through a running product, following Lauren Tan's feature-map and evidence approach. Use to design a project verification skill, build a feature map, or prove a user-visible change works.
---

# Behavior-level verification

Fork of the method in https://github.com/poteto/verification-skill-example
at d5abe70d0d8c671672b6cef4069363f26c488feb. The upstream Atlas app is fictional;
its driver is deliberately omitted. This skill never claims that driver exists.

1. Read the project's verification skill, feature map, and required checks. If
   absent, inspect its real entry points, scripts, tests, and supported driver.
   Load the relevant browser/desktop skill before controlling an app.
2. Run its doctor/build-freshness check. Verify instance ownership and isolation
   before interaction; keep the user's running instance and credentials intact.
3. Map the change to behavior, not files. For each affected feature, record:
   **Sub-features**, **How to get to it (user POV)**, **Driving it with the real
   harness**, and **Gotchas**. Name only commands the installed driver supports.
4. Exercise reachable user paths: trigger, stable end state, alternate entry
   points, enabled variants, success/cancel/error/empty, and persistence where
   affected. Use keyboard/menu/UI paths, not internal handlers as primary proof.
5. Wait for observable completion, not arbitrary sleeps. Check side effects as
   well as pixels: DOM attributes, file contents, network results, clipboard
   (only when authorized), or a reload/switch-away round trip.
6. Capture synthetic/redacted evidence with the trigger and stable outcome.
   A screenshot of an app opening or a passing typecheck alone is insufficient.
7. Report each requirement with its evidence, plus blockers and untested paths.
   Clean up only instances and artifacts created for this verification.

For a broad sweep, walk the project's feature index then cross-feature journeys.
The full reference example is cloned by `agent-tooling sync` at
`~/.local/share/agent-tooling/sources/poteto--verification-skill-example/`.
Read its `references/features/README.md` under `.cursor/skills/verify-atlas/`
when authoring a feature-map convention; adapt it to the actual product.
