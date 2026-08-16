from dataclasses import dataclass


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
