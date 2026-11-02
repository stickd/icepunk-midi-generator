package icepunk_backend.service;

import icepunk_backend.exception.UploadValidationException;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

/** Validates a small, format-specific signature before sample storage. */
@Component
public class SampleUploadValidator {

    public void validate(MultipartFile file) {
        String filename = file.getOriginalFilename();
        if (filename == null) {
            throw new UploadValidationException("Sample file content is invalid.");
        }

        try (InputStream input = file.getInputStream()) {
            byte[] header = input.readNBytes(12);
            String lowerFilename = filename.toLowerCase(Locale.ROOT);
            boolean valid = lowerFilename.endsWith(".wav") ? isWav(header) : isMp3(header);
            if (!valid) {
                throw new UploadValidationException("Sample file content does not match its declared format.");
            }
        } catch (IOException exception) {
            throw new UploadValidationException("Sample file could not be read.");
        }
    }

    private boolean isWav(byte[] header) {
        return header.length >= 12
                && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
                && header[8] == 'W' && header[9] == 'A' && header[10] == 'V' && header[11] == 'E';
    }

    private boolean isMp3(byte[] header) {
        if (header.length >= 3 && header[0] == 'I' && header[1] == 'D' && header[2] == '3') {
            return true;
        }
        return header.length >= 2 && (header[0] & 0xFF) == 0xFF
                && (header[1] & 0xE0) == 0xE0 && (header[1] & 0x06) != 0;
    }
}
