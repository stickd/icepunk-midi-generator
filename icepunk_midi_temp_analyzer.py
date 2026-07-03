from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean
from typing import Any

import mido
from mido import MidiFile

SUPPORTED_EXTENSIONS = {".mid", ".midi"}
PATTERN_LENGTH_BEATS = 8.0
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def detect_register(pitch: int) -> str:
    if pitch < 48:
        return "bass"
    if pitch < 72:
        return "mid"
    return "top"


def pitch_to_name(pitch: int) -> str:
    return f"{NOTE_NAMES[pitch % 12]}{pitch // 12 - 1}"


def estimate_key(pitch_classes: Counter[int]) -> str | None:
    if not pitch_classes:
        return None

    major_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    minor_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    values = [pitch_classes.get(index, 0) for index in range(12)]

    def score(profile: list[float], tonic: int) -> float:
        rotated = profile[-tonic:] + profile[:-tonic]
        return sum(a * b for a, b in zip(values, rotated))

    candidates: list[tuple[float, str]] = []
    for tonic in range(12):
        candidates.append((score(major_profile, tonic), f"{NOTE_NAMES[tonic]} major"))
        candidates.append((score(minor_profile, tonic), f"{NOTE_NAMES[tonic]} minor"))

    candidates.sort(reverse=True, key=lambda item: item[0])
    return candidates[0][1]


def extract_notes(midi_path: Path) -> tuple[MidiFile, list[dict[str, Any]], float | None]:
    midi = MidiFile(midi_path)
    active_notes: dict[tuple[int, int], list[dict[str, int]]] = defaultdict(list)
    notes: list[dict[str, Any]] = []
    tempos: list[int] = []

    for track_index, track in enumerate(midi.tracks):
        absolute_tick = 0
        for message in track:
            absolute_tick += message.time
            if message.type == "set_tempo":
                tempos.append(message.tempo)

            if message.type == "note_on" and message.velocity > 0:
                active_notes[(getattr(message, "channel", 0), message.note)].append(
                    {"start_tick": absolute_tick, "velocity": message.velocity}
                )
                continue

            if message.type in {"note_off", "note_on"} and hasattr(message, "note"):
                key = (getattr(message, "channel", 0), message.note)
                if not active_notes[key]:
                    continue

                started = active_notes[key].pop(0)
                duration_ticks = max(1, absolute_tick - started["start_tick"])
                start_beat = started["start_tick"] / midi.ticks_per_beat
                duration_beats = duration_ticks / midi.ticks_per_beat
                pitch = int(message.note)

                notes.append(
                    {
                        "pitch": pitch,
                        "pitch_name": pitch_to_name(pitch),
                        "velocity": int(started["velocity"]),
                        "start_beat": round(start_beat, 4),
                        "duration_beats": round(duration_beats, 4),
                        "register": detect_register(pitch),
                        "track_index": track_index,
                    }
                )

    tempo_bpm = round(float(mido.tempo2bpm(mean(tempos))), 2) if tempos else None
    notes.sort(key=lambda note: (note["start_beat"], note["pitch"]))
    return midi, notes, tempo_bpm


def rhythm_position(start_beat: float) -> str:
    return str(round(start_beat % PATTERN_LENGTH_BEATS, 4))


def build_patterns(notes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not notes:
        return []

    max_beat = max(note["start_beat"] + note["duration_beats"] for note in notes)
    window_count = max(1, int(max_beat // PATTERN_LENGTH_BEATS) + 1)
    patterns: list[dict[str, Any]] = []

    for index in range(window_count):
        window_start = index * PATTERN_LENGTH_BEATS
        window_end = window_start + PATTERN_LENGTH_BEATS
        window_notes = [
            note for note in notes
            if window_start <= note["start_beat"] < window_end
        ]

        if len(window_notes) < 2:
            continue

        relative_notes = []
        register_distribution: Counter[str] = Counter()
        rhythm_distribution: Counter[str] = Counter()

        for note in window_notes[:40]:
            relative_start = round(note["start_beat"] - window_start, 4)
            register = note["register"]
            register_distribution[register] += 1
            rhythm_distribution[str(relative_start)] += 1
            relative_notes.append(
                {
                    "pitch": note["pitch"],
                    "velocity": note["velocity"],
                    "relative_start_beat": relative_start,
                    "duration_beats": note["duration_beats"],
                    "register": register,
                }
            )

        patterns.append(
            {
                "pattern_index": index,
                "start_beat": round(window_start, 4),
                "length_beats": PATTERN_LENGTH_BEATS,
                "note_count": len(relative_notes),
                "register_distribution": dict(register_distribution),
                "rhythm_positions": dict(rhythm_distribution),
                "notes": relative_notes,
            }
        )

    return patterns


def analyze_file(midi_path: Path) -> dict[str, Any]:
    midi, notes, tempo_bpm = extract_notes(midi_path)
    pitches = [note["pitch"] for note in notes]
    velocities = [note["velocity"] for note in notes]
    durations = [note["duration_beats"] for note in notes]
    pitch_classes = Counter(pitch % 12 for pitch in pitches)
    registers = Counter(note["register"] for note in notes)
    rhythm = Counter(rhythm_position(note["start_beat"]) for note in notes)
    patterns = build_patterns(notes)

    return {
        "file_name": midi_path.name,
        "path": str(midi_path),
        "ticks_per_beat": midi.ticks_per_beat,
        "tempo_bpm_estimate": tempo_bpm,
        "note_count": len(notes),
        "unique_pitches": sorted(set(pitches)),
        "pitch_range": {
            "min": min(pitches) if pitches else None,
            "max": max(pitches) if pitches else None,
        },
        "average_pitch": round(mean(pitches), 2) if pitches else None,
        "average_velocity": round(mean(velocities), 2) if velocities else None,
        "average_duration_beats": round(mean(durations), 4) if durations else None,
        "pitch_class_distribution": {
            NOTE_NAMES[index]: pitch_classes.get(index, 0)
            for index in range(12)
        },
        "rhythm_position_distribution": dict(rhythm),
        "register_distribution": dict(registers),
        "estimated_key": estimate_key(pitch_classes),
        "patterns": patterns,
    }


def analyze_dataset(input_dir: Path) -> dict[str, Any]:
    midi_files = sorted(
        path for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )

    analyses: list[dict[str, Any]] = []
    failed_files: list[dict[str, str]] = []

    for midi_file in midi_files:
        try:
            analyses.append(analyze_file(midi_file))
            print(f"Analyzed {midi_file.name}")
        except Exception as error:
            failed_files.append({"file": midi_file.name, "error": str(error)})
            print(f"Failed {midi_file.name}: {error}")

    total_notes = sum(int(item["note_count"]) for item in analyses)
    usable_patterns = sum(len(item.get("patterns", [])) for item in analyses)

    return {
        "dataset_summary": {
            "total_files_found": len(midi_files),
            "total_files_analyzed": len(analyses),
            "total_failed": len(failed_files),
            "total_notes": total_notes,
            "usable_patterns": usable_patterns,
        },
        "files": analyses,
        "failed_files": failed_files,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze uploaded MIDI files for temporary IcePunk generation")
    parser.add_argument("input_dir", type=Path)
    parser.add_argument("output_file", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    result = analyze_dataset(args.input_dir)
    args.output_file.parent.mkdir(parents=True, exist_ok=True)
    args.output_file.write_text(json.dumps(result, indent=2), encoding="utf-8")

    if result["dataset_summary"]["usable_patterns"] <= 0:
        raise SystemExit("No usable patterns found in uploaded MIDI files.")


if __name__ == "__main__":
    main()
