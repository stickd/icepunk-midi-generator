import random
from collections import Counter
from typing import Any, TypeVar

Number = TypeVar("Number", int, float)


def clamp(value: Number, min_value: Number, max_value: Number) -> Number:
    return max(min_value, min(max_value, value))


def beat_to_ticks(beat: float, ticks_per_beat: int) -> int:
    return int(round(beat * ticks_per_beat))


def quantize_beat(value: float, grid: float = 0.25) -> float:
    return round(round(value / grid) * grid, 4)


def weighted_choice(counter: Counter[Any]) -> Any:
    items = list(counter.items())

    if not items:
        raise ValueError("Cannot choose from empty counter")

    values = [item[0] for item in items]
    weights = [max(1, item[1]) for item in items]

    return random.choices(values, weights=weights, k=1)[0]





