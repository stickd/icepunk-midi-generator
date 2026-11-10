"""Load the learned style ("style DNA") from the analysis JSON."""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from midistyle.config import DEFAULT_BPM
from midistyle.theory import detect_register


@dataclass
class Note:
    pitch: int
    velocity: int
    start_beat: float
    duration_beats: float
    register: str


@dataclass
class SourcePattern:
    notes: list[Note]
    source_file: str
    estimated_key: str | None
    note_count: int
    register_distribution: dict[str, int]


def load_analysis(analysis_file: Path) -> dict[str, Any]:
    if not analysis_file.exists():
        raise FileNotFoundError(
            f"Analysis file not found: {analysis_file}. Run analyzer first."
        )

    with analysis_file.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_patterns(
    analysis: dict[str, Any],
) -> tuple[list[SourcePattern], dict[str, Any]]:
    patterns: list[SourcePattern] = []

    key_counter: Counter[str] = Counter()
    rhythm_counter: Counter[str] = Counter()
    register_counter: Counter[str] = Counter()
    bpm_values: list[float] = []

    for file_info in analysis.get("files", []):
        estimated_key = file_info.get("estimated_key")

        if estimated_key:
            key_counter[estimated_key] += 1

        bpm = file_info.get("tempo_bpm_estimate")

        if bpm:
            bpm_values.append(float(bpm))

        rhythm_counter.update(file_info.get("rhythm_position_distribution", {}))
        register_counter.update(file_info.get("register_distribution", {}))

        for pattern in file_info.get("patterns", []):
            raw_notes = pattern.get("notes", [])

            if not raw_notes:
                continue

            notes: list[Note] = []

            for raw_note in raw_notes:
                pitch = int(raw_note["pitch"])

                notes.append(
                    Note(
                        pitch=pitch,
                        velocity=int(raw_note["velocity"]),
                        start_beat=float(raw_note["relative_start_beat"]),
                        duration_beats=float(raw_note["duration_beats"]),
                        register=raw_note.get("register", detect_register(pitch)),
                    )
                )

            if 2 <= len(notes) <= 40:
                patterns.append(
                    SourcePattern(
                        notes=notes,
                        source_file=file_info.get("file_name", "unknown"),
                        estimated_key=estimated_key,
                        note_count=len(notes),
                        register_distribution=pattern.get("register_distribution", {}),
                    )
                )

    if not patterns:
        raise ValueError("No usable patterns found in analysis JSON.")

    average_bpm = (
        round(sum(bpm_values) / len(bpm_values), 2) if bpm_values else DEFAULT_BPM
    )

    style = {
        "keys": key_counter,
        "rhythm_positions": rhythm_counter,
        "registers": register_counter,
        "bpm": average_bpm,
    }

    return patterns, style
