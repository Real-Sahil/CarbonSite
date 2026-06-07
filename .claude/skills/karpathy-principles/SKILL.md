# Karpathy-Inspired Coding Principles

Source: https://github.com/multica-ai/andrej-karpathy-skills

Four principles for reducing common LLM coding mistakes, inspired by Andrej Karpathy's observation that models "make wrong assumptions on your behalf and just run along with them without checking" and tend to "overcomplicate code and APIs."

## 1. Think Before Coding

Surface assumptions and confusion — never hide them.

- If the task has multiple valid interpretations, present them before picking one
- Ask one targeted clarifying question rather than making a silent assumption
- State what success looks like before writing the first line
- If the context is ambiguous (e.g. "fix the bug"), diagnose first, then act

**Applies to CarbonSite:** Before implementing a calculation, state the formula interpretation. Before touching auth middleware, confirm the role boundary.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No unrequested features
- No premature abstractions (a helper function for one caller is not a helper — it's overhead)
- No "future-proofing" unless explicitly asked
- Three similar lines are better than a clever abstraction that adds cognitive load

**Applies to CarbonSite:** The calculation engine must be readable by an auditor, not a software engineer. If simplicity and cleverness conflict, simplicity wins.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

- When modifying existing code, match the current style exactly
- Only remove code that your change rendered obsolete — not pre-existing dead code
- Do not refactor surrounding areas when fixing a bug
- Do not rename variables that are outside the scope of the task

**Applies to CarbonSite:** A fix to `factor-selector.ts` does not justify cleaning up `units.ts`. Scope is king.

## 4. Goal-Driven Execution

Define verifiable success criteria before starting. Loop until verified.

- Translate vague instructions ("make it work") into concrete, checkable outcomes
- For any non-trivial change, write the test assertion before the implementation
- After implementing, verify against the original criteria — not just "it compiles"
- If verification reveals a gap, fix and re-verify rather than declaring partial success

**Applies to CarbonSite:** A calculation change is not done until: unit test passes with the correct CO2e value AND the published snapshot immutability invariant is confirmed unbroken.
