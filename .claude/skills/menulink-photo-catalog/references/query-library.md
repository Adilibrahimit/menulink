# Stock-query library (Pexels / web)

Use ONLY for dishes the catalog doesn't already own. Pexels: 200 req/hr, `Authorization: <key>` header, `photos[0].src.large`. Always fetch 2–4 candidates and **audit via montage** before applying. Halal only.

## Per-dish-type queries that work for Saudi cafés

**Hot coffee** — `cappuccino coffee cup`, `caramel macchiato glass`, `flat white coffee`, `turkish coffee cup`, `spanish latte`, `pistachio latte green coffee`, `mocha coffee`, `cortado espresso`.
**Iced/cold coffee** — `iced latte coffee glass`, `iced caramel macchiato`, `iced americano coffee`, `cold brew coffee glass`, `iced spanish latte`, `chocolate frappe ice`.
**Tea & herbal** — `karak tea glass`, `moroccan mint tea`, `black tea istikan`, `hibiscus karkade red drink` (NOT "carcade cocktail" → returns liquor), `ginger lemon honey tea`, `chamomile tea`, `green tea mint`.
**Juices** — `fresh orange juice glass`, `watermelon juice`, `mango juice glass`, `avocado shake cream`, `lemon mint juice`, `mixed fruit cocktail drink layered` (fakhfakhina/four-season).
**Milkshakes** — `vanilla milkshake glass`, `oreo milkshake`, `strawberry milkshake`, `chocolate milkshake`.
**Mojito (virgin)** — `classic mojito mint lime` (one standard for all flavors), `blueberry mojito mocktail`.
**Desserts** — `cheesecake slice berries`, `tiramisu`, `chocolate lava cake raspberry`, `kunafa pistachio`, `crepe nutella`, `belgian waffle dessert`, `sticky toffee date cake`, `creme brulee`, `san sebastian cheesecake`.
**Ice cream** — `pistachio arabic ice cream`, `chocolate ice cream scoop`, `mango ice cream`.
**Fruit salads** — `fruit salad whipped cream nuts bowl`, `chocolate fruit salad dessert`.
**Salads** — `caesar salad`, `fattoush salad`, `tabbouleh`, `greek salad`.
**Sandwiches/burgers** — `grilled chicken burger`, `beef burger fries`, `chicken shawarma wrap`, `club sandwich`, `halloumi sandwich`, `crispy chicken zinger`.
**Appetizers** — `chicken nuggets plate` (NOT "chicken" alone → live birds), `french fries`, `fried kibbeh`, `hummus bowl`, `mutabbal`, `spring rolls`.
**Mains/platters** — `chicken kabsa platter`, `mandi rice chicken`, `mixed grill kebab`, `alfredo pasta`, `margherita pizza`.

## Branded drinks — DON'T stock-fetch

Pepsi, 7up, Diet variants, Code Red, Red Bull, Mirinda, Holsten (all flavors), Sprite, Mineral water — **reuse the real product shots already in the catalog** (`cold-drinks/`, sourced from mazaj/coffee-secret). Stock sites avoid trademarks and return generic/wrong cans.

## Wikimedia Commons (CC0 fallback)

`scripts/fetch-commons.mjs <terms> <outDir> <count>` — for when Pexels is rate-limited or a dish needs a public-domain source. Still audit.
