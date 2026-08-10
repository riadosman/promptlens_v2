# PromptLens Sistem Mimarisi

## 1. Kapsam ve hedefler

PromptLens iki dağıtım biçimini aynı kod tabanından destekler:

1. Tek kuruluş veya birey için self-hosted kurulum.
2. Birden fazla tenant barındıran yönetilen SaaS kurulumu.

Sistemin temel işi, desteklenen AI istemcilerinden gelen prompt olaylarını güvenli ve tekrar edilebilir biçimde almak, her promptu bir projeye bağlamak, asenkron analiz etmek ve sonuçları aranabilir bir kullanıcı arayüzünde sunmaktır.

### Kalite hedefleri

| Alan               | İlk production hedefi                                      |
| ------------------ | ---------------------------------------------------------- |
| Kullanılabilirlik  | SaaS API ve web için aylık %99.9                           |
| API gecikmesi      | Analiz dışı isteklerde p95 < 300 ms                        |
| Ingest kabulü      | p95 < 500 ms; analiz asenkron                              |
| Veri dayanıklılığı | PostgreSQL için RPO <= 5 dk, RTO <= 60 dk                  |
| Ölçek              | Tenant başına milyonlarca prompt; yatay worker ölçekleme   |
| İzlenebilirlik     | Dağıtık trace, yapılandırılmış log, metrik ve audit trail  |
| Uyumluluk          | Erişim, dışa aktarma ve silme akışlarına hazır veri modeli |

## 2. Bilinçli kapsam sınırları

İlk kararlı sürümde şunlar yapılmaz:

- Kullanıcının AI sağlayıcısındaki tüm geçmişini geriye dönük kazımak.
- Sağlayıcı arayüzlerine kırılgan DOM enjeksiyonu ile sınırsız destek vermek.
- Arbitrary plugin kodunu sunucu süreci içinde çalıştırmak.
- Her modülü ayrı mikroservis olarak dağıtmak.
- Prompt içeriğini varsayılan olarak ürün iyileştirme veya model eğitimi için kullanmak.

## 3. Teknoloji seçimi

### Uygulama yığını

| Katman             | Seçim                                                      | Gerekçe                                                                         |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Monorepo           | pnpm workspaces + Turborepo                                | TypeScript paketleri arasında hızlı, anlaşılır yapı                             |
| Web                | Next.js (App Router) + React + TypeScript                  | SSR, erişilebilir UI, olgun ekosistem                                           |
| API                | NestJS + Fastify adapter                                   | Modüler sınırlar, OpenAPI, validation ve yüksek throughput                      |
| Worker             | NestJS standalone + BullMQ                                 | API'den ayrı ölçeklenen güvenilir analiz işleri                                 |
| Ana veri deposu    | PostgreSQL                                                 | Transaction, RLS, JSONB, olgun operasyon araçları                               |
| ORM/migration      | Prisma                                                     | Tip güvenliği ve anlaşılır migration süreci; özel SQL migration desteği korunur |
| Queue/cache        | Redis + BullMQ                                             | Retry, delayed jobs, concurrency ve rate control                                |
| Arama              | İlk sürüm PostgreSQL FTS + trigram                         | Ek servis olmadan güvenilir başlangıç                                           |
| Gözlemlenebilirlik | OpenTelemetry + Prometheus + Grafana + Loki/Tempo          | Vendor-neutral telemetri                                                        |
| Kimlik             | Uygulama içi auth katmanı; Argon2id, OIDC ve passkey-ready | Self-host kolaylığı, dış IdP entegrasyonu                                       |
| AI sağlayıcıları   | Provider adapter arabirimi; OpenAI-compatible ilk adapter  | Vendor lock-in olmadan model seçimi                                             |
| Paketleme          | Docker Compose; ileride Helm chart                         | Tek komut self-host ve ölçeklenebilir SaaS yolu                                 |
| Test               | Vitest, Supertest, Playwright, Testcontainers              | Birimden gerçek bağımlılıklı entegrasyona kadar kapsam                          |

Seçimler her major uygulama fazında ADR ile sabitlenecek; framework major sürümleri implementasyon başladığında güncel LTS/kararlı sürümlerden pinlenecektir.

## 4. Üst seviye yapı

```text
AI Client / Browser / IDE
          |
   Trusted Connector
          | HTTPS + device credential + idempotency key
          v
   API / Ingest Gateway  <---->  Web Application
          |                         |
          +---- PostgreSQL <--------+
          |
          +---- Redis Queue ----> Analysis Workers ----> AI Provider
          |                              |
          +---- Object Storage           +---- PostgreSQL
          |
          +---- OTel Collector ----> metrics / logs / traces
```

### Dağıtılabilir birimler

- `web`: Kullanıcı, kuruluş ve admin arayüzü; API'nin public sözleşmesini kullanır.
- `api`: Auth, authorization, project, prompt, search, admin ve ingest modüllerini barındıran stateless modüler monolit.
- `worker`: Analiz, yeniden deneme, kullanım ölçümü, veri export ve retention işleri.
- `postgres`: Sistem kaydı (system of record).
- `redis`: Queue, kısa ömürlü cache, dağıtık kilit ve rate-limit sayaçları.

API ve worker aynı domain paketlerini kullanabilir ancak birbirlerinin private modüllerine doğrudan erişmez. İş sınırları versioned command/event payload'larıdır.

## 5. Monorepo düzeni

```text
apps/
  web/
  api/
  worker/
  cli/
connectors/
  sdk/
  browser-extension/
packages/
  contracts/       # OpenAPI şemaları, event tipleri, hata kodları
  domain/          # Framework bağımsız entity/value object/policy
  auth/
  database/
  observability/
  config/
  ui/
infra/
  compose/
  helm/
  otel/
docs/
  adr/
  runbooks/
```

Bağımlılık yönü `apps -> application/infrastructure -> domain` şeklindedir. `domain`, Next.js, NestJS, Prisma veya sağlayıcı SDK'larına bağımlı olmaz.

## 6. Domain ve veri modeli

Ana varlıklar:

- `Tenant`: Veri ve yetki izolasyonunun en üst sınırı.
- `User`: Global kimlik; tenant üyeliği ayrı kayıttır.
- `Membership`: User-Tenant ilişkisi ve `owner/admin/member/viewer` rolü.
- `Project`: Tenant'a ait, aktif veya arşivlenmiş çalışma alanı.
- `ConnectorInstallation`: Bir cihaz/platform kurulumu, hash'lenmiş credential ve yetenekleri.
- `Prompt`: Değişmez orijinal içerik, model/platform metadata'sı ve proje ilişkisi.
- `PromptVersion`: Kullanıcının veya analizin ürettiği alternatif sürümler.
- `Analysis`: Durum, rubric sürümü, provider/model, skor ve yapılandırılmış sonuç.
- `Tag` / `PromptTag`: Tenant'a bağlı etiketleme.
- `UsageRecord`: Provider token/maliyet ve latency ölçümü.
- `AuditEvent`: Append-only güvenlik ve yönetim olayı.
- `OutboxEvent`: Transactional olarak yayımlanacak domain olayı.

### Temel kurallar

- Tenant'a ait her tabloda `tenant_id` bulunur; composite indexlerin ilk alanıdır.
- Her promptta zorunlu `project_id` bulunur.
- Orijinal prompt güncellenmez; düzeltmeler yeni `PromptVersion` oluşturur.
- Tarihler UTC `timestamptz`, istemci timezone'u ayrı metadata olarak tutulur.
- Silme önce kontrollü soft-delete/retention durumuna, sonra fiziksel silmeye gider.
- Kimlikler dışarı açılan sıralı ID yerine UUIDv7 kullanır.
- Tenant izolasyonu hem uygulama policy katmanında hem PostgreSQL RLS ile uygulanır.

### Prompt ingest sözleşmesi

`POST /v1/ingest/prompts` en az şu alanları kabul eder:

```json
{
  "clientEventId": "uuid",
  "projectId": "uuid",
  "content": "...",
  "platform": "codex",
  "model": "provider/model",
  "occurredAt": "2026-07-30T10:00:00Z",
  "timezone": "Europe/Istanbul",
  "tags": ["backend"],
  "context": { "conversationId": "optional-provider-safe-id" }
}
```

`tenant_id`, `user_id` ve connector kimliği istemciden güvenilir alan olarak alınmaz; credential bağlamından türetilir. `(connector_installation_id, client_event_id)` unique constraint'i tekrar gönderimleri zararsız kılar.

## 7. Kritik akışlar

### İlk kurulum

1. CLI Docker/Compose, port, disk ve entropy kontrollerini yapar.
2. Yerel sırları güvenli dosya izinleriyle üretir; örnek secret commit edilmez.
3. Servisler health check ile başlatılır ve migration tek seferlik job olarak çalışır.
4. Bootstrap URL tek kullanımlık, kısa ömürlü token ile açılır.
5. İlk kullanıcı owner ve instance administrator olur.
6. Kurulum doğrulaması DB, queue, mail ve callback URL'lerini test eder.

Kurulum idempotent olmalı; tekrar çalıştırmak veri kaybına yol açmamalıdır.

### Connector kurulumu ve giriş

OAuth 2.0 Device Authorization Grant benzeri akış kullanılır:

1. Connector public client olarak device authorization endpoint'inden `device_code`, kısa `user_code` ve doğrulama URL'si alır.
2. Sistem tarayıcıyı açar; kullanıcı kayıt olur veya giriş yapar.
3. Kullanıcı tenant, proje varsayılanı ve connector yetkilerini açıkça onaylar.
4. Connector token endpoint'ini sınırlı aralıklarla poll eder.
5. Sunucu kısa ömürlü access token ve rotation uygulanan refresh token verir.
6. Credential OS keychain/credential vault'ta saklanır; düz metin config dosyasına yazılmaz.

Browser extension için Authorization Code + PKCE kullanılır. Web session cookie'si connector'a aktarılmaz.

### Prompt senkronizasyonu

1. Connector kullanıcı gönderimini desteklenen, açık integration hook'undan yakalar.
2. Yerel kuyruk olayı diskte şifreli veya OS-protected alanda kısa süre tutar.
3. Ingest endpoint idempotency key ile çağrılır.
4. API auth, schema, boyut, proje erişimi ve rate limit kontrolü yapar.
5. Prompt ve outbox event aynı DB transaction'ında yazılır.
6. Dispatcher event'i BullMQ'ya taşır; API `202 Accepted` veya mevcut kaydı döner.
7. Bağlantı kesilirse exponential backoff + jitter ile tekrar gönderilir.

### Analiz

1. Worker `PromptCreated` işini alır ve analysis kaydını `queued -> running` geçirir.
2. Tenant politikası, seçili provider ve rubric sürümü çözülür.
3. İçerik boyut/zararlı payload kontrolünden geçirilir; system instruction kullanıcı içeriğinden ayrılır.
4. Provider yapılandırılmış JSON schema yanıtı vermeye zorlanır.
5. Yanıt schema ve skor aralığı açısından doğrulanır.
6. Orijinal prompt, analiz ve geliştirilmiş `PromptVersion` transaction ile kaydedilir.
7. Geçici hatalar retry edilir; kalıcı hatalar görünür duruma ve dead-letter kuyruğuna gider.

Skor, sürümlenmiş rubric ile hesaplanır. Önerilen ilk rubric: amaç açıklığı, bağlam yeterliliği, kısıtlar, çıktı formatı, doğrulanabilirlik ve güvenlik; toplam skor 0-100'dür. Model çıktısı tek başına güvenilir hesap kabul edilmez: alanlar doğrulanır ve ağırlıklı toplam sunucu tarafında üretilir.

## 8. Connector mimarisi

Connector SDK şu versioned arabirimleri tanımlar:

- `detect()`: Platform ve sürüm desteğini belirler.
- `authenticate()`: Device/PKCE akışını yürütür.
- `capture()`: Kullanıcının gerçekten gönderdiği prompt olayını üretir.
- `configureProject()`: Varsayılan veya istek bazlı proje seçer.
- `sync()`: Offline queue ve idempotent teslimatı yönetir.
- `health()`: Auth, endpoint ve queue durumunu raporlar.

İlk resmi entegrasyon tek bir, stabil API/hook sunan platformla dikey dilim olarak tamamlanmalıdır. DOM scraping kullanılan entegrasyonlar `experimental` etiketi taşır, kill switch ve compatibility test matrisi olmadan kararlı sayılmaz.

Connector manifest'i platform, minimum sürüm, istenen izinler, callback yöntemleri ve protokol sürümünü içerir. İmzalı release artifact'leri ve checksum doğrulaması zorunludur. Sunucu connector protocol için mevcut ve önceki bir major sürümü destekler.

## 9. API tasarımı

- Dış API `/v1` ile sürümlenir. `/v1/openapi.json`, Nest route metadata'sı ve paylaşılan Zod kaynak sözleşmelerinden OpenAPI 3.1 olarak üretilir.
- RFC 9457 Problem Details hata formatı kullanılır.
- Cursor pagination tercih edilir.
- Liste endpoint'lerinde açık allowlist filtre/sıralama alanları bulunur.
- Mutating connector isteklerinde idempotency zorunludur.
- Admin API ayrı route namespace ve ayrı authorization policy kullanır.
- Webhook imzaları timestamp + body üzerinden HMAC/anahtar tabanlı doğrulanır ve replay penceresi uygulanır.

## 10. Yetkilendirme modeli

RBAC başlangıç rollerini tanımlar; kaynak erişimi policy/ABAC kontrolleriyle daraltılır:

| Rol            | Genel yetki                                                             |
| -------------- | ----------------------------------------------------------------------- |
| Owner          | Tenant ayarları, üyelik, billing/provider config, tüm tenant verisi     |
| Admin          | Kullanıcı/proje/prompt yönetimi; owner atama ve kritik secret hariç     |
| Member         | Yetkili projelerde oluşturma, okuma, analiz                             |
| Viewer         | Yetkili projelerde salt okunur erişim                                   |
| Instance admin | SaaS/self-host instance sağlığı; prompt içeriğine varsayılan erişim yok |

Instance admin ile tenant admin ayrıdır. Destek erişimi süreli, gerekçeli, audit edilmiş ve mümkünse tenant onaylıdır.

## 11. Arama ve raporlama

İlk faz PostgreSQL generated `tsvector`, GIN ve `pg_trgm` indexleri kullanır. Arama her zaman tenant ve authorization scope ile birleşir. İstatistikler ham tablolara pahalı sorgular yerine günlük/saatlik aggregate tablolarından gelir. Ölçek veya özellik gereksinimi kanıtlandığında OpenSearch ayrı bir read model olarak CDC/outbox üzerinden eklenebilir; ana kayıt kaynağı olmaz.

## 12. Operasyon ve dağıtım

### Self-hosted

- Pinlenmiş digest'li container imajları.
- Compose profile: core servisler varsayılan; gözlemlenebilirlik opsiyonel.
- Reverse proxy/TLS kullanıcıya ait olabilir; güvenli örnek Caddy yapılandırması sağlanır.
- Upgrade öncesi otomatik preflight ve backup; migrationlar geri uyumlu expand/migrate/contract düzeninde.

### SaaS / Kubernetes

- API ve worker ayrı HPA metrikleriyle yatay ölçeklenir.
- Managed PostgreSQL ve Redis tercih edilir.
- Multi-AZ, point-in-time recovery ve düzenli restore tatbikatı uygulanır.
- Deployment rolling/canary; migration ayrı kontrollü job'dur.

### Health uçları

- `/health/live`: süreç yaşıyor mu; bağımlılık çağırmaz.
- `/health/ready`: DB/Redis erişimi ve güncel worker heartbeat'i.
- `/health/startup`: uzun başlangıçlar için.

## 13. Gözlemlenebilirlik

- Her istek ve işte `request_id`, `trace_id`, `tenant_id` (pseudonymous), actor ve operation bulunur.
- Prompt metni, token, cookie, authorization header ve secret loglanmaz.
- Metrikler: ingest hızı/hatası, queue depth/age, analysis latency/success, provider token/maliyet, auth failure, rate-limit hit, DB pool saturation.
- SLO'lara dayalı alertler; yalnız CPU tabanlı alertlere güvenilmez.
- Audit event'ler uygulama loglarından ayrılır ve değiştirmeye karşı korumalı saklanır.

## 14. Ölçekleme ve evrim stratejisi

Modüler monolit başlangıçta transaction ve operasyon kolaylığı sağlar. Şu ölçümlerden biri kalıcı olarak oluşursa ilgili modül ayrıştırılabilir:

- Bağımsız ölçek ihtiyacı API'nin geri kalanından 10x farklıysa.
- Ayrı hata alanı veya deployment ritmi iş açısından gerekliyse.
- DB contention ölçülmüş ve partition/read model ile çözülemiyorsa.

İlk doğal ayrıştırma adayları analysis orchestration, ingest gateway ve search indexing'dir. Ayrıştırma outbox sözleşmeleri sayesinde domain davranışını değiştirmeden yapılır.

## 15. Açık kararlar

Kod başlamadan ADR ile kesinleştirilecek konular:

1. Apache-2.0 ve AGPL-3.0 lisans seçimi; öneri geniş entegrasyon ekosistemi için Apache-2.0.
2. İlk resmi AI platform connector'ı; seçim stabil API/hook, kullanıcı talebi ve dağıtım izinlerine göre yapılmalı.
3. E-posta sağlayıcı abstraction'ının ilk adapter'ı.
4. Self-hosted varsayılan AI provider'ının kullanıcı anahtarı mı yoksa yerel model mi olacağı.
5. SaaS billing'in community çekirdeğinden nasıl ayrılacağı.
