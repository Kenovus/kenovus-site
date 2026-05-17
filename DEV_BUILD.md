# SonaLife development build (EAS) quickstart

Use this to move off Expo Go so HealthKit and full notifications work.

## 1) One-time setup

1. Install and login:
   - `npm i -g eas-cli`
   - `eas login`
2. In `sonalife/.env`, set:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_EAS_PROJECT_ID`
3. If needed, initialize EAS project metadata:
   - `eas init`

## 2) Build an iOS development client

- From `sonalife/` run:
  - `npm run eas:build:ios:dev`

Install the build on your iPhone from the generated URL/QR in the EAS output.

## 3) Run Metro and open the dev build

- `npm start`
- Open the installed SonaLife dev client on device and connect to Metro.

## 4) Why this is required

- Apple Health (`react-native-health`) requires native capabilities not present in Expo Go.
- Push notification token registration and reliable local/remote notification behavior require a real native build.
