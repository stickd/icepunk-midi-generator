package icepunk_backend.exception;

public class GenerationLimitException extends RuntimeException {

    public GenerationLimitException(String message) {
        super(message);
    }
}