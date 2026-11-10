from __future__ import annotations

import json
import runpy
from pathlib import Path

from conftest import (
    two_track_song,
)

import icepunk_midi_analyzer as analyzer

ANALYZER_PATH = Path(analyzer.__file__)


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
