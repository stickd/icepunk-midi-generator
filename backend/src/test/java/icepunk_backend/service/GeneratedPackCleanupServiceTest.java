package icepunk_backend.service;

import icepunk_backend.exception.StorageException;
import icepunk_backend.model.*;
import icepunk_backend.repository.GeneratedPackRepository;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GeneratedPackCleanupServiceTest {
    private final GeneratedPackRepository packs=mock(GeneratedPackRepository.class);
    private final GeneratedPackStorageService storage=mock(GeneratedPackStorageService.class);
    private final GeneratedPackCleanupService service=new GeneratedPackCleanupService(packs,storage);

    @Test void deleteFailureContinuesCleanupAndPersistsSanitisedFailureMetadata(){
        GeneratedPack pack=failedPack(); when(packs.findWithItemsById(pack.getId())).thenReturn(Optional.of(pack));
        doThrow(new StorageException("https://secret/key token=bad")).when(storage).deleteObject("item-1");
        var result=service.cleanup(pack.getId());
        assertFalse(result.complete()); assertEquals(3,result.attempted()); assertEquals(1,result.failed());
        assertEquals(1,pack.getCleanupAttempts()); assertTrue(pack.isCleanupRequired()); assertEquals("OBJECT_DELETE_FAILED",pack.getCleanupLastError()); assertNotNull(pack.getLastCleanupAt());
        verify(storage).deleteObject("item-2"); verify(storage).deleteObject("zip"); verify(packs).save(pack);
    }
    @Test void repeatCleanupTreatsMissingObjectsAsSuccessAndClearsMarker(){
        GeneratedPack pack=failedPack(); when(packs.findWithItemsById(pack.getId())).thenReturn(Optional.of(pack)); doThrow(new StorageException("x")).when(storage).deleteObject("item-1"); service.cleanup(pack.getId()); reset(storage); service.cleanup(pack.getId());
        assertEquals(2,pack.getCleanupAttempts()); assertFalse(pack.isCleanupRequired()); assertNull(pack.getCleanupLastError()); assertEquals(GeneratedPackStatus.FAILED,pack.getStatus());
    }
    @Test void cleanupRejectsReadyPackWithoutDeletingObjects(){ GeneratedPack pack=failedPack(); pack.setStatus(GeneratedPackStatus.READY); when(packs.findWithItemsById(pack.getId())).thenReturn(Optional.of(pack)); assertThrows(IllegalStateException.class,()->service.cleanup(pack.getId())); verifyNoInteractions(storage); assertEquals(0,pack.getCleanupAttempts()); }
    private GeneratedPack failedPack(){ GeneratedPack p=new GeneratedPack();p.setId(UUID.randomUUID());p.setStatus(GeneratedPackStatus.FAILED);p.setZipObjectKey("zip"); for(int i=1;i<3;i++){GeneratedPackItem item=new GeneratedPackItem();item.setId(UUID.randomUUID());item.setPack(p);item.setMidiObjectKey("item-"+i);p.getItems().add(item);}return p; }
}
