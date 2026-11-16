# DrapeAI

Android-only wardrobe and outfit planning app built with Expo, React Native, and TypeScript. The project also contains a TypeScript/Express API foundation with PostgreSQL migrations. The current mobile build works offline; it is not a publishable production release. See [release readiness](docs/RELEASE_READINESS.md).

## Run on Android

```powershell
npm install
npm start
```

Open Expo Go on an Android phone on the same network and scan the QR code. To build a standalone APK locally, install the Android SDK and platform tools.

First launch starts with an empty wardrobe so recommendations can only use clothes the user added. Garments, saved looks, and trips are saved on the device. Photos and wardrobe data are not backed up or synced; uninstalling the app removes them. Profile includes a permanent delete-all-data action.

## What works offline

- Browse, search, and filter wardrobe items; view active and archived pieces.
- Add and photograph a garment; assign category, color, and occasions; edit details; track clean/dirty/reserved state; favorite, archive, restore, and delete.
- Generate locally matched outfit combinations from actual items marked clean; save and remove looks. Suggestions do not use an LLM and do not verify dress code, weather, or fit.
- Create trips with date validation and edit a packing checklist by adding or removing clean wardrobe pieces.
- Local API foundation for account sessions, PostgreSQL-owned wardrobe records, private image upload/read/delete, and server-side wardrobe-grounded fallback recommendations.

## Service boundary

The mobile app currently saves data locally and is not connected to the API. Account registration/sign-in UI, cloud sync, hosted image storage, AI image recognition, live LLM recommendations, weather, push notifications, and production deployment are not connected. No cloud resources or paid AI services have been created or called. The API stores image files in a private development directory and must use managed private storage before deployment.

See [server/README.md](server/README.md) for local API setup.

## Android APK build

The Android package is `com.drapeai.app`. `npm run export:android` creates a JavaScript bundle under `dist/`, not an installable APK. To build a local debug APK:

```powershell
npx expo prebuild --platform android
cd android
./gradlew assembleDebug
```

The debug APK is for local review only. A production APK or Play upload needs the owner's protected release signing key, a production backend, a privacy policy, and the release gates in [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md). Do not commit signing keys or service credentials.
