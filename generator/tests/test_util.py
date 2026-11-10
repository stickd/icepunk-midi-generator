from __future__ import annotations

import pytest

from midistyle.util import clamp, clamp_float


@pytest.mark.parametrize(("value", "expected"), [(-5, 0), (5, 5), (15, 10)])
def test_clamp(value: int, expected: int) -> None:
    assert clamp(value, 0, 10) == expected


@pytest.mark.parametrize(("value", "expected"), [(-0.5, 0.0), (1.5, 1.5), (3.0, 2.0)])
def test_clamp_float(value: float, expected: float) -> None:
    assert clamp_float(value, 0.0, 2.0) == expected
