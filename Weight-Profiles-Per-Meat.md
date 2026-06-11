# Weight Profiles Per Meat

## Core Rule

Every meat should reference one reusable `weightProfileId`.

The weight profile controls the meat’s normal spawned-weight behavior.

The profile does not remove jackpot possibility.

All meat can still jackpot because the game uses uncapped weight. However, each meat should have a different common weight behavior.

Example:

```text
Chicken Feet:
Normal behavior = tiny/small

Whole Turkey:
Normal behavior = medium/large

Beef Brisket:
Normal behavior = medium/heavy

A5 Japanese Kobe Beef:
Normal behavior = small/medium, but extreme jackpot is ultra rare
```

## Weight Profile IDs

Use these profile IDs for now.

### `tiny_part_jackpot_possible`

Used for very small meat parts, small organs, feet, skin, tiny shellfish, and similar items.

Normal behavior:

```text
Tiny / Small common
Normal possible
Large uncommon
Jackpot possible but rare
Extreme jackpot ultra rare
```

### `small_cut_standard`

Used for small normal meat cuts.

Normal behavior:

```text
Small / Normal common
Large possible
Heavy uncommon
Jackpot possible but rare
```

### `medium_cut_standard`

Used for normal-sized meat cuts.

Normal behavior:

```text
Normal / Large common
Heavy possible
Jackpot possible but rare
```

### `large_cut_standard`

Used for larger cuts that are not quite heavy roasts.

Normal behavior:

```text
Large common
Heavy possible
Massive uncommon
Jackpot possible but rare
```

### `heavy_roast_cut`

Used for brisket, shoulders, roasts, large legs, and dense heavy cuts.

Normal behavior:

```text
Medium / Heavy common
Massive possible
Huge rare
Jackpot possible but rare
```

### `premium_steak_cut`

Used for steaks, chops, premium slices, and high-value portion cuts.

Normal behavior:

```text
Small / Medium common
Large possible
Heavy uncommon
Jackpot possible but rare
```

### `ribs_rack`

Used for rib racks, rib tips, and bone-heavy rib cuts.

Normal behavior:

```text
Medium / Large common
Heavy possible
Massive uncommon
Jackpot possible but rare
```

### `shank_hock_bone_cut`

Used for shanks, hocks, oxtail, neck bones, marrow bones, and bone-heavy cuts.

Normal behavior:

```text
Small / Medium common
Large possible
Heavy uncommon
Jackpot possible but rare
```

### `offal_small`

Used for small organs.

Normal behavior:

```text
Tiny / Small common
Normal possible
Large uncommon
Jackpot possible but rare
```

### `offal_medium`

Used for larger organs and dense organ cuts.

Normal behavior:

```text
Small / Normal common
Large possible
Heavy uncommon
Jackpot possible but rare
```

### `whole_bird_small`

Used for small whole birds.

Normal behavior:

```text
Small / Normal common
Large possible
Heavy rare
Jackpot possible but rare
```

### `whole_bird_medium`

Used for whole chickens, whole ducks, and similar birds.

Normal behavior:

```text
Medium / Large common
Heavy possible
Massive rare
Jackpot possible but rare
```

### `whole_bird_large`

Used for whole turkey, goose, and very large birds.

Normal behavior:

```text
Large / Heavy common
Massive possible
Huge rare
Jackpot possible but rare
```

### `ground_bulk`

Used for ground meat, meat mixes, and bulk processed meat.

Normal behavior:

```text
Small / Medium common
Large possible
Heavy uncommon
Jackpot possible but rare
```

### `sausage_processed`

Used for sausages, hot dogs, franks, meatballs, and formed meat products.

Normal behavior:

```text
Small / Medium common
Large possible
Heavy uncommon
Jackpot possible but rare
```

### `cured_sliced_deli`

Used for sliced deli meats and cured thin meats.

Normal behavior:

```text
Small / Medium common
Large possible
Heavy rare
Jackpot possible but rare
```

### `cured_dense_slab`

Used for dense cured meats, ham, pancetta, cured beef, and similar items.

Normal behavior:

```text
Medium / Large common
Heavy possible
Massive rare
Jackpot possible but rare
```

### `dried_dense`

Used for jerky and dried meat.

Normal behavior:

```text
Tiny / Small common
Normal possible
Large rare
Jackpot possible but very rare
```

### `fatty_slab_cut`

Used for pork belly, fatback, jowl, bacon-like slabs, and fatty dense cuts.

Normal behavior:

```text
Small / Medium common
Large possible
Heavy uncommon
Jackpot possible but rare
```

### `seafood_fillet`

Used for fish fillets.

Normal behavior:

```text
Small / Medium common
Large possible
Heavy rare
Jackpot possible but rare
```

### `seafood_steak`

Used for large fish steaks.

Normal behavior:

```text
Medium / Large common
Heavy possible
Massive rare
Jackpot possible but rare
```

### `shellfish_small`

Used for clams, mussels, shrimp, oysters, and small shellfish.

Normal behavior:

```text
Tiny / Small common
Normal possible
Large rare
Jackpot possible but rare
```

### `shellfish_premium`

Used for lobster meat, crab meat, scallops, and expensive shellfish.

Normal behavior:

```text
Small / Medium common
Large possible
Heavy rare
Jackpot possible but very rare
```

### `cephalopod_medium`

Used for squid and octopus.

Normal behavior:

```text
Small / Medium common
Large possible
Heavy uncommon
Jackpot possible but rare
```

### `game_small_whole`

Used for rabbit, whole rabbit, small game birds, and small game meat.

Normal behavior:

```text
Small / Medium common
Large possible
Heavy uncommon
Jackpot possible but rare
```

### `game_large_cut`

Used for bison, venison, elk, wild boar, alligator, kangaroo, ostrich, and other specialty large meats.

Normal behavior:

```text
Medium / Large common
Heavy possible
Massive rare
Jackpot possible but rare
```

### `game_steak_cut`

Used for specialty game steaks.

Normal behavior:

```text
Small / Medium common
Large possible
Heavy uncommon
Jackpot possible but rare
```

### `luxury_premium_steak`

Used for premium steaks, dry-aged steaks, prime steaks, and Wagyu steaks.

Normal behavior:

```text
Small / Medium common
Large possible
Heavy rare
Jackpot possible but very rare
```

### `luxury_small_medium_high_variance`

Used for A5 Wagyu, A5 Kobe, foie gras, and extremely high-value luxury meats.

Normal behavior:

```text
Small / Medium common
Large uncommon
Heavy rare
Absurd jackpot possible but ultra rare
Extreme jackpot nearly impossible
```

### `luxury_cured_dense`

Used for Jamon Iberico, duck prosciutto, premium cured meats, and luxury preserved meats.

Normal behavior:

```text
Small / Medium common
Large possible
Heavy rare
Jackpot possible but very rare
```

---

# Poultry

| Meat                      | Weight Profile               |
| ------------------------- | ---------------------------- |
| Chicken Legs / Drumsticks | `small_cut_standard`         |
| Whole Chicken             | `whole_bird_medium`          |
| Chicken Leg Quarters      | `medium_cut_standard`        |
| Chicken Thighs            | `small_cut_standard`         |
| Chicken Wings             | `small_cut_standard`         |
| Chicken Breast (Bone-in)  | `medium_cut_standard`        |
| Chicken Breast (Boneless) | `medium_cut_standard`        |
| Chicken Tenderloins       | `small_cut_standard`         |
| Chicken Cutlets           | `small_cut_standard`         |
| Ground Chicken            | `ground_bulk`                |
| Chicken Liver             | `offal_small`                |
| Chicken Gizzards          | `offal_small`                |
| Chicken Hearts            | `offal_small`                |
| Chicken Feet              | `tiny_part_jackpot_possible` |
| Whole Turkey              | `whole_bird_large`           |
| Turkey Breast             | `large_cut_standard`         |
| Turkey Drumsticks         | `medium_cut_standard`        |
| Turkey Thighs             | `medium_cut_standard`        |
| Turkey Wings              | `medium_cut_standard`        |
| Turkey Cutlets            | `medium_cut_standard`        |
| Ground Turkey             | `ground_bulk`                |
| Cornish Hen               | `whole_bird_small`           |
| Duck Breast               | `medium_cut_standard`        |
| Duck Legs                 | `medium_cut_standard`        |
| Whole Duck                | `whole_bird_medium`          |
| Goose                     | `whole_bird_large`           |
| Quail                     | `whole_bird_small`           |
| Pheasant                  | `whole_bird_small`           |

# Pork

| Meat                        | Weight Profile               |
| --------------------------- | ---------------------------- |
| Pork Chops (Bone-in)        | `premium_steak_cut`          |
| Pork Chops (Boneless)       | `premium_steak_cut`          |
| Ground Pork                 | `ground_bulk`                |
| Pork Loin                   | `heavy_roast_cut`            |
| Pork Tenderloin             | `premium_steak_cut`          |
| Pork Shoulder / Boston Butt | `heavy_roast_cut`            |
| Picnic Shoulder             | `heavy_roast_cut`            |
| Fresh Ham                   | `heavy_roast_cut`            |
| Ham Steak                   | `medium_cut_standard`        |
| Pork Belly                  | `fatty_slab_cut`             |
| Bacon                       | `cured_sliced_deli`          |
| Pork Spare Ribs             | `ribs_rack`                  |
| Baby Back Ribs              | `ribs_rack`                  |
| Country-Style Pork Ribs     | `ribs_rack`                  |
| Pork Cutlets                | `small_cut_standard`         |
| Diced Pork / Pork Stew Meat | `small_cut_standard`         |
| Pork Hock / Ham Hock        | `shank_hock_bone_cut`        |
| Pork Neck Bones             | `shank_hock_bone_cut`        |
| Pork Jowl                   | `fatty_slab_cut`             |
| Pork Fatback                | `fatty_slab_cut`             |
| Salt Pork                   | `cured_dense_slab`           |
| Pork Liver                  | `offal_small`                |
| Pork Heart                  | `offal_small`                |
| Pork Feet                   | `tiny_part_jackpot_possible` |
| Pork Cheeks                 | `fatty_slab_cut`             |
| Pork Skin                   | `tiny_part_jackpot_possible` |
| Pork Rib Tips               | `ribs_rack`                  |
| Pork Sirloin Roast          | `heavy_roast_cut`            |
| Smoked Ham                  | `cured_dense_slab`           |
| Cured Ham                   | `cured_dense_slab`           |

# Beef

| Meat                 | Weight Profile        |
| -------------------- | --------------------- |
| Ground Beef          | `ground_bulk`         |
| Ground Chuck         | `ground_bulk`         |
| Ground Sirloin       | `ground_bulk`         |
| Beef Shank           | `shank_hock_bone_cut` |
| Beef Stew Meat       | `small_cut_standard`  |
| Beef Chuck Roast     | `heavy_roast_cut`     |
| Beef Brisket         | `heavy_roast_cut`     |
| Beef Short Ribs      | `ribs_rack`           |
| Beef Back Ribs       | `ribs_rack`           |
| Beef Rib Roast       | `heavy_roast_cut`     |
| Prime Rib Roast      | `heavy_roast_cut`     |
| Sirloin Steak        | `premium_steak_cut`   |
| Top Sirloin Steak    | `premium_steak_cut`   |
| Flank Steak          | `premium_steak_cut`   |
| Skirt Steak          | `premium_steak_cut`   |
| Ribeye Steak         | `premium_steak_cut`   |
| New York Strip Steak | `premium_steak_cut`   |
| Filet Mignon         | `premium_steak_cut`   |
| T-Bone Steak         | `premium_steak_cut`   |
| Porterhouse Steak    | `premium_steak_cut`   |
| Flat Iron Steak      | `premium_steak_cut`   |
| Hanger Steak         | `premium_steak_cut`   |
| Tri-Tip Roast        | `heavy_roast_cut`     |
| Top Round Roast      | `heavy_roast_cut`     |
| Eye of Round Roast   | `heavy_roast_cut`     |
| Bottom Round Steak   | `medium_cut_standard` |
| Rump Roast           | `heavy_roast_cut`     |
| Arm Roast            | `heavy_roast_cut`     |
| Cube Steak           | `medium_cut_standard` |
| Minute Steak         | `small_cut_standard`  |
| Beef Oxtail          | `shank_hock_bone_cut` |
| Beef Liver           | `offal_medium`        |
| Beef Heart           | `offal_medium`        |
| Beef Tongue          | `offal_medium`        |
| Beef Cheeks          | `fatty_slab_cut`      |
| Beef Tripe           | `offal_medium`        |
| Beef Neck Bones      | `shank_hock_bone_cut` |
| Beef Marrow Bones    | `shank_hock_bone_cut` |
| Corned Beef Brisket  | `cured_dense_slab`    |
| Beef Suet            | `fatty_slab_cut`      |
| Beef Kidney          | `offal_medium`        |
| Beef Spleen          | `offal_medium`        |
| Beef Tendon          | `shank_hock_bone_cut` |

# Lamb & Goat

| Meat                      | Weight Profile        |
| ------------------------- | --------------------- |
| Ground Lamb               | `ground_bulk`         |
| Lamb Shoulder             | `heavy_roast_cut`     |
| Lamb Chops / Rack of Lamb | `premium_steak_cut`   |
| Lamb Leg                  | `heavy_roast_cut`     |
| Lamb Shank                | `shank_hock_bone_cut` |
| Lamb Stew Meat            | `small_cut_standard`  |
| Lamb Ribs                 | `ribs_rack`           |
| Lamb Loin Chops           | `premium_steak_cut`   |
| Lamb Breast               | `large_cut_standard`  |
| Lamb Neck                 | `shank_hock_bone_cut` |
| Lamb Sirloin              | `premium_steak_cut`   |
| Lamb Liver                | `offal_small`         |
| Lamb Heart                | `offal_small`         |
| Mutton                    | `medium_cut_standard` |
| Goat Meat                 | `medium_cut_standard` |
| Ground Goat               | `ground_bulk`         |
| Goat Shoulder             | `heavy_roast_cut`     |
| Goat Leg                  | `heavy_roast_cut`     |
| Goat Ribs                 | `ribs_rack`           |
| Goat Stew Meat            | `small_cut_standard`  |
| Goat Chops                | `premium_steak_cut`   |
| Goat Neck                 | `shank_hock_bone_cut` |
| Goat Shank                | `shank_hock_bone_cut` |

# Sausages & Similar Items

| Meat                  | Weight Profile      |
| --------------------- | ------------------- |
| Breakfast Sausage     | `sausage_processed` |
| Pork Sausage Links    | `sausage_processed` |
| Pork Sausage Patties  | `sausage_processed` |
| Bulk Pork Sausage     | `ground_bulk`       |
| Italian Sausage       | `sausage_processed` |
| Sweet Italian Sausage | `sausage_processed` |
| Hot Italian Sausage   | `sausage_processed` |
| Bratwurst             | `sausage_processed` |
| Kielbasa              | `sausage_processed` |
| Polish Sausage        | `sausage_processed` |
| Smoked Sausage        | `sausage_processed` |
| Andouille Sausage     | `sausage_processed` |
| Chorizo               | `sausage_processed` |
| Beef Sausage          | `sausage_processed` |
| Chicken Sausage       | `sausage_processed` |
| Turkey Sausage        | `sausage_processed` |
| Lamb Sausage          | `sausage_processed` |
| Knockwurst            | `sausage_processed` |
| Liverwurst            | `sausage_processed` |
| Blood Sausage         | `sausage_processed` |
| Summer Sausage        | `cured_dense_slab`  |
| Hot Dogs / Franks     | `sausage_processed` |
| Beef Franks           | `sausage_processed` |
| Cocktail Sausages     | `sausage_processed` |
| Meatballs             | `ground_bulk`       |
| Meatloaf Mix          | `ground_bulk`       |
| Bologna               | `sausage_processed` |
| Salami                | `cured_dense_slab`  |
| Pepperoni             | `cured_dense_slab`  |

# Deli & Cured Meats

| Meat                  | Weight Profile       |
| --------------------- | -------------------- |
| Sliced Ham            | `cured_sliced_deli`  |
| Honey Ham             | `cured_sliced_deli`  |
| Black Forest Ham      | `cured_sliced_deli`  |
| Turkey Deli Meat      | `cured_sliced_deli`  |
| Chicken Deli Meat     | `cured_sliced_deli`  |
| Roast Beef Deli Meat  | `cured_sliced_deli`  |
| Pastrami              | `cured_dense_slab`   |
| Corned Beef Deli Meat | `cured_dense_slab`   |
| Mortadella            | `cured_dense_slab`   |
| Capicola              | `cured_dense_slab`   |
| Prosciutto            | `luxury_cured_dense` |
| Pancetta              | `cured_dense_slab`   |
| Canadian Bacon        | `cured_sliced_deli`  |
| Smoked Turkey         | `cured_dense_slab`   |
| Smoked Chicken        | `cured_dense_slab`   |
| Smoked Brisket        | `cured_dense_slab`   |
| Smoked Pork           | `cured_dense_slab`   |
| Jerky                 | `dried_dense`        |
| Beef Jerky            | `dried_dense`        |
| Turkey Jerky          | `dried_dense`        |
| Pork Jerky            | `dried_dense`        |
| Cured Beef            | `cured_dense_slab`   |
| Dried Sausage         | `dried_dense`        |

# Veal

| Meat           | Weight Profile        |
| -------------- | --------------------- |
| Ground Veal    | `ground_bulk`         |
| Veal Cutlets   | `premium_steak_cut`   |
| Veal Chops     | `premium_steak_cut`   |
| Veal Shank     | `shank_hock_bone_cut` |
| Veal Stew Meat | `small_cut_standard`  |
| Veal Shoulder  | `heavy_roast_cut`     |
| Veal Breast    | `large_cut_standard`  |
| Veal Liver     | `offal_medium`        |
| Veal Bones     | `shank_hock_bone_cut` |

# Game & Specialty Meats

| Meat              | Weight Profile       |
| ----------------- | -------------------- |
| Ground Bison      | `ground_bulk`        |
| Bison Steak       | `game_steak_cut`     |
| Bison Roast       | `game_large_cut`     |
| Bison Ribs        | `ribs_rack`          |
| Venison Stew Meat | `small_cut_standard` |
| Ground Venison    | `ground_bulk`        |
| Venison Steak     | `game_steak_cut`     |
| Venison Roast     | `game_large_cut`     |
| Elk Steak         | `game_steak_cut`     |
| Ground Elk        | `ground_bulk`        |
| Elk Roast         | `game_large_cut`     |
| Rabbit Meat       | `game_small_whole`   |
| Rabbit Legs       | `small_cut_standard` |
| Whole Rabbit      | `game_small_whole`   |
| Wild Boar Meat    | `game_large_cut`     |
| Ground Wild Boar  | `ground_bulk`        |
| Wild Boar Sausage | `sausage_processed`  |
| Ostrich Steak     | `game_steak_cut`     |
| Ground Ostrich    | `ground_bulk`        |
| Kangaroo Meat     | `game_steak_cut`     |
| Alligator Meat    | `game_large_cut`     |

# Luxury & Specialty Meats

| Meat                             | Weight Profile                      |
| -------------------------------- | ----------------------------------- |
| Foie Gras                        | `luxury_small_medium_high_variance` |
| Duck Prosciutto                  | `luxury_cured_dense`                |
| Dry-Aged Ribeye                  | `luxury_premium_steak`              |
| Dry-Aged New York Strip          | `luxury_premium_steak`              |
| Prime Beef Tenderloin            | `luxury_premium_steak`              |
| Prime Ribeye Steak               | `luxury_premium_steak`              |
| Prime New York Strip Steak       | `luxury_premium_steak`              |
| American / Australian Wagyu Beef | `luxury_premium_steak`              |
| Wagyu Ground Beef                | `ground_bulk`                       |
| Wagyu Ribeye                     | `luxury_premium_steak`              |
| Wagyu Strip Steak                | `luxury_premium_steak`              |
| Jamon Iberico de Bellota         | `luxury_cured_dense`                |
| A5 Japanese Wagyu Beef           | `luxury_small_medium_high_variance` |
| A5 Japanese Kobe Beef            | `luxury_small_medium_high_variance` |

# Seafood

| Meat            | Weight Profile      |
| --------------- | ------------------- |
| Tilapia Fillet  | `seafood_fillet`    |
| Catfish Fillet  | `seafood_fillet`    |
| Cod Fillet      | `seafood_fillet`    |
| Pollock Fillet  | `seafood_fillet`    |
| Salmon Fillet   | `seafood_fillet`    |
| Tuna Steak      | `seafood_steak`     |
| Swordfish Steak | `seafood_steak`     |
| Halibut Fillet  | `seafood_fillet`    |
| Shrimp          | `shellfish_small`   |
| Scallops        | `shellfish_premium` |
| Crab Meat       | `shellfish_premium` |
| Lobster Meat    | `shellfish_premium` |
| Clams           | `shellfish_small`   |
| Mussels         | `shellfish_small`   |
| Oysters         | `shellfish_small`   |
| Squid           | `cephalopod_medium` |
| Octopus         | `cephalopod_medium` |

## Weight Profile Parameters

These parameters are the concrete roll inputs used by the implementation.

| Profile ID | Body Min Kg | Body Max Kg | Body Shape | Large Threshold Kg | Heavy Threshold Kg | Massive Threshold Kg | Tail Chance | Tail Anchor Kg | Tail Alpha |
| ---------- | ----------: | ----------: | ---------: | -----------------: | -----------------: | -------------------: | ----------: | -------------: | ---------: |
| `tiny_part_jackpot_possible` | 0.05 | 0.35 | 1.70 | 0.20 | 0.35 | 0.75 | 0.02500 | 2 | 1.35 |
| `small_cut_standard` | 0.25 | 1.25 | 1.25 | 0.90 | 1.25 | 2.50 | 0.01000 | 5 | 1.80 |
| `medium_cut_standard` | 0.50 | 2.50 | 1.00 | 1.60 | 2.50 | 5.00 | 0.01000 | 5 | 1.80 |
| `large_cut_standard` | 1.00 | 4.00 | 0.90 | 2.50 | 4.00 | 8.00 | 0.01000 | 8 | 1.80 |
| `heavy_roast_cut` | 2.00 | 8.00 | 0.85 | 4.00 | 8.00 | 16.00 | 0.01000 | 25 | 1.80 |
| `premium_steak_cut` | 0.30 | 2.20 | 1.20 | 1.40 | 2.20 | 4.00 | 0.00800 | 8 | 1.70 |
| `ribs_rack` | 0.80 | 4.50 | 0.95 | 2.50 | 4.50 | 9.00 | 0.01000 | 12 | 1.75 |
| `shank_hock_bone_cut` | 0.40 | 3.00 | 1.10 | 1.80 | 3.00 | 6.00 | 0.01000 | 8 | 1.75 |
| `offal_small` | 0.05 | 0.50 | 1.35 | 0.30 | 0.50 | 1.00 | 0.01000 | 3 | 1.70 |
| `offal_medium` | 0.20 | 1.50 | 1.15 | 0.90 | 1.50 | 3.00 | 0.01000 | 5 | 1.75 |
| `whole_bird_small` | 0.50 | 2.00 | 1.00 | 1.30 | 2.00 | 4.00 | 0.01000 | 8 | 1.75 |
| `whole_bird_medium` | 1.50 | 6.00 | 0.95 | 3.50 | 6.00 | 12.00 | 0.01000 | 18 | 1.75 |
| `whole_bird_large` | 4.00 | 16.00 | 0.90 | 9.00 | 16.00 | 32.00 | 0.01000 | 35 | 1.75 |
| `ground_bulk` | 0.50 | 5.00 | 0.95 | 2.50 | 5.00 | 10.00 | 0.00800 | 10 | 1.80 |
| `sausage_processed` | 0.10 | 1.50 | 1.10 | 0.90 | 1.50 | 3.00 | 0.00800 | 5 | 1.80 |
| `cured_sliced_deli` | 0.05 | 0.80 | 1.20 | 0.45 | 0.80 | 1.60 | 0.00600 | 3 | 1.80 |
| `cured_dense_slab` | 0.30 | 4.00 | 1.00 | 2.00 | 4.00 | 8.00 | 0.00800 | 12 | 1.80 |
| `dried_dense` | 0.05 | 1.00 | 1.25 | 0.55 | 1.00 | 2.00 | 0.00600 | 4 | 1.80 |
| `fatty_slab_cut` | 0.30 | 3.00 | 1.00 | 1.80 | 3.00 | 6.00 | 0.00800 | 8 | 1.75 |
| `seafood_fillet` | 0.20 | 1.80 | 1.10 | 1.00 | 1.80 | 3.50 | 0.00800 | 5 | 1.75 |
| `seafood_steak` | 0.40 | 2.50 | 1.00 | 1.50 | 2.50 | 5.00 | 0.00800 | 7 | 1.75 |
| `shellfish_small` | 0.02 | 0.20 | 1.40 | 0.12 | 0.20 | 0.50 | 0.01000 | 2 | 1.70 |
| `shellfish_premium` | 0.05 | 0.80 | 1.25 | 0.45 | 0.80 | 1.60 | 0.00800 | 4 | 1.70 |
| `cephalopod_medium` | 0.20 | 2.50 | 1.05 | 1.40 | 2.50 | 5.00 | 0.00800 | 7 | 1.75 |
| `game_small_whole` | 0.40 | 2.50 | 1.00 | 1.50 | 2.50 | 5.00 | 0.00800 | 7 | 1.75 |
| `game_large_cut` | 2.00 | 10.00 | 0.90 | 5.00 | 10.00 | 20.00 | 0.00800 | 25 | 1.75 |
| `game_steak_cut` | 0.40 | 3.00 | 1.00 | 1.80 | 3.00 | 6.00 | 0.00800 | 8 | 1.70 |
| `luxury_premium_steak` | 0.20 | 1.80 | 1.30 | 1.00 | 1.80 | 4.00 | 0.00400 | 10 | 1.60 |
| `luxury_small_medium_high_variance` | 0.10 | 1.20 | 1.45 | 0.70 | 1.20 | 3.00 | 0.00001 | 50000 | 1.45 |
| `luxury_cured_dense` | 0.05 | 0.80 | 1.40 | 0.45 | 0.80 | 2.00 | 0.00200 | 10000 | 1.55 |

# Recommended Notes

## Do Not Use One Weight Profile for Every Category

Do not make all poultry use one poultry profile.

That would make Chicken Feet, Whole Chicken, Chicken Breast, and Whole Turkey too similar.

Use cut type and physical form, not only category.

Correct:

```text
Chicken Feet = tiny_part_jackpot_possible
Chicken Breast = medium_cut_standard
Whole Chicken = whole_bird_medium
Whole Turkey = whole_bird_large
```

## Keep Jackpot Possible for All Profiles

Every profile should allow jackpot rolls.

The difference is probability and normal range.

Correct:

```text
Chicken Feet can jackpot, but usually tiny/small.
Beef Brisket can jackpot, but usually medium/heavy.
A5 Kobe can jackpot, but extreme jackpot should be ultra rare.
```

## Weight Profile Should Not Control Base Meat Value

Weight profile controls spawned weight behavior.

Base meat value controls normal selling strength.

Purchase price controls access.

These three systems should stay separate.

```text
Purchase Price = cost to roll
Base Meat Value = selling strength per spawned-weight unit
Weight Profile = spawned-weight behavior
```

## Best Next Step

After this mapping is accepted, the next document should define the actual `weight_profiles.json` structure, including:

```text
profileId
normalWeightRange
tierBiasTable
tierRangeTable
jackpotChanceModifier
extremeJackpotChanceModifier
```
