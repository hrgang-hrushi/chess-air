# ♟️ Chess Air

A real-time local multiplayer chess web application built with React 19, Tailwind CSS v4, Vite, and Chess.js. Features room codes, live presence, spectator mode, and a sleek dark aesthetic.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![React: 19](https://img.shields.io/badge/React-19-61dafb.svg)
![Tailwind: v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)
![Vite: 7](https://img.shields.io/badge/Vite-7-646cff.svg)

---

## Features

- **Real-Time Local Multiplayer:** Play against a friend across browser tabs using zero external servers.
- **Room Code Sharing:** Instant room generation and copyable links to join matches.
- **Live Presence & Lobby:** Uses `BroadcastChannel` and `localStorage` storage events for instant state synchronization.
- **Spectator Mode:** Non-player peers automatically join matches in live spectator view.
- **Move Validation & History:** Powered by `chess.js` with full legal move generation, check/checkmate detection, and move log.
- **Glassmorphic UI:** Modern dark UI styled with Tailwind CSS v4, Inter, and Space Grotesk typography.

---

## Architecture

Chess Air operates using an offline-first, peer-to-peer tab messaging architecture:

```
[Tab A (Host: White)]  <--->  [BroadcastChannel: 'chess-air:lobby']  <--->  [Tab B (Guest: Black)]
         |                                                                      |
         +-------------------------> [localStorage State] <--------------------+
```

1. **Host Tab:** Creates a match with a unique 6-character room code.
2. **Guest Tab:** Joins via room code or direct link.
3. **Move Sync:** Game state transitions are broadcast across the channel and committed to local state with FEN history.

---

## Quickstart

### Prerequisites
- Node.js (v18+ recommended)
- npm or pnpm

### Installation

```bash
git clone https://github.com/hrgang-hrushi/chess-air.git
cd chess-air
npm install
```

### Running Locally

```bash
npm run dev
```

Open `http://localhost:5173` in two different browser tabs to start a multiplayer match!

### Building for Production

```bash
npm run build
```

---

## License

This project is licensed under the [MIT License](LICENSE).
