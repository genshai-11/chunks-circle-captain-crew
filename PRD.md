# PRD — Caption & Crew (THC)

## 1. Product Name
**Caption & Crew**

Internal project folder: **THC**

---

## 2. Product Summary
Caption & Crew is a **two-player speaking game** designed to test how well one player can preserve the meaning of another player's spoken message across languages.

- **Captain** speaks first in **Vietnamese**
- **Crew** listens and responds in **English**
- The system uses **speech-to-text** and **LLM meaning evaluation** to determine how well the English response preserves the intended meaning

The product is designed to feel like a **minimal mobile-first touch game**, not a technical dashboard.

---

## 3. Core Problem
Most language speaking tools focus on:
- pronunciation only
- grammar only
- literal translation only
- solo practice only

Caption & Crew focuses instead on:
- **meaning transfer**
- **timed response pressure**
- **two-player interaction**
- **speech understanding across languages**

The product tests whether a listener can understand a spoken Vietnamese message and quickly respond in English while preserving the original intent.

---

## 4. Product Goals

### Primary Goals
1. Create a **simple two-player speaking game loop**
2. Measure **meaning match** between Captain and Crew
3. Keep gameplay **fast, minimal, and private**
4. Support **runtime admin configuration** for STT and LLM services
5. Allow admins to test infrastructure readiness before gameplay

### Secondary Goals
1. Support experimentation with meaning-evaluation behavior
2. Keep the architecture flexible for future coaching modes
3. Provide a lightweight history of recent rounds

---

## 5. Non-Goals
At the current stage, the product is **not** trying to be:
- a full classroom LMS
- a full translation platform
- a social network or multiplayer room system
- a detailed analytics dashboard
- a pronunciation-scoring engine
- a secure enterprise admin system with roles/claims/policies everywhere

---

## 6. Target Users

### Primary Users
- 2-person language learning pairs
- teacher + student
- peer speaking partners
- bilingual practice partners

### Secondary Users
- admins configuring AI providers
- product builder/testing team

---

## 7. Core User Roles

### Captain
- speaks in Vietnamese
- starts the round
- provides the source meaning

### Crew
- responds in English
- must start within the allowed time window
- attempts to preserve meaning

### Admin
- configures Deepgram and Router9
- validates system readiness
- tunes meaning match behavior
- signs in via admin-only authentication

---

## 8. Core Experience Principles
1. **Minimal UI** — very little text during gameplay
2. **Two-player clarity** — Captain and Crew roles must be obvious
3. **No transcript leakage** — gameplay should not reveal speech transcripts
4. **Fast transitions** — Crew should start immediately after Captain stops
5. **Analysis after play** — transcription and meaning analysis happen after recording is complete
6. **Touch-first interaction** — designed for mobile taps, not desktop forms

---

## 9. Main User Flow

### Gameplay Flow
1. Player opens the Game screen
2. Captain taps to start recording
3. Captain speaks Vietnamese
4. Captain taps to stop
5. Captain audio is stored silently
6. Crew countdown begins immediately
7. Crew taps to start recording within the allowed delay
8. Crew speaks English
9. Crew taps to stop
10. App enters **Analyzing** state
11. System runs:
   - Captain STT
   - Crew STT
   - meaning evaluation
12. App navigates to **Analysis Summary** screen
13. Player sees:
   - meaning score
   - decision
   - reaction delay
   - short reasoning
14. Player taps **Play again**

---

## 10. Functional Requirements

### 10.1 Gameplay
- The game must support two sequential player turns:
  - Captain first
  - Crew second
- Captain interaction must be touch-based
- Crew interaction must be touch-based
- Crew must start within a configurable delay after Captain stops
- If Crew starts too late, round should end as timeout loss

### 10.2 Recording
- App must record microphone input for Captain and Crew separately
- App must show a live recording indicator
- App should display a **realtime waveform / audio level visualization** during recording
- Recorded audio must not be shown as transcript during gameplay

### 10.3 Speech-to-Text
- Captain audio must be transcribed in Vietnamese via Deepgram
- Crew audio must be transcribed in English via Deepgram
- STT should run during the analysis stage, not between turns
- Errors must be surfaced if STT fails

### 10.4 Meaning Evaluation
- Meaning evaluation must compare Captain Vietnamese transcript and Crew English transcript
- Evaluation must be powered by Router9-compatible LLM completion
- Evaluation should return at minimum:
  - `matchScore`
  - `decision`
  - `reason`
- Extended fields are also supported:
  - `missingConcepts`
  - `extraConcepts`
  - `grammarNote`
  - `improvedTranscript`
  - `grammarSeverity`
  - `feedbackType`

### 10.5 Summary Screen
- Analysis summary must be shown on a **separate screen**, not inside gameplay
- Summary screen must not show raw transcripts in player mode
- Summary must include:
  - score
  - decision
  - response delay
  - short reason
  - play again action

### 10.6 History
- App must save recent rounds locally and optionally to Firestore
- History should show a lightweight summary of prior rounds
- History should not prominently expose transcripts in the player-facing UI

### 10.7 Settings
- Game settings page must support:
  - max Crew start delay
  - strictness fallback
  - countdown visibility

### 10.8 Admin Configuration
- Admin screen must support runtime configuration for:
  - Deepgram API key
  - Captain model
  - Crew model
  - Router9 API key
  - Router9 base URL
  - Router9 primary model
  - Router9 fallback model

### 10.9 Admin Validation
- Admin must be able to validate:
  - Vietnamese STT
  - English STT
  - Router9 model fetch
  - Router9 completion
- Admin screen must show Ready / Not Ready states

### 10.10 Meaning Match Controls
- Admin must be able to configure:
  - strictness
  - meaning weight
  - feedback enabled
  - feedback mode
  - feedback tone
  - show grammar reminder
  - show improved sentence
  - show feedback when meaning is correct
  - only show feedback if clarity is affected

### 10.11 Admin Authentication
- Admin route must be protected by Firebase Email/Password Authentication
- Admin navigation should only appear when signed in as admin
- Only allowlisted admin emails should be able to access admin functions

---

## 11. UX Requirements

### Gameplay UX
- UI must feel like a game, not a dashboard
- Screen should be visually split by role
- Captain zone should be blue
- Crew zone should be red
- Active state should be visually obvious
- Transcript should remain hidden during play
- Analysis stage should use a focused loading treatment

### Visual Style
- Minimal
- calm
- mobile-first
- not heavy bold
- reduced visual noise
- preserve role color identity

---

## 12. Technical Requirements

### Frontend
- React
- TypeScript
- Vite
- React Router
- Firebase Web SDK

### Backend / Infra
- Firebase Hosting
- Firebase Functions
- Firestore (optional history/settings storage)
- Firebase Auth for admin access
- Deepgram for STT
- Router9-compatible endpoint for meaning evaluation

---

## 13. Current Architecture Summary

### Frontend Pages
- Game
- Analysis Summary
- History
- Settings
- Admin Login
- Admin

### Backend Functions
- `transcribeRoundAudio`
- `fetchRouterModels`
- `testRouterCompletion`
- `evaluateCaptionCrewMeaning`

---

## 14. Success Criteria
A successful round should feel like:
- two fast turns
- no transcript leakage
- a short but meaningful analysis moment
- a clear final score
- easy replay

A successful admin setup should allow:
- quick provider testing
- easy model changes
- confidence that the system is ready before gameplay

---

## 15. Future Opportunities
- coach mode with optional transcript reveal
- teacher review mode
- multiplayer sessions / room system
- stronger admin security with claims/rules
- detailed pronunciation or delivery scoring
- lesson packs and prompts
- analytics by learner over time
