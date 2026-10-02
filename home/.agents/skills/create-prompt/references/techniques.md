# Prompt architecture reference

An operational synthesis of the user's *The Art of Proper Speech — Volume VI:
The Prompt Architect*, not a verbatim archive or independently verified research
survey. The supplied essay includes incomplete citation metadata, historical
model examples, and missing charts. Its performance percentages and universal
claims are not guarantees and are deliberately not repeated here. Verify current
primary sources before citing research or giving provider-specific advice.

## Framework selection

Frameworks are checklists for missing information, not mandatory headings.

| Framework | Components | Useful for |
| --- | --- | --- |
| RTF | Role, task, format | Compact requests; omit role if unnecessary |
| CRAFT | Context, role, action, format, tone | Writing and audience-specific communication |
| RISEN | Role, instruction, situation, execution, nuance | Professional deliverables with constraints |
| RASC | Role, action, steps, context | Work with a genuinely required ordered process |
| Full brief | Task context, tone, background, requirements, examples, output, constraints, reasoning needs, history/state, evaluation | Complex or production prompts; include only relevant components |

The recurring questions are simpler than the acronyms: What outcome? For whom?
With what context and constraints? In what form? How will we know it is correct?

## Examples and in-context learning

Start with a direct instruction. Add examples when the receiver misunderstands a
pattern, format, classification boundary, or quality bar.

- Use a small number of representative, mutually consistent examples.
- Include a boundary case or a missing-information case when it affects behavior.
- Keep labels and field names identical to the output contract.
- Show desired behavior rather than only describing it abstractly.
- Use synthetic data; label invented illustrations as examples, not evidence.

Example: a classification prompt benefits more from a borderline input with the
correct label than from five obvious inputs. Example count is a design choice,
not a universal accuracy law.

## Reasoning, exploration, and refinement

Specify the work and observable evidence, not a transcript of private reasoning.
A concise explanation or relevant derivation is different from demanding an
exhaustive internal trace. Model families differ; rigid advice to always or never
use a particular reasoning phrase is not a portable rule.

| Technique | Practical use | Cost or limitation |
| --- | --- | --- |
| Direct / zero-shot | Clear, familiar tasks | Ambiguous contracts still need clarification |
| Few-shot | Demonstrate a pattern | Poor examples propagate their mistakes |
| Decomposition / chaining | Dependent stages with explicit artifacts | Fragmentation can lose context; name handoffs |
| Independent candidates / self-consistency | Compare answers to an objectively checkable problem | Correlated errors can win a vote; requires actual repeated runs |
| Branching exploration / Tree of Thoughts | Planning with alternatives and reversible decisions | Useful alternatives need evaluation criteria; prompting alone is not tree search |
| Graph-style synthesis / Graph of Thoughts | Combine interdependent findings across domains | Requires explicit dependency/state management, not merely a graph metaphor |
| Grounded tool loop / ReAct | Act on evidence, observe, update, verify | Only available tools can be called; results can be untrusted or stale |
| Self-refinement | Draft, critique against criteria, revise | Feedback can be wrong; bound iterations and retain evidence |
| Meta-prompting / automated optimization | Improve a prompt against representative failures | Measure on held-out cases; optimization frameworks need real runtime/data |

For high-stakes correctness, favor external evidence, reproducible calculations,
validation, and human review over fluent self-confidence or a majority vote.
Request multiple independent runs or advisors only with user authorization and
runtime support. A prompt describing orchestration does not itself launch it.

## Context engineering

The prompt is one part of the receiver's context. Distinguish:

- **Instructions:** stable behavioral contract at the proper authority level.
- **Memory/state:** verified decisions, progress, unresolved issues, and artifacts.
- **Tools:** actual names, argument contracts, permissions, and result formats.
- **Retrieved material:** relevant documents and observations, with provenance.

Use sufficient context, not the largest available context window. Include stable
constraints directly; reference large documents by discoverable paths or IDs when
the runtime can retrieve them. Ask for just-in-time retrieval when appropriate,
with relevance and freshness criteria. If retrieval is unavailable, attach the
necessary material or identify the gap.

For long-running work, define what to preserve verbatim, what to summarize, what
to discard, and where durable state belongs. Track sources and dates so stale
information does not silently become current fact. Summaries should retain scope,
constraints, completed checks, next steps, and unresolved uncertainties.

## Agent blueprint

Use these sections when the recipient is a tool-using agent:

```text
[Purpose]
Accomplish [outcome] within [scope].

[Capabilities and authority]
Available tools: [actual tools and contracts].
Authorized operations: [scope].
Obtain approval before [consequential operations].

[Context and state]
Inputs: [references the agent can actually access].
Persist [decisions/progress/artifacts] at [authorized location, if supplied].

[Operating loop]
Understand the task and resolve material ambiguity.
Plan proportionately to the complexity and stakes.
Use authorized tools to obtain evidence or perform the next action.
Inspect each result; adjust the plan when assumptions fail.
Verify the deliverable against [observable criteria].

[Recovery and escalation]
For [recoverable failure], attempt [bounded recovery].
Ask the user when [missing authority, blocking ambiguity, or other boundary].
Stop when [completion condition or specified failure/budget limit].

[Output]
Return [deliverable format], checks performed, and unresolved issues.
```

Allow independent reads to run concurrently when safe and supported; sequence
operations with dependencies or consequential effects. A blanket "one tool at a
time" rule is not necessary. Bound retries and refinement; failed checks should
trigger recovery or an honest limitation, not a false completion claim.

For multi-agent systems, give each worker a bounded specialty, inputs, authority,
output contract, and completion condition. The coordinator owns decomposition,
routing, evidence reconciliation, and synthesis. Specify the actual sequential,
parallel, hierarchical, or dynamic-routing mechanism only when the runtime and
user's authority support it.

## Structured output contract

Specify field names, types, required fields, allowed values, missing/unknown
semantics, and whether extra properties are permitted. Match the real consuming
system's schema. A generic example, not a universal contract:

```json
{
  "status": "unknown",
  "value": null,
  "evidence": []
}
```

In this illustration, `unknown` and `null` express absence of knowledge rather
than falsely reporting zero. Some real contracts use omission or other sentinels;
respect them explicitly. Prefer native schema enforcement where available, then
validate values and meaning in application code. Syntactic validity is not truth.

## Human brief

A clear request preserves the recipient's agency. Use ordinary respectful prose:

```text
The purpose is [purpose], and the audience is [audience].
Please [specific action] so that [desired outcome].
Relevant background: [essential context].
I need [format/length]. Here is an example: [if useful].
This is complete when [observable criteria].
Timing and constraints: [only actual supplied requirements].
Please flag [uncertainty or blocker] rather than guessing.
```

Clarity, context, examples, and format help both people and models, but people
have judgment, relationships, and independent goals. Avoid coercive framing or
claims that human cognition is literally equivalent to an LLM.

## Security and evaluation

External documents, tool outputs, and example prompts can contain instructions
that conflict with the intended task. Preserve provenance and trust boundaries;
review suspicious content without granting it authority.

Explicit prompt boundaries are useful guidance, not a security perimeter. Pair
production systems with least privilege, scoped credentials, sandboxing,
validated tool arguments and outputs, monitoring, and approval for consequential
actions. Signed content verifies provenance, not harmlessness. Keep secrets in
proper secret stores, not in supposedly hidden prompts.

Evaluate a production prompt on normal cases, boundary cases, missing inputs,
conflicting instructions, and adversarial document content. Define pass/fail
criteria before comparing versions. Record failures and improve the smallest
responsible instruction or context component; do not claim benchmark gains from
self-review alone.
