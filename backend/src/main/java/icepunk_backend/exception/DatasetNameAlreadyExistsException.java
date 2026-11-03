package icepunk_backend.exception;

public class DatasetNameAlreadyExistsException extends RuntimeException {

    public DatasetNameAlreadyExistsException(String message) {
        super(message);
    }
}
