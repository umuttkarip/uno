# UNO

İki oyuncu adını ve aynı masa adını yazar. Masa varsa katılır, yoksa oluşturulur; ikinci kişi gelince oyun başlar. Tek oyuncu varken “1 oyuncu daha bekleniyor” gösterilir. Kullanılmayan masalar 20 dakika sonra kapanır. Sohbet mesajları, 3B ifadeler ve dört fok çıkartması 5 saniye görünür. Giriş: https://umuttkarip.github.io/uno/

## Geliştirme

Node.js 22.13 veya üzeriyle `app` klasöründe `npm ci`, `npm run build`, `npm start` çalıştırılır. Yerel adres `http://localhost:4175/uno/`. `npm test` oyun ve oda kurallarını doğrular. Yayın `.github/workflows/pages.yml` ile GitHub Pages’e yapılır; Pages derleme kaynağı GitHub Actions olmalıdır.

GitHub Pages statik dosyaları sunar. Tarayıcılar PeerJS Cloud üzerinden birbirini bulur, WebRTC veri kanalıyla bağlanır; PeerJS’in STUN/TURN ayarları kullanılır. Oyun ve mesaj trafiği chatgpt.site’a gitmez. İlk giren tarayıcı desteyi ve kuralları yönetir, diğer oyuncuya yalnız kendi elini gönderir. Bu arkadaşlar arasında oynanan bir oyundur; masa sahibinin tarayıcısına karşı hile önleme sınırı yoktur. Tarayıcıların açık kalması gerekir; dış sinyalleşme servisi veya ağ kısıtları bağlantıyı etkileyebilir.

Masa sahibinin sekmesi yenilenirse oturum bu sekmede korunur ve diğer oyuncu yeniden bağlanır. Masadan çıkış masayı kapatır. 20 dakika oyun hamlesi veya mesaj gelmezse masa bağlantıları ve oturum kaydı temizlenir. Otomatik hamleler bu süreyi uzatmaz. Mesajlar oyunun geçmişine veya kalıcı depoya yazılmaz. Ses ilk kullanıcı etkileşiminde açılır; kart çekme ve bırakmada Kenney’nin gerçek kart kayıtları çalınır. Kartlar özgün SVG çizimleridir. Renk seçimi yalnız joker oynandığında açılır.

Her hamle için 30 saniye vardır; sayısal sayaç gösterilmez. Süre dolarsa bir kart çekilir ve sıra geçer; önceden kart çekilmişse yalnız pas geçilir. Bağlantı kopunca süre durur. El ve masa geçişleri kart kimlikleri korunarak yapılır; yeni kart desteden gelir, atılan kart masaya gider, kalan kartlar yerlerine kayar. Hareket azaltma tercihi açıksa uçuş yerine kısa solma kullanılır. Kartlar her iki oyuncuda da canlı renktedir; oynanabilirlik yalnız sıradaki oyuncuda çok hafif yükseltiyle belirtilir.

Sesler [Kenney Casino Audio](https://kenney.nl/assets/casino-audio), CC0; ifade görselleri [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji), MIT lisanslıdır. Apple cihazları dahil aynı küçük WebP/MP3 dosyaları kullanılır. Apple emoji fontu dağıtılmaz. Mevcut fok kullanıcı tarafından sağlandı; dil çıkaran, mutlu ve ağlayan varyantlar bu referanslardan üretildi. Lisanslar `app/public/assets/`, üretim notları `STICKER_NOTES.md` içinde bulunur.

Veri bütçesi: 12 görsel ve 6 ses toplam 100.471 bayt; dört fok toplam 26.848 bayt, tek fok 5–8 KB. Girişte medya indirilmez. Sesler masaya girerken, görseller sohbet açılırken veya tek bir ifade alınınca yüklenir; normal HTTP önbelleği kullanılır. Tekrar gönderilen ifadeler yalnız kısa kod taşır; görsel dosyası her mesajda iletilmez. Oyun durumu yalnız hamlelerde yayımlanır, 250 ms yerel saat kontrolü ağ isteği yapmaz. `media.test.mjs` dosya boyutlarını ve protokolde dört çıkartmanın da kabul edildiğini denetler. Kaynak PNG/WAV dosyaları korunur ve oyunda kullanılmaz.
