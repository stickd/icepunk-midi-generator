package icepunk_backend.service;

import icepunk_backend.dto.GeneratedPackResponse;
import icepunk_backend.dto.GenerationRequest;
import icepunk_backend.dto.MidiPreviewNoteResponse;
import icepunk_backend.dto.MidiPreviewResponse;
import icepunk_backend.dto.PublicGeneratedPackFeedResponse;
import icepunk_backend.model.GeneratedPack;
import icepunk_backend.model.GeneratedPackItem;
import icepunk_backend.model.GeneratedPackType;
import icepunk_backend.model.GeneratedPackVisibility;
import icepunk_backend.model.GenerationSourceType;
import icepunk_backend.model.User;
import icepunk_backend.repository.GeneratedPackItemRepository;
import icepunk_backend.repository.GeneratedPackRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GeneratedPackServiceTest {

    private final GeneratedPackRepository packRepository = mock(GeneratedPackRepository.class);
    private final GeneratedPackItemRepository itemRepository = mock(GeneratedPackItemRepository.class);
    private final GeneratedPackStorageService storageService = mock(GeneratedPackStorageService.class);
    private final MidiMetadataExtractor metadataExtractor = mock(MidiMetadataExtractor.class);
    private final GeneratedPackService service = new GeneratedPackService(
            packRepository,
            itemRepository,
            storageService,
            metadataExtractor
    );

    @TempDir
    Path tempDir;

    @Test
    void persistsPackAndItemsWithBackendDownloadUrls() throws Exception {
        User owner = new User("nikul", "nikul@example.com", "hash");
        owner.setId(1L);
        Path outputDir = Files.createDirectories(tempDir.resolve("out"));
        Path midiPath = Files.writeString(outputDir.resolve("track.mid"), "midi");
        Path zipPath = Files.writeString(tempDir.resolve("pack.zip"), "zip");
        MidiGenerationService.GeneratedFiles generatedFiles =
                new MidiGenerationService.GeneratedFiles(outputDir, zipPath, List.of(midiPath));
        GenerationRequest request = factoryRequest();
        MidiPreviewResponse preview = new MidiPreviewResponse(
                List.of(new MidiPreviewNoteResponse(60, 0.0, 0.5, 96)),
                false
        );

        when(metadataExtractor.extract(midiPath)).thenReturn(new MidiMetadataExtractor.MidiMetadata(
                4.0,
                1,
                1,
                60,
                60,
                60.0,
                146,
                preview
        ));
        when(storageService.uploadMidi(midiPath))
                .thenReturn(new GeneratedPackStorageService.StoredObject("generated_midi_items/item.mid", "https://cdn/item.mid"));
        when(storageService.uploadZip(zipPath))
                .thenReturn(new GeneratedPackStorageService.StoredObject("generated_midi/pack.zip", "https://cdn/pack.zip"));
        when(packRepository.save(any(GeneratedPack.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemRepository.save(any(GeneratedPackItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        GeneratedPackResponse response = service.persistGeneratedPack(owner, request, generatedFiles);

        assertEquals("Test Pack", response.name());
        assertEquals("FACTORY", response.source());
        assertEquals("MELODY", response.type());
        assertEquals("/generated-packs/" + response.packId() + "/download", response.packDownloadUrl());
        assertEquals(1, response.items().size());
        assertEquals("track.mid", response.items().get(0).fileName());
        assertEquals(
                "/generated-packs/" + response.packId() + "/items/" + response.items().get(0).id() + "/download",
                response.items().get(0).downloadUrl()
        );
        assertEquals(1, response.items().get(0).preview().notes().size());
        assertFalse(response.toString().contains("generated_midi_items/"));
        assertFalse(response.toString().contains("generated_midi/"));
    }

    @Test
    void packDownloadResolvesStoredZipObjectInternally() {
        UUID packId = UUID.randomUUID();
        GeneratedPack pack = new GeneratedPack();
        pack.setId(packId);
        pack.setZipObjectKey("generated_midi/pack.zip");

        when(packRepository.findById(packId)).thenReturn(Optional.of(pack));
        when(storageService.publicUrlForObjectKey("generated_midi/pack.zip"))
                .thenReturn("https://cdn/pack.zip");

        Optional<String> url = service.getPackDownloadUrl(packId);

        assertTrue(url.isPresent());
        assertEquals("https://cdn/pack.zip", url.get());
    }

    @Test
    void cleansUploadedMidiObjectWhenZipUploadFails() throws Exception {
        Path outputDir = Files.createDirectories(tempDir.resolve("out-fail"));
        Path midiPath = Files.writeString(outputDir.resolve("track.mid"), "midi");
        Path zipPath = Files.writeString(tempDir.resolve("pack-fail.zip"), "zip");
        MidiGenerationService.GeneratedFiles generatedFiles =
                new MidiGenerationService.GeneratedFiles(outputDir, zipPath, List.of(midiPath));

        when(metadataExtractor.extract(midiPath)).thenReturn(new MidiMetadataExtractor.MidiMetadata(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                new MidiPreviewResponse(List.of(), false)
        ));
        when(storageService.uploadMidi(midiPath))
                .thenReturn(new GeneratedPackStorageService.StoredObject("generated_midi_items/item.mid", "https://cdn/item.mid"));
        doThrow(new RuntimeException("S3 failed")).when(storageService).uploadZip(zipPath);

        assertThrows(RuntimeException.class, () -> service.persistGeneratedPack(null, factoryRequest(), generatedFiles));

        verify(storageService).deleteObjectQuietly("generated_midi_items/item.mid");
    }

    @Test
    void cleansUploadedObjectsWhenDatabaseFlushFails() throws Exception {
        User owner = new User("nikul", "nikul@example.com", "hash");
        owner.setId(1L);
        Path outputDir = Files.createDirectories(tempDir.resolve("out-db-fail"));
        Path midiPath = Files.writeString(outputDir.resolve("track.mid"), "midi");
        Path zipPath = Files.writeString(tempDir.resolve("pack-db-fail.zip"), "zip");
        MidiGenerationService.GeneratedFiles generatedFiles =
                new MidiGenerationService.GeneratedFiles(outputDir, zipPath, List.of(midiPath));

        when(metadataExtractor.extract(midiPath)).thenReturn(new MidiMetadataExtractor.MidiMetadata(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                new MidiPreviewResponse(List.of(), false)
        ));
        when(storageService.uploadMidi(midiPath))
                .thenReturn(new GeneratedPackStorageService.StoredObject("generated_midi_items/item.mid", "https://cdn/item.mid"));
        when(storageService.uploadZip(zipPath))
                .thenReturn(new GeneratedPackStorageService.StoredObject("generated_midi/pack.zip", "https://cdn/pack.zip"));
        when(packRepository.save(any(GeneratedPack.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemRepository.save(any(GeneratedPackItem.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new RuntimeException("constraint failed")).when(itemRepository).flush();

        assertThrows(RuntimeException.class, () -> service.persistGeneratedPack(owner, factoryRequest(), generatedFiles));

        verify(storageService).deleteObjectQuietly("generated_midi_items/item.mid");
        verify(storageService).deleteObjectQuietly("generated_midi/pack.zip");
    }

    @Test
    void getPackReturnsEmptyForPrivatePackWhenViewerIsNotOwner() {
        User owner = new User("owner", "owner@example.com", "hash");
        owner.setId(1L);
        User stranger = new User("stranger", "stranger@example.com", "hash");
        stranger.setId(2L);

        UUID packId = UUID.randomUUID();
        GeneratedPack pack = privatePack(packId, owner);

        when(packRepository.findWithItemsById(packId)).thenReturn(Optional.of(pack));

        assertTrue(service.getPack(packId, stranger).isEmpty());
        assertTrue(service.getPack(packId, null).isEmpty());
    }

    @Test
    void getPackReturnsPrivatePackForOwner() {
        User owner = new User("owner", "owner@example.com", "hash");
        owner.setId(1L);

        UUID packId = UUID.randomUUID();
        GeneratedPack pack = privatePack(packId, owner);

        when(packRepository.findWithItemsById(packId)).thenReturn(Optional.of(pack));

        assertTrue(service.getPack(packId, owner).isPresent());
    }

    @Test
    void getPackDownloadReturnsEmptyForPrivatePackWhenViewerIsNotOwner() {
        User owner = new User("owner", "owner@example.com", "hash");
        owner.setId(1L);

        UUID packId = UUID.randomUUID();
        GeneratedPack pack = privatePack(packId, owner);
        pack.setZipObjectKey("generated_midi/private.zip");

        when(packRepository.findById(packId)).thenReturn(Optional.of(pack));

        assertTrue(service.getPackDownload(packId, null).isEmpty());
        verify(storageService, org.mockito.Mockito.never()).readObject(any());
    }

    @Test
    void getItemDownloadReturnsEmptyForPrivatePackWhenViewerIsNotOwner() {
        User owner = new User("owner", "owner@example.com", "hash");
        owner.setId(1L);

        UUID packId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        GeneratedPack pack = privatePack(packId, owner);

        GeneratedPackItem item = new GeneratedPackItem();
        item.setId(itemId);
        item.setPack(pack);
        item.setFileName("track.mid");
        item.setMidiObjectKey("generated_midi_items/private.mid");

        when(itemRepository.findByIdAndPackId(itemId, packId)).thenReturn(Optional.of(item));

        assertTrue(service.getItemDownload(packId, itemId, null).isEmpty());
        verify(storageService, org.mockito.Mockito.never()).readObject(any());
    }

    private GeneratedPack privatePack(UUID packId, User owner) {
        GeneratedPack pack = new GeneratedPack();
        pack.setId(packId);
        pack.setOwner(owner);
        pack.setName("Secret Pack");
        pack.setSourceType(GenerationSourceType.FACTORY);
        pack.setGenerationType(GeneratedPackType.MELODY);
        pack.setBpm(146);
        pack.setPitch(0);
        pack.setOctaves(1);
        pack.setAmount(5);
        pack.setVisibility(GeneratedPackVisibility.PRIVATE);
        pack.setCreatedAt(OffsetDateTime.now());
        return pack;
    }

    @Test
    void getPublicFeedByUsernameReturnsPacksOwnedByThatUser() {
        User owner = new User("nikul", "nikul@example.com", "hash");
        owner.setId(7L);

        GeneratedPack pack = new GeneratedPack();
        pack.setId(UUID.randomUUID());
        pack.setOwner(owner);
        pack.setName("SteveMuis");
        pack.setSourceType(GenerationSourceType.FACTORY);
        pack.setGenerationType(GeneratedPackType.MELODY);
        pack.setBpm(146);
        pack.setPitch(0);
        pack.setOctaves(1);
        pack.setAmount(5);
        pack.setVisibility(GeneratedPackVisibility.PUBLIC);
        pack.setCreatedAt(OffsetDateTime.now());

        Pageable pageable = PageRequest.of(0, 10);
        when(packRepository.findPublicAuthenticatedPacksByUsername(
                eq("nikul"), eq(GeneratedPackVisibility.PUBLIC), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(pack), pageable, 1));

        PublicGeneratedPackFeedResponse response = service.getPublicFeedByUsername("nikul", 0, 10);

        assertEquals(1, response.items().size());
        assertEquals("SteveMuis", response.items().get(0).name());
        assertEquals("nikul", response.items().get(0).ownerUsername());
        assertEquals(1, response.totalItems());
    }

    private GenerationRequest factoryRequest() {
        GenerationRequest request = new GenerationRequest();
        request.setSource(GenerationRequest.GenerationSource.FACTORY);
        request.setAmount(10);
        request.setPackName("Test Pack");
        request.setType(GenerationRequest.GenerationType.MELODY);
        request.setBpm(146);
        request.setPitch(0);
        request.setOctaves(1);
        return request;
    }
}
