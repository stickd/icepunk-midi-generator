package icepunk_backend.repository;

import icepunk_backend.model.GuestUsage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GuestUsageRepository extends JpaRepository<GuestUsage, Long> {

    Optional<GuestUsage> findByIpAddress(String ipAddress);
}