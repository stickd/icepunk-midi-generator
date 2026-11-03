package icepunk_backend.exception;
public class EmailNotVerifiedException extends RuntimeException {
    public EmailNotVerifiedException() { super("Please verify your email before continuing."); }
}
