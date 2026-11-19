# Penalty Shootout

## Game Overview

Penalty Shootout is a football penalty-kicking game that runs in a web browser on desktop or mobile. Kickers aim, choose their Power, and strike the ball while a computer-controlled Keeper dives to try to make a Save. Terms in **bold** are defined in [GLOSSARY.md](./GLOSSARY.md).

## Modes

### Solo Shootout

- A single Kicker takes Kicks until their first **Save** or **Miss**.
- The result is the **Streak**: the number of consecutive **Goals**.
- The longest Streak is kept as the **High Score**, stored in this browser only (no accounts, no names).
- Difficulty rises with the Streak: the **Power Meter** sweeps faster (**Meter Speed**).

### Two-Player Shootout

- Two Kickers share one device (pass-and-play) and alternate Kicks.
- A coin toss decides who kicks first.
- Five Kicks each; if level, **Sudden Death** (one Kick each until one scores and the other does not).
- The Shootout ends early once it is **Decided** (one Kicker can no longer catch up).
- Kickers may enter names; defaults are "Player 1" and "Player 2". A banner shows whose Kick it is.
- Meter Speed is fixed.

## Taking a Kick

1. Click or tap anywhere on the goal to choose the **Aim Point**.
2. The Power Meter sweeps back and forth at a constant speed; click or tap again to lock in **Power**.
3. The ball flies while the Keeper dives (~0.6 s), and the **Outcome** is shown.

### Power bands

| Band | Meter | Effect |
|------|-------|--------|
| **Weak** | 0–50% | Ball goes to the Aim Point; slow, so the Keeper's Reach is large and he may **Read** it. |
| **Clean** | 50–65% | Ball goes to the Aim Point; Keeper's Reach is normal. |
| **Over-hit** | 65–100% | Fast, so the Keeper's Reach is small — but the ball **Scatters** randomly, more with more Power, and may leave the frame (a **Miss**). |

Thresholds are starting values, to be tuned by play-testing.

### The Keeper

- Always computer-controlled.
- When the ball is struck, the Keeper picks one of six **Dive Zones** (left / centre / right × high / low): roughly 20% centre, 80% split across the sides.
- Exception: he may **Read** a Weak Kick and dive straight to the Dive Zone the ball is heading for. The chance is 50% at zero Power, falling to 0% at the edge of Clean (so the right zone is ~60% likely for the weakest Kick). Clean and Over-hit Kicks are never Read.
- If the ball ends inside the goal and within the Keeper's **Reach** of the chosen Dive Zone, it is a Save; otherwise a Goal. Reach shrinks as Power increases.

## Screens

1. **Menu** — choose Solo or Two-Player, optional names for Two-Player, current High Score.
2. **Pitch** — behind-the-Kicker 2D view, scoreboard, "quit to Menu" button.
   - Two-Player scoreboard: TV-style row of five markers per Kicker (✓ Goal, ✗ Save/Miss), extending in Sudden Death.
   - Solo scoreboard: current Streak and High Score.
3. **Result** — final Streak (with "New High Score!" when earned) or the winner; "Play again" and "Menu".

## Presentation

- Flat 2D art (CSS/SVG), view from behind the Kicker.
- Sound effects (kick, crowd cheer, groan) with a mute toggle; muted by default.

## Technical

- TypeScript + Vite, no framework.
- Game rules live in a pure module with no DOM access and injected randomness, covered by Vitest unit tests. UI is verified manually.
- Deployed to GitHub Pages via GitHub Actions on every push to `main`.
