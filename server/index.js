require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const OpenAI = require('openai');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const EXPORT_DIR = path.join(__dirname, 'exports');
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
const media = new Map();

for (const dir of [UPLOAD_DIR, EXPORT_DIR]) fs.mkdirSync(dir, { recursive: true });
app.use(express.json({ limit: '2mb' }));
app.use(express.static(PUBLIC_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10) || '.mp4';
    cb(null, `${randomUUID()}${ext}`);
  }
});
// Intentionally no fileSize limit here. Multer streams uploads to disk instead of buffering
// the complete video in RAM. Actual limits still depend on available disk and hosting/proxy rules.
const upload = multer({ storage });

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr?.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || `${command} exited with code ${code}`)));
  });
}

async function probe(filePath) {
  try {
    const { stdout } = await run(FFPROBE, [
      '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate',
      '-of', 'json', filePath
    ]);
    const data = JSON.parse(stdout || '{}');
    const video = (data.streams || []).find(s => s.codec_type === 'video') || {};
    return {
      duration: Number(data.format?.duration || 0),
      width: Number(video.width || 0),
      height: Number(video.height || 0),
      frameRate: video.r_frame_rate || '—',
      hasAudio: (data.streams || []).some(s => s.codec_type === 'audio')
    };
  } catch (_error) {
    return { duration: 0, width: 0, height: 0, frameRate: '—', hasAudio: false };
  }
}

function getMedia(fileId) {
  const item = media.get(fileId);
  if (!item || !fs.existsSync(item.path)) {
    const error = new Error('Video file not found. Please upload it again.');
    error.status = 404;
    throw error;
  }
  return item;
}

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('AI features need an OPENAI_API_KEY. Add it to your .env file, then restart the server.');
    error.status = 503;
    throw error;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function transcribeVideo(filePath) {
  const openai = getOpenAI();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reelforge-audio-'));
  try {
    const pattern = path.join(tempDir, '%03d.mp3');
    await run(FFMPEG, [
      '-y', '-i', filePath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame',
      '-b:a', '64k', '-f', 'segment', '-segment_time', '480', '-reset_timestamps', '1', pattern
    ]);
    const chunks = fs.readdirSync(tempDir).filter(name => name.endsWith('.mp3')).sort();
    if (!chunks.length) throw new Error('No audio track was found in this video.');
    const allSegments = [];
    const allText = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkPath = path.join(tempDir, chunks[i]);
      const result = await openai.audio.transcriptions.create({
        file: fs.createReadStream(chunkPath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment']
      });
      const offset = i * 480;
      if (result.text) allText.push(result.text);
      for (const segment of (result.segments || [])) {
        allSegments.push({
          start: Number(segment.start || 0) + offset,
          end: Number(segment.end || 0) + offset,
          text: String(segment.text || '').trim()
        });
      }
    }
    return { text: allText.join(' ').trim(), segments: allSegments };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function safeJson(content) {
  const cleaned = String(content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}

async function createEditPlan(filePath, instruction, duration) {
  const openai = getOpenAI();
  const transcript = await transcribeVideo(filePath);
  const transcriptForModel = transcript.segments.length
    ? transcript.segments.map(s => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join('\n').slice(0, 45000)
    : transcript.text.slice(0, 45000);
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a professional short-form video editor. Use only timestamps supported by the supplied transcript. Return valid JSON with keys: segments (array of objects with start, end, title, reason), suggestions (array of short strings), and captions (array of objects with start, end, text). Never invent transcript content or timestamps. Keep every segment within the video duration. For a short-form request, select 3 to 5 compelling clips, ideally 15 to 60 seconds each, with a strong hook and a clear ending. If exact short clips cannot be identified, return fewer segments rather than inventing them.'
      },
      {
        role: 'user',
        content: `Video duration: ${duration || 'unknown'} seconds.\nEditing request: ${instruction}\nTranscript with timestamps:\n${transcriptForModel || 'No transcript available.'}`
      }
    ]
  });
  const plan = safeJson(completion.choices?.[0]?.message?.content || '{}');
  const maxDuration = duration || Number.MAX_SAFE_INTEGER;
  plan.segments = (plan.segments || []).map(s => ({
    start: Math.max(0, Math.min(maxDuration, Number(s.start || 0))),
    end: Math.max(0, Math.min(maxDuration, Number(s.end || 0))),
    title: String(s.title || 'Suggested clip'),
    reason: String(s.reason || '')
  })).filter(s => s.end > s.start);
  plan.captions = (plan.captions || []).map(c => ({
    start: Math.max(0, Number(c.start || 0)),
    end: Math.max(0, Number(c.end || 0)),
    text: String(c.text || '')
  })).filter(c => c.end > c.start && c.text);
  plan.transcriptText = transcript.text;
  return plan;
}

app.get('/api/health', async (_req, res) => {
  let ffmpegReady = false;
  try { await run(FFMPEG, ['-version']); ffmpegReady = true; } catch (_e) {}
  res.json({ ok: true, ffmpegReady, aiReady: Boolean(process.env.OPENAI_API_KEY) });
});

app.post('/api/upload', upload.single('video'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a video file first.' });
    const id = path.basename(req.file.filename, path.extname(req.file.filename));
    const info = await probe(req.file.path);
    const record = {
      id,
      path: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      ...info
    };
    media.set(id, record);
    res.json({
      id,
      name: record.originalName,
      size: record.size,
      duration: record.duration,
      width: record.width,
      height: record.height,
      frameRate: record.frameRate
    });
  } catch (error) { next(error); }
});

app.post('/api/ai/captions', async (req, res, next) => {
  try {
    const item = getMedia(req.body.fileId);
    const transcript = await transcribeVideo(item.path);
    res.json({ captions: transcript.segments, transcript: transcript.text });
  } catch (error) { next(error); }
});

app.post('/api/ai/shorts', async (req, res, next) => {
  try {
    const item = getMedia(req.body.fileId);
    const plan = await createEditPlan(item.path, req.body.instruction || 'Find the best moments and turn this into engaging short-form clips.', item.duration);
    res.json(plan);
  } catch (error) { next(error); }
});

app.post('/api/ai/assistant', async (req, res, next) => {
  try {
    const item = getMedia(req.body.fileId);
    const instruction = String(req.body.instruction || '').trim();
    if (!instruction) return res.status(400).json({ error: 'Write an editing instruction first.' });
    const plan = await createEditPlan(item.path, instruction, item.duration);
    res.json(plan);
  } catch (error) { next(error); }
});

function secondsToSrt(value) {
  const ms = Math.max(0, Math.round(value * 1000));
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}
function escapeFilterPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}
function hexToAss(hex) {
  const clean = String(hex || '#ffffff').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '&H00FFFFFF';
  const r = clean.slice(0, 2), g = clean.slice(2, 4), b = clean.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

app.post('/api/export', async (req, res, next) => {
  let subtitleFile;
  try {
    const item = getMedia(req.body.fileId);
    const requested = Array.isArray(req.body.segments) && req.body.segments.length
      ? req.body.segments
      : [{ start: req.body.start || 0, end: req.body.end || item.duration || 0 }];
    const segments = requested.map(s => ({
      start: Math.max(0, Number(s.start || 0)),
      end: item.duration ? Math.min(item.duration, Number(s.end || item.duration)) : Number(s.end || 0)
    })).filter(s => s.end > s.start);
    if (!segments.length) return res.status(400).json({ error: 'There are no active clips in the timeline to export.' });

    const fps = [30, 60, 90, 120].includes(Number(req.body.fps)) ? Number(req.body.fps) : 30;
    const resolution = String(req.body.resolution || '1920x1080');
    const match = resolution.match(/^(\d{3,4})x(\d{3,4})$/);
    const width = match ? Number(match[1]) : 1920;
    const height = match ? Number(match[2]) : 1080;
    const speed = Math.max(0.5, Math.min(2, Number(req.body.speed || 1)));
    const totalDuration = segments.reduce((sum, s) => sum + s.end - s.start, 0);
    const outputDuration = totalDuration / speed;
    const transition = req.body.transition === 'fade';
    const subtitles = Array.isArray(req.body.subtitles) ? req.body.subtitles : [];

    // Map original-video subtitle times onto the edited, concatenated timeline.
    const usable = [];
    let timelineOffset = 0;
    for (const segment of segments) {
      for (const sub of subtitles) {
        const overlapStart = Math.max(segment.start, Number(sub.start || 0));
        const overlapEnd = Math.min(segment.end, Number(sub.end || 0));
        const text = String(sub.text || '').replace(/\r/g, '').trim();
        if (overlapEnd > overlapStart && text) {
          usable.push({
            start: (timelineOffset + (overlapStart - segment.start)) / Math.max(0.5, Math.min(2, Number(req.body.speed || 1))),
            end: (timelineOffset + (overlapEnd - segment.start)) / Math.max(0.5, Math.min(2, Number(req.body.speed || 1))),
            text
          });
        }
      }
      timelineOffset += segment.end - segment.start;
    }

    const videoFilters = [];
    if (speed !== 1) videoFilters.push(`setpts=${(1 / speed).toFixed(4)}*PTS`);
    const zoom = Math.max(0.5, Math.min(2, Number(req.body.zoom || 1)));
    if (req.body.fit === 'cover' || zoom > 1) {
      videoFilters.push(
        `scale=${Math.round(width * zoom)}:${Math.round(height * zoom)}:force_original_aspect_ratio=increase`,
        `crop=${width}:${height}`
      );
    } else {
      videoFilters.push(
        `scale=${Math.round(width * zoom)}:${Math.round(height * zoom)}:force_original_aspect_ratio=decrease`,
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`
      );
    }
    videoFilters.push('setsar=1', `fps=${fps}`);
    if (transition) {
      videoFilters.push('fade=t=in:st=0:d=0.45');
      if (outputDuration > 0.9) videoFilters.push(`fade=t=out:st=${Math.max(0, outputDuration - 0.45).toFixed(3)}:d=0.45`);
    }
    if (usable.length) {
      const srt = usable.map((s, i) => `${i + 1}\n${secondsToSrt(s.start)} --> ${secondsToSrt(s.end)}\n${s.text}\n`).join('\n');
      subtitleFile = path.join(os.tmpdir(), `reelforge-${randomUUID()}.srt`);
      fs.writeFileSync(subtitleFile, srt, 'utf8');
      const fontSize = Math.max(16, Math.min(64, Number(req.body.subtitleSize || 30)));
      const color = hexToAss(req.body.subtitleColor || '#ffffff');
      videoFilters.push(`subtitles=filename='${escapeFilterPath(subtitleFile)}':force_style='FontName=Arial,FontSize=${fontSize},PrimaryColour=${color},OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=42'`);
    }

    const audioFilters = [];
    if (req.body.noiseReduction) audioFilters.push('afftdn=nf=-25');
    const volume = Math.max(0, Math.min(2, Number(req.body.volume ?? 1)));
    if (volume !== 1) audioFilters.push(`volume=${volume}`);
    if (speed !== 1) audioFilters.push(`atempo=${speed}`);
    if (transition) {
      audioFilters.push('afade=t=in:st=0:d=0.45');
      if (outputDuration > 0.9) audioFilters.push(`afade=t=out:st=${Math.max(0, outputDuration - 0.45).toFixed(3)}:d=0.45`);
    }

    const outputId = randomUUID();
    const outputPath = path.join(EXPORT_DIR, `${outputId}.mp4`);
    const crf = req.body.quality === 'high' ? '18' : req.body.quality === 'small' ? '25' : '21';
    let args;

    if (segments.length === 1) {
      const segment = segments[0];
      args = ['-y', '-ss', String(segment.start), '-i', item.path, '-t', String(segment.end - segment.start), '-vf', videoFilters.join(','), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
      if (req.body.mute || !item.hasAudio) {
        args.push('-an');
      } else {
        if (audioFilters.length) args.push('-af', audioFilters.join(','));
        args.push('-c:a', 'aac', '-b:a', '192k');
      }
    } else {
      args = ['-y', '-i', item.path];
      const parts = [];
      const videoLabels = segments.map((_s, i) => `[v${i}]`).join('');
      parts.push(`[0:v]split=${segments.length}${videoLabels}`);
      segments.forEach((segment, i) => {
        parts.push(`[v${i}]trim=start=${segment.start}:end=${segment.end},setpts=PTS-STARTPTS[vt${i}]`);
      });
      const hasAudioOutput = item.hasAudio && !req.body.mute;
      if (hasAudioOutput) {
        const audioLabels = segments.map((_s, i) => `[a${i}]`).join('');
        parts.push(`[0:a]asplit=${segments.length}${audioLabels}`);
        segments.forEach((segment, i) => {
          parts.push(`[a${i}]atrim=start=${segment.start}:end=${segment.end},asetpts=PTS-STARTPTS[at${i}]`);
        });
        const concatInputs = segments.map((_s, i) => `[vt${i}][at${i}]`).join('');
        parts.push(`${concatInputs}concat=n=${segments.length}:v=1:a=1[vc][ac]`);
      } else {
        const concatInputs = segments.map((_s, i) => `[vt${i}]`).join('');
        parts.push(`${concatInputs}concat=n=${segments.length}:v=1:a=0[vc]`);
      }
      parts.push(`[vc]${videoFilters.join(',')}[vout]`);
      if (hasAudioOutput) parts.push(`[ac]${audioFilters.length ? audioFilters.join(',') : 'anull'}[aout]`);
      args.push('-filter_complex', parts.join(';'), '-map', '[vout]');
      if (hasAudioOutput) args.push('-map', '[aout]'); else args.push('-an');
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
      if (hasAudioOutput) args.push('-c:a', 'aac', '-b:a', '192k');
    }

    args.push(outputPath);
    await run(FFMPEG, args);
    res.json({ id: outputId, filename: `reelforge-export-${outputId.slice(0, 8)}.mp4`, downloadUrl: `/api/download/${outputId}` });
  } catch (error) { next(error); }
  finally { if (subtitleFile) fs.rmSync(subtitleFile, { force: true }); }
});

app.get('/api/download/:id', (req, res) => {
  const file = path.join(EXPORT_DIR, `${path.basename(req.params.id)}.mp4`);
  if (!fs.existsSync(file)) return res.status(404).send('Export not found.');
  res.download(file, `reelforge-export-${req.params.id.slice(0, 8)}.mp4`);
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Something went wrong.' });
});

app.listen(PORT, () => console.log(`ReelForge AI is running at http://localhost:${PORT}`));
