from pathlib import Path


DATASET_DIR = Path("midi_dataset")
OUTPUT_DIR = Path("analysis_output")
OUTPUT_FILE = OUTPUT_DIR / "midi_analysis.json"
SUPPORTED_EXTENSIONS = {".mid", ".midi"}

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
