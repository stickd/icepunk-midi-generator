from pathlib import Path

from .config import ANALYSIS_FILE, DEFAULT_OUTPUT_DIR, GENERATE_COUNT
from .loader import load_analysis, load_patterns
from .scoring import generate_best_notes
from .writer import clear_output_folder, write_midi


def generate_midi_files(
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    analysis_file: Path = ANALYSIS_FILE,
    count: int = GENERATE_COUNT,
    bpm: float | None = None,
) -> None:
    clear_output_folder(output_dir)

    analysis = load_analysis(analysis_file)
    patterns, style = load_patterns(analysis)
    if bpm is not None:
        style["bpm"] = bpm

    print("MIDI GENERATOR FROM STYLE ANALYSIS")
    print("==================================")
    print(f"Analysis file:  {analysis_file.resolve()}")
    print(f"Output folder:  {output_dir.resolve()}")
    print()
    print("STYLE DNA")
    print("---------")
    print(f"Patterns loaded: {len(patterns)}")
    print(f"Common keys: {dict(style['keys'].most_common(8))}")
    print(f"Rhythm positions: {dict(style['rhythm_positions'].most_common(12))}")
    print(f"Registers: {dict(style['registers'])}")
    print(f"BPM: {style['bpm']}")
    print()

    for index in range(1, count + 1):
        notes, key, score = generate_best_notes(patterns, style, attempts=50)

        safe_key = key.replace(" ", "_").replace("#", "sharp")
        output_path = output_dir / f"generated_pattern_{index}_{safe_key}.mid"

        write_midi(notes, output_path, bpm=style["bpm"])

        print(
            f"Generated: {output_path.name} | "
            f"notes: {len(notes)} | key: {key} | score: {round(score, 2)}"
        )

    print()
    print("Done.")
