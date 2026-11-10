from __future__ import annotations

import pytest

from midistyle import theory
from midistyle.config import GLOBAL_MAX_PITCH, GLOBAL_MIN_PITCH


@pytest.mark.parametrize(
    ("pitch", "expected"),
    [(0, "C-1"), (21, "A0"), (60, "C4"), (61, "C#4"), (127, "G9")],
)
def test_pitch_to_name(pitch: int, expected: str) -> None:
    assert theory.pitch_to_name(pitch) == expected


@pytest.mark.parametrize(
    ("key_name", "expected"),
    [
        (None, (9, "minor")),
        ("", (9, "minor")),
        ("C", (9, "minor")),
        ("C major", (0, "major")),
        ("F# minor", (6, "minor")),
        ("H major", (9, "major")),
        ("D lydian", (2, "minor")),
    ],
)
def test_parse_key(key_name: str | None, expected: tuple[int, str]) -> None:
    assert theory.parse_key(key_name) == expected


@pytest.mark.parametrize(
    ("pitch", "root", "mode", "expected"),
    [
        (60, 0, "major", True),  # C in C major
        (61, 0, "major", False),  # C# not in C major
        (63, 0, "minor", True),  # Eb in C minor
        (64, 0, "minor", False),  # E not in C minor
        (57, 9, "minor", True),  # A in A minor
    ],
)
def test_pitch_in_key(pitch: int, root: int, mode: str, expected: bool) -> None:
    assert theory.pitch_in_key(pitch, root, mode) is expected


def test_nearest_pitch_in_key_keeps_pitch_already_in_key() -> None:
    assert theory.nearest_pitch_in_key(64, 0, "major") == 64


def test_nearest_pitch_in_key_moves_to_closest_scale_note() -> None:
    # C# is between C and D; the lower candidate wins the tie
    assert theory.nearest_pitch_in_key(61, 0, "major") == 60
    # E is not in C minor; Eb (63) and F (65) tie, the lower one wins
    assert theory.nearest_pitch_in_key(64, 0, "minor") == 63


def test_nearest_pitch_in_key_clamps_to_global_range() -> None:
    assert theory.nearest_pitch_in_key(100, 0, "major") == GLOBAL_MAX_PITCH
    assert theory.nearest_pitch_in_key(10, 0, "major") == GLOBAL_MIN_PITCH


def test_nearest_pitch_in_key_returns_pitch_when_no_candidate(monkeypatch) -> None:
    monkeypatch.setattr(theory, "pitch_in_key", lambda *_args: False)

    assert theory.nearest_pitch_in_key(61, 0, "major") == 61


@pytest.mark.parametrize(
    ("pitch", "expected"),
    [(36, "bass"), (47, "bass"), (48, "mid"), (71, "mid"), (72, "top"), (84, "top")],
)
def test_detect_register(pitch: int, expected: str) -> None:
    assert theory.detect_register(pitch) == expected
