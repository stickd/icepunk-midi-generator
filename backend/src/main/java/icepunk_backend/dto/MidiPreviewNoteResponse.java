package icepunk_backend.dto;

public record MidiPreviewNoteResponse(
        int pitch,
        double start,
        double duration,
        int velocity
) {
}
