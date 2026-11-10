from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

import pytest
from mido import Message, MetaMessage, MidiFile, MidiTrack

from midistyle.generation.style import Note, SourcePattern
from midistyle.theory import detect_register


def write_midi_file(
    path: Path, tracks: list[list[Any]], ticks_per_beat: int = 480
) -> Path:
    """Write a MIDI file where each inner list holds the messages of one track."""
    path.parent.mkdir(parents=True, exist_ok=True)
    mid = MidiFile(ticks_per_beat=ticks_per_beat)

    for messages in tracks:
        track = MidiTrack()
        track.extend(messages)
        mid.tracks.append(track)

    mid.save(path)
    return path


def note_dict(
    pitch: int,
    start: float,
    duration: float = 0.5,
    velocity: int = 100,
    register: str | None = None,
) -> dict[str, Any]:
    """A note in the shape the generator reads from midi_analysis.json."""
    note: dict[str, Any] = {
        "pitch": pitch,
        "velocity": velocity,
        "relative_start_beat": start,
        "duration_beats": duration,
    }

    if register is not None:
        note["register"] = register

    return note


def sample_analysis() -> dict[str, Any]:
    """A small analysis document with patterns covering all three registers."""
    return {
        "files": [
            {
                "file_name": "a.mid",
                "estimated_key": "A minor",
                "tempo_bpm_estimate": 140.0,
                "rhythm_position_distribution": {"0.0": 3, "0.5": 1},
                "register_distribution": {"bass": 2, "mid": 4, "top": 2},
                "patterns": [
                    {
                        "register_distribution": {"bass": 2, "mid": 4, "top": 2},
                        "notes": [
                            note_dict(45, 0.0, register="bass"),
                            note_dict(45, 2.0, register="bass"),
                            note_dict(57, 0.0, register="mid"),
                            note_dict(60, 0.5, register="mid"),
                            note_dict(64, 1.0, register="mid"),
                            note_dict(67, 1.5, register="mid"),
                            note_dict(76, 2.0, register="top"),
                            note_dict(79, 3.0, register="top"),
                        ],
                    }
                ],
            },
            {
                "file_name": "b.mid",
                "estimated_key": "E minor",
                "tempo_bpm_estimate": 150.0,
                "patterns": [
                    {
                        "register_distribution": {"mid": 3},
                        "notes": [
                            note_dict(64, 0.0, register="mid"),
                            note_dict(66, 1.0, register="mid"),
                            note_dict(67, 2.0, register="mid"),
                        ],
                    }
                ],
            },
        ]
    }


@pytest.fixture
def analysis_file(tmp_path: Path) -> Path:
    path = tmp_path / "analysis_output" / "midi_analysis.json"
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps(sample_analysis()), encoding="utf-8")
    return path


def simple_track(name: str = "Lead") -> list[Any]:
    """One track: tempo 120 BPM, two sequential notes on channel 0."""
    return [
        MetaMessage("track_name", name=name, time=0),
        MetaMessage("set_tempo", tempo=500000, time=0),
        Message("program_change", program=81, channel=0, time=0),
        Message("note_on", note=60, velocity=100, channel=0, time=0),
        Message("note_off", note=60, velocity=0, channel=0, time=480),
        Message("note_on", note=64, velocity=50, channel=0, time=0),
        Message("note_on", note=64, velocity=0, channel=0, time=240),
    ]


def two_track_song(path: Path) -> Path:
    """A lead track from simple_track plus a bass note on channel 1."""
    bass = [
        Message("note_on", note=40, velocity=80, channel=1, time=0),
        Message("note_off", note=40, velocity=0, channel=1, time=960),
    ]
    return write_midi_file(path, [simple_track("Lead"), bass])


def note(
    pitch: int,
    start: float = 0.0,
    duration: float = 0.5,
    velocity: int = 100,
    register: str | None = None,
) -> Note:
    return Note(
        pitch=pitch,
        velocity=velocity,
        start_beat=start,
        duration_beats=duration,
        register=register or detect_register(pitch),
    )


def pattern(
    notes: list[Note],
    key: str | None = "C major",
    registers: dict[str, int] | None = None,
) -> SourcePattern:
    return SourcePattern(
        notes=notes,
        source_file="test.mid",
        estimated_key=key,
        note_count=len(notes),
        register_distribution=registers or {},
    )


@pytest.fixture
def no_randomness(monkeypatch):
    """random.random() == 0.5: every layer is used and no mutation fires."""
    monkeypatch.setattr(random, "random", lambda: 0.5)
