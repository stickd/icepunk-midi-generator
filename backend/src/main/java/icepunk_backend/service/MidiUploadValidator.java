package icepunk_backend.service;

import icepunk_backend.exception.UploadValidationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import javax.sound.midi.MidiEvent;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import javax.sound.midi.Track;
import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Set;

/** Bounded, shared validation for every user-supplied MIDI file. */
@Component
public class MidiUploadValidator {
    private static final Set<String> MIME_TYPES = Set.of("audio/midi", "audio/mid", "audio/x-midi", "application/x-midi", "application/octet-stream");
    private final long maxSize; private final int maxTracks; private final int maxEvents; private final int maxNotes; private final long maxTicks; private final long maxDurationMicros; private final int maxTempoChanges;

    public MidiUploadValidator(@Value("${uploads.midi.max-size-bytes:2097152}") long maxSize,
            @Value("${midi.limits.max-tracks:64}") int maxTracks, @Value("${midi.limits.max-events:100000}") int maxEvents,
            @Value("${midi.limits.max-notes:50000}") int maxNotes, @Value("${midi.limits.max-ticks:10000000}") long maxTicks,
            @Value("${midi.limits.max-duration-seconds:3600}") long maxDurationSeconds, @Value("${midi.limits.max-tempo-changes:1000}") int maxTempoChanges) {
        this.maxSize=maxSize; this.maxTracks=maxTracks; this.maxEvents=maxEvents; this.maxNotes=maxNotes; this.maxTicks=maxTicks;
        this.maxDurationMicros=Math.multiplyExact(maxDurationSeconds, 1_000_000L); this.maxTempoChanges=maxTempoChanges;
    }

    public void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new UploadValidationException("MIDI file is required.");
        if (file.getSize() > maxSize) throw new UploadValidationException("MIDI file is too large.");
        String name = file.getOriginalFilename();
        if (name == null || !name.toLowerCase(Locale.ROOT).matches(".*\\.(mid|midi)$")) throw new UploadValidationException("Only .mid and .midi files are supported.");
        String type = file.getContentType();
        if (type != null && !type.isBlank() && !MIME_TYPES.contains(type.toLowerCase(Locale.ROOT))) throw new UploadValidationException("MIDI file type is not supported.");
        try (InputStream input = new BufferedInputStream(file.getInputStream())) {
            input.mark(4); byte[] header = input.readNBytes(4); input.reset();
            if (header.length != 4 || header[0] != 'M' || header[1] != 'T' || header[2] != 'h' || header[3] != 'd') throw new UploadValidationException("File is not a valid Standard MIDI file.");
            Sequence sequence = MidiSystem.getSequence(input);
            Track[] tracks = sequence.getTracks();
            if (tracks.length > maxTracks || sequence.getTickLength() > maxTicks || sequence.getMicrosecondLength() > maxDurationMicros) throw new UploadValidationException("MIDI exceeds configured complexity limits.");
            int events=0, notes=0, tempos=0;
            for (Track track: tracks) for (int i=0;i<track.size();i++) { MidiEvent event=track.get(i); if (++events>maxEvents) throw new UploadValidationException("MIDI has too many events.");
                byte[] bytes=event.getMessage().getMessage(); if (bytes.length>1 && (bytes[0]&0xf0)==0x90 && bytes.length>2 && bytes[2]!=0 && ++notes>maxNotes) throw new UploadValidationException("MIDI has too many notes.");
                if (bytes.length>0 && (bytes[0]&0xff)==0xff && bytes.length>1 && (bytes[1]&0xff)==0x51 && ++tempos>maxTempoChanges) throw new UploadValidationException("MIDI has too many tempo changes."); }
        } catch (UploadValidationException e) { throw e; } catch (Exception e) { throw new UploadValidationException("File is not a valid Standard MIDI file."); }
    }
}
