package icepunk_backend.service;

import icepunk_backend.dto.LikeResponse;
import icepunk_backend.dto.MeResponse;
import icepunk_backend.dto.UserPackItem;
import icepunk_backend.dto.UserPackListResponse;
import icepunk_backend.dto.UserProfileResponse;
import icepunk_backend.exception.ResourceNotFoundException;
import icepunk_backend.exception.UploadValidationException;
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
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class UserProfileService {

    private static final int MAX_PAGE_SIZE = 50;
    private static final long MAX_AVATAR_SIZE_BYTES = 2L * 1024 * 1024;
    private static final Set<String> ALLOWED_AVATAR_CONTENT_TYPES = Set.of(
            "image/png", "image/jpeg", "image/jpg", "image/pjpeg", "image/webp", "image/gif"
    );
    private static final Set<String> ALLOWED_AVATAR_EXTENSIONS = Set.of(
            ".png", ".jpeg", ".jpg", ".webp", ".gif"
    );

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
                user.getProfilePictureUrl(),
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
                user.getProfilePictureUrl(),
                user.getCredits() == null ? 0 : user.getCredits(),
                Boolean.TRUE.equals(user.getVerified()),
                user.getCreatedAt()
        );
    }

    @Transactional
    public MeResponse updateProfile(String email, String bio, String profilePictureUrl) {
        User user = findUserByEmail(email);
        if (bio != null) {
            String normalizedBio = bio.trim();
            user.setBio(normalizedBio.isEmpty() ? null : normalizedBio);
        }

        if (profilePictureUrl != null) {
            String normalizedUrl = profilePictureUrl.trim();
            user.setProfilePictureUrl(normalizedUrl.isEmpty() ? null : normalizedUrl);
        }

        userRepository.save(user);

        return getMe(email);
    }

    @Transactional
    public MeResponse updateAvatar(String email, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new UploadValidationException("Please select an image to upload.");
        }
        if (file.getSize() > MAX_AVATAR_SIZE_BYTES) {
            throw new UploadValidationException("Image size must be under 2MB.");
        }

        String contentType = file.getContentType();
        boolean validMime = contentType != null && ALLOWED_AVATAR_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT));
        String filename = file.getOriginalFilename();
        String ext = filename != null && filename.contains(".") ? filename.substring(filename.lastIndexOf(".")).toLowerCase(Locale.ROOT) : "";
        boolean validExt = ALLOWED_AVATAR_EXTENSIONS.contains(ext);

        if (!validMime && !validExt) {
            throw new UploadValidationException("Image must be PNG, JPEG, WEBP, or GIF.");
        }

        User user = findUserByEmail(email);

        UserUploadStorageService.StoredUpload upload = storageService.uploadAvatar(
                user.getId(),
                file.getOriginalFilename(),
                contentType == null ? "image/jpeg" : contentType,
                file.getBytes()
        );

        user.setProfilePictureUrl(upload.publicUrl());
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
        if (email == null) {
            throw new ResourceNotFoundException("User not found");
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        return userRepository.findByEmail(email)
                .or(() -> userRepository.findByEmail(normalized))
                .or(() -> userRepository.findByUsernameIgnoreCase(email))
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
