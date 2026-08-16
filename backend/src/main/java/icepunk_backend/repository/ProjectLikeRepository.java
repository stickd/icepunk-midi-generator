package icepunk_backend.repository;

import icepunk_backend.model.ProjectLike;
import icepunk_backend.model.UploadVisibility;
import icepunk_backend.model.UserUploadedProject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;

public interface ProjectLikeRepository extends JpaRepository<ProjectLike, ProjectLike.Key> {

    long countByProjectId(Long projectId);

    boolean existsByUserIdAndProjectId(Long userId, Long projectId);

    @Query("SELECT COUNT(l) FROM ProjectLike l, UserUploadedProject p " +
            "WHERE l.projectId = p.id AND p.owner.id = :ownerId AND p.visibility = :visibility")
    long countLikesReceivedByOwner(
            @Param("ownerId") Long ownerId,
            @Param("visibility") UploadVisibility visibility
    );

    @Query(
            value = "SELECT p FROM ProjectLike l, UserUploadedProject p JOIN FETCH p.owner " +
                    "WHERE l.projectId = p.id AND l.userId = :userId AND p.visibility = :visibility " +
                    "ORDER BY l.createdAt DESC",
            countQuery = "SELECT COUNT(l) FROM ProjectLike l, UserUploadedProject p " +
                    "WHERE l.projectId = p.id AND l.userId = :userId AND p.visibility = :visibility"
    )
    Page<UserUploadedProject> findLikedProjects(
            @Param("userId") Long userId,
            @Param("visibility") UploadVisibility visibility,
            Pageable pageable
    );

    @Query("SELECT l.projectId FROM ProjectLike l WHERE l.userId = :userId AND l.projectId IN :projectIds")
    Set<Long> findLikedProjectIds(
            @Param("userId") Long userId,
            @Param("projectIds") List<Long> projectIds
    );

    @Query("SELECT l.projectId, COUNT(l) FROM ProjectLike l WHERE l.projectId IN :projectIds GROUP BY l.projectId")
    List<Object[]> countByProjectIds(@Param("projectIds") List<Long> projectIds);
}
