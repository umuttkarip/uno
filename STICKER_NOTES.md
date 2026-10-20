# Fok çıkartmaları

Mevcut kullanıcı görseli korunur. Üç yeni varyant built-in imagegen ile üretildi; CLI/API kullanılmadı. Oyun dosyaları `app/public/assets/expressions/seal.webp`, `seal-tongue.webp`, `seal-happy.webp`, `seal-cry.webp`. Saydam alfa korunarak 256 px WebP, kalite 80 ile kodlandılar. Boyutlar sırasıyla 5.248, 6.268, 8.050 ve 7.282 bayt. Kaynak PNG’ler `.local/generated-stickers/` içinde yerel olarak saklanır; oynatımda indirilmez.

## Ortak istem

Create a single transparent-background game chat sticker. Image 1 is the existing sticker whose exact character identity, simple hand-drawn shaky black outlines, off-white blobby triangular seal body, tiny curved flippers, pink triangular nose, and intentionally rough meme-art aesthetic must be preserved. Image 2 is an expression reference sheet. Keep the subject centered and the same framing with the complete broad body base and tiny hands visible. No text, border, props, shadow, white rectangle, backdrop, or ground. Real transparent alpha around the silhouette. Do not add realism, fur, 3D shading, vector polish or new anatomy. The output is ONE character, not a sticker sheet.

## Varyant istemleri

Dil çıkaran: Image 3 is the exact requested cheeky tongue-out expression reference: black scribbled oval eyes, a smiling open mouth with a pink tongue sticking out playfully. Recreate that expression on Image 1's character, a teasing playful mood. Keep the mouth simple and clearly readable at 96 pixels.

Mutlu: Expression variant: joyful happy laughing celebration, closed crescent eyes, flushed pink cheeks, a wide happy open smile with tiny pink mouth interior, both tiny hands lifted a little in delight. Use the top-left / lower-left affectionate happy mood in the sheet. Maintain the same face placement and original body's proportions. Simple clear expression, no confetti or hearts floating around.

Ağlayan: Expression variant: comically crying, sad raised eyebrows, scribbled black teary eyes with two clearly visible pale blue tear streams down the cheeks and a small wobbly downturned mouth. Use the crying seal in row two right of the sheet as mood reference. Keep the nose pink and both tiny hands low as in the original. Funny exaggerated sorrow, not realistic suffering. Readable at 96 pixels.

## 5.3.2 · Kullanıcının ağız açık orijinali
Kullanıcı bu ifadeyi eklemeyi açıkça istedi. İkinci özgün referans .local/generated-stickers/original-open-mouth-reference.png içinde korunur. Built-in imagegen yalnız arka planı ayırdı; çizim kimliği korunarak saydam cutout .local/generated-stickers/seal-scream-cutout.png oldu. FFmpeg alfa sınırına göre boşlukları kırpıp240px WebP kalite72 üretti: public/assets/expressions/seal-scream.webp8440B. Kod seal-scream, görünen ad Çığlık. Altı yeni duygu önerisi hâlâ onay bekler ve public varlıklara/protokole eklenmedi. Toplam runtime medya108911B (<110KB).
