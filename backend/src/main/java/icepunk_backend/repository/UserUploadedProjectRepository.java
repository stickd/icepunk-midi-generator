package icepunk_backend.repository;

import icepunk_backend.model.UserUploadedProject;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserUploadedProjectRepository extends JpaRepository<UserUploadedProject, Long> {

    List<UserUploadedProject> findByOwnerIdOrderByUploadedAtDesc(Long ownerId);
}
