# PromptLens NVIDIA Admin Yapılandırması

Bu dosya, PromptLens'te NVIDIA API Catalog anahtarı kullanmak için yönetici olarak yapmanız gereken işlemleri sırasıyla içerir.

## 1. NVIDIA API anahtarı oluşturun

1. [NVIDIA API Catalog](https://build.nvidia.com/) adresinde NVIDIA hesabınızla oturum açın.
2. Kullanmak istediğiniz metin modelini açın.
3. **Generate API Key** seçeneğiyle bir anahtar oluşturun.
4. Anahtarı parola yöneticinize veya production secret manager hizmetinize kaydedin.

API anahtarını PromptLens Admin ekranına, Git'e, issue'ya veya sohbet mesajına yazmayın. Anahtar yalnız sunucudaki secret store ya da `.env` içinde bulunmalıdır.

## 2. `.env` dosyasını düzenleyin

Proje kökündeki `C:\Users\riyad\Documents\colbrai\ideatoproject\promptlensv\.env` dosyasını açın:

```powershell
notepad .env
```

Aşağıdaki değerleri ekleyin veya mevcut değerleri değiştirin:

```dotenv
AI_PROVIDER=nvidia
AI_MODEL=meta/llama-3.1-70b-instruct
NVIDIA_API_KEY=<NVIDIA-API-KEY-BURAYA>
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
```

`<NVIDIA-API-KEY-BURAYA>` metnini gerçek anahtarınızla değiştirin; `<` ve `>` karakterlerini bırakmayın.

Model kimliği NVIDIA model sayfasındaki API örneğinde bulunan `model="..."` değeriyle birebir aynı olmalıdır. Başlangıç için yapılandırılmış çıktı örneklerinde kullanılan `meta/llama-3.1-70b-instruct` seçilebilir. Farklı bir model kullanacaksanız modelin Chat Completions ve structured JSON output desteklediğini doğrulayın.

## 3. Migration ve yeni image'ları çalıştırın

Normal PowerShell veya CMD terminalinde proje klasörüne geçin:

```powershell
cd C:\Users\riyad\Documents\colbrai\ideatoproject\promptlensv
```

NVIDIA provider veritabanı migration'ını uygulayın:

```powershell
docker compose -p promptlens-platform --env-file .env -f infra/compose/compose.full.yaml --profile tools run --rm --build migrate
```

API, worker ve web servislerini yeni kod ve environment değerleriyle yeniden oluşturun:

```powershell
docker compose -p promptlens-platform --env-file .env -f infra/compose/compose.full.yaml up -d --build --force-recreate --wait api worker web
```

## 4. Workspace Admin ayarını değiştirin

1. Tarayıcıda `http://localhost:3000/admin` adresini açın.
2. **Workspace settings** bölümüne gidin.
3. **AI provider** alanında **NVIDIA API Catalog** seçin.
4. **Model** alanına `.env` içindeki model kimliğini yazın:

   ```text
   meta/llama-3.1-70b-instruct
   ```

5. Aylık token bütçesini ihtiyacınıza göre ayarlayın.
6. Ayarları kaydedin.

Önemli: `.env` içindeki `AI_PROVIDER` worker'ın deployment varsayılanıdır. Gerçekte her workspace için kullanılacak provider ve model, Admin ekranındaki workspace ayarıdır. İki yerde de NVIDIA/model seçimini yapın.

## 5. Çalıştığını doğrulayın

Servis durumunu kontrol edin:

```powershell
docker compose -p promptlens-platform --env-file .env -f infra/compose/compose.full.yaml ps
```

Worker loglarını izleyin:

```powershell
docker compose -p promptlens-platform --env-file .env -f infra/compose/compose.full.yaml logs -f --tail=100 worker
```

Ardından PromptLens'e bir test prompt'u gönderin. Dashboard'da analiz sonucu oluşmalı ve analiz kaydının provider alanı `nvidia` olmalıdır.

## 6. Yaygın hatalar

### `NVIDIA_API_KEY is required`

- `.env` içinde `NVIDIA_API_KEY` satırının bulunduğunu kontrol edin.
- Worker'ı `--force-recreate` ile yeniden oluşturun.

### NVIDIA `401` veya `403`

- Anahtarın eksiksiz kopyalandığını kontrol edin.
- NVIDIA hesabında anahtarın aktif ve seçilen modele erişebilir olduğunu doğrulayın.
- Anahtarı yenilerseniz worker'ı yeniden oluşturun.

### NVIDIA `404` veya model bulunamadı

- Admin ekranındaki model kimliğiyle NVIDIA model sayfasındaki `model="..."` değerini karşılaştırın.
- Büyük/küçük harf ve provider prefix'i dahil tam kimliği kullanın.

### `PROVIDER_INVALID_RESPONSE`

- Seçilen model structured JSON output desteklemiyor olabilir.
- Structured output destekleyen başka bir NVIDIA Chat Completions modeli seçin.
- Worker loglarında HTTP durumunu kontrol edin; prompt içeriğini loglara kopyalamayın.

### Rate limit veya kota hatası

- NVIDIA hesabınızdaki kullanım/kota bilgisini kontrol edin.
- Admin ekranında aylık token bütçesini ve `.env` içindeki `AI_TENANT_REQUESTS_PER_MINUTE` değerini gözden geçirin.

## 7. Anahtar değiştirme

1. NVIDIA'da yeni anahtar oluşturun.
2. `.env` veya secret manager içindeki `NVIDIA_API_KEY` değerini değiştirin.
3. Worker'ı yeniden oluşturun.
4. Bir test analizi çalıştırın.
5. Test başarılı olduktan sonra eski NVIDIA anahtarını iptal edin.

```powershell
docker compose -p promptlens-platform --env-file .env -f infra/compose/compose.full.yaml up -d --force-recreate worker
```

## Tamamlanma kontrolü

- [ ] NVIDIA API anahtarı oluşturuldu ve güvenli yerde saklandı.
- [ ] `.env` içinde `AI_PROVIDER=nvidia` ayarlandı.
- [ ] `.env` içinde `NVIDIA_API_KEY` ve `NVIDIA_BASE_URL` ayarlandı.
- [ ] Migration uygulandı.
- [ ] API, worker ve web yeniden build edildi.
- [ ] Admin ekranında NVIDIA provider ve model seçildi.
- [ ] Test prompt'u başarıyla analiz edildi.
- [ ] Worker loglarında authentication/model hatası yok.
