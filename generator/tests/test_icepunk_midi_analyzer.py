from __future__ import annotations

import json
import runpy
from collections import Counter
from pathlib import Path
from types import SimpleNamespace

import pytest
from conftest import simple_track, write_midi_file
from mido import Message, MetaMessage

import icepunk_midi_analyzer as analyzer

ANALYZER_PATH = Path(analyzer.__file__)


# =========================
# HELPERS
# =========================


@pytest.mark.parametrize(
    ("pitch", "expected"),
    [(0, "C-1"), (21, "A0"), (60, "C4"), (61, "C#4"), (127, "G9")],
)
def test_pitch_to_name(pitch: int, expected: str) -> None:
    assert analyzer.pitch_to_name(pitch) == expected


def test_safe_round_returns_none_for_none() -> None:
    assert analyzer.safe_round(None) is None


def test_safe_round_uses_four_digits_by_default() -> None:
    assert analyzer.safe_round(1.234567) == 1.2346


def test_safe_round_respects_digits() -> None:
    assert analyzer.safe_round(1.234567, 2) == 1.23


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
    assert analyzer.bucket_velocity(velocity) == expected


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
    assert analyzer.bucket_duration_beats(duration) == expected


def test_estimate_key_returns_none_without_notes() -> None:
    assert analyzer.estimate_key_from_pitch_classes(Counter()) is None


def test_estimate_key_detects_c_major() -> None:
    # C major scale with emphasis on the C major triad
    counts = Counter({0: 10, 2: 3, 4: 8, 5: 3, 7: 9, 9: 3, 11: 2})

    assert analyzer.estimate_key_from_pitch_classes(counts) == "C major"


def test_estimate_key_detects_a_minor() -> None:
    # A natural minor scale with emphasis on the A minor triad
    counts = Counter({9: 10, 11: 3, 0: 8, 2: 3, 4: 9, 5: 3, 7: 2})

    assert analyzer.estimate_key_from_pitch_classes(counts) == "A minor"


# =========================
# MIDI PARSING
# =========================


def test_extract_notes_reads_notes_tracks_and_tempo(tmp_path: Path) -> None:
    path = write_midi_file(tmp_path / "song.mid", [simple_track("Lead")])

    mid, notes, tracks_info, tempo = analyzer.extract_notes_from_midi(path)

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
        analyzer.NoteEvent(
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
        analyzer.NoteEvent(
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

    _mid, notes, tracks_info, tempo = analyzer.extract_notes_from_midi(path)

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

    _mid, notes, tracks_info, _tempo = analyzer.extract_notes_from_midi(path)

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

    _mid, notes, _tracks, tempo = analyzer.extract_notes_from_midi(path)

    assert notes == []
    assert tempo == pytest.approx(80.0)  # average tempo 750000 us/beat


def test_extract_notes_ignores_note_messages_without_note_fields(monkeypatch) -> None:
    fake_message = SimpleNamespace(type="note_off", time=0)
    fake_midi = SimpleNamespace(ticks_per_beat=480, tracks=[[fake_message]])
    monkeypatch.setattr(analyzer, "MidiFile", lambda _path: fake_midi)

    _mid, notes, tracks_info, tempo = analyzer.extract_notes_from_midi(Path("x.mid"))

    assert notes == []
    assert tracks_info[0]["note_count"] == 0
    assert tempo is None


# =========================
# ANALYSIS
# =========================


def two_track_song(path: Path) -> Path:
    bass = [
        Message("note_on", note=40, velocity=80, channel=1, time=0),
        Message("note_off", note=40, velocity=0, channel=1, time=960),
    ]
    return write_midi_file(path, [simple_track("Lead"), bass])


def test_analyze_midi_file_computes_statistics(tmp_path: Path) -> None:
    path = two_track_song(tmp_path / "song.mid")

    result = analyzer.analyze_midi_file(path)

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
    assert result.estimated_key == analyzer.estimate_key_from_pitch_classes(
        Counter({4: 2, 0: 1})
    )
    assert [track["track_name"] for track in result.tracks] == ["Lead", "Track 1"]


def test_analyze_midi_file_without_notes(tmp_path: Path) -> None:
    path = write_midi_file(
        tmp_path / "empty.mid", [[MetaMessage("track_name", name="Empty", time=0)]]
    )

    result = analyzer.analyze_midi_file(path)

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

    result = analyzer.analyze_midi_file(path)

    assert result.note_count == 1
    assert result.rhythmic_density_notes_per_beat is None


def test_analyze_dataset_reports_missing_files(tmp_path: Path) -> None:
    result = analyzer.analyze_dataset(tmp_path)

    assert result == {
        "error": f"No MIDI files found in {tmp_path.resolve()}",
        "files": [],
    }


def test_analyze_dataset_summarizes_files_and_failures(tmp_path: Path, capsys) -> None:
    two_track_song(tmp_path / "a_song.mid")
    write_midi_file(tmp_path / "nested" / "b_empty.MIDI", [[]])
    (tmp_path / "c_broken.mid").write_bytes(b"not a midi file")
    (tmp_path / "notes.txt").write_text("ignored", encoding="utf-8")

    result = analyzer.analyze_dataset(tmp_path)

    summary = result["dataset_summary"]
    assert summary["total_files_found"] == 3
    assert summary["total_files_analyzed"] == 2
    assert summary["total_failed"] == 1
    assert summary["total_notes"] == 3
    assert summary["average_notes_per_file"] == 1.5
    assert summary["global_pitch_range"] == {"min": 40, "max": 64}
    assert summary["average_velocity_across_files"] == 76.67
    assert summary["average_duration_beats_across_files"] == 1.1667
    assert summary["average_rhythmic_density_notes_per_beat"] == 1.5
    assert sum(summary["common_estimated_keys"].values()) == 1

    assert [item["file_name"] for item in result["files"]] == [
        "a_song.mid",
        "b_empty.MIDI",
    ]
    assert result["failed_files"][0]["file"] == str(tmp_path / "c_broken.mid")
    assert result["failed_files"][0]["error"]

    output = capsys.readouterr().out
    assert "Analyzed: a_song.mid" in output
    assert "Failed: c_broken.mid" in output


def test_analyze_dataset_when_every_file_fails(tmp_path: Path) -> None:
    (tmp_path / "broken.mid").write_bytes(b"garbage")

    summary = analyzer.analyze_dataset(tmp_path)["dataset_summary"]

    assert summary["total_files_analyzed"] == 0
    assert summary["total_failed"] == 1
    assert summary["total_notes"] == 0
    assert summary["average_notes_per_file"] is None
    assert summary["common_estimated_keys"] == {}
    assert summary["global_pitch_range"] == {"min": None, "max": None}
    assert summary["average_velocity_across_files"] is None
    assert summary["average_duration_beats_across_files"] is None
    assert summary["average_rhythmic_density_notes_per_beat"] is None


# =========================
# MAIN
# =========================


def test_main_writes_analysis_and_prints_summary(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    monkeypatch.chdir(tmp_path)
    two_track_song(tmp_path / "midi_dataset" / "song.mid")

    analyzer.main()

    saved = json.loads(
        (tmp_path / "analysis_output" / "midi_analysis.json").read_text("utf-8")
    )
    assert saved["dataset_summary"]["total_files_analyzed"] == 1
    assert saved["files"][0]["file_name"] == "song.mid"

    output = capsys.readouterr().out
    assert "SUMMARY" in output
    assert "total_notes: 3" in output


def test_main_reports_empty_dataset(tmp_path: Path, monkeypatch, capsys) -> None:
    monkeypatch.chdir(tmp_path)

    analyzer.main()

    assert (tmp_path / "midi_dataset").is_dir()
    saved = json.loads(
        (tmp_path / "analysis_output" / "midi_analysis.json").read_text("utf-8")
    )
    assert saved["files"] == []
    assert "No MIDI files found" in capsys.readouterr().out


def test_running_as_script_calls_main(tmp_path: Path, monkeypatch, capsys) -> None:
    monkeypatch.chdir(tmp_path)

    runpy.run_path(str(ANALYZER_PATH), run_name="__main__")

    assert (tmp_path / "analysis_output" / "midi_analysis.json").is_file()
    assert "ICEPUNK MIDI ANALYZER" in capsys.readouterr().out
