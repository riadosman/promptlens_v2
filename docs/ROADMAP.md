# Geliştirme ve Yayın Planı

## 1. Uygulama yaklaşımı

Proje, yatay katmanları tek tek tamamlamak yerine çalışan dikey dilimler halinde geliştirilecektir. Her faz deploy edilebilir, migration'ı test edilmiş ve gözlemlenebilir olmalıdır. “Bitti” yalnız UI görünmesi değil; authorization, hata yolları, dokümantasyon ve testlerin de tamamlanmasıdır.

## 2. Fazlar

### Faz 0 — Kararların sabitlenmesi ve iskelet

Çıktılar:

- Lisans, governance, Code of Conduct, CONTRIBUTING ve security disclosure policy.
- ADR-001 modüler monolit, ADR-002 tenant modeli, ADR-003 auth, ADR-004 connector protokolü, ADR-005 AI provider sınırı.
- pnpm/Turborepo monorepo, TypeScript strict mode, lint/format/test/build pipeline.
- Docker Compose geliştirme ortamı, config şeması, migration ve seed altyapısı.
- CI: build, unit, integration, secret/dependency/container/license scan.
- OpenTelemetry bootstrap ve yapılandırılmış, redacted logging.

Çıkış kriteri: Temiz checkout üzerinde tek bootstrap komutu tüm quality gate'leri çalıştırır; repo hiçbir secret veya default production credential içermez.

### Faz 1 — Kimlik, tenant ve proje çekirdeği

Çıktılar:

- Registration/login/logout/email verification/password reset.
- Session yönetimi, refresh rotation, revoke ve güvenlik olayları.
- Tenant, membership, RBAC/policy ve PostgreSQL RLS.
- Proje create/read/update/archive, proje üyeliği ve filtreleme.
- İlk owner bootstrap/setup wizard.
- Kullanıcı panelinin erişilebilir temel shell'i.

Testler: Auth kötüye kullanım senaryoları, tenant escape matrisi, session fixation/CSRF, proje policy entegrasyon testleri ve Playwright kayıt-giriş-proje akışı.

### Faz 2 — Connector protokolü ve ilk entegrasyon

Çıktılar:

- Versioned connector SDK/manifest ve capability negotiation.
- Device Authorization + PKCE uçları, consent ekranı, OS keychain saklama.
- Offline yerel queue, idempotent batch ingest, backoff ve health tanılama.
- Stabil hook sunan tek resmi platform için referans connector.
- İmzalı connector build/release ve compatibility test matrisi.
- Prompt/proje/tag veri modeli ve prompt geçmişi UI'ı.

Testler: Ağ kesintisi, duplicate event, clock skew, token expiry/rotation/reuse, revoked device, büyük payload ve eski protocol sürümü.

### Faz 3 — AI analiz dikey dilimi

Çıktılar:

- Transactional outbox, BullMQ worker ve dead-letter yönetimi.
- Sürümlü rubric, provider adapter ve strict structured-output validation.
- Skor, güçlü/eksik yön, öneri ve geliştirilmiş prompt saklama.
- Retry/circuit breaker, bütçe ve tenant/provider rate control.
- Analiz detay UI'ı, yeniden analiz ve sürüm karşılaştırma.
- Token/maliyet/latency usage kayıtları.

Testler: Provider timeout/429/5xx, malformed output, prompt injection, duplicate job, worker crash sonrası teslimat ve maliyet limiti.

### Faz 4 — Ürün paneli ve arama

Çıktılar:

- Dashboard, skor trendleri, proje ve model dağılımları.
- PostgreSQL FTS/trigram arama, cursor pagination, tarih/skor/model/platform/tag filtreleri.
- Prompt ve analiz karşılaştırma, kopyalama, export ve retention UI'ı.
- Empty/loading/error/offline durumları ve WCAG 2.2 AA denetimi.
- Aggregate job'lar ve sorgu performans bütçeleri.

Testler: Yetkili arama scope'u, pagination tutarlılığı, Unicode/uzun içerik, büyük tenant veri seti ve erişilebilirlik.

### Faz 5 — Admin ve operasyon

Çıktılar:

- Tenant admin: üyeler, projeler, connector'lar, provider config, audit ve usage.
- Instance admin: kullanıcı/tenant durumları, sistem sağlığı, queue/DLQ, API kullanımı ve log bağlantıları.
- İçerik erişimi olmayan support akışı; süreli break-glass mekanizması.
- Backup/restore, key rotation, connector revoke, incident ve upgrade runbook'ları.
- Data export/deletion ve retention enforcement.

Testler: Privilege escalation, admin/tenant admin ayrımı, audit bütünlüğü, restore drill ve irreversible action confirmation.

### Faz 6 — Kurulum, hardening ve beta

Çıktılar:

- Linux/macOS `./promptlens install`, Windows `promptlens.ps1 install`.
- Preflight, idempotent setup, upgrade, rollback-compatible migration ve diagnostics bundle.
- Pinlenmiş/imzalı images, SBOM ve provenance.
- Load/soak/chaos testleri, kapasite modeli ve SLO dashboard'ları.
- Bağımsız penetrasyon testi ve threat-model güncellemesi.
- Baştan sona profesyonel README, self-host ve contributor belgeleri.

Çıkış kriteri: Desteklenen temiz OS matrisinde tek komut kurulum; connector login ve prompt sync; analiz; user/admin akışları; backup/restore; tanımlı performans ve güvenlik kapıları başarılı.

### Faz 7 — v1.0 ve sürdürülebilirlik

Çıktılar:

- SemVer, deprecation ve connector compatibility politikası.
- Database migration/upgrade destek matrisi.
- Maintainer/reviewer modeli, issue/PR templates ve release cadence.
- İkinci resmi connector, ikinci AI provider adapter ve topluluk SDK örneği.
- Bug bounty veya koordineli vulnerability disclosure süreci.

## 3. Test stratejisi

| Seviye      | Amaç                                                   | Araç/yöntem                                  |
| ----------- | ------------------------------------------------------ | -------------------------------------------- |
| Unit        | Domain kuralları, policy, rubric, parser               | Vitest, deterministic fixtures               |
| Contract    | API, event ve connector geriye uyumu                   | OpenAPI schema + consumer fixtures           |
| Integration | Gerçek DB/Redis/object store davranışı                 | Testcontainers, migration from zero          |
| E2E         | Kayıt, giriş, connector consent, ingest, analiz, admin | Playwright + fake AI provider                |
| Security    | Tenant escape, auth abuse, OWASP sınıfları             | Negatif test suite + scanner + manuel review |
| Performance | Ingest, search ve queue kapasitesi                     | k6; p95/p99 ve saturation ölçümü             |
| Resilience  | Retry, crash, dependency kaybı, restore                | Fault injection ve runbook drill             |

Testlerde dış AI servisine bağımlılık yoktur. Deterministic fake provider timeout, rate limit, malformed JSON ve başarılı yanıt senaryolarını üretir. Gerçek provider smoke testleri yalnız kontrollü nightly/release ortamında çalışır.

## 4. CI/CD kapıları

Her PR:

1. Format, lint, typecheck ve unit test.
2. Sıfırdan ve önceki release'ten migration entegrasyon testi.
3. Contract ve authorization matrix testleri.
4. Secret, SAST, dependency, license ve IaC taraması.
5. Değişen uygulamalar için container build.

Main/release:

1. E2E ve performance smoke.
2. Multi-architecture image build.
3. SBOM/provenance ve artifact imzası.
4. Staging canary, synthetic prompt akışı ve migration doğrulaması.
5. Manuel production promotion; otomatik rollback sinyalleri.

## 5. Definition of Done

Bir özellik ancak şu koşullarda tamamdır:

- Acceptance criteria ve hata/edge-case davranışları yazılıdır.
- Domain ve API sözleşmeleri sürümlüdür.
- Authorization açıkça test edilmiştir; tenant kapsamı doğrulanmıştır.
- Unit/entegrasyon ve gerekiyorsa E2E testleri vardır.
- Log/metric/trace içerir ve hassas veri sızdırmaz.
- Migration ileri uyumlu ve gerçek veri hacmi için değerlendirilmiştir.
- Kullanıcı ve operasyon dokümanı günceldir.
- Erişilebilirlik ve güvenlik kontrol listesi geçer.

## 6. İlk backlog sırası

1. Governance/lisans kararları ve ilk beş ADR.
2. Repo iskeleti, reproducible toolchain ve CI.
3. Config/secrets/logging/telemetry temeli.
4. Tenant-aware DB ve RLS test harness'i.
5. Auth/session/device authorization.
6. Project ve prompt ingest API'si.
7. Referans connector ve offline queue.
8. Outbox/worker/fake AI provider.
9. İlk rubric ve analiz UI'ı.
10. Arama/dashboard/admin/operasyon.

## 7. Risk kaydı

| Risk                                        | Etki                     | Azaltma                                                                      |
| ------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| AI platformları stabil capture API sunmuyor | Connector kırılması      | Önce stabil hook; experimental DOM adapter, compatibility CI ve kill switch  |
| Promptlarda secret/PII bulunması            | Veri ihlali              | Minimizasyon, redaction seçeneği, şifreleme, dar erişim, provider politikası |
| LLM çıktısı tutarsız                        | Yanlış skor/bozuk kayıt  | Sürümlü rubric, schema validation, server-side skor, eval seti               |
| Tenant izolasyon hatası                     | Kritik veri sızıntısı    | Policy + RLS + negatif test matrisi + pentest                                |
| Tek komut kurulum OS farkları               | Kötü onboarding          | Destek matrisi, preflight, pinli images, temiz VM CI                         |
| Queue birikmesi/provider kesintisi          | Analiz gecikmesi/maliyet | Backpressure, circuit breaker, DLQ, budgets ve queue-age alert               |
| Erken aşırı mimari                          | Yavaş geliştirme         | Modüler monolit, ölçüme dayalı servis ayrıştırma                             |
| Açık kaynak supply-chain                    | Artifact ele geçirilmesi | Protected release, SBOM, provenance, signing ve checksum                     |

## 8. v1.0 kabul senaryosu

Temiz ve desteklenen bir makinede otomatik test şu akışı tamamlamalıdır:

1. Repository klonlanır ve tek kurulum komutu çalıştırılır.
2. İlk owner oluşturulur; ikinci kullanıcı kayıt olur ve tenant'a davet edilir.
3. Proje oluşturulur; referans connector kurulur ve browser consent ile bağlanır.
4. Offline ve online promptlar gönderilir; duplicate olmadan projeye senkronize edilir.
5. Analiz skor/alanlar/geliştirilmiş prompt ile tamamlanır.
6. Kullanıcı arar, filtreler, export eder; yetkisiz projeyi göremez.
7. Tenant admin kullanım/audit'i, instance admin sistem sağlığını görür; içerik sınırı korunur.
8. Backup alınır, yeni ortamda restore edilir ve aynı kayıtlar doğrulanır.
9. Connector revoke edildiğinde yeni ingest reddedilir.
10. Upgrade senaryosu veri kaybı olmadan tamamlanır.
