import random
from typing import Any, cast

from .config import (
    BASS_LAYER_PROBABILITY,
    MAX_NOTES_PER_OUTPUT,
    MID_LAYER_PROBABILITY,
    NOTE_MUTATION_PROBABILITY,
    OCTAVE_SHIFT_PROBABILITY,
    RHYTHM_MUTATION_PROBABILITY,
    TOP_LAYER_PROBABILITY,
    TOTAL_BEATS,
    VELOCITY_MUTATION_PROBABILITY,
)
from .models import Note, SourcePattern
from .music_theory import detect_register, nearest_pitch_in_key, parse_key
from .utils import clamp, quantize_beat, weighted_choice


def choose_target_key(style: dict[str, Any]) -> str:
    if style["keys"]:
        return cast(str, weighted_choice(style["keys"]))

    return "A minor"


def choose_pattern_by_register(patterns: list[SourcePattern], target_register: str) -> SourcePattern:
    candidates = [
        pattern for pattern in patterns
        if pattern.register_distribution.get(target_register, 0) > 0
    ]

    if not candidates:
        return random.choice(patterns)

    return random.choice(candidates)


def transpose_note_to_key(note: Note, source_key: str | None, target_key: str) -> Note:
    source_root, _source_mode = parse_key(source_key)
    target_root, target_mode = parse_key(target_key)

    transpose = target_root - source_root

    if random.random() < OCTAVE_SHIFT_PROBABILITY:
        transpose += random.choice([-12, 12])

    new_pitch = note.pitch + transpose
    new_pitch = nearest_pitch_in_key(new_pitch, target_root, target_mode)

    return Note(
        pitch=new_pitch,
        velocity=note.velocity,
        start_beat=note.start_beat,
        duration_beats=note.duration_beats,
        register=detect_register(new_pitch),
    )


def mutate_note(note: Note, target_key: str) -> Note:
    root, mode = parse_key(target_key)

    pitch = note.pitch
    velocity = note.velocity
    start = note.start_beat
    duration = note.duration_beats

    if random.random() < NOTE_MUTATION_PROBABILITY:
        pitch += random.choice([-7, -5, -3, -2, 2, 3, 5, 7])
        pitch = nearest_pitch_in_key(pitch, root, mode)

    if random.random() < RHYTHM_MUTATION_PROBABILITY:
        start = quantize_beat(start + random.choice([-0.25, 0.25]))
        start = clamp(start, 0.0, TOTAL_BEATS - 0.25)

    if random.random() < VELOCITY_MUTATION_PROBABILITY:
        velocity += random.randint(-10, 10)
        velocity = clamp(velocity, 35, 127)

    duration = max(0.125, min(duration, 4.0))

    return Note(
        pitch=pitch,
        velocity=velocity,
        start_beat=round(start, 4),
        duration_beats=round(duration, 4),
        register=detect_register(pitch),
    )

def create_layer_from_pattern(
    pattern: SourcePattern,
    target_key: str,
    target_register: str,
    probability: float,
) -> list[Note]:
    notes: list[Note] = []

    if random.random() > probability:
        return notes

    for note in pattern.notes:
        if note.register != target_register:
            continue

        new_note = transpose_note_to_key(note, pattern.estimated_key, target_key)
        new_note = mutate_note(new_note, target_key)

        if 0.0 <= new_note.start_beat < TOTAL_BEATS:
            notes.append(new_note)

    return notes


def generate_call_response_loop(patterns: list[SourcePattern], style: dict[str, Any]) -> tuple[list[Note], str]:
    target_key = choose_target_key(style)

    bass_pattern = choose_pattern_by_register(patterns, "bass")
    mid_pattern = choose_pattern_by_register(patterns, "mid")
    top_pattern = choose_pattern_by_register(patterns, "top")

    generated: list[Note] = []

    generated.extend(
        create_layer_from_pattern(
            bass_pattern,
            target_key,
            "bass",
            BASS_LAYER_PROBABILITY,
        )
    )

    generated.extend(
        create_layer_from_pattern(
            mid_pattern,
            target_key,
            "mid",
            MID_LAYER_PROBABILITY,
        )
    )

    generated.extend(
        create_layer_from_pattern(
            top_pattern,
            target_key,
            "top",
            TOP_LAYER_PROBABILITY,
        )
    )

    if not generated:
        fallback_pattern = random.choice(patterns)

        for note in fallback_pattern.notes:
            new_note = transpose_note_to_key(note, fallback_pattern.estimated_key, target_key)
            new_note = mutate_note(new_note, target_key)

            if 0.0 <= new_note.start_beat < TOTAL_BEATS:
                generated.append(new_note)

    generated = normalize_to_4_bars(generated)
    generated = remove_too_dense_duplicates(generated)
    generated = reduce_repeated_notes(generated, target_key)
    generated = force_first_note_to_start(generated)

    generated.sort(key=lambda note: (note.start_beat, note.pitch))

    if len(generated) > MAX_NOTES_PER_OUTPUT:
        generated = generated[:MAX_NOTES_PER_OUTPUT]

    return generated, target_key


def normalize_to_4_bars(notes: list[Note]) -> list[Note]:
    normalized: list[Note] = []

    for note in notes:
        start = note.start_beat % TOTAL_BEATS
        duration = min(note.duration_beats, TOTAL_BEATS - start)

        if duration <= 0:
            continue

        normalized.append(
            Note(
                pitch=note.pitch,
                velocity=note.velocity,
                start_beat=round(start, 4),
                duration_beats=round(duration, 4),
                register=detect_register(note.pitch),
            )
        )

    return normalized


def remove_too_dense_duplicates(notes: list[Note]) -> list[Note]:
    seen: set[tuple[float, int]] = set()
    cleaned: list[Note] = []

    for note in sorted(notes, key=lambda n: (n.start_beat, n.pitch)):
        key = (round(note.start_beat, 4), note.pitch)

        if key in seen:
            continue

        seen.add(key)
        cleaned.append(note)

    return cleaned


def reduce_repeated_notes(notes: list[Note], target_key: str) -> list[Note]:
    if len(notes) < 3:
        return notes

    root, mode = parse_key(target_key)
    fixed: list[Note] = []

    repeat_count = 1
    previous_pitch: int | None = None

    for note in sorted(notes, key=lambda n: (n.start_beat, n.pitch)):
        pitch = note.pitch

        if previous_pitch == pitch:
            repeat_count += 1
        else:
            repeat_count = 1

        if repeat_count >= 3:
            possible_moves = [-5, -3, -2, 2, 3, 5, 7]
            random.shuffle(possible_moves)

            for move in possible_moves:
                candidate = nearest_pitch_in_key(pitch + move, root, mode)

                if candidate != previous_pitch:
                    pitch = candidate
                    break

            repeat_count = 1

        fixed.append(
            Note(
                pitch=pitch,
                velocity=note.velocity,
                start_beat=note.start_beat,
                duration_beats=note.duration_beats,
                register=detect_register(pitch),
            )
        )

        previous_pitch = pitch

    return fixed


def force_first_note_to_start(notes: list[Note]) -> list[Note]:
    if not notes:
        return notes

    notes.sort(key=lambda n: (n.start_beat, n.pitch))
    first_start = notes[0].start_beat

    if first_start <= 0.0:
        first = notes[0]
        notes[0] = Note(
            pitch=first.pitch,
            velocity=first.velocity,
            start_beat=0.0,
            duration_beats=first.duration_beats,
            register=first.register,
        )
        return notes

    shifted: list[Note] = []

    for note in notes:
        shifted.append(
            Note(
                pitch=note.pitch,
                velocity=note.velocity,
                start_beat=max(0.0, round(note.start_beat - first_start, 4)),
                duration_beats=note.duration_beats,
                register=note.register,
            )
        )

    return shifted
