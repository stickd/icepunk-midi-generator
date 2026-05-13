from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path
from statistics import mean, median
from typing import Any

import mido
from mido import MidiFile


# =========================
# CONFIG
# =========================

DATASET_DIR = Path("midi_dataset")
OUTPUT_DIR = Path("analysis_output")
OUTPUT_FILE = OUTPUT_DIR / "midi_analysis.json"
SUPPORTED_EXTENSIONS = {".mid", ".midi"}

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


# =========================
# DATA TYPES
# =========================

@dataclass
class NoteEvent:
    pitch: int
    pitch_name: str
    velocity: int
    start_tick: int
    end_tick: int
    duration_ticks: int
    start_beat: float
    duration_beats: float
    channel: int
    track_index: int


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


# =========================
# HELPERS
# =========================

def pitch_to_name(pitch: int) -> str:
    octave = pitch // 12 - 1
    return f"{NOTE_NAMES[pitch % 12]}{octave}"


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

    candidates.sort(reverse=True, key=lambda x: x[0])
    return candidates[0][1]


# =========================
# MIDI PARSING
# =========================

def extract_notes_from_midi(midi_path: Path) -> tuple[MidiFile, list[NoteEvent], list[dict[str, Any]], float | None]:
    mid = MidiFile(midi_path)
    ticks_per_beat = mid.ticks_per_beat

    notes: list[NoteEvent] = []
    tracks_info: list[dict[str, Any]] = []
    tempos: list[int] = []

    for track_index, track in enumerate(mid.tracks):
        absolute_tick = 0
        active_notes: dict[tuple[int, int], list[dict[str, int]]] = defaultdict(list)
        track_note_count = 0
        track_name = f"Track {track_index}"
        instruments: list[str] = []

        for msg in track:
            absolute_tick += msg.time

            if msg.type == "track_name":
                track_name = msg.name

            if msg.type == "set_tempo":
                tempos.append(msg.tempo)

            if msg.type == "program_change":
                instruments.append(f"program_{msg.program}_channel_{msg.channel}")

            if msg.type == "note_on" and msg.velocity > 0:
                key = (msg.channel, msg.note)
                active_notes[key].append(
                    {
                        "start_tick": absolute_tick,
                        "velocity": msg.velocity,
                    }
                )

            elif msg.type in {"note_off", "note_on"}:
                # note_on velocity 0 часто значит note_off
                if hasattr(msg, "note") and hasattr(msg, "channel"):
                    key = (msg.channel, msg.note)
                    if active_notes[key]:
                        started = active_notes[key].pop(0)
                        start_tick = started["start_tick"]
                        end_tick = absolute_tick
                        duration_ticks = max(0, end_tick - start_tick)

                        notes.append(
                            NoteEvent(
                                pitch=msg.note,
                                pitch_name=pitch_to_name(msg.note),
                                velocity=started["velocity"],
                                start_tick=start_tick,
                                end_tick=end_tick,
                                duration_ticks=duration_ticks,
                                start_beat=start_tick / ticks_per_beat,
                                duration_beats=duration_ticks / ticks_per_beat,
                                channel=msg.channel,
                                track_index=track_index,
                            )
                        )
                        track_note_count += 1

        tracks_info.append(
            {
                "track_index": track_index,
                "track_name": track_name,
                "note_count": track_note_count,
                "instruments": sorted(set(instruments)),
            }
        )

    tempo_bpm_estimate = None
    if tempos:
        avg_tempo = mean(tempos)
        tempo_bpm_estimate = mido.tempo2bpm(avg_tempo)

    notes.sort(key=lambda n: (n.start_tick, n.pitch))
    return mid, notes, tracks_info, tempo_bpm_estimate


# =========================
# ANALYSIS
# =========================

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
        interval_distribution={str(k): v for k, v in sorted(interval_distribution.items())},
        rhythmic_density_notes_per_beat=safe_round(rhythmic_density, 4),
        estimated_key=estimate_key_from_pitch_classes(pitch_classes),
        tracks=tracks_info,
    )


def analyze_dataset(dataset_dir: Path) -> dict[str, Any]:
    midi_files = sorted(
        path for path in dataset_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )

    if not midi_files:
        return {
            "error": f"No MIDI files found in {dataset_dir.resolve()}",
            "files": [],
        }

    analyses: list[MidiAnalysis] = []
    failed_files: list[dict[str, str]] = []

    for midi_file in midi_files:
        try:
            analysis = analyze_midi_file(midi_file)
            analyses.append(analysis)
            print(f"✅ Analyzed: {midi_file.name}")
        except Exception as error:
            failed_files.append({"file": str(midi_file), "error": str(error)})
            print(f"❌ Failed: {midi_file.name} — {error}")

    all_pitches: list[int] = []
    all_velocities: list[float] = []
    all_durations: list[float] = []
    all_keys: list[str] = []
    all_density: list[float] = []

    for analysis in analyses:
        for item in analysis.most_common_pitches:
            all_pitches.extend([item["pitch"]] * item["count"])

        if analysis.average_velocity is not None:
            all_velocities.append(analysis.average_velocity)

        if analysis.average_duration_beats is not None:
            all_durations.append(analysis.average_duration_beats)

        if analysis.estimated_key is not None:
            all_keys.append(analysis.estimated_key)

        if analysis.rhythmic_density_notes_per_beat is not None:
            all_density.append(analysis.rhythmic_density_notes_per_beat)

    dataset_summary = {
        "total_files_found": len(midi_files),
        "total_files_analyzed": len(analyses),
        "total_failed": len(failed_files),
        "total_notes": sum(a.note_count for a in analyses),
        "average_notes_per_file": safe_round(mean([a.note_count for a in analyses]), 2) if analyses else None,
        "common_estimated_keys": dict(Counter(all_keys).most_common(10)),
        "global_pitch_range": {
            "min": min(all_pitches) if all_pitches else None,
            "max": max(all_pitches) if all_pitches else None,
        },
        "average_velocity_across_files": safe_round(mean(all_velocities), 2) if all_velocities else None,
        "average_duration_beats_across_files": safe_round(mean(all_durations), 4) if all_durations else None,
        "average_rhythmic_density_notes_per_beat": safe_round(mean(all_density), 4) if all_density else None,
    }

    return {
        "dataset_summary": dataset_summary,
        "files": [asdict(a) for a in analyses],
        "failed_files": failed_files,
    }


# =========================
# MAIN
# =========================

def main() -> None:
    DATASET_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)

    print("ICEPUNK MIDI ANALYZER")
    print("=====================")
    print(f"Dataset folder: {DATASET_DIR.resolve()}")
    print(f"Output file:    {OUTPUT_FILE.resolve()}")
    print()

    result = analyze_dataset(DATASET_DIR)

    with OUTPUT_FILE.open("w", encoding="utf-8") as file:
        json.dump(result, file, indent=2, ensure_ascii=False)

    print()
    print(f"✅ Analysis saved to: {OUTPUT_FILE}")

    if "dataset_summary" in result:
        print()
        print("SUMMARY")
        print("-------")
        for key, value in result["dataset_summary"].items():
            print(f"{key}: {value}")
    else:
        print(result.get("error"))


if __name__ == "__main__":
    main()
