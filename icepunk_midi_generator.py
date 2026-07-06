import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "python"))

from midi_generator import *
from midi_generator.cli import main


if __name__ == "__main__":
    main()
