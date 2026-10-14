# FRONTLINE: BLACKSITE — Expansion Prompt

Build on the supplied FRONTLINE: BLACKSITE project into a polished cross-platform browser FPS. Keep the code modular and performant, use original visuals and names, and do not copy Call of Duty's protected maps, art, UI, sounds, logos, or exact layouts.

## Core requirements
- Real-time 3D first-person camera using Three.js/WebGL; player stands on the ground, has collision and gravity, and can look up/down/left/right with mouse or touch.
- PC and phone support, responsive HUD, keyboard/mouse input, mobile virtual movement and look sticks, fire, aim, reload, jump, and weapon switching.
- Node.js WebSocket multiplayer with shared room codes, player names, room map selection, synchronized player avatars/positions, damage, eliminations, respawning, and reasonable network rate limits.
- Three original maps: colorful compact suburban arena, industrial freight depot, and cargo harbor. Use fresh layouts and original low-poly art rather than recreating Nuketown.
- Weapons: SMG, assault rifle, pistol, shotgun, semi-automatic marksman rifle, and bolt-action sniper. Distinct rates of fire, ammo, reload durations, hit markers, recoil, and first-person low-poly view models.
- Blocky operators with multiple skins; XP/levels; unlockable loadouts and persistent local progression.
- Training mode with bots when no server is being joined; online mode should show a helpful connection status.
- Low-poly rendering, capped pixel ratio, efficient state updates, dispose transient effects, validate server inputs, and document deployment.

## Production-readiness follow-ups
- Server-side collision/world occlusion and line-of-sight hit validation; anti-cheat and rate limiting beyond the current prototype.
- Proper interpolation/client prediction and lag compensation, reconnect handling, lobby/ready states, server browser or invite links, and maximum room sizes.
- Automated smoke tests, accessibility options, key remapping, audio settings, low-graphics mode, and performance profiling on mobile devices.
- Never promise bug-free performance; identify untested areas clearly.
