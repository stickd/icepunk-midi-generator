package icepunk_backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;

@Entity
@Table(name = "project_likes")
@IdClass(ProjectLike.Key.class)
public class ProjectLike {

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Id
    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public ProjectLike() {
    }

    public ProjectLike(Long userId, Long projectId) {
        this.userId = userId;
        this.projectId = projectId;
        this.createdAt = OffsetDateTime.now();
    }

    public Long getUserId() {
        return userId;
    }

    public Long getProjectId() {
        return projectId;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public static class Key implements Serializable {
        private Long userId;
        private Long projectId;

        public Key() {
        }

        public Key(Long userId, Long projectId) {
            this.userId = userId;
            this.projectId = projectId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof Key key)) return false;
            return Objects.equals(userId, key.userId) && Objects.equals(projectId, key.projectId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, projectId);
        }
    }
}
