package icepunk_backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.sound.midi.MetaMessage;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import javax.sound.midi.ShortMessage;
import javax.sound.midi.Track;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

class MidiMetadataExtractorTest {

    @TempDir
    Path tempDir;

    private final MidiMetadataExtractor extractor = new MidiMetadataExtractor();

    @Test
    void extractsMetadataAndPreviewNotesFromValidMidiFile() throws Exception {
        Path midiPath = tempDir.resolve("preview.mid");
        writeSimpleMidi(midiPath);

        MidiMetadataExtractor.MidiMetadata metadata = extractor.extract(midiPath);

        assertEquals(1, metadata.noteCount());
        assertEquals(1, metadata.trackCount());
        assertEquals(60, metadata.minPitch());
        assertEquals(60, metadata.maxPitch());
        assertEquals(60.0, metadata.avgPitch());
        assertEquals(120, metadata.bpm());
        assertEquals(1, metadata.preview().notes().size());
        assertFalse(metadata.preview().truncated());
        assertEquals(60, metadata.preview().notes().get(0).pitch());
    }

    @Test
    void corruptedMidiReturnsEmptyMetadataSafely() throws Exception {
        Path midiPath = tempDir.resolve("broken.mid");
        java.nio.file.Files.writeString(midiPath, "not-midi");

        MidiMetadataExtractor.MidiMetadata metadata = extractor.extract(midiPath);

        assertNull(metadata.noteCount());
        assertEquals(0, metadata.preview().notes().size());
        assertFalse(metadata.preview().truncated());
    }

    private void writeSimpleMidi(Path midiPath) throws Exception {
        Sequence sequence = new Sequence(Sequence.PPQ, 480);
        Track track = sequence.createTrack();

        MetaMessage tempo = new MetaMessage();
        tempo.setMessage(0x51, new byte[] { 0x07, (byte) 0xA1, 0x20 }, 3);
        track.add(new javax.sound.midi.MidiEvent(tempo, 0));

        ShortMessage noteOn = new ShortMessage();
        noteOn.setMessage(ShortMessage.NOTE_ON, 0, 60, 96);
        track.add(new javax.sound.midi.MidiEvent(noteOn, 0));

        ShortMessage noteOff = new ShortMessage();
        noteOff.setMessage(ShortMessage.NOTE_OFF, 0, 60, 0);
        track.add(new javax.sound.midi.MidiEvent(noteOff, 480));

        MidiSystem.write(sequence, 1, midiPath.toFile());
    }
}
