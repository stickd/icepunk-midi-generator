from .config import GLOBAL_MAX_PITCH, GLOBAL_MIN_PITCH, KEY_TO_ROOT, MAJOR_SCALE, MINOR_SCALE
from .utils import clamp


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
