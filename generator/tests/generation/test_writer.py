from __future__ import annotations

from pathlib import Path

import pytest
from conftest import (
    note,
)
from mido import MidiFile

from midistyle.config import (
    DEFAULT_TICKS_PER_BEAT,
)
from midistyle.generation import writer


@pytest.mark.parametrize(
    ("beat", "expected"), [(0.0, 0), (1.0, 480), (0.5, 240), (0.0011, 1)]
)
def test_beat_to_ticks(beat: float, expected: int) -> None:
    assert writer.beat_to_ticks(beat, 480) == expected


def test_write_midi_creates_playable_file(tmp_path: Path) -> None:
    path = tmp_path / "out.mid"
    notes = [
        note(64, start=1.0, duration=0.5, velocity=90),
        note(130, start=0.0, duration=0.0, velocity=0),  # clamped
    ]

    writer.write_midi(notes, path, bpm=120)

    mid = MidiFile(path)
    assert mid.ticks_per_beat == DEFAULT_TICKS_PER_BEAT
    messages = [m for m in mid.tracks[0] if m.type != "end_of_track"]
    assert [m.type for m in messages[:3]] == [
        "track_name",
        "set_tempo",
        "program_change",
    ]
    assert messages[1].tempo == 500000
    assert messages[2].program == 81
    assert [(m.type, m.note, m.velocity, m.time) for m in messages[3:]] == [
        ("note_on", 127, 1, 0),
        ("note_off", 127, 0, 1),  # minimum duration of one tick
        ("note_on", 64, 90, 479),
        ("note_off", 64, 0, 240),
    ]
