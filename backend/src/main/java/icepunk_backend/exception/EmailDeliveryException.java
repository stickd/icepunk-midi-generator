package icepunk_backend.exception;
public class EmailDeliveryException extends RuntimeException {
    public EmailDeliveryException() { super("We could not send a verification email. Please try again later."); }
}
