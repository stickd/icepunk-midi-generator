package icepunk_backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import icepunk_backend.exception.EmailDeliveryException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

@Service
@ConditionalOnProperty(name = "email.delivery.mode", havingValue = "resend", matchIfMissing = true)
public class ResendEmailService implements EmailService {
    private final ObjectMapper objectMapper;
    private final String apiKey, from, frontendUrl;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public ResendEmailService(ObjectMapper objectMapper, @Value("${email.resend.api-key:}") String apiKey,
            @Value("${email.from:}") String from, @Value("${app.frontend-url:http://localhost:3000}") String frontendUrl) {
        this.objectMapper = objectMapper; this.apiKey = apiKey; this.from = from; this.frontendUrl = frontendUrl;
    }

    @Override
    public void sendVerificationEmail(String email, String rawToken) {
        try {
            String link = frontendUrl.replaceAll("/+$", "") + "/verify-email?token=" + rawToken;
            String html = "<div style=\"font-family:Arial,sans-serif;background:#07131e;color:#edf8ff;padding:32px\">"
                    + "<h1 style=\"color:#76d7ff\">ICEPUNK</h1><p>Confirm your email to enter the generator.</p>"
                    + "<p><a style=\"background:#2aa8e8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none\" href=\"" + link + "\">Verify email</a></p>"
                    + "<p>This link expires soon. If you did not create an ICEPUNK account, you can ignore this email.</p></div>";
            send(email, "Verify your ICEPUNK email", html);
        } catch (EmailDeliveryException exception) { throw exception;
        } catch (Exception exception) { throw new EmailDeliveryException(); }
    }

    @Override
    public void sendContentReportReceipt(String email, java.util.UUID reportId) {
        send(email, "ICEPUNK report received", "<p>We received your content report.</p><p>Reference: <strong>"
                + reportId + "</strong></p><p>Keep this reference if you contact us about the report.</p>");
    }

    @Override
    public void sendModerationDecision(String email, String contentReference, String decision, String reason) {
        String safeReference = escape(contentReference);
        String safeDecision = escape(decision);
        String safeReason = escape(reason);
        String link = frontendUrl.replaceAll("/+$", "") + "/moderation";
        send(email, "ICEPUNK moderation decision", "<p>A moderation decision was made for content <strong>"
                + safeReference + "</strong>.</p><p>Decision: <strong>" + safeDecision + "</strong></p><p>Reason: "
                + safeReason + "</p><p><a href=\"" + link + "\">View decision or submit an appeal</a></p>");
    }

    @Override
    public void sendContentReportDecision(String email, java.util.UUID reportId, String decision, String reason) {
        send(email, "ICEPUNK report decision", "<p>A decision was made for your report <strong>"
                + reportId + "</strong>.</p><p>Decision: <strong>" + escape(decision) + "</strong></p><p>Reason: "
                + escape(reason) + "</p>");
    }

    private void send(String email, String subject, String html) {
        if (apiKey.isBlank() || from.isBlank()) throw new EmailDeliveryException();
        try {
            String body = objectMapper.writeValueAsString(Map.of("from", from, "to", new String[]{email}, "subject", subject, "html", html));
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.resend.com/emails"))
                    .timeout(Duration.ofSeconds(15)).header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8)).build();
            int status = client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status < 200 || status >= 300) throw new EmailDeliveryException();
        } catch (EmailDeliveryException exception) { throw exception;
        } catch (Exception exception) { throw new EmailDeliveryException(); }
    }

    private static String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
}
