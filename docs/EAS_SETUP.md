# Expo EAS Setup Checklist

## Prerequisites
- Ensure the `eas-cli` dev dependency is installed (`npx eas --version`).
- Sign in with `npx eas login` using the project owner account (requires Expo account access).

## Project configuration
1. `eas.json` defines the `development`, `preview`, and `production` build profiles.
2. `.easignore` excludes local build artefacts that should not be uploaded with each build.
3. The `submit.production` section currently only configures Android; add iOS details once App Store Connect access is ready.
4. If sandbox restrictions block writes to the default home directory, run commands with `HOME=$PWD/.tmp-home`.

## Running builds
- Development (local client/testing):
  ```sh
  HOME=$PWD/.tmp-home npx eas build --profile development --platform ios
  ```
- Preview/internal testing:
  ```sh
  HOME=$PWD/.tmp-home npx eas build --profile preview --platform ios
  ```
- Production/TestFlight:
  ```sh
  HOME=$PWD/.tmp-home npx eas build --profile production --platform ios
  ```

## Credentials & submission
- Apple Developer Program membership is required to generate signing assets. EAS can manage certificates once Apple Team credentials are supplied.
- After registering the app in App Store Connect, add an `ios` block under `submit.production` in `eas.json` with the Apple ID/App Store Connect app ID, then run:
  ```sh
  HOME=$PWD/.tmp-home npx eas submit --profile production --platform ios
  ```

## Android (future)
- Android build profiles are stubbed in `eas.json`; add Keystore credentials before running `eas build --platform android`.
