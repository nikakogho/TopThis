# Card content

Runtime card definitions are data-driven. Every resolved definition requires
`id`, `name`, `rarity`, `masterPoolCopies`, `iconPath`, `description`, `tags` and
an explicit `beatsDefinitionIds` array. Rarity is presentation and
categorization only; it never creates a legal play.

## Catalog and copy counts

| Definition ID         | Rarity    |  Copies | Status      |
| --------------------- | --------- | ------: | ----------- |
| water.common          | common    |      30 | required    |
| water.rare            | rare      |      25 | required    |
| water.epic            | epic      |      18 | required    |
| water.legendary       | legendary |       9 | required    |
| fire.common           | common    |      30 | required    |
| fire.rare             | rare      |      25 | required    |
| fire.epic             | epic      |      18 | required    |
| fire.legendary        | legendary |       9 | required    |
| gun.rare              | rare      |      18 | required    |
| rust.common           | common    |      24 | required    |
| dirt.common           | common    |      28 | required    |
| mouse.common          | common    |      22 | required    |
| cat.common            | common    |      22 | required    |
| dog.common            | common    |      22 | required    |
| cloud.common          | common    |      22 | required    |
| sun.rare              | rare      |      18 | required    |
| rocket.epic           | epic      |      12 | required    |
| sea.epic              | epic      |      12 | required    |
| ice.common            | common    |      12 | provisional |
| lightning.rare        | rare      |      10 | provisional |
| plant.common          | common    |       9 | provisional |
| tornado.legendary     | legendary |       4 | required    |
| meteor.legendary      | legendary |       1 | required    |
| **Master-pool total** |           | **400** |             |

Water and Fire relationships are explicit by tier in the resolved artifact.
Equal tiers mutually beat each other, but no generic rarity operation exists.

Mouse, Cat and Dog carry the `animal` and `living-creature` tags. Provisional
Plant is also a `living-creature`. Authored Fire definitions target `animal`,
and Gun targets `living-creature`; content resolution expands those tags to
explicit IDs. All other required named relationships are direct authored IDs.

The provisional relationships are:

- Ice beats `fire.common` and `fire.rare`.
- Lightning beats `cloud.common`, `sea.epic` and `water.common`.
- Plant beats `dirt.common` and `water.common`.
- Gun beating Plant is the required consequence of Plant's provisional
  `living-creature` classification.

Tornado has four instances and explicitly beats every definition except Meteor,
including Tornado. Meteor has one instance, explicitly beats every other
definition and is absent from every other beating list.

## Authoring and resolution

`content/cards.authored.json` is the editable source. It may combine direct
`beatsDefinitionIds` with authoring-only `beatsTags`. Resolution finds every
definition carrying a referenced tag, merges those IDs with direct edges,
deduplicates and validates them, then writes the runtime-only
`content/cards.json` artifact.

Tests independently resolve the authored catalog, normalize relationship order
and deep-compare it with the committed runtime artifact. Validation also checks
required fields, rarity values, unique IDs, positive copies, exactly 400 pool
instances, four Tornados, one Meteor, icon paths, resolved references, duplicate
edges and the complete Tornado/Meteor invariants.

## Artwork replacement

Final artwork belongs at
`apps/web/public/cards/<definition-id>.png`, for example
`apps/web/public/cards/water.common.png`. Source artwork is a square 1024x1024
PNG. A replacement keeps the exact definition-based filename, dimensions and
format; content validation and a visual check run before merging.

Missing or invalid artwork never blocks startup or play. The client renders a
deterministic SVG/CSS fallback derived from the definition ID, containing the
card name, rarity and an abstract symbol. The image exposes accessible alt text
with the card name.
