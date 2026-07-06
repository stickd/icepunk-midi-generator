import argparse
from pathlib import Path

from .config import DATASET_DIR, OUTPUT_FILE
from .service import run_analysis


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze a MIDI dataset and write JSON features")
    parser.add_argument(
        "--dataset-dir",
        type=Path,
        default=DATASET_DIR,
        help="Folder containing .mid/.midi files",
    )
    parser.add_argument(
        "--output-file",
        type=Path,
        default=OUTPUT_FILE,
        help="JSON file to write",
    )
    return parser.parse_args()


def print_summary(result: dict[str, object], output_file: Path) -> None:
    print()
    print(f"Analysis saved to: {output_file}")

    if "dataset_summary" in result:
        print()
        print("SUMMARY")
        print("-------")
        summary = result["dataset_summary"]
        if isinstance(summary, dict):
            for key, value in summary.items():
                print(f"{key}: {value}")
    else:
        print(result.get("error"))


def main() -> None:
    args = parse_args()
    args.dataset_dir.mkdir(exist_ok=True)
    args.output_file.parent.mkdir(exist_ok=True)

    print("ICEPUNK MIDI ANALYZER")
    print("=====================")
    print(f"Dataset folder: {args.dataset_dir.resolve()}")
    print(f"Output file:    {args.output_file.resolve()}")
    print()

    result = run_analysis(args.dataset_dir, args.output_file)
    print_summary(result, args.output_file)


if __name__ == "__main__":
    main()
