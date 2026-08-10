# PromptLens Production Kurulum Rehberi

Bu rehber, PromptLens'i internete açık tek sunuculu bir production ortamında Docker Compose ile kurmak ve işletmek için gereken adımları içerir. Yerel geliştirme kurulumu için [INSTALLATION.md](INSTALLATION.md) belgesini kullanın.

## 1. Production mimarisi

Önerilen temel akış:

```text
Internet
   |
DNS + HTTPS
   |
Reverse proxy
   |-- app.example.com  -> 127.0.0.1:3000 (web)
   `-- api.example.com  -> 127.0.0.1:4000 (API)
                              |
                    PostgreSQL + Redis + worker
```

Compose dosyası web, API, PostgreSQL ve Redis portlarını yalnızca `127.0.0.1` üzerinde yayınlar. Dış erişim reverse proxy üzerinden yapılmalıdır.

## 2. Gerekli altyapı ve hesaplar

Kuruluma başlamadan önce aşağıdakileri hazırlayın:

- Güncel bir Linux sunucu ve yönetici erişimi.
- En az 4 vCPU, 8 GB RAM ve uygulama verisine uygun kalıcı disk.
- Docker Engine ve Docker Compose v2.
- Git, OpenSSL ve bir reverse proxy (Nginx, Caddy veya bulut load balancer).
- Web ve API için DNS kayıtları; örnek: `app.example.com` ve `api.example.com`.
- TLS sertifikası veya otomatik sertifika üreten bir reverse proxy.
- Production SMTP hesabı ve doğrulanmış gönderici adresi.
- OpenAI veya Anthropic production API anahtarı.
- Şifreli, sunucu dışı PostgreSQL yedekleme hedefi.
- İsteğe bağlı OTLP uyumlu log/trace izleme servisi.

Sunucuda yalnızca `80/tcp` ve `443/tcp` dışarıya açık olmalıdır. SSH erişimini yönetim ağınızla sınırlandırın; `3000`, `4000`, `5432`, `55435` ve `6379` portlarını internete açmayın.

## 3. Docker kurulumu

Docker'ı işletim sisteminizin resmi Docker Engine kurulum rehberine göre kurun. Ardından doğrulayın:

```bash
docker version
docker compose version
git --version
openssl version
```

Docker servisinin açılışta başlamasını etkinleştirin:

```bash
sudo systemctl enable --now docker
```

## 4. Kaynak kodunu kurma

Production'da doğrulanmış bir release tag veya sabit commit kullanın; hareketli bir branch'i doğrudan deploy etmeyin.

```bash
sudo mkdir -p /opt/promptlens
sudo chown "$USER":"$USER" /opt/promptlens
git clone https://github.com/riadosman/promptlens_v2.git /opt/promptlens
cd /opt/promptlens
git checkout <release-tag-or-commit>
```

## 5. Production environment dosyası

Önce güçlü ve birbirinden farklı secret değerleri üretin:

```bash
openssl rand -base64 48
openssl rand -base64 48
openssl rand -base64 48
openssl rand -base64 48
```

Repository kökünde `.env` oluşturun. Aşağıdaki örnekteki domain, parola, sağlayıcı ve SMTP değerlerini kendi ortamınıza göre değiştirin:

```dotenv
NODE_ENV=production
DEPLOYMENT_MODE=public
TRUST_PROXY=true

WEB_ORIGIN=https://app.example.com
PUBLIC_API_URL=https://api.example.com/v1
WEB_PORT=3000
API_PORT=4000
POSTGRES_PORT=55435

POSTGRES_PASSWORD=<unique-owner-secret>
POSTGRES_APP_PASSWORD=<unique-api-secret>
POSTGRES_WORKER_PASSWORD=<unique-worker-secret>
SESSION_HASH_SECRET=<minimum-32-character-unique-secret>

AI_PROVIDER=openai
AI_MODEL=<supported-production-model>
OPENAI_API_KEY=<provider-secret>
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=<supported-anthropic-model>
AI_TENANT_MONTHLY_TOKEN_BUDGET=1000000
AI_TENANT_REQUESTS_PER_MINUTE=60
AI_CIRCUIT_FAILURE_THRESHOLD=5

EMAIL_VERIFICATION_REQUIRED=true
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-user>
SMTP_PASSWORD=<smtp-password>
SMTP_FROM=PromptLens <noreply@example.com>

LOG_LEVEL=info
OTEL_EXPORTER_OTLP_ENDPOINT=
```

Anthropic kullanıyorsanız `AI_PROVIDER=anthropic` yapın ve `ANTHROPIC_API_KEY` değerini sağlayın. `.env` dosyasını yalnızca servis hesabının okuyabileceği şekilde koruyun:

```bash
chmod 600 .env
```

Mümkünse secret değerlerini düz metin dosyası yerine deployment platformunuzun secret manager hizmetinden sağlayın. `.env` dosyasını hiçbir zaman Git'e eklemeyin.

Önemli: `PUBLIC_API_URL` web image'ı oluşturulurken tarayıcı paketine gömülür. Domain değişirse web image'ını yeniden build edin.

## 6. DNS ve HTTPS reverse proxy

Her iki domainin DNS kaydını sunucunun public IP adresine yönlendirin. Reverse proxy şu hedeflere trafik iletmelidir:

| Public adres                   | İç hedef                |
| ------------------------------ | ----------------------- |
| `https://app.example.com`      | `http://127.0.0.1:3000` |
| `https://api.example.com`      | `http://127.0.0.1:4000` |
| `https://api.example.com/v1/*` | Yol değiştirilmeden API |

Proxy üzerinde şu başlıkları aktarın:

- `Host`
- `X-Forwarded-For`
- `X-Forwarded-Proto`
- `X-Real-IP`

HTTP isteklerini HTTPS'e yönlendirin. `WEB_ORIGIN` değeri tarayıcının kullandığı origin ile protokol dahil tam olarak aynı olmalıdır.

## 7. Veritabanı migration ve ilk başlatma

Repository kökünde çalıştırın:

```bash
cd /opt/promptlens

docker compose \
  -p promptlens-platform \
  --env-file .env \
  -f infra/compose/compose.full.yaml \
  up -d postgres redis

docker compose \
  -p promptlens-platform \
  --env-file .env \
  -f infra/compose/compose.full.yaml \
  --profile tools run --rm migrate

docker compose \
  -p promptlens-platform \
  --env-file .env \
  -f infra/compose/compose.full.yaml \
  up -d --build --wait api worker web
```

`DEPLOYMENT_MODE=public` güvenli olmayan origin, proxy, e-posta ve session yapılandırmalarında API'nin başlamasını engeller. Başlatma başarısızsa önce API loglarını inceleyin.

## 8. Kurulum doğrulaması

Sunucu üzerinde:

```bash
curl --fail http://127.0.0.1:4000/v1/health/live
curl --fail http://127.0.0.1:4000/v1/health/ready
curl --fail http://127.0.0.1:3000

docker compose \
  -p promptlens-platform \
  --env-file .env \
  -f infra/compose/compose.full.yaml \
  ps
```

Reverse proxy sonrasında dışarıdan:

```bash
curl --fail https://api.example.com/v1/health/live
curl --fail https://api.example.com/v1/health/ready
curl --fail https://app.example.com
```

Readiness yanıtında PostgreSQL, Redis ve worker kontrollerinin `ok` olması gerekir.

## 9. İlk kullanıcı ve fonksiyon kontrolü

1. `https://app.example.com/register` adresinden ilk hesabı oluşturun.
2. SMTP üzerinden doğrulama e-postasının ulaştığını ve bağlantının doğru domaine gittiğini kontrol edin.
3. İlk kullanıcının workspace owner ve instance administrator yetkilerini doğrulayın.
4. Bir proje oluşturun.
5. `/connect` üzerinden bir connector bağlayın.
6. Test prompt'u gönderin ve worker analizinin dashboard'a geldiğini doğrulayın.
7. Parola sıfırlama e-postasını test edin.

## 10. Log, izleme ve alarm

Canlı logları görüntülemek için:

```bash
docker compose \
  -p promptlens-platform \
  --env-file .env \
  -f infra/compose/compose.full.yaml \
  logs -f --tail=200 api worker web
```

En az şu alarmları kurun:

- `/v1/health/ready` başarısız veya 5xx cevap veriyor.
- API hata oranı ve yanıt süresi yükseliyor.
- Worker heartbeat kayboluyor veya kuyruk büyüyor.
- PostgreSQL disk alanı kritik seviyeye geliyor.
- Redis ya da PostgreSQL yeniden başlıyor.
- SMTP teslimat hataları artıyor.
- AI sağlayıcısında kota, rate-limit veya authentication hatası oluşuyor.

OTLP kullanıyorsanız `OTEL_EXPORTER_OTLP_ENDPOINT` değerini sağlayıp servisleri yeniden oluşturun.

## 11. Yedekleme ve geri yükleme

Her gün PostgreSQL yedeği alın, yedeği şifreleyin ve farklı bir sistem/bölgede saklayın. Repository'nin yedekleme komutu:

```bash
cd /opt/promptlens
./promptlens backup
```

Bu komutu cron veya systemd timer ile otomatikleştirin. Saklama süresini veri politikanıza göre belirleyin ve eski yedekleri kontrollü biçimde temizleyin.

Yalnızca yedek dosyasının oluşması yeterli değildir. Düzenli olarak izole bir veritabanına geri yükleme denemesi yapın:

```bash
pnpm restore:drill
```

## 12. Güncelleme akışı

Her güncellemeden önce yedek alın ve release notlarını okuyun:

```bash
cd /opt/promptlens
./promptlens backup
git fetch --tags origin
git checkout <new-release-tag-or-commit>

docker compose \
  -p promptlens-platform \
  --env-file .env \
  -f infra/compose/compose.full.yaml \
  build

docker compose \
  -p promptlens-platform \
  --env-file .env \
  -f infra/compose/compose.full.yaml \
  --profile tools run --rm migrate

docker compose \
  -p promptlens-platform \
  --env-file .env \
  -f infra/compose/compose.full.yaml \
  up -d --wait
```

Ardından health check'leri ve temel kullanıcı akışını tekrar doğrulayın.

## 13. Rollback yaklaşımı

Uygulama rollback'i için önceki doğrulanmış tag veya commit'e dönüp image'ları yeniden oluşturun. Migration uygulanmışsa eski uygulama sürümünün yeni şemayla uyumlu olduğunu release notlarından doğrulamadan kod rollback'i yapmayın. Şema uyumsuzsa bakım penceresi açın ve doğrulanmış yedekten geri yükleyin.

## 14. Production açılış kontrol listesi

- [ ] Sabit release tag veya commit deploy edildi.
- [ ] `DEPLOYMENT_MODE=public` ve `TRUST_PROXY=true`.
- [ ] Web ve API domainleri HTTPS üzerinden çalışıyor.
- [ ] `WEB_ORIGIN` ve `PUBLIC_API_URL` gerçek domainlerle eşleşiyor.
- [ ] PostgreSQL, API, worker ve session secret değerleri benzersiz.
- [ ] Gerçek AI sağlayıcısı ve tenant limitleri yapılandırıldı.
- [ ] E-posta doğrulaması açık; kayıt ve parola sıfırlama e-postaları test edildi.
- [ ] PostgreSQL/Redis portları internete kapalı.
- [ ] Migration başarıyla tamamlandı.
- [ ] Liveness ve readiness kontrolleri başarılı.
- [ ] Merkezi log, metrik ve alarm kuralları çalışıyor.
- [ ] Otomatik şifreli yedek ve geri yükleme denemesi doğrulandı.
- [ ] Güncelleme ve rollback sorumluları belirlendi.

## Operasyon komutları

```bash
./promptlens start
./promptlens status
./promptlens logs
./promptlens doctor
./promptlens backup
./promptlens upgrade
./promptlens stop
```

`stop` konteynerleri durdurur; PostgreSQL ve Redis named volume'larını silmez.
