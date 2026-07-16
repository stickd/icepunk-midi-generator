package icepunk_backend.service;

import icepunk_backend.model.GeneratedPack;
import icepunk_backend.model.GeneratedPackStatus;
import icepunk_backend.repository.GeneratedPackRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.OffsetDateTime;
import java.util.*;

/** Compensating object deletion. The database is the source of truth for keys. */
@Service
public class GeneratedPackCleanupService {
    private final GeneratedPackRepository packs; private final GeneratedPackStorageService storage;
    public GeneratedPackCleanupService(GeneratedPackRepository packs, GeneratedPackStorageService storage){this.packs=packs;this.storage=storage;}
    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public Result cleanup(UUID packId){
        GeneratedPack pack=packs.findWithItemsById(packId).orElseThrow();
        if(pack.getStatus()==GeneratedPackStatus.READY) throw new IllegalStateException("READY packs cannot be cleaned");
        int attempted=0, failed=0;
        for(var item:pack.getItems()){attempted++; try{storage.deleteObject(item.getMidiObjectKey());}catch(RuntimeException ex){failed++;}}
        if(pack.getZipObjectKey()!=null){attempted++;try{storage.deleteObject(pack.getZipObjectKey());}catch(RuntimeException ex){failed++;}}
        pack.setCleanupAttempts(pack.getCleanupAttempts()+1); pack.setLastCleanupAt(OffsetDateTime.now());
        pack.setCleanupRequired(failed>0); pack.setCleanupLastError(failed>0?"OBJECT_DELETE_FAILED":null); packs.save(pack);
        return new Result(failed==0,attempted,attempted-failed,failed,failed==0?null:"OBJECT_DELETE_FAILED");
    }
    public record Result(boolean complete,int attempted,int successful,int failed,String error){}
}
