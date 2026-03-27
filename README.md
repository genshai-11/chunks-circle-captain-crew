# Caption & Crew (THC)

A new standalone mobile-first speaking game project.

## Core loop
- Captain speaks in Vietnamese first.
- Deepgram Vietnamese STT turns Captain audio into the round source script.
- Crew must start in time, then reply in English.
- Deepgram English STT captures Crew response.
- Router9-backed LLM evaluates meaning match.

## Stack
- React + TypeScript + Vite
- Firebase (new project config)
- Cloud Functions scaffold for Deepgram + Router9

## Local setup
1. Copy `.env.example` to `.env`
2. Fill in your **new Firebase** project config
3. Install frontend dependencies: `npm install`
4. Install functions dependencies: `cd functions && npm install`
5. Run frontend: `npm run dev`

## Important
This is a **new project**. It reuses ideas and selected code patterns from Voice Energy Trainer, but it is not coupled to that codebase.

## Product Docs
- [PRD.md](./PRD.md)
- [PURPOSE.md](./PURPOSE.md)
