# AI Desktop Pet (Electron)

A small animated pet that lives on top of your desktop, visits you with short reminders
(water, stretch, break, check-in), and chats with you (offline or with OpenAI).

## Run it (no technical knowledge needed)
1. Install **Node.js** (LTS) from https://nodejs.org (one time only).
2. **Windows:** double-click `start.bat`. **Mac:** double-click `start.command`
   (first time: right-click > Open).
3. The first run downloads Electron (needs internet, ~1-2 minutes). The pet greets you after ~10 seconds.

## If the pet or button disappears
Double-click `bring-on-screen.bat` (Windows) or `bring-on-screen.command` (Mac).
It resets the summon button position and calls the pet back.

## Using the pet
- **Click the pet** to open a small chat; **click the round button** at the screen edge to summon the pet
  (drag it anywhere; it always stays on screen).
- **Tray icon** menu: Summon Pet, Chat, Settings, Pause Pet (30 min / 1 hour / until tomorrow / Resume), Quit.
- While paused or in quiet hours, automatic visits stop; manual summon still works.
- **Settings**: enable pet, visit frequency (5/10/15/30/60 min/custom), water frequency, check-ins, sound,
  animation speed, pet size, AI chat, API key, launch at startup, always on top, quiet hours.
  Everything is saved automatically.

## Use your own pet picture
Replace `assets/pet.png` with your character (transparent PNG, roughly square). If your character faces
left, set `FACES_RIGHT = false` at the top of `pet.js`. To use real sprite frames later, change the `<img>` source
in `pet.js` per animation state (the walk/blink/bob animations are separate CSS classes in `pet.html`).

## AI mode (optional)
1. Settings > paste your OpenAI API key > **Save** (stored encrypted via the OS keychain, never in the code).
2. Turn on **AI chat**. If the key is missing or the request fails, the pet falls back to Basic mode.

## Edit messages and personality
- `config/messages.json` - reminder messages and offline chat replies.
- `config/personality.json` - personality prompt, model and length.

## Build an executable (optional)
`npm run dist` creates a portable .exe (Windows) or .dmg (Mac) in the `dist` folder.

## Where data is saved
Settings, reminder timing, pet size, button position and quiet hours are in `petdata.json` inside the app's
user-data folder. Chat history is not saved.

## Files
`main.js` (windows, tray, scheduler, storage, AI) - `pet.html/js` (pet, animation, bubble, chat) -
`button.html/js` (summon button) - `settings.html/js` - `preload.js` (secure bridge) - `config/` - `assets/`
