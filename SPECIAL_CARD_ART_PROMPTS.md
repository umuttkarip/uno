# Özel mod kart çizimleri

Beş resimli deste için toplam 40 yeni sahne, yerleşik `image_gen` ile üretildi. CLI/API fallback kullanılmadı. Referanslar yalnız mevcut çizim dilini ve Sude kimliğini korumak için kullanıldı. Eski kart görselleri değiştirilmedi; üretici çıktıları kaynak klasörüne kopyalandı, özgün dosyalar silinmedi veya taşınmadı.

Her atlas 4 sütun × 2 satırdır; çalışma zamanı 768 × 384, hücre 192 × 192 pikseldir ve gerçek alfa içerir. Satır sırası: Gözcü, Bomba, Kalkan, Takas; Yansıtma, Hediye, El döndürme, alternatif Bomba. Bütün sahneler saydam karakter/nesne katmanıdır; bir fotoğraf penceresine veya kart çerçevesine gömülmez. Kart baskısı ve köşe sembolleri oyun renderer'ında eklenir.

`app/scripts/prepare-special-card-art.py` yalnız mekanik hücre ayırma, çok düşük alfa pusunu temizleme, kırpma, yeniden boyutlandırma ve WebP paketleme yapar. İşlevi anlatan ayrık kart/ok parçaları özellikle korunur. Kaynaklar `app/.local/card-art-source/special-{theme}.png`; çıktılar `app/public/assets/cards/{theme}-special.webp`. Python/Pillow ile yaratıcı çizim üretilmedi. Kesin manifest `app/.local/card-art-source/special-prompts.json` içinde de bulunur.

Nihai WebP boyutları: Kediler 75740 B, Sude 49934 B, Kuromi 67486 B, Adventure Time 74052 B, Minecraft 80832 B; toplam 348044 B. Sekiz hücrenin tamamı görsel olarak kontrol edildi; çerçeve/kapalı arka plan yoktur. Sude özgün üçgen karakteri, Minecraft aksolotlları, Adventure Time Marceline hediye sahnesi korunur. Temel deste dosyalarının hiçbiri değiştirilmedi.

## cats

Stil/kimlik referansı: `C:/Workspace/Projeler/uno/app/public/assets/cards/cats-a.webp`. Kaynak: `app/.local/card-art-source/special-cats.png`. Çıktı: `app/public/assets/cards/cats-special.webp`. Yerleşik araç özgün çıktısı: `C:\Users\umutk\.codex\generated_images\01a159f5-929c-7222-aab4-a5ac8a085807\exec-1792e51a-8f1c-4b56-a90e-d23d152f4590.png`.

Kesin üretim komutu:

```text
Use case: illustration-story.
Asset type: transparent production sprite atlas for eight special UNO card illustrations. Create exactly FOUR columns by TWO rows, eight equally sized SQUARE cells on a 2:1 wide transparent canvas. Each vignette isolated, centered within its own cell, with at least 8 percent transparent margin on all sides; no artwork may touch or cross between cells. Preserve real alpha transparency.
These are art layers that will be integrated over a native full-card print; do NOT draw a complete card, frame, circle, oval, square panel, border, background rectangle, UI, numbers, words, letters, watermark, shiny beams, neon glow, lens effects or labels. Blank card-shaped paper props only where the effect explicitly needs them. Clear flat silhouettes and distinct compositions, legible at 160 pixel cells. Every scene must be different and illustrate its card effect.
ROW-MAJOR ORDER IS CRITICAL: row1 cells0,1,2,3, then row2 cells4,5,6,7.
Input image: style reference for the established cats deck, NOT an edit target. Match its charming hand-inked storybook feline illustration, natural cat anatomy, triangular ears, whiskers, articulated paws, softly painted fur with crisp dark outlines. Not plush, chibi blob or photorealistic. Assorted tabby, tuxedo, orange, calico cats, no human bodies.
Scenes: 0 SPY: alert tuxedo peeking with one bright eye through a small hand-held magnifying glass beside a single blank cream card. 1 BOMB: mischievous orange tabby recoiling as a tiny round black cartoon bomb with a very short orange fuse rolls toward its paw, no explosion. 2 SHIELD: brave gray tabby bracing behind a broad teal medieval shield decorated only with a little paw emblem, stray blank paper cards bounced off. 3 SWAP: two cats, calico and black, facing each other and exchanging two visibly different little fans of blank cards with their paws. 4 REFLECT: a cream cat using a small silver hand-mirror to bounce a single flying red paper card back, flowing motion curve only. 5 GIFT: a friendly calico offering one blank lavender card tied with a small pink ribbon to a shy gray kitten. 6 ROTATE: three distinct cats sitting in a loose triangular group, passing little cream cards clockwise paw to paw; no drawn circular frame. 7 alternate BOMB: wide-eyed black cat inside an open cardboard box, peering at a tiny navy cartoon bomb with sparking short fuse outside the box, two blank cards tossed in surprise.
Keep all scenes tactile, humorous and warm, matching the reference illustration quality.
```

## seal

Stil/kimlik referansı: `C:/Workspace/Projeler/uno/app/public/assets/expressions/seal.webp`. Kaynak: `app/.local/card-art-source/special-seal.png`. Çıktı: `app/public/assets/cards/seal-special.webp`. Yerleşik araç özgün çıktısı: `C:\Users\umutk\.codex\generated_images\01a159f5-929c-7222-aab4-a5ac8a085807\exec-557fc9aa-c8c7-408c-b6ae-87fcbd509304.png`.

Kesin üretim komutu:

```text
Use case: illustration-story.
Asset type: transparent production sprite atlas for eight special UNO card illustrations. Create exactly FOUR columns by TWO rows, eight equally sized SQUARE cells on a 2:1 wide transparent canvas. Each vignette isolated, centered within its own cell, with at least 8 percent transparent margin on all sides; no artwork may touch or cross between cells. Preserve real alpha transparency.
These are art layers that will be integrated over a native full-card print; do NOT draw a complete card, frame, circle, oval, square panel, border, background rectangle, UI, numbers, words, letters, watermark, shiny beams, neon glow, lens effects or labels. Blank card-shaped paper props only where the effect explicitly needs them. Clear flat silhouettes and distinct compositions, legible at 160 pixel cells. Every scene must be different and illustrate its card effect.
ROW-MAJOR ORDER IS CRITICAL: row1 cells0,1,2,3, then row2 cells4,5,6,7.
Input image: STRICT IDENTITY REFERENCE for the SAME Sude seal meme character, not a generic seal or replacement mascot. Reproduce its exact broad almost triangular mound-shaped white body tapering to a small flattened head, tiny flippers as curved sparse black marks, little pink nose, light pink pencil hatch cheeks, expressive SMALL rough black lash/scribble eyes like the reference. Thin imperfect black outline and scruffy 2D meme pencil strokes. The character is WHITE, no shiny 3D eyeballs, no huge glossy oval eyes, no dotted pupils or dotted mouths, no ears, no whiskered cat face, no round plush head. Mouth is tiny simple curved ink, mostly closed. Small action props use the same sketchy line style.
Scenes: 0 SPY: same original Sude leaning toward a single blank small cream card with a small simple magnifier in tiny flipper, curious sideways glance. 1 BOMB: same Sude startled, tiny simple o-shaped empty mouth (no black dots), one small round black bomb with pink-orange short fuse beside its flipper. 2 SHIELD: same Sude proudly holding a plain small pink shield across lower body, tiny cream card deflecting away. 3 SWAP: TWO copies of same original Sude facing each other, exchanging small fans of blank cream cards with tiny flippers, shy blush. 4 REFLECT: same Sude with sly sideways eyes holding a small silver mirror, a single pale red blank card visibly bouncing back on a short curved path. 5 GIFT: same Sude with a tiny gentle smile offering one cream card wrapped in a pink ribbon and tiny heart near flipper; heart must NOT connect to face or mouth by a line. 6 ROTATE: THREE of the same original triangular Sude characters in a loose triangle, passing small blank cards flipper to flipper, no circular frame. 7 alternate BOMB: same Sude leaning back with closed eyes and puffed cheeks, tiny charcoal bomb and two falling blank cards off to one side.
The identity match matters more than decorative detail. Original white body and rough tiny black eyes must remain recognizable in every cell.
```

## kuromi

Stil/kimlik referansı: `C:/Workspace/Projeler/uno/app/public/assets/cards/kuromi-a.webp`. Kaynak: `app/.local/card-art-source/special-kuromi.png`. Çıktı: `app/public/assets/cards/kuromi-special.webp`. Yerleşik araç özgün çıktısı: `C:\Users\umutk\.codex\generated_images\01a159f5-929c-7222-aab4-a5ac8a085807\exec-786e4667-c114-46d5-ad5b-8916f2a59617.png`.

Kesin üretim komutu:

```text
Use case: illustration-story.
Asset type: transparent production sprite atlas for eight special UNO card illustrations. Create exactly FOUR columns by TWO rows, eight equally sized SQUARE cells on a 2:1 wide transparent canvas. Each vignette isolated, centered within its own cell, with at least 8 percent transparent margin on all sides; no artwork may touch or cross between cells. Preserve real alpha transparency.
These are art layers that will be integrated over a native full-card print; do NOT draw a complete card, frame, circle, oval, square panel, border, background rectangle, UI, numbers, words, letters, watermark, shiny beams, neon glow, lens effects or labels. Blank card-shaped paper props only where the effect explicitly needs them. Clear flat silhouettes and distinct compositions, legible at 160 pixel cells. Every scene must be different and illustrate its card effect.
ROW-MAJOR ORDER IS CRITICAL: row1 cells0,1,2,3, then row2 cells4,5,6,7.
Input image: exact visual style and character reference for the existing Kuromi deck. Match official-looking crisp 2D Sanrio Kuromi: black jester hood with pink skull emblem, white face/body, thin black ink, pink/lilac accents, compact expressive gestures, tasteful goth-cute props. Flat printed illustration, clean delicate shading, NOT 3D/plush/realistic.
Scenes: 0 SPY: Kuromi in a tiny lilac detective cape holding a heart-shaped magnifier beside a single blank black-and-pink card, sly look. 1 BOMB: Kuromi in little safety goggles tinkering with a charcoal round bomb with pink bow and short fuse, excited cheeky expression. 2 SHIELD: Kuromi bracing behind an ornate black and lilac shield with pink skull crest, little pink paper cards glancing off. 3 SWAP: Kuromi and My Melody facing each other, trading separate fans of blank pink and lavender cards, clearly two hands moving opposite directions. 4 REFLECT: smug Kuromi holding a small ornate lavender hand-mirror with bat wings, one blank pink card rebounding away. 5 GIFT: smiling Kuromi offering a single blank lilac card decorated with a tiny pink ribbon to Baku, one small floating heart not connected to face. 6 ROTATE: Kuromi, My Melody and Baku seated as a loose triangular group, passing small blank cards around paw to paw; no circular backdrop. 7 alternate BOMB: Kuromi startled by a tiny navy bomb popping out from a lilac gift box with two blank card papers flying, short fuse only, no blast glow.
Preserve the existing high-quality controlled black/pink/lavender palette and affectionate mischievous personality. Each vignette a distinct designed composition, no repeated pose.
```

## adventure

Stil/kimlik referansı: `C:/Workspace/Projeler/uno/app/public/assets/cards/adventure-a.webp`. Kaynak: `app/.local/card-art-source/special-adventure.png`. Çıktı: `app/public/assets/cards/adventure-special.webp`. Yerleşik araç özgün çıktısı: `C:\Users\umutk\.codex\generated_images\01a159f5-929c-7222-aab4-a5ac8a085807\exec-259285cf-218d-46cf-8dc8-c18f2b0319dc.png`.

Kesin üretim komutu:

```text
Use case: illustration-story.
Asset type: transparent production sprite atlas for eight special UNO card illustrations. Create exactly FOUR columns by TWO rows, eight equally sized SQUARE cells on a 2:1 wide transparent canvas. Each vignette isolated, centered within its own cell, with at least 8 percent transparent margin on all sides; no artwork may touch or cross between cells. Preserve real alpha transparency.
These are art layers that will be integrated over a native full-card print; do NOT draw a complete card, frame, circle, oval, square panel, border, background rectangle, UI, numbers, words, letters, watermark, shiny beams, neon glow, lens effects or labels. Blank card-shaped paper props only where the effect explicitly needs them. Clear flat silhouettes and distinct compositions, legible at 160 pixel cells. Every scene must be different and illustrate its card effect.
ROW-MAJOR ORDER IS CRITICAL: row1 cells0,1,2,3, then row2 cells4,5,6,7.
Input image: exact visual style reference for the beloved existing Adventure Time UNO deck. Match Adventure Time's ORIGINAL CLEAN FLAT 2D TV CARTOON: bold hand-drawn black contours, simple solid colors, thin spaghetti limbs, accurate character faces and proportions. Not painterly, 3D or realistic. No environment panels: only transparent isolated character/prop clusters.
Scenes: 0 SPY: BMO in a small detective cap examining one blank cream card with a magnifying glass, curious cheerful face. 1 BOMB: Princess Bubblegum in lab goggles carefully brewing a tiny round pink cartoon bomb between test tubes, short fuse and small surprised expression, no explosion. 2 SHIELD: Finn bracing with a broad blue hero shield, Jake peeking from behind, one blank paper card bounced away. 3 SWAP: Finn and Jake facing each other, comically exchanging large fans of blank cream and pale blue cards, Jake's stretchy arms creating a clear handoff. 4 REFLECT: Ice King aiming an angular small ice mirror to bounce a flying pink blank card backward while Gunter watches, humorous rather than threatening. 5 GIFT: Marceline floating in a relaxed sideways pose, red bass strapped across back, offering a single cream card with pink ribbon to Princess Bubblegum, affectionate smirk. 6 ROTATE: Finn, Jake and BMO in a loose triangular gathering passing little blank cards around their hands, visibly different poses, no circular backdrop. 7 alternate BOMB: Lemongrab recoiling in outraged surprise from a tiny lemon-yellow cartoon bomb with short fuse while two blank cards flutter beside him.
Keep each character clearly recognizable. Same polished, legible, simple TV animation style as the reference, not an embellished redesign.
```

## minecraft

Stil/kimlik referansı: `C:/Workspace/Projeler/uno/app/public/assets/cards/minecraft-art-a.webp`. Kaynak: `app/.local/card-art-source/special-minecraft.png`. Çıktı: `app/public/assets/cards/minecraft-special.webp`. Yerleşik araç özgün çıktısı: `C:\Users\umutk\.codex\generated_images\01a159f5-929c-7222-aab4-a5ac8a085807\exec-e5d3341e-54f8-4626-a39c-c346aa960026.png`.

Kesin üretim komutu:

```text
Use case: illustration-story.
Asset type: transparent production sprite atlas for eight special UNO card illustrations. Create exactly FOUR columns by TWO rows, eight equally sized SQUARE cells on a 2:1 wide transparent canvas. Each vignette isolated, centered within its own cell, with at least 8 percent transparent margin on all sides; no artwork may touch or cross between cells. Preserve real alpha transparency.
These are art layers that will be integrated over a native full-card print; do NOT draw a complete card, frame, circle, oval, square panel, border, background rectangle, UI, numbers, words, letters, watermark, shiny beams, neon glow, lens effects or labels. Blank card-shaped paper props only where the effect explicitly needs them. Clear flat silhouettes and distinct compositions, legible at 160 pixel cells. Every scene must be different and illustrate its card effect.
ROW-MAJOR ORDER IS CRITICAL: row1 cells0,1,2,3, then row2 cells4,5,6,7.
Input image: style reference for the existing Minecraft deck. Match clean recognizably MINECRAFT block geometry and voxel characters, textured square surfaces, compact isometric illustrated cutouts, restrained matte daylight. No glossy neon bloom, rim glows, golden pyramids, rounded dolls or smooth-realistic animals. Only a tiny connected patch of grass/stone/water may support a subject; transparent everywhere else.
Scenes: 0 SPY: Minecraft ocelot crouching beside a little spyglass and a single cream paper card, curious eyes, little grass block. 1 BOMB: Steve standing beside one clear red TNT block with short fuse, startled pose, small stone support. TNT lettering is allowed ONLY as the familiar block texture; no other text. 2 SHIELD: Alex bracing behind a wooden Minecraft shield with iron border, one pale paper card glancing away, compact grass support. 3 SWAP: Steve and a villager trading two small stacks of cream paper cards in opposite directions, clear blocky hands and different silhouettes. 4 REFLECT: a pink Minecraft AXOLOTL beside a standing amethyst shard mirror, a small pale red paper card bouncing back, a few square water ripples. 5 GIFT: yellow Minecraft AXOLOTL nudging one cream paper card tied with pink ribbon toward a blue Minecraft axolotl, small lily-pad water blocks. 6 ROTATE: three blocky allay creatures passing little cream cards in a loose triangle around a small grass block, no enclosing ring or halo. 7 alternate BOMB: a green Creeper recoiling beside a tiny red TNT minecart and two flying cream paper cards, compact rail-and-stone support, no explosion glow.
Art should look like the established Minecraft world with clear square appendages and textures, not Egypt/fantasy artifacts. Preserve the existing cutout quality while keeping readable uncluttered scenes.
```
