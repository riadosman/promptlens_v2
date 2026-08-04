# PromptLens Editorial Intelligence UI Tasarımı

Tarih: 2026-08-04

## Amaç

PromptLens'in dashboard, prompt, proje, landing ve kimlik doğrulama ekranlarını tek bir modern tasarım sisteminde birleştirmek. Arayüz yalnızca istatistik göstermemeli; kullanıcıya hangi promptu neden iyileştirmesi gerektiğini, admin'e ise sorunların hangi kişi ve projelerde yoğunlaştığını göstermelidir.

## Kapsam

- Kullanıcı ve tenant admin dashboard'ları
- Prompt çalışma alanı
- Proje görünümü ve proje işlemleri
- Tenant seçimi ve rol bazlı görünürlük
- Public landing sayfası
- Giriş, kayıt, şifre kurtarma ve şifre sıfırlama ekranları
- Yüklenme, boş sonuç, hata ve responsive durumları

Bu çalışma mevcut API sözleşmelerini ve kimlik doğrulama modelini kullanır. Yeni state kütüphanesi, grafik kütüphanesi veya UI framework'ü eklenmez.

## Tasarım yönü

Tasarımın adı **Editorial Intelligence**'dır.

- Ana zemin: sıcak kırık beyaz (`#F8F5EF`)
- Ana iskelet ve metin: siyah (`#171717`)
- Birincil aksiyon ve aktif seçim: asit yeşili (`#D9FF3F`)
- Dikkat gerektiren zayıf promptlar: turuncu (`#FF7046`)
- Tipografi: Poppins; başlıklar 700-900, metinler 400-500, kontroller ve metrikler 700-900
- Bileşen karakteri: ince siyah çizgiler, düşük köşe yuvarlaklığı, güçlü boşluk ve tipografi hiyerarşisi
- Parıltı: yalnızca landing ürün sahnesi ve sınırlı marka vurgularında; dashboard veri yüzeylerinde kullanılmaz
- Glassmorphism, yaygın gradient kullanımı, neon kart yığınları ve ağır gölgeler kullanılmaz

Poppins, mevcut Next.js altyapısının font özelliğiyle yüklenir; yeni paket eklenmez.

## Uygulama kabuğu ve navigasyon

- Masaüstünde solda sabit, siyah ve kompakt sidebar bulunur.
- Sidebar; aktif tenant, Overview, Prompts, Projects ve yetkiye bağlı admin bağlantılarını içerir.
- Aktif bağlantı asit yeşiliyle belirtilir; renk tek başına durum göstergesi olmaz.
- Tenant değişimi mevcut tenant switch endpoint'ini çağırır ve ekran yeni doğrulanmış bağlamla yeniden yüklenir.
- Mobilde sidebar, üst bara ve açılır navigasyona dönüşür.

## Rol bazlı ana sayfa

### Kullanıcı

İlk bakışta kişisel aksiyonlar gösterilir:

- İlgilenilmesi gereken zayıf prompt sayısı
- En büyük kalite kaybı nedenleri
- Kişisel skor ve haftalık değişim
- Bekleyen veya başarısız analizler
- Son promptlara hızlı geçiş

Kullanıcı sorguları sunucu tarafındaki doğrulanmış kullanıcı kimliğiyle yalnızca kendi promptlarına sınırlandırılır.

### Tenant owner/admin

Kullanıcı aksiyonlarına ek olarak tenant içi karşılaştırmalar gösterilir:

- Kişi bazlı ortalama skor ve prompt sayısı
- Proje bazlı performans
- Zayıf promptların kişi ve projelere dağılımı
- Kişi ve proje filtreleriyle promptlara geçiş

Admin promptları kişi ve proje bazında inceleyebilir. Filtreler birlikte çalışır.

### Instance superadmin

Superadmin görünümü tenant, kullanıcı, proje ve prompt istatistiklerini tenant filtresiyle sunar. Prompt içeriği yalnızca sunucunun açıkça yetkilendirdiği ve audit edilebilir endpoint verisiyle gösterilir; istemci tarafında tenant kapsamı aşılmaz veya tahmin edilmez.

## Prompt çalışma alanı

Seçilen yaklaşım **Editorial Workbench**'tir.

- Sol panel: kompakt, filtrelenebilir prompt listesi
- Sağ panel: seçilen promptun ayrıntılı analizi
- Prompt seçimi tam sayfa geçişi yapmadan sağ paneli günceller
- Liste konumu ve filtreler seçim sırasında korunur
- Masaüstünde iki panel yan yana, mobilde liste ve detay sıralı gösterilir

Sağ analiz paneli şu sırayı kullanır:

1. Skor ve analiz durumu
2. Prompt metni ve proje/kullanıcı/model bilgisi
3. Güçlü yönler ve eksikler
4. Numaralı iyileştirme önerileri
5. Geliştirilmiş prompt

Filtreler: arama, kişi, proje, platform, model ve minimum skor. Yetkisiz roller için kişi filtresi hiç render edilmez.

## Proje görünümü

- Projeler tekrar eden dekoratif kartlar yerine kompakt editoryal kayıtlar olarak gösterilir.
- Her kayıt isim, açıklama, durum, prompt sayısı, ortalama skor ve son etkinliği gösterir.
- Proje seçimi Prompt Workbench'i hazır proje filtresiyle açar.
- Yeni proje oluşturma ve arşivleme mevcut endpointleri kullanır.
- Arşivlenmiş proje görsel olarak ayrılır ancak erişilebilir kontrast korunur.

## Veri ve etkileşim akışı

1. `/auth/session` kullanıcı, rol, aktif tenant ve session bağlamını sağlar.
2. Tenant seçimi doğrulanmış switch endpoint'i üzerinden yapılır.
3. Kullanıcı görünümü `mine=true` kapsamını, tenant admin görünümü izin verilen kişi/proje filtrelerini kullanır.
4. İstatistikler, projeler ve promptlar mevcut endpointlerden yüklenir.
5. Prompt seçimi yerel görünüm durumunu değiştirir; güvenlik kapsamını değiştirmez.

Filtreler URL query parametrelerinde tutulur. Böylece yenileme, geri/ileri navigasyonu ve filtrelenmiş bağlantı paylaşımı seçimleri korur. Tenant ve rol kapsamı query parametrelerinden değil doğrulanmış oturumdan gelir.

## Public landing: Narrative Glow

Landing, seçilen iki yönün birleşimidir:

- Narrative Canvas'ın asimetrik Poppins başlıkları ve akışkan hikâyesi
- Product Stage'in koyu ürün sahnesi, asit yeşili parıltısı ve yüzen metrik etiketleri

Sayfa sırası:

1. Kompakt navigasyon ve tek ana CTA
2. Büyük asimetrik değer önerisi
3. Koyu sahnede Editorial Workbench ürün görünümü
4. `Yakala → Anla → İyileştir` şeklinde üç adımlı metin akışı
5. Tek final CTA

Tekrarlayan özellik kartları, fiyatlandırma, testimonial, blog veya müşteri logosu bölümleri bu kapsamda eklenmez. Mevcut ürün vaadi gerçek özelliklerle anlatılır.

## Kimlik doğrulama ekranları

Giriş, kayıt, şifre kurtarma ve sıfırlama aynı iki bölümlü yapıyı paylaşır:

- Sol: koyu marka alanı, kısa ürün mesajı ve küçük ürün metriği
- Sağ: açık zeminde form, net başlık ve yardımcı bağlantılar

Form davranışı ve doğrulama mantığı değişmez. Hata mesajları ilgili alanın yakınında ve okunabilir kontrastta gösterilir.

## Durumlar ve hata yönetimi

- Yüklenme: yerleşimi koruyan sade skeleton yüzeyleri
- Boş sonuç: bağlama göre filtreleri temizleme veya ilk projeyi oluşturma aksiyonu
- API hatası: mevcut içerik korunur, kısa açıklama ve yeniden deneme aksiyonu gösterilir
- Yetkisiz oturum: mevcut auth akışıyla login sayfasına yönlendirilir
- Analiz bekliyor/başarısız: prompt satırında durum etiketi ve uygun aksiyon gösterilir

Turuncu hata yüzeylerinde metin `#171717` olur. Durumlar yalnızca renkle ifade edilmez; metin ve ikon/etiket birlikte kullanılır.

## Responsive ve erişilebilirlik

- Ana kırılımlar mevcut uygulamayla uyumlu olarak mobil, tablet ve masaüstünü kapsar.
- Workbench mobilde tek sütuna iner; seçili analiz listeden sonra görünür.
- Navigasyon, filtreler ve prompt seçimi klavyeyle kullanılabilir.
- Görünür focus stilleri korunur.
- Form alanlarında kalıcı label bulunur.
- `prefers-reduced-motion` etkin olduğunda animasyon ve parıltılı geçişler durdurulur.
- Metin ve durum renkleri erişilebilir kontrastta tutulur.

## Doğrulama

Uygulama tamamlandığında en küçük yeterli doğrulama seti çalıştırılır:

- TypeScript kontrolü
- Mevcut testler içinde değişen akışları kapsayan ilgili kontroller
- Mock modunda kullanıcı ve owner/admin görünümü
- Tenant geçişi ve kişi/proje filtrelerinin doğru query üretmesi
- Prompt seçimi, boş sonuç, API hatası ve auth yönlendirmesi
- 390 px, 768 px ve geniş masaüstü görünüm kontrolü
- Klavye navigasyonu, focus görünürlüğü ve reduced-motion kontrolü

Yeni test framework'ü eklenmez. Tenant güvenliği yalnızca görsel testle kabul edilmez; mevcut backend authorization ve RLS kontrolleri korunur.

## Kapsam dışı

- Backend yetki modelini değiştirmek
- Yeni dashboard/chart kütüphanesi eklemek
- Pricing, billing, testimonial, blog veya CMS sayfaları
- Tema oluşturucu veya kullanıcıya özel renk seçenekleri
- Bu aşamada ayrı dark-mode sistemi

## Başarı ölçütleri

- Dashboard açıldığında kullanıcı 10 saniye içinde hangi promptlara müdahale etmesi gerektiğini anlayabilir.
- Admin sorunların hangi kişi ve projelerde yoğunlaştığını tek ekranda görebilir.
- Prompt listesinde hızlı tarama ile ayrıntılı analiz arasında sayfa değişmeden geçilebilir.
- Landing ve auth ekranlarından dashboard'a kadar tek tasarım dili korunur.
- Kullanıcı, tenant admin ve superadmin verileri yalnızca sunucunun yetkilendirdiği kapsamda gösterilir.
