# PromptLens UX İnceleme Raporu

**Tarih:** 10 Ağustos 2026  
**Kapsam:** Landing, kimlik doğrulama, dashboard, prompt geçmişi/analizi, projeler, cihaz bağlama ve yönetim ekranları  
**Yöntem:** Arayüz bileşenleri, stiller, ürün/tasarım dokümanları, ekran prototipleri ve mevcut E2E/axe kontrolleri incelendi. Yerel web rotalarının HTTP 200 verdiği doğrulandı. Bu oturumda etkileşimli tarayıcı bağlantısı bulunmadığından görsel piksel, klavye ve gerçek cihaz kontrolleri ayrıca yapılmalıdır.  
**Değişiklik sınırı:** Uygulama koduna veya yapılandırmasına müdahale edilmedi; yalnızca bu rapor eklendi.

## Yönetici özeti

PromptLens; güven, veri kontrolü ve teknik ciddiyet açısından güçlü bir ürün temeline sahip. Arayüzde kalıcı form etiketleri, boş durum aksiyonları, skeleton yükleme yüzeyleri, URL'de korunan filtreler, rol bazlı içerik ve reduced-motion desteği gibi doğru kararlar var.

Ana UX açığı, ürünün en önemli vaadi ile günlük çalışma ekranının öncelikleri arasındaki farktır: kullanıcı “hangi promptu neden iyileştirmeliyim?” sorusunun cevabını dashboard açıldıktan sonra doğrudan alamıyor. Genel metrikler ve operasyonel bilgiler öne çıkarken düşük kaliteli promptlar, tekrar eden sorunlar ve önerilen sonraki adımlar geri planda kalıyor. Prompt analizi de tasarım dokümanında tarif edilen iki panelli workbench yerine liste satırı içinde genişliyor; bu, özellikle uzun prompt geçmişinde tarama ve karşılaştırma verimini düşürüyor.

En yüksek öncelikli dört konu:

1. Dashboard'u genel raporlama ekranından eylem merkezine dönüştürmek.
2. Prompt listesini kalıcı liste + detay paneli yapısına taşımak.
3. Mobil/tablet görünümünde workspace değişimini tekrar erişilebilir yapmak.
4. Sistem durumu ve kullanıcı işlemlerinde gerçek, güvenilir geri bildirim sağlamak.

## Genel değerlendirme

| Alan | Değerlendirme | Kısa yorum |
|---|---:|---|
| Değer önerisinin anlaşılırlığı | 4/5 | Landing mesajı net; güven ve self-hosting farkı görünür. |
| Bilgi mimarisi | 3/5 | Ana bölümler anlaşılır, ancak dashboard ve admin içerikleri görev önceliğini yeterince yansıtmıyor. |
| Temel görev verimliliği | 2/5 | Zayıf promptu bulma ve analizler arasında gezinme gereğinden fazla tarama istiyor. |
| Durum ve geri bildirim | 2/5 | Yükleme/boş/hata temelleri var; mutasyonlarda pending, başarı ve hata geri bildirimi eksik. |
| Mobil deneyim | 2/5 | Responsive düzen var, ancak workspace değişimi gizleniyor ve yatay nav keşfedilebilir değil. |
| Erişilebilirlik temeli | 4/5 | Semantik etiketler ve axe altyapısı iyi; güncel etkileşimli doğrulama açığı var. |
| Görsel tutarlılık | 3/5 | Uygulama içinde sistem tutarlı; güncel koyu/mor yön, onaylı açık/editoryal tasarım dokümanından ayrışıyor. |

## Önceliklendirilmiş bulgular

### P1 — Dashboard ürünün ana kararını desteklemiyor

**Gözlem:** Overview; ortalama kalite, toplam prompt, son 7 gün, tamamlanan analiz, skor trendi, model/proje dağılımı ve oturumları gösteriyor (`apps/web/components/dashboard-client.tsx:810-893`). Tasarım hedefinde ise ilk bakışta düşük kaliteli prompt sayısı, en büyük kalite kaybı nedenleri, bekleyen/başarısız analizler ve son promptlara hızlı geçiş bekleniyor (`docs/superpowers/specs/2026-08-04-editorial-intelligence-ui-design.md:36-48`).

**Etkisi:** Kullanıcı veri görüyor ama ne yapacağını anlamak için Prompt log'a geçip tekrar filtreleme yapmak zorunda kalıyor. “10 saniye içinde müdahale edilecek promptu anlama” başarı ölçütü karşılanmıyor.

**Öneri:** İlk ekranın üst bölümünü şu sıraya getirin:

- “İlgilenmen gereken promptlar” sayısı ve doğrudan filtrelenmiş liste bağlantısı.
- En sık görülen 3 zayıflık ve etkilenen prompt sayısı.
- Başarısız/bekleyen analizler için ayrı aksiyon.
- Son düşük skorlu promptlar: skor, proje, kısa gerekçe ve “İncele” aksiyonu.
- Genel kullanım ve güvenlik metriklerini ikincil bölüme taşıma.

**Kabul ölçütü:** Kullanıcı, overview ekranında 10 saniye içinde en öncelikli promptu ve nedenini söyleyebilmeli; tek tıkla ilgili analize ulaşabilmeli.

### P1 — Prompt analizi gerçek bir workbench değil

**Gözlem:** Seçilen promptun analizi aynı kartın içinde aşağı doğru açılıyor (`apps/web/components/dashboard-client.tsx:1032-1151`). Oysa tasarım kararı, solda konumu korunan filtrelenebilir liste ve sağda kalıcı detay paneli öngörüyor.

**Etkisi:** Uzun içerik listeyi iter; kullanıcı promptlar arasında karşılaştırma yaparken bağlam ve kaydırma konumu kaybeder. Çok sayıda promptta tarama maliyeti büyür.

**Öneri:** Masaüstünde yaklaşık %38 liste / %62 detay düzeni; mobilde liste → detay geçişi ve görünür geri dönüş kontrolü kullanın. Seçim URL'de zaten saklanıyor (`promptId`); bu güçlü altyapı korunabilir.

**Kabul ölçütü:** Kullanıcı art arda beş promptu, liste konumu ve filtreleri bozulmadan inceleyebilmeli.

### P1 — Workspace değişimi 1100 px altında kayboluyor

**Gözlem:** Sidebar'daki tenant ve workspace switch alanları `max-width: 1100px` altında tamamen gizleniyor (`apps/web/app/styles.css:3372-3375`). Alternatif bir mobil seçici görünmüyor.

**Etkisi:** Birden fazla workspace'i olan tablet/mobil kullanıcı, aktif bağlamı göremez veya değiştiremez. Yanlış workspace'te işlem yapma riski ve masaüstüne bağımlılık doğar.

**Öneri:** Mobil üst barda aktif workspace adı + açılır seçici sunun. Workspace değişiminden önce hedef adı açıkça gösterin; değişim sonrası yeni bağlamı görünür bir durum mesajıyla doğrulayın.

**Kabul ölçütü:** 390 px, 768 px ve 1024 px genişliklerde aktif workspace görülebilmeli ve klavyeyle değiştirilebilmeli.

### P1 — “Systems operational” gerçek duruma bağlı değil

**Gözlem:** Dashboard başlığında “Systems operational” sabit metin olarak render ediliyor (`apps/web/components/dashboard-client.tsx:787-790`); aynı ekranda API hatası oluşsa bile bu ifade kalabilir.

**Etkisi:** Güven ve operasyonel doğruluk iddiası zarar görür. Özellikle self-hosted üründe yanlış olumlu durum göstergesi ciddi bir güven problemi yaratır.

**Öneri:** Bu göstergeyi readiness/health verisine bağlayın veya doğrulanmış veri yoksa kaldırın. Durumlar “Kontrol ediliyor / Çalışıyor / Kısmi sorun / Ulaşılamıyor” gibi metin + ikonla verilmelidir.

**Kabul ölçütü:** API yükleme hatasında ekran hiçbir zaman “operational” göstermemeli.

### P1 — İşlem geri bildirimi ve hata toparlama tutarsız

**Gözlem:** Giriş formunda pending durumu var; fakat proje oluşturma, arşivleme, yeniden analiz, cihaz bağlama ve birçok admin işleminde butona özel pending/başarı/hata durumu yok. Bazı async çağrılar doğrudan `await` ediliyor ve kullanıcıya yerel hata mesajı üretmiyor (`dashboard-client.tsx:533-562, 609-628, 684-699`; `admin-client.tsx:128-238`; `connect-device.tsx:26-40`). Kopyalama aksiyonu da başarı veya hata bildirmiyor (`dashboard-client.tsx:1129-1140`).

**Etkisi:** Çift gönderim, işlemin gerçekleşip gerçekleşmediğinden emin olamama ve hata sonrası çıkmaz hissi oluşur.

**Öneri:** Her mutasyonda ilgili buton için pending/disabled durumu, kısa başarı mesajı ve aynı bağlamda tekrar deneme sunun. Kopyalamada “Kopyalandı” geri bildirimi verin. Başarılı oluşturma sonrası yeni öğeyi vurgulayın.

**Kabul ölçütü:** Ağ gecikmesi ve 4xx/5xx senaryolarında kullanıcı her zaman “işleniyor, tamamlandı veya başarısız” durumlarından birini görebilmeli.

### P1 — Filtreler “zayıf promptu bulma” amacıyla ters çalışıyor

**Gözlem:** Skor filtresi yalnızca “Minimum score” sunuyor (`dashboard-client.tsx:984-993`). Ürünün ana ihtiyacı düşük skorlu promptları bulmak olduğu için daha doğal kontrol maksimum skor veya kalite aralığıdır. Platform ve model serbest metin; mevcut değerlerden seçim veya öneri yok. Mobilde filtreler kapalıyken aktif filtre özeti görünmüyor. Ayrıca boş durumun “filtre var” kontrolünde `memberFilter` hesaba katılmıyor (`dashboard-client.tsx:1010-1027`).

**Etkisi:** Kullanıcı 60 altındaki promptları doğrudan isteyemez; geçerli filtreyi fark etmeyebilir. Admin yalnızca kullanıcı filtresiyle sıfır sonuç aldığında yanlış biçimde “Henüz prompt yok, cihaz bağla” mesajını görebilir.

**Öneri:** “Skor: 0–59 / 60–79 / 80–100 / Özel aralık” veya maksimum skor ekleyin. Platform/model için mevcut veri seçenekleri ve çoklu seçim kullanın. Uygulanan filtreleri chip olarak, sayı ile ve tek tek kaldırılabilir biçimde gösterin. Boş durum kararını tüm filtrelerden türetin.

**Kabul ölçütü:** Kullanıcı en fazla iki etkileşimle 60 altındaki promptları görebilmeli; aktif filtreler filtre paneli kapalıyken de anlaşılmalı.

### P2 — Proje ekranı karar vermek için gereken sinyalleri göstermiyor

**Gözlem:** Proje kartlarında ad, açıklama, durum ve güncellenme tarihi var (`dashboard-client.tsx:1191-1233`). Tasarımda beklenen prompt sayısı, ortalama skor ve son etkinlik sinyalleri eksik. Proje listesi boşsa özel bir onboarding/boş durum yok; yalnızca oluşturma formu kalıyor.

**Etkisi:** Admin hangi projenin ilgi istediğini anlayamaz; proje ekranı analiz giriş noktası yerine klasör listesine dönüşür.

**Öneri:** Her satırda prompt sayısı, ortalama skor, düşük skor sayısı ve son aktivite gösterin; soruna göre sıralama ekleyin. İlk proje için örnek isimler ve kısa açıklama sunan boş durum kullanın.

**Kabul ölçütü:** Admin en sorunlu projeyi yalnızca proje listesini okuyarak belirleyebilmeli.

### P2 — Mobil navigasyon çalışıyor ama keşfedilebilirliği düşük

**Gözlem:** Navigasyon yatay kaydırmalı, scrollbar gizli (`styles.css:3377-3390`). 430 px altında ikonlar da gizleniyor (`styles.css:3585-3592`). Menüde daha fazla öğe olduğuna dair görsel işaret veya açılır menü yok.

**Etkisi:** Sağda kalan “Connect device” veya “Administration” bağlantıları fark edilmeyebilir. Yeni kullanıcı önemli kurulum adımını kaçırabilir.

**Öneri:** Dört ana öğeyi koruyup kalanları “More” menüsüne alın veya görünür taşma işareti kullanın. Aktif öğeyi ilk görünür alana otomatik getirin.

**Kabul ölçütü:** 390 px genişlikte kullanıcı kaydırma gerektiğini tahmin etmeden tüm ana bölümlere ulaşabilmeli.

### P2 — Landing, tasarım anlatısından ve ürün demosundan uzaklaşmış

**Gözlem:** Güncel landing tekrar eden özellik kartları kullanıyor (`apps/web/app/page.tsx:111-138`); tasarım dokümanı ise ürün workbench sahnesi ve “Yakala → Anla → İyileştir” akışını istiyor, tekrar eden özellik kartlarını kapsam dışı bırakıyor. Mevcut terminal önizlemesi teknik olarak güçlü olsa da günlük iş akışını göstermiyor.

**Etkisi:** Teknik alıcı güven mesajını alıyor; ancak ekip lideri ürünün günlük kullanım değerini ve sonucu nasıl ürettiğini yeterince hızlı göremiyor.

**Öneri:** Hero sonrasında tek gerçek ürün akışı gösterin: prompt yakalandı → neden düşük olduğu açıklandı → iyileştirilmiş sürüm üretildi → projeye bağlandı. Özellik kartlarını azaltıp sonucu kanıtlayan ekran görüntüsü veya interaktif olmayan ürün sahnesi kullanın.

**Kabul ölçütü:** İlk kez gelen bir kişi 15 saniye içinde “girdi nedir, ürün ne yapar, çıktı nedir?” sorularını cevaplayabilmeli.

### P2 — Auth ekranları güvenli ama ürün bağlamı zayıf

**Gözlem:** Giriş ve kayıt tek merkez kart düzeninde. Tasarım dokümanında marka/değer alanı + form alanı şeklinde iki parçalı yapı öngörülmüş. Kayıtta 12 karakter gereksinimi kodda var (`auth-form.tsx:75`), fakat kullanıcı yazmadan önce kural görünmüyor.

**Etkisi:** Kayıt anında ürün farklılaşması azalıyor; parola hatası gereksiz deneme-yanılmaya yol açabilir.

**Öneri:** Form yanında kısa ürün sonucu veya güven kanıtı gösterin. Parola gereksinimini alan altında başlangıçtan itibaren açıklayın; gönderim sonrası yalnız genel API metni yerine mümkünse alan düzeyinde hata eşleyin.

**Kabul ölçütü:** Kullanıcı gönderime basmadan önce parola koşulunu bilmeli; kayıt sırasında workspace kavramının ne olduğunu anlayabilmeli.

### P2 — E2E/erişilebilirlik güvenlik ağı güncel arayüzle kaymış

**Gözlem:** E2E testi dashboard'da “Prompt overview” ve projede “New project name” placeholder'ını arıyor (`tests/e2e/critical-flow.spec.ts:29,36`); güncel UI “Workspace overview” ve kalıcı “Project name” etiketi kullanıyor (`dashboard-client.tsx:726-731, 1243-1247`). Axe yalnız kritik akışta üç sayfada çalıştırılıyor ve güncel responsive/focus davranışlarını kapsamıyor.

**Etkisi:** Test başarısız olabilir veya güncellenmeden devre dışı kalabilir; ekip erişilebilirlik güvencesine olduğundan fazla güvenebilir.

**Öneri:** Testleri güncel erişilebilir adlara göre yenileyin; 390/768/geniş ekran, klavye sırası, focus-visible, açılır mobil filtre, workspace seçici, boş/hata durumları ve reduced-motion kontrollerini ekleyin.

**Kabul ölçütü:** Kritik akış testi güncel UI ile geçmeli; ana akışlar sadece fareyle değil klavyeyle de tamamlanmalı.

### P3 — Bilgi dili ve formatlar hedef pazara göre netleştirilmeli

**Gözlem:** Arayüz tamamen İngilizce ve tarihler bazı yerlerde `en-US`, bazı yerlerde tarayıcı varsayılanı ile formatlanıyor. “Tenant”, “workspace”, “project”, “connector”, “device” kavramları farklı teknik seviyelerde kullanıcılar için açıklamasız kalabiliyor.

**Etkisi:** Türkçe hedef kitle varsa benimseme düşer; İngilizce hedefte bile kavram tutarsızlığı öğrenme maliyeti yaratır.

**Öneri:** Hedef dili ürün kararı olarak netleştirin. Tek bir sözlük oluşturun; kullanıcı arayüzünde “workspace” terimini koruyup “tenant”ı yalnız teknik/admin bağlamında kullanın. Tarih/saatleri tek locale ve timezone politikasıyla gösterin.

## Güçlü yönler

- Ana navigasyon ve sayfa hiyerarşisi basit; Overview, Prompt log, Projects, Connect device ve Administration ayrımı anlaşılır.
- Filtre ve seçili prompt durumunun URL'de saklanması geri/ileri gezinme ve paylaşılabilir bağlantılar için doğru temel oluşturuyor.
- Form alanlarında kalıcı label kullanımı yaygın; hata/status bölgelerinde `role="alert"` ve `role="status"` kullanılmış.
- Mobil kırılımlar, yatay taşma yönetimi ve `prefers-reduced-motion` desteği mevcut (`styles.css:1949-1956`).
- Yükleme skeleton'ları ve prompt boş durumundaki “Clear filters / Connect a device” aksiyonları kullanıcıyı çıkmazda bırakmıyor.
- Rol bazlı kişi filtresi ve sunucu kapsamı yaklaşımı güvenli UX ile yetkilendirme modelini uyumlu tutuyor.
- Landing sayfasındaki self-hosted, open-source ve multi-tenant mesajı ürünün farklılaşmasını net anlatıyor.

## Önerilen uygulama sırası

### 0–2 gün: düşük efor, yüksek güven kazanımı

1. Sabit “Systems operational” göstergesini kaldırın veya gerçek health verisine bağlayın.
2. Aktif filtre chip'leri, filtre sayısı ve doğru boş durum mantığını ekleyin.
3. Kopyalama, proje oluşturma, cihaz bağlama ve admin işlemlerine pending/başarı/hata durumu ekleyin.
4. E2E locator drift'ini giderin ve güncel axe kontrollerini çalıştırın.
5. Parola gereksinimini kayıt alanının altında görünür yapın.

### 1–2 hafta: ana kullanım akışını düzeltme

1. Prompt ekranını liste + detay workbench yapısına dönüştürün.
2. Overview'a “İlgilenmen gerekenler”, temel zayıflık nedenleri ve başarısız analizler ekleyin.
3. Maksimum skor/kalite aralığı ve seçilebilir model/platform filtreleri ekleyin.
4. Mobil workspace switch ve keşfedilebilir navigasyon çözümünü tamamlayın.
5. Proje satırlarına kalite ve aktivite sinyalleri ekleyin.

### 2–4 hafta: ürün anlatısı ve öğrenme

1. Landing'i gerçek ürün akışı üzerinden yeniden kurgulayın.
2. Auth ekranlarına ürün bağlamı ve alan düzeyinde yardım ekleyin.
3. 5 kullanıcıyla görev bazlı test yapın: ilk zayıf promptu bulma, iyileştirilmiş promptu kopyalama, proje filtreleme, cihaz bağlama ve workspace değiştirme.

## Ölçüm planı

- **Time to first actionable prompt:** Dashboard açılışından ilk analiz görüntülemeye kadar medyan süre.
- **Analysis-to-copy rate:** Analiz görüntüleyenlerin geliştirilmiş promptu kopyalama oranı.
- **Filter success rate:** Filtre uygulayan oturumlarda sonuç açma oranı ve sıfır sonuç oranı.
- **Connector completion rate:** Cihaz kodu ekranından başarılı bağlamaya dönüşüm.
- **Project activation:** Oluşturulan projelerin 24 saat içinde en az bir prompt alması.
- **Recovery rate:** API/mutasyon hatası gören kullanıcıların aynı görevde başarıya ulaşma oranı.

## Canlı doğrulama kontrol listesi

Bu raporun ardından aşağıdaki manuel oturum yapılmalıdır:

- 390 px, 768 px, 1024 px ve geniş masaüstü.
- Sadece klavye ile landing → kayıt → proje → cihaz bağlama → prompt analizi.
- %200 zoom, Windows High Contrast ve reduced-motion.
- Uzun workspace/proje/model adları; 100+ prompt; boş, gecikmiş ve başarısız analiz durumları.
- Yavaş ağ, API 401/403/429/500 ve kopyalama izni hatası.
- Owner, member, viewer ve instance admin rolleri.

## Sonuç

PromptLens'in UX temeli zayıf değil; asıl sorun, mevcut güçlü bileşenlerin ürünün ana karar anına göre sıralanmamış olmasıdır. En büyük kazanım yeni bir görsel tema üretmekten değil, kullanıcıya “şimdi neyi düzeltmeliyim ve neden?” sorusunun cevabını overview ve workbench içinde daha kısa yoldan vermekten gelecektir.
