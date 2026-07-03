package icepunk_backend.service;

import icepunk_backend.dto.MidiPreviewNoteResponse;
import icepunk_backend.dto.MidiPreviewResponse;
import org.springframework.stereotype.Service;

import javax.sound.midi.MetaMessage;
import javax.sound.midi.MidiEvent;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import javax.sound.midi.ShortMessage;
import javax.sound.midi.Track;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class MidiMetadataExtractor {

    private static final int PREVIEW_NOTE_LIMIT = 300;
    private static final int DEFAULT_BPM = 120;

    public MidiMetadata extract(Path midiPath) {
        try {
            Sequence sequence = MidiSystem.getSequence(midiPath.toFile());
            double ticksPerBeat = sequence.getResolution() > 0 ? sequence.getResolution() : 480.0;
            double bpm = extractBpm(sequence);
            double secondsPerTick = 60.0 / bpm / ticksPerBeat;
            List<ParsedNote> notes = extractNotes(sequence, secondsPerTick);

            Integer minPitch = null;
            Integer maxPitch = null;
            double pitchSum = 0.0;

            for (ParsedNote note : notes) {
                minPitch = minPitch == null ? note.pitch() : Math.min(minPitch, note.pitch());
                maxPitch = maxPitch == null ? note.pitch() : Math.max(maxPitch, note.pitch());
                pitchSum += note.pitch();
            }

            List<MidiPreviewNoteResponse> previewNotes = notes.stream()
                    .sorted(Comparator.comparingDouble(ParsedNote::start))
                    .limit(PREVIEW_NOTE_LIMIT)
                    .map(note -> new MidiPreviewNoteResponse(
                            note.pitch(),
                            round(note.start()),
                            round(note.duration()),
                            note.velocity()
                    ))
                    .toList();

            return new MidiMetadata(
                    round(sequence.getMicrosecondLength() / 1_000_000.0),
                    notes.size(),
                    sequence.getTracks().length,
                    minPitch,
                    maxPitch,
                    notes.isEmpty() ? null : round(pitchSum / notes.size()),
                    (int) Math.round(bpm),
                    new MidiPreviewResponse(previewNotes, notes.size() > PREVIEW_NOTE_LIMIT)
            );
        } catch (Exception exception) {
            return MidiMetadata.empty();
        }
    }

    private double extractBpm(Sequence sequence) {
        for (Track track : sequence.getTracks()) {
            for (int index = 0; index < track.size(); index++) {
                MidiEvent event = track.get(index);
                if (event.getMessage() instanceof MetaMessage metaMessage && metaMessage.getType() == 0x51) {
                    byte[] data = metaMessage.getData();
                    if (data.length == 3) {
                        int microsecondsPerQuarter =
                                ((data[0] & 0xff) << 16) | ((data[1] & 0xff) << 8) | (data[2] & 0xff);
                        if (microsecondsPerQuarter > 0) {
                            return 60_000_000.0 / microsecondsPerQuarter;
                        }
                    }
                }
            }
        }

        return DEFAULT_BPM;
    }

    private List<ParsedNote> extractNotes(Sequence sequence, double secondsPerTick) {
        List<ParsedNote> notes = new ArrayList<>();
        Map<String, ActiveNote> activeNotes = new HashMap<>();

        for (Track track : sequence.getTracks()) {
            for (int index = 0; index < track.size(); index++) {
                MidiEvent event = track.get(index);
                if (!(event.getMessage() instanceof ShortMessage message)) {
                    continue;
                }

                if (message.getCommand() == ShortMessage.NOTE_ON && message.getData2() > 0) {
                    activeNotes.put(noteKey(message), new ActiveNote(event.getTick(), message.getData2()));
                    continue;
                }

                boolean isNoteOff = message.getCommand() == ShortMessage.NOTE_OFF
                        || (message.getCommand() == ShortMessage.NOTE_ON && message.getData2() == 0);
                if (!isNoteOff) {
                    continue;
                }

                ActiveNote active = activeNotes.remove(noteKey(message));
                if (active == null) {
                    continue;
                }

                double start = active.startTick() * secondsPerTick;
                double duration = Math.max(secondsPerTick, (event.getTick() - active.startTick()) * secondsPerTick);
                notes.add(new ParsedNote(message.getData1(), start, duration, active.velocity()));
            }
        }

        return notes;
    }

    private String noteKey(ShortMessage message) {
        return message.getChannel() + ":" + message.getData1();
    }

    private double round(double value) {
        return Math.round(value * 10_000.0) / 10_000.0;
    }

    private record ActiveNote(long startTick, int velocity) {
    }

    private record ParsedNote(int pitch, double start, double duration, int velocity) {
    }

    public record MidiMetadata(
            Double durationSeconds,
            Integer noteCount,
            Integer trackCount,
            Integer minPitch,
            Integer maxPitch,
            Double avgPitch,
            Integer bpm,
            MidiPreviewResponse preview
    ) {
        private static MidiMetadata empty() {
            return new MidiMetadata(null, null, null, null, null, null, null, new MidiPreviewResponse(List.of(), false));
        }
    }
}
