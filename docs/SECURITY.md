# Güvenlik ve Tehdit Modeli

## 1. Güvenlik ilkeleri

Promptlar kaynak kod, kişisel veri, ticari sır veya erişim bilgisi içerebilir. Bu nedenle içerik varsayılan olarak yüksek hassasiyetli kabul edilir. Temel ilkeler: minimum yetki, deny-by-default, tenant izolasyonu, kısa ömürlü kimlik bilgileri, uçtan uca audit edilebilirlik ve içerik minimizasyonudur.

## 2. Güven sınırları ve tehdit aktörleri

Güven sınırları connector-cihaz, internet-API, web-tarayıcı, API-veri katmanı, worker-AI provider ve instance admin-tenant verisi arasındadır.

Başlıca tehditler:

- Çalınmış connector veya session token'ı.
- Tenantlar arası IDOR/veri sızıntısı.
- Zararlı prompt ile analiz worker'ını veya model talimatını manipüle etme.
- Sahte/replay ingest olayları ve kaynak tüketme saldırısı.
- Supply-chain veya kötü niyetli connector güncellemesi.
- Log, telemetry, backup veya export üzerinden içerik sızıntısı.
- Yetkili admin veya ele geçirilmiş operasyon hesabı.
- AI provider'a gereğinden fazla veri gönderimi.

## 3. Kontroller

### Authentication

- Parolalar Argon2id ile güncel OWASP parametrelerine göre hash'lenir; parametre sürümü kayıtta tutulur ve girişte rehash edilebilir.
- E-posta doğrulama ve tek kullanımlık, süreli token kullanan parola reseti uygulanır. Passkey/WebAuthn ve TOTP recovery code henüz desteklenmez.
- Web session'ları sunucu tarafında revoke edilebilir; cookie `HttpOnly`, `Secure`, `SameSite=Lax/Strict` ve dar path/domain kullanır.
- Login, reset, registration ve device flow ayrı rate limit ve abuse kontrollerine sahiptir.
- Connector'lar Device Authorization veya Authorization Code + PKCE kullanır; password grant ve URL token'ı yoktur.
- Access token kısa ömürlüdür. Refresh token her kullanımda rotate edilir; reuse tespiti token ailesini iptal eder.
- Connector secret'ları sunucuda yalnız güçlü hash olarak, istemcide OS credential store içinde tutulur.
- OIDC federation henüz desteklenmez; eklendiğinde issuer, audience, nonce, state ve PKCE doğrulaması zorunludur.

### Authorization ve tenant izolasyonu

- Her use-case tek bir merkezi policy katmanından geçer; route seviyesindeki rol kontrolü tek savunma değildir.
- Repository sorguları tenant scope olmadan çağrılamayacak API ile tasarlanır.
- PostgreSQL RLS ikinci savunma katmanıdır; request transaction'ında doğrulanmış tenant context set edilir.
- Background job payload'ı actor/tenant/resource kimliğini taşır; worker yeniden yetki ve varlık ilişkisi doğrular.
- Prompt ve analiz kayıtları tenant-scope PostgreSQL tablolarında tutulur. Uygulama bugün ayrı bir object storage veya signed object URL kullanmaz.
- Instance admin prompt içeriğini varsayılan olarak göremez.

### API ve uygulama güvenliği

- Tüm girişler şema, tip, uzunluk, encoding ve allowlist kurallarıyla doğrulanır.
- Maksimum prompt, batch ve request boyutu açıkça sınırlanır.
- CORS explicit origin allowlist; CSRF koruması cookie-authenticated mutasyonlarda zorunludur.
- CSP nonce/hash, HSTS, `frame-ancestors`, `nosniff`, Referrer-Policy ve Permissions-Policy uygulanır.
- SQL yalnız parameterized ORM/query ile; raw SQL merkezi ve testli wrapper'dan geçer.
- Worker yalnız yapılandırılmış OpenAI, Anthropic veya NVIDIA endpointlerine çıkar; NVIDIA endpoint'i deployment ortamında yönetilir ve tenant kullanıcısı tarafından değiştirilemez. Deployment seviyesinde egress policy operatör sorumluluğundadır.
- API rate limit IP + hassas endpoint grubu boyutlarında Redis üzerinde uygulanır. Tenant/provider bütçeleri AI worker katmanında ayrıca uygulanır.
- API hataları iç stack, SQL, secret veya provider ham yanıtı döndürmez.
- Idempotency kayıtları request body hash'iyle eşleşir; aynı anahtar farklı payload ile reddedilir.

### Prompt injection ve AI güvenliği

- Prompt içeriği her zaman veri olarak işaretlenir; system/developer analiz talimatından ayrı mesaj/alan olarak gönderilir.
- Analiz modeli araç, ağ, dosya veya secret erişimine sahip olmaz.
- Çıktı strict JSON schema ile doğrulanır; HTML olarak render edilmez, markdown sanitize edilir.
- Kullanıcı promptundaki talimatlar authorization, provider seçimi veya veri erişimini değiştiremez.
- Provider'a yalnız analiz için gerekli alanlar gönderilir; kullanıcı adı, e-posta ve platform credential'ı gönderilmez.
- Tenant bazında provider/model seçimi, token bütçesi ve retention politikası görünürdür.

### Secret yönetimi ve şifreleme

- Production secret'ları environment dosyasında commit edilmez; Vault/KMS/secret manager referansları kullanılır.
- Self-host installer yüksek entropili anahtar üretir ve minimum dosya ACL uygular. Rotasyon kontrollü bakım penceresinde [key rotation runbook](runbooks/key-rotation.md) ile yürütülür.
- TLS 1.2+ dış ve servisler arası iletişimde zorunludur; managed ortamda TLS 1.3 tercih edilir.
- Disk ve DB backup katmanlarında at-rest encryption kullanılır.
- Provider API anahtarları veritabanına yazılmaz; deployment secret manager/environment üzerinden yalnız worker'a verilir.
- Session/IP HMAC anahtar rotasyonu mevcut oturumları sonlandıran kontrollü bir bakım işlemidir. Provider anahtarları secret manager üzerinden rotate edilir; uygulama veritabanında provider ciphertext saklamaz.

### Log, audit ve gizlilik

- Uygulama logger'ında içerik ve credential redaction default-on'dur.
- Audit: giriş, token değişimi, rol/üyelik, proje erişimi, export, silme, secret ve admin destek erişimi.
- Audit kaydı actor, hedef, eylem, sonuç, zaman, request/trace ve gerekçe içerir; prompt içeriği içermez.
- Retention tenant tarafından yapılandırılabilir; varsayılanlar açıkça belgelenir.
- Tenant export senkron JSON üretir ve audit edilir. Tenant silme yedi günlük iptal penceresi sonrası worker tarafından uygulanır ve audit edilir.
- Backup silme semantiği ve kriptografik silme politikası privacy belgesinde açıklanır.

### Supply chain

- Lockfile zorunlu, dependency update otomasyonlu ve CI'da vulnerability/license taraması yapılır.
- Release artifact'leri SBOM, provenance ve Sigstore/cosign imzası taşır.
- Container'lar non-root, read-only filesystem, minimal base image ve dropped capabilities ile çalışır.
- Connector izinleri manifestte minimum ve kullanıcıya görünürdür.
- Korunan branch, zorunlu review, signed release ve least-privilege CI token uygulanır.

## 4. Veri sınıflandırması

| Sınıf        | Örnek                                           | Kural                                      |
| ------------ | ----------------------------------------------- | ------------------------------------------ |
| Restricted   | Prompt içeriği, provider API key, refresh token | Loglanmaz; dar erişim; şifreleme ve audit  |
| Confidential | E-posta, proje adı, analiz içeriği              | Tenant-scope; export/retention kontrolleri |
| Internal     | Aggregate metrik, operasyon metadata'sı         | Kimliksizleştirme ve erişim kontrolü       |
| Public       | Dokümantasyon, release metadata                 | Bütünlük/imza kontrolü                     |

## 5. Güvenlik doğrulama kapıları

Her release için:

- SAST, secret scan, dependency/container scan ve IaC scan başarılı.
- AuthN/AuthZ ve tenant escape negatif testleri başarılı.
- CSRF, XSS, SSRF, replay, brute force ve idempotency testleri başarılı.
- Migration ve backup restore tatbikatı başarılı.
- Connector artifact imza doğrulaması başarılı.
- Kritik/yüksek bulgu yok; istisnalar süreli risk kabulüyle kayıtlı.

Public beta öncesi bağımsız penetrasyon testi; önemli auth veya tenant mimarisi değişikliklerinde tekrar test yapılır.

## 6. Olay müdahalesi

1. Alert triage ve severity sınıflandırması.
2. Etkilenen token/connector/key'leri revoke veya rotate etme.
3. Delilleri prompt içeriğini yaymadan koruma.
4. Tenant ve veri kapsamını audit/trace ile belirleme.
5. Yasal ve sözleşmesel sürelerde bildirim.
6. Kalıcı düzeltme, regression testi ve blameless postmortem.

Ayrıntılı müdahale adımları [token theft](runbooks/token-theft.md), [tenant data exposure](runbooks/tenant-data-exposure.md), [provider key leak](runbooks/provider-key-leak.md), [queue flood](runbooks/queue-flood.md), [backup/restore](runbooks/backup-restore.md) ve [compromised release](runbooks/compromised-release.md) runbook'larında tutulur.

## 7. Güvenli varsayılanlar kontrol listesi

- Self-host kurulumu hesap oluşturmayı açık sunar; internet-facing operatör reverse proxy/IdP katmanında davet veya erişim kontrolü uygulamalıdır. İlk kayıt instance admin olur, bu nedenle boş instance kayıt endpoint'i yalnız güvenilen kurulum ağına açılmalıdır.
- İlk owner ayrı bootstrap token kullanmaz; boş veritabanındaki ilk başarılı kayıt atomik olarak instance admin olur. Kurulum tamamlanana kadar API'nin güvenilmeyen ağa açılmaması zorunludur.
- Telemetry opt-in'dir ve hiçbir prompt içeriği toplamaz.
- AI provider entegrasyonu açık onay ve kullanıcı tarafından sağlanan anahtar gerektirir.
- Support access varsayılan olarak kapalıdır. Instance admin talep eder, tenant owner onaylar; erişim bir saat sonra sona erer, her an revoke edilebilir ve yalnız içeriksiz operasyonel metadata döner. Talep, onay, görüntüleme ve revoke audit edilir.
- Connector yalnız seçilen tenant/proje kapsamına erişir.
- Export yanıtı owner oturumuna bağlı, tenant-scope JSON olarak doğrudan üretilir; paylaşılabilir export URL'si oluşturulmaz.
- Development seed hesapları ve default parolalar production build'de bulunmaz.
