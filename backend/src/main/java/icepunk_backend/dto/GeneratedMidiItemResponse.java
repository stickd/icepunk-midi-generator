package icepunk_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.UUID;

public record GeneratedMidiItemResponse(
        UUID id,
        int index,
        String fileName,
        @JsonIgnore String downloadUrl,
        Double durationSeconds,
        Integer noteCount,
        Integer trackCount,
        Integer minPitch,
        Integer maxPitch,
        Double avgPitch,
        Integer bpm,
        MidiPreviewResponse preview,
        boolean canPreview,
        boolean canDownload
) {
}
