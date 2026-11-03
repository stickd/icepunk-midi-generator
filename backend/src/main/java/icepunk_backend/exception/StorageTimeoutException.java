package icepunk_backend.exception;

public class StorageTimeoutException extends RuntimeException {

    public StorageTimeoutException(String message) {
        super(message);
    }
}
