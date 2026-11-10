from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import pytest
from conftest import (
    note_dict,
    sample_analysis,
)

from midistyle.config import (
    DEFAULT_BPM,
)
from midistyle.generation.style import Note, load_analysis, load_patterns

GENERATOR_DIR = Path(__file__).resolve().parents[2]


def test_load_analysis_reads_json(analysis_file: Path) -> None:
    assert load_analysis(analysis_file) == sample_analysis()


def test_load_analysis_fails_when_file_is_missing(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="Run analyzer first"):
        load_analysis(tmp_path / "missing.json")


def test_load_patterns_builds_patterns_and_style() -> None:
    patterns, style = load_patterns(sample_analysis())

    assert [p.source_file for p in patterns] == ["a.mid", "b.mid"]
    assert [p.note_count for p in patterns] == [8, 3]
    assert patterns[0].estimated_key == "A minor"
    assert patterns[0].register_distribution == {"bass": 2, "mid": 4, "top": 2}
    assert patterns[1].notes[0] == Note(
        pitch=64, velocity=100, start_beat=0.0, duration_beats=0.5, register="mid"
    )

    assert style["keys"] == Counter({"A minor": 1, "E minor": 1})
    assert style["rhythm_positions"] == Counter({"0.0": 3, "0.5": 1})
    assert style["registers"] == Counter({"bass": 2, "mid": 4, "top": 2})
    assert style["bpm"] == 145.0


def test_load_patterns_filters_and_fills_defaults() -> None:
    analysis = {
        "files": [
            {
                # no key, no tempo, no file name
                "patterns": [
                    {"notes": []},
                    {"notes": [note_dict(60, 0.0)]},  # too short
                    {"notes": [note_dict(60, i * 0.25) for i in range(41)]},  # too long
                    {"notes": [note_dict(40, 0.0), note_dict(80, 1.0, register="mid")]},
                ]
            }
        ]
    }

    patterns, style = load_patterns(analysis)

    assert len(patterns) == 1
    only = patterns[0]
    assert only.source_file == "unknown"
    assert only.estimated_key is None
    assert only.register_distribution == {}
    # register is detected when missing and kept when given
    assert [n.register for n in only.notes] == ["bass", "mid"]
    assert style["keys"] == Counter()
    assert style["bpm"] == DEFAULT_BPM


def test_load_patterns_requires_usable_patterns() -> None:
    with pytest.raises(ValueError, match="No usable patterns"):
        load_patterns({"files": [{"patterns": [{"notes": [note_dict(60, 0.0)]}]}]})


def test_load_patterns_without_files() -> None:
    with pytest.raises(ValueError, match="No usable patterns"):
        load_patterns({})


def test_analysis_file_shipped_with_generator_is_usable() -> None:
    analysis = json.loads(
        (GENERATOR_DIR / "analysis_output" / "midi_analysis.json").read_text(
            encoding="utf-8"
        )
    )

    patterns, style = load_patterns(analysis)

    assert patterns
    assert style["keys"]
