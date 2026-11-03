# Phase 3 — Python Generator Test Plan

Add automated tests for the MIDI generation engine (`icepunk_midi_generator.py`) and wire
them into CI. Goal: catch regressions in the generator before they reach the backend
subprocess call.

**Priority:** Medium · **Complexity:** Low · **Est. effort:** 1–2 days
**Prerequisite:** none blocking (no CI exists yet — this introduces the first workflow)

---

## Key facts discovered (read before starting)

- **Runtime dep:** only `mido==1.3.3` (`requirements.txt`). Tests need `pytest` — add a
  separate `requirements-dev.txt` rather than polluting the runtime file.
- **Python invocation differs by OS:** locally on Windows it's `python` (3.14.3); CI on
  `ubuntu-latest` uses `python3`. Pin CI to `actions/setup-python` with an explicit version
  (e.g. `3.12`) for reproducibility — do **not** rely on 3.14.
- **Import is safe:** `generate_midi_files()` is guarded by `if __name__ == "__main__"`, so
  `import icepunk_midi_generator` runs only the CONFIG block. The pure helpers can be unit
  tested directly via import.
- **Import-time globals are the main gotcha:** `ANALYSIS_FILE = Path("analysis_output/midi_analysis.json")`
  is **cwd-relative**, and `OUTPUT_DIR` is read from `sys.argv[1]` at import time. Therefore:
  - Pure-function unit tests: import the module, seed `random`, call functions — no I/O needed.
  - End-to-end smoke test: run the script **as a subprocess from repo root** so the relative
    analysis path resolves. Don't try to drive `generate_midi_files()` in-process.
- **Analysis fixture is committed:** `analysis_output/midi_analysis.json` (~870 KB, 51 files,
  1919 notes) is in the repo, so CI has real input with no extra setup.
- **Determinism:** the generator uses the global `random` module heavily. Seed with
  `random.seed(0)` in unit tests for stable assertions. The smoke test should assert on
  structural invariants (file count, non-empty, parseable), not exact note content.

---

## Proposed layout

```
tests/
  __init__.py
  conftest.py                 # shared fixtures (seeded RNG, repo-root path)
  test_helpers.py             # pure unit tests (parse_key, pitch_in_key, mutate_note, scoring)
  test_generation_smoke.py    # subprocess smoke test + missing-analysis test
requirements-dev.txt          # pytest (+ pinned version)
pytest.ini                    # testpaths = tests, quiet config
.github/workflows/python-test.yml
```

---

## Step 1 — Test scaffolding

1. Create `requirements-dev.txt`:
   ```
   -r requirements.txt
   pytest==8.*
   ```
2. Add `pytest.ini` (or `[tool.pytest.ini_options]` in a new `pyproject.toml`) setting
   `testpaths = tests`.
3. Create `tests/__init__.py` and `tests/conftest.py`. In `conftest.py`:
   - A fixture/autouse hook that calls `random.seed(0)` before each test.
   - A `repo_root` fixture returning the project root path (for the subprocess test).

## Step 2 — Unit tests for pure helpers (`tests/test_helpers.py`)

All importable and side-effect free. Suggested cases:

- **`parse_key`** — `"A minor"` → `(9, "minor")`; `"C# major"` → `(1, "major")`;
  `None`/empty/single-token → default `(9, "minor")`; unknown root → falls back to A;
  unknown mode → `"minor"`.
- **`pitch_in_key`** — note in/out of A-minor scale; verify mod-12 wrap; major vs minor differ.
- **`nearest_pitch_in_key`** — out-of-key pitch snaps to nearest in-key; result stays within
  `GLOBAL_MIN_PITCH..GLOBAL_MAX_PITCH` (36–84).
- **`detect_register`** — boundaries: 47→bass, 48→mid, 71→mid, 72→top.
- **`clamp` / `clamp_float` / `quantize_beat`** — boundary and rounding behaviour.
- **`mutate_note`** — with seeded RNG, output pitch stays in key & in global range; velocity
  clamped to 35–127; duration clamped to 0.125–4.0.
- **`score_generated_notes`** — empty list → `-9999.0`; a hand-built "good" pattern (bass+mid+top,
  range 12–42, varied pitches) scores higher than a degenerate one (single repeated pitch).
- **`write_midi`** — write to a `tmp_path` file from a small hand-built note list; reopen with
  `mido.MidiFile`, assert track exists, tempo meta present, note_on/note_off counts match.

## Step 3 — Smoke test (`tests/test_generation_smoke.py`)

Run the generator as a subprocess so the relative analysis path resolves:

```python
subprocess.run([sys.executable, "icepunk_midi_generator.py", str(tmp_path)],
               cwd=repo_root, check=True, capture_output=True, timeout=120)
```

Assertions:
- Exactly `GENERATE_COUNT` (10) `.mid` files produced.
- Each file is non-empty (`> 0` bytes).
- Each file opens cleanly with `mido.MidiFile(path)` (no corruption).
- Filenames match `generated_pattern_{n}_*.mid` for n = 1..10.

**Missing-analysis test:** run the subprocess from a `tmp_path` cwd that has **no**
`analysis_output/`, assert non-zero exit and that stderr contains the
`FileNotFoundError`/"Analysis file not found" message from `load_analysis()`.
(Note: the 50-attempt × 10-file loop can be slow; give the subprocess a generous timeout and
consider marking it `@pytest.mark.slow` so it can be excluded for fast local runs.)

## Step 4 — CI workflow (`.github/workflows/python-test.yml`)

```yaml
name: python-test
on:
  push: { branches: [main, dev] }
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: pip
      - run: pip install -r requirements-dev.txt
      - run: python -m py_compile icepunk_midi_generator.py   # syntax gate
      - run: python -m pytest tests/ -v
```

- `cache: pip` (built into `setup-python`) handles dependency caching — no manual cache step.
- Keep the smoke test in the same job; only split if runtime becomes a problem.

## Step 5 — Verify & document

- Run locally: `python -m pytest tests/ -v` (use `python`, not `python3`, on Windows).
- Confirm the workflow is green on a PR into `dev`.
- Add a short "Python engine tests" note to `CLAUDE.md` under the testing section.

---

## Open decisions to confirm next session

1. **`pytest.ini` vs `pyproject.toml`** for config — recommend a minimal `pytest.ini` to avoid
   introducing packaging assumptions.
2. **Whether to add the smoke test to CI now** (slower, ~real generation) vs unit-only first.
   Recommend including it but with a timeout + optional `slow` marker.
3. **CI trigger branches** — workflow above runs on `main`/`dev` and all PRs; confirm that
   matches the intended branch strategy.
