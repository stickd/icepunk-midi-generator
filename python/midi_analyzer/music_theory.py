from collections import Counter

from .config import NOTE_NAMES


def pitch_to_name(pitch: int) -> str:
    octave = pitch // 12 - 1
    return f"{NOTE_NAMES[pitch % 12]}{octave}"


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
