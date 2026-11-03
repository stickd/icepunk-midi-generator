from .config import *
from .generator import (
    choose_pattern_by_register,
    choose_target_key,
    create_layer_from_pattern,
    force_first_note_to_start,
    generate_call_response_loop,
    mutate_note,
    normalize_to_4_bars,
    reduce_repeated_notes,
    remove_too_dense_duplicates,
    transpose_note_to_key,
)
from .loader import load_analysis, load_patterns
from .models import Note, SourcePattern
from .music_theory import detect_register, nearest_pitch_in_key, parse_key, pitch_in_key
from .scoring import generate_best_notes, score_generated_notes
from .service import generate_midi_files
from .utils import beat_to_ticks, clamp, quantize_beat, weighted_choice
from .writer import clear_output_folder, write_midi

__all__ = [name for name in globals() if not name.startswith("_")]
