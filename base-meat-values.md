# Complete Meat Price List with Base Meat Values

This catalog adds **Base Meat Value** to the existing fixed meat purchase-price list. Purchase price remains the cost to roll the meat item. Base Meat Value is the normal selling-strength value used by the selling formula after spawned weight is known.

## Selling Formula

```text
Selling Price = Spawned Weight × Base Meat Value × Cooking State Multiplier × Equipment Multiplier × Final Seasoning Multiplier × Other Bonuses
```

Expanded version:

```text
Selling Price = Spawned Weight × Base Meat Value × Meat Category Multiplier × Cooking State Multiplier × Doneness Multiplier × Equipment Multiplier × Final Seasoning Multiplier × Quality Multiplier × Event Multiplier × Other Bonuses
```

## Base Meat Value Rule

* Purchase Price = fixed cost to buy/roll the meat item.
* Base Meat Value = normal selling strength per spawned-weight unit.
* Base Meat Value is **not** an added purchase charge and is **not** a per-pound or per-kilogram purchase price.
* Cheap starter meat has low base value but remains viable through lucky weight rolls and equipment.
* Luxury meat has much higher base value but still depends on weight probability and multipliers.

## Value Scale

| Price / Access Tier | Approximate Base Meat Value Role |
|---|---:|
| Starter | $2.00–$5.50 |
| Starter-Adjacent | $5.50–$10.00 |
| Basic | $10.00–$55.00 |
| Common Upgrade | $55.00–$400.00 |
| Specialty | $400.00–$2,400.00 |
| Luxury | $2,400.00–$85,000.00 |
| Extreme Luxury | $85,000.00–$250,000.00 |

## Full Meat Catalog

### Poultry

| Meat | Purchase Price | Base Meat Value | Tier | Starter-Only |
|---|---:|---:|---|---|
| Chicken Legs / Drumsticks | $120.00 | $3.75 | Starter | Yes |
| Whole Chicken | $210.00 | $4.90 | Starter | Yes |
| Chicken Leg Quarters | $90.00 | $3.40 | Starter | Yes |
| Chicken Thighs | $160.00 | $4.35 | Starter | Yes |
| Chicken Wings | $320.00 | $6.10 | Starter-Adjacent | No |
| Chicken Breast (Bone-in) | $430.00 | $7.53 | Starter-Adjacent | No |
| Chicken Breast (Boneless) | $620.00 | $8.81 | Starter-Adjacent | No |
| Chicken Tenderloins | $850.00 | $10.60 | Starter-Adjacent | No |
| Chicken Cutlets | $1,150.00 | $11.06 | Basic | No |
| Ground Chicken | $480.00 | $6.09 | Starter-Adjacent | No |
| Chicken Liver | $45.00 | $2.60 | Starter | Yes |
| Chicken Gizzards | $60.00 | $3.00 | Starter | Yes |
| Chicken Hearts | $85.00 | $3.40 | Starter | Yes |
| Chicken Feet | $25.00 | $2.00 | Starter | Yes |
| Whole Turkey | $1,700.00 | $14.07 | Basic | No |
| Turkey Breast | $3,200.00 | $25.62 | Basic | No |
| Turkey Drumsticks | $950.00 | $9.76 | Starter-Adjacent | No |
| Turkey Thighs | $1,350.00 | $12.46 | Basic | No |
| Turkey Wings | $1,100.00 | $10.70 | Basic | No |
| Turkey Cutlets | $4,400.00 | $29.87 | Basic | No |
| Ground Turkey | $1,900.00 | $13.45 | Basic | No |
| Cornish Hen | $3,800.00 | $25.53 | Basic | No |
| Duck Breast | $16,500.00 | $91.71 | Common Upgrade | No |
| Duck Legs | $9,800.00 | $54.05 | Basic | No |
| Whole Duck | $8,200.00 | $45.11 | Basic | No |
| Goose | $21,000.00 | $99.02 | Common Upgrade | No |
| Quail | $28,000.00 | $126.88 | Common Upgrade | No |
| Pheasant | $36,000.00 | $157.56 | Common Upgrade | No |
### Pork

| Meat | Purchase Price | Base Meat Value | Tier | Starter-Only |
|---|---:|---:|---|---|
| Pork Chops (Bone-in) | $2,200.00 | $18.45 | Basic | No |
| Pork Chops (Boneless) | $3,100.00 | $23.78 | Basic | No |
| Ground Pork | $1,250.00 | $10.17 | Basic | No |
| Pork Loin | $2,850.00 | $22.34 | Basic | No |
| Pork Tenderloin | $8,500.00 | $57.20 | Basic | No |
| Pork Shoulder / Boston Butt | $980.00 | $10.20 | Starter-Adjacent | No |
| Picnic Shoulder | $760.00 | $9.14 | Starter-Adjacent | No |
| Fresh Ham | $1,600.00 | $14.57 | Basic | No |
| Ham Steak | $3,800.00 | $31.52 | Basic | No |
| Pork Belly | $7,600.00 | $46.19 | Basic | No |
| Bacon | $12,500.00 | $65.33 | Common Upgrade | No |
| Pork Spare Ribs | $3,400.00 | $25.46 | Basic | No |
| Baby Back Ribs | $9,500.00 | $54.49 | Basic | No |
| Country-Style Pork Ribs | $2,450.00 | $19.98 | Basic | No |
| Pork Cutlets | $3,700.00 | $27.11 | Basic | No |
| Diced Pork / Pork Stew Meat | $1,950.00 | $14.14 | Basic | No |
| Pork Hock / Ham Hock | $900.00 | $9.83 | Starter-Adjacent | No |
| Pork Neck Bones | $210.00 | $4.80 | Starter | Yes |
| Pork Jowl | $4,800.00 | $32.87 | Basic | No |
| Pork Fatback | $380.00 | $5.04 | Starter-Adjacent | No |
| Salt Pork | $5,400.00 | $34.16 | Basic | No |
| Pork Liver | $140.00 | $4.00 | Starter | Yes |
| Pork Heart | $230.00 | $4.47 | Starter | No |
| Pork Feet | $180.00 | $4.50 | Starter | Yes |
| Pork Cheeks | $15,000.00 | $80.26 | Common Upgrade | No |
| Pork Skin | $75.00 | $2.70 | Starter | Yes |
| Pork Rib Tips | $1,800.00 | $15.14 | Basic | No |
| Pork Sirloin Roast | $2,650.00 | $24.14 | Basic | No |
| Smoked Ham | $8,800.00 | $58.69 | Basic | No |
| Cured Ham | $18,500.00 | $109.62 | Common Upgrade | No |
### Beef

| Meat | Purchase Price | Base Meat Value | Tier | Starter-Only |
|---|---:|---:|---|---|
| Ground Beef | $2,800.00 | $18.00 | Basic | No |
| Ground Chuck | $3,600.00 | $22.72 | Basic | No |
| Ground Sirloin | $5,800.00 | $38.71 | Basic | No |
| Beef Shank | $6,500.00 | $41.98 | Basic | No |
| Beef Stew Meat | $4,900.00 | $28.54 | Basic | No |
| Beef Chuck Roast | $9,800.00 | $56.89 | Basic | No |
| Beef Brisket | $18,000.00 | $95.83 | Common Upgrade | No |
| Beef Short Ribs | $32,000.00 | $157.34 | Common Upgrade | No |
| Beef Back Ribs | $8,200.00 | $49.86 | Basic | No |
| Beef Rib Roast | $95,000.00 | $401.84 | Common Upgrade | No |
| Prime Rib Roast | $180,000.00 | $756.48 | Specialty | No |
| Sirloin Steak | $42,000.00 | $226.73 | Common Upgrade | No |
| Top Sirloin Steak | $27,000.00 | $154.94 | Common Upgrade | No |
| Flank Steak | $52,000.00 | $259.56 | Common Upgrade | No |
| Skirt Steak | $58,000.00 | $285.17 | Common Upgrade | No |
| Ribeye Steak | $120,000.00 | $525.51 | Specialty | No |
| New York Strip Steak | $145,000.00 | $608.88 | Specialty | No |
| Filet Mignon | $350,000.00 | $1,208.74 | Specialty | No |
| T-Bone Steak | $88,000.00 | $408.44 | Common Upgrade | No |
| Porterhouse Steak | $135,000.00 | $575.95 | Specialty | No |
| Flat Iron Steak | $24,000.00 | $133.32 | Common Upgrade | No |
| Hanger Steak | $45,000.00 | $229.16 | Common Upgrade | No |
| Tri-Tip Roast | $22,000.00 | $113.92 | Common Upgrade | No |
| Top Round Roast | $4,800.00 | $33.54 | Basic | No |
| Eye of Round Roast | $6,800.00 | $43.41 | Basic | No |
| Bottom Round Steak | $3,900.00 | $31.23 | Basic | No |
| Rump Roast | $5,600.00 | $37.59 | Basic | No |
| Arm Roast | $5,200.00 | $35.59 | Basic | No |
| Cube Steak | $7,200.00 | $49.16 | Basic | No |
| Minute Steak | $8,400.00 | $55.11 | Basic | No |
| Beef Oxtail | $38,000.00 | $173.76 | Common Upgrade | No |
| Beef Liver | $680.00 | $7.28 | Starter-Adjacent | No |
| Beef Heart | $900.00 | $8.22 | Starter-Adjacent | No |
| Beef Tongue | $28,000.00 | $140.24 | Common Upgrade | No |
| Beef Cheeks | $22,000.00 | $113.92 | Common Upgrade | No |
| Beef Tripe | $1,250.00 | $9.20 | Basic | No |
| Beef Neck Bones | $720.00 | $6.77 | Starter-Adjacent | No |
| Beef Marrow Bones | $7,500.00 | $34.67 | Basic | No |
| Corned Beef Brisket | $24,000.00 | $122.79 | Common Upgrade | No |
| Beef Suet | $420.00 | $5.37 | Starter-Adjacent | No |
| Beef Kidney | $540.00 | $5.98 | Starter-Adjacent | No |
| Beef Spleen | $480.00 | $5.68 | Starter-Adjacent | No |
| Beef Tendon | $6,200.00 | $40.54 | Basic | No |
### Lamb & Goat

| Meat | Purchase Price | Base Meat Value | Tier | Starter-Only |
|---|---:|---:|---|---|
| Ground Lamb | $18,000.00 | $83.53 | Common Upgrade | No |
| Lamb Shoulder | $32,000.00 | $163.63 | Common Upgrade | No |
| Lamb Chops / Rack of Lamb | $150,000.00 | $682.67 | Specialty | No |
| Lamb Leg | $55,000.00 | $260.95 | Common Upgrade | No |
| Lamb Shank | $26,000.00 | $136.83 | Common Upgrade | No |
| Lamb Stew Meat | $20,000.00 | $91.47 | Common Upgrade | No |
| Lamb Ribs | $24,000.00 | $127.71 | Common Upgrade | No |
| Lamb Loin Chops | $120,000.00 | $503.38 | Specialty | No |
| Lamb Breast | $9,500.00 | $62.78 | Basic | No |
| Lamb Neck | $7,200.00 | $44.85 | Basic | No |
| Lamb Sirloin | $70,000.00 | $366.19 | Common Upgrade | No |
| Lamb Liver | $2,700.00 | $18.66 | Basic | No |
| Lamb Heart | $2,200.00 | $16.03 | Basic | No |
| Mutton | $11,000.00 | $62.10 | Common Upgrade | No |
| Goat Meat | $28,000.00 | $138.90 | Common Upgrade | No |
| Ground Goat | $15,000.00 | $71.39 | Common Upgrade | No |
| Goat Shoulder | $12,500.00 | $72.79 | Common Upgrade | No |
| Goat Leg | $26,000.00 | $136.83 | Common Upgrade | No |
| Goat Ribs | $10,500.00 | $62.64 | Common Upgrade | No |
| Goat Stew Meat | $14,000.00 | $67.27 | Common Upgrade | No |
| Goat Chops | $85,000.00 | $379.72 | Common Upgrade | No |
| Goat Neck | $6,000.00 | $39.19 | Basic | No |
| Goat Shank | $8,800.00 | $54.64 | Basic | No |
### Sausages & Similar Items

| Meat | Purchase Price | Base Meat Value | Tier | Starter-Only |
|---|---:|---:|---|---|
| Breakfast Sausage | $1,150.00 | $10.65 | Basic | No |
| Pork Sausage Links | $1,650.00 | $13.91 | Basic | No |
| Pork Sausage Patties | $1,850.00 | $15.14 | Basic | No |
| Bulk Pork Sausage | $950.00 | $8.26 | Starter-Adjacent | No |
| Italian Sausage | $3,200.00 | $22.71 | Basic | No |
| Sweet Italian Sausage | $3,600.00 | $24.78 | Basic | No |
| Hot Italian Sausage | $4,000.00 | $26.79 | Basic | No |
| Bratwurst | $5,800.00 | $35.28 | Basic | No |
| Kielbasa | $5,200.00 | $32.54 | Basic | No |
| Polish Sausage | $6,400.00 | $37.94 | Basic | No |
| Smoked Sausage | $4,800.00 | $34.96 | Basic | No |
| Andouille Sausage | $18,000.00 | $87.62 | Common Upgrade | No |
| Chorizo | $12,500.00 | $63.99 | Common Upgrade | No |
| Beef Sausage | $20,000.00 | $95.95 | Common Upgrade | No |
| Chicken Sausage | $4,200.00 | $27.78 | Basic | No |
| Turkey Sausage | $3,400.00 | $23.76 | Basic | No |
| Lamb Sausage | $55,000.00 | $229.40 | Common Upgrade | No |
| Knockwurst | $14,000.00 | $70.56 | Common Upgrade | No |
| Liverwurst | $6,800.00 | $34.13 | Basic | No |
| Blood Sausage | $16,000.00 | $79.16 | Common Upgrade | No |
| Summer Sausage | $48,000.00 | $204.01 | Common Upgrade | No |
| Hot Dogs / Franks | $360.00 | $6.00 | Starter-Adjacent | Yes |
| Beef Franks | $2,800.00 | $18.11 | Basic | No |
| Cocktail Sausages | $6,200.00 | $32.61 | Basic | No |
| Meatballs | $4,800.00 | $30.66 | Basic | No |
| Meatloaf Mix | $3,200.00 | $19.99 | Basic | No |
| Bologna | $240.00 | $5.20 | Starter | Yes |
| Salami | $80,000.00 | $361.18 | Common Upgrade | No |
| Pepperoni | $58,000.00 | $273.77 | Common Upgrade | No |
### Deli & Cured Meats

| Meat | Purchase Price | Base Meat Value | Tier | Starter-Only |
|---|---:|---:|---|---|
| Sliced Ham | $9,500.00 | $60.05 | Basic | No |
| Honey Ham | $14,000.00 | $83.35 | Common Upgrade | No |
| Black Forest Ham | $20,000.00 | $113.34 | Common Upgrade | No |
| Turkey Deli Meat | $12,500.00 | $71.99 | Common Upgrade | No |
| Chicken Deli Meat | $8,800.00 | $54.04 | Basic | No |
| Roast Beef Deli Meat | $55,000.00 | $270.98 | Common Upgrade | No |
| Pastrami | $120,000.00 | $567.55 | Specialty | No |
| Corned Beef Deli Meat | $75,000.00 | $337.15 | Common Upgrade | No |
| Mortadella | $28,000.00 | $144.25 | Common Upgrade | No |
| Capicola | $95,000.00 | $413.32 | Common Upgrade | No |
| Prosciutto | $650,000.00 | $2,113.29 | Specialty | No |
| Pancetta | $220,000.00 | $909.59 | Specialty | No |
| Canadian Bacon | $18,000.00 | $98.57 | Common Upgrade | No |
| Smoked Turkey | $32,000.00 | $184.49 | Common Upgrade | No |
| Smoked Chicken | $24,000.00 | $143.99 | Common Upgrade | No |
| Smoked Brisket | $480,000.00 | $1,752.62 | Specialty | No |
| Smoked Pork | $60,000.00 | $317.12 | Common Upgrade | No |
| Jerky | $1,400,000.00 | $3,515.61 | Luxury | No |
| Beef Jerky | $2,200,000.00 | $4,439.84 | Luxury | No |
| Turkey Jerky | $850,000.00 | $2,603.86 | Specialty | No |
| Pork Jerky | $680,000.00 | $2,188.80 | Specialty | No |
| Cured Beef | $350,000.00 | $1,305.44 | Specialty | No |
| Dried Sausage | $180,000.00 | $682.53 | Specialty | No |
### Veal

| Meat | Purchase Price | Base Meat Value | Tier | Starter-Only |
|---|---:|---:|---|---|
| Ground Veal | $35,000.00 | $156.70 | Common Upgrade | No |
| Veal Cutlets | $140,000.00 | $600.28 | Specialty | No |
| Veal Chops | $260,000.00 | $971.75 | Specialty | No |
| Veal Shank | $75,000.00 | $360.56 | Common Upgrade | No |
| Veal Stew Meat | $42,000.00 | $183.35 | Common Upgrade | No |
| Veal Shoulder | $32,000.00 | $173.07 | Common Upgrade | No |
| Veal Breast | $18,500.00 | $117.19 | Common Upgrade | No |
| Veal Liver | $12,000.00 | $60.88 | Common Upgrade | No |
| Veal Bones | $5,200.00 | $29.08 | Basic | No |
### Game & Specialty Meats

| Meat | Purchase Price | Base Meat Value | Tier | Starter-Only |
|---|---:|---:|---|---|
| Ground Bison | $85,000.00 | $351.90 | Common Upgrade | No |
| Bison Steak | $480,000.00 | $1,777.34 | Specialty | No |
| Bison Roast | $260,000.00 | $1,015.92 | Specialty | No |
| Bison Ribs | $180,000.00 | $763.11 | Specialty | No |
| Venison Stew Meat | $42,000.00 | $191.69 | Common Upgrade | No |
| Ground Venison | $32,000.00 | $151.65 | Common Upgrade | No |
| Venison Steak | $350,000.00 | $1,390.05 | Specialty | No |
| Venison Roast | $150,000.00 | $662.17 | Specialty | No |
| Elk Steak | $520,000.00 | $1,891.57 | Specialty | No |
| Ground Elk | $95,000.00 | $387.30 | Common Upgrade | No |
| Elk Roast | $240,000.00 | $954.57 | Specialty | No |
| Rabbit Meat | $15,000.00 | $89.70 | Common Upgrade | No |
| Rabbit Legs | $22,000.00 | $131.01 | Common Upgrade | No |
| Whole Rabbit | $12,000.00 | $74.01 | Common Upgrade | No |
| Wild Boar Meat | $110,000.00 | $495.41 | Specialty | No |
| Ground Wild Boar | $70,000.00 | $297.69 | Common Upgrade | No |
| Wild Boar Sausage | $220,000.00 | $849.60 | Specialty | No |
| Ostrich Steak | $780,000.00 | $2,593.27 | Specialty | No |
| Ground Ostrich | $210,000.00 | $721.07 | Specialty | No |
| Kangaroo Meat | $300,000.00 | $1,081.51 | Specialty | No |
| Alligator Meat | $420,000.00 | $1,405.21 | Specialty | No |
### Luxury & Specialty Meats

| Meat | Purchase Price | Base Meat Value | Tier | Starter-Only |
|---|---:|---:|---|---|
| Foie Gras | $9,500,000.00 | $11,049.74 | Luxury | No |
| Duck Prosciutto | $4,800,000.00 | $7,257.60 | Luxury | No |
| Dry-Aged Ribeye | $35,000,000.00 | $23,081.48 | Luxury | No |
| Dry-Aged New York Strip | $28,000,000.00 | $20,569.28 | Luxury | No |
| Prime Beef Tenderloin | $15,000,000.00 | $13,725.37 | Luxury | No |
| Prime Ribeye Steak | $12,500,000.00 | $11,897.21 | Luxury | No |
| Prime New York Strip Steak | $9,800,000.00 | $10,492.28 | Luxury | No |
| American / Australian Wagyu Beef | $180,000,000.00 | $50,475.61 | Luxury | No |
| Wagyu Ground Beef | $4,500,000.00 | $6,610.84 | Luxury | No |
| Wagyu Ribeye | $850,000,000.00 | $128,267.72 | Luxury | No |
| Wagyu Strip Steak | $720,000,000.00 | $117,731.25 | Luxury | No |
| Jamon Iberico de Bellota | $1,800,000,000.00 | $120,000.00 | Extreme Luxury | No |
| A5 Japanese Wagyu Beef | $5,500,000,000.00 | $190,000.00 | Extreme Luxury | No |
| A5 Japanese Kobe Beef | $12,500,000,000.00 | $250,000.00 | Extreme Luxury | No |
### Seafood

| Meat | Purchase Price | Base Meat Value | Tier | Starter-Only |
|---|---:|---:|---|---|
| Tilapia Fillet | $620.00 | $9.11 | Starter-Adjacent | No |
| Catfish Fillet | $850.00 | $10.44 | Starter-Adjacent | No |
| Cod Fillet | $2,800.00 | $24.00 | Basic | No |
| Pollock Fillet | $220.00 | $5.50 | Starter | Yes |
| Salmon Fillet | $18,000.00 | $102.22 | Common Upgrade | No |
| Tuna Steak | $42,000.00 | $241.85 | Common Upgrade | No |
| Swordfish Steak | $110,000.00 | $671.05 | Specialty | No |
| Halibut Fillet | $320,000.00 | $1,351.20 | Specialty | No |
| Shrimp | $8,500.00 | $54.62 | Basic | No |
| Scallops | $520,000.00 | $1,971.50 | Specialty | No |
| Crab Meat | $1,200,000.00 | $3,603.12 | Luxury | No |
| Lobster Meat | $6,800,000.00 | $8,824.68 | Luxury | No |
| Clams | $160.00 | $5.00 | Starter | Yes |
| Mussels | $120.00 | $4.50 | Starter | Yes |
| Oysters | $24,000.00 | $159.80 | Common Upgrade | No |
| Squid | $4,800.00 | $35.78 | Basic | No |
| Octopus | $65,000.00 | $309.08 | Common Upgrade | No |