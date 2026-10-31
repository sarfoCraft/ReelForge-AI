const $ = (id) => document.getElementById(id);
const state = {
  file: null, fileId: null, objectUrl: null, duration: 0, trimStart: 0, trimEnd: 0,
  playing: false, timelineZoom: 85, previewZoom: 100, videoScale: 100, speed: 1,
  subtitles: [], segments: [], selectedSegment: 0, muted: false, noiseReduction: false, transition: 'none', undo: [], redo: []
};
const video = $('video-preview');
let toastTimer;

function toast(message) {
  const el = $('toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
function setStatus(message) { $('status-message').textContent = message; }
function fmtTime(seconds) {
  if (!Number.isFinite(seconds)) return '00:00';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function formatSize(bytes) {
  if (!bytes) return '—';
  const units = ['B','KB','MB','GB','TB']; let value = bytes, i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
function snapshot() { state.undo.push({trimStart:state.trimStart,trimEnd:state.trimEnd,subtitles:JSON.parse(JSON.stringify(state.subtitles)),segments:JSON.parse(JSON.stringify(state.segments)),selectedSegment:state.selectedSegment}); if(state.undo.length>30)state.undo.shift(); state.redo=[]; }
function setVideoSource(file) {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);
  video.src = state.objectUrl;
  $('preview-stage').classList.add('has-video');
  $('preview-watermark').style.display = 'block';
  $('project-name').textContent = file.name.replace(/\.[^.]+$/, '').slice(0, 32);
  $('inspector-file-name').textContent = file.name;
  $('inspector-file-meta').textContent = `${formatSize(file.size)} · Video file`;
  $('export-project-name').textContent = file.name.replace(/\.[^.]+$/, '');
}
async function uploadFile(file) {
  if (!file) return;
  if (!file.type.startsWith('video/') && !/\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(file.name)) { toast('Please choose a supported video file.'); return; }
  state.file = file; state.fileId = null; state.duration = 0; state.subtitles = []; state.segments = []; state.selectedSegment = 0; state.trimStart = 0; state.trimEnd = 0;
  setVideoSource(file); $('empty-state').classList.add('hidden');
  $('upload-progress').classList.add('active'); $('upload-percent').textContent = '0%'; $('upload-progress-bar').style.width = '0%';
  setStatus('Uploading video to the editing server…');
  const form = new FormData(); form.append('video', file);
  const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/upload');
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) { const p = Math.round(event.loaded / event.total * 100); $('upload-percent').textContent = `${p}%`; $('upload-progress-bar').style.width = `${p}%`; }
  };
  xhr.onload = () => {
    $('upload-progress').classList.remove('active');
    let data = {}; try { data = JSON.parse(xhr.responseText); } catch(_e) {}
    if (xhr.status >= 200 && xhr.status < 300) {
      state.fileId = data.id;
      if (data.duration) { state.duration = data.duration; state.trimEnd = data.duration; }
      else if (Number.isFinite(video.duration)) { state.duration = video.duration; state.trimEnd = video.duration; }
      state.segments = state.duration ? [{start:0,end:state.duration}] : []; state.selectedSegment = 0;
      updateDurationUI(); updateTimeline(); setStatus(`Uploaded ${file.name} · ${formatSize(file.size)}`); toast('Video uploaded. You are ready to edit.');
      $('inspector-file-meta').textContent = `${formatSize(file.size)} · ${data.width || '—'}×${data.height || '—'}`;
    } else { setStatus('Upload failed.'); toast(data.error || 'Upload failed. Check your server and disk space.'); }
  };
  xhr.onerror = () => { $('upload-progress').classList.remove('active'); setStatus('Upload failed.'); toast('Could not connect to the server.'); };
  xhr.send(form);
}
function updateDurationUI() {
  $('total-time').textContent = fmtTime(state.duration);
  $('trim-start').value = Number(state.trimStart || 0).toFixed(1);
  $('trim-end').value = Number(state.trimEnd || 0).toFixed(1);
  $('export-range-label').textContent = `${state.segments.length} clip${state.segments.length===1?'':'s'} · ${fmtTime(state.segments.reduce((sum,s)=>sum+s.end-s.start,0))}`;
  $('clip-count').textContent = `${state.segments.length} clip${state.segments.length===1?'':'s'}`;
}
function updatePlayhead() {
  const lane = $('video-track');
  const width = lane.clientWidth;
  const p = state.duration ? video.currentTime / state.duration : 0;
  $('playhead').style.left = `${Math.max(0, Math.min(width, p * width))}px`;
  $('current-time').textContent = fmtTime(video.currentTime || 0);
  const active = state.subtitles.find(s => video.currentTime >= s.start && video.currentTime <= s.end);
  $('subtitle-overlay').textContent = active ? active.text : '';
}
function updateTimeline() {
  const content = $('timeline-content');
  const width = Math.max(520, (state.duration || 60) * state.timelineZoom / 5);
  content.style.width = `${width + 88}px`;
  const lane = $('video-track'); lane.innerHTML = '<div class="playhead" id="playhead"></div>';
  state.segments.forEach((segment,index)=>{
    const clip=document.createElement('div'); clip.className=`timeline-clip${index===state.selectedSegment?' selected':''}`;
    clip.style.left=`${state.duration ? segment.start/state.duration*100 : 0}%`;
    clip.style.width=`${state.duration ? Math.max(1.5,(segment.end-segment.start)/state.duration*100) : 10}%`;
    const wave=document.createElement('span');wave.className='clip-wave';wave.textContent='▥ ▥ ▥ ▥ ▥';
    const title=document.createElement('strong');title.textContent=state.file?.name || 'Video clip';
    const left=document.createElement('span');left.className='clip-trim-handle left';
    const right=document.createElement('span');right.className='clip-trim-handle right';
    clip.append(wave,title,left,right);
    clip.onclick=(event)=>{event.stopPropagation();state.selectedSegment=index;state.trimStart=segment.start;state.trimEnd=segment.end;updateDurationUI();updateTimeline();video.currentTime=segment.start;};
    lane.appendChild(clip);
  });
  const ruler = $('time-ruler'); ruler.innerHTML = '';
  const count = Math.max(2, Math.min(12, Math.ceil((state.duration || 60) / 10)));
  for (let i=0;i<=count;i++) { const span=document.createElement('span'); span.textContent=fmtTime((state.duration || 60)*i/count); ruler.appendChild(span); }
  $('timeline-zoom').value = state.timelineZoom;
  updateSubtitleTimeline(); updatePlayhead();
}
function updateSubtitleTimeline() {
  const lane = $('subtitle-track'); lane.innerHTML = '';
  if (!state.subtitles.length) { lane.innerHTML = '<div class="track-empty">Add captions or subtitles to see them here</div>'; }
  else {
    state.subtitles.forEach(s => {
      const el=document.createElement('div'); el.className='subtitle-segment';
      const start=Math.max(0,s.start), end=Math.max(start+0.1,s.end);
      el.style.left=`${state.duration ? start/state.duration*100 : 0}%`;
      el.style.width=`${state.duration ? Math.max(3,(end-start)/state.duration*100) : 10}%`;
      el.textContent=s.text; lane.appendChild(el);
    });
  }
  const list=$('subtitle-list'); list.innerHTML='';
  if (!state.subtitles.length) { list.innerHTML='<p class="helper-text">Your subtitle segments will appear here.</p>'; return; }
  state.subtitles.forEach((s,i)=>{
    const row=document.createElement('div'); row.className='subtitle-list-item';
    const time=document.createElement('span'); time.textContent=`${fmtTime(s.start)}–${fmtTime(s.end)}`;
    const text=document.createElement('strong'); text.textContent=s.text;
    const del=document.createElement('button'); del.textContent='×'; del.title='Remove subtitle'; del.onclick=()=>{snapshot();state.subtitles.splice(i,1);updateSubtitleTimeline();};
    row.append(time,text,del); list.appendChild(row);
  });
}
function addSubtitle(text, start=video.currentTime||0, end=Math.min(state.duration||30,(video.currentTime||0)+3)) {
  if (!text) return;
  snapshot(); state.subtitles.push({text,start:Math.max(0,start),end:Math.max(start+0.5,end)}); state.subtitles.sort((a,b)=>a.start-b.start); updateSubtitleTimeline();
  toast('Subtitle added to the timeline.');
}
function showAiResults(plan) {
  const wrap=$('ai-results'); wrap.classList.remove('hidden'); wrap.innerHTML='';
  const heading=document.createElement('h4'); heading.textContent='✦ AI edit suggestions'; wrap.appendChild(heading);
  (plan.segments||[]).forEach((segment,index)=>{
    const row=document.createElement('div'); row.className='ai-result-item';
    const info=document.createElement('div'); const title=document.createElement('strong'); title.textContent=segment.title || `Suggested clip ${index+1}`;
    const meta=document.createElement('small'); meta.textContent=`${fmtTime(segment.start)} – ${fmtTime(segment.end)} · ${segment.reason||'AI-selected moment'}`; info.append(title,meta);
    const use=document.createElement('button'); use.textContent='Use clip'; use.onclick=()=>{snapshot();state.segments=[{start:segment.start,end:segment.end}];state.selectedSegment=0;state.trimStart=segment.start;state.trimEnd=segment.end;video.currentTime=segment.start;updateDurationUI();updateTimeline();toast('AI clip selected. Export when ready.');};
    row.append(info,use); wrap.appendChild(row);
  });
  (plan.suggestions||[]).forEach(s=>{const p=document.createElement('p');p.className='helper-text';p.textContent=`• ${s}`;wrap.appendChild(p);});
  if (!(plan.segments||[]).length && !(plan.suggestions||[]).length) { const p=document.createElement('p');p.className='helper-text';p.textContent='AI could not identify clear edit points. Try a more specific instruction.';wrap.appendChild(p); }
}
async function runAi(instruction, mode='assistant') {
  if (!state.fileId) { toast('Upload a video before using AI tools.'); return; }
  const btn=$('run-ai'); btn.disabled=true; btn.textContent='Working…'; setStatus('AI is reviewing your video. This can take a little while…');
  try {
    const endpointMode = mode === 'assistant' && /short|reel|highlight/i.test(instruction) ? 'shorts' : mode;
    const response=await fetch(`/api/ai/${endpointMode}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileId:state.fileId,instruction})});
    const data=await response.json(); if(!response.ok) throw new Error(data.error||'AI request failed.');
    showAiResults(data);
    if (/short|reel|highlight/i.test(instruction) && data.segments?.length) {
      const best=data.segments[0]; snapshot(); state.segments=[{start:best.start,end:best.end}]; state.selectedSegment=0; state.trimStart=best.start; state.trimEnd=best.end; video.currentTime=best.start; updateDurationUI(); updateTimeline();
    }
    if (data.captions?.length && /caption|subtitle/i.test(instruction)) {
      snapshot(); state.subtitles=data.captions.map(c=>({start:c.start,end:c.end,text:c.text})); updateSubtitleTimeline();
    }
    setStatus('AI suggestions are ready. Choose a clip to apply it.'); toast('AI suggestions generated.');
  } catch(error) { setStatus('AI assistant unavailable.'); toast(error.message); }
  finally { btn.disabled=false; btn.innerHTML='Generate <span>✦</span>'; }
}
async function generateCaptions() {
  if (!state.fileId) { toast('Upload a video first.'); return; }
  setStatus('Transcribing audio and generating captions…'); toast('Generating captions. Longer videos may take more time.');
  try {
    const response=await fetch('/api/ai/captions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileId:state.fileId})});
    const data=await response.json(); if(!response.ok)throw new Error(data.error||'Caption generation failed.');
    snapshot(); state.subtitles=(data.captions||[]).map(c=>({start:c.start,end:c.end,text:c.text})); updateSubtitleTimeline();
    document.querySelector('[data-tab="text"]').click(); setStatus(`${state.subtitles.length} caption segments added.`); toast(`${state.subtitles.length} caption segments generated.`);
  } catch(error) { setStatus('Caption generation failed.'); toast(error.message); }
}
function openExport() {
  if (!state.fileId) { toast('Upload a video before exporting.'); return; }
  $('export-modal').classList.remove('hidden'); $('export-range-label').textContent=`${fmtTime(state.trimStart)} – ${fmtTime(state.trimEnd)}`;
  $('export-resolution').value=$('sequence-size').value; $('export-fps').value=$('sequence-fps').value;
}
async function exportVideo() {
  if (!state.fileId) return;
  const button=$('start-export'); button.disabled=true; button.textContent='Rendering…'; $('export-progress').classList.remove('hidden');
  const quality=$('export-quality').value;
  try {
    const response=await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      fileId:state.fileId,start:state.trimStart,end:state.trimEnd,segments:state.segments,
      fps:Number($('export-fps').value),resolution:$('export-resolution').value,
      speed:Number($('speed-control').value),mute:$('mute-control').checked,
      noiseReduction:$('noise-control').checked,volume:Number($('volume-control').value)/100,
      fit:$('fit-control').value,zoom:state.videoScale/100,transition:$('audio-fade-control').checked?'fade':'none',
      subtitles:state.subtitles,subtitleColor:$('subtitle-color').value,subtitleSize:Number($('subtitle-size').value),quality
    })});
    const data=await response.json(); if(!response.ok)throw new Error(data.error||'Export failed.');
    const a=document.createElement('a');a.href=data.downloadUrl;a.download=data.filename;document.body.appendChild(a);a.click();a.remove();
    $('export-modal').classList.add('hidden'); toast('Export is ready. Your download should start now.'); setStatus('Export completed successfully.');
  } catch(error) { toast(error.message); setStatus('Export failed.'); }
  finally {button.disabled=false;button.innerHTML='Start export <b>↗</b>';$('export-progress').classList.add('hidden');}
}

$('choose-video').onclick=()=>$('file-input').click();
$('file-input').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)uploadFile(file);e.target.value='';});
const stage=$('preview-stage');
stage.addEventListener('dragover',e=>{e.preventDefault();stage.classList.add('dragging');});
stage.addEventListener('dragleave',()=>stage.classList.remove('dragging'));
stage.addEventListener('drop',e=>{e.preventDefault();stage.classList.remove('dragging');const file=e.dataTransfer.files?.[0];if(file)uploadFile(file);});
$('play-pause').onclick=()=>{if(!state.file)return;if(video.paused){video.play();$('play-pause').textContent='Ⅱ';}else{video.pause();$('play-pause').textContent='▶';}};
video.addEventListener('play',()=>{state.playing=true;$('play-pause').textContent='Ⅱ';});
video.addEventListener('pause',()=>{state.playing=false;$('play-pause').textContent='▶';});
video.addEventListener('loadedmetadata',()=>{if(!state.duration){state.duration=video.duration;state.trimEnd=video.duration;state.segments=[{start:0,end:video.duration}];state.selectedSegment=0;updateDurationUI();updateTimeline();}});
video.addEventListener('timeupdate',()=>{updatePlayhead();if(state.trimEnd && video.currentTime>=state.trimEnd){video.pause();video.currentTime=state.trimEnd;}});
$('jump-start').onclick=()=>{video.currentTime=state.trimStart||0;};$('jump-end').onclick=()=>{video.currentTime=state.trimEnd||state.duration;};
$('trim-start').onchange=e=>{if(!state.segments.length)return;snapshot();state.trimStart=Math.max(0,Math.min(Number(e.target.value)||0,state.trimEnd-.1));state.segments[state.selectedSegment]={start:state.trimStart,end:state.trimEnd};video.currentTime=state.trimStart;updateDurationUI();updateTimeline();};
$('trim-end').onchange=e=>{if(!state.segments.length)return;snapshot();state.trimEnd=Math.min(state.duration||Number(e.target.value),Math.max(state.trimStart+.1,Number(e.target.value)||state.duration));state.segments[state.selectedSegment]={start:state.trimStart,end:state.trimEnd};updateDurationUI();updateTimeline();};
$('video-track').addEventListener('click',e=>{if(!state.duration)return;const rect=e.currentTarget.getBoundingClientRect();const fraction=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));video.currentTime=fraction*state.duration;});
$('timeline-zoom').oninput=e=>{state.timelineZoom=Number(e.target.value);updateTimeline();};
$('timeline-zoom-in').onclick=()=>{state.timelineZoom=Math.min(180,state.timelineZoom+10);updateTimeline();};$('timeline-zoom-out').onclick=()=>{state.timelineZoom=Math.max(40,state.timelineZoom-10);updateTimeline();};
$('preview-zoom-in').onclick=()=>{state.previewZoom=Math.min(150,state.previewZoom+10);video.style.transform=`scale(${state.previewZoom/100})`;$('preview-zoom-value').textContent=`${state.previewZoom}%`;};
$('preview-zoom-out').onclick=()=>{state.previewZoom=Math.max(50,state.previewZoom-10);video.style.transform=`scale(${state.previewZoom/100})`;$('preview-zoom-value').textContent=`${state.previewZoom}%`;};
$('scale-control').oninput=e=>{state.videoScale=Number(e.target.value);video.style.transform=`scale(${state.videoScale/100})`;$('scale-value').textContent=`${state.videoScale}%`;};
$('speed-control').onchange=e=>{state.speed=Number(e.target.value);video.playbackRate=state.speed;};
$('fit-control').onchange=e=>{video.style.objectFit=e.target.value;};
$('volume-control').oninput=e=>{video.volume=Math.min(1,Number(e.target.value)/100);$('volume-value').textContent=`${e.target.value}%`;};
$('mute-control').onchange=e=>{state.muted=e.target.checked;video.muted=state.muted;};
$('noise-control').onchange=e=>state.noiseReduction=e.target.checked;
$('sequence-size').onchange=()=>{$('preview-resolution').textContent=$('sequence-size').value.replace('x',' × ');$('export-resolution').value=$('sequence-size').value;};
$('sequence-fps').onchange=()=>{$('export-fps').value=$('sequence-fps').value;};
$('sequence-ratio').onchange=e=>{$('inspector-ratio').value=e.target.value;};
$('inspector-ratio').onchange=e=>{$('sequence-ratio').value=e.target.value;if(e.target.value==='9:16')$('sequence-size').value='1080x1920';else if(e.target.value==='1:1')$('sequence-size').value='1080x1080';else $('sequence-size').value='1920x1080';$('sequence-size').dispatchEvent(new Event('change'));};
$('inspector-fps').onchange=e=>{$('sequence-fps').value=e.target.value;};
$('add-subtitle').onclick=()=>{const text=prompt('Enter subtitle text:');if(text)addSubtitle(text);};
$('add-subtitle-from-panel').onclick=()=>addSubtitle($('subtitle-text').value.trim());
$('subtitle-color').oninput=()=>{const active=state.subtitles.find(s=>video.currentTime>=s.start&&video.currentTime<=s.end);if(active)$('subtitle-overlay').style.color=$('subtitle-color').value;};
$('subtitle-size').oninput=e=>{$('subtitle-size-value').textContent=`${e.target.value} px`;$('subtitle-overlay').style.fontSize=`${e.target.value}px`;};
$('split-clip').onclick=()=>{if(!state.file||!state.segments.length){toast('Upload a video first.');return;}const point=video.currentTime;const index=state.segments.findIndex(s=>point>s.start+.05&&point<s.end-.05);if(index<0){toast('Move the playhead inside a clip to split it.');return;}snapshot();const original=state.segments[index];state.segments.splice(index,1,{start:original.start,end:point},{start:point,end:original.end});state.selectedSegment=index+1;state.trimStart=point;state.trimEnd=original.end;updateDurationUI();updateTimeline();toast('Clip split into two timeline segments.');};
$('delete-clip').onclick=()=>{if(!state.file||!state.segments.length){toast('There is no clip to delete.');return;}snapshot();state.segments.splice(state.selectedSegment,1);if(state.selectedSegment>=state.segments.length)state.selectedSegment=Math.max(0,state.segments.length-1);const selected=state.segments[state.selectedSegment];if(selected){state.trimStart=selected.start;state.trimEnd=selected.end;video.currentTime=selected.start;}else{state.trimStart=0;state.trimEnd=0;}updateDurationUI();updateTimeline();toast('Selected clip segment removed from the timeline.');};
$('run-ai').onclick=()=>{const promptText=$('ai-instruction').value.trim();if(/subtitle|caption/i.test(promptText))generateCaptions();else runAi(promptText);};
$('ai-instruction').addEventListener('keydown',e=>{if(e.key==='Enter')$('run-ai').click();});
document.querySelectorAll('.ai-suggestions button').forEach(b=>b.onclick=()=>{$('ai-instruction').value=b.dataset.prompt;if(/subtitle|caption/i.test(b.dataset.prompt))generateCaptions();else runAi(b.dataset.prompt,'shorts');});
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{if(b.dataset.tool==='captions')generateCaptions();if(b.dataset.tool==='shorts')runAi('Find the best moments and create 3 engaging short videos with strong hooks.','shorts');if(b.dataset.tool==='cleanup'){document.querySelector('[data-tab="audio"]').click();$('noise-control').checked=true;state.noiseReduction=true;toast('Noise reduction enabled for export.');}});
$('auto-captions').onclick=generateCaptions;$('auto-cleanup').onclick=()=>{document.querySelector('[data-tab="audio"]').click();$('noise-control').checked=true;state.noiseReduction=true;toast('Noise reduction enabled. It will be applied during export.');};
$('apply-vertical').onclick=()=>{$('sequence-ratio').value='9:16';$('sequence-ratio').dispatchEvent(new Event('change'));toast('Vertical sequence selected.');};
$('apply-caption-style').onclick=()=>{$('subtitle-color').value='#ffffff';$('subtitle-size').value=32;$('subtitle-size').dispatchEvent(new Event('input'));toast('Readable caption style applied.');};
document.querySelectorAll('.inspector-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.inspector-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');['clip','audio','text'].forEach(t=>$(`tab-${t}`).classList.toggle('hidden',t!==b.dataset.tab));});
$('open-export').onclick=openExport;$('start-export').onclick=exportVideo;$('replace-video').onclick=()=>$('file-input').click();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$($(b.dataset.close)).classList.add('hidden'));
$('fullscreen-preview').onclick=()=>{if(stage.requestFullscreen)stage.requestFullscreen();};
$('share-btn').onclick=()=>toast('Share links can be added after deployment with user accounts and cloud storage.');
$('undo-btn').onclick=()=>{const prev=state.undo.pop();if(!prev){toast('Nothing to undo.');return;}state.redo.push({trimStart:state.trimStart,trimEnd:state.trimEnd,subtitles:JSON.parse(JSON.stringify(state.subtitles)),segments:JSON.parse(JSON.stringify(state.segments)),selectedSegment:state.selectedSegment});Object.assign(state,prev);updateDurationUI();updateTimeline();toast('Last edit undone.');};
$('redo-btn').onclick=()=>{const next=state.redo.pop();if(!next){toast('Nothing to redo.');return;}state.undo.push({trimStart:state.trimStart,trimEnd:state.trimEnd,subtitles:JSON.parse(JSON.stringify(state.subtitles)),segments:JSON.parse(JSON.stringify(state.segments)),selectedSegment:state.selectedSegment});Object.assign(state,next);updateDurationUI();updateTimeline();toast('Edit restored.');};
$('nav-ai').onclick=()=>setTimeout(()=>$('ai-instruction').focus(),100);
window.addEventListener('resize',updatePlayhead);
fetch('/api/health').then(r=>r.json()).then(data=>{if(!data.ffmpegReady){setStatus('FFmpeg was not detected. Upload preview works, but export needs FFmpeg installed.');}else if(!data.aiReady){setStatus('Ready. Add OPENAI_API_KEY to enable AI tools.');}}).catch(()=>setStatus('Server connection unavailable. Start the ReelForge server first.'));
