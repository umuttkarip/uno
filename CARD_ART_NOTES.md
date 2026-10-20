# Kart çizimleri · 5.0

Klasik deste korunur. Kediler, Fok, Kuromi ve Adventure Time temalarının her birinde 24 farklı sayı sahnesi, iki engel, iki yön değiştirme, bir +2, bir renk değiştirme, bir +4 ve bir kart arkası olmak üzere 32 çizim vardır. Aynı renkteki çift sayı kartları farklı sahneler kullanır. Dört rengin ve 108 kartın anlamı değişmez; köşelerdeki semboller SVG olarak net kalır, 6/9 alt çizgilidir. Kapalı kartların arkası eldeki değere göre değişmez.

Kedi kadrosu gri tekir, sarman, smokin ve üç renkli kedilerden oluşur; hareketleri ve gövdeleri kedi anatomisini koruyan 2B hikâye kitabı çizimleridir. Fok, kullanıcının özgün üçgen gövdeli, küçük kollu ve karalama gözlü çıkartmasına dayanır. Kuromi siyah/pembe/leylak; Adventure Time Ooo karakterleriyle tutarlı 2B çizim dilindedir. Her özel kart sahnesi kendi eylemine göre tasarlanmıştır. Bunlar bu proje için üretilen hayran çizimleridir; resmî lisanslı kart taramaları kullanılmamıştır.

## Onay durumu

Masa ve kart tasarımları ayrı ayrı manuel kullanıcı onayı bekliyor. Canlı sürümde kapalıdır; public/release-policy.js iki onay değerini false tutar. `npm run preview:design` ile http://localhost:4176/uno/ üzerinde denenir. Normal GitHub Pages derlemesi kart atlaslarını içermez.

## Dosyalar ve üretim

Çizimler yerleşik image_gen aracıyla, iki adet 4×4 saydam PNG atlası olarak üretildi. Tam komutlar [CARD_ART_PROMPTS.md](CARD_ART_PROMPTS.md) dosyasındadır. Projedeki yüksek çözünürlüklü kaynaklar app/.local/card-art-source/{cats,seal,kuromi,adventure}-{a,b}.png; üretim manifesti aynı klasörde prompts.json. Aracın varsayılan generated_images çıktıları da korunmuştur. scripts/prepare-card-art.py, Pillow ile hücre ayırma, komşu hücre artıklarını dışlama, boşluk düzenleme, küçültme ve WebP sıkıştırmasını tekrarlar; yaratıcı çizimleri yeniden üretmez. Kaynak PNG dosyaları yayımlanmaz.

Oyunun kullandığı son dosyalar app/public/assets/cards/{cats,seal,kuromi,adventure}-{a,b}.webp ve aynı klasörde {cats,seal,kuromi,adventure}-cover.webp. Atlaslar 576×576, hücreler 144×144, küçük seçim görselleri 112×112 pikseldir. Saydamlık korunur. İki atlas ve kapak dahil toplamlar: Kediler 146.132 B; Fok 125.652 B; Kuromi 170.988 B; Adventure Time 152.990 B. Deste başına 220 KB sınırı test edilir.

Klasik destede atlas indirilmez. Seçim paneli açılınca yalnız dört küçük kapak gelir; tam atlaslar sadece seçilen tema için yüklenir ve tarayıcı önbelleğinde yeniden kullanılır. Seçim her cihazda kişiseldir, kart resimleri WebRTC üzerinden aktarılmaz. Tema değişimi elin kart düğümlerini ve oyun durumunu korur; uçuş sürüyorsa yeniden çizim iniş sonrasına ertelenir.

Tasarım araştırması: [Bicycle Kuromi](https://store.asmodee.com/products/bicycle-kuromi) ve [Sanrio Kuromi](https://corporate.sanrio.co.jp/en/business-info/brands/kuromi/index.html). Kopyalanan ürün görseli yoktur. Önizleme kanıtı app/.local/uno-deck-collection.png; telefon kanıtı app/.local/uno-themes-mobile.png.
