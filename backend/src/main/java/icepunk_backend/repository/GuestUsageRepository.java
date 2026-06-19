package icepunk_backend.repository;

import icepunk_backend.model.GuestUsage;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface GuestUsageRepository extends JpaRepository<GuestUsage, Long> {

    Optional<GuestUsage> findByIpAddress(String ipAddress);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select guestUsage from GuestUsage guestUsage where guestUsage.ipAddress = :ipAddress")
    Optional<GuestUsage> findByIpAddressForUpdate(@Param("ipAddress") String ipAddress);
}
