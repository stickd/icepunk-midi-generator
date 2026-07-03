package icepunk_backend.repository;

import icepunk_backend.model.GeneratedPackItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface GeneratedPackItemRepository extends JpaRepository<GeneratedPackItem, UUID> {

    Optional<GeneratedPackItem> findByIdAndPackId(UUID id, UUID packId);
}
