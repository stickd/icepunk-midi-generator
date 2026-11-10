from __future__ import annotations

from conftest import (
    note,
)

from midistyle.generation import scoring


def test_score_of_empty_output() -> None:
    assert scoring.score_generated_notes([]) == -9999.0


def test_score_rewards_full_range_with_bass_and_mid() -> None:
    pitches = [40, 60, 62, 64, 65, 67, 69, 71]
    notes = [note(p, start=float(i)) for i, p in enumerate(pitches)]

    # 8 unique * 1.5 + bass 10 + mid 10 + range 15 - one big jump 2.5
    assert scoring.score_generated_notes(notes) == 44.5


def test_score_penalizes_narrow_and_short_output() -> None:
    notes = [note(60, 0.0), note(61, 0.0), note(62, 1.0)]

    # 3 unique * 1.5 + mid 10 - narrow 20 + one shared start 1 - too few 25
    assert scoring.score_generated_notes(notes) == -29.5


def test_score_penalizes_too_wide_range() -> None:
    notes = [note(36, 0.0), note(90, 1.0)]

    # 2 unique * 1.5 + bass 10 + top 7 - wide 15 - big jump 2.5 - too few 25
    assert scoring.score_generated_notes(notes) == -22.5


def test_score_penalizes_too_many_notes_and_caps_shared_starts() -> None:
    notes = [note(60 if i % 2 else 69, 0.0) for i in range(91)]

    # 2 unique * 1.5 + mid 10 + range 9 (no bonus) + shared starts capped 14 - too many 20
    assert scoring.score_generated_notes(notes) == 7.0


def test_generate_best_notes_keeps_highest_score(monkeypatch) -> None:
    candidates = iter(
        [([note(60)], "A minor"), ([note(62)], "E minor"), ([note(64)], "C minor")]
    )
    scores = iter([1.0, 5.0, 3.0])
    monkeypatch.setattr(
        scoring, "generate_call_response_loop", lambda *_args: next(candidates)
    )
    monkeypatch.setattr(scoring, "score_generated_notes", lambda _notes: next(scores))

    notes, key, score = scoring.generate_best_notes([], {}, attempts=3)

    assert [n.pitch for n in notes] == [62]
    assert key == "E minor"
    assert score == 5.0


def test_generate_best_notes_defaults_without_attempts() -> None:
    assert scoring.generate_best_notes([], {}, attempts=0) == ([], "A minor", -9999.0)
