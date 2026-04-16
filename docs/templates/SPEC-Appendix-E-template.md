## Appendix E: Context Slices

### E.1 Two-file model

Every task invocation receives:

1. `SPEC-MMM-universal.md` — §1 Objective · §2 Prior State · §3 Invariants · §7 Out of Scope · §8 Open Questions · Appendix D Discoveries
2. `SPEC-MMM-slice-TASK-NN.md` — assembled from tokens below

§4 (contracts), §5 (ACs), §6 (task hints), and Appendix E are excluded from the universal file. Universal content is never repeated in slice files.

### E.2 Extraction contract

Section boundaries in the source spec follow the pattern:

```
#### §4a-N. Title    →  ends at next ####, ###, or EOF
#### §4c-N. Title    →  ends at next ####, ###, or EOF
```

Slice blocks are delimited:

```
&lt;!-- SLICE:TASK-NN --&gt;
&lt;!-- /SLICE:TASK-NN --&gt;
```

**Regex — extract named slice:**

```
<!-- SLICE:(TASK-[\w]+) -->[\s\S]*?<!-- /SLICE:\1 -->
```

**Regex — extract SECTIONS tokens from a slice:**

```
^  (§[\w-:]+)
```

*(exactly two leading spaces; distinguishes tokens from prose)*

**Regex — extract a section from the source spec by token `§4a-3`:**

```
(?=#### §4a-3\ .)[\s\S]*?(?=#### |### |## |$)
```

**Regex — extract a single task hint from §6:**

```
\d+\.\s+\*\*\[TASK-NN\][\s\S]*?(?=\n\d+\.\s+\*\*\[TASK-|\n###\s|\n##\s|$)
```

### E.3 Token grammar

|Token|Matches|
|-|-|
|`§4a-N`|Single API endpoint section|
|`§4a-N:M`|§4a-N through §4a-M inclusive|
|`§4b-N`|Single schema migration section|
|`§4b-N:M`|§4b-N through §4b-M inclusive|
|`§4c-N`|Single component contract section|
|`§4d-N`|Single internal boundary section|
|`§4d-N:M`|§4d-N through §4d-M inclusive|
|`§4e`|Full dependency table|
|`§5:AC-NN`|Single AC row|
|`§5:AC-NN:MM`|AC rows NN through MM inclusive|
|`§6:TASK-NN`|Single task decomposition hint entry (prose line + metadata line)|

### E.4 Slice definitions

<!-- SLICE:TASK-01 -->

TASK:     TASK-01
LABEL:    (populated from Task Decomposition)
DEPENDS:  (none)
SECTIONS:
§4b-1:3
§5:AC-02:03
§6:TASK-01

<!-- /SLICE:TASK-01 -->

<!-- SLICE:TASK-02 -->

...

<!-- /SLICE:TASK-02 -->

...

<!-- END SPEC -->
