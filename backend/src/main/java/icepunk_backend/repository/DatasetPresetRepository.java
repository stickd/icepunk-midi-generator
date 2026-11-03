package icepunk_backend.repository;

import icepunk_backend.model.DatasetPreset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DatasetPresetRepository extends JpaRepository<DatasetPreset, UUID> {

    List<DatasetPreset> findByOwner_IdOrderByCreatedAtDesc(Long ownerId);

    Optional<DatasetPreset> findByIdAndOwner_Id(UUID id, Long ownerId);

    List<DatasetPreset> findByIdInAndOwner_Id(List<UUID> ids, Long ownerId);
}
