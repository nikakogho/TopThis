# Card content

The runtime catalog is data-driven. Every resolved card has its identity,
presentation metadata, copy count and explicit `beatsDefinitionIds`; rarity and
tags never create a legal play.

## Catalog and copies

The 28 definitions total exactly 400 master-pool instances. The new cards are
Rock Common (12), Paper Common (12), Scissors Rare (10), Sponge Common (10) and
Magnet Rare (8). Their 52 copies come from Water Common -6, Fire Common -6,
Water Rare -4, Fire Rare -4, Rust -4, Dirt -6, Mouse/Cat/Dog -4 each, Cloud -4,
Sun -2, Gun -2 and Plant -2.

| ID                                                                       |                Copies |
| ------------------------------------------------------------------------ | --------------------: |
| water.common / water.rare / water.epic / water.legendary                 |      24 / 21 / 18 / 9 |
| fire.common / fire.rare / fire.epic / fire.legendary                     |      24 / 21 / 18 / 9 |
| gun.rare / rust.common / dirt.common                                     |          16 / 20 / 22 |
| mouse.common / cat.common / dog.common                                   |          18 / 18 / 18 |
| cloud.common / sun.rare / rocket.epic / sea.epic                         |     18 / 16 / 12 / 12 |
| ice.common / lightning.rare / plant.common                               |           12 / 10 / 7 |
| rock.common / paper.common / scissors.rare / sponge.common / magnet.rare | 12 / 12 / 10 / 10 / 8 |
| tornado.legendary / meteor.legendary                                     |                 4 / 1 |

## Counter graph

Rock smashes Scissors, animals, weapons, Magnet and every Fire. Paper covers
Rock and obstructs Sun, Cloud, Dirt and Gun. Scissors cuts Paper, Plant, Sponge,
Mouse and Cloud. Sponge absorbs every Water tier, Sea and Cloud, and collects
Dirt. Magnet diverts Gun, Rocket, Lightning, Scissors and Rust.

The reciprocal answers are explicit: Water erodes Rock and soaks Paper; Fire
burns Paper and Plant, dries Sponge and melts Ice; Rust ruins Magnet and
Scissors; Dirt clogs Sponge, buries Magnet and soils Paper. Mouse, Cat and Dog
damage Paper and Sponge while retaining their individual existing prey (Cat also
catches Mouse; Dog catches Mouse and its two lower Water tiers). Cloud smothers
every Fire and blocks Rocket; Sun disperses Cloud, melts Ice and dries Sponge;
Rocket blasts Rock, Paper, Plant, Sponge and Ice; Sea overwhelms every Fire,
Rock, Dirt, Plant, Magnet and Gun. Ice freezes every Water tier, Sea, Plant and
Sponge; Lightning overloads Magnet, Gun, Rocket, Plant, Scissors and Sponge;
Plant cracks Rock and grows through Paper, Sponge and Magnet.

Tornado explicitly beats every definition except Meteor, including all five new
definitions and Tornado itself. Meteor explicitly beats every other definition,
including all five new definitions. No other definition beats Meteor.

## Authoring and validation

`content/cards.authored.json` is editable source and may use authoring-only
`beatsTags`; `content/cards.json` is the committed runtime artifact with every
edge resolved to an ID. Fire's animal and Gun's living-creature relationships
are expanded during resolution; runtime never interprets tags.

Tests compare a fresh resolution with the runtime artifact and validate totals,
references, duplicate edges, all new/reciprocal families and Tornado/Meteor
invariants. `pnpm.cmd balance:check` runs a real-engine, always-first-legal
simulation over 40 seeds in each player count and enforces pile thresholds.
Use `pnpm.cmd balance:check -- --seeds=200` for release evidence.

## Artwork replacement

Artwork belongs at `apps/web/public/cards/<definition-id>.png` as a square
1024x1024 PNG. Missing artwork falls back to the deterministic accessible card
presentation.
