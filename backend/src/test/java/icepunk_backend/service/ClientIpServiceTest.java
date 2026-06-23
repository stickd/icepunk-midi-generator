package icepunk_backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ClientIpServiceTest {

    private final ClientIpService service = new ClientIpService();

    @Test
    void usesFirstForwardedForIpWhenPresent() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "203.0.113.10, 10.0.0.1");
        request.setRemoteAddr("127.0.0.1");

        assertEquals("203.0.113.10", service.getClientIp(request));
    }

    @Test
    void fallsBackToRemoteAddr() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");

        assertEquals("127.0.0.1", service.getClientIp(request));
    }
}
