from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest
from conftest import (
    simple_track,
    write_midi_file,
)
from mido import Message, MetaMessage

from midistyle.analysis import reader


def test_extract_notes_reads_notes_tracks_and_tempo(tmp_path: Path) -> None:
    path = write_midi_file(tmp_path / "song.mid", [simple_track("Lead")])

    mid, notes, tracks_info, tempo = reader.extract_notes_from_midi(path)

    assert mid.ticks_per_beat == 480
    assert tempo == pytest.approx(120.0)
    assert tracks_info == [
        {
            "track_index": 0,
            "track_name": "Lead",
            "note_count": 2,
            "instruments": ["program_81_channel_0"],
        }
    ]
    assert notes == [
        reader.NoteEvent(
            pitch=60,
            pitch_name="C4",
            velocity=100,
            start_tick=0,
            end_tick=480,
            duration_ticks=480,
            start_beat=0.0,
            duration_beats=1.0,
            channel=0,
            track_index=0,
        ),
        reader.NoteEvent(
            pitch=64,
            pitch_name="E4",
            velocity=50,
            start_tick=480,
            end_tick=720,
            duration_ticks=240,
            start_beat=1.0,
            duration_beats=0.5,
            channel=0,
            track_index=0,
        ),
    ]


def test_extract_notes_without_tempo_or_name(tmp_path: Path) -> None:
    track = [
        Message("note_on", note=50, velocity=90, channel=2, time=0),
        Message("note_off", note=50, velocity=0, channel=2, time=960),
    ]
    path = write_midi_file(tmp_path / "plain.mid", [track])

    _mid, notes, tracks_info, tempo = reader.extract_notes_from_midi(path)

    assert tempo is None
    assert tracks_info[0]["track_name"] == "Track 0"
    assert tracks_info[0]["instruments"] == []
    assert [(n.pitch, n.channel, n.duration_beats) for n in notes] == [(50, 2, 2.0)]


def test_extract_notes_matches_overlapping_notes_in_order(tmp_path: Path) -> None:
    track = [
        Message("note_on", note=60, velocity=100, time=0),
        Message("note_on", note=60, velocity=80, time=240),
        Message("note_off", note=60, velocity=0, time=240),
        Message("note_off", note=60, velocity=0, time=240),
        # note_off without a matching note_on is ignored
        Message("note_off", note=62, velocity=0, time=0),
    ]
    path = write_midi_file(tmp_path / "overlap.mid", [track])

    _mid, notes, tracks_info, _tempo = reader.extract_notes_from_midi(path)

    assert [(n.start_tick, n.end_tick, n.velocity) for n in notes] == [
        (0, 480, 100),
        (240, 720, 80),
    ]
    assert tracks_info[0]["note_count"] == 2


def test_extract_notes_averages_multiple_tempos(tmp_path: Path) -> None:
    track = [
        MetaMessage("set_tempo", tempo=500000, time=0),  # 120 BPM
        MetaMessage("set_tempo", tempo=1000000, time=480),  # 60 BPM
    ]
    path = write_midi_file(tmp_path / "tempos.mid", [track])

    _mid, notes, _tracks, tempo = reader.extract_notes_from_midi(path)

    assert notes == []
    assert tempo == pytest.approx(80.0)  # average tempo 750000 us/beat


def test_extract_notes_ignores_note_messages_without_note_fields(monkeypatch) -> None:
    fake_message = SimpleNamespace(type="note_off", time=0)
    fake_midi = SimpleNamespace(ticks_per_beat=480, tracks=[[fake_message]])
    monkeypatch.setattr(reader, "MidiFile", lambda _path: fake_midi)

    _mid, notes, tracks_info, tempo = reader.extract_notes_from_midi(Path("x.mid"))

    assert notes == []
    assert tracks_info[0]["note_count"] == 0
    assert tempo is None
