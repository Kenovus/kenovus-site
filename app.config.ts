import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

/**
 * Loads `.env` from the project root when the Expo CLI evaluates this file.
 * Use EXPO_PUBLIC_* names so Metro inlines them into the JS bundle.
 * EAS Build sets `EAS_BUILD_PROFILE` to the profile name (development | preview | production).
 */
const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || 'b1c5c247-3ec6-4f18-bd08-ea13ee99c444';

const notificationsMode = process.env.EAS_BUILD_PROFILE === 'development' ? 'development' : 'production';

const PERMISSIONS = {
  camera: 'Used to scan receipts and log progress photos',
  microphone: 'Used for voice input with your wellness coach',
  photos: 'Used to choose photos for progress tracking and receipts.',
  healthRead: 'Used to sync your activity, sleep, and heart rate data',
  healthWrite: 'SonaLife does not write to Apple Health in this version.',
  notifications: 'Used to send wellness reminders and coach check-ins',
  faceId: 'Used for secure biometric login',
} as const;

const config: ExpoConfig = {
  name: 'SonaLife',
  slug: 'sonalife',
  owner: 'kenovus',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/sonalife-icon.png',
  scheme: 'sonalife',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  extra: {
    eas: {
      projectId: easProjectId,
    },
    // Mirrored for runtime reads via Constants.expoConfig.extra (EAS / some build setups)
    EXPO_PUBLIC_FATSECRET_CLIENT_ID: process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID,
    EXPO_PUBLIC_FATSECRET_CLIENT_SECRET: process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET,
    EXPO_PUBLIC_FATSECRET_TOKEN_SCOPE: process.env.EXPO_PUBLIC_FATSECRET_TOKEN_SCOPE,
    EXPO_PUBLIC_USDA_API_KEY: process.env.EXPO_PUBLIC_USDA_API_KEY,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_ANTHROPIC_API_KEY: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY,
    EXPO_PUBLIC_ELEVENLABS_API_KEY: process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY,
    EXPO_PUBLIC_ELEVENLABS_VOICE_ID: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID,
    EXPO_PUBLIC_ELEVENLABS_VOICE_ID_FEMALE: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID_FEMALE,
    EXPO_PUBLIC_ELEVENLABS_VOICE_ID_MALE: process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID_MALE,
  },
  updates: {
    url: `https://u.expo.dev/${easProjectId}`,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  splash: {
    image: './assets/images/sonalife-splash.png',
    resizeMode: 'cover',
    backgroundColor: '#2C2420',
  },
  ios: {
    icon: './assets/images/sonalife-icon.png',
    supportsTablet: true,
    bundleIdentifier: 'com.kenovus.sonalife',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: PERMISSIONS.camera,
      NSMicrophoneUsageDescription: PERMISSIONS.microphone,
      NSPhotoLibraryUsageDescription: PERMISSIONS.photos,
      NSHealthShareUsageDescription: PERMISSIONS.healthRead,
      NSHealthUpdateUsageDescription: PERMISSIONS.healthWrite,
      NSUserNotificationsUsageDescription: PERMISSIONS.notifications,
      NSFaceIDUsageDescription: PERMISSIONS.faceId,
      NSSpeechRecognitionUsageDescription: PERMISSIONS.microphone,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/sonalife-icon.png',
      backgroundColor: '#0D0F12',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-asset',
    'expo-router',
    'expo-secure-store',
    [
      'expo-speech-recognition',
      {
        microphonePermission: PERMISSIONS.microphone,
        speechRecognitionPermission: PERMISSIONS.microphone,
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: PERMISSIONS.faceId,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: PERMISSIONS.camera,
        microphonePermission: PERMISSIONS.microphone,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: PERMISSIONS.photos,
        cameraPermission: PERMISSIONS.camera,
      },
    ],
    [
      'expo-notifications',
      {
        mode: notificationsMode,
        sounds: [],
        enableBackgroundRemoteNotifications: true,
        icon: './assets/images/icon.png',
        color: '#0D0F12',
      },
    ],
    [
      'react-native-health',
      {
        healthSharePermission: PERMISSIONS.healthRead,
        healthUpdatePermission: PERMISSIONS.healthWrite,
        isClinicalDataEnabled: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
