import random
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent


@pytest.fixture(autouse=True)
def seed_rng():
    random.seed(0)
    yield
    random.seed(None)


@pytest.fixture
def repo_root() -> Path:
    return REPO_ROOT
