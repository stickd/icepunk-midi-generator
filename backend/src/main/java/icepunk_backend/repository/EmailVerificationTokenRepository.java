package icepunk_backend.repository;

import icepunk_backend.model.EmailVerificationToken;
import icepunk_backend.model.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.OffsetDateTime;
import java.util.Optional;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select token from EmailVerificationToken token join fetch token.user where token.tokenHash = :hash")
    Optional<EmailVerificationToken> findByTokenHashForUpdate(@Param("hash") String hash);

    @Modifying
    @Query("update EmailVerificationToken token set token.usedAt = :now where token.user = :user and token.usedAt is null")
    void invalidateActiveForUser(@Param("user") User user, @Param("now") OffsetDateTime now);

    @Modifying
    @Query("delete from EmailVerificationToken token where (token.usedAt is not null or token.expiresAt < :cutoff) and token.createdAt < :cutoff")
    int deleteExpiredOrUsedBefore(@Param("cutoff") OffsetDateTime cutoff);
}
