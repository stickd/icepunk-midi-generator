package icepunk_backend.dto;

import java.util.List;

public record MidiPreviewResponse(
        List<MidiPreviewNoteResponse> notes,
        boolean truncated
) {
}
