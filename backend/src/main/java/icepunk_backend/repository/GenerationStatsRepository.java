package icepunk_backend.repository;

import icepunk_backend.model.GenerationStats;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface GenerationStatsRepository extends JpaRepository<GenerationStats, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select stats from GenerationStats stats where stats.id = :id")
    Optional<GenerationStats> findByIdForUpdate(@Param("id") Long id);
}
