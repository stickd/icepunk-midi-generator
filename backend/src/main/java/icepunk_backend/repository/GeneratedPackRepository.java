package icepunk_backend.repository;

import icepunk_backend.model.GeneratedPack;
import icepunk_backend.model.GeneratedPackVisibility;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import icepunk_backend.model.GeneratedPackStatus;

import java.util.List;
import java.util.Optional;
import java.time.OffsetDateTime;
import java.util.UUID;

public interface GeneratedPackRepository extends JpaRepository<GeneratedPack, UUID> {

    @EntityGraph(attributePaths = {"items", "owner"})
    @Query("select pack from GeneratedPack pack where pack.id = :id")
    Optional<GeneratedPack> findWithItemsById(UUID id);

    @EntityGraph(attributePaths = {"items", "owner"})
    @Query("select pack from GeneratedPack pack where pack.owner.id = :ownerId order by pack.createdAt desc")
    List<GeneratedPack> findWithItemsByOwnerId(Long ownerId);

    @EntityGraph(attributePaths = "owner")
    @Query("""
            select pack from GeneratedPack pack
            join pack.owner owner
            where pack.visibility = :visibility
              and pack.status = 'READY'
              and lower(owner.username) <> 'guest'
            order by pack.createdAt desc
            """)
    Page<GeneratedPack> findPublicAuthenticatedPacks(GeneratedPackVisibility visibility, Pageable pageable);

    @EntityGraph(attributePaths = "owner")
    @Query("""
            select pack from GeneratedPack pack
            join pack.owner owner
            where lower(owner.username) = lower(:username)
              and pack.visibility = :visibility
              and pack.status = 'READY'
              and lower(owner.username) <> 'guest'
            order by pack.createdAt desc
            """)
    Page<GeneratedPack> findPublicAuthenticatedPacksByUsername(
            String username,
            GeneratedPackVisibility visibility,
            Pageable pageable
    );

    @EntityGraph(attributePaths = "owner")
    Page<GeneratedPack> findByOwner_UsernameAndVisibilityOrderByCreatedAtDesc(
            String username,
            GeneratedPackVisibility visibility,
            Pageable pageable
    );

    @EntityGraph(attributePaths = "owner")
    Page<GeneratedPack> findByOwner_UsernameIgnoreCaseAndVisibilityOrderByCreatedAtDesc(
            String username,
            GeneratedPackVisibility visibility,
            Pageable pageable
    );

    long countByOwnerIdAndVisibilityAndStatus(Long ownerId, GeneratedPackVisibility visibility, GeneratedPackStatus status);

    @Modifying
    @Query(value = "update generated_packs set status = 'READY', finalized_at = CURRENT_TIMESTAMP, cleanup_required = false, failure_code = null where id = :id and status = 'PENDING'", nativeQuery = true)
    int markReadyIfPending(@Param("id") UUID id);

    @Modifying
    @Query(value = "update generated_packs set status = 'FAILED', failure_code = :failureCode, updated_at = :updatedAt where id = :id and status = 'PENDING'", nativeQuery = true)
    int markFailedIfPending(@Param("id") UUID id, @Param("failureCode") String failureCode,
                            @Param("updatedAt") OffsetDateTime updatedAt);

    @Modifying
    @Query(value = "update generated_packs set status = 'FAILED', failure_code = 'DELETE_PENDING', updated_at = :updatedAt where id = :id and status = 'READY'", nativeQuery = true)
    int markDeletionPendingIfReady(@Param("id") UUID id, @Param("updatedAt") OffsetDateTime updatedAt);

    @Query("select pack from GeneratedPack pack where pack.status = :status and coalesce(pack.updatedAt, pack.createdAt) <= :cutoff order by coalesce(pack.updatedAt, pack.createdAt), pack.id")
    Page<GeneratedPack> findStaleByStatus(@Param("status") GeneratedPackStatus status, @Param("cutoff") OffsetDateTime cutoff, Pageable pageable);

    @Query("select pack from GeneratedPack pack where pack.cleanupRequired = true and pack.status <> 'READY' order by coalesce(pack.lastCleanupAt, pack.createdAt), pack.id")
    Page<GeneratedPack> findCleanupRequired(Pageable pageable);
}
