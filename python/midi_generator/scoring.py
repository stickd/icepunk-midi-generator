from typing import Any

from .generator import generate_call_response_loop
from .models import Note, SourcePattern


def score_generated_notes(notes: list[Note]) -> float:
    if not notes:
        return -9999.0

    score = 0.0

    pitches = [note.pitch for note in notes]
    unique_pitches = len(set(pitches))
    pitch_range = max(pitches) - min(pitches)

    bass_notes = [note for note in notes if note.register == "bass"]
    mid_notes = [note for note in notes if note.register == "mid"]
    top_notes = [note for note in notes if note.register == "top"]

    score += min(unique_pitches, 16) * 1.5

    if bass_notes:
        score += 10

    if mid_notes:
        score += 10

    if top_notes:
        score += 7

    if 12 <= pitch_range <= 42:
        score += 15
    elif pitch_range < 7:
        score -= 20
    elif pitch_range > 52:
        score -= 15

    starts = [note.start_beat for note in notes]
    polyphony_bonus = len(starts) - len(set(starts))
    score += min(polyphony_bonus, 14)

    big_jumps = 0

    sorted_notes = sorted(notes, key=lambda note: (note.start_beat, note.pitch))

    for prev, curr in zip(sorted_notes, sorted_notes[1:]):
        if abs(curr.pitch - prev.pitch) > 19:
            big_jumps += 1

    score -= big_jumps * 2.5

    if len(notes) > 90:
        score -= 20

    if len(notes) < 8:
        score -= 25

    return score


def generate_best_notes(
    patterns: list[SourcePattern],
    style: dict[str, Any],
    attempts: int = 50,
) -> tuple[list[Note], str, float]:
    best_notes: list[Note] = []
    best_key = "A minor"
    best_score = -9999.0

    for _ in range(attempts):
        notes, key = generate_call_response_loop(patterns, style)
        score = score_generated_notes(notes)

        if score > best_score:
            best_notes = notes
            best_key = key
            best_score = score

    return best_notes, best_key, best_score
