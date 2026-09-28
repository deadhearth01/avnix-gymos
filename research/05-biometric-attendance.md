# Biometric attendance — fingerprint & face (research + design)

Date: 28 Sep 2026. Goal: members check in with a fingerprint or their face, using **whatever device the gym already owns** (or the cheapest one they can buy), and every punch lands in GymOS as a check-in in real time.

## 1. What Indian gyms actually have

| Class | Typical models (India) | Price | How it talks | Share in gyms* |
|---|---|---|---|---|
| Standalone attendance terminal (fingerprint / face / card) | **eSSL** (X990, K30, MB160, iFace), **ZKTeco** (K40, F18, MB20, SpeedFace V4L/V5L, SenseFace), **Realtime** (T52, RS20), Identix, BioMax | ₹3k–₹25k | Stores templates on the device, matches locally, **pushes punches to a server over HTTP** ("ADMS" / "Push" / "Cloud server" setting) | Very high — eSSL/ZKTeco dominate small gyms |
| Face access terminal | **Hikvision** DS-K1T (320, 341, 343, 671), **Dahua** ASI series, CP Plus | ₹8k–₹40k | ISAPI / CGI; pushes `AccessControllerEvent` to an "HTTP listening host" | Growing (new builds, premium gyms) |
| Enterprise access control | Matrix COSEC, Suprema BioStation, HID | ₹15k+ | Vendor server/API, webhooks | Rare in single-owner gyms |
| USB fingerprint scanner (desk) | Mantra MFS100/110, Startek FM220, Morpho/IDEMIA MSO 1300, SecuGen Hamster | ₹2k–₹4k | Needs a PC + vendor SDK/RD service (Windows). Aadhaar RD mode returns *encrypted* PID blocks — unusable for our own matching; must use the vendor's non-RD SDK | Some gyms (bought for Aadhaar eKYC) |
| Any camera | Laptop webcam, USB webcam, Android tablet / old phone, IP camera | ₹0–₹3k | Browser camera (`getUserMedia`); IP/RTSP cameras need a bridge or a virtual-webcam driver | Every gym |

\* From the Phase-1 competitor teardown: "biometric integration" was the #3 requested feature; almost every Vizag gym with a device uses eSSL or ZKTeco (eSSL is ZKTeco OEM).

## 2. Integration strategy — four adapters, one pipeline

```
 ZKTeco / eSSL / Realtime / BioMax ──HTTP push (ADMS)──▶ /iclock/cdata ─┐
 Hikvision / Dahua face terminals ──HTTP listening────▶ /api/devices/hik/<token> ─┤
 Anything else / GymOS Bridge (USB) ─JSON webhook─────▶ /api/devices/punch (Bearer) ─┤──▶ recordPunch() ──▶ check-in + realtime
 Browser face kiosk (any camera) ───server action────▶ identifyFace() ──────────┘        (same access policy as the desk)
```

Every adapter ends in `recordPunch(gym, pin|memberId, at, method)`, which:
1. resolves the member (device user ID = the number in the member code: `M0140` → `140`),
2. applies the desk policy (expired / frozen / upcoming plan ⇒ *blocked*, not recorded),
3. de-duplicates (one visit per hour), uses the **device’s punch time** (offline logs replay correctly),
4. writes a `punches` row (so owners can see unknown IDs and blocked entries) and the check-in (method `fingerprint` / `face` / `card`).

### 2a. ZKTeco-family push ("ADMS") — covers eSSL, ZKTeco, Realtime, Identix, BioMax
- Device menu → *Comm → Cloud Server Setting*: server `gym.avnix.in`, port `443` (HTTPS models) or `80`, "Enable domain name" on.
- Protocol (verified against the open-source `s0x90/zkteco-adms` implementation):
  - `GET /iclock/cdata?SN=…&options=all` → handshake; we reply with `GET OPTION FROM: SN` + `ATTLOGStamp`, `Realtime=1`, `TransFlag`, `TimeZone=5.5`.
  - `POST /iclock/cdata?SN=…&table=ATTLOG` body lines `PIN\tYYYY-MM-DD HH:MM:SS\tStatus\tVerify\tWorkcode…` → reply `OK: <n>`.
  - `GET /iclock/getrequest?SN=…` heartbeat → `OK` (or queued `C:<id>:<cmd>` commands later — e.g. `DATA UPDATE USERINFO PIN=140\tName=…` to push members to the device).
  - `POST /iclock/devicecmd` command results → `OK`.
  - Verify modes: 1 fingerprint, 15 face, 4/2 card, 0/3 password, 25 palm.
- Security: the protocol has no auth, so only **registered serial numbers** are accepted, per-device rate limits apply, the source IP is recorded, and unknown SNs get a plain `OK` with no data written.
- Caveat: older firmware can’t do HTTPS. Options: (a) buy HTTPS-capable models (SpeedFace/SenseFace, newer eSSL), (b) allow plain HTTP for `/iclock/*` only on the Appwrite proxy, or (c) the GymOS Bridge (below) relays on the LAN.

### 2b. Hikvision ISAPI (and Dahua equivalents)
- Device web UI → *Network → Advanced → HTTP Listening*: URL `https://gym.avnix.in/api/devices/hik/<device-token>`.
- Events arrive as JSON (multipart `event_log`) or XML with `AccessControllerEvent.employeeNoString`, `dateTime`, `majorEventType=5`, `subEventType` 75 (face pass), 38 (fingerprint pass), 1 (card pass).
- The token in the URL is the auth (32 random bytes, stored hashed). Heartbeats/non-pass events are acknowledged and ignored.
- Employee No. on the device = member number (`140`).

### 2c. Generic webhook — any vendor, scripts, the Bridge
`POST /api/devices/punch` with `Authorization: Bearer <token>`:
```json
{ "userId": "140", "at": "2026-09-28T06:31:00+05:30", "method": "fingerprint" }
```
Batch form: `{ "punches": [ … up to 500 ] }`. Idempotent per (device, userId, at).

### 2d. Face attendance with any camera (browser kiosk)
- Library: **@vladmandic/human 3.3** (MIT; TF.js): BlazeFace detector + FaceMesh alignment + **FaceRes 1024-d embedding** + **anti-spoof** + **liveness** models (≈10 MB, served from our own domain, cached by the browser).
- Runs on any laptop/tablet/phone browser with any camera the OS exposes (built-in, USB, virtual cameras such as OBS/IP-camera drivers). No face images leave the device — only the embedding.
- Enrolment (staff, with the member present and consenting): 3 good frames → 3 embeddings stored in a **private** table (`face_profiles`, server-only, never sent to browsers).
- Recognition: kiosk detects a live, real face that is steady for ~0.6 s, sends the embedding; the server compares it against the gym’s enrolled embeddings with Human’s similarity (order-2 distance, normalised 0–1). Match if best ≥ **0.62** and ahead of the runner-up by ≥ 0.05; otherwise “not recognised — please use the desk”.
- Anti-spoof ≥ 0.5 and liveness ≥ 0.5 required (blocks printed photos/phone screens in normal light).

### 2e. USB fingerprint scanners (next phase — GymOS Bridge)
Small Windows tray app (Node + vendor SDK via FFI or the vendor’s local web service: Mantra *MFS100 ClientService*, Startek *FM220 ACPL*, SecuGen *WebAPI*, Morpho *MorphoSmart*). It captures ISO-19794-2 templates, does 1:N matching locally (SourceAFIS or the vendor matcher) and posts to the generic webhook. Same Bridge can relay old HTTP-only ZKTeco terminals and pull RTSP streams from IP cameras.

## 3. Privacy & compliance (DPDP Act 2023)
- Biometric data is personal data needing **explicit, informed consent** → consent checkbox + timestamp + staff name on enrolment; members can ask for deletion (one click).
- Store the minimum: **embeddings only, no face photos**; fingerprint templates stay on the terminal (never reach GymOS).
- `face_profiles` and `devices` are private tables (API key only); punches are team-readable (IDs + names, no biometrics).
- Deleting a member deletes their face profile.

## 4. Build status (this phase)
- [x] Schema: `devices`, `punches`, `face_profiles`; check-in methods `fingerprint`, `face`, `card`
- [x] Adapters: ZKTeco ADMS, Hikvision ISAPI, generic webhook
- [x] Face kiosk (full-screen, camera picker, liveness/anti-spoof) + enrolment from the member profile
- [x] Devices page: add device → brand-specific setup steps, token shown once, live status, punch log
- [x] Verified: simulated ZKTeco ATTLOG (fingerprint + face + unknown ID + replay), Hikvision multipart event, generic webhook (auth + batch), and headless Chrome with a fake camera: enrol 3 samples → kiosk recognised the member in ~3 s
- [ ] GymOS Bridge (USB scanners, HTTP-only terminals, RTSP)
- [ ] Push member list to ZKTeco devices (`DATA UPDATE USERINFO`) and Hikvision (`/ISAPI/AccessControl/UserInfo/Record`)
