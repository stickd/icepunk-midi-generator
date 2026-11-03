from dataclasses import dataclass
from typing import Any


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
