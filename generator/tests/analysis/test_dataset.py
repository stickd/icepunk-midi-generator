from __future__ import annotations

from pathlib import Path

from conftest import (
    two_track_song,
    write_midi_file,
)

from midistyle.analysis import dataset


def test_analyze_dataset_reports_missing_files(tmp_path: Path) -> None:
    result = dataset.analyze_dataset(tmp_path)

    assert result == {
        "error": f"No MIDI files found in {tmp_path.resolve()}",
        "files": [],
    }


def test_analyze_dataset_summarizes_files_and_failures(tmp_path: Path, capsys) -> None:
    two_track_song(tmp_path / "a_song.mid")
    write_midi_file(tmp_path / "nested" / "b_empty.MIDI", [[]])
    (tmp_path / "c_broken.mid").write_bytes(b"not a midi file")
    (tmp_path / "notes.txt").write_text("ignored", encoding="utf-8")

    result = dataset.analyze_dataset(tmp_path)

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

    summary = dataset.analyze_dataset(tmp_path)["dataset_summary"]

    assert summary["total_files_analyzed"] == 0
    assert summary["total_failed"] == 1
    assert summary["total_notes"] == 0
    assert summary["average_notes_per_file"] is None
    assert summary["common_estimated_keys"] == {}
    assert summary["global_pitch_range"] == {"min": None, "max": None}
    assert summary["average_velocity_across_files"] is None
    assert summary["average_duration_beats_across_files"] is None
    assert summary["average_rhythmic_density_notes_per_beat"] is None
