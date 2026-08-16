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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import icepunk_backend.support.ValidMidiFixtures;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;

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
    void finalizationFailureAfterAllUploadsMarksFailedAndCleansAllObjects() throws Exception {
        GeneratedPackTransactionService transactions = mock(GeneratedPackTransactionService.class);
        GeneratedPackCleanupService cleanup = mock(GeneratedPackCleanupService.class);
        GeneratedPackService staged = new GeneratedPackService(packRepository, itemRepository, storageService, metadataExtractor, transactions, cleanup);
        Path output = Files.createDirectories(tempDir.resolve("staged"));
        Path first = Files.writeString(output.resolve("one.mid"), "midi");
        Path second = Files.writeString(output.resolve("two.mid"), "midi");
        Path zip = Files.writeString(output.resolve("pack.zip"), "zip");
        UUID packId = UUID.randomUUID();
        var context = new GeneratedPackTransactionService.Context(packId, "generated-packs/p/archive/z.zip", List.of(
                new GeneratedPackTransactionService.Item(UUID.randomUUID(), "generated-packs/p/items/a.mid"),
                new GeneratedPackTransactionService.Item(UUID.randomUUID(), "generated-packs/p/items/b.mid")));
        RuntimeException original = new RuntimeException("finalization failed");
        when(transactions.createPendingPack(any(), any(), any())).thenReturn(context);
        doThrow(original).when(transactions).finalizeReady(packId);
        MidiGenerationService.GeneratedFiles files = new MidiGenerationService.GeneratedFiles(output, zip, List.of(first, second));
        GenerationRequest request = factoryRequest();
        request.setAmount(2);
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> staged.persistGeneratedPack(null, request, files));
        assertSame(original, thrown);
        var order = inOrder(transactions, storageService, cleanup);
        order.verify(transactions).createPendingPack(any(), any(), any());
        order.verify(storageService).uploadMidi(first, context.items().get(0).key());
        order.verify(storageService).uploadMidi(second, context.items().get(1).key());
        order.verify(storageService).uploadZip(zip, context.zipKey());
        order.verify(transactions).finalizeReady(packId);
        order.verify(transactions).markFailedIfPending(packId, "PACK_FINALIZATION_FAILED");
        order.verify(cleanup).cleanup(packId);
    }

    @Test
    void partialItemUploadFailureMarksFailedCleansAndSkipsZip() throws Exception {
        GeneratedPackTransactionService tx=mock(GeneratedPackTransactionService.class); GeneratedPackCleanupService cleanup=mock(GeneratedPackCleanupService.class);
        GeneratedPackService staged=new GeneratedPackService(packRepository,itemRepository,storageService,metadataExtractor,tx,cleanup);
        Path dir=Files.createDirectories(tempDir.resolve("partial")); Path one=Files.writeString(dir.resolve("1.mid"),"x"), two=Files.writeString(dir.resolve("2.mid"),"x"), three=Files.writeString(dir.resolve("3.mid"),"x"), zip=Files.writeString(dir.resolve("p.zip"),"x"); UUID id=UUID.randomUUID();
        var c=new GeneratedPackTransactionService.Context(id,"z",List.of(new GeneratedPackTransactionService.Item(UUID.randomUUID(),"a"),new GeneratedPackTransactionService.Item(UUID.randomUUID(),"b"),new GeneratedPackTransactionService.Item(UUID.randomUUID(),"c"))); RuntimeException original=new RuntimeException("item");
        when(tx.createPendingPack(any(),any(),any())).thenReturn(c); doThrow(original).when(storageService).uploadMidi(two,"b");
        GenerationRequest request = factoryRequest(); request.setAmount(3);
        assertSame(original,assertThrows(RuntimeException.class,()->staged.persistGeneratedPack(null,request,new MidiGenerationService.GeneratedFiles(dir,zip,List.of(one,two,three)))));
        verify(storageService,org.mockito.Mockito.never()).uploadMidi(three,"c"); verify(storageService,org.mockito.Mockito.never()).uploadZip(any(),any()); verify(tx,org.mockito.Mockito.never()).finalizeReady(id); verify(tx).markFailedIfPending(id,"PACK_FINALIZATION_FAILED"); verify(cleanup).cleanup(id);
    }

    @Test
    void zipUploadFailureMarksFailedCleansAndSkipsFinalization() throws Exception {
        GeneratedPackTransactionService tx=mock(GeneratedPackTransactionService.class); GeneratedPackCleanupService cleanup=mock(GeneratedPackCleanupService.class);
        GeneratedPackService staged=new GeneratedPackService(packRepository,itemRepository,storageService,metadataExtractor,tx,cleanup);
        Path dir=Files.createDirectories(tempDir.resolve("zipfail")); Path one=Files.writeString(dir.resolve("1.mid"),"x"), zip=Files.writeString(dir.resolve("p.zip"),"x"); UUID id=UUID.randomUUID(); var c=new GeneratedPackTransactionService.Context(id,"z",List.of(new GeneratedPackTransactionService.Item(UUID.randomUUID(),"a"))); RuntimeException original=new RuntimeException("zip");
        when(tx.createPendingPack(any(),any(),any())).thenReturn(c); doThrow(original).when(storageService).uploadZip(zip,"z");
        GenerationRequest request = factoryRequest(); request.setAmount(1);
        assertSame(original,assertThrows(RuntimeException.class,()->staged.persistGeneratedPack(null,request,new MidiGenerationService.GeneratedFiles(dir,zip,List.of(one)))));
        verify(tx,org.mockito.Mockito.never()).finalizeReady(id); verify(tx).markFailedIfPending(id,"PACK_FINALIZATION_FAILED"); verify(cleanup).cleanup(id);
    }

    @Test
    void stagedFlowFinalizesOnlyWhenAllRequestedMidiFilesParseSuccessfully() throws Exception {
        GeneratedPackTransactionService tx = mock(GeneratedPackTransactionService.class);
        GeneratedPackCleanupService cleanup = mock(GeneratedPackCleanupService.class);
        GeneratedPackService staged = new GeneratedPackService(packRepository, itemRepository, storageService,
                new MidiMetadataExtractor(), tx, cleanup);
        Path dir = Files.createDirectories(tempDir.resolve("five-valid"));
        List<Path> midiFiles = new ArrayList<>();
        List<GeneratedPackTransactionService.Item> items = new ArrayList<>();
        for (int index = 0; index < 5; index++) {
            Path midi = dir.resolve(index + ".mid");
            Files.write(midi, ValidMidiFixtures.singleNoteStandardMidi());
            midiFiles.add(midi);
            items.add(new GeneratedPackTransactionService.Item(UUID.randomUUID(), "item-" + index));
        }
        Path zip = Files.writeString(dir.resolve("pack.zip"), "zip");
        UUID packId = UUID.randomUUID();
        when(tx.createPendingPack(any(), any(), any())).thenReturn(new GeneratedPackTransactionService.Context(packId, "zip", items));
        when(tx.finalizeReady(packId)).thenReturn(true);
        when(packRepository.findWithItemsById(packId)).thenReturn(Optional.of(readyPack(packId)));
        GenerationRequest request = factoryRequest(); request.setAmount(5);

        staged.persistGeneratedPack(null, request, new MidiGenerationService.GeneratedFiles(dir, zip, midiFiles));

        verify(tx).finalizeReady(packId);
        verify(storageService, times(5)).uploadMidi(any(), any());
        verify(cleanup, never()).cleanup(any());
    }

    @Test
    void fewerOrMoreOrZeroMidiFilesFailBeforeAnyUpload() throws Exception {
        assertCountMismatch(5, 4);
        assertCountMismatch(5, 6);
        assertCountMismatch(5, 0);
    }

    @Test
    void parseFailureAfterPartialUploadMarksFailedAndCleansPersistedObjects() throws Exception {
        GeneratedPackTransactionService tx = mock(GeneratedPackTransactionService.class);
        GeneratedPackCleanupService cleanup = mock(GeneratedPackCleanupService.class);
        GeneratedPackService staged = new GeneratedPackService(packRepository, itemRepository, storageService, metadataExtractor, tx, cleanup);
        Path dir = Files.createDirectories(tempDir.resolve("parse-failure"));
        Path first = Files.writeString(dir.resolve("first.mid"), "first");
        Path broken = Files.writeString(dir.resolve("broken.mid"), "broken");
        Path zip = Files.writeString(dir.resolve("pack.zip"), "zip");
        UUID packId = UUID.randomUUID();
        var context = new GeneratedPackTransactionService.Context(packId, "zip", List.of(
                new GeneratedPackTransactionService.Item(UUID.randomUUID(), "first-key"),
                new GeneratedPackTransactionService.Item(UUID.randomUUID(), "broken-key")));
        when(tx.createPendingPack(any(), any(), any())).thenReturn(context);
        doThrow(new IllegalArgumentException("corrupt MIDI")).when(metadataExtractor).extractRequired(broken);
        GenerationRequest request = factoryRequest(); request.setAmount(2);

        assertThrows(RuntimeException.class, () -> staged.persistGeneratedPack(null, request,
                new MidiGenerationService.GeneratedFiles(dir, zip, List.of(first, broken))));

        verify(storageService).uploadMidi(first, "first-key");
        verify(storageService, never()).uploadMidi(broken, "broken-key");
        verify(tx).markFailedIfPending(packId, "MIDI_VALIDATION_FAILED");
        verify(cleanup).cleanup(packId);
        verify(tx, never()).finalizeReady(packId);
    }

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
                .thenReturn(new GeneratedPackStorageService.StoredObject("generated_midi_items/item.mid"));
        when(storageService.uploadZip(zipPath))
                .thenReturn(new GeneratedPackStorageService.StoredObject("generated_midi/pack.zip"));
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
        Optional<String> url = service.getPackDownloadUrl(packId);

        assertTrue(url.isPresent());
        assertEquals("/generated-packs/" + packId + "/download", url.get());
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
                .thenReturn(new GeneratedPackStorageService.StoredObject("generated_midi_items/item.mid"));
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
                .thenReturn(new GeneratedPackStorageService.StoredObject("generated_midi_items/item.mid"));
        when(storageService.uploadZip(zipPath))
                .thenReturn(new GeneratedPackStorageService.StoredObject("generated_midi/pack.zip"));
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

    @Test
    void deletionPendingPackIsHiddenFromMetadataAndAllDownloadPaths() {
        User owner = new User("owner", "owner@example.com", "hash"); owner.setId(1L);
        UUID packId = UUID.randomUUID(); UUID itemId = UUID.randomUUID();
        GeneratedPack pack = privatePack(packId, owner);
        pack.setStatus(icepunk_backend.model.GeneratedPackStatus.FAILED);
        pack.setFailureCode("DELETE_PENDING");
        pack.setZipObjectKey("zip");
        GeneratedPackItem item = new GeneratedPackItem(); item.setId(itemId); item.setPack(pack); item.setMidiObjectKey("item"); item.setFileName("item.mid");
        when(packRepository.findWithItemsById(packId)).thenReturn(Optional.of(pack));
        when(packRepository.findById(packId)).thenReturn(Optional.of(pack));
        when(itemRepository.findByIdAndPackId(itemId, packId)).thenReturn(Optional.of(item));

        assertTrue(service.getPack(packId, owner).isEmpty());
        assertTrue(service.getPackDownloadUrl(packId).isEmpty());
        assertTrue(service.getItemDownloadUrl(packId, itemId).isEmpty());
        assertTrue(service.getPackDownload(packId, owner).isEmpty());
        assertTrue(service.getItemDownload(packId, itemId, owner).isEmpty());
        verify(storageService, never()).readObject(any());
    }

    @Test
    void legacyItemDownloadDoesNotReadStorageWhenItemBelongsToAnotherPack() {
        UUID requestedPackId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        when(itemRepository.findByIdAndPackId(itemId, requestedPackId)).thenReturn(Optional.empty());

        assertTrue(service.getItemDownload(requestedPackId, itemId, null).isEmpty());
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

    private void assertCountMismatch(int expected, int actual) throws Exception {
        GeneratedPackTransactionService tx = mock(GeneratedPackTransactionService.class);
        GeneratedPackCleanupService cleanup = mock(GeneratedPackCleanupService.class);
        GeneratedPackService staged = new GeneratedPackService(packRepository, itemRepository, storageService, metadataExtractor, tx, cleanup);
        Path dir = Files.createDirectories(tempDir.resolve("count-" + expected + "-" + actual + "-" + UUID.randomUUID()));
        List<Path> midiFiles = new ArrayList<>();
        List<GeneratedPackTransactionService.Item> items = new ArrayList<>();
        for (int index = 0; index < actual; index++) {
            midiFiles.add(Files.writeString(dir.resolve(index + ".mid"), "midi"));
            items.add(new GeneratedPackTransactionService.Item(UUID.randomUUID(), "item-" + index));
        }
        Path zip = Files.writeString(dir.resolve("pack.zip"), "zip");
        UUID packId = UUID.randomUUID();
        when(tx.createPendingPack(any(), any(), any())).thenReturn(new GeneratedPackTransactionService.Context(packId, "zip", items));
        GenerationRequest request = factoryRequest(); request.setAmount(expected);

        assertThrows(RuntimeException.class, () -> staged.persistGeneratedPack(null, request,
                new MidiGenerationService.GeneratedFiles(dir, zip, midiFiles)));

        verify(storageService, never()).uploadMidi(any(), any());
        verify(storageService, never()).uploadZip(any(), any());
        verify(tx).markFailedIfPending(packId, "MIDI_COUNT_MISMATCH");
        verify(cleanup).cleanup(packId);
        verify(tx, never()).finalizeReady(packId);
    }

    private GeneratedPack readyPack(UUID packId) {
        GeneratedPack pack = new GeneratedPack();
        pack.setId(packId);
        pack.setName("Ready Pack");
        pack.setSourceType(GenerationSourceType.FACTORY);
        pack.setGenerationType(GeneratedPackType.MELODY);
        pack.setAmount(5);
        pack.setCreatedAt(OffsetDateTime.now());
        pack.setStatus(icepunk_backend.model.GeneratedPackStatus.READY);
        return pack;
    }
}
