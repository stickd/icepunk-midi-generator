package icepunk_backend.repository;

import icepunk_backend.model.UserUploadedProject;
import icepunk_backend.model.UploadVisibility;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;

public interface UserUploadedProjectRepository extends JpaRepository<UserUploadedProject, Long> {

    List<UserUploadedProject> findByOwnerIdOrderByUploadedAtDesc(Long ownerId);

    @EntityGraph(attributePaths = "owner")
    Page<UserUploadedProject> findByVisibilityOrderByUploadedAtDesc(
            UploadVisibility visibility,
            Pageable pageable
    );
}
