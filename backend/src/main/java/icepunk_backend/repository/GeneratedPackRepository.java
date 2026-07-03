package icepunk_backend.repository;

import icepunk_backend.model.GeneratedPack;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface GeneratedPackRepository extends JpaRepository<GeneratedPack, UUID> {

    @EntityGraph(attributePaths = {"items", "owner"})
    @Query("select pack from GeneratedPack pack where pack.id = :id")
    Optional<GeneratedPack> findWithItemsById(UUID id);
}
