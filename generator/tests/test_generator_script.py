from __future__ import annotations

import importlib
import random
import runpy
import sys
from pathlib import Path

from conftest import (
    note,
)
from mido import MidiFile

import icepunk_midi_generator as gen

GENERATOR_PATH = Path(gen.__file__)


def test_output_dir_defaults_to_generated_midi(monkeypatch) -> None:
    monkeypatch.setattr(sys, "argv", ["icepunk_midi_generator.py"])

    try:
        assert importlib.reload(gen).OUTPUT_DIR == Path("generated_midi")
    finally:
        importlib.reload(gen)


def test_output_dir_comes_from_first_argument(monkeypatch) -> None:
    monkeypatch.setattr(sys, "argv", ["icepunk_midi_generator.py", "/tmp/out"])

    try:
        assert importlib.reload(gen).OUTPUT_DIR == Path("/tmp/out")
    finally:
        importlib.reload(gen)


def test_clear_output_folder_removes_only_midi_files(
    monkeypatch, tmp_path: Path
) -> None:
    output = tmp_path / "nested" / "out"
    output.mkdir(parents=True)
    (output / "old.mid").write_bytes(b"")
    (output / "old.MIDI").write_bytes(b"")
    (output / "keep.txt").write_text("keep", encoding="utf-8")
    (output / "folder.mid").mkdir()
    monkeypatch.setattr(gen, "OUTPUT_DIR", output)

    gen.clear_output_folder()

    assert sorted(p.name for p in output.iterdir()) == ["folder.mid", "keep.txt"]


def test_clear_output_folder_creates_missing_folder(
    monkeypatch, tmp_path: Path
) -> None:
    output = tmp_path / "a" / "b"
    monkeypatch.setattr(gen, "OUTPUT_DIR", output)

    gen.clear_output_folder()

    assert output.is_dir()


def test_generate_midi_files_writes_requested_count(
    monkeypatch, tmp_path: Path, analysis_file: Path, capsys
) -> None:
    output = tmp_path / "out"
    output.mkdir()
    (output / "stale.mid").write_bytes(b"")
    monkeypatch.setattr(gen, "ANALYSIS_FILE", analysis_file)
    monkeypatch.setattr(gen, "OUTPUT_DIR", output)
    monkeypatch.setattr(gen, "GENERATE_COUNT", 2)
    random.seed(1)

    gen.generate_midi_files()

    files = sorted(p.name for p in output.iterdir())
    assert len(files) == 2
    assert files[0].startswith("generated_pattern_1_")
    assert files[1].startswith("generated_pattern_2_")
    for name in files:
        assert MidiFile(output / name).tracks[0]

    output_text = capsys.readouterr().out
    assert "Patterns loaded: 2" in output_text
    assert "BPM: 145.0" in output_text
    assert output_text.rstrip().endswith("Done.")


def test_generate_midi_files_names_sharp_keys(
    monkeypatch, tmp_path: Path, analysis_file
) -> None:
    monkeypatch.setattr(gen, "ANALYSIS_FILE", analysis_file)
    monkeypatch.setattr(gen, "OUTPUT_DIR", tmp_path / "out")
    monkeypatch.setattr(gen, "GENERATE_COUNT", 1)
    monkeypatch.setattr(
        gen,
        "generate_best_notes",
        lambda *_args, **_kwargs: ([note(61)], "C# minor", 1.0),
    )

    gen.generate_midi_files()

    assert [p.name for p in (tmp_path / "out").iterdir()] == [
        "generated_pattern_1_Csharp_minor.mid"
    ]


def test_running_as_script_generates_into_argument_folder(
    monkeypatch, tmp_path: Path, analysis_file: Path, capsys
) -> None:
    output = tmp_path / "result"
    monkeypatch.chdir(analysis_file.parent.parent)
    monkeypatch.setattr(sys, "argv", ["icepunk_midi_generator.py", str(output)])

    runpy.run_path(str(GENERATOR_PATH), run_name="__main__")

    assert len(list(output.glob("*.mid"))) == 10
    assert "Done." in capsys.readouterr().out
