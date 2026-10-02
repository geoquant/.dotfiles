# Volume VI source and preservation audit

## Source

- User-supplied document: `Volume VI — The Prompt Architect.docx`.
- The second Downloads copy, `Volume VI — The Prompt Architect (1).docx`, has
  identical `word/document.xml` content.
- Original DOCX SHA-256:
  `49e5e849d90db3524e8683b26986535b7911e402e98e9b0f7cfb47a55919707b`.
- `word/document.xml` SHA-256:
  `59e459ce47551bf2a676d87f3c6a578d66e8c566f1989f4248236cbc87872842`.

## Canonical content

The complete guide is embedded directly in `SKILL.md`, between
`BEGIN COMPLETE VOLUME VI` and `END COMPLETE VOLUME VI`. The operating instructions
above that block are separately authored skill instructions; they are not part
of the original volume. The original DOCX remains in the user's Downloads folder.
Runtime skill use needs only the tracked Markdown files, not that local document.

This corrects the initial condensed implementation. No chapters, examples,
research percentages, philosophical passages, templates, or references were
removed from the source block. The missing charts in the chat paste were restored
from actual DOCX tables, not reconstructed from guesses.

## Conversion

The DOCX was read as an OpenXML ZIP archive. Its body was traversed in document
order, including all paragraphs and table cells. Every `w:t` text node was emitted
without editing its text. Explicit line breaks were retained. Document numbering
was rendered as Markdown numbered/bulleted lists. Headings and the two `SourceCode`
paragraphs were rendered as Markdown headings and fenced blocks. All hyperlink
labels and targets were retained. Tables were rendered as Markdown tables.

DOCX fonts, decorative rules, layout metadata, and bookmarks are not Markdown
content and were not copied. Text and table order are preserved; formatting syntax
is not a byte-for-byte reproduction of the DOCX binary.

## Checked invariants

- All **718 text nodes** emitted in the same order, unchanged.
- All **467 paragraphs**, including table-cell paragraphs, accounted for.
- All **4 tables** retained with their actual headers, rows, and cells:
  reasoning hierarchy, prompt/context comparison, prompt upgrade formula,
  and technique selection guide.
- All **67 hyperlink occurrences** retained with unchanged labels and targets;
  these include **66 numbered references** and one additional in-reference link.
- All **9 parts** and **19 chapters** retained.
- Both original prompt templates, the creed, the five security rules, and the
  closing reflection retained.
- Preserved Markdown source block: **58,691 UTF-8 bytes**.
- Preserved Markdown source block SHA-256:
  `9fd53d649cf0965ed00cceb1246388235a67507b95f117abe91802e36d56107f`.

These checks establish content preservation, not research accuracy. Numerical
claims, historical examples, and citation wording are preserved as supplied.
Any future fact-check notes or corrections should remain separate from this
source block unless the user explicitly requests a revised edition.
