package icepunk_backend.controller;

import icepunk_backend.dto.LikeResponse;
import icepunk_backend.dto.MeResponse;
import icepunk_backend.dto.UpdateProfileRequest;
import icepunk_backend.dto.UserPackListResponse;
import icepunk_backend.dto.UserProfileResponse;
import icepunk_backend.service.UserProfileService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserProfileControllerTest {

    private UserProfileService userProfileService;
    private UserProfileController controller;

    @BeforeEach
    void setUp() {
        userProfileService = mock(UserProfileService.class);
        controller = new UserProfileController(userProfileService);
    }

    @Test
    void profileDelegatesToService() {
        UserProfileResponse profileResponse = new UserProfileResponse(
                1L, "maco", "Bio test", null, true, OffsetDateTime.now(), 5L, 100L, 25L
        );
        when(userProfileService.getProfile("maco")).thenReturn(profileResponse);

        UserProfileResponse response = controller.profile("maco");

        assertEquals(profileResponse, response);
        verify(userProfileService).getProfile("maco");
    }

    @Test
    void packsDelegatesToServiceWithViewerEmail() {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("viewer@example.com", null);
        UserPackListResponse packsResponse = new UserPackListResponse(List.of(), 0, 12, 0, 0, false);
        when(userProfileService.getUserPacks("maco", 0, 12, "viewer@example.com")).thenReturn(packsResponse);

        UserPackListResponse response = controller.packs("maco", 0, 12, auth);

        assertEquals(packsResponse, response);
        verify(userProfileService).getUserPacks("maco", 0, 12, "viewer@example.com");
    }

    @Test
    void packsDelegatesToServiceWithNullViewerWhenUnauthenticated() {
        UserPackListResponse packsResponse = new UserPackListResponse(List.of(), 0, 12, 0, 0, false);
        when(userProfileService.getUserPacks("maco", 0, 12, null)).thenReturn(packsResponse);

        UserPackListResponse response = controller.packs("maco", 0, 12, null);

        assertEquals(packsResponse, response);
        verify(userProfileService).getUserPacks("maco", 0, 12, null);
    }

    @Test
    void meDelegatesToService() {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("maco@example.com", null);
        MeResponse meResponse = new MeResponse(1L, "maco", "maco@example.com", "Bio", null, 100, true, OffsetDateTime.now());
        when(userProfileService.getMe("maco@example.com")).thenReturn(meResponse);

        MeResponse response = controller.me(auth);

        assertEquals(meResponse, response);
        verify(userProfileService).getMe("maco@example.com");
    }

    @Test
    void updateProfileDelegatesToService() {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("maco@example.com", null);
        UpdateProfileRequest request = new UpdateProfileRequest("New bio text", null);
        MeResponse meResponse = new MeResponse(1L, "maco", "maco@example.com", "New bio text", null, 100, true, OffsetDateTime.now());
        when(userProfileService.updateProfile("maco@example.com", "New bio text", null)).thenReturn(meResponse);

        MeResponse response = controller.updateProfile(auth, request);

        assertEquals(meResponse, response);
        verify(userProfileService).updateProfile("maco@example.com", "New bio text", null);
    }

    @Test
    void favoritesDelegatesToService() {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("maco@example.com", null);
        UserPackListResponse favoritesResponse = new UserPackListResponse(List.of(), 0, 12, 0, 0, false);
        when(userProfileService.getFavorites("maco@example.com", 0, 12)).thenReturn(favoritesResponse);

        UserPackListResponse response = controller.favorites(auth, 0, 12);

        assertEquals(favoritesResponse, response);
        verify(userProfileService).getFavorites("maco@example.com", 0, 12);
    }

    @Test
    void likeDelegatesToService() {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("maco@example.com", null);
        LikeResponse likeResponse = new LikeResponse(42L, true, 5L);
        when(userProfileService.like("maco@example.com", 42L)).thenReturn(likeResponse);

        LikeResponse response = controller.like(auth, 42L);

        assertEquals(likeResponse, response);
        verify(userProfileService).like("maco@example.com", 42L);
    }

    @Test
    void unlikeDelegatesToService() {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("maco@example.com", null);
        LikeResponse likeResponse = new LikeResponse(42L, false, 4L);
        when(userProfileService.unlike("maco@example.com", 42L)).thenReturn(likeResponse);

        LikeResponse response = controller.unlike(auth, 42L);

        assertEquals(likeResponse, response);
        verify(userProfileService).unlike("maco@example.com", 42L);
    }
}
