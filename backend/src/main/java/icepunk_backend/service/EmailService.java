package icepunk_backend.service;

import java.util.UUID;

public interface EmailService {
    void sendVerificationEmail(String email, String rawToken);

    /** Best-effort delivery; callers must not expose a failed mail provider as a failed report. */
    default void sendContentReportReceipt(String email, UUID reportId) { }

    /** Does not include reporter identity or private operator notes. */
    default void sendModerationDecision(String email, String contentReference, String decision, String reason) { }

    /** Sent only to the optional contact address supplied with a report. */
    default void sendContentReportDecision(String email, UUID reportId, String decision, String reason) { }
}
