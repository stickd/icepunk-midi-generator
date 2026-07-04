package icepunk_backend.service;

import icepunk_backend.dto.LikeResponse;
import icepunk_backend.dto.MeResponse;
import icepunk_backend.dto.UserPackItem;
import icepunk_backend.dto.UserPackListResponse;
import icepunk_backend.dto.UserProfileResponse;
import icepunk_backend.exception.ResourceNotFoundException;
import icepunk_backend.model.GeneratedPackVisibility;
import icepunk_backend.model.ProjectLike;
import icepunk_backend.model.UploadVisibility;
import icepunk_backend.model.User;
import icepunk_backend.model.UserUploadedProject;
import icepunk_backend.repository.GeneratedPackRepository;
import icepunk_backend.repository.ProjectLikeRepository;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.repository.UserUploadedProjectRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class UserProfileService {

    private static final int MAX_PAGE_SIZE = 50;

    private final UserRepository userRepository;
    private final UserUploadedProjectRepository projectRepository;
    private final GeneratedPackRepository generatedPackRepository;
    private final ProjectLikeRepository likeRepository;
    private final UserUploadStorageService storageService;

    public UserProfileService(
            UserRepository userRepository,
            UserUploadedProjectRepository projectRepository,
            GeneratedPackRepository generatedPackRepository,
            ProjectLikeRepository likeRepository,
            UserUploadStorageService storageService
    ) {
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.generatedPackRepository = generatedPackRepository;
        this.likeRepository = likeRepository;
        this.storageService = storageService;
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(String username) {
        User user = findUserByUsername(username);

        long publicUploads = projectRepository.countByOwnerIdAndVisibility(user.getId(), UploadVisibility.PUBLIC);
        long publicGenerated = generatedPackRepository.countByOwnerIdAndVisibility(user.getId(), GeneratedPackVisibility.PUBLIC);
        long packCount = publicUploads + publicGenerated;

        long totalDownloads = projectRepository.sumDownloadCountByOwnerIdAndVisibility(
                user.getId(), UploadVisibility.PUBLIC);
        long totalLikes = likeRepository.countLikesReceivedByOwner(user.getId(), UploadVisibility.PUBLIC);

        return new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getBio(),
                Boolean.TRUE.equals(user.getVerified()),
                user.getCreatedAt(),
                packCount,
                totalDownloads,
                totalLikes
        );
    }

    @Transactional(readOnly = true)
    public UserPackListResponse getUserPacks(String username, int page, int size, String viewerEmail) {
        User owner = findUserByUsername(username);
        Page<UserUploadedProject> projects = projectRepository.findByOwnerIdAndVisibilityOrderByUploadedAtDesc(
                owner.getId(),
                UploadVisibility.PUBLIC,
                PageRequest.of(normalizePage(page), normalizeSize(size))
        );

        return toPackListResponse(projects, viewerEmail);
    }

    @Transactional(readOnly = true)
    public UserPackListResponse getFavorites(String viewerEmail, int page, int size) {
        User viewer = findUserByEmail(viewerEmail);
        Page<UserUploadedProject> projects = likeRepository.findLikedProjects(
                viewer.getId(),
                UploadVisibility.PUBLIC,
                PageRequest.of(normalizePage(page), normalizeSize(size))
        );

        return toPackListResponse(projects, viewerEmail);
    }

    @Transactional(readOnly = true)
    public MeResponse getMe(String email) {
        User user = findUserByEmail(email);

        return new MeResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getBio(),
                user.getCredits() == null ? 0 : user.getCredits(),
                Boolean.TRUE.equals(user.getVerified()),
                user.getCreatedAt()
        );
    }

    @Transactional
    public MeResponse updateBio(String email, String bio) {
        User user = findUserByEmail(email);
        String normalized = bio == null ? null : bio.trim();
        user.setBio(normalized == null || normalized.isEmpty() ? null : normalized);
        userRepository.save(user);

        return getMe(email);
    }

    @Transactional
    public LikeResponse like(String viewerEmail, Long projectId) {
        User viewer = findUserByEmail(viewerEmail);
        UserUploadedProject project = findPublicProject(projectId);

        if (!likeRepository.existsByUserIdAndProjectId(viewer.getId(), project.getId())) {
            likeRepository.save(new ProjectLike(viewer.getId(), project.getId()));
        }

        return new LikeResponse(project.getId(), true, likeRepository.countByProjectId(project.getId()));
    }

    @Transactional
    public LikeResponse unlike(String viewerEmail, Long projectId) {
        User viewer = findUserByEmail(viewerEmail);
        UserUploadedProject project = findPublicProject(projectId);

        likeRepository.deleteById(new ProjectLike.Key(viewer.getId(), project.getId()));

        return new LikeResponse(project.getId(), false, likeRepository.countByProjectId(project.getId()));
    }

    private UserPackListResponse toPackListResponse(Page<UserUploadedProject> projects, String viewerEmail) {
        List<Long> projectIds = projects.getContent().stream()
                .map(UserUploadedProject::getId)
                .toList();

        Map<Long, Long> likeCounts = new HashMap<>();
        if (!projectIds.isEmpty()) {
            for (Object[] row : likeRepository.countByProjectIds(projectIds)) {
                likeCounts.put((Long) row[0], (Long) row[1]);
            }
        }

        Set<Long> likedByViewer = resolveViewerLikes(viewerEmail, projectIds);

        List<UserPackItem> items = projects.getContent().stream()
                .map(project -> new UserPackItem(
                        project.getId(),
                        project.getOwner().getId(),
                        project.getOwner().getUsername(),
                        project.getTitle(),
                        storageService.publicUrlForObjectKey(project.getMidiObjectKey()),
                        storageService.publicUrlForObjectKey(project.getSampleObjectKey()),
                        project.getUploadedAt(),
                        project.getMetadata(),
                        project.getDownloadCount() == null ? 0L : project.getDownloadCount(),
                        likeCounts.getOrDefault(project.getId(), 0L),
                        likedByViewer.contains(project.getId())
                ))
                .toList();

        return new UserPackListResponse(
                items,
                projects.getNumber(),
                projects.getSize(),
                projects.getTotalElements(),
                projects.getTotalPages(),
                projects.hasNext()
        );
    }

    private Set<Long> resolveViewerLikes(String viewerEmail, List<Long> projectIds) {
        if (viewerEmail == null || projectIds.isEmpty()) {
            return Set.of();
        }

        return userRepository.findByEmail(viewerEmail)
                .map(viewer -> likeRepository.findLikedProjectIds(viewer.getId(), projectIds))
                .orElse(Set.of());
    }

    private User findUserByUsername(String username) {
        return userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private UserUploadedProject findPublicProject(Long projectId) {
        return projectRepository.findByIdAndVisibility(projectId, UploadVisibility.PUBLIC)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
    }

    private int normalizePage(int page) {
        return Math.max(0, page);
    }

    private int normalizeSize(int size) {
        return Math.max(1, Math.min(size, MAX_PAGE_SIZE));
    }
}
