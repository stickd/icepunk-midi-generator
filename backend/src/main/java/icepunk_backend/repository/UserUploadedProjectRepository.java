package icepunk_backend.repository;

import icepunk_backend.model.UserUploadedProject;
import icepunk_backend.model.UploadVisibility;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserUploadedProjectRepository extends JpaRepository<UserUploadedProject, Long> {

    List<UserUploadedProject> findByOwnerIdOrderByUploadedAtDesc(Long ownerId);

    @EntityGraph(attributePaths = "owner")
    Page<UserUploadedProject> findByVisibilityOrderByUploadedAtDesc(
            UploadVisibility visibility,
            Pageable pageable
    );

    Optional<UserUploadedProject> findByIdAndVisibility(
            Long id,
            UploadVisibility visibility
    );

    Page<UserUploadedProject> findByOwnerIdAndVisibilityOrderByUploadedAtDesc(
            Long ownerId,
            UploadVisibility visibility,
            Pageable pageable
    );

    long countByOwnerIdAndVisibility(Long ownerId, UploadVisibility visibility);

    @Query("SELECT COALESCE(SUM(p.downloadCount), 0) FROM UserUploadedProject p " +
            "WHERE p.owner.id = :ownerId AND p.visibility = :visibility")
    long sumDownloadCountByOwnerIdAndVisibility(
            @Param("ownerId") Long ownerId,
            @Param("visibility") UploadVisibility visibility
    );

    @Modifying
    @Query("UPDATE UserUploadedProject p SET p.downloadCount = p.downloadCount + 1 WHERE p.id = :id")
    void incrementDownloadCount(@Param("id") Long id);
}
