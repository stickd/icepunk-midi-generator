from __future__ import annotations

import sys
from pathlib import Path

from midistyle.config import GENERATE_COUNT
from midistyle.generation.scoring import generate_best_notes
from midistyle.generation.style import load_analysis, load_patterns
from midistyle.generation.writer import write_midi

ANALYSIS_FILE = Path("analysis_output/midi_analysis.json")

if len(sys.argv) > 1:
    OUTPUT_DIR = Path(sys.argv[1])
else:
    OUTPUT_DIR = Path("generated_midi")


def clear_output_folder() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for file in OUTPUT_DIR.iterdir():
        if file.is_file() and file.suffix.lower() in {".mid", ".midi"}:
            file.unlink()


def generate_midi_files() -> None:
    clear_output_folder()

    analysis = load_analysis(ANALYSIS_FILE)
    patterns, style = load_patterns(analysis)

    print("MIDI GENERATOR FROM STYLE ANALYSIS")
    print("==================================")
    print(f"Analysis file:  {ANALYSIS_FILE.resolve()}")
    print(f"Output folder:  {OUTPUT_DIR.resolve()}")
    print()
    print("STYLE DNA")
    print("---------")
    print(f"Patterns loaded: {len(patterns)}")
    print(f"Common keys: {dict(style['keys'].most_common(8))}")
    print(f"Rhythm positions: {dict(style['rhythm_positions'].most_common(12))}")
    print(f"Registers: {dict(style['registers'])}")
    print(f"BPM: {style['bpm']}")
    print()

    for index in range(1, GENERATE_COUNT + 1):
        notes, key, score = generate_best_notes(patterns, style, attempts=50)

        safe_key = key.replace(" ", "_").replace("#", "sharp")
        output_path = OUTPUT_DIR / f"generated_pattern_{index}_{safe_key}.mid"

        write_midi(notes, output_path, bpm=style["bpm"])

        print(
            f"Generated: {output_path.name} | "
            f"notes: {len(notes)} | key: {key} | score: {round(score, 2)}"
        )

    print()
    print("Done.")


if __name__ == "__main__":
    generate_midi_files()
