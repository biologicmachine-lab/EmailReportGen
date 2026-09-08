[README.md](https://github.com/user-attachments/files/31979212/README.md)
# Shift Report Generator

  A phone-first PWA for logging shift entries with photos and exporting them as
  an email/.eml.

## Files

```
|-index.html          markup only — no scripts, no inline handlers
|-manifest.json       PWA metadata
|-sw.js               service worker (offline support)
|-css/
|   |- styles.css     all styling
|-js/
|   |- app.js         bootstrap and event wiring — start here
|   |- state.js       the report model, form binding, draft autosave
|   |- db.js          IndexedDB: photo blobs, quota estimate, orphan cleanup
|   |- photos.js      capture, downscale, thumbnails
|   |- render.js      entry list and preview rendering
|   |- email.js       report bodies and .eml assembly
|   |- backup.js      .json backup download and restore
|   |- lock.js        password gate
```
  To change one thing just open one file. 
  Adding a report field means one line in `state.js` and 
  one input in `index.html`.

## Deploying

  All code in repo root.
  GitHub Pages serves ES modules over HTTPS with no build step.

  **When editing any file, bump `CACHE_VERSION` in `sw.js`.** 
    The service worker caches the app so it works with no signal, which also
    means phones will keep serving the old copy until the version string changes.

## What changed, and why

  **Photos moved from localStorage to IndexedDB.** 
    This is an effort to fix photos silently disappearing. 
    
    - `LocalStorage` is a string store capped around 5 MB, and base64 inflates 
    every image by a third. 
    A single full-resolution phone photo uses about two-thirds of the entire 
    budget, so a second or third one had nowhere to go.
     
    - `setItem` threw the images away, the failure went to an unreadable 
    hint-line, and the photo was gone. 
    
    - `IndexedDB` stores blobs at their real size with a quota in the
    hundreds of megabytes.

  **Photos are downscaled on capture** 
    Photos are downscaled to 1800px on the long edge, with quality
    stepped down only as far as needed to reach close to 500 KB. 
    Image detail stays readable. 
    
    Adjust:
     - `MAX_EDGE` and `TARGET_BYTES` at the top of `js/photos.js`.

  **Failures are visible.** 
    In this version, every failed save produces a red banner and a buzz, not
    a line of grey text as previously.

  **A storage meter** 
    This version includes a `Storage meter` that sits under the entries, 
    using real numbers from `navigator.storage.estimate()` rather than a guess 
    at the cap.

  **Saves happen immediately after a photo is added** 
    It is intended that this version will save the files everytime a photo is 
    added to an entrynot on a 400 ms timer.
    
    NOTE that iOS can suspend a backgrounded page the moment the camera hands 
    control back, and that delay was the window where some of the pictures 
    went missing in previous versions.

  **The .eml is now correctly encoded.** 
    Image bodies are base64 with a UTF-8 charset, so an `.em dash` or a 
    `degree symbol` no longer risks arriving as garbage; the
    subject is RFC 2047 encoded; and `Date` and `X-Unsent` headers are included,
    the latter so Outlook opens the file as an editable draft rather than a
    received message. 
    Photos that have gone missing are dropped from the body text as well as the 
    attachments, so the email never promises a picture it does not carry.

  **Old drafts migrate automatically** 
    On first load — the previous `shiftReportAutosave` key is read, its photos 
    moved into IndexedDB, and the key deleted, which frees the megabytes it was 
    holding.

  **Rendering no longer rebuilds the whole entry list** 
    When a photo is attached, rendering no longer rebuilds the whole entry list,
    so the keyboard stays open and your scroll position holds.

## The lock screen

  The password hash is in the source and anyone who opens developer tools can
  walk past it. It keeps a coworker out of an unlocked phone. 
  Treat the report contents as though they were going out in plain text, 
  because they are.

## Backups

  The `.json` backup is the only copy that lives outside the browser, and it
  carries the photo bytes inline rather than references. 
  Downloading one before closing out for the day is a most. 
  
  The app will remind at export time if a backup have not been taken.
