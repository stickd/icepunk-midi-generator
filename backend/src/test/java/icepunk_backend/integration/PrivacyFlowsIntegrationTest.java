package icepunk_backend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.security.JwtService;
import icepunk_backend.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.testcontainers.containers.PostgreSQLContainer;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class PrivacyFlowsIntegrationTest {
    static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16-alpine");
    static { PG.start(); }
    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", PG::getJdbcUrl);
        r.add("spring.datasource.username", PG::getUsername);
        r.add("spring.datasource.password", PG::getPassword);
        r.add("spring.datasource.driver-class-name", PG::getDriverClassName);
        r.add("spring.flyway.enabled", () -> "true");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        r.add("spring.jpa.open-in-view", () -> "false");
        r.add("account.deletion.initial-delay-ms", () -> "3600000");
    }
    @Autowired MockMvc http;
    @Autowired JdbcTemplate db;
    @Autowired UserRepository users;
    @Autowired JwtService jwt;
    @Autowired EmailVerificationService verification;
    @Autowired GeneratedPackTransactionService packTransactions;
    @Autowired ObjectMapper json;
    @MockitoBean EmailService email;
    @MockitoBean AuthRateLimitService limits;
    @MockitoBean MidiGenerationService generator;
    @MockitoBean GeneratedPackStorageService generatedStorage;
    @MockitoBean software.amazon.awssdk.services.s3.S3Client s3;
    @Autowired AccountDeletionService deletion;
    @Autowired org.springframework.security.crypto.password.PasswordEncoder passwords;
    @org.junit.jupiter.api.io.TempDir java.nio.file.Path temp;

    User user() {
        String name = "u" + UUID.randomUUID().toString().replace("-", "");
        var u = new User(name, name + "@test.invalid", "SENSITIVE_PASSWORD_HASH");
        u.setVerified(true);
        return users.saveAndFlush(u);
    }
    String bearer(User user) { return "Bearer " + jwt.generateToken(user.getEmail()); }
    UUID pack(User owner, String visibility) {
        UUID id = UUID.randomUUID();
        db.update("insert into generated_packs(id,owner_id,name,source_type,generation_type,amount,visibility,zip_object_key) values (?,?,'Owned pack','FACTORY','MELODY',1,?,?)", id, owner.getId(), visibility, "secret/"+id);
        db.update("insert into generated_pack_items(id,pack_id,item_index,file_name,midi_object_key,note_count) values (?,?,0,'melody.mid',?,42)", UUID.randomUUID(), id, "secret/item/"+id);
        return id;
    }
    long upload(User owner, String visibility) {
        return db.queryForObject("insert into user_uploaded_projects(owner_id,title,midi_object_key,sample_object_key,visibility,metadata) values (?,'Owned upload',?,?,?,cast(? as jsonb)) returning id", Long.class,
                owner.getId(), "secret/midi/"+UUID.randomUUID(), "secret/sample/"+UUID.randomUUID(), visibility,
                "{\"midiOriginalFilename\":\"upload.mid\",\"sampleOriginalFilename\":\"sample.wav\",\"sampleContentType\":\"audio/wav\",\"internalSecret\":\"NEVER_EXPORT\"}");
    }
    String reportBody(String type, Object id, String category, String description) throws Exception {
        var data = new HashMap<String,Object>(); data.put("targetType",type); data.put("targetId",id.toString()); data.put("category",category); data.put("description",description);
        return json.writeValueAsString(data);
    }

    @Test void exportIsAuthenticatedIsolatedAndAllowlisted() throws Exception {
        var a = user(); var b = user(); var packA=pack(a,"PRIVATE"); var packB=pack(b,"PUBLIC");
        upload(a,"PRIVATE"); upload(b,"PUBLIC");
        db.update("insert into user_legal_acceptances(user_id,document_type,document_version) values (?,'TERMS','1.0')", a.getId());
        db.update("insert into email_verification_tokens(user_id,token_hash,created_at,expires_at) values (?,?,now(),now()+interval '1 hour')",a.getId(),"a".repeat(64));
        http.perform(get("/account/export")).andExpect(status().isUnauthorized());
        String body = http.perform(get("/account/export").header("Authorization",bearer(a)))
                .andExpect(status().isOk()).andExpect(header().string("Content-Disposition","attachment; filename=\"icepunk-data-export.json\""))
                .andExpect(header().string("Cache-Control","no-store"))
                .andExpect(jsonPath("$.account.email").value(a.getEmail()))
                .andExpect(jsonPath("$.account.accountStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.generatedFiles[0].note_count").value(42))
                .andExpect(jsonPath("$.samples[0].filename").value("sample.wav"))
                .andExpect(jsonPath("$.legalAcceptances[0].document_version").value("1.0"))
                .andReturn().getResponse().getContentAsString();
        assertTrue(body.contains(packA.toString()));
        for (String secret : List.of(b.getEmail(),packB.toString(),"a".repeat(64),"SENSITIVE_PASSWORD_HASH","passwordHash","password_hash","tokenHash","token_hash","jwt","operator_notes","secret/","NEVER_EXPORT","internalSecret")) assertFalse(body.contains(secret), secret);
        String other = http.perform(get("/account/export").header("Authorization",bearer(b))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(other.contains(b.getEmail())); assertFalse(other.contains(a.getEmail())); assertFalse(other.contains(packA.toString()));
        http.perform(get("/account/export/"+a.getId()).header("Authorization",bearer(b))).andExpect(status().isNotFound());
        db.update("update users set account_status='DELETION_PENDING' where id=?",a.getId());
        http.perform(get("/account/export").header("Authorization",bearer(a))).andExpect(status().isUnauthorized());
    }

    @Test void reportsAndAdminWorkflowAreIsolated() throws Exception {
        var a=user(); var b=user(); var admin=user(); var target=pack(a,"PUBLIC");
        http.perform(post("/reports").header("Authorization",bearer(b)).contentType(MediaType.APPLICATION_JSON).content(reportBody("GENERATED_PACK",target,"COPYRIGHT",null)))
                .andExpect(status().isAccepted()).andExpect(content().string(""));
        UUID report=db.queryForObject("select id from content_reports where target_id=?",UUID.class,target.toString());
        assertEquals("OPEN",db.queryForObject("select status from content_reports where id=?",String.class,report));
        http.perform(get("/admin/reports")).andExpect(status().isUnauthorized());
        http.perform(get("/admin/reports").header("Authorization",bearer(b))).andExpect(status().isForbidden());
        http.perform(patch("/admin/reports/"+report).header("Authorization",bearer(b)).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACTIONED\"}")).andExpect(status().isForbidden());
        // Promote in the database: no role claim supplied by the caller is trusted.
        String adminJwt=bearer(admin);
        db.update("update users set role='ADMIN' where id=?",admin.getId());
        http.perform(get("/admin/reports?status=OPEN&category=COPYRIGHT&targetType=GENERATED_PACK").header("Authorization",adminJwt)).andExpect(status().isOk()).andExpect(jsonPath("$[0].status").value("OPEN"));
        for (String state : List.of("REVIEWING","ACTIONED","REJECTED")) {
            http.perform(patch("/admin/reports/"+report).header("Authorization",adminJwt).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\""+state+"\",\"operatorNotes\":\"PRIVATE_OPERATOR_NOTE\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.status").value(state)).andExpect(jsonPath("$.operator_notes").value("PRIVATE_OPERATOR_NOTE"));
        }
        assertNotNull(db.queryForObject("select resolved_at from content_reports where id=?",java.sql.Timestamp.class,report));
        http.perform(patch("/admin/reports/"+report).header("Authorization",adminJwt).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"INVALID\"}")).andExpect(status().isBadRequest());
        assertEquals("PUBLIC",db.queryForObject("select visibility from generated_packs where id=?",String.class,target));
        String exported=http.perform(get("/account/export").header("Authorization",bearer(b))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertFalse(exported.contains("PRIVATE_OPERATOR_NOTE"));
        db.update("update users set role='USER' where id=?",admin.getId());
        http.perform(get("/admin/reports").header("Authorization",adminJwt)).andExpect(status().isForbidden());
    }

    @Test void reportsValidatePublicTargetsAndPayload() throws Exception {
        var a=user(); var b=user(); long publicUpload=upload(a,"PUBLIC"); long privateUpload=upload(a,"PRIVATE"); var privatePack=pack(a,"PRIVATE");
        http.perform(post("/reports").header("Authorization",bearer(b)).contentType(MediaType.APPLICATION_JSON).content(reportBody("UPLOAD",publicUpload,"SPAM",""))).andExpect(status().isAccepted());
        for (var entry : Map.of("UPLOAD",String.valueOf(privateUpload),"GENERATED_PACK",privatePack.toString()).entrySet())
            http.perform(post("/reports").header("Authorization",bearer(b)).contentType(MediaType.APPLICATION_JSON).content(reportBody(entry.getKey(),entry.getValue(),"OTHER",null))).andExpect(status().isNotFound());
        http.perform(post("/reports").header("Authorization",bearer(b)).contentType(MediaType.APPLICATION_JSON).content(reportBody("GENERATED_PACK",UUID.randomUUID(),"OTHER",null))).andExpect(status().isNotFound());
        http.perform(post("/reports").header("Authorization",bearer(b)).contentType(MediaType.APPLICATION_JSON).content(reportBody("UPLOAD",publicUpload,"INVALID",null))).andExpect(status().isBadRequest());
        http.perform(post("/reports").header("Authorization",bearer(b)).contentType(MediaType.APPLICATION_JSON).content(reportBody("UPLOAD",publicUpload,"OTHER","x".repeat(2001)))).andExpect(status().isBadRequest());
        assertEquals("PUBLIC", db.queryForObject("select visibility from user_uploaded_projects where id=?",String.class,publicUpload));
    }

    @Test void termsPersistOnlyTermsAndClientCannotGrantAdmin() throws Exception {
        String name="reg"+UUID.randomUUID().toString().replace("-","");
        var body=new HashMap<String,Object>(Map.of("username",name,"email",name+"@test.invalid","password","SafePassword123!","role","ADMIN"));
        http.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isBadRequest());
        body.put("termsAccepted",false);
        http.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isBadRequest());
        body.put("termsAccepted",true);
        http.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isAccepted());
        var u=users.findByEmail(name+"@test.invalid").orElseThrow();
        assertEquals("USER",u.getRole());
        var accepted=db.queryForMap("select document_type,document_version,accepted_at from user_legal_acceptances where user_id=?",u.getId());
        assertEquals("TERMS",accepted.get("document_type")); assertEquals("1.0",accepted.get("document_version")); assertNotNull(accepted.get("accepted_at"));
        var token=org.mockito.ArgumentCaptor.forClass(String.class);
        verify(email).sendVerificationEmail(eq(u.getEmail()),token.capture());
        http.perform(get("/auth/verify-email").param("token",token.getValue())).andExpect(status().isOk());
        http.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("identifier",u.getEmail(),"password","SafePassword123!")))).andExpect(status().isOk());
    }

    @Test void staleTokenCleanupPreservesLiveVerification() throws Exception {
        var u=user(); db.update("update users set verified=false where id=?",u.getId());
        String raw="active-test-verification-token";
        String hash=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        db.update("insert into email_verification_tokens(user_id,token_hash,created_at,expires_at) values (?,?,now(),now()+interval '30 minutes')",u.getId(),hash);
        db.update("insert into email_verification_tokens(user_id,token_hash,created_at,expires_at) values (?,?,now()-interval '3 days',now()-interval '2 days')",u.getId(),"e".repeat(64));
        db.update("insert into email_verification_tokens(user_id,token_hash,created_at,expires_at,used_at) values (?,?,now()-interval '3 days',now()+interval '1 day',now()-interval '2 days')",u.getId(),"d".repeat(64));
        verification.cleanupStaleTokens();
        assertEquals(1,db.queryForObject("select count(*) from email_verification_tokens where user_id=?",Integer.class,u.getId()));
        assertEquals(EmailVerificationService.Result.VERIFIED,verification.verify(raw));
    }

    @Test void newPackIsPrivateUntilExplicitlyPublishedAndHistoricalPublicSurvives() throws Exception {
        var a=user(); UUID historical=pack(a,"PUBLIC");
        var request=new icepunk_backend.dto.GenerationRequest();
        request.setAmount(1);
        var created=packTransactions.createPendingPack(a,request,List.of(java.nio.file.Path.of("new.mid")));
        assertTrue(packTransactions.finalizeReady(created.packId()));
        assertEquals("PRIVATE",db.queryForObject("select visibility from generated_packs where id=?",String.class,created.packId()));
        http.perform(get("/generated-packs/"+created.packId())).andExpect(status().isNotFound());
        http.perform(patch("/generated-packs/"+created.packId()+"/visibility").header("Authorization",bearer(a)).contentType(MediaType.APPLICATION_JSON).content("{\"visibility\":\"PUBLIC\"}"))
                .andExpect(status().isOk());
        assertEquals("PUBLIC",db.queryForObject("select visibility from generated_packs where id=?",String.class,created.packId()));
        assertEquals("PUBLIC",db.queryForObject("select visibility from generated_packs where id=?",String.class,historical));
    }

    /** Real HTTP security/controllers/services/PostgreSQL; only provider I/O is simulated. */
    @Test void legalPrivacyJourneyThroughDeletionPreservesOtherUser() throws Exception {
        String name="flow"+UUID.randomUUID().toString().replace("-","");
        String address=name+"@test.invalid";
        var registration=new HashMap<String,Object>(Map.of("username",name,"email",address,"password","SafePassword123!"));
        http.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(registration))).andExpect(status().isBadRequest());
        registration.put("termsAccepted",true);
        http.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(registration))).andExpect(status().isAccepted());
        var raw=org.mockito.ArgumentCaptor.forClass(String.class);
        verify(email).sendVerificationEmail(eq(address),raw.capture());
        http.perform(get("/auth/verify-email").param("token",raw.getValue())).andExpect(status().isOk());
        String credentials=json.writeValueAsString(Map.of("identifier",address,"password","SafePassword123!"));
        String login=http.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(credentials)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String auth="Bearer "+json.readTree(login).get("token").asText();
        var a=users.findByEmail(address).orElseThrow(); var b=user(); var admin=user();
        db.update("update users set password_hash=? where id=?",passwords.encode("SafePassword123!"),b.getId());
        String bCredentials=json.writeValueAsString(Map.of("identifier",b.getEmail(),"password","SafePassword123!"));
        http.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(bCredentials)).andExpect(status().isOk());
        long bUpload=upload(b,"PUBLIC");
        when(generator.generateFiles(any(),any())).thenAnswer(call -> {
            var dir=java.nio.file.Files.createDirectories(temp.resolve("output"));
            var midi=java.nio.file.Files.write(dir.resolve("track.mid"),icepunk_backend.support.ValidMidiFixtures.singleNoteStandardMidi());
            var zip=java.nio.file.Files.writeString(temp.resolve("pack.zip"),"test archive");
            return new MidiGenerationService.GeneratedFiles(dir,zip,List.of(midi));
        });
        when(generatedStorage.uploadMidi(any(),any())).thenAnswer(call -> new GeneratedPackStorageService.StoredObject(call.getArgument(1)));
        when(generatedStorage.uploadZip(any(),any())).thenAnswer(call -> new GeneratedPackStorageService.StoredObject(call.getArgument(1)));
        String generated=http.perform(post("/generate").header("Authorization",auth).contentType(MediaType.APPLICATION_JSON).content("{\"amount\":1}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        UUID packId=UUID.fromString(json.readTree(generated).get("packId").asText());
        assertEquals("PRIVATE",db.queryForObject("select visibility from generated_packs where id=?",String.class,packId));
        http.perform(get("/generated-packs/"+packId).header("Authorization",bearer(b))).andExpect(status().isNotFound());
        http.perform(patch("/generated-packs/"+packId+"/visibility").header("Authorization",auth).contentType(MediaType.APPLICATION_JSON).content("{\"visibility\":\"PUBLIC\"}")).andExpect(status().isOk());
        http.perform(get("/generated-packs/"+packId).header("Authorization",bearer(b))).andExpect(status().isOk());
        http.perform(post("/reports").header("Authorization",bearer(b)).contentType(MediaType.APPLICATION_JSON).content(reportBody("GENERATED_PACK",packId,"OTHER",null))).andExpect(status().isAccepted());
        UUID report=db.queryForObject("select id from content_reports where target_id=?",UUID.class,packId.toString());
        assertEquals("OPEN",db.queryForObject("select status from content_reports where id=?",String.class,report));
        db.update("update users set role='ADMIN' where id=?",admin.getId());
        http.perform(get("/admin/reports?status=OPEN").header("Authorization",bearer(admin))).andExpect(status().isOk());
        for (String state : List.of("REVIEWING","ACTIONED"))
            http.perform(patch("/admin/reports/"+report).header("Authorization",bearer(admin)).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\""+state+"\",\"operatorNotes\":\"Internal review\"}")).andExpect(status().isOk());
        String export=http.perform(get("/account/export").header("Authorization",auth)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(export.contains(address)); assertFalse(export.contains(b.getEmail())); assertFalse(export.contains("Internal review"));
        http.perform(delete("/account").header("Authorization",auth)).andExpect(status().isAccepted());
        http.perform(get("/account/export").header("Authorization",auth)).andExpect(status().isUnauthorized());
        http.perform(delete("/account").header("Authorization",auth)).andExpect(status().isAccepted());
        deletion.processNext();
        assertEquals("COMPLETE",db.queryForObject("select status from account_deletion_jobs where user_id_snapshot=?",String.class,a.getId()));
        http.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(credentials)).andExpect(status().isUnauthorized());
        http.perform(get("/generated-packs/"+packId)).andExpect(status().isNotFound());
        String feed=http.perform(get("/generated-packs/feed")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertFalse(feed.contains(packId.toString()));
        assertEquals(0,db.queryForObject("select count(*) from generated_packs where owner_id=?",Integer.class,a.getId()));
        http.perform(get("/account/export").header("Authorization",bearer(b))).andExpect(status().isOk());
        http.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(bCredentials)).andExpect(status().isOk());
        assertEquals(b.getId(),db.queryForObject("select owner_id from user_uploaded_projects where id=?",Long.class,bUpload));
    }
}
