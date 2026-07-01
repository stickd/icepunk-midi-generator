"""Unit tests for pure helper functions in icepunk_midi_generator."""
import mido

import icepunk_midi_generator as gen


# ─── parse_key ────────────────────────────────────────────────────────────────

class TestParseKey:
    def test_standard_minor(self):
        assert gen.parse_key("A minor") == (9, "minor")

    def test_standard_major(self):
        assert gen.parse_key("C major") == (0, "major")

    def test_sharp_root_minor(self):
        assert gen.parse_key("C# major") == (1, "major")
        assert gen.parse_key("F# minor") == (6, "minor")

    def test_none_returns_default(self):
        assert gen.parse_key(None) == (9, "minor")

    def test_empty_string_returns_default(self):
        assert gen.parse_key("") == (9, "minor")

    def test_single_token_returns_default(self):
        # No space → len(parts) < 2 → fallback
        assert gen.parse_key("Aminor") == (9, "minor")

    def test_unknown_root_falls_back_to_a(self):
        root, _ = gen.parse_key("Z minor")
        assert root == 9

    def test_unknown_mode_falls_back_to_minor(self):
        root, mode = gen.parse_key("A jazz")
        assert root == 9
        assert mode == "minor"

    def test_all_natural_roots(self):
        expected = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
        for name, value in expected.items():
            root, _ = gen.parse_key(f"{name} minor")
            assert root == value, f"{name} should map to {value}, got {root}"

    def test_all_sharp_roots(self):
        expected = {"C#": 1, "D#": 3, "F#": 6, "G#": 8, "A#": 10}
        for name, value in expected.items():
            root, _ = gen.parse_key(f"{name} minor")
            assert root == value, f"{name} should map to {value}, got {root}"

    def test_major_mode_preserved(self):
        _, mode = gen.parse_key("G major")
        assert mode == "major"


# ─── pitch_in_key ─────────────────────────────────────────────────────────────

class TestPitchInKey:
    # A minor  root=9  MINOR_SCALE=[0,2,3,5,7,8,10]
    # Semitones above A: A(0) B(2) C(3) D(5) E(7) F(8) G(10)

    def test_root_pitch_in_a_minor(self):
        assert gen.pitch_in_key(57, 9, "minor") is True   # A3

    def test_minor_scale_degrees_in_a_minor(self):
        # B3=59 (+2), C4=60 (+3), D4=62 (+5), E4=64 (+7), F4=65 (+8), G4=67 (+10)
        for pitch in [59, 60, 62, 64, 65, 67]:
            assert gen.pitch_in_key(pitch, 9, "minor") is True, f"pitch {pitch} should be in A minor"

    def test_chromatic_pitches_not_in_a_minor(self):
        # C#4=61 (+4), D#4=63 (+6), F#4=66 (+9), G#4=68 (+11)
        for pitch in [61, 63, 66, 68]:
            assert gen.pitch_in_key(pitch, 9, "minor") is False, f"pitch {pitch} should not be in A minor"

    def test_octave_independence(self):
        # A2=45, A3=57, A4=69 — all same note class
        for pitch in [45, 57, 69]:
            assert gen.pitch_in_key(pitch, 9, "minor") is True

    # C major  root=0  MAJOR_SCALE=[0,2,4,5,7,9,11]

    def test_major_vs_minor_differs_on_third(self):
        # E4=64: interval 4. In C major (4 ∈ MAJOR_SCALE) but not C minor (4 ∉ MINOR_SCALE).
        assert gen.pitch_in_key(64, 0, "major") is True
        assert gen.pitch_in_key(64, 0, "minor") is False

    def test_major_seventh_in_major_not_minor(self):
        # B4=71: interval 11. In C major (11 ∈ MAJOR_SCALE) but not C minor (11 ∉ MINOR_SCALE).
        assert gen.pitch_in_key(71, 0, "major") is True
        assert gen.pitch_in_key(71, 0, "minor") is False

    def test_minor_third_in_minor_not_major(self):
        # Eb4=63: interval 3. In C minor (3 ∈ MINOR_SCALE) but not C major (3 ∉ MAJOR_SCALE).
        assert gen.pitch_in_key(63, 0, "minor") is True
        assert gen.pitch_in_key(63, 0, "major") is False


# ─── mutate_note ──────────────────────────────────────────────────────────────

class TestMutateNote:
    def _note(self, pitch=60, velocity=80, start=1.0, duration=1.0):
        return gen.Note(
            pitch=pitch,
            velocity=velocity,
            start_beat=start,
            duration_beats=duration,
            register=gen.detect_register(pitch),
        )

    def test_returns_note_instance(self):
        result = gen.mutate_note(self._note(), "A minor")
        assert isinstance(result, gen.Note)

    def test_duration_clamped_to_minimum_unconditionally(self):
        for tiny in [0.0, 0.001, 0.124]:
            result = gen.mutate_note(self._note(duration=tiny), "A minor")
            assert result.duration_beats >= 0.125, f"duration {tiny} → {result.duration_beats}"

    def test_duration_clamped_to_maximum_unconditionally(self):
        for huge in [4.001, 10.0, 99.0]:
            result = gen.mutate_note(self._note(duration=huge), "A minor")
            assert result.duration_beats <= 4.0, f"duration {huge} → {result.duration_beats}"

    def test_duration_at_boundaries_unchanged(self):
        assert gen.mutate_note(self._note(duration=0.125), "A minor").duration_beats >= 0.125
        assert gen.mutate_note(self._note(duration=4.0), "A minor").duration_beats <= 4.0

    def test_output_rounded_to_4_decimal_places(self):
        result = gen.mutate_note(self._note(start=1.123456789, duration=1.987654321), "A minor")
        assert result.start_beat == round(result.start_beat, 4)
        assert result.duration_beats == round(result.duration_beats, 4)

    def test_register_always_derived_from_output_pitch(self):
        # Register on the returned Note must match detect_register(output pitch), not input.
        for pitch in [40, 60, 75]:
            result = gen.mutate_note(self._note(pitch=pitch), "A minor")
            assert result.register == gen.detect_register(result.pitch)

    def test_velocity_clamped_when_mutation_fires(self):
        # Run enough iterations (seeded by autouse fixture) to exercise the 35% branch.
        # When velocity changes, it must be within the clamped range.
        base = self._note(velocity=80)
        for _ in range(200):
            result = gen.mutate_note(base, "A minor")
            if result.velocity != 80:
                assert 35 <= result.velocity <= 127, f"mutated velocity {result.velocity} out of range"

    def test_pitch_in_global_range_when_mutation_fires(self):
        # nearest_pitch_in_key clamps to [GLOBAL_MIN_PITCH, GLOBAL_MAX_PITCH].
        base = self._note(pitch=60)
        for _ in range(200):
            result = gen.mutate_note(base, "A minor")
            if result.pitch != 60:
                assert gen.GLOBAL_MIN_PITCH <= result.pitch <= gen.GLOBAL_MAX_PITCH, (
                    f"mutated pitch {result.pitch} out of global range"
                )

    def test_mutated_pitch_is_in_target_key(self):
        base = self._note(pitch=57)  # A3 — in A minor
        root, mode = gen.parse_key("A minor")
        for _ in range(200):
            result = gen.mutate_note(base, "A minor")
            if result.pitch != 57:
                assert gen.pitch_in_key(result.pitch, root, mode), (
                    f"mutated pitch {result.pitch} not in A minor"
                )


# ─── score_generated_notes ────────────────────────────────────────────────────

class TestScoreGeneratedNotes:
    def _note(self, pitch, start=0.0):
        return gen.Note(
            pitch=pitch,
            velocity=80,
            start_beat=start,
            duration_beats=1.0,
            register=gen.detect_register(pitch),
        )

    def test_empty_list_returns_sentinel(self):
        assert gen.score_generated_notes([]) == -9999.0

    def test_good_pattern_scores_positively(self):
        # Bass(40,42) + mid(55,57,60,62) + top(72,74), range=34 → score=54
        notes = [
            self._note(40, 0.0), self._note(42, 1.0),
            self._note(55, 2.0), self._note(57, 3.0),
            self._note(60, 4.0), self._note(62, 5.0),
            self._note(72, 6.0), self._note(74, 7.0),
        ]
        assert gen.score_generated_notes(notes) > 0

    def test_fewer_than_8_notes_penalized(self):
        # 4 notes (sparse) get -25 penalty; 10 varied notes do not
        sparse = [self._note(60, float(i)) for i in range(4)]
        varied = [self._note(60 + i, float(i)) for i in range(10)]
        assert gen.score_generated_notes(sparse) < gen.score_generated_notes(varied)

    def test_single_repeated_pitch_scores_worse_than_varied(self):
        single = [self._note(60, float(i)) for i in range(10)]
        varied = [self._note(48 + i * 3, float(i)) for i in range(10)]
        assert gen.score_generated_notes(single) < gen.score_generated_notes(varied)

    def test_narrow_pitch_range_penalized(self):
        # Range=1 (<7) → -20 penalty
        narrow = [self._note(60 + (i % 2), float(i)) for i in range(10)]
        # Range=27 (12–42) → +15 bonus
        wide = [self._note(40 + i * 3, float(i)) for i in range(10)]
        assert gen.score_generated_notes(narrow) < gen.score_generated_notes(wide)

    def test_too_many_notes_penalized(self):
        # 95 notes → -20; 20 notes (same pitch set) → no penalty
        many = [self._note(48 + (i % 20), float(i) * 0.1) for i in range(95)]
        few  = [self._note(48 + (i % 20), float(i) * 0.5) for i in range(20)]
        assert gen.score_generated_notes(many) < gen.score_generated_notes(few)

    def test_all_registers_present_scores_higher_than_mid_only(self):
        # mixed (bass+mid+top) scores higher than same-count mid-only notes
        mid_only = [self._note(60 + i, float(i)) for i in range(8)]
        mixed = [
            self._note(40, 0.0), self._note(42, 1.0),   # bass
            self._note(55, 2.0), self._note(57, 3.0),   # mid
            self._note(60, 4.0), self._note(62, 5.0),   # mid
            self._note(72, 6.0), self._note(74, 7.0),   # top
        ]
        assert gen.score_generated_notes(mixed) > gen.score_generated_notes(mid_only)

    def test_big_pitch_jumps_reduce_score(self):
        # Same 10 pitches (same unique count / range / registers), different order.
        # Ascending order → 0 jumps >19 semitones (score 47).
        # Interleaved low-high → 3 jumps >19 semitones (score 39.5).
        pitches = [48, 51, 54, 57, 60, 63, 66, 69, 72, 75]
        smooth = [self._note(p, float(i)) for i, p in enumerate(pitches)]
        jumpy  = [self._note(p, float(i)) for i, p in enumerate([48, 75, 51, 72, 54, 69, 57, 66, 60, 63])]
        assert gen.score_generated_notes(jumpy) < gen.score_generated_notes(smooth)


# ─── normalize_to_4_bars ──────────────────────────────────────────────────────

class TestNormalizeTo4Bars:
    def _note(self, pitch=60, start=0.0, duration=1.0):
        return gen.Note(
            pitch=pitch,
            velocity=80,
            start_beat=start,
            duration_beats=duration,
            register=gen.detect_register(pitch),
        )

    def test_empty_list_returns_empty(self):
        assert gen.normalize_to_4_bars([]) == []

    def test_note_within_range_unchanged(self):
        result = gen.normalize_to_4_bars([self._note(start=2.0, duration=1.0)])
        assert result[0].start_beat == 2.0
        assert result[0].duration_beats == 1.0

    def test_note_past_16_beats_wraps(self):
        # TOTAL_BEATS = 16; start=18.0 → wraps to 2.0
        result = gen.normalize_to_4_bars([self._note(start=18.0, duration=1.0)])
        assert result[0].start_beat == 2.0

    def test_duration_truncated_to_avoid_overrun(self):
        # start=15.0, duration=4.0 would overrun TOTAL_BEATS(16) by 3 beats
        result = gen.normalize_to_4_bars([self._note(start=15.0, duration=4.0)])
        assert result[0].start_beat == 15.0
        assert result[0].duration_beats == 1.0

    def test_non_positive_duration_is_dropped(self):
        # duration <= 0 fails the `duration <= 0` guard regardless of start position.
        result = gen.normalize_to_4_bars([self._note(start=2.0, duration=0.0)])
        assert result == []

    def test_register_recomputed_from_pitch(self):
        result = gen.normalize_to_4_bars([self._note(pitch=40, start=0.0)])
        assert result[0].register == gen.detect_register(40)


# ─── remove_too_dense_duplicates ──────────────────────────────────────────────

class TestRemoveTooDenseDuplicates:
    def _note(self, pitch=60, start=0.0):
        return gen.Note(
            pitch=pitch,
            velocity=80,
            start_beat=start,
            duration_beats=1.0,
            register=gen.detect_register(pitch),
        )

    def test_empty_list_returns_empty(self):
        assert gen.remove_too_dense_duplicates([]) == []

    def test_exact_duplicate_start_and_pitch_removed(self):
        notes = [self._note(60, 1.0), self._note(60, 1.0)]
        result = gen.remove_too_dense_duplicates(notes)
        assert len(result) == 1

    def test_different_pitches_at_same_start_survive(self):
        notes = [self._note(60, 1.0), self._note(64, 1.0)]
        result = gen.remove_too_dense_duplicates(notes)
        assert len(result) == 2

    def test_same_pitch_at_different_starts_survive(self):
        notes = [self._note(60, 1.0), self._note(60, 2.0)]
        result = gen.remove_too_dense_duplicates(notes)
        assert len(result) == 2

    def test_result_sorted_by_start_then_pitch(self):
        notes = [self._note(64, 2.0), self._note(60, 1.0), self._note(62, 1.0)]
        result = gen.remove_too_dense_duplicates(notes)
        assert [(n.start_beat, n.pitch) for n in result] == [(1.0, 60), (1.0, 62), (2.0, 64)]


# ─── reduce_repeated_notes ─────────────────────────────────────────────────────

class TestReduceRepeatedNotes:
    def _note(self, pitch=60, start=0.0):
        return gen.Note(
            pitch=pitch,
            velocity=80,
            start_beat=start,
            duration_beats=1.0,
            register=gen.detect_register(pitch),
        )

    def test_fewer_than_3_notes_returned_unchanged(self):
        notes = [self._note(60, 0.0), self._note(60, 1.0)]
        result = gen.reduce_repeated_notes(notes, "A minor")
        assert result == notes

    def test_short_run_of_two_survives(self):
        notes = [self._note(60, 0.0), self._note(60, 1.0), self._note(64, 2.0)]
        result = gen.reduce_repeated_notes(notes, "A minor")
        pitches = [n.pitch for n in result]
        assert pitches[:2] == [60, 60]

    def test_run_of_3_plus_same_pitch_third_note_changed(self):
        notes = [self._note(60, 0.0), self._note(60, 1.0), self._note(60, 2.0)]
        result = gen.reduce_repeated_notes(notes, "A minor")
        pitches = [n.pitch for n in result]
        assert pitches[0] == 60
        assert pitches[1] == 60
        assert pitches[2] != 60

    def test_run_of_4_breaks_up_third_and_continues(self):
        notes = [self._note(60, float(i)) for i in range(4)]
        result = gen.reduce_repeated_notes(notes, "A minor")
        pitches = [n.pitch for n in result]
        # 1st,2nd unchanged; 3rd forced to differ from 2nd (previous_pitch)
        assert pitches[0] == 60 and pitches[1] == 60
        assert pitches[2] != 60

    def test_empty_list_after_length_check_not_reached(self):
        # len < 3 short-circuits before touching notes; explicit empty-list case
        assert gen.reduce_repeated_notes([], "A minor") == []

    def test_register_recomputed_from_final_pitch(self):
        notes = [self._note(60, float(i)) for i in range(3)]
        result = gen.reduce_repeated_notes(notes, "A minor")
        for note in result:
            assert note.register == gen.detect_register(note.pitch)


# ─── force_first_note_to_start ─────────────────────────────────────────────────

class TestForceFirstNoteToStart:
    def _note(self, pitch=60, start=0.0):
        return gen.Note(
            pitch=pitch,
            velocity=80,
            start_beat=start,
            duration_beats=1.0,
            register=gen.detect_register(pitch),
        )

    def test_empty_list_returns_empty(self):
        assert gen.force_first_note_to_start([]) == []

    def test_first_note_already_at_zero_unchanged(self):
        notes = [self._note(60, 0.0), self._note(64, 1.0)]
        result = gen.force_first_note_to_start(notes)
        assert result[0].start_beat == 0.0
        assert result[1].start_beat == 1.0

    def test_first_note_shifts_to_zero(self):
        notes = [self._note(60, 2.0), self._note(64, 3.0)]
        result = gen.force_first_note_to_start(notes)
        assert result[0].start_beat == 0.0

    def test_all_other_notes_shift_by_same_delta(self):
        notes = [self._note(60, 2.0), self._note(64, 5.0), self._note(67, 3.5)]
        result = gen.force_first_note_to_start(sorted(notes, key=lambda n: n.start_beat))
        starts = sorted(n.start_beat for n in result)
        assert starts == [0.0, 1.5, 3.0]


# ─── write_midi ───────────────────────────────────────────────────────────────

class TestWriteMidi:
    def _notes(self):
        return [
            gen.Note(pitch=60, velocity=80, start_beat=0.0, duration_beats=1.0, register="mid"),
            gen.Note(pitch=64, velocity=90, start_beat=1.0, duration_beats=0.5, register="mid"),
            gen.Note(pitch=67, velocity=70, start_beat=2.0, duration_beats=1.5, register="mid"),
        ]

    def test_file_is_created(self, tmp_path):
        out = tmp_path / "test.mid"
        gen.write_midi(self._notes(), out, bpm=120.0)
        assert out.exists()

    def test_file_is_non_empty(self, tmp_path):
        out = tmp_path / "test.mid"
        gen.write_midi(self._notes(), out, bpm=120.0)
        assert out.stat().st_size > 0

    def test_midi_has_exactly_one_track(self, tmp_path):
        out = tmp_path / "test.mid"
        gen.write_midi(self._notes(), out, bpm=120.0)
        assert len(mido.MidiFile(str(out)).tracks) == 1

    def test_track_name_meta_message(self, tmp_path):
        out = tmp_path / "test.mid"
        gen.write_midi(self._notes(), out, bpm=120.0)
        track = mido.MidiFile(str(out)).tracks[0]
        names = [m.name for m in track if m.type == "track_name"]
        assert names == ["Pattern Generator From Analysis"]

    def test_tempo_meta_message_matches_bpm(self, tmp_path):
        out = tmp_path / "test.mid"
        gen.write_midi(self._notes(), out, bpm=120.0)
        track = mido.MidiFile(str(out)).tracks[0]
        tempos = [m for m in track if m.type == "set_tempo"]
        assert len(tempos) == 1
        assert tempos[0].tempo == mido.bpm2tempo(120.0)

    def test_note_on_and_off_counts_match_input(self, tmp_path):
        notes = self._notes()
        out = tmp_path / "test.mid"
        gen.write_midi(notes, out, bpm=120.0)
        track = mido.MidiFile(str(out)).tracks[0]
        note_ons  = [m for m in track if m.type == "note_on"]
        note_offs = [m for m in track if m.type == "note_off"]
        assert len(note_ons) == len(notes)
        assert len(note_offs) == len(notes)

    def test_note_pitches_and_velocities_round_trip(self, tmp_path):
        notes = self._notes()
        out = tmp_path / "test.mid"
        gen.write_midi(notes, out, bpm=120.0)
        track = mido.MidiFile(str(out)).tracks[0]
        note_ons = sorted(
            [m for m in track if m.type == "note_on"],
            key=lambda m: m.note,
        )
        expected = sorted(notes, key=lambda n: n.pitch)
        for msg, note in zip(note_ons, expected):
            assert msg.note == note.pitch
            assert msg.velocity == note.velocity

    def test_empty_notes_produces_valid_midi(self, tmp_path):
        out = tmp_path / "test.mid"
        gen.write_midi([], out, bpm=120.0)
        mid = mido.MidiFile(str(out))
        assert len(mid.tracks) == 1
        note_ons = [m for m in mid.tracks[0] if m.type == "note_on"]
        assert note_ons == []
