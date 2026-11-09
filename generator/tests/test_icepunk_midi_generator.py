from __future__ import annotations

import importlib
import json
import random
import runpy
import sys
from collections import Counter
from pathlib import Path

import pytest
from conftest import note_dict, sample_analysis
from mido import MidiFile

import icepunk_midi_generator as gen

GENERATOR_PATH = Path(gen.__file__)


def note(
    pitch: int,
    start: float = 0.0,
    duration: float = 0.5,
    velocity: int = 100,
    register: str | None = None,
) -> gen.Note:
    return gen.Note(
        pitch=pitch,
        velocity=velocity,
        start_beat=start,
        duration_beats=duration,
        register=register or gen.detect_register(pitch),
    )


def pattern(
    notes: list[gen.Note],
    key: str | None = "C major",
    registers: dict[str, int] | None = None,
) -> gen.SourcePattern:
    return gen.SourcePattern(
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


# =========================
# CONFIG
# =========================


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


# =========================
# BASIC HELPERS
# =========================


@pytest.mark.parametrize(("value", "expected"), [(-5, 0), (5, 5), (15, 10)])
def test_clamp(value: int, expected: int) -> None:
    assert gen.clamp(value, 0, 10) == expected


@pytest.mark.parametrize(("value", "expected"), [(-0.5, 0.0), (1.5, 1.5), (3.0, 2.0)])
def test_clamp_float(value: float, expected: float) -> None:
    assert gen.clamp_float(value, 0.0, 2.0) == expected


@pytest.mark.parametrize(
    ("beat", "expected"), [(0.0, 0), (1.0, 480), (0.5, 240), (0.0011, 1)]
)
def test_beat_to_ticks(beat: float, expected: int) -> None:
    assert gen.beat_to_ticks(beat, 480) == expected


def test_quantize_beat_uses_sixteenth_grid_by_default() -> None:
    assert gen.quantize_beat(0.3) == 0.25
    assert gen.quantize_beat(0.4) == 0.5


def test_quantize_beat_with_custom_grid() -> None:
    assert gen.quantize_beat(0.7, grid=0.5) == 0.5


def test_weighted_choice_rejects_empty_counter() -> None:
    with pytest.raises(ValueError, match="empty counter"):
        gen.weighted_choice(Counter())


def test_weighted_choice_uses_counts_as_weights(monkeypatch) -> None:
    calls = []

    def fake_choices(values, weights, k):
        calls.append((values, weights, k))
        return [values[-1]]

    monkeypatch.setattr(random, "choices", fake_choices)

    assert gen.weighted_choice(Counter({"a": 0, "b": 5})) == "b"
    # zero counts still get weight 1
    assert calls == [(["a", "b"], [1, 5], 1)]


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
    assert gen.parse_key(key_name) == expected


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
    assert gen.pitch_in_key(pitch, root, mode) is expected


def test_nearest_pitch_in_key_keeps_pitch_already_in_key() -> None:
    assert gen.nearest_pitch_in_key(64, 0, "major") == 64


def test_nearest_pitch_in_key_moves_to_closest_scale_note() -> None:
    # C# is between C and D; the lower candidate wins the tie
    assert gen.nearest_pitch_in_key(61, 0, "major") == 60
    # E is not in C minor; Eb (63) and F (65) tie, the lower one wins
    assert gen.nearest_pitch_in_key(64, 0, "minor") == 63


def test_nearest_pitch_in_key_clamps_to_global_range() -> None:
    assert gen.nearest_pitch_in_key(100, 0, "major") == gen.GLOBAL_MAX_PITCH
    assert gen.nearest_pitch_in_key(10, 0, "major") == gen.GLOBAL_MIN_PITCH


def test_nearest_pitch_in_key_returns_pitch_when_no_candidate(monkeypatch) -> None:
    monkeypatch.setattr(gen, "pitch_in_key", lambda *_args: False)

    assert gen.nearest_pitch_in_key(61, 0, "major") == 61


@pytest.mark.parametrize(
    ("pitch", "expected"),
    [(36, "bass"), (47, "bass"), (48, "mid"), (71, "mid"), (72, "top"), (84, "top")],
)
def test_detect_register(pitch: int, expected: str) -> None:
    assert gen.detect_register(pitch) == expected


# =========================
# LOAD STYLE DNA
# =========================


def test_load_analysis_reads_json(monkeypatch, analysis_file: Path) -> None:
    monkeypatch.setattr(gen, "ANALYSIS_FILE", analysis_file)

    assert gen.load_analysis() == sample_analysis()


def test_load_analysis_fails_when_file_is_missing(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(gen, "ANALYSIS_FILE", tmp_path / "missing.json")

    with pytest.raises(FileNotFoundError, match="Run analyzer first"):
        gen.load_analysis()


def test_load_patterns_builds_patterns_and_style() -> None:
    patterns, style = gen.load_patterns(sample_analysis())

    assert [p.source_file for p in patterns] == ["a.mid", "b.mid"]
    assert [p.note_count for p in patterns] == [8, 3]
    assert patterns[0].estimated_key == "A minor"
    assert patterns[0].register_distribution == {"bass": 2, "mid": 4, "top": 2}
    assert patterns[1].notes[0] == gen.Note(
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

    patterns, style = gen.load_patterns(analysis)

    assert len(patterns) == 1
    only = patterns[0]
    assert only.source_file == "unknown"
    assert only.estimated_key is None
    assert only.register_distribution == {}
    # register is detected when missing and kept when given
    assert [n.register for n in only.notes] == ["bass", "mid"]
    assert style["keys"] == Counter()
    assert style["bpm"] == gen.DEFAULT_BPM


def test_load_patterns_requires_usable_patterns() -> None:
    with pytest.raises(ValueError, match="No usable patterns"):
        gen.load_patterns({"files": [{"patterns": [{"notes": [note_dict(60, 0.0)]}]}]})


def test_load_patterns_without_files() -> None:
    with pytest.raises(ValueError, match="No usable patterns"):
        gen.load_patterns({})


# =========================
# PATTERN SELECTION
# =========================


def test_choose_target_key_uses_style_keys(monkeypatch) -> None:
    monkeypatch.setattr(gen, "weighted_choice", lambda counter: max(counter))

    assert (
        gen.choose_target_key({"keys": Counter({"E minor": 3, "A minor": 1})})
        == "E minor"
    )


def test_choose_target_key_defaults_to_a_minor() -> None:
    assert gen.choose_target_key({"keys": Counter()}) == "A minor"


def test_choose_pattern_by_register_prefers_matching_patterns() -> None:
    bass = pattern([note(40)], registers={"bass": 1})
    top = pattern([note(80)], registers={"top": 1, "bass": 0})

    for _ in range(20):
        assert gen.choose_pattern_by_register([bass, top], "bass") is bass


def test_choose_pattern_by_register_falls_back_to_any_pattern(monkeypatch) -> None:
    patterns = [pattern([note(60)]), pattern([note(62)])]
    monkeypatch.setattr(random, "choice", lambda items: items[-1])

    assert gen.choose_pattern_by_register(patterns, "top") is patterns[-1]


def test_transpose_note_to_key_without_octave_shift(no_randomness) -> None:
    result = gen.transpose_note_to_key(
        note(60, start=1.0, velocity=90), "C major", "D minor"
    )

    assert result == gen.Note(
        pitch=62, velocity=90, start_beat=1.0, duration_beats=0.5, register="mid"
    )


def test_transpose_note_to_key_snaps_to_target_scale(no_randomness) -> None:
    # E (64) moved up a whole tone is F# (66), which is not in D minor -> F (65)
    assert gen.transpose_note_to_key(note(64), "C major", "D minor").pitch == 65


def test_transpose_note_to_key_with_octave_shift(monkeypatch) -> None:
    monkeypatch.setattr(random, "random", lambda: 0.0)
    monkeypatch.setattr(random, "choice", lambda items: items[-1])

    result = gen.transpose_note_to_key(note(60), "C major", "D minor")

    assert result.pitch == 74
    assert result.register == "top"


def test_mutate_note_applies_every_mutation(monkeypatch) -> None:
    monkeypatch.setattr(random, "random", lambda: 0.0)
    monkeypatch.setattr(random, "choice", lambda items: items[-1])
    monkeypatch.setattr(random, "randint", lambda low, high: high)

    result = gen.mutate_note(
        note(60, start=1.0, duration=10.0, velocity=120), "C major"
    )

    assert result == gen.Note(
        pitch=67,  # +7 semitones, G is in C major
        velocity=127,  # 120 + 10 clamped
        start_beat=1.25,  # nudged by a sixteenth
        duration_beats=4.0,  # clamped
        register="mid",
    )


def test_mutate_note_keeps_start_inside_loop(monkeypatch) -> None:
    monkeypatch.setattr(random, "random", lambda: 0.0)
    monkeypatch.setattr(random, "choice", lambda items: items[-1])
    monkeypatch.setattr(random, "randint", lambda low, high: low)

    result = gen.mutate_note(note(60, start=15.75, velocity=40), "C major")

    assert result.start_beat == gen.TOTAL_BEATS - 0.25
    assert result.velocity == 35  # 40 - 10 clamped to the minimum


def test_mutate_note_without_mutations_only_clamps_duration(monkeypatch) -> None:
    monkeypatch.setattr(random, "random", lambda: 0.99)

    result = gen.mutate_note(note(61, start=0.3, duration=0.01, velocity=10), "C major")

    assert result == gen.Note(
        pitch=61, velocity=10, start_beat=0.3, duration_beats=0.125, register="mid"
    )


# =========================
# GENERATION LOGIC
# =========================


def test_create_layer_skips_layer_by_probability(monkeypatch) -> None:
    monkeypatch.setattr(random, "random", lambda: 0.99)

    assert (
        gen.create_layer_from_pattern(pattern([note(60)]), "C major", "mid", 0.5) == []
    )


def test_create_layer_keeps_target_register_inside_loop(no_randomness) -> None:
    source = pattern(
        [
            note(60, start=0.0),
            note(40, start=1.0),  # other register
            note(62, start=20.0),  # outside the loop
        ]
    )

    result = gen.create_layer_from_pattern(source, "C major", "mid", 1.0)

    assert [(n.pitch, n.start_beat) for n in result] == [(60, 0.0)]


def test_generate_call_response_loop_builds_all_layers(
    no_randomness, monkeypatch
) -> None:
    monkeypatch.setattr(gen, "choose_target_key", lambda _style: "C major")
    bass = pattern([note(36, 0.0), note(43, 2.0)], registers={"bass": 2})
    mid = pattern([note(60, 1.0), note(64, 1.5)], registers={"mid": 2})
    top = pattern([note(72, 3.0)], registers={"top": 1})
    monkeypatch.setattr(
        gen,
        "choose_pattern_by_register",
        lambda _patterns, register: {"bass": bass, "mid": mid, "top": top}[register],
    )

    notes, key = gen.generate_call_response_loop([bass, mid, top], {})

    assert key == "C major"
    assert [(n.pitch, n.start_beat) for n in notes] == [
        (36, 0.0),
        (60, 1.0),
        (64, 1.5),
        (43, 2.0),
        (72, 3.0),
    ]


def test_generate_call_response_loop_uses_fallback_pattern(monkeypatch) -> None:
    # every layer is skipped, so the fallback pattern is used as a whole
    monkeypatch.setattr(random, "random", lambda: 0.99)
    monkeypatch.setattr(gen, "choose_target_key", lambda _style: "C major")
    fallback = pattern([note(64, 2.0), note(67, 3.0), note(60, 20.0)])

    notes, key = gen.generate_call_response_loop([fallback], {})

    assert key == "C major"
    # shifted so that the first note starts the loop; the note at beat 20 is dropped
    assert [(n.pitch, n.start_beat) for n in notes] == [(64, 0.0), (67, 1.0)]


def test_generate_call_response_loop_limits_note_count(
    no_randomness, monkeypatch
) -> None:
    monkeypatch.setattr(gen, "choose_target_key", lambda _style: "C major")
    scale = [60, 62, 64, 65, 67, 69, 71]
    crowded = pattern(
        [note(scale[i % len(scale)], start=i * 0.125) for i in range(100)],
        registers={"mid": 100},
    )

    notes, _key = gen.generate_call_response_loop([crowded], {})

    assert len(notes) == gen.MAX_NOTES_PER_OUTPUT


def test_normalize_to_4_bars_wraps_and_trims() -> None:
    result = gen.normalize_to_4_bars(
        [
            note(60, start=18.0, duration=1.0),  # wraps to beat 2
            note(62, start=14.0, duration=4.0),  # trimmed to the loop end
            note(64, start=1.0, duration=0.0),  # dropped
        ]
    )

    assert [(n.pitch, n.start_beat, n.duration_beats) for n in result] == [
        (60, 2.0, 1.0),
        (62, 14.0, 2.0),
    ]


def test_remove_too_dense_duplicates_keeps_first_and_sorts() -> None:
    result = gen.remove_too_dense_duplicates(
        [
            note(64, start=1.0),
            note(60, start=0.0, velocity=100),
            note(60, start=0.0001, velocity=50),  # same slot after rounding
        ]
    )

    assert [(n.pitch, n.start_beat, n.velocity) for n in result] == [
        (60, 0.0, 100),
        (64, 1.0, 100),
    ]


def test_reduce_repeated_notes_keeps_short_lists() -> None:
    notes = [note(60), note(60)]

    assert gen.reduce_repeated_notes(notes, "C major") is notes


def test_reduce_repeated_notes_breaks_third_repeat(monkeypatch) -> None:
    monkeypatch.setattr(random, "shuffle", lambda _items: None)
    notes = [note(60, start=float(i)) for i in range(4)]

    result = gen.reduce_repeated_notes(notes, "C major")

    # third repeat moves -5 semitones to G (55); the fourth note differs again
    assert [n.pitch for n in result] == [60, 60, 55, 60]
    assert result[2].register == "mid"


def test_reduce_repeated_notes_keeps_pitch_when_no_move_helps(monkeypatch) -> None:
    monkeypatch.setattr(random, "shuffle", lambda _items: None)
    monkeypatch.setattr(gen, "nearest_pitch_in_key", lambda *_args: 60)
    notes = [note(60, start=float(i)) for i in range(3)]

    assert [n.pitch for n in gen.reduce_repeated_notes(notes, "C major")] == [
        60,
        60,
        60,
    ]


def test_force_first_note_to_start_with_no_notes() -> None:
    assert gen.force_first_note_to_start([]) == []


def test_force_first_note_to_start_snaps_negative_start() -> None:
    result = gen.force_first_note_to_start([note(64, start=1.0), note(60, start=-0.5)])

    assert [(n.pitch, n.start_beat) for n in result] == [(60, 0.0), (64, 1.0)]


def test_force_first_note_to_start_shifts_everything() -> None:
    result = gen.force_first_note_to_start(
        [note(64, start=3.0), note(60, start=2.0, register="custom")]
    )

    assert [(n.pitch, n.start_beat, n.register) for n in result] == [
        (60, 0.0, "custom"),
        (64, 1.0, "mid"),
    ]


# =========================
# SCORING
# =========================


def test_score_of_empty_output() -> None:
    assert gen.score_generated_notes([]) == -9999.0


def test_score_rewards_full_range_with_bass_and_mid() -> None:
    pitches = [40, 60, 62, 64, 65, 67, 69, 71]
    notes = [note(p, start=float(i)) for i, p in enumerate(pitches)]

    # 8 unique * 1.5 + bass 10 + mid 10 + range 15 - one big jump 2.5
    assert gen.score_generated_notes(notes) == 44.5


def test_score_penalizes_narrow_and_short_output() -> None:
    notes = [note(60, 0.0), note(61, 0.0), note(62, 1.0)]

    # 3 unique * 1.5 + mid 10 - narrow 20 + one shared start 1 - too few 25
    assert gen.score_generated_notes(notes) == -29.5


def test_score_penalizes_too_wide_range() -> None:
    notes = [note(36, 0.0), note(90, 1.0)]

    # 2 unique * 1.5 + bass 10 + top 7 - wide 15 - big jump 2.5 - too few 25
    assert gen.score_generated_notes(notes) == -22.5


def test_score_penalizes_too_many_notes_and_caps_shared_starts() -> None:
    notes = [note(60 if i % 2 else 69, 0.0) for i in range(91)]

    # 2 unique * 1.5 + mid 10 + range 9 (no bonus) + shared starts capped 14 - too many 20
    assert gen.score_generated_notes(notes) == 7.0


def test_generate_best_notes_keeps_highest_score(monkeypatch) -> None:
    candidates = iter(
        [([note(60)], "A minor"), ([note(62)], "E minor"), ([note(64)], "C minor")]
    )
    scores = iter([1.0, 5.0, 3.0])
    monkeypatch.setattr(
        gen, "generate_call_response_loop", lambda *_args: next(candidates)
    )
    monkeypatch.setattr(gen, "score_generated_notes", lambda _notes: next(scores))

    notes, key, score = gen.generate_best_notes([], {}, attempts=3)

    assert [n.pitch for n in notes] == [62]
    assert key == "E minor"
    assert score == 5.0


def test_generate_best_notes_defaults_without_attempts() -> None:
    assert gen.generate_best_notes([], {}, attempts=0) == ([], "A minor", -9999.0)


# =========================
# MIDI WRITING
# =========================


def test_write_midi_creates_playable_file(tmp_path: Path) -> None:
    path = tmp_path / "out.mid"
    notes = [
        note(64, start=1.0, duration=0.5, velocity=90),
        note(130, start=0.0, duration=0.0, velocity=0),  # clamped
    ]

    gen.write_midi(notes, path, bpm=120)

    mid = MidiFile(path)
    assert mid.ticks_per_beat == gen.DEFAULT_TICKS_PER_BEAT
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


# =========================
# MAIN
# =========================


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


def test_analysis_file_shipped_with_generator_is_usable() -> None:
    analysis = json.loads(
        (GENERATOR_PATH.parent / gen.ANALYSIS_FILE).read_text(encoding="utf-8")
    )

    patterns, style = gen.load_patterns(analysis)

    assert patterns
    assert style["keys"]
