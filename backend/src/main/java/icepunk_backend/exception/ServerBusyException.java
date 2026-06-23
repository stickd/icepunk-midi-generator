package icepunk_backend.exception;

public class ServerBusyException extends RuntimeException {

    public ServerBusyException(String message) {
        super(message);
    }
}
