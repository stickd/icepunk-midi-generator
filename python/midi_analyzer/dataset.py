from collections import Counter
from dataclasses import asdict
from pathlib import Path
from statistics import mean
from typing import Any

from .config import SUPPORTED_EXTENSIONS
from .features import analyze_midi_file
from .models import MidiAnalysis
from .utils import safe_round


def find_midi_files(dataset_dir: Path) -> list[Path]:
    return sorted(
        path for path in dataset_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def build_dataset_summary(
    midi_files: list[Path],
    analyses: list[MidiAnalysis],
    failed_files: list[dict[str, str]],
) -> dict[str, Any]:
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

    return {
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


def analyze_dataset(dataset_dir: Path) -> dict[str, Any]:
    midi_files = find_midi_files(dataset_dir)

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
            print(f"Analyzed: {midi_file.name}")
        except Exception as error:
            failed_files.append({"file": str(midi_file), "error": str(error)})
            print(f"Failed: {midi_file.name} - {error}")

    dataset_summary = build_dataset_summary(midi_files, analyses, failed_files)

    return {
        "dataset_summary": dataset_summary,
        "files": [asdict(a) for a in analyses],
        "failed_files": failed_files,
    }
