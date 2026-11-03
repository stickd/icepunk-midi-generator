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
        if (apiKey.isBlank() || from.isBlank()) throw new EmailDeliveryException();
        try {
            String link = frontendUrl.replaceAll("/+$", "") + "/verify-email?token=" + rawToken;
            String html = "<div style=\"font-family:Arial,sans-serif;background:#07131e;color:#edf8ff;padding:32px\">"
                    + "<h1 style=\"color:#76d7ff\">ICEPUNK</h1><p>Confirm your email to enter the generator.</p>"
                    + "<p><a style=\"background:#2aa8e8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none\" href=\"" + link + "\">Verify email</a></p>"
                    + "<p>This link expires soon. If you did not create an ICEPUNK account, you can ignore this email.</p></div>";
            String body = objectMapper.writeValueAsString(Map.of("from", from, "to", new String[]{email},
                    "subject", "Verify your ICEPUNK email", "html", html));
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.resend.com/emails"))
                    .timeout(Duration.ofSeconds(15)).header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8)).build();
            int status = client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status < 200 || status >= 300) throw new EmailDeliveryException();
        } catch (EmailDeliveryException exception) { throw exception;
        } catch (Exception exception) { throw new EmailDeliveryException(); }
    }
}
