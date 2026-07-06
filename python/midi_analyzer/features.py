from collections import Counter
from pathlib import Path
from statistics import mean, median

from .config import NOTE_NAMES
from .models import MidiAnalysis
from .music_theory import (
    bucket_duration_beats,
    bucket_velocity,
    estimate_key_from_pitch_classes,
    pitch_to_name,
)
from .parser import extract_notes_from_midi
from .utils import safe_round


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
        NOTE_NAMES[i]: pitch_classes.get(i, 0)
        for i in range(12)
    }

    velocity_distribution = Counter(bucket_velocity(v) for v in velocities)
    duration_distribution = Counter(bucket_duration_beats(d) for d in durations)

    intervals: list[int] = []
    for prev, curr in zip(notes, notes[1:]):
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
        interval_distribution={str(k): v for k, v in sorted(interval_distribution.items())},
        rhythmic_density_notes_per_beat=safe_round(rhythmic_density, 4),
        estimated_key=estimate_key_from_pitch_classes(pitch_classes),
        tracks=tracks_info,
    )
