import argparse
from pathlib import Path

from .config import ANALYSIS_FILE, DEFAULT_OUTPUT_DIR, GENERATE_COUNT
from .service import generate_midi_files


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate MIDI patterns from style analysis")
    parser.add_argument(
        "output_dir",
        type=Path,
        nargs="?",
        default=DEFAULT_OUTPUT_DIR,
        help="Directory to write generated .mid files into (default: generated_midi)",
    )
    parser.add_argument(
        "--analysis-file",
        type=Path,
        default=ANALYSIS_FILE,
        help="Analysis JSON to use as generation source",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=GENERATE_COUNT,
        help="Number of MIDI files to generate",
    )
    parser.add_argument(
        "--bpm",
        type=float,
        default=None,
        help="Override output BPM",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    generate_midi_files(
        output_dir=args.output_dir,
        analysis_file=args.analysis_file,
        count=max(1, min(args.count, 34)),
        bpm=args.bpm,
    )


if __name__ == "__main__":
    main()
