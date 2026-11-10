from __future__ import annotations

import json
from pathlib import Path

from midistyle.analysis.dataset import analyze_dataset

DATASET_DIR = Path("midi_dataset")
OUTPUT_DIR = Path("analysis_output")
OUTPUT_FILE = OUTPUT_DIR / "midi_analysis.json"


def main() -> None:
    DATASET_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)

    print("ICEPUNK MIDI ANALYZER")
    print("=====================")
    print(f"Dataset folder: {DATASET_DIR.resolve()}")
    print(f"Output file:    {OUTPUT_FILE.resolve()}")
    print()

    result = analyze_dataset(DATASET_DIR)

    with OUTPUT_FILE.open("w", encoding="utf-8") as file:
        json.dump(result, file, indent=2, ensure_ascii=False)

    print()
    print(f"✅ Analysis saved to: {OUTPUT_FILE}")

    if "dataset_summary" in result:
        print()
        print("SUMMARY")
        print("-------")
        for key, value in result["dataset_summary"].items():
            print(f"{key}: {value}")
    else:
        print(result.get("error"))


if __name__ == "__main__":
    main()
