from collections import defaultdict
from pathlib import Path
from statistics import mean
from typing import Any

import mido
from mido import MidiFile

from .models import NoteEvent
from .music_theory import pitch_to_name


def extract_notes_from_midi(midi_path: Path) -> tuple[MidiFile, list[NoteEvent], list[dict[str, Any]], float | None]:
    mid = MidiFile(midi_path)
    ticks_per_beat = mid.ticks_per_beat

    notes: list[NoteEvent] = []
    tracks_info: list[dict[str, Any]] = []
    tempos: list[int] = []

    for track_index, track in enumerate(mid.tracks):
        absolute_tick = 0
        active_notes: dict[tuple[int, int], list[dict[str, int]]] = defaultdict(list)
        track_note_count = 0
        track_name = f"Track {track_index}"
        instruments: list[str] = []

        for msg in track:
            absolute_tick += msg.time

            if msg.type == "track_name":
                track_name = msg.name

            if msg.type == "set_tempo":
                tempos.append(msg.tempo)

            if msg.type == "program_change":
                instruments.append(f"program_{msg.program}_channel_{msg.channel}")

            if msg.type == "note_on" and msg.velocity > 0:
                key = (msg.channel, msg.note)
                active_notes[key].append(
                    {
                        "start_tick": absolute_tick,
                        "velocity": msg.velocity,
                    }
                )

            elif msg.type in {"note_off", "note_on"}:
                if hasattr(msg, "note") and hasattr(msg, "channel"):
                    key = (msg.channel, msg.note)
                    if active_notes[key]:
                        started = active_notes[key].pop(0)
                        start_tick = started["start_tick"]
                        end_tick = absolute_tick
                        duration_ticks = max(0, end_tick - start_tick)

                        notes.append(
                            NoteEvent(
                                pitch=msg.note,
                                pitch_name=pitch_to_name(msg.note),
                                velocity=started["velocity"],
                                start_tick=start_tick,
                                end_tick=end_tick,
                                duration_ticks=duration_ticks,
                                start_beat=start_tick / ticks_per_beat,
                                duration_beats=duration_ticks / ticks_per_beat,
                                channel=msg.channel,
                                track_index=track_index,
                            )
                        )
                        track_note_count += 1

        tracks_info.append(
            {
                "track_index": track_index,
                "track_name": track_name,
                "note_count": track_note_count,
                "instruments": sorted(set(instruments)),
            }
        )

    tempo_bpm_estimate = None
    if tempos:
        avg_tempo = mean(tempos)
        tempo_bpm_estimate = mido.tempo2bpm(avg_tempo)

    notes.sort(key=lambda n: (n.start_tick, n.pitch))
    return mid, notes, tracks_info, tempo_bpm_estimate
