"""Write generated notes to a MIDI file."""

from __future__ import annotations

from pathlib import Path

from mido import Message, MetaMessage, MidiFile, MidiTrack, bpm2tempo

from midistyle.config import DEFAULT_TICKS_PER_BEAT
from midistyle.generation.style import Note
from midistyle.util import clamp


def beat_to_ticks(beat: float, ticks_per_beat: int) -> int:
    return int(round(beat * ticks_per_beat))


def write_midi(notes: list[Note], output_path: Path, bpm: float) -> None:
    mid = MidiFile(ticks_per_beat=DEFAULT_TICKS_PER_BEAT)
    track = MidiTrack()
    mid.tracks.append(track)

    track.append(
        MetaMessage("track_name", name="Pattern Generator From Analysis", time=0)
    )
    track.append(MetaMessage("set_tempo", tempo=bpm2tempo(bpm), time=0))
    track.append(Message("program_change", program=81, channel=0, time=0))

    events: list[tuple[int, Message]] = []

    for note in notes:
        start_tick = beat_to_ticks(note.start_beat, DEFAULT_TICKS_PER_BEAT)
        duration_ticks = max(
            1, beat_to_ticks(note.duration_beats, DEFAULT_TICKS_PER_BEAT)
        )
        end_tick = start_tick + duration_ticks

        pitch = clamp(note.pitch, 0, 127)
        velocity = clamp(note.velocity, 1, 127)

        events.append(
            (
                start_tick,
                Message("note_on", note=pitch, velocity=velocity, channel=0, time=0),
            )
        )
        events.append(
            (end_tick, Message("note_off", note=pitch, velocity=0, channel=0, time=0))
        )

    events.sort(key=lambda item: item[0])

    last_tick = 0

    for absolute_tick, message in events:
        delta = absolute_tick - last_tick
        message.time = max(0, delta)
        track.append(message)
        last_tick = absolute_tick

    mid.save(output_path)
