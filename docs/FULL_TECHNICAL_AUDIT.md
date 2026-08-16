# iCEPUNK MIDI Generator — полный технический и security-аудит

Дата аудита: 2026-07-16

Репозиторий: C:\Users\nikul\Desktop\icepunk-midi-generator

Ветка и ревизия: dev, 1d6a37bd1cc7

Аудитор: локальный статический и динамический аудит Codex

## 1. Executive summary

Проект **не готов к публичному production-запуску**. Итог: **NOT READY**.

Главная причина — не только набор hardening-задач, а несколько воспроизводимых launch blockers:

1. Собранный backend-контейнер с профилем prod не запускается: Spring Boot отклоняет неизвестное свойство spring.servlet.multipart.max-file-count. После устранения этого дефекта production Compose всё равно не передаёт обязательный TRUSTED_PROXY_CIDRS.
2. Лимит генераций для authenticated users фактически отключён: checkUserLimit и incrementUserUsage пусты, usage всегда 0/0.
3. Публичный POST /datasets/analyze-temp не имеет rate limit или общей concurrency-защиты и на каждый запрос запускает Python. Ошибочные и timeout-ветки также оставляют executor thread; алгоритм построения patterns имеет небезопасную сложность по числу beat-windows.
4. Staged lifecycle generated packs улучшает порядок DB/S3 операций, но не имеет crash recovery, reaper для stale PENDING, автоматического retry cleanup и безопасного conditional FAILED transition. Нет проверки непустого/валидного результата перед READY.
5. Private bucket ожидается архитектурой, но production bootstrap не принудительно снимает старую anonymous policy, а CI E2E явно делает bucket публичным. Состояние реального MinIO не подтверждено.
6. Frontend не отправляет JWT при временном анализе, поэтому custom/dataset flow для вошедшего пользователя создаёт guest analysis, который затем невозможно использовать как authenticated user.
7. CI содержит детерминированно устаревшие проверки: compose job передаёт S3_PUBLIC_URL вместо обязательного S3_PRESIGN_ENDPOINT, а Newman ожидает downloadUrl, который backend интеграционно проверяет как отсутствующий.
8. Документация утверждает, что guest packs ephemeral и не попадают в БД, однако production constructor всегда выбирает staged path до проверки owner == null. Guest packs и объекты остаются без подходящего retention job.

Прямой подтверждённой IDOR, позволяющей User B получить private MIDI User A через актуальные signed URL endpoints, не найдено. В этой части реализация заметно сильнее: item выбирается по паре packId/itemId, затем проверяются READY и visibility/owner, а ошибки чтения скрываются за 404. Однако эта защита не компенсирует launch blockers, DoS, lifecycle и deployment gaps.

Сводка findings:

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 8 |
| Medium | 18 |
| Low | 7 |
| Informational | 4 |
| **Total** | **37** |

## 2. Production readiness verdict

**Verdict: NOT READY.**

Публичный запуск нельзя одобрить до закрытия H-01–H-08 и выполнения blocking-пунктов production launch checklist. Даже при отсутствии атак текущий production image не проходит startup. После минимального исправления startup проект остаётся уязвимым к дешёвому resource-exhaustion через authenticated generation и anonymous temp analysis.

Критерий перехода к READY WITH CONDITIONS:

- prod container стартует с валидированной production-конфигурацией и проходит smoke/readiness test;
- все generation/analyze/upload/auth limits централизованы, атомарны и проверены concurrency-тестами;
- private MinIO policy доказана runtime-тестом и deployment job;
- staged lifecycle получает crash recovery, идемпотентность и failure injection tests;
- custom temp-analysis flow работает для guest и authenticated matrix;
- required CI становится зелёным на текущем контракте;
- TLS/reverse proxy, backups, restore drill, monitoring и secret rotation подтверждены внешними deployment evidence.

## 3. Scope and methodology

### 3.1 Scope

Проверены:

- backend Spring Boot 3/Spring Security/JWT, controllers, services, repositories, entities, Flyway, exception mapping;
- frontend Next.js 16/React/TypeScript, API client, auth/token storage, playback/download/upload/contact flows;
- весь python package midi_generator, пакет midi_analyzer, temp_analyzer.py и entry points;
- PostgreSQL schema/migrations и DB access patterns;
- MinIO/S3 storage, object-key generation, signed URLs и cleanup;
- Dockerfiles, development и production Compose;
- GitHub Actions, Dependabot, package/lock/dependency definitions;
- unit, integration, security, Python и frontend tests;
- документация, deployment checklist, historical audit notes и фактическая реализация.

Не выполнялись атаки на внешние системы, production data, destructive Docker/volume commands, commit, push или изменение бизнес-логики.

### 3.2 Method

Использованы:

- ручной data-flow, trust-boundary и ownership review;
- endpoint-by-endpoint review anonymous/User A/User B;
- статический поиск secrets, debug markers, disabled/skipped tests и небезопасных API;
- локальные build/test/type/lint/dependency/Compose проверки;
- production Docker build и изолированный runtime startup test без сети;
- сопоставление документации с кодом;
- анализ отказов DB before/after S3, process crash, parallel requests и multiple replicas.

Confidence означает:

- **Confirmed** — есть непосредственное доказательство кодом, тестом, локальной командой или runtime log;
- **High confidence** — путь однозначен статически, но полный exploit/runtime не запускался;
- **Suspected** — правдоподобный риск требует дополнительного измерения;
- **Needs runtime verification** — зависит от фактической VPS/MinIO/GitHub конфигурации.

### 3.3 Safety and secret handling

Значения JWT, passwords, access keys и полные presigned URLs не извлекались и не помещались в отчёт. История проверялась только по именам файлов и строковым маркерам. Все runtime-команды использовали фиктивные значения. Реальные secrets не выводились.

## 4. Architecture overview

Основной поток:

1. Browser загружает Next.js UI.
2. UI обращается напрямую к Spring backend по NEXT_PUBLIC_API_URL.
3. Backend аутентифицирует bearer JWT, читает/пишет PostgreSQL и выдаёт presigned MinIO URLs.
4. Для generation backend создаёт локальный workspace, запускает python/generate_midi.py отдельным процессом, ZIP-ует результат, создаёт PENDING rows, загружает item/ZIP objects и переводит pack в READY.
5. Для custom analysis browser отправляет multipart MIDI в Spring; Spring валидирует Java MIDI parser, сохраняет temp files и запускает python/temp_analyzer.py.
6. Dataset preset хранит metadata в PostgreSQL, analysis JSON — в MinIO.
7. nginx/VPS должен публиковать frontend/backend и проксировать forwarded headers; nginx-конфигурация в репозитории отсутствует.

Состояние хранится в четырёх разных местах:

- PostgreSQL: users, guest usage, uploads, presets, generated packs/items, favorites/stats;
- MinIO: generated objects, ZIP, datasets, uploads, samples, avatars;
- local filesystem backend container: temp analysis и avatar fallback;
- browser: JWT и profile UI settings в localStorage, temporary object URLs.

Это делает lifecycle и recovery между DB, S3 и local disk ключевым production-риском.

## 5. Data flow and trust boundaries

Краткая текстовая схема:

    [Anonymous/User browser]
              |
              | HTML/JS, JWT, multipart, JSON, presigned navigation
              v
    [Next.js public origin] ----------------------+
              |                                   |
              | browser-side API calls            | contact API -> Resend
              v                                   |
    [nginx / TLS / forwarded headers]  <--- boundary not present in repo
              |
              v
    [Spring Security + controllers]
       |              |                 |
       | JDBC         | S3 API          | ProcessBuilder, local files
       v              v                 v
    [PostgreSQL]    [MinIO private]    [Python generator/analyzer]
                                          |
                                          v
                                    [temp/output/ZIP files]

Trust boundaries:

- browser → Next.js: весь browser input, localStorage и URLs недоверенные;
- browser → Spring: UI не является security boundary, все endpoints доступны напрямую;
- nginx → Spring: client IP корректен только при точном trusted-proxy deployment;
- Spring → PostgreSQL: transaction boundary не охватывает MinIO и Python;
- Spring → MinIO: bucket policy и credentials являются отдельным control plane;
- Spring → Python: пути создаются сервером и shell не используется, но процесс, CPU/RAM и output остаются недоверенными результатами;
- GitHub Actions → registry/deployment: third-party actions/images/npx dependencies — supply-chain boundary;
- public network → VPS: фактические TLS, firewall, MinIO/backend exposure не представлены кодом репозитория.

## 6. Threat model

### 6.1 Assets

- accounts, password hashes, email/username/profile data;
- bearer JWT и возможность генерации от имени пользователя;
- private generated MIDI, per-item files и ZIP archives;
- uploaded MIDI, samples, avatars и original filenames;
- dataset presets и temporary analysis;
- PostgreSQL data/constraints/migrations;
- MinIO bucket, object keys, policies, access credentials;
- guest/authenticated quotas и global generation capacity;
- Python CPU/RAM/process slots и local disk;
- environment variables, GitHub/VPS secrets, backup copies;
- presigned URLs и их остаточный TTL.

### 6.2 Attackers

- anonymous visitor и botnet/rotating-IP client;
- User A и User B, проверяющие ownership/parent-child mismatch;
- client с expired/malformed/empty/forged JWT;
- user с malicious, malformed или algorithmically expensive MIDI;
- parallel client, создающий race до инкремента quota;
- человек с frontend bundle и знанием всех public API paths;
- человек, знающий UUID pack/item/dataset/temp analysis;
- получатель старого presigned URL;
- человек, обращающийся напрямую к backend/MinIO/internal ports;
- contributor/fork PR или compromised upstream action/package.

### 6.3 Main abuse cases

- получить private object через IDOR, parent-child substitution или public bucket;
- использовать stale JWT как guest и создать ownerless data;
- обойти quota параллельными запросами или multiple replicas;
- исчерпать процессы/threads/disk через analyze-temp;
- добиться READY row при неполном output или оставить PENDING/orphan after crash;
- украсть localStorage JWT при XSS/supply-chain compromise;
- вызвать накопление permanent guest/user-upload/sample/avatar objects;
- использовать публичный contact endpoint для email abuse;
- попасть в production с зелёной только частичной CI-проверкой.

### 6.4 Findings table

| ID | Severity | Confidence | Category | Finding | Evidence | Impact | Fix size |
|---|---|---|---|---|---|---|---|
| H-01 | High | Confirmed | Infrastructure | Production backend не запускается; Compose также не передаёт обязательный trusted-proxy env | application.properties:40; application-prod.properties:17; docker runtime | Полная недоступность production | S |
| H-02 | High | Confirmed | Rate limiting | Authenticated generation quota отключена | GenerationLimitService.java:43-45, 87-92 | Неограниченный CPU/S3/DB abuse | M |
| H-03 | High | Confirmed | Upload/DoS | Public temp analysis запускает неограниченные Python processes и течёт threads; parser имеет опасную complexity | SecurityConfig.java:68; TempAnalysisService.java:323-352; temp_analyzer.py:124-134 | CPU/RAM/thread/disk exhaustion | L |
| H-04 | High | High confidence | Transactionality | Generated pack lifecycle не crash-safe, не идемпотентен и допускает непроверенный READY | GeneratedPackService.java:198-226; GeneratedPackTransactionService.java:6-8 | PENDING/orphans/empty READY/data loss | L |
| H-05 | High | Needs runtime verification | Storage | Private bucket policy не enforced; CI делает bucket public | S3BucketInitializer.java:30-43; ci.yml:196-199, 280-283 | Раскрытие всех private objects при stale policy | M |
| H-06 | High | Confirmed | Frontend/API | Frontend temp analysis не отправляет JWT, authenticated custom flow не может использовать результат | frontend/lib/api.ts:320-331; TempAnalysisService.java:194-205 | Основной authenticated workflow сломан | S |
| H-07 | High | Confirmed | CI/CD | Required CI содержит несовместимый Compose env и устаревший Newman contract | ci.yml:149-162; postman collection:118-120; backend E2E assertions | CI red или проверки обходятся | M |
| H-08 | High | Confirmed | Storage/Abuse | Guest path фактически staged/persistent и не очищается | GeneratedPackService.java:83-87, 198-200; cleanup prefix generated_midi | Неограниченный ownerless storage/DB growth | M |
| M-01 | Medium | Confirmed | Authentication | Invalid/stale JWT тихо превращается в anonymous; нет revocation/JTI/issuer/audience | JwtAuthFilter.java:30-79; JwtService.java:21-31 | Неожиданная guest-операция, 24h stolen-token window | M |
| M-02 | Medium | High confidence | Frontend | JWT в localStorage при отсутствии CSP | frontend auth hooks; next.config.ts | XSS/supply-chain compromise крадёт bearer | M |
| M-03 | Medium | Confirmed | Rate limiting | Guest check выполняется до работы, increment после; new-IP race | GenerateController.java:114-138; GenerationLimitService.java:51-83 | Quota race и wasted generation | M |
| M-04 | Medium | Confirmed | Rate limiting | Login/register limiter per-replica, resettable и без eviction; другие costly endpoints не ограничены | InMemoryRateLimitService.java:19-40 | Bypass при restart/scale, memory growth | M |
| M-05 | Medium | Confirmed | Upload | Sample проверяется только extension/MIME; avatar не декодируется; parser limits post-parse | UserUploadService.java:170-199; MidiUploadValidator.java:42-48 | Persistent arbitrary blobs, decode/parser DoS | M |
| M-06 | Medium | Confirmed | Transactionality | Upload/dataset/avatar/delete flows оставляют DB/S3/local orphans | UserUploadService.java:107-134; storage delete paths | Утечки storage, broken references | L |
| M-07 | Medium | Confirmed | Data integrity | Staged packs теряют BPM/pitch/octaves/metadata/item metadata | GeneratedPackTransactionService.java:6 | Неверный API/data model после READY | M |
| M-08 | Medium | Confirmed | Authorization/Data | Public feed/count/list не фильтруют READY; owner list unbounded | GeneratedPackRepository.java:24-67 | Exposure PENDING/FAILED metadata, memory/query growth | M |
| M-09 | Medium | Confirmed | Storage | Cleanup prefix/semantics расходятся: legacy ZIP удаляется по возрасту, staged prefix не очищается | GeneratedZipCleanupService.java:47-87 | Broken READY downloads и perpetual objects | L |
| M-10 | Medium | High confidence | Authentication | Case-sensitive username unique + ignore-case lookup; password minimum 6 | AuthService.java:50,97; RegisterRequest.java:19 | Identity ambiguity/login failure, weak passwords | M |
| M-11 | Medium | Confirmed | Frontend/Abuse | Browser timeout 15s против backend 60s; contact endpoint без rate limit/timeout | frontend/lib/api.ts:1-21; contact route | Retry amplification, email/cost abuse | M |
| M-12 | Medium | Confirmed | Python/Performance | Generator kill не ждёт завершения/descendants, нет OS resource limits и output validation | MidiGenerationService.java:75-115 | Zombie/long process, invalid artifacts | L |
| M-13 | Medium | Confirmed | Testing | Test config shadows production; public-bucket E2E; flaky frontend; analyzer gaps | test application.properties; CI; local runs | Green tests дают ложную уверенность | L |
| M-14 | Medium | Confirmed | Supply chain | Actions/images/npx mutable; Python no hashes; Dependabot paths incomplete; no SBOM/secret scan | ci.yml; compose; requirements; dependabot.yml | Reproducibility/compromise risk | M |
| M-15 | Medium | Confirmed | Infrastructure | App uses MinIO root credentials; no limits/cap drop/read-only/network separation | docker-compose.production.yml | Excess blast radius и noisy-neighbor failure | L |
| M-16 | Medium | Confirmed | Operations | Нет metrics/readiness/correlation/alerts/log rotation/implemented backup+restore | application properties; production checklist unchecked | Incidents не видны и recovery не доказан | L |
| M-17 | Medium | Confirmed | Privacy | Нет data export/account deletion/retention/legal pages; public metadata may contain filenames/IP-linked data | controllers/routes/docs search | GDPR/operational privacy risk | L |
| M-18 | Medium | High confidence | Performance/Database | N+1/lazy item access, EntityGraph collection pagination, unbounded owner/dataset lists, no shared concurrency control | repositories/services | Degradation при 100+ users/replicas | L |
| L-01 | Low | Confirmed | Authorization/API | Mutations отвечают 403 вместо uniform 404; protected auth обычно 403 вместо 401 | requireOwnedPack; SecurityConfig | Existence oracle/misleading clients | S |
| L-02 | Low | High confidence | Upload/HTTP | Original filename вручную вставляется в Content-Disposition | UserUploadController.java:40-44 | Broken header/filename edge cases | S |
| L-03 | Low | Confirmed | Validation | Нет explicit Jackson limits/unknown/duplicate-key rejection | resources/config search | Contract ambiguity, deep JSON pressure | S |
| L-04 | Low | Confirmed | Signed URLs | TTL не имеет bounds; navigation кладёт URL в history, referrer policy не задан | GeneratedFileAccessService; window.location.assign | Остаточная URL leakage/replay до TTL | S |
| L-05 | Low | Confirmed | Logging | Object keys/internal paths/errors логируются; correlation/redaction policy отсутствует | storage logs; temp_analyzer.py:185 | Internal metadata leakage и трудный incident trace | M |
| L-06 | Low | Confirmed | API/Compatibility | .midi принимается общим validator, но upload service разрешает только .mid; TS contracts содержат stale URL/key fields | UserUploadService; frontend/lib/api.ts | Непоследовательный UX/API | S |
| L-07 | Low | Confirmed | Functionality | Backend принимает pitch/octaves/type, но Python invocation передаёт только analysis/count/BPM | GenerationRequest; MidiGenerationService ProcessBuilder | Запрос не соответствует результату | M |
| I-01 | Informational | Confirmed | Authorization | Актуальные private read/signed endpoints проверяют parent-child, READY и owner/visibility | GeneratedFileAccessService.java:45-68 | Позитивный контроль IDOR | — |
| I-02 | Informational | Confirmed | Authentication | JJWT verifyWith/signWith, user relookup, stateless, explicit CORS; prod Swagger disabled | JwtService; SecurityConfig; application-prod | Позитивный auth baseline | — |
| I-03 | Informational | Confirmed | Infrastructure | Production ports по умолчанию loopback, containers non-root, Flyway+ddl validate | compose/Dockerfiles/prod properties | Позитивный deployment baseline | — |
| I-04 | Informational | Confirmed | Secrets/Testing | Tracked secrets/.env/artifacts не найдены; backend/Python/build checks в основном проходят | git searches; commands | Позитивно, но history/current scanners не закрыты | — |

## 7. Critical findings

Critical findings не подтверждены.

В частности, не найден прямой кодовый путь, позволяющий без знания действующего presigned URL получить private object User A как anonymous/User B через актуальные generated-file endpoints. H-05 остаётся High, а не Critical, потому что реальная public policy production bucket не проверена: раскрытие возможно при небезопасном внешнем состоянии, но не доказано для production.

## 8. High findings

### H-01 — production backend не запускается

- **Severity / Confidence / Category / Fix size:** High / Confirmed / Infrastructure, Configuration / S.
- **Affected:** backend/src/main/resources/application.properties:40; backend/src/main/resources/application-prod.properties:17; docker-compose.production.yml backend.environment.
- **Problem:** Spring Boot 3.5.14 MultipartProperties имеет strict binding и не знает spring.servlet.multipart.max-file-count. Собранный prod container завершается до запуска web server. Независимо от этого prod profile требует TRUSTED_PROXY_CIDRS, но Compose не передаёт переменную в backend container.
- **Scenario:** обычный deploy запускает image с SPRING_PROFILES_ACTIVE=prod. ApplicationContext падает с “elements ... max-file-count were left unbound”. После удаления свойства следующий deployment не получит обязательный trusted proxy CIDR через представленный Compose.
- **Impact:** 100% outage; healthcheck никогда не становится healthy. Неправильный emergency workaround может ослабить IP/rate-limit boundary.
- **Evidence:** production images успешно собраны; локальный docker run --network none с prod profile завершился exit 1 и binding failure на application.properties:40. Тестовый application.properties прямо отмечает, что shadows main application.properties, поэтому 222 tests не видят дефект. Статический Compose review не находит TRUSTED_PROXY_CIDRS в environment.
- **Recommendation:** удалить неподдерживаемое Spring property; проверять count в controller/service или поддерживаемым container control; явно передать TRUSTED_PROXY_CIDRS; добавить prod-context smoke test и container readiness test в CI.

### H-02 — authenticated generation quota отключена

- **Severity / Confidence / Category / Fix size:** High / Confirmed / Rate limiting, Abuse / M.
- **Affected:** GenerationLimitService.getUserUsage, checkUserLimit, incrementUserUsage; GenerateController.generate.
- **Problem:** getUserUsage возвращает 0/0, checkUserLimit и incrementUserUsage пусты. GenerateController вызывает эти методы, но они ничего не ограничивают.
- **Scenario:** один зарегистрированный аккаунт отправляет генерации последовательно или параллельно. Guest limit больше не участвует, а semaphore ограничивает только две одновременные операции на одной replica, не суточный объём.
- **Impact:** неограниченные Python CPU, DB rows, S3 MIDI/ZIP и стоимость; multiple replicas умножают concurrency.
- **Evidence:** GenerationLimitService.java:43-45,87-92. Это не теоретический bypass: production path прямо вызывает no-op methods на строках GenerateController.java:114,135.
- **Recommendation:** ввести server-side per-user quota с атомарным reservation до запуска Python; commit consumption после успеха или release reservation после отказа; общая DB/Redis state; concurrency и duplicate/idempotency key tests.

### H-03 — anonymous temp analysis даёт process/thread/algorithmic DoS

- **Severity / Confidence / Category / Fix size:** High / Confirmed / Upload, Python, DoS / L.
- **Affected:** SecurityConfig public /datasets/analyze-temp; DatasetController.analyzeTemp; TempAnalysisService.analyzeTemp/runAnalyzer; python/temp_analyzer.py build_patterns.
- **Problem:** endpoint публичный и не имеет IP/user rate limit, global semaphore, queue или admission control. Каждый запрос до 100 файлов по 2 MiB валидирует файлы, пишет disk и запускает Python. runAnalyzer создаёт newSingleThreadExecutor; timeout, interrupt и nonzero exit бросают исключение до shutdownNow. destroyForcibly не ждёт завершения и не убивает descendants. build_patterns создаёт window_count по max_beat и для каждого окна снова сканирует все notes.
- **Scenario:** anonymous client отправляет много параллельных корректных small MIDI или MIDI с большим tick span/ticks_per_beat=1. Java limits допускают до 10,000,000 ticks, а Python способен создать около 1.25 million восьмиbeat windows и многократно просканировать notes. Даже обычные timeout/failure requests оставляют reader threads.
- **Impact:** исчерпание request threads, native processes, heap, disk, file descriptors и CPU; backend unavailable до restart.
- **Evidence:** SecurityConfig.java:68 permitAll; TempAnalysisService.java:323-352; python/temp_analyzer.py:17-21 и 124-134. Java parser проверяет complexity только после MidiSystem.getSequence. Нет rate-limit invocation в DatasetController.
- **Recommendation:** общий distributed admission control; per-IP/user token bucket; строгий max total bytes; queue limit; dedicated bounded executor; process-tree termination/wait; OS cgroup CPU/RAM/pids; parser timeout; max beats/pattern windows/ticks-per-beat/meta/SysEx payload; linear bucketization notes; adversarial boundary and parallel tests.

### H-04 — generated pack lifecycle не crash-safe

- **Severity / Confidence / Category / Fix size:** High / High confidence / Transactionality, Storage / L.
- **Affected:** GeneratedPackService.persistStagedGeneratedPack/handleStagedFailure; GeneratedPackTransactionService.createPendingPack/finalizeReady/markFailedIfPending; GeneratedPackCleanupService; GeneratedPackRepository.markReadyIfPending.
- **Problem:** правильный порядок PENDING → item upload → ZIP upload → conditional READY существует, но transaction заканчивается между каждым шагом. Process crash оставляет PENDING rows/objects без reaper. cleanupRequired записывается, но scheduler/retry query отсутствует. FAILED transition выполнен find/filter/save без conditional update или @Version и гоняется с finalize. Успех Python не проверяется на nonzero count, parse validity, checksum/S3 HEAD; zero MIDI + empty ZIP может стать READY.
- **Scenario:** JVM падает после item upload; DB остаётся PENDING, object навсегда orphan/linked. Concurrent failure/finalize перезаписывают status. Python exits 0 без .mid; context item count и generated list оба zero, ZIP загружен, READY update succeeds.
- **Impact:** permanent storage leak, inaccessible packs, READY without usable content, FAILED with residual URLs, inconsistent user feed/metrics.
- **Evidence:** GeneratedPackService.java:198-226; GeneratedPackTransactionService.java:6-8; only READY uses conditional SQL at repository line 70; no query/scheduled method for stale PENDING or cleanupRequired. MidiGenerationService lists whatever .mid exists without minimum/result validation.
- **Recommendation:** explicit state machine with conditional transitions and optimistic version; operation/idempotency ID; expected manifest/count/hash/size; verify output before staging and S3 HEAD before READY; stale PENDING/cleanupRequired worker with retry/backoff; crash/failure injection tests at every boundary.

### H-05 — private bucket policy не обеспечивается deployment-кодом

- **Severity / Confidence / Category / Fix size:** High / Needs runtime verification / Storage, Authorization / M.
- **Affected:** S3BucketInitializer.initialize; docker-compose.production.yml minio-init; .github/workflows/ci.yml Newman/E2E MinIO init.
- **Problem:** initializer делает только head/create bucket. minio-init делает mc mb --ignore-existing. Ни один production path не выполняет anonymous set none или policy assertion. Если volume ранее использовался с public policy, она сохраняется. CI в двух jobs специально выполняет anonymous set download, то есть E2E не моделирует private production и может скрыть authorization defect.
- **Scenario:** оператор переиспользует MinIO volume из dev/test/старого deploy с anonymous download. Любой, знающий или получивший object key, читает private MIDI/ZIP напрямую без backend ownership check и без presigned expiry.
- **Impact:** массовая конфиденциальность private generated/uploaded/dataset objects; потенциально High, не Critical без доказанного production policy/object-key disclosure.
- **Evidence:** S3BucketInitializer.java:30-43; docker-compose.production.yml:38-42; ci.yml:196-199 и 280-283. Отдельный Testcontainers integration test подтверждает, что fresh bucket private (401/403), но не проверяет existing-policy remediation.
- **Recommendation:** dedicated least-privilege app user/policy; production init должен assert anonymous none и fail closed; runtime unsigned GET/list negative smoke test; не делать E2E bucket public; audit/version bucket policies и rotate root credentials.

### H-06 — authenticated custom analysis flow сломан

- **Severity / Confidence / Category / Fix size:** High / Confirmed / Frontend, Authorization contract / S.
- **Affected:** frontend/lib/api.ts analyzeTempMidiFiles; TempAnalysisService.writeAccess/hasAccess; GenerateController.resolveAnalysisFile; dataset save flow.
- **Problem:** analyzeTempMidiFiles не принимает token и не отправляет Authorization. Backend видит owner null и записывает guestToken. Последующий authenticated generate/save передаёт requester user; guest branch hasAccess требует requester == null.
- **Scenario:** вошедший пользователь загружает MIDI в custom flow. Анализ возвращает ID/token, но generation или POST /datasets с его JWT получает 404, хотя UI считает analysis своим.
- **Impact:** одна из основных заявленных функций для accounts не работает; пользователи ретраят дорогостоящий analysis, усиливая H-03.
- **Evidence:** frontend/lib/api.ts:320-331 headers отсутствуют; TempAnalysisService.java:190,194-205; authentication-aware DatasetController уже готов передать user, но frontend не даёт JWT.
- **Recommendation:** передавать normalized JWT в analyze call; сохранить owner; явно протестировать guest, User A, User B, stale token и transition guest→login. Не ослаблять hasAccess для принятия guest token authenticated пользователем без отдельного безопасного claim/binding design.

### H-07 — обязательный CI контракт детерминированно устарел

- **Severity / Confidence / Category / Fix size:** High / Confirmed / CI/CD / M.
- **Affected:** .github/workflows/ci.yml compose-validate/Newman/E2E/CI Required; postman/icepunk.postman_collection.json.
- **Problem:** compose-validate задаёт S3_PUBLIC_URL, но production Compose требует S3_PRESIGN_ENDPOINT. Локально exact CI-shaped command падает на missing required variable. Newman collection требует nonempty downloadUrl, тогда как current backend E2E специально assert, что downloadUrl отсутствует и URL выдаётся отдельным authorized endpoint.
- **Scenario:** каждый PR получает red required job; команда либо отключает job/required gate, либо привыкает игнорировать CI. Если branch protection не требует aggregator, broken code попадает в dev.
- **Impact:** отсутствует надёжный release gate; stale security model проверяется вместо production signed URL model.
- **Evidence:** ci.yml:149-162,458; postman collection:118-120; ApiFlowsE2ETest.java:130-132,167. Production Compose с корректным dummy S3_PRESIGN_ENDPOINT валидируется, а с exact CI env — нет.
- **Recommendation:** синхронизировать env names и Postman contract; добавить private-bucket signed URL auth/expiry tests; сделать CI Required обязательным в branch protection; добавить self-test текущей workflow matrix.

### H-08 — guest packs стали permanent ownerless records

- **Severity / Confidence / Category / Fix size:** High / Confirmed / Storage, Abuse, Documentation drift / M.
- **Affected:** GeneratedPackService.persistGeneratedPack/persistStagedGeneratedPack; GeneratedPackTransactionService.createPendingPack; GeneratedZipCleanupService; docs/codex/ARCHITECTURE.md and DECISIONS.md.
- **Problem:** production dependency injection всегда передаёт transactionService. Проверка transactionService != null выполняется до owner == null, поэтому guest идёт в staged path, получает PENDING DB row и objects под generated-packs namespace. Cleanup job смотрит только legacy generated_midi prefix. Документация утверждает обратное.
- **Scenario:** anonymous traffic создаёт до пяти packs на распознанный IP/day, а rotating IPs — больше. Каждый pack остаётся в DB/S3 без owner, feed и delete UI; автоматического retention нет.
- **Impact:** монотонный рост DB/MinIO, orphaned user-inaccessible data, сложное privacy/retention объяснение и storage exhaustion.
- **Evidence:** GeneratedPackService.java:83-87 и 198-200; GeneratedPackTransactionService.createPendingPack accepts owner null; GeneratedPackStorageService staged prefix; GeneratedZipCleanupService uses GENERATED_ZIP_PREFIX legacy. Docs say guest never persisted.
- **Recommendation:** явно разделить guest/owned workflow before staged selection либо добавить documented ownerless lifecycle with strict retention and DB cleanup. Покрыть production-constructor integration test и storage-prefix retention test.

## 9. Medium findings

### M-01 — invalid/stale JWT тихо превращается в guest

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Authentication / M.
- **Affected:** JwtAuthFilter.doFilterInternal; JwtService; /generate и /datasets/analyze-temp; frontend stale-token handling.
- **Problem:** filter ловит любое исключение parsing/user lookup и продолжает chain anonymous. Для public endpoints malformed, forged, expired и deleted-user JWT не дают 401. При этом token TTL по умолчанию 24 часа, server-side logout/revocation, JTI, token version, issuer и audience отсутствуют.
- **Scenario:** UI хранит stale token и вызывает /generate. Запрос успешно выполняется как guest вместо явной re-authentication. В сочетании с H-08 создаётся private/ownerless pack, который пользователь затем не может увидеть. Украденный token действует до expiry.
- **Impact:** нарушение ожидаемой identity semantics, потерянные artifacts, увеличенное окно stolen-token replay.
- **Evidence:** JwtAuthFilter.java:30-79 catch Exception; JwtService builder содержит только subject/issuedAt/expiration and HMAC signature. User existence rechecked — это позитивный control, но не revocation.
- **Recommendation:** различать absent token и presented-but-invalid token; invalid bearer возвращать 401 даже на otherwise public endpoint, либо очень явно документировать downgrade; короткий access TTL + rotation/revocation/version; issuer/audience/JTI; tests expired/forged/deleted-user/public-route.

### M-02 — localStorage JWT без CSP усиливает XSS impact

- **Severity / Confidence / Category / Fix size:** Medium / High confidence / Frontend, Authentication / M.
- **Affected:** frontend auth/profile/generation hooks and components; frontend/next.config.ts.
- **Problem:** bearer хранится под icepunk_token в localStorage. Security headers/CSP в Next config отсутствуют. Прямой dangerouslySetInnerHTML/eval sink в приложении не найден, React экранирует UGC, поэтому это не подтверждённая XSS, а высокий impact будущей XSS или compromised dependency.
- **Scenario:** инъекция через будущий component, browser extension или npm supply-chain code читает localStorage и отправляет JWT attacker.
- **Impact:** account takeover на срок token TTL; private preview/download URL issuance и authenticated generation abuse.
- **Evidence:** многочисленные localStorage.getItem/setItem в useSketchAuth, useMidiGeneration, ProfileView; next.config.ts не задаёт headers/CSP; search не нашёл dangerouslySetInnerHTML.
- **Recommendation:** оценить HttpOnly Secure SameSite cookie/BFF model; если bearer остаётся — строгий CSP с nonces, frame-ancestors, Trusted Types где совместимо, dependency hardening и минимальный TTL. Добавить header tests.

### M-03 — guest quota имеет TOCTOU после дорогой операции

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Rate limiting, Concurrency / M.
- **Affected:** GenerateController.generate; GenerationLimitService.checkGuestLimit/incrementGuestUsage; GuestUsageRepository.
- **Problem:** read-only check выполняется до Python/S3/DB, increment — после. Existing row lock/recheck защищает counter only at the end, но работа уже выполнена. Для нового IP row ещё нет, поэтому parallel requests создают insert race на unique key.
- **Scenario:** пять оставшихся запросов и ещё десятки отправляются параллельно. Все проходят initial check и занимают generator. Поздние increments получают 429 или unique violation, но packs/objects уже созданы. DataIntegrityViolation handler также возвращает неподходящее “Account already exists”.
- **Impact:** quota не предотвращает resource consumption; orphan/extra packs; misleading 409; easy retry amplification.
- **Evidence:** GenerateController.java:114-138; GenerationLimitService.java:51-83. increment uses FOR UPDATE only when row already exists.
- **Recommendation:** атомарный quota reservation/upsert before generation; status/reservation expiry; transaction-safe first-row creation; release/refund policy; explicit UTC reset; parallel new/existing IP tests.

### M-04 — auth rate limiter не масштабируется и растёт в памяти

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Rate limiting / M.
- **Affected:** InMemoryRateLimitService; AuthController; deployment replicas.
- **Problem:** ConcurrentHashMap state локален replica, теряется при restart, обходится round-robin и не удаляет expired keys. Защита есть только для login/register. Upload, analyze, URL issuance, contact, likes/profile и dataset creation не имеют согласованного abuse policy.
- **Scenario:** attacker меняет identifier/IP, распределяет requests между replicas или ждёт restart. Каждая уникальная key остаётся в map; долгоживущий process получает memory growth.
- **Impact:** credential abuse и endpoint spam; inconsistent limits; memory pressure.
- **Evidence:** InMemoryRateLimitService.java:19-40 uses computeIfAbsent, synchronized counter, no remove/sweep/shared store.
- **Recommendation:** Redis/DB-backed limiter с bounded key TTL, composite user/IP/device policies, trusted proxy tests и Retry-After; отдельные budgets для login/register/upload/analyze/generate/contact/signed URL.

### M-05 — upload validation неполна

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Upload / M.
- **Affected:** UserUploadService.validateSample/validateMidi; UserProfileService avatar validation; MidiUploadValidator; TempAnalysisService.
- **Problem:** sample проверяется по extension и client-supplied MIME, без magic/decoder/duration check; можно хранить произвольные bytes до 20 MiB. Avatar проверяет signature/size, но не безопасно декодирует/re-encode и не ограничивает pixel dimensions. Java MIDI parser сначала полностью создаёт Sequence, затем проверяет tracks/events/notes/ticks/duration; нет preparse limits для SysEx/meta payload, variable-length edge cases и parser deadline.
- **Scenario:** пользователь сохраняет arbitrary blob как audio; малый compressed image декодируется browser в огромную bitmap; множество MIDI нагружает heap ещё до postparse rejection.
- **Impact:** persistent storage abuse, client memory crash, backend CPU/heap pressure.
- **Evidence:** UserUploadService.java:170-199; MidiUploadValidator.java:42-48; multipart max size есть, но parser resource controls отсутствуют. ZIP uploads не принимаются, поэтому ZIP bomb здесь не применим.
- **Recommendation:** magic + trusted media decoder and re-encoding; image pixel/frame limits; audio duration/codec validation; streaming MIDI pre-scan with limits for tracks/events/VLQ/SysEx/meta bytes; per-file deadline/memory isolation; fuzz corpus.

### M-06 — DB/S3/local consistency gaps вне generated staging

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Transactionality, Storage / L.
- **Affected:** UserUploadService.uploadProject; DatasetPresetService save/delete; UserProfileService avatar upload/fallback; generated pack delete.
- **Problem:** user MIDI загружается, затем sample, затем DB save, но failure between steps не компенсируется. Delete paths обычно DB-first, затем quiet S3 delete без durable retry. Avatar fallback пишет local disk внутри replica; старые avatars не удаляются. Dataset upload compensation best-effort, а delete также может orphan object.
- **Scenario:** sample S3 upload падает после MIDI; DB constraint падает после двух uploads; MinIO недоступен при delete; replica заменяется после local fallback.
- **Impact:** orphan objects, broken URLs/references, storage leak, inconsistent behavior across replicas.
- **Evidence:** UserUploadService.java:107-134 без catch cleanup; documented DB-first-then-S3 best effort paths; no outbox/reconciliation worker.
- **Recommendation:** transactional outbox/operation table и idempotent object operations; cleanup queue/retry/backoff; periodic DB↔S3 reconciliation; upload into staged namespace then publish; avoid local persistent fallback or use shared storage.

### M-07 — staged path теряет metadata

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Data integrity, API contract / M.
- **Affected:** GeneratedPackTransactionService.createPendingPack; GeneratedPackService legacy and staged branches; generated pack DTOs.
- **Problem:** legacy path записывает bpm, pitch, octaves, metadata и extracted item duration/note/track/pitch/preview metadata. Staged createPendingPack записывает лишь name/source/type/amount/visibility/object keys; item metadata также не вычисляется/сохраняется.
- **Scenario:** production generation успешно становится READY, но profile/feed/detail возвращают null controls и empty preview metadata. Код и тесты legacy constructor показывают более полный объект, чем production constructor.
- **Impact:** data corruption относительно API expectations, degraded preview/feed и невозможность корректного анализа history.
- **Evidence:** GeneratedPackService.java:97-131 vs GeneratedPackTransactionService.java:6.
- **Recommendation:** передавать immutable manifest с request and extracted metadata в create/finalize; validate mandatory fields before READY; production-path integration assertions для каждого field.

### M-08 — feed/status/count queries показывают незавершённые packs

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Authorization metadata, Database / M.
- **Affected:** GeneratedPackRepository.findPublicAuthenticatedPacks, findPublicAuthenticatedPacksByUsername, findWithItemsByOwnerId, countByOwnerIdAndVisibility; GeneratedPackService feeds/profile.
- **Problem:** queries фильтруют visibility/owner, но не status READY. PENDING/FAILED public rows могут появиться в feed/profile/count. Download всё равно вернёт 404 благодаря READY check. Owner list возвращает unbounded List с all items.
- **Scenario:** generation fails after PENDING insert. Другой пользователь видит pack ID/name/time/status-derived behavior в public feed и может отличить существование, хотя artifact недоступен.
- **Impact:** metadata leakage, confusing broken cards/counts, heavy query/memory growth.
- **Evidence:** GeneratedPackRepository.java:24-67; status отсутствует в JPQL/derived methods; READY condition есть только отдельным mark/read access path.
- **Recommendation:** status=READY во всех public/profile/count queries; paginated owner endpoint; database indexes owner/status/created and visibility/status/created; negative tests PENDING/FAILED.

### M-09 — cleanup semantics несовместимы с current storage layout

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Storage lifecycle / L.
- **Affected:** GeneratedZipCleanupService; GeneratedPackStorageService prefixes; generated pack DB rows.
- **Problem:** scheduled age sweep удаляет legacy generated_midi ZIP без проверки DB reference, поэтому READY owned download ломается примерно после retention. Current staged objects живут под generated-packs namespace и вообще не попадают в sweep. Per-item legacy/generated uploads также имеют разные stories.
- **Scenario:** старый READY pack всё ещё показывается, но ZIP уже удалён; новый failed/guest staged object остаётся навсегда.
- **Impact:** broken downloads, unbounded storage, непредсказуемая privacy retention.
- **Evidence:** GeneratedZipCleanupService.java:47-87 lists only GeneratedPackStorageService.GENERATED_ZIP_PREFIX; no reference query. Docs already описывают часть legacy gap, но не фактический guest staged drift.
- **Recommendation:** единый lifecycle policy на manifest/status/owner, DB-aware expiration и S3 lifecycle only for isolated ephemeral prefix; deletion tombstones and reconciliation.

### M-10 — username identity case mismatch и слабый password floor

- **Severity / Confidence / Category / Fix size:** Medium / High confidence / Authentication / M.
- **Affected:** AuthService.register/login; UserRepository; users migration/unique constraint; RegisterRequest.
- **Problem:** registration checks existsByUsername exact, DB unique case-sensitive, но login/profile/JWT fallback используют findByUsernameIgnoreCase. Можно создать Alice и alice, после чего ignore-case Optional query способен получить non-unique result. Password minimum — 6.
- **Scenario:** attacker регистрирует case variant популярного username; username login/profile resolution становится ambiguous или падает. Слабые passwords легче credential stuffing/offline guessing при будущей hash leak.
- **Impact:** account availability/identity confusion и сниженная credential strength.
- **Evidence:** AuthService.java:50,97; UserRepository methods; RegisterRequest.java:19.
- **Recommendation:** canonical normalized username column + case-insensitive unique index/CITEXT; exact deterministic lookup; migration collision audit; password minimum 10–12 или passphrase policy, breached-password screening and MFA roadmap.

### M-11 — frontend timeout и contact flow усиливают abuse

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Frontend, Abuse / M.
- **Affected:** frontend/lib/api.ts withTimeout; generation/temp analysis calls; frontend/app/api/contact/route.ts.
- **Problem:** общий browser timeout 15 seconds короче backend generator timeout 60 seconds. Abort прекращает ожидание client, но backend/Python/S3 продолжают работу; UI retry создаёт duplicate load. Contact endpoint public, без rate limit/captcha, outbound timeout и durable abuse controls; fallback/logging может содержать feedback PII.
- **Scenario:** медленная валидная generation или analysis обрывается в UI, пользователь повторяет; bot спамит Resend/contact.
- **Impact:** duplicate CPU/storage, плохой UX, email quota/cost/reputation abuse.
- **Evidence:** frontend/lib/api.ts:1-21 и call sites; contact route implementation/tests. Backend не получает idempotency key/cancellation.
- **Recommendation:** endpoint-specific timeout > server budget, operation ID/polling/cancel semantics, idempotency key; contact rate limit, honeypot/captcha/risk scoring, outbound AbortSignal timeout, redacted logs.

### M-12 — Python process lifecycle и output trust недостаточны

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Python, Performance / L.
- **Affected:** MidiGenerationService.generateFiles/buildProcess/awaitProcessOutput; docker resources; Python generator output.
- **Problem:** ProcessBuilder list безопасен от shell injection, но timeout вызывает destroyForcibly без wait/descendant traversal. stdout reader future использует common pool и cancellation не гарантирует остановку read. Нет cgroup per-process limits. После exit 0 backend лишь перечисляет .mid и создаёт ZIP, не требует count==amount, nonempty files, MIDI reparse/complexity/size bounds.
- **Scenario:** Python/child hangs or spawns child; parent killed, descendant живёт. Bug exits 0 after partial files; pack становится READY с неполным набором.
- **Impact:** process leak, CPU/RAM pressure, corrupted artifacts.
- **Evidence:** MidiGenerationService.java:75-115,168; no descendants/ProcessHandle wait or output validator.
- **Recommendation:** dedicated bounded executor; ProcessHandle.descendants kill + wait; container/cgroup limits; strict manifest and reparse every output; atomic temp output rename; tests timeout, partial, zero, oversized, malformed and child process.

### M-13 — tests дают production false confidence

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Testing / L.
- **Affected:** backend/src/test/resources/application.properties; application-test.properties; CI E2E/Newman; frontend Jest; Python tests.
- **Problem:** test application.properties shadows main, что прямо отмечено в комментарии, и поэтому не обнаруживает H-01/open-in-view/security config divergence. CI MinIO E2E делает bucket public. Staged lifecycle tests сильно mock-based и не делают crash/failure matrix. Frontend full coverage run один раз упал на 5s timeout, targeted run passed; coverage 43.24% statements/37.67% branches без thresholds. Python 72 tests в основном generator helpers; temp analyzer production path имеет лишь несколько helper tests и не запускается CI lint/mypy scope.
- **Scenario:** all backend tests green, Docker build green, но container не стартует. Analyzer regression вне midi_generator не ловится Ruff CI.
- **Impact:** release gate не соответствует production path; concurrency/security regressions проходят незамеченными.
- **Evidence:** 222 backend tests pass; prod runtime fails. CI Ruff/mypy scopes only midi_generator and generate_midi.py. Expanded Ruff всего python вернул 22 errors.
- **Recommendation:** prod-config context/startup test; full-package Python compile/import/lint/type; private MinIO E2E; ownership matrix; failure injection/crash tests; deterministic frontend tests and coverage thresholds focused on critical flows.

### M-14 — supply-chain controls неполны

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Supply chain / M.
- **Affected:** ci.yml, Dockerfiles/Compose, python requirements, Dependabot config.
- **Problem:** GitHub Actions pinned только на mutable major tags; postgres/minio/node/maven images не digest-pinned, MinIO/Testcontainers uses latest; Newman запускается через npx --yes unpinned; Python requirement exact version, но без hashes; no SBOM/signing/provenance; gitleaks/secret scan отсутствует. Dependabot pip directory указывает root, хотя requirements в python, Docker coverage не включает root compose/frontend.
- **Scenario:** upstream tag/image/package меняется между builds или compromised release выполняется в CI. Dependency update bot не видит часть manifests.
- **Impact:** unreproducible builds и повышенный supply-chain blast radius.
- **Evidence:** ci.yml uses actions/checkout@v4, setup actions, CodeQL tags and npx --yes newman; compose uses postgres:16/minio/minio; local tools trivy/gitleaks/syft/grype/pip-audit unavailable.
- **Recommendation:** SHA/digest pinning + automated update; pinned Newman dependency in lockfile; pip hashes/constraints; correct Dependabot directories; SBOM, provenance/signing and secret scan. Не считать npm audit 0 доказательством для Maven/Python/images.

### M-15 — production containers имеют избыточный blast radius

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Infrastructure / L.
- **Affected:** docker-compose.production.yml; backend/frontend Dockerfiles.
- **Problem:** backend использует MinIO root access/secret, все services в одной default network. Нет cpu/memory/pids limits, cap_drop, read_only, tmpfs policy или separate internal networks. Images не digest-pinned. MinIO не имеет service healthcheck.
- **Scenario:** backend compromise получает admin-equivalent storage credentials и может list/delete весь bucket; runaway Python consumes host; compromised frontend can reach DB/MinIO on shared network.
- **Impact:** увеличенный lateral movement, total storage loss и noisy-neighbor outage.
- **Evidence:** compose lines 20-46 and 87-91; root credentials copied into app env; no deploy resources/security_opt/cap_drop/read_only/networks blocks.
- **Recommendation:** least-privilege MinIO app user limited to bucket/actions; root only init secret; separate edge/app/data networks; resource/pids limits; no-new-privileges/cap drop/read-only + explicit writable tmp; healthchecks.

### M-16 — observability, backup и recovery не operationalized

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Operations / L.
- **Affected:** application/actuator config; Compose; docs/PRODUCTION_DEPLOY_CHECKLIST.md.
- **Problem:** exposed только basic health, details never. Нет readiness DB/S3/Python, Prometheus metrics, structured JSON logs, request/correlation IDs, alert rules, audit events, disk/orphan/PENDING monitoring и log rotation config. Backup/restore items существуют только как unchecked checklist.
- **Scenario:** S3 latency или stale PENDING растёт, но health остаётся green; disk заполняется; backup существует номинально, restore не работает.
- **Impact:** высокий MTTR, незаметная data loss и невозможность доказать recovery.
- **Evidence:** source search не нашёл metrics/MDC/readiness/backup implementation; checklist строки 43-44,125,129,133-136 остаются действиями оператора.
- **Recommendation:** readiness groups with DB/S3 and safe Python capacity; Micrometer metrics and dashboards; correlation ID; alerts; JSON log redaction/rotation; encrypted off-host Postgres+MinIO backups with restore drill/RPO/RTO and monitoring.

### M-17 — privacy/GDPR launch controls отсутствуют

- **Severity / Confidence / Category / Fix size:** Medium / Confirmed / Privacy, Compliance / L.
- **Affected:** frontend routes/docs; user/upload/dataset/generated entities/controllers; logs/backups.
- **Problem:** репозиторий не содержит Datenschutzerklärung/Privacy Policy или Impressum, account deletion, data export/portability и complete retention policy. Сохраняются email/username, password hash, IP-linked guest usage, uploads/samples/original filenames, generated content, datasets и logs. User uploads/avatars не имеют delete/retention. Public upload metadata может раскрывать original filenames.
- **Scenario:** пользователь просит доступ/экспорт/удаление; оператор не может выполнить полный DB+S3+backup workflow. Public filename содержит имя/путь автора.
- **Impact:** privacy complaints, excessive retention и operational inability to satisfy rights.
- **Evidence:** route/source search не нашёл legal pages/delete account/export; only temp and legacy ZIP retention exist. Технические принципы storage limitation/security следуют из GDPR Articles 5 and 32; access/erasure/portability — Articles 15,17,20. German provider-information requirements следует отдельно проверить по DDG §5.
- **Recommendation:** data inventory/ROPA, purpose/legal basis and retention matrix; self-service or operator-tested export/delete including objects/backups/tombstones; privacy notice/Impressum review by qualified counsel; processor agreements; breach procedure. Это техническое наблюдение, не юридическое заключение.

Official references:

- GDPR Article 5: https://eur-lex.europa.eu/eli/reg/2016/679/art_5/oj/eng
- GDPR Article 15: https://eur-lex.europa.eu/eli/reg/2016/679/art_15/oj/eng
- GDPR Article 17: https://eur-lex.europa.eu/eli/reg/2016/679/art_17/oj/eng
- GDPR Article 20: https://eur-lex.europa.eu/eli/reg/2016/679/art_20/oj/eng
- GDPR Article 32: https://eur-lex.europa.eu/eli/reg/2016/679/art_32/oj/eng
- GDPR Article 33: https://eur-lex.europa.eu/eli/reg/2016/679/art_33/oj/eng
- German DDG §5: https://www.gesetze-im-internet.de/ddg/__5.html
- German TDDDG §25: https://www.gesetze-im-internet.de/ttdsg/__25.html

### M-18 — database/feed и horizontal scaling bottlenecks

- **Severity / Confidence / Category / Fix size:** Medium / High confidence / Performance, Database / L.
- **Affected:** GeneratedPackRepository/Service feeds; DatasetPresetService lists; UserProfileService; semaphore/rate limits/local temp state.
- **Problem:** owner packs/datasets имеют unbounded list paths; feed maps pack items in transaction without item EntityGraph, что вероятно даёт N+1. Collection EntityGraph with pagination требует runtime SQL-plan verification и может materialize duplicates/in-memory. Нет @Version для lifecycle entities. Generator semaphore/auth limiter/local temp state per-replica; tempAnalysisId работает только на той replica без shared volume/sticky routing.
- **Scenario:** profile с тысячами packs загружает all items; public feed делает query per pack; request analyze попадает на replica A, generate — на B и получает 404; four replicas запускают 8 Python processes вместо global 2.
- **Impact:** DB latency/heap growth, broken cross-replica workflow и непредсказуемая capacity.
- **Evidence:** GeneratedPackRepository.java:20-26 and feed graphs; local Path tempAnalysisDir; new Semaphore(maxConcurrentGenerations); in-memory limiter.
- **Recommendation:** bounded pagination everywhere; projection/batch fetch and EXPLAIN ANALYZE; composite indexes; optimistic locking; shared object/temp storage or route-independent analysis; distributed queue/global concurrency; load tests without invented benchmark claims.

## 10. Low and informational findings

### L-01 — inconsistent 401/403/404 semantics

- **Severity / Confidence / Category / Fix size:** Low / Confirmed / Authorization, Exception handling / S.
- **Affected:** SecurityConfig default entry point; GeneratedPackService.requireOwnedPack/mutation controllers.
- **Problem:** protected endpoints без valid auth обычно получают Spring default 403 вместо semantically correct 401. User B mutations получают 403, тогда как private reads uniform 404, создавая existence oracle при известном UUID.
- **Scenario:** attacker сравнивает 403 mutation для существующего private pack и 404 для random UUID; client не понимает, нужно ли re-login.
- **Impact:** ограниченная metadata disclosure и inconsistent API behavior.
- **Evidence:** explicit AuthenticationEntryPoint отсутствует; ForbiddenActionException mapped 403; read service catches notfound to 404.
- **Recommendation:** bearer entry point 401; mutation ownership lookup scoped by owner и uniform 404 where concealment required; contract tests.

### L-02 — Content-Disposition строится из original filename вручную

- **Severity / Confidence / Category / Fix size:** Low / High confidence / Upload, HTTP / S.
- **Affected:** UserUploadController.get project MIDI, line 44.
- **Problem:** inline filename concatenates stored original filename into quoted header. Framework/container обычно отклонит CR/LF, но quotes, backslashes, Unicode и control characters могут ломать header/download name.
- **Scenario:** владелец сохраняет файл со сложным quote/Unicode name и публикует project; downloader получает malformed disposition или runtime header error.
- **Impact:** response failure/filename confusion; header injection требует runtime verification и не считается подтверждённой.
- **Evidence:** literal “inline; filename=” + file.filename() + quote.
- **Recommendation:** Spring ContentDisposition builder, CR/LF/control rejection, safe ASCII fallback plus RFC 5987 filename*; tests quotes/Unicode/null bytes.

### L-03 — Jackson/API hard limits не заданы

- **Severity / Confidence / Category / Fix size:** Low / Confirmed / Validation / S.
- **Affected:** ObjectMapper/Jackson configuration and JSON DTO endpoints.
- **Problem:** Bean Validation хорошо ограничивает amount/BPM/pitch/octaves/names, но нет explicit fail-on-unknown-properties, duplicate-key detection, max nesting/string/token constraints. Enum/UUID malformed values в основном уйдут в 400, но единый error body для всех deserialization paths не доказан.
- **Scenario:** client посылает duplicate publishMode или deep JSON; parser принимает последнее/неожиданно нагружает CPU.
- **Impact:** contract ambiguity и ограниченный JSON DoS surface, снижаемый request-size/proxy controls только если они есть.
- **Evidence:** config search не нашёл Jackson StreamReadConstraints/STRICT_DUPLICATE_DETECTION.
- **Recommendation:** explicit ObjectMapper policy and limits; 400 contract tests unknown/duplicate/deep/empty/wrong content type/NaN.

### L-04 — presigned TTL/referer/history hardening

- **Severity / Confidence / Category / Fix size:** Low / Confirmed / Signed URLs, Frontend / S.
- **Affected:** GeneratedFileAccessService constructor; frontend download handlers; Next security headers.
- **Problem:** default TTL короткие и API responses no-store/no-cache, но startup не ограничивает отрицательные/чрезмерные TTL. Старый URL действует до expiry, если object ещё существует. window.location.assign переносит URL в address/history; Referrer-Policy отсутствует.
- **Scenario:** operator ошибочно задаёт очень большой TTL; URL попадает в browser history/screenshot/referrer и replayed.
- **Impact:** временный обход backend authorization в пределах TTL — нормальная природа presigned URL, но окно может стать чрезмерным.
- **Evidence:** Duration.ofSeconds direct; no range validator; frontend window.location.assign; signed response cache headers present at controller lines 178-183.
- **Recommendation:** validate bounds at startup; no-referrer header/policy; controlled anchor/download flow; redact query strings; document delete/expiry semantics and test expired URL.

### L-05 — logs раскрывают internal metadata и не коррелируются

- **Severity / Confidence / Category / Fix size:** Low / Confirmed / Logging / M.
- **Affected:** GeneratedPackStorageService/DatasetPresetStorageService/UserUploadStorageService logs; MidiGenerationService; temp_analyzer output; GlobalExceptionHandler.
- **Problem:** storage logs включают bucket/object key, Python stdout включает absolute output/analysis paths, tests показывают SQL values в driver logs. API generic 500 безопасен, но production log redaction/schema/correlation не определены.
- **Scenario:** support log bundle или external log sink раскрывает internal object namespace/filenames/PII; incident нельзя связать across frontend/backend/Python.
- **Impact:** secondary metadata exposure и плохая forensics.
- **Evidence:** runtime test logs showed keys/DB duplicate values; temp_analyzer.py:185 writes path into stored JSON; no MDC/request ID code.
- **Recommendation:** structured allowlist logging, hashed/truncated object IDs, query-string/token redaction, environment path removal, correlation/operation IDs and retention/access policy.

### L-06 — file extension и frontend types drift

- **Severity / Confidence / Category / Fix size:** Low / Confirmed / API compatibility / S.
- **Affected:** MidiUploadValidator vs UserUploadService; frontend/lib/api.ts interfaces; backend DTO JsonIgnore.
- **Problem:** общая validation и temp analysis разрешают .mid и .midi, но user upload allowed extension только .mid. Frontend types всё ещё допускают downloadUrl/object key fields, хотя backend security contract убрал постоянные URLs/keys.
- **Scenario:** валидный .midi принимается analysis, но отклоняется project upload; frontend код ошибочно полагается на stale field.
- **Impact:** inconsistent UX и будущая regression к permanent URL model.
- **Evidence:** extension sets and TS optional fields; backend E2E asserts URLs absent.
- **Recommendation:** единая extension policy без удаления API compatibility; generate TS types from OpenAPI after production-safe schema; contract tests.

### L-07 — generation parameters не доходят до Python

- **Severity / Confidence / Category / Fix size:** Low / Confirmed / Functionality, Python / M.
- **Affected:** GenerationRequest; MidiGenerationService.buildProcess; python CLI.
- **Problem:** backend валидирует source/type/pitch/octaves, но ProcessBuilder передаёт analysis path, output dir, amount и BPM. Pitch/octaves/type не участвуют в generator invocation.
- **Scenario:** пользователь выбирает transpose/octaves/type, получает результат, не соответствующий настройкам, и повторяет generation.
- **Impact:** functional correctness/extra resource consumption; security impact косвенный.
- **Evidence:** GenerationRequest validation vs MidiGenerationService.java:168 onward.
- **Recommendation:** либо реализовать параметры end-to-end с output tests, либо честно удалить/feature-flag UI while preserving compatibility defaults.

### I-01 — private generated-file IDOR controls реализованы корректно

- **Severity / Confidence / Category / Fix size:** Informational / Confirmed / Authorization / —.
- **Affected:** GeneratedFileAccessService; GeneratedPackController signed and legacy reads.
- **Observation:** item repository lookup связывает itemId с packId; pack must be READY; PUBLIC или matching owner. User B/anonymous private read скрывается 404. Object keys не выдаются DTO, signed URL создаётся после authorization.
- **Scenario/Impact:** positive control prevents straightforward parent-child substitution and private IDOR. UUID secrecy не считается единственной защитой.
- **Evidence:** GeneratedFileAccessService.java:45-68; controller signedUrl catches notfound and applies no-store/Pragma.
- **Recommendation:** сохранить pattern в service/repository слоях и расширить matrix tests на все legacy/current endpoints.

### I-02 — JWT/security baseline в основном разумный

- **Severity / Confidence / Category / Fix size:** Informational / Confirmed / Authentication / —.
- **Affected:** JwtService, JwtSecretValidator, SecurityConfig, prod properties.
- **Observation:** JJWT signWith/verifyWith фиксирует HMAC key и не доверяет client algorithm; expired/malformed/forged tokens rejected by parser; filter rechecks active user. Prod rejects known/short secret under 32 bytes. Sessions stateless, CORS origins explicit, credentials false, CSRF disabled in bearer model, Swagger disabled+denied, actuator exposes only health, error details disabled.
- **Scenario/Impact:** снижает algorithm confusion, stale deleted-user и accidental debug exposure risks.
- **Evidence:** cited code/properties and passing security tests.
- **Recommendation:** сохранить controls; добавить entropy/rotation/issuer/audience/revocation and explicit 401 per M-01/L-01.

### I-03 — deployment baseline имеет хорошие элементы

- **Severity / Confidence / Category / Fix size:** Informational / Confirmed / Infrastructure / —.
- **Affected:** production Compose, Dockerfiles, application-prod.
- **Observation:** Postgres не публикуется; frontend/backend/MinIO bind по умолчанию 127.0.0.1; app containers работают non-root; multi-stage builds; prod uses ddl-auto=validate and Flyway strict; show-sql false; Swagger disabled.
- **Scenario/Impact:** при корректном nginx/firewall это сокращает public attack surface.
- **Evidence:** docker-compose.production.yml ports and Docker USER; application-prod.properties.
- **Recommendation:** не ослаблять defaults; дополнить M-15 и runtime port scan.

### I-04 — tracked secrets не найдены, основные suites выполняются

- **Severity / Confidence / Category / Fix size:** Informational / Confirmed / Secrets, Testing / —.
- **Affected:** repository index/history markers; build/test commands.
- **Observation:** tracked .env, private keys, build artifacts и obvious credential files не найдены. Config содержит documented dev defaults, не production values. Backend 222 tests и Python 72 tests pass; frontend production build/typecheck pass; npm production audit reported 0 at audit time.
- **Scenario/Impact:** это позитивный snapshot, но не заменяет full-history secret scan/current Maven/Python/container CVE scan.
- **Evidence:** git ls-files/searches and command results in section 27. git log marker search нашёл historical config-related commits, но values не извлекались.
- **Recommendation:** gitleaks full history offline/CI, rotate if any real historical credential found; GitHub secret scanning; current Trivy/OWASP/pip-audit evidence.

## 11. Authentication and authorization review

### 11.1 Endpoint ownership matrix

Обозначения: PASS — код обеспечивает ожидаемое; FAIL — подтверждённый дефект; PARTIAL — поведение безопасно не во всех аспектах.

| Resource/endpoint | Anonymous | Owner/User A | User B | Result/evidence |
|---|---|---|---|---|
| POST /auth/register, /login | Public + in-memory limit | Same | Same | PARTIAL: limiter per-replica/no eviction; password min 6 |
| POST /generate | Guest limit | Auth flow | Auth flow | FAIL: authenticated limit no-op; invalid JWT downgrades to guest |
| GET /generation-usage | Guest IP usage | Always 0/0 | Always 0/0 | FAIL for users |
| POST /datasets/analyze-temp | Guest token | Should bind owner, but frontend omits JWT | Own analysis only if JWT sent | FAIL frontend contract; FAIL abuse controls |
| POST/GET/DELETE /datasets | 401/403 | Own only | 404 on foreign ID | PASS ownership; PARTIAL DB/S3 cleanup |
| GET /generated-packs/{id} | Public READY only; private 404 | Own private/public | Foreign private 404 | PASS |
| Preview/download signed URL | Public READY allowed | Own private allowed | Foreign private 404 | PASS; cache headers present |
| Parent-child item mismatch | 404 | 404 | 404 | PASS via findByIdAndPackId |
| Legacy generated downloads | Same visibility check | Allowed | Private 404 | PASS auth; PARTIAL byte-array/performance/deprecation |
| Rename/visibility/delete pack | Auth required | Allowed | 403 if known ID | PARTIAL: safe denial, but existence oracle vs preferred 404 |
| GET /users/me/generated-packs | Auth required | Own | Own only | PASS auth; FAIL unbounded/all statuses |
| Public generated feed/profile packs | Public | Public | Public | FAIL status filtering; no private file URL |
| POST /uploads/projects | Auth required | Own upload | Own upload | PASS auth; FAIL quotas/sample validation/compensation |
| GET /uploads/projects/{id}/midi | Public only if visibility PUBLIC | Own private | Foreign private empty/404 | PASS ownership; filename header hardening needed |
| Likes/favorites | Auth required | Can like public/visible resource path | Authorization service checked | No direct IDOR found; broader abuse limit absent |
| Profile update/avatar | Auth required | Self | Cannot target another user ID | PASS target ownership; external URL/fallback issues |
| Public profile/avatar | Public metadata | Public | Public | Intended public; privacy policy needed |
| /error | Public | Public | Public | Safe server error properties; no sensitive body observed |
| Swagger/OpenAPI | DenyAll; disabled prod | DenyAll | DenyAll | PASS |
| /actuator/health | Public | Public | Public | PASS narrow exposure; insufficient readiness/metrics |

### 11.2 JWT details

- Secret: prod validator checks nonblank, at least 32 UTF-8 bytes and a few known prefixes. Это minimum length, не entropy measurement. Rotation/key IDs не поддерживаются.
- Algorithm: JJWT signWith and parser.verifyWith on SecretKey; client-provided algorithm не выбирает verification key. Algorithm-confusion path не найден.
- Claims: только subject, issuedAt, expiration; authorization role claims не используются, что снижает claim-tampering impact. Нет issuer/audience/JTI/token version.
- User lifecycle: filter re-reads user by email/username; deleted user token не аутентифицируется. Однако любое exception тихо anonymous.
- Logout: UI local removal only; stolen token остаётся действительным до expiry.
- Leakage: token в query/path не найден; bearer формируется Authorization header. localStorage остаётся главным exposure.

### 11.3 CORS, CSRF, sessions and headers

- Stateless session policy — PASS.
- CSRF disabled — приемлемо для Authorization bearer, пока auth не переносится в automatically sent cookie.
- CORS allowed origins explicit, methods/headers broad, credentials false — разумный baseline. Production origins должны быть exact HTTPS, runtime не проверен.
- Spring default security headers применяются, но frontend CSP, Referrer-Policy, Permissions-Policy и explicit HSTS в repository config отсутствуют. HSTS должен быть на TLS edge.
- Swagger disabled in prod and denyAll in security chain — PASS.

## 12. Upload and MIDI parser review

### 12.1 Current limits

| Control | Current value/path | Assessment |
|---|---|---|
| Multipart single part | 25 MiB global | Config currently breaks startup due separate unsupported count property |
| Multipart request | 220 MiB main; 30 MiB tests | Main/test divergence; nginx limit unknown |
| Temp MIDI per file | 2 MiB | Good basic bound |
| Temp file count | 100 in service | Applied after multipart binding; total potential 200 MiB |
| User MIDI | 2 MiB | Good basic bound |
| Sample | 20 MiB | Size bound only; weak content validation |
| Tracks | 64 | Checked after parser load |
| Events | 100,000 | Checked after parser load |
| Notes | 50,000 | Checked after parser load |
| Ticks | 10,000,000 | Allows extreme beat-window counts |
| Duration | 3,600 seconds Java | Post-parse; Python temp analyzer does not mirror duration |
| Tempo changes | 1,000 | Present |
| Python timeout | 60 seconds | Process-tree/thread cleanup incomplete |

### 12.2 Validation strengths

- empty files, size, extension, MIME allowlist, MIDI MThd magic and actual Java MIDI parse используются;
- filenames для temp input заменяются server-side index-safe names, workspace UUID-generated and normalized;
- ZIP upload не принимается, поэтому inbound ZIP-slip/bomb отсутствует;
- object keys для uploads/generated/presets создаются сервером с UUID/user namespace;
- temporary workspace удаляет input in finally and scheduled cleanup removes old analysis workspaces.

### 12.3 Missing concrete parser limits

До production нужны:

- max aggregate multipart bytes на service level, не только servlet/proxy;
- max SysEx bytes total/per event;
- max meta payload bytes total/per event;
- max VLQ bytes and malformed/truncated event handling tests;
- min/max ticks-per-beat and max absolute beats;
- max pattern windows, independent of ticks;
- max active unmatched notes per channel/pitch and total;
- max parse wall time/CPU/RSS per file and per request;
- max analysis JSON bytes/pattern count;
- early streaming event limit до полного in-memory Sequence/MidiFile;
- linear pattern bucketing rather than full notes scan per window;
- image decoded pixel/frame limits and re-encoding;
- audio magic, trusted decode, duration/sample-rate/channel limits.

### 12.4 Fuzz/negative cases missing

Malformed header/chunk lengths, truncated VLQ, long delta, zero/huge division, dense tempo map, oversized SysEx/meta, unmatched note-on, overlapping notes, Unicode/null/control filenames, duplicate names, polyglot, 100-file aggregate, parser timeout and cleanup-after-kill. Наличие file size limit снижает, но не устраняет algorithmic attack surface.

## 13. Generated pack lifecycle and DB/S3 consistency

### 13.1 Actual staged sequence

1. REQUIRES_NEW creates PENDING pack and item rows with staged object keys.
2. Each MIDI uploads to MinIO.
3. ZIP uploads.
4. Native conditional update PENDING → READY.
5. Pack is re-read and returned.
6. On RuntimeException: best-effort mark FAILED, then immediate cleanup; delete failures set cleanupRequired.

Положительное: READY выставляется после завершения всех вызовов upload, и READY update conditional. Object keys server generated.

### 13.2 Failure matrix

| Failure point | Current result | Risk |
|---|---|---|
| DB fails creating PENDING | No upload yet | Safe |
| MIDI upload N fails | Earlier objects deleted best effort; row FAILED | Delete failure marks cleanupRequired, but no retry worker |
| ZIP upload fails | MIDI cleanup attempted | Same orphan risk |
| READY DB update fails/rejected | Cleanup attempted | PENDING/FAILED/object race |
| JVM crash after PENDING | Row remains PENDING | No stale reaper |
| JVM crash after item/ZIP upload | Row PENDING + live objects | No reconciliation |
| Python exits 0 with zero/partial output | Empty/partial ZIP can finalize | No manifest validation |
| Concurrent finalize | Conditional READY allows one | Good |
| Concurrent markFailed/finalize | markFailed read/save not conditional/versioned | Lost transition/race |
| Delete READY pack, S3 unavailable | DB deleted first, object remains | Old presigned URL works until expiry; no durable retry |
| Duplicate client retry | New workspace/UUID/pack | Duplicate charge/storage; no idempotency |

### 13.3 Required state-machine invariants

- READY only if expected item count > 0, equals request amount, each output reparses and satisfies bounds, ZIP manifest matches, each S3 object exists with recorded size/hash.
- Only PENDING may transition to READY or FAILED via conditional update/version.
- FAILED/PENDING objects must not be signed/read.
- Deletion uses tombstone/DELETING and completes asynchronously/idempotently.
- Every operation has idempotency key and recorded attempt.
- Periodic reconciliation handles stale PENDING, cleanupRequired, objects without DB and DB rows without objects.

## 14. MinIO and signed URL review

### 14.1 Authorization

Current presigned endpoints pass the important checks:

- find item by both itemId and packId;
- require pack READY;
- PUBLIC or exact owner;
- private anonymous/User B hidden as 404;
- URL generated only after checks;
- DTO object key fields ignored from serialization;
- URL response Cache-Control no-store and Pragma no-cache;
- preview default 600s, download 180s;
- Content-Disposition for signed generated files uses server-safe name.

No current endpoint was found that accepts arbitrary objectKey from user.

### 14.2 Remaining risks

- bucket policy is external mutable state and not enforced (H-05);
- MinIO root creds are used by backend (M-15);
- presign endpoint correctness/DNS/TLS cannot be validated from static Compose;
- TTL bounds not validated;
- issued URL cannot be revoked except object deletion/credential/policy change and remains usable until expiry;
- DB-first delete plus quiet S3 failure leaves old URL usable;
- MinIO API/console are loopback by default, but VPS firewall/runtime port scan not verified;
- listObjects blocked for anonymous on fresh Testcontainers bucket; existing production policy remains unknown.

## 15. Rate limiting and proxy review

### 15.1 Client IP resolution

ClientIpService starts from remoteAddr, trusts X-Forwarded-For only when immediate peer is within configured CIDRs, normalizes IPv4-mapped IPv6 and walks a comma chain from trusted side. Это существенно лучше, чем слепое доверие first XFF. Forwarded and X-Real-IP are not used; this is acceptable if nginx emits the expected XFF contract.

Deployment gaps:

- prod requires explicit CIDRs, but Compose omits variable;
- exact nginx proxy chain/ranges absent;
- IPv6/multiple proxies have unit-level logic but no real deployment test;
- horizontal replicas share guest DB counter but not auth limiter/semaphore.

### 15.2 Coverage by endpoint

| Endpoint class | Current limit | Assessment |
|---|---|---|
| Guest generation | 5/day/IP in PostgreSQL | PARTIAL: TOCTOU after cost, reset LocalDate timezone |
| Auth generation | None | FAIL |
| Login | 5/15m in memory | PARTIAL |
| Register | 3/hour in memory | PARTIAL |
| Temp analysis | None | FAIL |
| Upload project/avatar | None beyond size | FAIL abuse protection |
| Dataset create/delete/list | None | PARTIAL |
| Signed URL issuance/download proxy | None | PARTIAL |
| Contact | None | FAIL abuse protection |
| Likes/profile/feed | None | Usually lower cost, but spam/pagination budgets absent |

No queue; semaphore tryAcquire returns busy immediately at 2 concurrent generation per replica. Для multiple replicas capacity multiplies. No global per-user concurrent generation protection.

## 16. Backend review

### 16.1 Validation and contracts

Generation amount 1–34, BPM 40–240, pitch -12..12, octaves 1–4, pack/name/profile string lengths and enums have reasonable Bean Validation/manual controls. Page size for public feeds capped at 50. UUID parsing handled by framework.

Gaps:

- user/dataset/pack owner lists unbounded;
- permissive JSON unknown/duplicate/depth;
- invalid DataIntegrity exceptions all map to “Account already exists”, even guest counter race;
- optional empty generation body is normalized to defaults — documented behavior should be explicit;
- type/pitch/octaves accepted but not applied to Python;
- UNLISTED upload visibility behaves effectively private, not share-by-link.

### 16.2 Exceptions

API responses for unexpected runtime are generic and server properties disable stack/message/binding detail — PASS. Specific handlers cover 400/404/409/413/429/500/503-like storage cases. Gaps:

- authentication 401/403 semantics;
- no explicit 415/422 contract;
- missing multipart part may use framework body inconsistent with ApiError;
- full stack traces/internal object metadata appear in server logs;
- Python stderr/stdout is logged;
- no request/operation correlation.

### 16.3 SQL injection/mass assignment

Repositories use derived JPQL/native constant SQL with bound params; no user-concatenated raw SQL found. DTO mapping is explicit rather than binding JPA entities, reducing mass assignment. Sort fields are not exposed as arbitrary property strings. SQL injection path not found.

## 17. Frontend review

### 17.1 Security

- localStorage bearer + no CSP: M-02.
- React renders bio/title/username as text; dangerouslySetInnerHTML/eval not found.
- contact email HTML escapes tested script input.
- arbitrary profilePictureUrl is accepted; browser can contact third-party tracker/IP logger. Scheme rendering is limited by apiUrl behavior/browser image handling, no server-side fetch SSRF found.
- no open redirect parameter found. Presigned URL returned by trusted backend is passed to window.location.assign.
- frontend route guards are client UX only; backend remains actual authorization control.
- NEXT_PUBLIC_API_URL is intentionally bundled. Internal MinIO URL/object keys were not found in bundle source, but default localhost fallback can be baked by an incorrect direct build.
- no service worker found; browser source maps default were not runtime-inspected.

### 17.2 Reliability/performance

- playback hook uses AbortController and cleans object URLs/timers reasonably.
- upload XHR has timeout but component cancellation/unmount path is limited.
- polling/infinite feed cleanup exists; server page cap 50.
- browser 15s timeout causes retry amplification.
- Tone.js/MIDI browser processing can consume client memory for large-but-valid files; server file limit mitigates.
- Next build succeeds; bundle size needs real analyzer/RUM measurement, not guessed numbers.

## 18. Python generator review

### 18.1 Entry points and invocation

Reviewed python/generate_midi.py, python/analyze_midi.py, python/temp_analyzer.py, midi_generator and midi_analyzer packages. Backend uses ProcessBuilder argument list, not shell; user strings are not interpolated into command shell. Analysis/output paths are server generated. Command injection was not found.

### 18.2 Filesystem and output

- generation uses unique backend temp dir, then cleanup in GeneratedFiles.close/finally;
- writer clears files in its supplied output directory; backend supplies server-created directory;
- ZIP entries originate from generated filenames, not upload names;
- safe_key only replaces space and #, not separators. Currently key derives from internal analysis, so path traversal is defense-in-depth/Suspected rather than exploitable; loader schema validation should still restrict it;
- random global seed is not controllable; reproducibility/debug replay is limited;
- partial output is not atomically manifested/validated by backend.

### 18.3 Dependencies/tests

mido==1.3.3 is exact but unhashed. pip check passed. pip-audit unavailable, so known Python CVEs are NOT VERIFIED. Ruff/mypy CI scope passes for midi_generator/generate_midi, but expanded Ruff over all python found 22 style/import errors, proving whole-package coverage gap. pytest: 72 passed, one deprecation warning; smoke tests validate generated MIDI, but adversarial temp analyzer/process tests are insufficient.

## 19. Database review

### 19.1 Schema and migrations

Production uses Flyway and ddl-auto=validate — PASS. Integration migration tests use PostgreSQL Testcontainers and verify key constraints. Foreign keys/indexes/non-null fields generally exist; generated pack consistency columns added in V6/V7. Enums stored as strings, timestamps mostly OffsetDateTime/TIMESTAMPTZ.

Risks:

- default non-prod ddl-auto=update becomes dangerous if prod profile omitted;
- username case-insensitive identity not enforced in DB;
- no @Version on lifecycle records;
- generated guest owner can be null by design/schema, now unintentionally used;
- user deletion/export lifecycle absent; generated owner FK may SET NULL, creating more ownerless data;
- cleanup/retention tables/jobs incomplete.

### 19.2 Query/performance

- public feed pagination capped, but status condition missing;
- owner packs and dataset lists can be unbounded;
- mapping items may N+1; verify Hibernate SQL statistics and EXPLAIN;
- profile counts include nonREADY packs;
- indexes need workload review for owner/status/created and visibility/status/created;
- Hikari settings rely mostly on defaults/env; saturation alerts absent.

## 20. Docker and infrastructure review

### 20.1 Positive controls

- multi-stage builds;
- app runtime USER non-root;
- production public-facing ports default loopback;
- PostgreSQL no host port;
- prod profile and required secret placeholders;
- backend/frontend healthchecks present;
- restart policies present;
- no production secret copied as literal in Dockerfiles.

### 20.2 Risks

- H-01 prevents startup;
- mutable base images/tags and latest MinIO;
- backend build skips tests, relying on separate CI;
- MinIO root credentials reused by app;
- one flat network;
- no resource/pids limits, capability drop, read-only root FS, no-new-privileges;
- writable temp/local avatar behavior not designed for immutable replicas;
- production MinIO health/readiness incomplete;
- no nginx/TLS configuration in repository: TLS versions, HSTS, body limits, proxy timeouts, rate limiting, forwarded headers, compression and cache/security headers NOT VERIFIED;
- development Compose exposes PostgreSQL/MinIO with known dev credentials on all interfaces; безопасно только на trusted local machine and must never be used on public VPS;
- no backup jobs/restore automation.

## 21. CI/CD and supply-chain review

### 21.1 Existing workflow coverage

| Area | Existing checks | Effective result |
|---|---|---|
| Backend | Java setup, ./mvnw verify, test artifact | Strong unit/integration suite, but test config shadows prod |
| Python | compileall midi_generator + generate_midi, import smoke, Ruff, mypy, pytest | Passes configured scope; not entire analyzer package |
| Frontend | npm ci, typecheck, lint, build, coverage | Good intended chain; local full coverage run flaky |
| Compose | production config validation | Currently fails because wrong env name |
| API Newman | starts backend/MinIO, runs collection | Stale downloadUrl contract and public bucket |
| E2E | backend/frontend/MinIO + Playwright | Broad happy paths; public MinIO/non-prod backend |
| Docker | backend/frontend build, Trivy image | Useful, mutable actions/images |
| Security | Trivy fs SARIF, CodeQL Java/JS/Python | Good presence; actual current alert state unavailable |
| Aggregator | CI Required needs all jobs | Correct design, but likely red on current revision |

Workflow permissions default contents:read and security jobs receive narrower security-events:write — positive. pull_request_target отсутствует, production secrets in PR jobs не используются — positive.

### 21.2 Missing or bypassable controls

- git diff --check отсутствует в workflow;
- no explicit test for disabled/commented tests, although current search found none;
- Maven dependency-check/SBOM and Python pip-audit absent;
- secret scanning/gitleaks absent;
- actions not commit-SHA pinned;
- branch protection/required checks/admin bypass settings cannot be proven locally;
- deploy workflow absent, so exact artifact promotion, VPS SSH permissions, rollback and environment approvals unverified;
- no test that production config starts the built image;
- no private MinIO unsigned/list/expired presign E2E in main workflow state;
- no fork/branch policy evidence outside YAML.

Может ли broken code попасть в dev? **Да, если GitHub branch protection не требует CI Required или допускает bypass.** YAML сам по себе не блокирует push/merge. Фактический GitHub setting — NOT VERIFIED.

Может ли workflow быть зелёным, проверив только часть Python? Настроенный Python job проверяет pytest tests, но static compile/lint/type scope исключает midi_analyzer и temp_analyzer.py. Runtime import smoke частично компенсирует syntax/import, но style/type/security regressions в analyzer могут пройти. Expanded local Ruff это подтвердил.

### 21.3 Secrets

Tracked .env/private-key/credential artifacts не найдены. application.properties/Compose содержат dev defaults и environment placeholders. Безопасный git log -S/filename review показал historical commits с configuration markers и когда-то tracked .env.example, но values intentionally не извлекались. Нужен full-history secret scanner; если он найдёт реальный credential, rotation обязательна, даже если файл удалён.

## 22. Test coverage review

### 22.1 Backend

222 tests, 0 failures/errors/skips. Есть H2 context tests, PostgreSQL Testcontainers constraints/concurrency/Flyway и MinIO integration. Security/IDOR path покрыт лучше среднего: anonymous/User B/private, parent-child и unsigned MinIO checks присутствуют.

Недостатки:

- production properties не загружаются;
- H2 create-drop path отличается от Flyway/PostgreSQL;
- staged lifecycle tests преимущественно mocks, нет real DB+MinIO crash boundary;
- no stale PENDING/reconciliation/idempotency/parallel finalize-vs-fail tests;
- no authenticated quota behavior, потому что quota no-op;
- no proxy-chain integration behind actual nginx;
- no parser fuzz/time/RSS tests;
- no expired presigned URL/delete-old-URL end-to-end.

### 22.2 Frontend

Typecheck passed; lint passed with 10 warnings; production build passed. Full npm run ci дошёл до Jest coverage и упал: 1 suite/test timeout, 70 tests passed; chain не дошёл до build. Targeted app/page.test.tsx with --runInBand passed 4/4, что указывает на flaky/resource-sensitive test, не deterministic product failure. Coverage: 43.24% statements, 37.67% branches, 39.67% functions, 44.92% lines; thresholds отсутствуют.

Критические пробелы: auth token propagation to analyze, signed URL history/cache behavior, contact abuse, multi-tab stale token, cancellation/retry/idempotency, custom authenticated E2E.

### 22.3 Python

72 tests passed, 0 failed, one deprecation warning. Compile/import all modules passed. Generator output smoke verifies count/nonempty/valid MIDI in standalone path.

Пробелы: temp_analyzer malicious files and complexity, midi_analyzer full parser boundaries, subprocess child/timeout, output path/safe_key adversarial schema, memory/CPU limits, deterministic seed/replay, whole-package CI lint/type.

### 22.4 Required new test matrix

| Matrix | Required cases |
|---|---|
| Identity | no token, valid A, valid B, expired, forged, malformed, empty, deleted user |
| Ownership | pack/item parent mismatch, dataset/temp ID swap, public/private/unlisted, legacy/current |
| Storage | private unsigned GET/list, short TTL expiry, delete while URL issued, stale public policy |
| Concurrency | first-time guest IP, existing IP, authenticated quota, finalize-vs-fail, duplicate idempotency |
| Failure injection | DB before/after upload, item N, ZIP, READY update, process crash, cleanup retry |
| Upload/parser | all limits ±1, SysEx/meta/VLQ, max beats/windows, 100 files, timeout/RSS, temp cleanup |
| Production | built image startup, Flyway validate, readiness with DB/S3 unavailable, proxy IP chain |

## 23. Performance and scalability review

Benchmark numbers не измерялись; следующие выводы — architecture-based estimates.

### 23.1 Likely first bottlenecks

- **10 simultaneous users:** max two generators per backend; остальные получают immediate busy/429, queue отсутствует. Параллельные temp analyses обходят этот semaphore и способны стать первым CPU/process bottleneck.
- **100 users:** public analysis/request threads, Python processes, local disk и S3/DB orphan growth вероятнее сломаются раньше feed. Auth generation остаётся unlimited по времени/объёму. Profile/list queries с many items дадут DB/heap pressure.
- **1,000 generation requests/hour:** при средней generation duration неизвестна фактическая throughput; max 2 in-flight per replica ограничивает nominal rate, но retries от 15s frontend timeout и no idempotency создают extra work. Permanent guest/staged objects и DB rows растут без retention.
- **Several backend replicas:** global generation cap умножается; auth/login limits расходятся; temp analysis хранится на local replica и последующий request может не найти ID; local avatar fallback inconsistent; no global queue/reconciliation leader; scheduled cleanup runs на каждой replica and can race/list repeatedly.

### 23.2 I/O and memory

- generated legacy downloads read whole object into byte[], but MIDI limits small; ZIP can contain up to 34 files and remains bounded indirectly, yet streaming is preferable;
- upload/analysis parser loads full MIDI; aggregate 100 files raises heap/CPU;
- ZIP creation streams files locally, positive, but requires local disk headroom;
- S3 timeouts configured, retries delegated SDK; operation-level retry/idempotency unclear;
- feed pagination cap positive; item access/query plan needs measurement;
- signed URL generation is cheap compared with DB/Python but can be spammed.

### 23.3 Scaling design needed

Move generation/analysis to durable job queue/workers with global per-tenant concurrency, operation status/idempotency, resource sandbox and shared artifacts. Keep API stateless. Move temp analysis to shared object storage or bind it to resumable job, not local filesystem. Centralize limits. Add capacity metrics before choosing replica counts.

## 24. Privacy and operational readiness

### 24.1 Data inventory

Stored or processed:

- email, username, password hash, profile bio/picture URL;
- guest IP address and daily usage date/count;
- uploaded MIDI/sample, original filenames, content types/sizes;
- generated MIDI/ZIP, prompts/settings/metadata, ownership/visibility;
- datasets and analysis JSON including source-derived musical characteristics;
- temporary raw MIDI and access token metadata for up to configured retention;
- favorites/feed interactions;
- application logs containing identifiers, object keys, internal paths/errors;
- backups, если оператор их настроит, но design отсутствует.

### 24.2 Retention/deletion/export

Only temp analysis 24h and legacy ZIP 2d cleanup exist. Guest staged packs, per-item files, user uploads/samples, avatars, datasets until manual delete, logs and backups не имеют complete policy. Account deletion/export отсутствуют. Public/private visibility does not equal retention consent.

Технические рекомендации:

- define purpose, legal basis, retention, deletion trigger and backup expiry per data class;
- minimize original filename/IP storage; hash/pseudonymize limiter keys if compatible with abuse goals;
- implement authenticated export and verified deletion orchestration;
- ensure public visibility is explicit and reversible;
- document processors: hosting, email provider, object storage/logging/analytics;
- create breach/DSAR/runbooks and access audit.

Нужно отдельное юридическое review Germany/EU; этот отчёт не является legal opinion. localStorage strictly necessary auth state may fall under TDDDG exception, but any analytics/nonessential storage requires independent assessment and consent design.

### 24.3 Operational readiness

До запуска нужны owner and evidence for:

- on-call/contact and incident severity/runbook;
- dashboard/alerts for request rate, 4xx/5xx, auth/limit events, generation queue/duration/timeouts, Python exit, DB pool, S3 latency/errors, disk, PENDING/cleanupRequired/orphans;
- liveness vs readiness;
- immutable deploy/rollback and migration rollback strategy;
- daily encrypted off-host backups and periodic restore drill;
- key/password rotation and emergency presigned/object revocation;
- log retention/redaction/access/rotation;
- capacity and abuse playbook.

## 25. Required production launch blockers

### 25.1 Production launch checklist

| Requirement | Status | Evidence | Blocking |
|---|---|---|---|
| Built backend starts with prod profile | FAIL | Runtime binding failure on max-file-count | YES |
| Required production env fully passed | FAIL | TRUSTED_PROXY_CIDRS absent from service env | YES |
| Authenticated generation quota enforced | FAIL | No-op methods | YES |
| Guest quota atomic before expensive work | FAIL | Check/increment split | YES |
| Temp analysis abuse/concurrency controls | FAIL | Public unbounded Python path | YES |
| Generated pack crash recovery/idempotency | FAIL | No stale PENDING/retry/reconciliation | YES |
| READY requires complete validated manifest | FAIL | Zero/partial output not rejected | YES |
| Private MinIO policy enforced and tested | NOT VERIFIED | Fresh test private, prod init does not enforce; CI makes public | YES |
| Signed URL ownership and parent-child checks | PASS | GeneratedFileAccessService review/tests | NO |
| Short signed URL TTL and no-store response | PASS | Defaults 600/180; controller headers | NO, add bounds |
| Authenticated custom analysis flow | FAIL | Frontend omits JWT | YES |
| Required CI green on current contract | FAIL | Compose env + Newman mismatch | YES |
| Production Docker images build | PASS | backend/frontend builds succeeded | NO |
| Backend full tests | PASS | 222/222 | NO, add prod smoke |
| Frontend type/lint/build | PASS | Passed; lint warnings | NO |
| Frontend full test/coverage stability | FAIL | One 5s timeout in full run | YES for reliable release gate |
| Python full tests/import/compile | PASS | 72 tests, all imports/compile | NO |
| Python whole-package lint/type/security | PARTIAL | CI scope passes; expanded Ruff 22 errors; pip-audit unavailable | YES before release evidence |
| TLS/HSTS/secure nginx config | NOT VERIFIED | No nginx config/runtime probe | YES |
| Public port/firewall exposure verified | NOT VERIFIED | Compose loopback defaults only | YES |
| Secrets are random/rotated/least privilege | PARTIAL | prod placeholders/validator; runtime values not inspected; root S3 app creds | YES |
| Current Maven/Python/container CVE scan clean | NOT VERIFIED | scanners not available locally; CI defined, current results unknown | YES |
| Backup and restore drill | NOT VERIFIED | Checklist only | YES |
| Metrics/readiness/alerts/log rotation | FAIL | Implementation absent | YES |
| Account/data deletion/export/retention/legal pages | FAIL | Routes/docs absent | YES for Germany public launch |
| Branch protection requires CI Required | NOT VERIFIED | GitHub settings not available locally | YES |

### 25.2 Real launch blockers

1. H-01 production startup/config.
2. H-02 unlimited authenticated generation.
3. H-03 unbounded temp-analysis DoS.
4. H-04 lifecycle/recovery/output invariants.
5. H-05 private bucket enforcement/runtime proof.
6. H-06 broken authenticated custom workflow.
7. H-07 broken/stale required CI.
8. H-08 permanent guest data without lifecycle.
9. External evidence gates: TLS/firewall, current CVE/secret scan, backup restore, monitoring and branch protection.

## 26. Prioritized remediation roadmap

### Phase 0 — немедленные launch blockers

Только подтверждённые/высокоуверенные High issues.

| Task | Exact files | Expected result | Required tests | Dependencies | Size |
|---|---|---|---|---|---|
| Fix production property binding and env wiring | backend/src/main/resources/application.properties; application-prod.properties; docker-compose.production.yml; ci.yml | Prod image starts; explicit trusted proxy CIDRs | Prod context + built-container readiness; Compose config | None | S |
| Implement authenticated quota reservation | GenerationLimitService; GenerateController; repository/migration | Atomic user/day and concurrent limit before Python | Parallel same user, replicas, refund/failure, midnight UTC | DB/Redis choice | M |
| Gate/sandbox temp analysis | DatasetController; TempAnalysisService; InMemory/distributed limiter; temp_analyzer.py; Compose | Bounded processes/queue/CPU/RAM, no thread leaks | 100 parallel rejects, timeout child kill, adversarial beats/SysEx/meta | Central limiter and container policy | L |
| Complete pack state machine/recovery | GeneratedPackService; GeneratedPackTransactionService; repository; migrations; cleanup worker | Conditional transitions, manifest validation, stale recovery/idempotency | Failure at every DB/S3/process boundary, crash restart, duplicate request | Operation schema | L |
| Enforce private bucket/least privilege | S3BucketInitializer or init script; production Compose; CI MinIO setup | Existing public policy fails closed/becomes private; app non-root credentials | unsigned GET/list 401/403, signed owner matrix, existing-public-policy migration | MinIO policy design | M |
| Send JWT in temp analysis | frontend/lib/api.ts; callers/tests; backend integration tests | Auth analysis owned and reusable; guest unchanged | guest/A/B/stale token analyze→save/generate E2E | M-01 token semantics decision | S |
| Repair CI contract | ci.yml; Postman collection; E2E fixtures | CI Required green on current signed/private API | local workflow-equivalent Compose/Newman/private signed URL | Bucket fix | M |
| Restore explicit guest lifecycle | GeneratedPackService/TransactionService; cleanup/repository; docs | Guest ephemeral with TTL or documented retained ownerless model | Production-constructor guest test, retention/reconciliation | State-machine decision | M |

### Phase 1 — security hardening

| Task | Exact files | Expected result | Required tests | Dependencies | Size |
|---|---|---|---|---|---|
| Strict invalid bearer semantics/revocation | JwtAuthFilter; JwtService; SecurityConfig; frontend auth hooks | Presented invalid token 401; rotation/versioning | expired/forged/deleted/logout/public endpoint | Auth design | M |
| CSP/security/referrer headers and safer token model | next.config.ts; auth API/hooks; nginx | Reduced XSS/token/URL leakage | Header/XSS regression, auth E2E | TLS edge | M/L |
| Distributed auth/endpoint limits | rate-limit service/controllers | Shared bounded limits with Retry-After | proxy/IP/IPv6/replica/restart tests | Redis/DB | M |
| Harden uploads/media/parser | UserUploadService; UserProfileService; MidiUploadValidator; temp_analyzer.py | Trusted media decode, preparse complexity limits | fuzz/boundary/bomb corpus | Sandbox | L |
| Normalize usernames/password policy | AuthService; UserRepository; users migration; DTO | Case-insensitive uniqueness and stronger password | migration collisions/login variants | Data migration | M |
| Strict API parsing/error semantics | Jackson config; GlobalExceptionHandler | Bounded JSON, consistent 400/401/404/415/422 | malformed matrix | None | S/M |
| Safe filename/signed TTL handling | upload/generated controllers/services; frontend download | RFC-safe filename, bounded TTL, no-referrer | Unicode/control/expiry/history | Header config | S |
| Secret/supply-chain baseline | workflows; dependabot.yml; lock/requirements; Docker tags | SHA/digest pinning, gitleaks, SBOM, current scanners | CI policy tests/attestations | Registry choice | M |

### Phase 2 — reliability

| Task | Exact files | Expected result | Required tests | Dependencies | Size |
|---|---|---|---|---|---|
| Outbox/reconciliation for all DB/S3 flows | upload/dataset/avatar/generated services; migrations; jobs | No untracked orphan/broken DB references | injected DB/S3 failures and retry | Phase 0 state machine | L |
| Unified retention/deletion | cleanup services; repositories; MinIO lifecycle; docs | Per-class TTL/tombstones/account delete | time-travel, backup/delete, old URL | Privacy policy | L |
| Observability | backend dependencies/config/services; Compose; dashboards | Metrics/readiness/correlation/alerts/redaction | DB/S3/Python failure signals | Monitoring stack | L |
| Backup/restore/incident runbooks | deployment scripts/docs | Proven RPO/RTO and off-host restore | Scheduled restore drill | Production infra | M/L |
| Frontend async operation model | API/hooks/components | Operation ID, cancel/poll/idempotent retry | disconnect/refresh/multi-tab | Job queue | M |
| Deterministic comprehensive tests | backend/frontend/python/CI | Stable release gate and production paths | Full matrices section 22.4 | Phase fixes | L |

### Phase 3 — scalability and maintainability

| Task | Exact files | Expected result | Required tests | Dependencies | Size |
|---|---|---|---|---|---|
| Durable generation/analysis worker queue | backend orchestration; Python worker; infra | API replicas stateless, global capacity | load/failover/cancel/idempotency | Phase 0/2 state model | XL |
| Shared temp/object workflow | TempAnalysisService/storage/frontend API | No sticky-session/local disk dependency | cross-replica E2E | Queue/object storage | L |
| Query/pagination optimization | repositories/services/DTO projections/migrations | Bounded profile/feed latency | EXPLAIN, query count, large dataset | Observability | M/L |
| Resource isolation/autoscaling | Compose/deployment/worker config | CPU/RAM/pids bounded and measurable | stress/capacity tests | Queue/metrics | L |
| API/schema contract generation | OpenAPI DTO/frontend types/Postman | One current compatibility-safe contract | consumer/contract tests | CI repaired | M |
| Developer experience | format/lint configs, full Python scope, docs | Consistent reproducible local/CI commands | clean checkout CI | Supply-chain pins | M |

## 27. Commands executed and their results

Все команды запускались локально в repository/test containers. Секреты не выводились.

| Command/check | Result |
|---|---|
| git status --short (initial) | PASS, clean |
| git diff --check (initial) | PASS |
| tracked .env/key/secret/artifact search | PASS: sensitive tracked files not found |
| TODO/FIXME/HACK/@Disabled/skipped/debug search | No disabled/skipped tests; System.out/Python print and historical docs noted |
| safe git history filename/marker search | Historical config markers/.env.example references found; values not read; full secret scan NOT VERIFIED |
| backend\mvnw.cmd clean test from backend | PASS, 222 tests, 0 failures/errors/skips, about 3m47s |
| .\mvnw.cmd -q verify from backend | PASS, 222 tests, 0 failures/errors/skips, 213.4s |
| Maven wrapper invoked from repository root | FAIL, expected operator/cwd error: no POM at root; not a product defect |
| npm ci | First FAIL EPERM unlink native lightningcss DLL (local Windows filesystem); retry PASS, 695 packages, audit 0 |
| npm run ci | FAIL at Jest coverage: 1 timeout, 70 tests passed; build not reached in chain |
| targeted page test --runInBand | PASS, 4/4; confirms flakiness/resource sensitivity |
| npm run build | PASS, Next.js 16.2.10 production build |
| npm audit --omit=dev | PASS at audit time: 0 vulnerabilities |
| Python compileall/import all midi_generator, midi_analyzer and entry points | PASS |
| python -m pytest tests -v | PASS, 72 tests, 1 deprecation warning |
| CI-scope Ruff | PASS |
| CI-scope mypy | PASS, 12 files |
| Expanded Ruff all python | FAIL, 22 import/style errors outside CI scope |
| Expanded mypy analyzers | PASS, 13 files |
| pip check | PASS, no broken requirements |
| pip-audit / Trivy / gitleaks / Syft / Grype availability | NOT VERIFIED: tools not installed locally |
| docker compose -f docker-compose.yml config | PASS |
| production Compose config with exact CI dummy env | FAIL: S3_PRESIGN_ENDPOINT required; CI supplies stale S3_PUBLIC_URL |
| production Compose config with correct dummy env | PASS |
| docker compose production build backend frontend | PASS, cold build 1113.7s; no real secrets |
| docker run prod backend image, network none, dummy env | FAIL as product evidence: ApplicationContext rejects spring.servlet.multipart.max-file-count |
| unsigned MinIO read integration | PASS in backend suite: fresh bucket returns 401/403 |
| external VPS/GitHub/production MinIO attacks | Not executed by scope |

Замечания:

- npm audit 0 — snapshot npm advisory database, не доказательство отсутствия Maven/Python/container CVEs.
- Docker build passes because image build skips tests and does not start Spring context.
- Backend suite logs showed test profile/H2 and explicitly shadowed main properties, explaining why H-01 не пойман.

## 28. Limitations and unverified assumptions

Не удалось подтвердить:

- фактические GitHub branch protection, required checks, current CodeQL/Dependabot/Trivy alerts and fork settings;
- реальные VPS nginx/firewall/TLS/HSTS/ports, systemd/Docker daemon/log rotation;
- production MinIO anonymous/list policy, credentials scope, TLS, object lifecycle and whether old presigned URLs exist;
- production PostgreSQL size/query plans/pool saturation/data quality;
- values, entropy and rotation history of real JWT/DB/MinIO/Resend secrets;
- full git-history secret scan because gitleaks unavailable and secret values intentionally не извлекались;
- Maven/Python/container current CVE status because local OWASP/pip-audit/Trivy databases/tools unavailable;
- backups, restore success, RPO/RTO, offsite copies and incident process;
- measured throughput/latency/RAM/CPU at 10/100 users or 1,000 requests/hour;
- legal sufficiency of privacy/Impressum/consent, поскольку legal artifacts отсутствуют и это не юридический аудит;
- exact behavior of quote/control original filenames at deployed servlet/nginx boundary;
- presigned expiry against real S3_PRESIGN_ENDPOINT/TLS hostname.

Assumptions:

- docker-compose.production.yml is the intended VPS deployment definition;
- current dev revision 1d6a37bd1cc7 is release candidate scope;
- no untracked external nginx, backup, monitoring or policy-as-code was supplied;
- PostgreSQL/MinIO test containers represent protocol behavior, но не production topology/policy;
- all performance statements are qualitative unless a command result explicitly gives time/count.

Отчёт не вносит исправлений. После создания этого файла автоматический remediation не выполнялся.
