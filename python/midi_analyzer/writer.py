import json
from pathlib import Path
from typing import Any


def save_json_result(result: dict[str, Any], output_file: Path) -> None:
    output_file.parent.mkdir(exist_ok=True)

    with output_file.open("w", encoding="utf-8") as file:
        json.dump(result, file, indent=2, ensure_ascii=False)
