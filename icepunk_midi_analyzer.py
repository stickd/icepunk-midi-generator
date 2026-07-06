import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "python"))

from midi_analyzer import *
from midi_analyzer.cli import main


if __name__ == "__main__":
    main()
