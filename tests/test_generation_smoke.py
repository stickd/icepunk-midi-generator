"""
Smoke tests for icepunk_midi_generator.py.

Run the script as a subprocess so that cwd-relative paths (ANALYSIS_FILE,
OUTPUT_DIR) resolve correctly against the repo root.
"""
import re
import subprocess
import sys
from pathlib import Path

import mido
import pytest

GENERATOR = "icepunk_midi_generator.py"
GENERATE_COUNT = 10
FILENAME_RE = re.compile(r"^generated_pattern_\d+_.+\.mid$")


def run_generator(repo_root: Path, output_dir: Path, *, timeout: int = 120) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, GENERATOR, str(output_dir)],
        cwd=repo_root,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


@pytest.mark.slow
def test_generates_correct_number_of_files(repo_root, tmp_path):
    result = run_generator(repo_root, tmp_path)
    assert result.returncode == 0, f"Generator failed:\n{result.stderr}"

    mid_files = list(tmp_path.glob("*.mid"))
    assert len(mid_files) == GENERATE_COUNT, (
        f"Expected {GENERATE_COUNT} .mid files, got {len(mid_files)}"
    )


@pytest.mark.slow
def test_generated_files_are_non_empty(repo_root, tmp_path):
    result = run_generator(repo_root, tmp_path)
    assert result.returncode == 0, f"Generator failed:\n{result.stderr}"

    for path in tmp_path.glob("*.mid"):
        assert path.stat().st_size > 0, f"{path.name} is empty"


@pytest.mark.slow
def test_generated_files_are_valid_midi(repo_root, tmp_path):
    result = run_generator(repo_root, tmp_path)
    assert result.returncode == 0, f"Generator failed:\n{result.stderr}"

    for path in sorted(tmp_path.glob("*.mid")):
        mid = mido.MidiFile(str(path))
        assert len(mid.tracks) > 0, f"{path.name} has no tracks"


@pytest.mark.slow
def test_generated_filenames_match_expected_pattern(repo_root, tmp_path):
    result = run_generator(repo_root, tmp_path)
    assert result.returncode == 0, f"Generator failed:\n{result.stderr}"

    for path in tmp_path.glob("*.mid"):
        assert FILENAME_RE.match(path.name), (
            f"Unexpected filename: {path.name!r}"
        )

    indices_found = sorted(
        int(re.match(r"generated_pattern_(\d+)_", p.name).group(1))
        for p in tmp_path.glob("*.mid")
    )
    assert indices_found == list(range(1, GENERATE_COUNT + 1)), (
        f"Missing or duplicate pattern indices: {indices_found}"
    )


def test_missing_analysis_file_exits_with_error(repo_root, tmp_path):
    """Script must exit non-zero and report FileNotFoundError when analysis JSON is absent."""
    # Run from a temp dir that has no analysis_output/ subfolder
    result = subprocess.run(
        [sys.executable, str(repo_root / GENERATOR), str(tmp_path / "out")],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        timeout=30,
    )

    assert result.returncode != 0, "Expected non-zero exit when analysis file is missing"
    combined = result.stdout + result.stderr
    assert "Analysis file not found" in combined or "FileNotFoundError" in combined, (
        f"Expected actionable error message, got:\n{combined}"
    )
