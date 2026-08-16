from collections import Counter

import midi_analyzer as analyzer


def test_pitch_to_name_uses_midi_octaves():
    assert analyzer.pitch_to_name(60) == "C4"
    assert analyzer.pitch_to_name(61) == "C#4"


def test_velocity_buckets_keep_existing_labels():
    assert analyzer.bucket_velocity(30) == "very_soft_1_30"
    assert analyzer.bucket_velocity(60) == "soft_31_60"
    assert analyzer.bucket_velocity(90) == "medium_61_90"
    assert analyzer.bucket_velocity(115) == "hard_91_115"
    assert analyzer.bucket_velocity(116) == "very_hard_116_127"


def test_estimate_key_returns_none_for_empty_pitch_classes():
    assert analyzer.estimate_key_from_pitch_classes(Counter()) is None
