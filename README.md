# ReelForge AI — Video Studio

A dark, desktop-style browser video editor starter with:

- Drag-and-drop video upload and upload progress
- Disk-streamed uploads with no hard-coded 500 MB application limit
- Video preview, playback, trim in/out points, clip splitting, clip deletion, undo/redo, timeline zoom and preview zoom
- Sequence presets and 30 / 60 / 90 / 120 FPS export choices
- Subtitle overlays, subtitle timeline and burned-in subtitle export
- Speed control, volume adjustment, mute, basic noise reduction, fit/crop and fade in/out
- AI auto-captions, AI short-clip suggestions and natural-language edit requests
- MP4/H.264 export powered by FFmpeg

## Important: what is real and what needs setup

The editor UI, upload flow, preview, trim range, subtitle timeline, and FFmpeg export route are implemented. AI tools require an OpenAI API key and FFmpeg/FFprobe installed on the machine running the server. The AI assistant transcribes audio and asks the language model to identify useful clip ranges. It returns suggested edit points; the user chooses a clip and exports it.

This is an MVP foundation, not a full Premiere Pro replacement. Multi-track compositing, keyframes, motion tracking, advanced transitions, cloud project sync, team collaboration, and frame-accurate multi-clip editing would be later development phases.

## Large video uploads

There is intentionally no 500 MB file-size cap in the application code. Multer streams the incoming video to disk rather than keeping the entire upload in RAM. However, no website can promise literally unlimited uploads: the server needs enough disk space, and hosting providers, reverse proxies, browser memory, network stability, and processing time may impose their own limits. For production, use resumable uploads (for example, tus), object storage, per-user quotas, and background export workers.

## Requirements

- Node.js 18 or newer (Node 20 LTS recommended)
- FFmpeg and FFprobe installed and available on PATH
- An OpenAI API key for AI features

## Run locally

1. Extract the project folder.
2. Open a terminal in the `reelforge-ai` folder.
3. Install packages:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env` and add your OpenAI API key:

   ```env
   OPENAI_API_KEY=your_real_key_here
   OPENAI_MODEL=gpt-4o-mini
   PORT=3000
   ```

5. Make sure these commands work in your terminal:

   ```bash
   ffmpeg -version
   ffprobe -version
   ```

6. Start the app:

   ```bash
   npm start
   ```

7. Open `http://localhost:3000` in your browser.

On Windows, you can also double-click `start-windows.bat` after adding your `.env` settings. On macOS/Linux, run `./start-mac-linux.sh`.

## Windows notes

Install FFmpeg and add its `bin` folder to the Windows PATH, then restart the terminal. If FFmpeg is installed but not on PATH, set `FFMPEG_PATH` and `FFPROBE_PATH` in `.env` to the full executable paths.

## Deploying online

Deploy the Node server to a host that supports long-running FFmpeg jobs and large streamed uploads. Configure a persistent disk for `server/uploads` and `server/exports`, add `OPENAI_API_KEY`, and raise request/body/time limits at the reverse proxy. For real public use, add authentication, file cleanup policies, rate limiting, job queues, resumable uploads, and cloud object storage. Do not expose a personal API key in frontend JavaScript.

## Current export behavior

- MP4 container, H.264 video, AAC audio
- 30 / 60 / 90 / 120 FPS
- 720p, 1080p, vertical, square and 4K presets
- Trim range, speed, subtitles, mute and basic FFmpeg noise reduction
- The browser preview is local; the server copy is used for AI and export

The quality selector maps to FFmpeg H.264 CRF presets (high, balanced, smaller file).
