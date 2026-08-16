# Saudi café/lounge glossary — get the meaning right, not the literal word

These are the terms that quietly produce a wrong photo or a wrong translation if you take the menu
literally or trust an English/stock interpretation. Respect the **Arabic intent**. (Learned the hard
way on Wadi Almusafir — owner caught each one.)

## Tea / hot drinks
| Term | Means | Right photo |
|---|---|---|
| **براد** (شاي/نعناع/زنجبيل) | a **teapot / إبريق** (serves several cups), NOT a cup | a teapot pouring (library `tea/kenya-tea`, `tea/morocan-tea`) |
| **كوب** (شاي) | a single **cup/glass** | one glass |
| **شاي عادي / أحمر** | plain **red/black** tea in an istikana | red tea, NO lemon (library `tea/tea.png`) |
| شاي بليمون | tea *with* lemon — only when "ليمون" is in the name | lemon in the glass |
| **تلقيمة** | tea served with dates/sweets on the side | plain red tea is fine |
| **كرك / karak** | spiced **milk** tea | karak glass |
| **سحلب / sahlab** | warm milk + cinnamon/nuts | frothy hot-milk cup |
| **حليب** (as a drink) | usually a **hot/warm milk** drink — NOT a carton or bottles | warm milk in a cup |
| **قهوة سعودية / كوب قهوة سعودية** | Arabic coffee (finjan + dates); **دلة** = the pot version | dallah + finjan + dates |
| **هوت X** (Hot Oreo, Hot Lotus…) | a **HOT beverage** flavored with X — NOT the cookie/sweet | the hot drink in a mug (oreo→oreo hot chocolate, not a cookie packet) |
| **V60 / كيمكس / drip** | pour-over coffee | dripper/cup |

## Shisha / lounge
| Term | Means | Right photo |
|---|---|---|
| **معسّل / شيشة / نكهة** | hookah **molasses flavor** | flavor imagery (fruit/mint/gum) is fine **but add a «معسّل» badge** so it doesn't read as real fruit / a fruit salad |
| **تغيير رأس / تغير راس** | hookah **head/coal change** (a service, not a flavor) | hookah head / coals |
| نخلة | a double-apple style flavor (brand) | two apples / palm motif |

## Drinks — halal is mandatory
| Term | Means | Right photo |
|---|---|---|
| **موهيتو / mojito** | a **mocktail** (non-alcoholic) | a mocktail glass — **NEVER** a cocktail with a liquor bottle in frame |
| **كركديه / karkade** | hibiscus **red iced tea** (the drink) | red iced tea — NOT the hibiscus flower |
| **بيرة** (Holsten/Barbican) | **non-alcoholic malt** beverage (halal) | the malt can/glass — never real beer |
| كوكتيل (juice menu) | a mixed **fruit juice** | layered fruit juice glass |

> No alcohol, ever — not the drink, not a bottle in the background. Stock "<fruit> drink/cocktail"
> queries return real cocktails with liquor bottles. Always montage-review (see `menulink-photo-catalog`).

## POS export names are dirty — verify every name
POS/Excel exports carry OCR/typo garbage in the name fields: `COIF kAs` (= كوب قهوة سعودية),
`tagree ras max`, `cop of tea`, Arabic text dumped into the English column, English in the Arabic
column. **Don't trust the export's name verbatim.** Before insert, clean BOTH `name_ar` and `name_en`:
fix obvious garbage, move misplaced-language text to the right column, drop redundant tier numbers
("شيشة عنب 35" → "عنب"), and have the owner confirm anything ambiguous. A garbage name shipped live
once ("COIF kAs") and the owner had to flag it.
