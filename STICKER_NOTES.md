# Fok çıkartmaları

Mevcut kullanıcı görseli korunur. Üç yeni varyant built-in imagegen ile üretildi; CLI/API kullanılmadı. Oyun dosyaları `app/public/assets/expressions/seal.webp`, `seal-tongue.webp`, `seal-happy.webp`, `seal-cry.webp`. Saydam alfa korunarak 256 px WebP, kalite 80 ile kodlandılar. Boyutlar sırasıyla 5.248, 6.268, 8.050 ve 7.282 bayt. Kaynak PNG’ler `.local/generated-stickers/` içinde yerel olarak saklanır; oynatımda indirilmez.

## Ortak istem

Create a single transparent-background game chat sticker. Image 1 is the existing sticker whose exact character identity, simple hand-drawn shaky black outlines, off-white blobby triangular seal body, tiny curved flippers, pink triangular nose, and intentionally rough meme-art aesthetic must be preserved. Image 2 is an expression reference sheet. Keep the subject centered and the same framing with the complete broad body base and tiny hands visible. No text, border, props, shadow, white rectangle, backdrop, or ground. Real transparent alpha around the silhouette. Do not add realism, fur, 3D shading, vector polish or new anatomy. The output is ONE character, not a sticker sheet.

## Varyant istemleri

Dil çıkaran: Image 3 is the exact requested cheeky tongue-out expression reference: black scribbled oval eyes, a smiling open mouth with a pink tongue sticking out playfully. Recreate that expression on Image 1's character, a teasing playful mood. Keep the mouth simple and clearly readable at 96 pixels.

Mutlu: Expression variant: joyful happy laughing celebration, closed crescent eyes, flushed pink cheeks, a wide happy open smile with tiny pink mouth interior, both tiny hands lifted a little in delight. Use the top-left / lower-left affectionate happy mood in the sheet. Maintain the same face placement and original body's proportions. Simple clear expression, no confetti or hearts floating around.

Ağlayan: Expression variant: comically crying, sad raised eyebrows, scribbled black teary eyes with two clearly visible pale blue tear streams down the cheeks and a small wobbly downturned mouth. Use the crying seal in row two right of the sheet as mood reference. Keep the nose pink and both tiny hands low as in the original. Funny exaggerated sorrow, not realistic suffering. Readable at 96 pixels.

## 5.3.2 · Kullanıcının ağız açık orijinali
Kullanıcı bu ifadeyi eklemeyi açıkça istedi. İkinci özgün referans .local/generated-stickers/original-open-mouth-reference.png içinde korunur. Built-in imagegen yalnız arka planı ayırdı; çizim kimliği korunarak saydam cutout .local/generated-stickers/seal-scream-cutout.png oldu. FFmpeg alfa sınırına göre boşlukları kırpıp240px WebP kalite72 üretti: public/assets/expressions/seal-scream.webp8440B. Kod seal-scream, görünen ad Çığlık. Bu sürümün toplam runtime medyası108911B (<110KB) idi; güncel seçim aşağıdadır.

## 5.4.0 · Öpücük, Tripli, Muzip

Kullanıcı 1/4/5’i onayladı; Öpücük yeniden üretildi, Tripli/Muzip onaylanan V2 çizimleri aynen korunarak ayrıldı. Öpücükte yüzden kalbe çizgi yoktur, göz dolgusu noktalı değildir. scripts/prepare-chat-stickers.py yalnız alfa kırpma, komşu parça dışlama, küçültme ve WebP paketleme yapar. seal-kiss.webp4272B, seal-sulk.webp4818B, seal-smug.webp4772B; her biri5500B altında. Sekiz çıkartma toplam49150B; bütün sohbet ve ses medyası122773B (<125000B). Sekiz çıkartma ve sekiz emoji aynı panelde mesaj alanıyla kaydırmasız görünür. 2/3/6 eklenmedi.

Öpücük V3 istemi: Edit only the approved kiss expression of the original triangular white meme seal. Preserve the low-fi thin irregular outline, flat white body, pink triangular nose, soft cheek marks and tiny low flippers. One original-shaped open eye filled solid black with one broad white highlight, the other a simple wink. No dotted, stippled or grainy eye fills. Small puckered kiss mouth. One small separate floating pink heart beside the cheek; leave a clear transparent gap, absolutely no black line, whisker, trail or string joining face and heart. No new anatomy, text, border or backdrop. True transparent background. Source: .local/generated-stickers/seal-kiss-v3.png.
