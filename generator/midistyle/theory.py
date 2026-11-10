"""Music theory helpers: note names, keys, scales and registers."""

from __future__ import annotations

from midistyle.config import GLOBAL_MAX_PITCH, GLOBAL_MIN_PITCH
from midistyle.util import clamp

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


def pitch_to_name(pitch: int) -> str:
    octave = pitch // 12 - 1
    return f"{NOTE_NAMES[pitch % 12]}{octave}"


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


def detect_register(pitch: int) -> str:
    if pitch < 48:
        return "bass"
    if pitch < 72:
        return "mid"
    return "top"
