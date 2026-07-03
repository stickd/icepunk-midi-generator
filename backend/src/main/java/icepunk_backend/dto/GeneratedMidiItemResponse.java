package icepunk_backend.dto;

import java.util.UUID;

public record GeneratedMidiItemResponse(
        UUID id,
        int index,
        String fileName,
        String downloadUrl,
        Double durationSeconds,
        Integer noteCount,
        Integer trackCount,
        Integer minPitch,
        Integer maxPitch,
        Double avgPitch,
        Integer bpm,
        MidiPreviewResponse preview
) {
}
