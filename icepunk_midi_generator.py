from __future__ import annotations

import random
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any
import sys

import mido
from mido import Message, MetaMessage, MidiFile, MidiTrack, bpm2tempo


# =========================
# CONFIG
# =========================

DATASET_DIR = Path("midi_dataset")
if len(sys.argv) > 1:
    OUTPUT_DIR = Path(sys.argv[1])
else:
    OUTPUT_DIR = Path("generated_midi")

DEFAULT_BPM = 146
DEFAULT_TICKS_PER_BEAT = 480

GENERATE_COUNT = 5

# Loop mode: генерируем 2 бара и копируем их, чтобы получить 4-bar loop
MOTIF_BARS = 2
LOOP_REPEATS = 2
BARS = MOTIF_BARS * LOOP_REPEATS
BEATS_PER_BAR = 4
MOTIF_BEATS = MOTIF_BARS * BEATS_PER_BAR
TOTAL_BEATS = BARS * BEATS_PER_BAR

# Pattern Engine settings
PATTERN_LENGTH_BEATS = 2.0
MIN_NOTES_IN_PATTERN = 2
MAX_NOTES_IN_PATTERN = 12

# Mutation settings
RANDOMNESS = 0.25
TRANSPOSE_PROBABILITY = 0.45
OCTAVE_SHIFT_PROBABILITY = 0.18
NOTE_MUTATION_PROBABILITY = 0.22
RHYTHM_MUTATION_PROBABILITY = 0.12
VELOCITY_MUTATION_PROBABILITY = 0.4
REST_PATTERN_PROBABILITY = 0.08

# Ограничение, чтобы мелодия не улетала слишком низко/высоко
GLOBAL_MIN_PITCH = 36
GLOBAL_MAX_PITCH = 84

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

KEY_TO_ROOT = {
    "C": 0,
    "C#": 1,
    "D": 2,
    "D#": 3,
    "E": 4,
    "F": 5,
    "F#": 6,
    "G": 7,
    "G#": 8,
    "A": 9,
    "A#": 10,
    "B": 11,
}

MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]


# =========================
# DATA TYPES
# =========================

@dataclass
class Note:
    pitch: int
    velocity: int
    start_beat: float
    duration_beats: float


@dataclass
class Pattern:
    notes: list[Note]
    length_beats: float
    source_file: str
    estimated_key: str | None


# =========================
# BASIC HELPERS
# =========================

def clamp(value: int, min_value: int, max_value: int) -> int:
    return max(min_value, min(max_value, value))


def pitch_to_name(pitch: int) -> str:
    octave = pitch // 12 - 1
    return f"{NOTE_NAMES[pitch % 12]}{octave}"


def beat_to_ticks(beat: float, ticks_per_beat: int) -> int:
    return int(round(beat * ticks_per_beat))


def quantize_beat(value: float, grid: float = 0.25) -> float:
    return round(round(value / grid) * grid, 4)


def weighted_choice(counter: Counter[Any]) -> Any:
    items = list(counter.items())
    if not items:
        raise ValueError("Cannot choose from empty counter")
    values = [item[0] for item in items]
    weights = [max(1, item[1]) for item in items]
    return random.choices(values, weights=weights, k=1)[0]


def parse_key(key_name: str | None) -> tuple[int, str]:
    if not key_name:
        return KEY_TO_ROOT["A"], "minor"

    parts = key_name.split()
    if len(parts) < 2:
        return KEY_TO_ROOT["A"], "minor"

    root = KEY_TO_ROOT.get(parts[0], KEY_TO_ROOT["A"])
    mode = parts[1] if parts[1] in {"major", "minor"} else "minor"
    return root, mode


def pitch_in_key(pitch: int, root: int, mode: str) -> bool:
    scale = MINOR_SCALE if mode == "minor" else MAJOR_SCALE
    return (pitch - root) % 12 in scale


def nearest_pitch_in_key(pitch: int, root: int, mode: str) -> int:
    pitch = clamp(pitch, GLOBAL_MIN_PITCH, GLOBAL_MAX_PITCH)
    if pitch_in_key(pitch, root, mode):
        return pitch

    candidates: list[int] = []
    for offset in range(-6, 7):
        candidate = clamp(pitch + offset, GLOBAL_MIN_PITCH, GLOBAL_MAX_PITCH)
        if pitch_in_key(candidate, root, mode):
            candidates.append(candidate)

    if not candidates:
        return pitch

    return min(candidates, key=lambda p: abs(p - pitch))


# =========================
# MIDI PARSING
# =========================

def extract_notes_from_midi(midi_path: Path) -> tuple[list[Note], int, float | None]:
    mid = MidiFile(midi_path)
    ticks_per_beat = mid.ticks_per_beat
    notes: list[Note] = []
    tempos: list[int] = []

    for track in mid.tracks:
        absolute_tick = 0
        active_notes: dict[tuple[int, int], list[dict[str, int]]] = defaultdict(list)

        for msg in track:
            absolute_tick += msg.time

            if msg.type == "set_tempo":
                tempos.append(msg.tempo)

            if msg.type == "note_on" and msg.velocity > 0:
                active_notes[(msg.channel, msg.note)].append(
                    {"start_tick": absolute_tick, "velocity": msg.velocity}
                )

            elif msg.type in {"note_off", "note_on"}:
                if hasattr(msg, "note") and hasattr(msg, "channel"):
                    key = (msg.channel, msg.note)
                    if active_notes[key]:
                        started = active_notes[key].pop(0)
                        start_tick = started["start_tick"]
                        end_tick = absolute_tick
                        duration_ticks = max(1, end_tick - start_tick)

                        notes.append(
                            Note(
                                pitch=msg.note,
                                velocity=started["velocity"],
                                start_beat=start_tick / ticks_per_beat,
                                duration_beats=duration_ticks / ticks_per_beat,
                            )
                        )

    notes.sort(key=lambda n: (n.start_beat, n.pitch))

    bpm = None
    if tempos:
        avg_tempo = sum(tempos) / len(tempos)
        bpm = float(mido.tempo2bpm(avg_tempo))

    return notes, ticks_per_beat, bpm


# =========================
# ANALYSIS INSIDE GENERATOR
# =========================

def estimate_key(notes: list[Note]) -> str:
    if not notes:
        return "A minor"

    pitch_classes = Counter(note.pitch % 12 for note in notes)

    major_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    minor_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    values = [pitch_classes.get(i, 0) for i in range(12)]

    def score(profile: list[float], tonic: int) -> float:
        rotated = profile[-tonic:] + profile[:-tonic]
        return sum(a * b for a, b in zip(values, rotated))

    candidates: list[tuple[float, str]] = []
    for tonic in range(12):
        candidates.append((score(major_profile, tonic), f"{NOTE_NAMES[tonic]} major"))
        candidates.append((score(minor_profile, tonic), f"{NOTE_NAMES[tonic]} minor"))

    candidates.sort(reverse=True, key=lambda item: item[0])
    return candidates[0][1]


def get_midi_files() -> list[Path]:
    return sorted(
        path for path in DATASET_DIR.rglob("*")
        if path.is_file() and path.suffix.lower() in {".mid", ".midi"}
    )


def build_pattern_library() -> tuple[list[Pattern], dict[str, Any]]:
    midi_files = get_midi_files()
    if not midi_files:
        raise FileNotFoundError(f"No MIDI files found in {DATASET_DIR.resolve()}")

    patterns: list[Pattern] = []
    key_counter: Counter[str] = Counter()
    pitch_counter: Counter[int] = Counter()
    interval_counter: Counter[int] = Counter()
    bpm_values: list[float] = []

    for midi_file in midi_files:
        try:
            notes, _, bpm = extract_notes_from_midi(midi_file)
        except Exception as error:
            print(f"❌ Failed to read {midi_file.name}: {error}")
            continue

        if not notes:
            continue

        key = estimate_key(notes)
        key_counter[key] += 1

        if bpm:
            bpm_values.append(bpm)

        for note in notes:
            pitch_counter[note.pitch] += 1

        for prev, curr in zip(notes, notes[1:]):
            interval = curr.pitch - prev.pitch
            if -24 <= interval <= 24:
                interval_counter[interval] += 1

        total_beats = max(note.start_beat + note.duration_beats for note in notes)
        window_start = 0.0

        while window_start < total_beats:
            window_end = window_start + PATTERN_LENGTH_BEATS
            window_notes = [
                note for note in notes
                if window_start <= note.start_beat < window_end
            ]

            if MIN_NOTES_IN_PATTERN <= len(window_notes) <= MAX_NOTES_IN_PATTERN:
                normalized_notes = []
                for note in window_notes:
                    relative_start = quantize_beat(note.start_beat - window_start)
                    duration = max(0.125, quantize_beat(note.duration_beats))
                    normalized_notes.append(
                        Note(
                            pitch=note.pitch,
                            velocity=note.velocity,
                            start_beat=relative_start,
                            duration_beats=duration,
                        )
                    )

                patterns.append(
                    Pattern(
                        notes=normalized_notes,
                        length_beats=PATTERN_LENGTH_BEATS,
                        source_file=midi_file.name,
                        estimated_key=key,
                    )
                )

            window_start += PATTERN_LENGTH_BEATS

    if not patterns:
        raise ValueError("No usable patterns found. Add more MIDI or use MIDI with more notes.")

    average_bpm = round(sum(bpm_values) / len(bpm_values), 2) if bpm_values else DEFAULT_BPM

    style = {
        "keys": key_counter,
        "pitches": pitch_counter,
        "intervals": interval_counter,
        "bpm": average_bpm,
    }

    return patterns, style


# =========================
# PATTERN MUTATION
# =========================

def choose_target_key(style: dict[str, Any]) -> str:
    if style["keys"]:
        return weighted_choice(style["keys"])
    return "A minor"


def transpose_pattern_to_key(pattern: Pattern, target_key: str) -> list[Note]:
    source_root, _source_mode = parse_key(pattern.estimated_key)
    target_root, target_mode = parse_key(target_key)

    transpose = target_root - source_root

    # Иногда двигаем на октаву, чтобы было больше IcePunk jump feel
    if random.random() < OCTAVE_SHIFT_PROBABILITY:
        transpose += random.choice([-12, 12])

    result: list[Note] = []
    for note in pattern.notes:
        new_pitch = note.pitch + transpose
        new_pitch = nearest_pitch_in_key(new_pitch, target_root, target_mode)
        result.append(
            Note(
                pitch=new_pitch,
                velocity=note.velocity,
                start_beat=note.start_beat,
                duration_beats=note.duration_beats,
            )
        )

    return result


def mutate_pattern_notes(notes: list[Note], style: dict[str, Any], target_key: str) -> list[Note]:
    root, mode = parse_key(target_key)
    mutated: list[Note] = []

    for note in notes:
        pitch = note.pitch
        velocity = note.velocity
        start = note.start_beat
        duration = note.duration_beats

        if random.random() < NOTE_MUTATION_PROBABILITY:
            if style["intervals"]:
                pitch += weighted_choice(style["intervals"])
            else:
                pitch += random.choice([-7, -5, -2, 2, 5, 7])
            pitch = nearest_pitch_in_key(pitch, root, mode)

        if random.random() < RHYTHM_MUTATION_PROBABILITY:
            start = quantize_beat(start + random.choice([-0.25, 0.25]))
            start = max(0.0, min(PATTERN_LENGTH_BEATS - 0.25, start))

        if random.random() < RHYTHM_MUTATION_PROBABILITY:
            duration = random.choice([0.25, 0.5, 0.75, 1.0])

        if random.random() < VELOCITY_MUTATION_PROBABILITY:
            velocity += random.randint(-12, 12)
            velocity = clamp(velocity, 45, 127)

        mutated.append(
            Note(
                pitch=pitch,
                velocity=velocity,
                start_beat=round(start, 4),
                duration_beats=round(duration, 4),
            )
        )

    mutated.sort(key=lambda n: (n.start_beat, n.pitch))
    return mutated


def choose_pattern(patterns: list[Pattern]) -> Pattern:
    # Пока простая логика: случайный паттерн.
    # Позже можно сделать transition map: какой паттерн красиво идет после какого.
    return random.choice(patterns)


# =========================
# MUSICAL SCORING
# =========================

def score_generated_notes(notes: list[Note]) -> float:
    if not notes:
        return -9999

    score = 0.0

    pitches = [note.pitch for note in notes]
    unique_pitches = len(set(pitches))
    pitch_range = max(pitches) - min(pitches)

    # Нужна вариативность, но не полный хаос
    score += min(unique_pitches, 12) * 2

    if 12 <= pitch_range <= 36:
        score += 18
    elif pitch_range < 7:
        score -= 20
    elif pitch_range > 48:
        score -= 18

    # Наказываем слишком огромные скачки подряд
    big_jumps = 0
    for prev, curr in zip(notes, notes[1:]):
        if abs(curr.pitch - prev.pitch) > 14:
            big_jumps += 1

    score -= big_jumps * 3

    # Немного награждаем повторение мотивов по ритму
    starts = [note.start_beat % PATTERN_LENGTH_BEATS for note in notes]
    repeated_positions = len(starts) - len(set(starts))
    score += min(repeated_positions, 10)

    repeated_pitch_penalty = 0
    repeat_count = 1

    for prev, curr in zip(notes, notes[1:]):
        if prev.pitch == curr.pitch:
            repeat_count += 1
        else:
            repeat_count = 1

        if repeat_count >= 3:
            repeated_pitch_penalty += 8

    score -= repeated_pitch_penalty

    return score


# =========================
# GENERATION
# =========================

def force_first_note_to_start(notes: list[Note]) -> list[Note]:
    """
    Гарантирует, что MIDI начинается сразу с ноты на beat 0.0.
    Если первая нота начинается позже, сдвигаем весь материал влево.
    """
    if not notes:
        return notes

    notes.sort(key=lambda n: (n.start_beat, n.pitch))
    first_start = notes[0].start_beat

    if first_start <= 0.0:
        notes[0].start_beat = 0.0
        return notes

    shifted: list[Note] = []
    for note in notes:
        new_start = max(0.0, round(note.start_beat - first_start, 4))
        shifted.append(
            Note(
                pitch=note.pitch,
                velocity=note.velocity,
                start_beat=new_start,
                duration_beats=note.duration_beats,
            )
        )

    shifted.sort(key=lambda n: (n.start_beat, n.pitch))
    return shifted

def reduce_repeated_notes(notes: list[Note], target_key: str) -> list[Note]:
    if len(notes) < 3:
        return notes

    root, mode = parse_key(target_key)
    fixed: list[Note] = []

    repeat_count = 1
    previous_pitch: int | None = None

    for note in notes:
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

        fixed.append(Note(pitch, note.velocity, note.start_beat, note.duration_beats))
        previous_pitch = pitch

    return fixed

def repeat_motif_as_loop(motif_notes: list[Note]) -> list[Note]:
    """
    Берет 2-bar motif и копирует его LOOP_REPEATS раз.
    Например: 2 bars x 2 = 4-bar loop.
    """
    loop_notes: list[Note] = []

    for repeat_index in range(LOOP_REPEATS):
        offset = repeat_index * MOTIF_BEATS
        for note in motif_notes:
            new_start = note.start_beat + offset
            if new_start >= TOTAL_BEATS:
                continue

            loop_notes.append(
                Note(
                    pitch=note.pitch,
                    velocity=note.velocity,
                    start_beat=round(new_start, 4),
                    duration_beats=min(note.duration_beats, TOTAL_BEATS - new_start),
                )
            )

    loop_notes.sort(key=lambda n: (n.start_beat, n.pitch))
    return loop_notes


def generate_candidate(patterns: list[Pattern], style: dict[str, Any]) -> tuple[list[Note], str]:
    target_key = choose_target_key(style)
    motif_notes: list[Note] = []
    current_beat = 0.0

    # Генерируем только 2 бара, потом копируем как loop
    first_pattern = choose_pattern(patterns)
    remembered_pattern = first_pattern

    while current_beat < MOTIF_BEATS:
        if random.random() < REST_PATTERN_PROBABILITY:
            current_beat += PATTERN_LENGTH_BEATS
            continue

        if current_beat == 0.0:
            pattern = first_pattern
        elif current_beat >= MOTIF_BEATS - PATTERN_LENGTH_BEATS and random.random() < 0.65:
            pattern = remembered_pattern
        else:
            pattern = choose_pattern(patterns)

        pattern_notes = transpose_pattern_to_key(pattern, target_key)
        pattern_notes = mutate_pattern_notes(pattern_notes, style, target_key)

        for note in pattern_notes:
            absolute_start = current_beat + note.start_beat
            if absolute_start >= TOTAL_BEATS:
                continue

            duration = min(note.duration_beats, TOTAL_BEATS - absolute_start)
            if duration <= 0:
                continue

            motif_notes.append(
                Note(
                    pitch=note.pitch,
                    velocity=note.velocity,
                    start_beat=round(absolute_start, 4),
                    duration_beats=round(duration, 4),
                )
            )

        current_beat += PATTERN_LENGTH_BEATS

    motif_notes.sort(key=lambda n: (n.start_beat, n.pitch))
    motif_notes = force_first_note_to_start(motif_notes)
    generated = repeat_motif_as_loop(motif_notes)
    generated = force_first_note_to_start(generated)
    return generated, target_key


def generate_best_notes(patterns: list[Pattern], style: dict[str, Any], attempts: int = 40) -> tuple[list[Note], str, float]:
    best_notes: list[Note] = []
    best_key = "A minor"
    best_score = -9999.0

    for _ in range(attempts):
        notes, key = generate_candidate(patterns, style)
        score = score_generated_notes(notes)
        if score > best_score:
            best_notes = notes
            best_key = key
            best_score = score

    return best_notes, best_key, best_score


def write_midi(notes: list[Note], output_path: Path, bpm: float) -> None:
    mid = MidiFile(ticks_per_beat=DEFAULT_TICKS_PER_BEAT)
    track = MidiTrack()
    mid.tracks.append(track)

    track.append(MetaMessage("track_name", name="IcePunk Pattern Engine V2", time=0))
    track.append(MetaMessage("set_tempo", tempo=bpm2tempo(bpm), time=0))
    track.append(Message("program_change", program=81, channel=0, time=0))

    events: list[tuple[int, Message]] = []

    for note in notes:
        start_tick = beat_to_ticks(note.start_beat, DEFAULT_TICKS_PER_BEAT)
        duration_ticks = max(1, beat_to_ticks(note.duration_beats, DEFAULT_TICKS_PER_BEAT))
        end_tick = start_tick + duration_ticks

        pitch = clamp(note.pitch, 0, 127)
        velocity = clamp(note.velocity, 1, 127)

        events.append((start_tick, Message("note_on", note=pitch, velocity=velocity, channel=0, time=0)))
        events.append((end_tick, Message("note_off", note=pitch, velocity=0, channel=0, time=0)))

    events.sort(key=lambda item: item[0])

    last_tick = 0
    for absolute_tick, message in events:
        delta = absolute_tick - last_tick
        message.time = max(0, delta)
        track.append(message)
        last_tick = absolute_tick

    mid.save(output_path)

def clear_output_folder() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for file in OUTPUT_DIR.iterdir():
        if file.is_file() and file.suffix.lower() in {".mid", ".midi"}:
            file.unlink()

def generate_midi_files() -> None:
    clear_output_folder()

    patterns, style = build_pattern_library()

    print("ICEPUNK MIDI GENERATOR V2")
    print("=========================")
    print(f"Dataset folder: {DATASET_DIR.resolve()}")
    print(f"Output folder:  {OUTPUT_DIR.resolve()}")
    print()
    print("STYLE DNA")
    print("---------")
    print(f"Patterns extracted: {len(patterns)}")
    print(f"Common keys: {dict(style['keys'].most_common(6))}")
    print(f"BPM: {style['bpm']}")
    print(f"Common intervals: {dict(style['intervals'].most_common(10))}")
    print(f"Motif bars: {MOTIF_BARS}")
    print(f"Loop repeats: {LOOP_REPEATS}")
    print(f"Final bars: {BARS}")
    print()

    for index in range(1, GENERATE_COUNT + 1):
        notes, key, score = generate_best_notes(patterns, style, attempts=40)
        output_path = OUTPUT_DIR / f"icepunk_v2_{index}_{key.replace(' ', '_')}.mid"
        write_midi(notes, output_path, bpm=style["bpm"])

        print(
            f"✅ Generated: {output_path.name} | "
            f"notes: {len(notes)} | key: {key} | score: {round(score, 2)}"
        )

    print()
    print("Done. Test V2 in FL Studio. If it is still too chaotic, lower NOTE_MUTATION_PROBABILITY and RANDOMNESS.")


if __name__ == "__main__":
    generate_midi_files()
