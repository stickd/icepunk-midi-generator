from pathlib import Path
from typing import Any

from .config import DATASET_DIR, OUTPUT_FILE
from .dataset import analyze_dataset
from .writer import save_json_result


def run_analysis(
    dataset_dir: Path = DATASET_DIR,
    output_file: Path = OUTPUT_FILE,
) -> dict[str, Any]:
    dataset_dir.mkdir(exist_ok=True)
    output_file.parent.mkdir(exist_ok=True)

    result = analyze_dataset(dataset_dir)
    save_json_result(result, output_file)

    return result
