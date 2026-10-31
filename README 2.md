# ReelForge AI — Complete Setup & User Guide (README 2)

Yeh guide beginners ke liye hai. Ismein Windows par setup, website chalana, video edit karna, AI tools configure karna aur export karna step-by-step samjhaya gaya hai.

## 1. Project mein kya hai?

ReelForge AI ek browser-based video editor starter project hai. Ismein yeh features maujood hain:

- Video upload button aur drag-and-drop upload
- Video preview aur playback controls
- Timeline par video aur subtitle tracks
- Trim In / Out points
- Playhead ki position par clip split karna aur selected segment delete karna
- Undo / Redo
- Timeline zoom in / out aur preview zoom
- Sequence presets: landscape, portrait, square aur 4K
- Frame-rate export options: 30, 60, 90 aur 120 FPS
- Subtitle text add karna, color aur font size set karna
- AI auto-captions aur AI short-clip suggestions
- Video speed, volume, mute, basic noise reduction aur fade in/out
- MP4 export using FFmpeg

**Zaroori wazahat:** Yeh working MVP/starter editor hai, Adobe Premiere Pro ka complete replacement nahi. Advanced multi-camera editing, multiple independent video layers, keyframes, motion tracking, advanced transitions, cloud project sync aur collaboration abhi included nahi hain.

## 2. System requirements

Apne computer par yeh install karein:

1. **Node.js 18 ya newer** (Node.js 20 LTS recommended).
2. **FFmpeg aur FFprobe** — video export aur audio processing ke liye.
3. **OpenAI API key** — sirf AI features ke liye.
4. Videos aur exports ke liye kaafi free disk space.

Installation ke baad Command Prompt / PowerShell mein check karein:

```bash
node --version
npm --version
ffmpeg -version
ffprobe -version
```

Agar in commands mein se koi command nahi chalti, us software ko install karein ya uska PATH configure karein.

## 3. Windows par setup

1. `ReelForge-AI-Website.zip` ko extract karein.
2. Extracted folder `reelforge-ai` open karein.
3. Folder ke andar address bar mein `cmd` type karke Enter press karein, ya folder mein PowerShell open karein.
4. Dependencies install karein:

```bash
npm install
```

5. `.env.example` file ki copy banayein aur us copy ka naam `.env` rakhein.
6. `.env` file Notepad ya VS Code mein open karein. AI features use karne hain to apni API key add karein:

```env
OPENAI_API_KEY=your_real_api_key_here
OPENAI_MODEL=gpt-4o-mini
PORT=3000
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

`your_real_api_key_here` ko apni actual API key se replace karein. API key kisi ke saath share na karein aur `public` folder ke JavaScript mein kabhi paste na karein.

7. Server start karein:

```bash
npm start
```

8. Browser mein yeh address open karein:

```text
http://localhost:3000
```

**Asaan tareeqa:** `.env` configure karne aur Node.js install karne ke baad `start-windows.bat` par double-click bhi kar sakte hain. Agar dependencies pehle install nahi hain to yeh script `npm install` chalati hai.

## 4. macOS / Linux par setup

Terminal mein project folder open karein, phir:

```bash
npm install
cp .env.example .env
```

`.env` mein API key configure karein, phir:

```bash
chmod +x start-mac-linux.sh
./start-mac-linux.sh
```

Ya seedha `npm start` run karein. Browser mein `http://localhost:3000` open karein.

## 5. Pehli video kaise edit karein?

1. Website open karein.
2. **Upload video** button press karein, ya video ko preview area mein drag-and-drop karein.
3. Upload complete hone ke baad preview mein video play karein.
4. Timeline par click karke playhead ko us jagah le jayein jahan edit karna hai.
5. **IN POINT** aur **OUT POINT** fields se export hone wala hissa select karein.
6. **Split** se playhead ki position par clip segment split karein.
7. **Delete** se selected timeline segment remove karein.
8. Zaroorat par **Undo / Redo** use karein.
9. Timeline ke `+` / `−` controls se timeline zoom karein. Preview zoom ke controls se preview bara ya chhota karein.

Note: Is version mein timeline editing ek hi uploaded source video ke selected segments par based hai; yeh full multi-track Premiere-style editor nahi hai.

## 6. Sequence settings

Top toolbar mein sequence settings milengi:

- **1920 × 1080:** Landscape / YouTube
- **1080 × 1920:** Portrait / Reels / TikTok / Shorts
- **1080 × 1080:** Square social post
- **1280 × 720:** HD
- **3840 × 2160:** 4K
- **FPS:** 30, 60, 90 ya 120
- **Aspect ratio:** 16:9, 9:16 ya 1:1

Export ke waqt bhi resolution aur FPS select kiye ja sakte hain. Source video aur computer ki capability ko dekh kar setting choose karein. 120 FPS select karne se low-frame-rate source video mein asli naye motion frames automatically create nahi hote; output frame rate convert hota hai.

## 7. Subtitles aur captions

### Manual subtitle

1. Timeline ke **+ Subtitle** button par click karein, ya right-side Text tab open karein.
2. Subtitle text enter karein.
3. Color aur font size set karein.
4. **Add subtitle to timeline** press karein.
5. Subtitle current playhead position par add hota hai. Zaroorat ke mutabiq video playhead move karke agla subtitle add karein.

### AI auto-captions

1. Video upload karein.
2. OpenAI API key `.env` mein set honi chahiye.
3. Text tab mein **Generate auto captions** press karein, ya AI command mein `Generate subtitles for the full video` likhein.
4. Processing complete hone par caption segments subtitle track/list mein show honge.
5. Export se pehle captions preview aur timing check karein.

AI transcription mein kabhi kabhi names, technical words ya accents ki wajah se ghalti ho sakti hai. Final export se pehle captions proofread karein.

## 8. AI Shorts aur AI Edit Assistant

1. Video upload karein.
2. AI command box mein apni instruction likhein. Misal:

```text
Find the best moments and create 3 engaging short videos with strong hooks.
```

Ya:

```text
Suggest a tighter edit and remove unnecessary pauses.
```

3. **Generate** press karein.
4. AI transcript ke basis par possible clip ranges aur suggestions deta hai.
5. Results review karein aur required segments select/retain karein.
6. Export dialog se final MP4 render karein.

**Important:** AI Shorts feature pehle suitable moments suggest karta hai. Yeh full automatic creative editing suite nahi jo har request par finished, polished social video khud se bana de. AI output ko review karna zaroori hai.

## 9. Audio controls

Right-side **Audio** tab mein:

- Volume slider se audio level adjust karein.
- Mute se original audio remove karein.
- Noise reduction se steady background noise kam karne ki koshish hoti hai.
- Fade in/out se beginning aur ending par basic fade apply hota hai.
- Playback speed 0.5x se 2x tak set ki ja sakti hai.

Noise reduction har tarah ke noise ko perfectly remove nahi karti. Exported audio ko sun kar quality verify karein.

## 10. Video export kaise karein?

1. **Export video** button press karein.
2. Resolution select karein: 720p, 1080p, vertical, square ya 4K.
3. FPS select karein: 30, 60, 90 ya 120.
4. Quality select karein: High quality, Balanced ya Smaller file.
5. **Start export** press karein.
6. Rendering complete hone par MP4 download start hona chahiye.

Export format MP4 (H.264 video + AAC audio) hai. Rendering server par FFmpeg se hoti hai. 4K, high-FPS aur long videos ko render karne mein zyada waqt aur disk space lag sakta hai.

## 11. Large video uploads — important details

Application code mein fixed 500 MB upload cap set nahi ki gayi. Server Multer disk storage use karta hai, isliye upload ko poora RAM mein rakhne ki zaroorat nahi hoti.

Lekin **unlimited upload ka promise nahi kiya ja sakta**. Practical limit in cheezon par depend karti hai:

- Server/computer ki free disk space
- Hosting provider ki upload/request limits
- Reverse proxy settings
- Internet connection aur upload stability
- Video duration, codec aur FFmpeg processing resources
- AI transcription provider ki file, request aur usage limits

Bari files ke liye reliable hosting, persistent storage, resumable/chunked uploads, background render workers aur cleanup policy add karna production deployment se pehle recommended hai. Uploads `server/uploads` mein aur exports `server/exports` mein save hote hain.

## 12. Common problems aur solutions

### Website open nahi hoti

- Check karein ke terminal mein `npm start` server chala raha hai.
- Browser mein `http://localhost:3000` open karein.
- Agar port 3000 busy ho to `.env` mein `PORT=3001` set karke server restart karein; phir `http://localhost:3001` open karein.

### `npm` ya `node` command not found

Node.js install karein, installation ke baad terminal close karke dobara open karein, phir version commands check karein.

### Export fail hota hai

- `ffmpeg -version` aur `ffprobe -version` run karein.
- Dono tools PATH mein hone chahiye.
- `server/exports` aur temporary folders mein free disk space check karein.
- Terminal mein aane wala error message dekhein.

### AI tools kaam nahi karte

- `.env` file project ke root `reelforge-ai` folder mein honi chahiye.
- `OPENAI_API_KEY` valid honi chahiye.
- API account mein billing/usage access available hona chahiye.
- `.env` edit karne ke baad server restart karein.
- API key ko kisi public repository ya frontend file mein upload na karein.

### Upload fail hota hai

- Server disk ki free space check karein.
- Browser aur server terminal ka error dekhein.
- Bahut bari file ke liye hosting/proxy ki request limits check karein.
- Local machine par pehle chhoti test video se upload verify karein.

## 13. Project folders ka matlab

```text
reelforge-ai/
├── public/
│   ├── index.html       # Website layout
│   ├── styles.css       # Website design
│   └── app.js           # Browser editor interactions
├── server/
│   ├── index.js         # Backend, AI endpoints, upload and export
│   ├── uploads/         # Uploaded source videos
│   └── exports/         # Rendered MP4 exports
├── .env.example         # Environment variables template
├── package.json         # Node dependencies and scripts
├── start-windows.bat    # Windows startup helper
├── start-mac-linux.sh   # macOS/Linux startup helper
├── README.md            # Short project documentation
└── README 2.md          # This detailed user guide
```

## 14. Security aur production deployment

- `.env` aur API keys ko private rakhein.
- Public website launch karne se pehle login/authentication, user-wise file permissions, rate limits aur upload quotas add karein.
- Uploaded videos aur exports ko delete karne ki retention policy banayein.
- Server par persistent disk ya object storage configure karein.
- Long-running FFmpeg jobs ke liye background queue aur job status system add karein.
- Public deployment par HTTPS enable karein.
- Hosting provider ke upload, timeout, storage aur CPU/RAM limits verify karein.

## 15. Quick start checklist

- [ ] Node.js installed
- [ ] FFmpeg and FFprobe installed
- [ ] ZIP extracted
- [ ] `npm install` completed
- [ ] `.env` created
- [ ] OpenAI API key added (AI features ke liye)
- [ ] `npm start` running
- [ ] `http://localhost:3000` opened
- [ ] Test video uploaded
- [ ] Test MP4 export completed

Agar pehli baar use kar rahe hain to pehle 10–30 second ki chhoti test video par upload, subtitles aur export test karein. Uske baad bari video use karein.
