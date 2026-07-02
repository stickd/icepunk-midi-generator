package icepunk_backend.exception;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/*
 * | EP                       | Handler                       | Expected status | Body                        |
 * |--------------------------|-------------------------------|-----------------|-----------------------------|
 * | validation error         | handleValidationErrors        | 400             | error + fields map          |
 * | invalid credentials      | handleInvalidCredentials      | 401             | error = message             |
 * | duplicate email/username | handleDuplicateUser           | 409             | error = message             |
 * | data integrity violation | handleDataIntegrityViolation  | 409             | error = "Account already.." |
 * | generation limit         | handleGenerationLimit         | 429             | error = message             |
 * | rate limit               | handleRateLimit               | 429             | error = message             |
 * | server busy              | handleServerBusy              | 429             | error = message             |
 * | storage timeout          | handleStorageTimeout          | 504             | error = message             |
 * | storage error            | handleStorage                 | 502             | error = message             |
 * | unexpected runtime       | handleRuntimeException        | 500             | generic, no stack trace     |
 *
 * Note: 403 forbidden is enforced by Spring Security's filter chain, not this
 * @RestControllerAdvice (an AccessDeniedException is raised in the filters,
 * before the DispatcherServlet, so this advice never sees it). The forbidden
 * cases — no token and invalid token on a protected endpoint — are therefore
 * covered in SecurityConfigTest, not here.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void validationErrorReturns400WithFieldMessages() {
        MethodArgumentNotValidException exception = mock(MethodArgumentNotValidException.class);
        BindingResult bindingResult = mock(BindingResult.class);
        FieldError fieldError = new FieldError("registerRequest", "email", "must not be blank");
        when(exception.getBindingResult()).thenReturn(bindingResult);
        when(bindingResult.getFieldErrors()).thenReturn(List.of(fieldError));

        ResponseEntity<Map<String, Object>> response = handler.handleValidationErrors(exception);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("Validation failed", response.getBody().get("error"));
        @SuppressWarnings("unchecked")
        Map<String, String> fields = (Map<String, String>) response.getBody().get("fields");
        assertEquals("must not be blank", fields.get("email"));
    }

    @Test
    void invalidCredentialsReturns401() {
        ResponseEntity<Map<String, String>> response =
                handler.handleInvalidCredentials(new InvalidCredentialsException("Invalid email or password"));

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertEquals("Invalid email or password", response.getBody().get("error"));
    }

    @Test
    void duplicateUserReturns409() {
        ResponseEntity<Map<String, String>> response =
                handler.handleDuplicateUser(new EmailAlreadyExistsException("Email already exists"));

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals("Email already exists", response.getBody().get("error"));
    }

    @Test
    void dataIntegrityViolationReturns409WithGenericMessage() {
        ResponseEntity<Map<String, String>> response = handler.handleDataIntegrityViolation();

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals("Account already exists", response.getBody().get("error"));
    }

    @Test
    void generationLimitReturns429() {
        ResponseEntity<Map<String, String>> response =
                handler.handleGenerationLimit(new GenerationLimitException("Daily limit reached"));

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertEquals("Daily limit reached", response.getBody().get("error"));
    }

    @Test
    void rateLimitReturns429() {
        ResponseEntity<Map<String, String>> response =
                handler.handleRateLimit(new RateLimitException("Too many requests"));

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertEquals("Too many requests", response.getBody().get("error"));
    }

    @Test
    void serverBusyReturns429() {
        ResponseEntity<Map<String, String>> response =
                handler.handleServerBusy(new ServerBusyException("Server is busy. Try again later."));

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertEquals("Server is busy. Try again later.", response.getBody().get("error"));
    }

    @Test
    void storageTimeoutReturns504() {
        ResponseEntity<Map<String, String>> response =
                handler.handleStorageTimeout(new StorageTimeoutException("MIDI pack upload timed out. Please try again."));

        assertEquals(HttpStatus.GATEWAY_TIMEOUT, response.getStatusCode());
        assertEquals("MIDI pack upload timed out. Please try again.", response.getBody().get("error"));
    }

    @Test
    void storageFailureReturns502() {
        ResponseEntity<Map<String, String>> response =
                handler.handleStorage(new StorageException("MIDI pack upload failed. Please try again."));

        assertEquals(HttpStatus.BAD_GATEWAY, response.getStatusCode());
        assertEquals("MIDI pack upload failed. Please try again.", response.getBody().get("error"));
    }

    @Test
    void unexpectedRuntimeReturns500WithNoSensitiveData() {
        ResponseEntity<Map<String, String>> response = handler.handleRuntimeException();

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals("Unexpected server error", response.getBody().get("error"));
        // Body must not leak internals: only the generic "error" key, no stack trace.
        assertEquals(1, response.getBody().size());
        assertFalse(response.getBody().containsKey("trace"));
        assertTrue(response.getBody().values().stream()
                .noneMatch(v -> v.toLowerCase().contains("exception")));
    }
}
