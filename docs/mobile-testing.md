# Testing the intern scan screen on real phones

Phones only allow the camera and location on **HTTPS** pages, so opening `http://<laptop-ip>:3000` on a phone shows "This page needs a secure connection". Use one of the two options below. Until the scan API routes exist, the development server uses a **mock server**: the camera, location prompt and layout are real; only the save is simulated.

## 1. Get the app onto the phone over HTTPS

**Option A: same Wi-Fi, self-signed certificate**

1. Run `npm run dev:phone` (Next.js creates a local certificate the first time; allow Node through Windows Firewall if asked).
2. Find the laptop's Wi-Fi IP (`ipconfig` → IPv4 Address), then open `https://<that-ip>:3000/scan` on the phone.
3. Accept the warning once:
   - iPhone Safari: **Show Details › visit this website**.
   - Android Chrome: **Advanced › Proceed**.

**Option B: a tunnel with a trusted certificate (smoothest on iPhone)**

Run `npm run dev`, then start a tunnel such as Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:3000`) and open the `https://….trycloudflare.com/scan` address it prints. Anyone with the link can reach your dev server while the tunnel runs, so stop it when you're done.

## 2. Scan

- Open `/scan/test-codes` on the laptop screen and point the phone at the **IN** or **OUT** code.
- Or open **Developer tools** at the bottom of the scan screen and tap **IN code** / **OUT code** to skip the camera.
- Pick what the mock server answers under **Server outcome**:

| Outcome | What you should see |
|---|---|
| `ok` | Checking → Time in saved (or Time out saved with today's hours) |
| `outside` | Not saved · outside the office area, with distance and accuracy |
| `accuracy` | Not saved · location isn't precise enough |
| `invalid-qr` / `expired-qr` | Not saved · wrong or replaced code |
| `timeout` | After 12 s: Couldn't confirm → **Check again** finds the saved scan |
| `lost` | After 12 s: Couldn't confirm → **Check again** says it wasn't saved |
| `session-expired` | Not saved · signed out, with a Sign in button |

Also in Developer tools: **Start already timed in** (tests the OUT flow) and **Turn the camera off**.

## 3. What to check on each phone

Test at least one iPhone (Safari) and one Android phone (Chrome). If you can, also open the link from **Messenger** (in-app browser) and on **Samsung Internet**.

- [ ] Header clears the notch / Dynamic Island; tab bar sits above the home indicator (iPhone) and the gesture bar (Android).
- [ ] Nothing jumps when Safari's or Chrome's address bar collapses while scrolling.
- [ ] The scan screen fits without scrolling in portrait, including small phones (iPhone SE, 360-wide Androids).
- [ ] The **rear** camera starts, the preview fills the dark frame, and it doesn't go fullscreen (iPhone).
- [ ] First visit: camera and location prompts appear; **Don't Allow** shows the right steps for that phone; after fixing, **Try again** works.
- [ ] Switching to another app and back restarts the camera (no black preview).
- [ ] A QR read gives a short buzz on Android (iPhone has no web vibration).
- [ ] With iPhone **Precise Location** off, a scan fails with the accuracy message rather than saving.
- [ ] Inside Messenger or Facebook, the screen says to open the page in Safari or Chrome.
- [ ] Text never zooms in when tapping a field (iPhone).

### Home, History and Corrections

These use sample data (Ana Reyes, October 2026) until the attendance and corrections modules are connected. Sending a correction or a reply goes to a development mock and isn't saved.

- [ ] Home, History and Corrections scroll smoothly; the tab bar stays put while scrolling.
- [ ] History: tapping a day row opens its correction (Oct 15) or a new request for that day (Oct 9).
- [ ] Request a correction: the date and time pickers open the phone's native picker (iPhone wheels, Android clock); with the keyboard open, the field you're typing in stays visible and **Send to HR** is reachable by scrolling.
- [ ] Submitting with mistakes shows the errors and jumps to the first one; a valid request shows **Sent to HR**.
- [ ] Correction detail: the reply box isn't hidden behind the keyboard, and a sent reply appears at the bottom of the conversation.

Report problems with the phone model, OS version, browser and a screenshot.
