package icepunk_backend.repository;

import icepunk_backend.model.GeneratedPack;
import icepunk_backend.model.GeneratedPackVisibility;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
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
              and lower(owner.username) <> 'guest'
            order by pack.createdAt desc
            """)
    Page<GeneratedPack> findPublicAuthenticatedPacks(GeneratedPackVisibility visibility, Pageable pageable);

    @EntityGraph(attributePaths = "owner")
    @Query("""
            select pack from GeneratedPack pack
            join pack.owner owner
            where owner.username = :username
              and pack.visibility = :visibility
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

    long countByOwnerIdAndVisibility(Long ownerId, GeneratedPackVisibility visibility);
}
