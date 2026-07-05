package icepunk_backend.service;

import icepunk_backend.dto.LikeResponse;
import icepunk_backend.dto.MeResponse;
import icepunk_backend.dto.UserPackListResponse;
import icepunk_backend.dto.UserProfileResponse;
import icepunk_backend.exception.ResourceNotFoundException;
import icepunk_backend.model.ProjectLike;
import icepunk_backend.model.UploadVisibility;
import icepunk_backend.model.User;
import icepunk_backend.model.UserUploadedProject;
import icepunk_backend.repository.GeneratedPackRepository;
import icepunk_backend.repository.ProjectLikeRepository;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.repository.UserUploadedProjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserProfileServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserUploadedProjectRepository projectRepository;

    @Mock
    private GeneratedPackRepository generatedPackRepository;

    @Mock
    private ProjectLikeRepository likeRepository;

    @Mock
    private UserUploadStorageService storageService;

    private UserProfileService service;

    private User owner;
    private User viewer;

    @BeforeEach
    void setUp() {
        service = new UserProfileService(userRepository, projectRepository, generatedPackRepository, likeRepository, storageService);

        owner = new User("maco", "maco@example.com", "hash");
        owner.setId(1L);
        owner.setBio("Dark ambient producer");
        owner.setVerified(true);

        viewer = new User("viewer", "viewer@example.com", "hash");
        viewer.setId(2L);
    }

    private UserUploadedProject project(Long id, User projectOwner) {
        UserUploadedProject project = new UserUploadedProject();
        project.setId(id);
        project.setOwner(projectOwner);
        project.setTitle("dark_fsharp_pack_01");
        project.setMidiObjectKey("uploads/" + id + "/midi.mid");
        project.setVisibility(UploadVisibility.PUBLIC);
        project.setDownloadCount(5L);
        return project;
    }

    @Test
    void getProfileAggregatesPublicStats() {
        when(userRepository.findByUsernameIgnoreCase("maco")).thenReturn(Optional.of(owner));
        when(projectRepository.countByOwnerIdAndVisibility(1L, UploadVisibility.PUBLIC)).thenReturn(3L);
        when(generatedPackRepository.countByOwnerIdAndVisibility(1L, icepunk_backend.model.GeneratedPackVisibility.PUBLIC)).thenReturn(2L);
        when(projectRepository.sumDownloadCountByOwnerIdAndVisibility(1L, UploadVisibility.PUBLIC)).thenReturn(120L);
        when(likeRepository.countLikesReceivedByOwner(1L, UploadVisibility.PUBLIC)).thenReturn(48L);

        UserProfileResponse profile = service.getProfile("maco");

        assertThat(profile.username()).isEqualTo("maco");
        assertThat(profile.bio()).isEqualTo("Dark ambient producer");
        assertThat(profile.verified()).isTrue();
        assertThat(profile.packCount()).isEqualTo(5L);
        assertThat(profile.totalDownloads()).isEqualTo(120L);
        assertThat(profile.totalLikes()).isEqualTo(48L);
    }

    @Test
    void getProfileThrowsNotFoundForUnknownUser() {
        when(userRepository.findByUsernameIgnoreCase("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getProfile("ghost"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getUserPacksMapsLikeCountsAndViewerLikes() {
        UserUploadedProject packA = project(10L, owner);
        UserUploadedProject packB = project(11L, owner);
        Page<UserUploadedProject> page = new PageImpl<>(
                List.of(packA, packB),
                PageRequest.of(0, 12),
                2
        );

        when(userRepository.findByUsernameIgnoreCase("maco")).thenReturn(Optional.of(owner));
        when(projectRepository.findByOwnerIdAndVisibilityOrderByUploadedAtDesc(
                eq(1L), eq(UploadVisibility.PUBLIC), any(Pageable.class)))
                .thenReturn(page);
        when(likeRepository.countByProjectIds(anyList()))
                .thenReturn(List.<Object[]>of(new Object[]{10L, 7L}));
        when(userRepository.findByEmail("viewer@example.com")).thenReturn(Optional.of(viewer));
        when(likeRepository.findLikedProjectIds(eq(2L), anyList())).thenReturn(Set.of(10L));
        when(storageService.publicUrlForObjectKey(any())).thenReturn("https://files/midi.mid");

        UserPackListResponse response = service.getUserPacks("maco", 0, 12, "viewer@example.com");

        assertThat(response.items()).hasSize(2);
        assertThat(response.items().get(0).likeCount()).isEqualTo(7L);
        assertThat(response.items().get(0).likedByViewer()).isTrue();
        assertThat(response.items().get(1).likeCount()).isZero();
        assertThat(response.items().get(1).likedByViewer()).isFalse();
        assertThat(response.items().get(0).downloadCount()).isEqualTo(5L);
    }

    @Test
    void getUserPacksWorksWithoutViewer() {
        Page<UserUploadedProject> page = new PageImpl<>(
                List.of(project(10L, owner)),
                PageRequest.of(0, 12),
                1
        );

        when(userRepository.findByUsernameIgnoreCase("maco")).thenReturn(Optional.of(owner));
        when(projectRepository.findByOwnerIdAndVisibilityOrderByUploadedAtDesc(
                eq(1L), eq(UploadVisibility.PUBLIC), any(Pageable.class)))
                .thenReturn(page);
        when(likeRepository.countByProjectIds(anyList())).thenReturn(List.of());
        when(storageService.publicUrlForObjectKey(any())).thenReturn("https://files/midi.mid");

        UserPackListResponse response = service.getUserPacks("maco", 0, 12, null);

        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).likedByViewer()).isFalse();
        verify(likeRepository, never()).findLikedProjectIds(any(), anyList());
    }

    @Test
    void likeIsIdempotent() {
        UserUploadedProject pack = project(10L, owner);

        when(userRepository.findByEmail("viewer@example.com")).thenReturn(Optional.of(viewer));
        when(projectRepository.findByIdAndVisibility(10L, UploadVisibility.PUBLIC))
                .thenReturn(Optional.of(pack));
        when(likeRepository.existsByUserIdAndProjectId(2L, 10L)).thenReturn(true);
        when(likeRepository.countByProjectId(10L)).thenReturn(7L);

        LikeResponse response = service.like("viewer@example.com", 10L);

        assertThat(response.liked()).isTrue();
        assertThat(response.likeCount()).isEqualTo(7L);
        verify(likeRepository, never()).save(any(ProjectLike.class));
    }

    @Test
    void likeSavesWhenNotAlreadyLiked() {
        UserUploadedProject pack = project(10L, owner);

        when(userRepository.findByEmail("viewer@example.com")).thenReturn(Optional.of(viewer));
        when(projectRepository.findByIdAndVisibility(10L, UploadVisibility.PUBLIC))
                .thenReturn(Optional.of(pack));
        when(likeRepository.existsByUserIdAndProjectId(2L, 10L)).thenReturn(false);
        when(likeRepository.countByProjectId(10L)).thenReturn(1L);

        LikeResponse response = service.like("viewer@example.com", 10L);

        assertThat(response.liked()).isTrue();
        verify(likeRepository).save(any(ProjectLike.class));
    }

    @Test
    void likeRejectsNonPublicProject() {
        when(userRepository.findByEmail("viewer@example.com")).thenReturn(Optional.of(viewer));
        when(projectRepository.findByIdAndVisibility(99L, UploadVisibility.PUBLIC))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.like("viewer@example.com", 99L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void unlikeDeletesAndReturnsCount() {
        UserUploadedProject pack = project(10L, owner);

        when(userRepository.findByEmail("viewer@example.com")).thenReturn(Optional.of(viewer));
        when(projectRepository.findByIdAndVisibility(10L, UploadVisibility.PUBLIC))
                .thenReturn(Optional.of(pack));
        when(likeRepository.countByProjectId(10L)).thenReturn(0L);

        LikeResponse response = service.unlike("viewer@example.com", 10L);

        assertThat(response.liked()).isFalse();
        assertThat(response.likeCount()).isZero();
        verify(likeRepository).deleteById(any(ProjectLike.Key.class));
    }

    @Test
    void updateBioTrimsAndBlanksToNull() {
        when(userRepository.findByEmail("maco@example.com")).thenReturn(Optional.of(owner));
        when(userRepository.save(owner)).thenReturn(owner);

        MeResponse afterBlank = service.updateProfile("maco@example.com", "   ", null);
        assertThat(afterBlank.bio()).isNull();

        MeResponse afterText = service.updateProfile("maco@example.com", "  cold algorithms  ", null);
        assertThat(afterText.bio()).isEqualTo("cold algorithms");
    }

    @Test
    void getMeReturnsCreditsAndIdentity() {
        owner.setCredits(450);
        when(userRepository.findByEmail("maco@example.com")).thenReturn(Optional.of(owner));

        MeResponse me = service.getMe("maco@example.com");

        assertThat(me.username()).isEqualTo("maco");
        assertThat(me.credits()).isEqualTo(450);
        assertThat(me.verified()).isTrue();
    }
}
