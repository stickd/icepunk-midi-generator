package icepunk_backend.service;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Resolves forwarding headers only from explicitly trusted proxy networks. */
@Service
public class ClientIpService {
    private final List<Cidr> trustedProxies;

    public ClientIpService(@Value("${app.proxy.trusted-proxies:127.0.0.1/32,::1/128}") String configuredProxies) {
        this.trustedProxies = Arrays.stream(configuredProxies.split(","))
                .map(String::trim).filter(value -> !value.isEmpty()).map(Cidr::parse).toList();
    }

    /** Compatibility constructor for local unit tests; production always uses configured networks. */
    public ClientIpService() { this("127.0.0.1/32,::1/128"); }

    public String getClientIp(HttpServletRequest request) {
        String remote = normalize(request.getRemoteAddr());
        if (!isTrusted(remote)) return remote; // Direct callers cannot spoof forwarding headers.
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor == null || forwardedFor.isBlank()) return remote;

        List<String> chain = new ArrayList<>(Arrays.stream(forwardedFor.split(","))
                .map(String::trim).filter(value -> !value.isEmpty()).map(this::normalize).toList());
        // Work backwards: only discard known proxies; first non-proxy is the actual client.
        for (int index = chain.size() - 1; index >= 0; index--) {
            String candidate = chain.get(index);
            if (!isTrusted(candidate)) return candidate;
        }
        return remote;
    }

    private boolean isTrusted(String ip) { return trustedProxies.stream().anyMatch(cidr -> cidr.contains(ip)); }
    private String normalize(String value) {
        try {
            String raw = value;
            if (raw.startsWith("[") && raw.contains("]")) raw = raw.substring(1, raw.indexOf(']'));
            InetAddress address = InetAddress.getByName(raw);
            byte[] bytes = address.getAddress();
            if (bytes.length == 16 && isIpv4Mapped(bytes)) return InetAddress.getByAddress(Arrays.copyOfRange(bytes, 12, 16)).getHostAddress();
            return address.getHostAddress();
        } catch (UnknownHostException exception) { return value; }
    }
    private static boolean isIpv4Mapped(byte[] bytes) { for (int i=0;i<10;i++) if(bytes[i]!=0) return false; return bytes[10]==(byte)0xff && bytes[11]==(byte)0xff; }

    private record Cidr(byte[] network, int prefix) {
        static Cidr parse(String value) {
            try { String[] parts=value.split("/",2); InetAddress address=InetAddress.getByName(parts[0]); int bits=address.getAddress().length*8;
                int prefix=parts.length==2?Integer.parseInt(parts[1]):bits; if(prefix<0||prefix>bits) throw new IllegalArgumentException(); return new Cidr(address.getAddress(),prefix);
            } catch (Exception exception) { throw new IllegalArgumentException("Invalid trusted proxy CIDR: " + value); }
        }
        boolean contains(String ip) {
            try { byte[] candidate=InetAddress.getByName(ip).getAddress(); if(candidate.length!=network.length) return false;
                int full=prefix/8, remaining=prefix%8; for(int i=0;i<full;i++) if(candidate[i]!=network[i]) return false;
                return remaining==0 || (candidate[full] & (0xff << (8-remaining))) == (network[full] & (0xff << (8-remaining)));
            } catch (UnknownHostException exception) { return false; }
        }
    }
}
