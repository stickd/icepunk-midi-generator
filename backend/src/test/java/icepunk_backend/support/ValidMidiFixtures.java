package icepunk_backend.support;

/** Minimal, parseable Standard MIDI File used by upload-path tests. */
public final class ValidMidiFixtures {
    private static final byte[] SINGLE_NOTE = {
            'M', 'T', 'h', 'd', 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
            'M', 'T', 'r', 'k', 0, 0, 0, 12,
            0, (byte) 0x90, 60, 64,
            96, (byte) 0x80, 60, 64,
            0, (byte) 0xff, 0x2f, 0
    };

    private ValidMidiFixtures() {
    }

    public static byte[] singleNoteStandardMidi() {
        return SINGLE_NOTE.clone();
    }
}
