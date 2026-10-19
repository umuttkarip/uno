# UNO

İki oyuncu adını ve aynı masa adını yazar. Masa varsa katılır, yoksa oluşturulur; ikinci kişi gelince oyun başlar. Kullanılmayan masalar 20 dakika sonra kapanır. Sohbet mesajları ve ifadeler 5 saniye görünür. Giriş: https://umuttkarip.github.io/uno/

## Geliştirme

Node.js 22.13 veya üzeriyle `app` klasöründe `npm ci`, `npm run build`, `npm start` çalıştırılır. Yerel adres `http://localhost:4175/uno/`. `npm test` oyun ve oda kurallarını doğrular. Yayın `.github/workflows/pages.yml` ile GitHub Pages’e yapılır; Pages derleme kaynağı GitHub Actions olmalıdır.

GitHub Pages statik dosyaları sunar. Tarayıcılar PeerJS Cloud üzerinden birbirini bulur, WebRTC veri kanalıyla bağlanır; PeerJS’in STUN/TURN ayarları kullanılır. Oyun ve mesaj trafiği chatgpt.site’a gitmez. İlk giren tarayıcı desteyi ve kuralları yönetir, diğer oyuncuya yalnız kendi elini gönderir. Bu arkadaşlar arasında oynanan bir oyundur; masa sahibinin tarayıcısına karşı hile önleme sınırı yoktur. Tarayıcıların açık kalması gerekir; dış sinyalleşme servisi veya ağ kısıtları bağlantıyı etkileyebilir.

Masa sahibinin sekmesi yenilenirse oturum bu sekmede korunur ve diğer oyuncu yeniden bağlanır. Masadan çıkış masayı kapatır. 20 dakika oyun hamlesi veya mesaj gelmezse masa bağlantıları ve oturum kaydı temizlenir. Mesajlar oyunun geçmişine veya kalıcı depoya yazılmaz. Ses ilk kullanıcı etkileşiminde açılır; kart çekme ve bırakma için kısa kâğıt sesleri üretilir. Kartlar özgün SVG çizimleridir. Renk seçimi yalnız joker oynandığında açılır.
