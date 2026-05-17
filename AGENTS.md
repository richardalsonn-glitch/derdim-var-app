# Repository Guidelines

## Project Structure & Module Organization

This is an Expo React Native app written in TypeScript. `App.tsx` is the entry point; most implementation lives in `src/`.

- `src/screens/`: route-level screens registered in `src/navigation/AppNavigator.tsx`.
- `src/components/`: reusable UI components; `src/components/home/` contains home-specific pieces.
- `src/services/`: Supabase, LiveKit, auth, social, and notification workflows.
- `src/lib/`, `src/utils/`, `src/constants/`, `src/types/`, `src/data/`: shared clients, helpers, theme, types, and mock/catalog data.
- `assets/`: app images and audio.
- `supabase/migrations/` and `supabase/functions/`: database migrations and edge functions.
- `scripts/`: local utilities, such as Expo QR generation.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm start`: run `expo start --dev-client`.
- `npm run start:clear`: start Expo with Metro cache cleared.
- `npm run android` / `npm run ios`: build and run native development apps.
- `npm run web`: start the Expo web target.
- `npm run prebuild` / `npm run prebuild:clean`: generate native project files, optionally from scratch.
- `npm run typecheck`: run `tsc --noEmit`; use this as baseline verification.
- `npm run eas:build:*`: trigger EAS builds by platform and profile.

## Coding Style & Naming Conventions

Use strict TypeScript and functional React components. Follow the existing style: two-space indentation, single quotes, semicolons, named exports, and `StyleSheet.create`. Use `PascalCase` for components and screens (`LoginScreen.tsx`), `camelCase` for functions and services, and keep route names aligned with `RootStackParamList`.

Prefer shared theme values from `src/constants/theme.ts` over hard-coded colors, spacing, or radii. Keep side effects in `src/services/` and UI state close to its owner.

## Testing Guidelines

No unit test runner is currently configured. For now, run `npm run typecheck` and manually verify changed flows in Expo or a native dev build. When adding tests later, colocate them near the target module as `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries such as `Redesign login background screen` and `Fix auth keyboard dismiss and night room cards`. Keep subjects concise and focused.

Pull requests should include a brief description, verification steps, linked issues when applicable, and screenshots or recordings for UI changes. Note Supabase migration or environment variable changes explicitly.

## Security & Configuration Tips

Keep secrets out of git. Use `.env.example` as the template and local `.env` for values such as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. For Supabase migrations and edge functions, document schema changes and verify access policies before release.
