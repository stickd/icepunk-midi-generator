package icepunk_backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.junit.jupiter.api.Assertions.assertEquals;

class ClientIpServiceTest {
    private final ClientIpService service = new ClientIpService("10.0.0.0/8,2001:db8:ffff::/48");

    @Test void directRequestCannotSpoofForwardedFor() {
        MockHttpServletRequest request = request("198.51.100.20", "203.0.113.7");
        assertEquals("198.51.100.20", service.getClientIp(request));
    }
    @Test void trustedProxyUsesClientBeforeTrustedChain() {
        MockHttpServletRequest request = request("10.1.2.3", "203.0.113.7, 10.2.3.4");
        assertEquals("203.0.113.7", service.getClientIp(request));
    }
    @Test void untrustedHopIsNotSkipped() {
        MockHttpServletRequest request = request("10.1.2.3", "203.0.113.7, 192.0.2.50");
        assertEquals("192.0.2.50", service.getClientIp(request));
    }
    @Test void supportsAndNormalizesIpv6() {
        MockHttpServletRequest request = request("2001:db8:ffff::1", "::ffff:203.0.113.7");
        assertEquals("203.0.113.7", service.getClientIp(request));
    }
    private MockHttpServletRequest request(String remote, String xff) { MockHttpServletRequest request = new MockHttpServletRequest(); request.setRemoteAddr(remote); request.addHeader("X-Forwarded-For", xff); return request; }
}
