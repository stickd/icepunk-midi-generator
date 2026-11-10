from __future__ import annotations

from collections import Counter
from pathlib import Path

import pytest
from conftest import (
    two_track_song,
    write_midi_file,
)
from mido import Message, MetaMessage

from midistyle.analysis import stats


def test_safe_round_returns_none_for_none() -> None:
    assert stats.safe_round(None) is None


def test_safe_round_uses_four_digits_by_default() -> None:
    assert stats.safe_round(1.234567) == 1.2346


def test_safe_round_respects_digits() -> None:
    assert stats.safe_round(1.234567, 2) == 1.23


@pytest.mark.parametrize(
    ("velocity", "expected"),
    [
        (1, "very_soft_1_30"),
        (30, "very_soft_1_30"),
        (31, "soft_31_60"),
        (60, "soft_31_60"),
        (61, "medium_61_90"),
        (90, "medium_61_90"),
        (91, "hard_91_115"),
        (115, "hard_91_115"),
        (116, "very_hard_116_127"),
        (127, "very_hard_116_127"),
    ],
)
def test_bucket_velocity(velocity: int, expected: str) -> None:
    assert stats.bucket_velocity(velocity) == expected


@pytest.mark.parametrize(
    ("duration", "expected"),
    [
        (0.0, "very_short_<1/16"),
        (0.24, "very_short_<1/16"),
        (0.25, "short_1/16"),
        (0.49, "short_1/16"),
        (0.5, "medium_1/8"),
        (0.99, "medium_1/8"),
        (1.0, "long_1/4_to_1/2"),
        (1.99, "long_1/4_to_1/2"),
        (2.0, "very_long_1/2_to_bar"),
        (3.99, "very_long_1/2_to_bar"),
        (4.0, "sustained_>=bar"),
        (16.0, "sustained_>=bar"),
    ],
)
def test_bucket_duration_beats(duration: float, expected: str) -> None:
    assert stats.bucket_duration_beats(duration) == expected


def test_estimate_key_returns_none_without_notes() -> None:
    assert stats.estimate_key_from_pitch_classes(Counter()) is None


def test_estimate_key_detects_c_major() -> None:
    # C major scale with emphasis on the C major triad
    counts = Counter({0: 10, 2: 3, 4: 8, 5: 3, 7: 9, 9: 3, 11: 2})

    assert stats.estimate_key_from_pitch_classes(counts) == "C major"


def test_estimate_key_detects_a_minor() -> None:
    # A natural minor scale with emphasis on the A minor triad
    counts = Counter({9: 10, 11: 3, 0: 8, 2: 3, 4: 9, 5: 3, 7: 2})

    assert stats.estimate_key_from_pitch_classes(counts) == "A minor"


def test_analyze_midi_file_computes_statistics(tmp_path: Path) -> None:
    path = two_track_song(tmp_path / "song.mid")

    result = stats.analyze_midi_file(path)

    assert result.file_name == "song.mid"
    assert result.path == str(path)
    assert result.ticks_per_beat == 480
    assert result.tempo_bpm_estimate == 120.0
    assert result.note_count == 3
    assert result.unique_pitches == [40, 60, 64]
    assert result.pitch_range == {"min": 40, "max": 64}
    assert result.average_pitch == 54.67
    assert result.average_velocity == 76.67
    assert result.average_duration_beats == 1.1667
    assert result.median_duration_beats == 1.0
    assert result.most_common_pitches == [
        {"pitch": 40, "name": "E2", "count": 1},
        {"pitch": 60, "name": "C4", "count": 1},
        {"pitch": 64, "name": "E4", "count": 1},
    ]
    assert result.pitch_class_distribution["C"] == 1
    assert result.pitch_class_distribution["E"] == 2
    assert sum(result.pitch_class_distribution.values()) == 3
    assert result.velocity_distribution == {
        "hard_91_115": 1,
        "medium_61_90": 1,
        "soft_31_60": 1,
    }
    assert result.duration_distribution_beats == {
        "long_1/4_to_1/2": 1,
        "medium_1/8": 1,
        "very_long_1/2_to_bar": 1,
    }
    # 40 -> 60 crosses tracks and is skipped; 60 -> 64 is on the same track
    assert result.interval_distribution == {"4": 1}
    assert result.rhythmic_density_notes_per_beat == 1.5
    assert result.estimated_key == stats.estimate_key_from_pitch_classes(
        Counter({4: 2, 0: 1})
    )
    assert [track["track_name"] for track in result.tracks] == ["Lead", "Track 1"]


def test_analyze_midi_file_without_notes(tmp_path: Path) -> None:
    path = write_midi_file(
        tmp_path / "empty.mid", [[MetaMessage("track_name", name="Empty", time=0)]]
    )

    result = stats.analyze_midi_file(path)

    assert result.note_count == 0
    assert result.tempo_bpm_estimate is None
    assert result.unique_pitches == []
    assert result.pitch_range == {"min": None, "max": None}
    assert result.average_pitch is None
    assert result.average_velocity is None
    assert result.average_duration_beats is None
    assert result.median_duration_beats is None
    assert result.most_common_pitches == []
    assert result.velocity_distribution == {}
    assert result.duration_distribution_beats == {}
    assert result.interval_distribution == {}
    assert result.rhythmic_density_notes_per_beat is None
    assert result.estimated_key is None


def test_analyze_midi_file_with_zero_length_song(tmp_path: Path) -> None:
    track = [
        Message("note_on", note=60, velocity=100, time=0),
        Message("note_off", note=60, velocity=0, time=0),
    ]
    path = write_midi_file(tmp_path / "zero.mid", [track])

    result = stats.analyze_midi_file(path)

    assert result.note_count == 1
    assert result.rhythmic_density_notes_per_beat is None
