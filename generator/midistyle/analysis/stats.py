"""Statistics for a single MIDI file."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from statistics import mean, median
from typing import Any

from midistyle.analysis.reader import extract_notes_from_midi
from midistyle.theory import NOTE_NAMES, pitch_to_name


@dataclass
class MidiAnalysis:
    file_name: str
    path: str
    ticks_per_beat: int
    tempo_bpm_estimate: float | None
    note_count: int
    unique_pitches: list[int]
    pitch_range: dict[str, int | None]
    average_pitch: float | None
    average_velocity: float | None
    average_duration_beats: float | None
    median_duration_beats: float | None
    most_common_pitches: list[dict[str, Any]]
    pitch_class_distribution: dict[str, int]
    velocity_distribution: dict[str, int]
    duration_distribution_beats: dict[str, int]
    interval_distribution: dict[str, int]
    rhythmic_density_notes_per_beat: float | None
    estimated_key: str | None
    tracks: list[dict[str, Any]]


def safe_round(value: float | None, digits: int = 4) -> float | None:
    if value is None:
        return None
    return round(value, digits)


def bucket_velocity(velocity: int) -> str:
    if velocity <= 30:
        return "very_soft_1_30"
    if velocity <= 60:
        return "soft_31_60"
    if velocity <= 90:
        return "medium_61_90"
    if velocity <= 115:
        return "hard_91_115"
    return "very_hard_116_127"


def bucket_duration_beats(duration: float) -> str:
    # Условные музыкальные категории, удобные для анализа грува
    if duration < 0.25:
        return "very_short_<1/16"
    if duration < 0.5:
        return "short_1/16"
    if duration < 1.0:
        return "medium_1/8"
    if duration < 2.0:
        return "long_1/4_to_1/2"
    if duration < 4.0:
        return "very_long_1/2_to_bar"
    return "sustained_>=bar"


def estimate_key_from_pitch_classes(pitch_classes: Counter[int]) -> str | None:
    """
    Очень простая оценка тональности.
    Это не музыкальный ИИ, а быстрый statistical guess.
    Позже можно заменить на более умный алгоритм.
    """
    if not pitch_classes:
        return None

    major_profile = [
        6.35,
        2.23,
        3.48,
        2.33,
        4.38,
        4.09,
        2.52,
        5.19,
        2.39,
        3.66,
        2.29,
        2.88,
    ]
    minor_profile = [
        6.33,
        2.68,
        3.52,
        5.38,
        2.60,
        3.53,
        2.54,
        4.75,
        3.98,
        2.69,
        3.34,
        3.17,
    ]

    values = [pitch_classes.get(i, 0) for i in range(12)]

    def score(profile: list[float], tonic: int) -> float:
        rotated = profile[-tonic:] + profile[:-tonic]
        return sum(a * b for a, b in zip(values, rotated))

    candidates: list[tuple[float, str]] = []
    for tonic in range(12):
        candidates.append((score(major_profile, tonic), f"{NOTE_NAMES[tonic]} major"))
        candidates.append((score(minor_profile, tonic), f"{NOTE_NAMES[tonic]} minor"))

    candidates.sort(reverse=True, key=lambda x: x[0])
    return candidates[0][1]


def analyze_midi_file(midi_path: Path) -> MidiAnalysis:
    mid, notes, tracks_info, tempo_bpm = extract_notes_from_midi(midi_path)

    pitches = [n.pitch for n in notes]
    velocities = [n.velocity for n in notes]
    durations = [n.duration_beats for n in notes]
    pitch_classes = Counter(p % 12 for p in pitches)

    pitch_counter = Counter(pitches)
    most_common_pitches = [
        {
            "pitch": pitch,
            "name": pitch_to_name(pitch),
            "count": count,
        }
        for pitch, count in pitch_counter.most_common(12)
    ]

    pitch_class_distribution = {
        NOTE_NAMES[i]: pitch_classes.get(i, 0) for i in range(12)
    }

    velocity_distribution = Counter(bucket_velocity(v) for v in velocities)
    duration_distribution = Counter(bucket_duration_beats(d) for d in durations)

    intervals: list[int] = []
    for prev, curr in zip(notes, notes[1:]):
        # Берем интервалы только если это одна дорожка/канал, чтобы не мешать аккорды и мелодию слишком сильно
        if prev.track_index == curr.track_index and prev.channel == curr.channel:
            intervals.append(curr.pitch - prev.pitch)

    interval_distribution = Counter(intervals)

    total_beats = None
    if notes:
        total_beats = max(n.end_tick for n in notes) / mid.ticks_per_beat

    rhythmic_density = None
    if total_beats and total_beats > 0:
        rhythmic_density = len(notes) / total_beats

    return MidiAnalysis(
        file_name=midi_path.name,
        path=str(midi_path),
        ticks_per_beat=mid.ticks_per_beat,
        tempo_bpm_estimate=safe_round(tempo_bpm, 2),
        note_count=len(notes),
        unique_pitches=sorted(set(pitches)),
        pitch_range={
            "min": min(pitches) if pitches else None,
            "max": max(pitches) if pitches else None,
        },
        average_pitch=safe_round(mean(pitches), 2) if pitches else None,
        average_velocity=safe_round(mean(velocities), 2) if velocities else None,
        average_duration_beats=safe_round(mean(durations), 4) if durations else None,
        median_duration_beats=safe_round(median(durations), 4) if durations else None,
        most_common_pitches=most_common_pitches,
        pitch_class_distribution=pitch_class_distribution,
        velocity_distribution=dict(sorted(velocity_distribution.items())),
        duration_distribution_beats=dict(sorted(duration_distribution.items())),
        interval_distribution={
            str(k): v for k, v in sorted(interval_distribution.items())
        },
        rhythmic_density_notes_per_beat=safe_round(rhythmic_density, 4),
        estimated_key=estimate_key_from_pitch_classes(pitch_classes),
        tracks=tracks_info,
    )
