# SonaLife — TestFlight readiness checklist

Use this list before inviting external testers or promoting a build to TestFlight. Treat items as gates: fix blockers first, then polish.

## 1. Apple developer and signing

- [ ] **Bundle ID** matches across Apple Developer, EAS (`app.config` / `eas.json`), and Supabase auth redirect URLs if applicable.
- [ ] **Distribution certificate** and **App Store provisioning profile** (or EAS-managed credentials) are valid and not expiring during the test window.
- [ ] **HealthKit** capability is enabled for the bundle ID in the Apple Developer portal (required for `react-native-health` in production).
- [ ] **Push Notifications** capability enabled for the bundle ID; APNs key uploaded to Expo (EAS) if you send remote pushes from a backend.

## 2. EAS build configuration

- [ ] `eas.json` profiles for `development`, `preview`, and `production` (or your chosen names) point at the correct env and channel.
- [ ] **`EXPO_PUBLIC_EAS_PROJECT_ID`** set in EAS secrets or `.env` so `getExpoPushTokenAsync` succeeds on real devices (see `.env.example`).
- [ ] **`EXPO_PUBLIC_SUPABASE_URL`** and **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** set for the target Supabase project (staging vs production).
- [ ] iOS build uses a **non-Expo-Go** workflow (`eas build --platform ios` or local `expo run:ios` after prebuild) because HealthKit and full push behavior require native binaries.

## 3. Supabase (staging vs prod)

- [ ] Migrations applied, including **`20260416140000_progress_photos_storage_bucket.sql`** (private `progress-photos` bucket + RLS).
- [ ] **RLS** smoke-tested: patient A cannot read patient B’s `progress_photos` or storage objects.
- [ ] **Auth**: email/password (or chosen provider) works on device builds; deep link / scheme `sonalife` tested for password recovery if used.
- [ ] **Service role** keys are not embedded in the app (only anon key in the client).

## 4. Privacy, compliance, and copy

- [ ] **Privacy Nutrition Labels** in App Store Connect match data collection (health, photos, identifiers, analytics).
- [ ] **App Privacy** URL and support URL are live and accurate.
- [ ] In-app copy still states **not medical advice** where AI or GLP-1 surfaces appear; emergency / escalation paths reviewed.
- [ ] **Photo access**: purpose strings in `app.config` align with actual use (progress photos).

## 5. Functional QA on a physical iPhone

- [ ] **Onboarding** completes for a new consumer and a clinic patient (if both exist).
- [ ] **Tier gating**: Free vs Core vs GLP-1+ behaves as expected (coach caps, wearables paywall, nutrition premium, progress photos, GLP-1 check-in).
- [ ] **Progress photos**: pick from library → upload to storage → row appears with image (signed URL refresh after ~1h is acceptable; consider shorter TTL later).
- [ ] **Apple Health** (Core+): permission prompt, then snapshot shows plausible steps / weight / sleep / HR / HRV (or empty if Health has no data).
- [ ] **Notifications**: OS permission prompt appears once; after allow, **Settings → Notifications → SonaLife** shows the scheduled local reminders; `patients.notification_token` updates on a real device when EAS project ID is set.
- [ ] **Simulator note**: Expo Push token often fails in Simulator; document for testers that push requires a real device.

## 6. Stability and performance

- [ ] No red screens on cold start, login, tab switching, and sign-out → sign-in.
- [ ] **Offline / flaky network**: app does not crash; coach and Supabase errors show human-readable messages.
- [ ] **Memory**: scroll progress photo grid with many images without runaway growth (signed URL caching is minimal today).

## 7. App Store Connect metadata

- [ ] **Version** and **build number** incremented from the last submission.
- [ ] **What’s New** text is accurate for testers.
- [ ] **Screenshots** for required device sizes (or use ASC’s single-set rules for your tier).
- [ ] **Age rating** questionnaire completed; medical/wellness answers consistent with the app.
- [ ] **Export compliance** (encryption) answered; standard HTTPS uses exempt encryption in most cases—confirm with your counsel if unsure.

## 8. TestFlight distribution

- [ ] **Internal testing** build installed and smoke-tested before external group.
- [ ] **Test information** for external testers explains HealthKit, notifications, and that GLP-1 features are informational, not prescribing.
- [ ] **Feedback channel** (email or Slack) is monitored during the beta window.

---

When this checklist is green for your target environment, you are in good shape to ship a TestFlight build and collect structured feedback before App Store review.
