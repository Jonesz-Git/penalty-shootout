# Penalty Shootout

A browser football game where human Kickers take penalty Kicks against a computer-controlled Keeper.

## Language

### The game

**Shootout**:
One complete game, from the first Kick to a final result. Either Solo or Two-Player.
_Avoid_: Match, round, session

**Solo Shootout**:
A one-Kicker Shootout that continues until the Kicker's first Save or Miss; the Kicker's result is their Streak.
_Avoid_: Single-player game, practice

**Two-Player Shootout**:
A Shootout between two Kickers who alternate Kicks: five each, then Sudden Death if level. It ends early once it is Decided.
_Avoid_: Versus, multiplayer

**Decided**:
The state of a Two-Player Shootout once one Kicker can no longer catch up with the Kicks remaining in regulation.
_Avoid_: Clinched, over

**Sudden Death**:
The phase after the regulation five Kicks each, in which Kickers take one Kick each until one scores and the other does not.
_Avoid_: Overtime, tiebreak

**Streak**:
The number of consecutive Goals scored in a Solo Shootout.
_Avoid_: Score, run

**Meter Speed**:
How fast the Power Meter sweeps; in a Solo Shootout it increases as the Streak grows, which is the only form of difficulty.
_Avoid_: Level, difficulty

**High Score**:
The longest Streak ever achieved on this device.
_Avoid_: Best, record

### People

**Kicker**:
A human player taking Kicks. Both players in a Two-Player Shootout are Kickers.
_Avoid_: Shooter, striker, player (when the role matters)

**Keeper**:
The computer-controlled goalkeeper who attempts to save every Kick. Never controlled by a human.
_Avoid_: Goalie, goalkeeper, AI

### Kicks

**Kick**:
A single attempt at goal by one Kicker.
_Avoid_: Shot, turn, attempt, penalty

**Aim Point**:
The exact spot on the goal the Kicker chooses before setting Power.
_Avoid_: Target, zone

**Power**:
How hard the Kicker strikes the ball, locked in by stopping the Power Meter.
_Avoid_: Strength, force

**Power Meter**:
The oscillating gauge the Kicker stops to choose Power.
_Avoid_: Power bar, gauge

**Weak**, **Clean**, **Over-hit**:
The three bands of Power. A Weak Kick is easy to save and may be Read, a Clean Kick goes exactly to the Aim Point, and an Over-hit Kick is hard to save but subject to Scatter.
_Avoid_: Low/medium/high power

**Scatter**:
The random deviation of an Over-hit Kick away from its Aim Point; it grows with Power and can cause a Miss.
_Avoid_: Spread, inaccuracy, wobble

**Dive Zone**:
One of six regions of the goal (left, centre or right; high or low) that the Keeper commits to for a Kick, chosen at random unless he Reads the Kick.
_Avoid_: Direction, side

**Read**:
When the Keeper sees a Weak Kick coming and dives to the Dive Zone the ball is heading for. The weaker the Kick, the more likely he is to Read it; Clean and Over-hit Kicks are never Read.
_Avoid_: Guess, anticipate

**Reach**:
The area around the Keeper's Dive Zone within which the ball is saved; it shrinks as Power increases.
_Avoid_: Range, coverage, hitbox

**Outcome**:
The result of a Kick: a Goal, a Save or a Miss.
_Avoid_: Result

**Goal**:
An Outcome where the ball gets past the Keeper into the net.

**Save**:
An Outcome where the Keeper stops the ball.
_Avoid_: Block

**Miss**:
An Outcome where the ball ends up outside the goal frame (wide or over the bar), without the Keeper touching it.
_Avoid_: Wide, off-target
