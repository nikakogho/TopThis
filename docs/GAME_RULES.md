# Game rules

TopThis is a turn-based pile contest for two to four players. Card legality is
data-driven: a played card is legal only when its resolved
`beatsDefinitionIds` contains the current challenge definition ID. Rarity,
price, artwork and tags never create runtime legality.

## Match setup

The deterministic engine constructs all 400 physical card instances, shuffles
them from the match seed and selects the first 200 without replacement. It
chooses the initial round leader, deals ten cards to every player in documented
round-robin order, reveals one challenge owned by the leader and gives the first
turn to the next clockwise player.

The 200 unselected instances never enter the match. Meteor, Tornado or entire
families may therefore be absent; selected special cards may also remain
undrawn.

## Counter families

Rock, Paper, Scissors, Sponge and Magnet add dense natural counters. Their
relationships with Water, Fire, animals, weather, machines and Plant are all
explicit resolved catalog edges; rarity and tags still never create legality.
Tornado beats every definition except Meteor, while Meteor beats every other
definition.

## Turns and round completion

On a turn, a player either plays one legal card from their private hand or skips
without revealing whether a legal card was held. A legal play becomes the new
challenge, makes that player the current round leader, resets consecutive passes
and advances clockwise. A skip increments consecutive passes and advances
clockwise.

When every other active player has passed since the latest challenge, its owner
wins the round. The winner adds the entire table-pile size, including the
revealed challenge, to `capturedCardCount`. The engine exposes an explicit
`round_result` phase before the next round advances.

## Refill and the next round

Advancing a round refills one card at a time clockwise beginning with the
winner. It repeats that order until hands reach ten or the match deck is
exhausted. If a card remains, it becomes the next challenge owned by the
previous winner; the next clockwise player takes the first turn.

If too few cards remain, only players reached by that clockwise sequence draw.
If refill leaves no card to reveal, no new round begins.

## Match completion

The current round always completes before match-end checks. The match ends when
at least one player has reached the configured target captured-card score after
a round, or when no card remains to begin another round. Every player tied for
the highest captured-card score is a winner.

Defaults are a target score of 50, a 20-second server turn timer and a 60-second
server reconnection grace period.

## Matchmaking and ratings

Find Match uses an authenticated, deterministic FIFO queue for two-player
matches. The queue exposes only `queued`, `position` and `playersNeeded`; a
pair receives the same authoritative private-match runner, including hidden
hands, serialized commands, turn timeouts, reconnect grace and abandoned-seat
auto-skips. Queue events are `queue:enter`, `queue:leave` and `queue:status`.

Completed matches are persisted exactly once. For each player, Elo compares
every opponent using the standard expectation, with K = 24/(N-1), actual score
1, 0 or 0.5 from final score, and deterministic floor plus
largest-fractional-remainder zero-sum integer rounding. Unique first place
increments wins; tied first places increment ties; all lower places increment
losses. New guests start at rating 1000.

The leaderboard accepts page >= 1 and pageSize 1-100. Results sort by rating
descending, wins descending, games played ascending, display name, then guest ID
for stable pagination.

## Authority, timeouts and privacy

The deterministic engine calculates legal moves, turn order, round scoring and
winners. The server owns guest identity, command serialization, timers,
persistence and recipient-safe delivery. Clients send intentions only and never
receive another player's private hand.

Every gameplay command identifies the command, match and expected state/turn.
Duplicate, stale, wrong-player, wrong-match, illegal and post-completion commands
are deterministic no-ops with typed errors. A disconnect does not reveal or
alter hidden information. If a player action and server timeout race, the first
validated serialized command advances the state; the late command is rejected.
