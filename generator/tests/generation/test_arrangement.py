from __future__ import annotations

import random
from collections import Counter

import pytest
from conftest import (
    note,
    pattern,
)

from midistyle.config import (
    MAX_NOTES_PER_OUTPUT,
    TOTAL_BEATS,
)
from midistyle.generation import arrangement
from midistyle.generation.style import Note


def test_quantize_beat_uses_sixteenth_grid_by_default() -> None:
    assert arrangement.quantize_beat(0.3) == 0.25
    assert arrangement.quantize_beat(0.4) == 0.5


def test_quantize_beat_with_custom_grid() -> None:
    assert arrangement.quantize_beat(0.7, grid=0.5) == 0.5


def test_weighted_choice_rejects_empty_counter() -> None:
    with pytest.raises(ValueError, match="empty counter"):
        arrangement.weighted_choice(Counter())


def test_weighted_choice_uses_counts_as_weights(monkeypatch) -> None:
    calls = []

    def fake_choices(values, weights, k):
        calls.append((values, weights, k))
        return [values[-1]]

    monkeypatch.setattr(random, "choices", fake_choices)

    assert arrangement.weighted_choice(Counter({"a": 0, "b": 5})) == "b"
    # zero counts still get weight 1
    assert calls == [(["a", "b"], [1, 5], 1)]


def test_choose_target_key_uses_style_keys(monkeypatch) -> None:
    monkeypatch.setattr(arrangement, "weighted_choice", lambda counter: max(counter))

    assert (
        arrangement.choose_target_key({"keys": Counter({"E minor": 3, "A minor": 1})})
        == "E minor"
    )


def test_choose_target_key_defaults_to_a_minor() -> None:
    assert arrangement.choose_target_key({"keys": Counter()}) == "A minor"


def test_choose_pattern_by_register_prefers_matching_patterns() -> None:
    bass = pattern([note(40)], registers={"bass": 1})
    top = pattern([note(80)], registers={"top": 1, "bass": 0})

    for _ in range(20):
        assert arrangement.choose_pattern_by_register([bass, top], "bass") is bass


def test_choose_pattern_by_register_falls_back_to_any_pattern(monkeypatch) -> None:
    patterns = [pattern([note(60)]), pattern([note(62)])]
    monkeypatch.setattr(random, "choice", lambda items: items[-1])

    assert arrangement.choose_pattern_by_register(patterns, "top") is patterns[-1]


def test_transpose_note_to_key_without_octave_shift(no_randomness) -> None:
    result = arrangement.transpose_note_to_key(
        note(60, start=1.0, velocity=90), "C major", "D minor"
    )

    assert result == Note(
        pitch=62, velocity=90, start_beat=1.0, duration_beats=0.5, register="mid"
    )


def test_transpose_note_to_key_snaps_to_target_scale(no_randomness) -> None:
    # E (64) moved up a whole tone is F# (66), which is not in D minor -> F (65)
    assert arrangement.transpose_note_to_key(note(64), "C major", "D minor").pitch == 65


def test_transpose_note_to_key_with_octave_shift(monkeypatch) -> None:
    monkeypatch.setattr(random, "random", lambda: 0.0)
    monkeypatch.setattr(random, "choice", lambda items: items[-1])

    result = arrangement.transpose_note_to_key(note(60), "C major", "D minor")

    assert result.pitch == 74
    assert result.register == "top"


def test_mutate_note_applies_every_mutation(monkeypatch) -> None:
    monkeypatch.setattr(random, "random", lambda: 0.0)
    monkeypatch.setattr(random, "choice", lambda items: items[-1])
    monkeypatch.setattr(random, "randint", lambda low, high: high)

    result = arrangement.mutate_note(
        note(60, start=1.0, duration=10.0, velocity=120), "C major"
    )

    assert result == Note(
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

    result = arrangement.mutate_note(note(60, start=15.75, velocity=40), "C major")

    assert result.start_beat == TOTAL_BEATS - 0.25
    assert result.velocity == 35  # 40 - 10 clamped to the minimum


def test_mutate_note_without_mutations_only_clamps_duration(monkeypatch) -> None:
    monkeypatch.setattr(random, "random", lambda: 0.99)

    result = arrangement.mutate_note(
        note(61, start=0.3, duration=0.01, velocity=10), "C major"
    )

    assert result == Note(
        pitch=61, velocity=10, start_beat=0.3, duration_beats=0.125, register="mid"
    )


def test_create_layer_skips_layer_by_probability(monkeypatch) -> None:
    monkeypatch.setattr(random, "random", lambda: 0.99)

    assert (
        arrangement.create_layer_from_pattern(
            pattern([note(60)]), "C major", "mid", 0.5
        )
        == []
    )


def test_create_layer_keeps_target_register_inside_loop(no_randomness) -> None:
    source = pattern(
        [
            note(60, start=0.0),
            note(40, start=1.0),  # other register
            note(62, start=20.0),  # outside the loop
        ]
    )

    result = arrangement.create_layer_from_pattern(source, "C major", "mid", 1.0)

    assert [(n.pitch, n.start_beat) for n in result] == [(60, 0.0)]


def test_generate_call_response_loop_builds_all_layers(
    no_randomness, monkeypatch
) -> None:
    monkeypatch.setattr(arrangement, "choose_target_key", lambda _style: "C major")
    bass = pattern([note(36, 0.0), note(43, 2.0)], registers={"bass": 2})
    mid = pattern([note(60, 1.0), note(64, 1.5)], registers={"mid": 2})
    top = pattern([note(72, 3.0)], registers={"top": 1})
    monkeypatch.setattr(
        arrangement,
        "choose_pattern_by_register",
        lambda _patterns, register: {"bass": bass, "mid": mid, "top": top}[register],
    )

    notes, key = arrangement.generate_call_response_loop([bass, mid, top], {})

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
    monkeypatch.setattr(arrangement, "choose_target_key", lambda _style: "C major")
    fallback = pattern([note(64, 2.0), note(67, 3.0), note(60, 20.0)])

    notes, key = arrangement.generate_call_response_loop([fallback], {})

    assert key == "C major"
    # shifted so that the first note starts the loop; the note at beat 20 is dropped
    assert [(n.pitch, n.start_beat) for n in notes] == [(64, 0.0), (67, 1.0)]


def test_generate_call_response_loop_limits_note_count(
    no_randomness, monkeypatch
) -> None:
    monkeypatch.setattr(arrangement, "choose_target_key", lambda _style: "C major")
    scale = [60, 62, 64, 65, 67, 69, 71]
    crowded = pattern(
        [note(scale[i % len(scale)], start=i * 0.125) for i in range(100)],
        registers={"mid": 100},
    )

    notes, _key = arrangement.generate_call_response_loop([crowded], {})

    assert len(notes) == MAX_NOTES_PER_OUTPUT


def test_normalize_to_4_bars_wraps_and_trims() -> None:
    result = arrangement.normalize_to_4_bars(
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
    result = arrangement.remove_too_dense_duplicates(
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

    assert arrangement.reduce_repeated_notes(notes, "C major") is notes


def test_reduce_repeated_notes_breaks_third_repeat(monkeypatch) -> None:
    monkeypatch.setattr(random, "shuffle", lambda _items: None)
    notes = [note(60, start=float(i)) for i in range(4)]

    result = arrangement.reduce_repeated_notes(notes, "C major")

    # third repeat moves -5 semitones to G (55); the fourth note differs again
    assert [n.pitch for n in result] == [60, 60, 55, 60]
    assert result[2].register == "mid"


def test_reduce_repeated_notes_keeps_pitch_when_no_move_helps(monkeypatch) -> None:
    monkeypatch.setattr(random, "shuffle", lambda _items: None)
    monkeypatch.setattr(arrangement, "nearest_pitch_in_key", lambda *_args: 60)
    notes = [note(60, start=float(i)) for i in range(3)]

    assert [n.pitch for n in arrangement.reduce_repeated_notes(notes, "C major")] == [
        60,
        60,
        60,
    ]


def test_force_first_note_to_start_with_no_notes() -> None:
    assert arrangement.force_first_note_to_start([]) == []


def test_force_first_note_to_start_snaps_negative_start() -> None:
    result = arrangement.force_first_note_to_start(
        [note(64, start=1.0), note(60, start=-0.5)]
    )

    assert [(n.pitch, n.start_beat) for n in result] == [(60, 0.0), (64, 1.0)]


def test_force_first_note_to_start_shifts_everything() -> None:
    result = arrangement.force_first_note_to_start(
        [note(64, start=3.0), note(60, start=2.0, register="custom")]
    )

    assert [(n.pitch, n.start_beat, n.register) for n in result] == [
        (60, 0.0, "custom"),
        (64, 1.0, "mid"),
    ]
