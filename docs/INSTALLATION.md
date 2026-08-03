# PromptLens — Sıfırdan Kurulum Rehberi

Bu belge, PromptLens'i temiz bir bilgisayarda kurup çalıştırmak için adım adım kılavuzdur. Yerel kurulum Docker Compose ile yapılır; PostgreSQL, Redis ve MinIO'yu ayrıca kurmanız gerekmez.

## 1. Gereksinimler

| Gereksinim     | Sürüm                      | Not                          |
| -------------- | -------------------------- | ---------------------------- |
| Windows        | 10/11 + PowerShell         | promptlens.ps1 kullanılır    |
| macOS/Linux    | Güncel 64-bit              | ./promptlens kullanılır      |
| Node.js        | 22.23.x (>=22.14.0 <23)    | Connector derlemek için      |
| pnpm           | 10.14.x                    | Corepack ile etkinleştirilir |
| Docker Desktop | Docker Engine + Compose v2 | Docker açık olmalıdır        |
| Git            | 2.40+                      | Repository için              |

Docker servisleri: PostgreSQL 17 (veri), Redis 8 (kuyruk/rate limit), MinIO (S3 obje depolama), API, worker ve Next.js web.

Doğrulama:

```powershell
node --version
corepack --version
docker --version
docker compose version
git --version
```

## 2. Projeyi klonlama

```bash
git clone <repository-url> promptlens
cd promptlens
```

PowerShell:

```powershell
git clone <repository-url> promptlens
Set-Location promptlens
```

## 3. Ortam değişkenleri

### Önerilen tek komut

Installer ilk çalıştırmada .env oluşturur ve PostgreSQL, uygulama rolleri, oturum ve MinIO sırlarını üretir.

Windows:

```powershell
.\promptlens.ps1 install
```

macOS/Linux:

```bash
chmod +x ./promptlens
./promptlens install
```

### Manuel .env

```powershell
Copy-Item .env.example .env
```

Production-benzeri compose için güçlü ve benzersiz değerler zorunludur:

```dotenv
NODE_ENV=production
WEB_ORIGIN=http://localhost:3000
PUBLIC_API_URL=http://localhost:4000/v1
WEB_PORT=3000
API_PORT=4000
POSTGRES_PORT=55435
POSTGRES_PASSWORD=<owner-secret>
POSTGRES_APP_PASSWORD=<api-secret>
POSTGRES_WORKER_PASSWORD=<worker-secret>
SESSION_HASH_SECRET=<32-byte-random-secret>
S3_ACCESS_KEY=promptlens
S3_SECRET_KEY=<minio-secret>
AI_PROVIDER=fake
AI_MODEL=gpt-5.6-luna
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5
AI_TENANT_MONTHLY_TOKEN_BUDGET=1000000
AI_TENANT_REQUESTS_PER_MINUTE=60
AI_CIRCUIT_FAILURE_THRESHOLD=5
OTEL_EXPORTER_OTLP_ENDPOINT=
EMAIL_VERIFICATION_REQUIRED=false
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=PromptLens <noreply@localhost>
```

Değişken özeti:

- WEB_ORIGIN: API'nin izin verdiği web origin'i.
- PUBLIC_API_URL: tarayıcıya gömülen API adresi.
- WEB_PORT, API_PORT, POSTGRES_PORT: host portları.
- POSTGRES_*: owner, API ve worker için ayrı least-privilege sırlar.
- SESSION_HASH_SECRET: session hash anahtarı; kaybolursa oturumlar geçersizleşir.
- AI_PROVIDER: fake, openai veya anthropic; ilk kurulumda fake anahtar gerektirmez.
- OPENAI_API_KEY, ANTHROPIC_API_KEY: gerçek AI sağlayıcı anahtarları.
- AI_MODEL, ANTHROPIC_MODEL: analiz modelleri.
- AI_TENANT_MONTHLY_TOKEN_BUDGET, AI_TENANT_REQUESTS_PER_MINUTE: tenant limitleri.
- S3_*: MinIO/S3 erişimi.
- EMAIL_VERIFICATION_REQUIRED ve SMTP_*: doğrulama/parola sıfırlama e-postaları.

.env dosyasını commit etmeyin.

## 4. Bağımlılıkların kurulması

```bash
corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm install --frozen-lockfile
```

Installer connector seçildiğinde bu adımı otomatik yapar.

## 5. Veritabanının hazırlanması

Installer otomatik olarak PostgreSQL, Redis ve MinIO'yu başlatır, roller oluşturur ve migration'ları uygular. İlk kurulum seed gerektirmez; kullanıcı ve workspace web'den oluşturulur.

Manuel migration:

```bash
docker compose -p promptlens-platform --env-file .env -f infra/compose/compose.full.yaml --profile tools run --rm migrate
```

## 6. Geliştirme ortamını başlatma

Tek komut:

```powershell
.\promptlens.ps1 install
```

Sonraki çalıştırmalar:

```powershell
.\promptlens.ps1 start
.\promptlens.ps1 status
.\promptlens.ps1 logs
.\promptlens.ps1 stop
```

macOS/Linux'ta aynı komutları ./promptlens ile çalıştırın.

Kaynak geliştirme:

```bash
pnpm infra:up
pnpm dev
```

Adresler: web http://localhost:3000, API http://localhost:4000.

## 7. Doğrulama

Health endpoint'leri:

```bash
curl http://localhost:4000/v1/health/live
curl http://localhost:4000/v1/health/ready
```

Tarayıcı akışı:

1. /register üzerinden kullanıcı oluşturun.
2. /login ile giriş yapın.
3. Dashboard'da project oluşturun.
4. Connector cihazını /connect?code=... ile onaylayın.
5. Yeni prompt gönderin ve /dashboard > Prompt History bölümünü yenileyin.

Codex connector:

```bash
node connectors/codex/dist/cli.js status
```

authenticated: true beklenir. Codex CLI /hooks ekranında UserPromptSubmit Active: 1 olmalıdır. Bağlantıdan önceki promptlar retroaktif aktarılmaz.

## 8. Testler

Release öncesi:

```bash
pnpm validate
pnpm acceptance
pnpm e2e
pnpm security:secrets
pnpm security:rls
```

Sadece web:

```bash
pnpm --filter @promptlens/web lint
pnpm --filter @promptlens/web typecheck
pnpm --filter @promptlens/web test
```

## 9. Sık hatalar

- Docker çalışmıyor: Docker Desktop'ı açın; docker info çalışmalıdır.
- Port dolu: .env içindeki WEB_PORT, API_PORT veya POSTGRES_PORT değerlerini değiştirin.
- pnpm bulunamadı: corepack enable ve corepack prepare pnpm@10.14.0 --activate.
- API ready değil: docker compose logs api postgres redis ile logları kontrol edin.
- Web API'ye erişemiyor: PUBLIC_API_URL=http://localhost:4000/v1 olmalı; web image'ını yeniden build edin.
- Connector prompt yakalamıyor: yalnızca desteklenen CLI'de yeni prompt gönderin ve hook'u Active: 1 yapın.
- E-posta gelmiyor: yerelde EMAIL_VERIFICATION_REQUIRED=false; production'da SMTP ayarlayın.
- Veri silme: stop volume'ları silmez; down -v yalnızca açıkça yıkıcı yeniden kurulum istediğinizde kullanılmalıdır.

## 10. Proje yapısı ve mimari

```text
apps/api/               Fastify API, auth, RBAC, prompt ve admin endpoint'leri
apps/web/               Next.js kullanıcı ve admin panelleri
apps/worker/            Redis/BullMQ analiz worker'ı ve AI adaptörleri
connectors/sdk/         Connector protokolü, token yenileme ve offline queue
connectors/codex/       Codex UserPromptSubmit connector'ı
connectors/claude-code/ Claude Code connector'ı
packages/contracts/     Ortak API tipleri ve şemaları
packages/database/      Prisma schema, migration, RLS
infra/compose/           Geliştirme ve production-benzeri Compose
infra/postgres/          Least-privilege rol script'i
scripts/                 acceptance, security, SBOM ve restore araçları
docs/                    Mimari, güvenlik, SLO ve runbook'lar
```

Veri akışı: connector promptu idempotent local queue'ya yazar; API promptu tenant/project bağlamıyla transaction ve outbox kaydıyla saklar; Redis worker analiz eder; sonuç PostgreSQL'e yazılır; web dashboard API'den skoru, önerileri ve geliştirilmiş promptu gösterir. RLS ve tenant authorization workspace izolasyonunu korur.

## 11. Production geçişi

TLS reverse proxy kullanın, sırları secret manager'da tutun, gerçek AI provider ve SMTP yapılandırın, yedekleme/restore prosedürünü test edin. SECURITY.md ve RELEASE_READINESS.md belgelerini izleyin.
