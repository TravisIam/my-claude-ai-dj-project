import { useState, useEffect, useRef, useCallback } from "react";

const C = {
  bg: "#0a0a0f", surface: "#13131a", panel: "#1a1a24", border: "#2a2a3a",
  blue: "#00aaff", amber: "#ff9900", green: "#00ff88", red: "#ff3366",
  cue: "#cc44ff",
  text: "#e8e8f0", muted: "#666680", knob: "#0d0d14",
};

// ─── Shared AudioContext ──────────────────────────────────────────────────────
let sharedCtx = null;
function getCtx() {
  if (!sharedCtx) sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (sharedCtx.state === "suspended") sharedCtx.resume();
  return sharedCtx;
}

// ─── Knob ─────────────────────────────────────────────────────────────────────
function Knob({ value, onChange, min = 0, max = 1, label, color = C.blue, size = 52 }) {
  const drag = useRef(false);
  const startY = useRef(0);
  const startV = useRef(0);
  const norm = (value - min) / (max - min);
  const angle = -140 + norm * 280;
  const cx = size / 2, cy = size / 2, r = size / 2 - 6;
  const toXY = (deg) => { const rad = (deg - 90) * (Math.PI / 180); return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]; };
  const [dx, dy] = toXY(angle);
  const arcR = r - 3;
  const toArcXY = (deg) => { const rad = (deg - 90) * (Math.PI / 180); return [cx + arcR * Math.cos(rad), cy + arcR * Math.sin(rad)]; };
  const [sx, sy] = toArcXY(-140);
  const [ex, ey] = toArcXY(angle);
  const largeArc = norm > 0.5 ? 1 : 0;
  useEffect(() => {
    const move = (e) => {
      if (!drag.current) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const delta = (startY.current - clientY) / 150;
      onChange(Math.min(max, Math.max(min, startV.current + delta * (max - min))));
    };
    const up = () => { drag.current = false; };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up); };
  }, [min, max, onChange]);
  const onDown = (e) => { drag.current = true; const clientY = e.touches ? e.touches[0].clientY : e.clientY; startY.current = clientY; startV.current = value; e.preventDefault(); };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, userSelect: "none" }}>
      <svg width={size} height={size} onMouseDown={onDown} onTouchStart={onDown} style={{ cursor: "ns-resize" }}>
        <circle cx={cx} cy={cy} r={arcR} fill="none" stroke="#1e1e2e" strokeWidth={4} strokeDasharray={`${2.2 * arcR} 999`} strokeDashoffset={-arcR * 0.55} strokeLinecap="round" />
        {norm > 0.001 && <path d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 ${largeArc} 1 ${ex} ${ey}`} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />}
        <circle cx={cx} cy={cy} r={r - 8} fill={C.knob} stroke={C.border} strokeWidth={1.5} />
        <circle cx={dx} cy={dy} r={3} fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
      </svg>
      {label && <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>}
    </div>
  );
}

// ─── VU Meter ─────────────────────────────────────────────────────────────────
function VuMeter({ level, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column-reverse", gap: 2, height: 90, width: 10 }}>
      {Array.from({ length: 12 }).map((_, i) => {
        const active = level > i / 12;
        const bc = i >= 10 ? C.red : i >= 8 ? C.amber : color;
        return <div key={i} style={{ flex: 1, borderRadius: 1, background: active ? bc : "#1a1a2e", boxShadow: active ? `0 0 4px ${bc}` : "none", transition: "background 0.04s" }} />;
      })}
    </div>
  );
}

// ─── Waveform ─────────────────────────────────────────────────────────────────
function Waveform({ analyserRef, isPlaying, color }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); const W = canvas.width, H = canvas.height; let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#0a0a0f"; ctx.fillRect(0, 0, W, H);
      const analyser = analyserRef.current;
      if (analyser && isPlaying) {
        const data = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(data);
        const bw = W / data.length * 2.5; let x = 0;
        for (let i = 0; i < data.length; i++) {
          const h = (data[i] / 255) * H;
          ctx.fillStyle = color + Math.floor((0.5 + (data[i] / 255) * 0.5) * 255).toString(16).padStart(2, "0");
          ctx.fillRect(x, H - h, Math.max(bw - 1, 1), h); x += bw; if (x > W) break;
        }
      } else {
        ctx.beginPath(); ctx.strokeStyle = color + "33"; ctx.lineWidth = 1.5;
        for (let x = 0; x < W; x++) { const y = H / 2 + Math.sin(x * 0.05 + t) * 5 + Math.sin(x * 0.02 + t * 0.3) * 8; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke(); t += 0.02;
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, color, analyserRef]);
  return <canvas ref={canvasRef} width={300} height={56} style={{ width: "100%", height: 56, borderRadius: 4, border: `1px solid ${C.border}` }} />;
}

// ─── Crossfader ───────────────────────────────────────────────────────────────
function Crossfader({ value, onChange }) {
  const trackRef = useRef(null); const drag = useRef(false);
  useEffect(() => {
    const move = (e) => { if (!drag.current || !trackRef.current) return; const rect = trackRef.current.getBoundingClientRect(); onChange(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))); };
    const up = () => { drag.current = false; };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [onChange]);
  return (
    <div style={{ width: "100%", padding: "0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: C.blue, fontWeight: 800 }}>A</span>
        <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 2 }}>Crossfader</span>
        <span style={{ fontSize: 11, color: C.amber, fontWeight: 800 }}>B</span>
      </div>
      <div ref={trackRef} style={{ position: "relative", height: 22, background: "#0a0a12", borderRadius: 11, border: `1px solid ${C.border}`, cursor: "pointer" }}
        onMouseDown={(e) => { const rect = e.currentTarget.getBoundingClientRect(); onChange(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))); drag.current = true; }}>
        <div style={{ position: "absolute", left: 2, top: 3, bottom: 3, width: `calc(${value * 100}% - 4px)`, background: `linear-gradient(to right, ${C.blue}66, transparent)`, borderRadius: 8 }} />
        <div style={{ position: "absolute", right: 2, top: 3, bottom: 3, width: `calc(${(1 - value) * 100}% - 4px)`, background: `linear-gradient(to left, ${C.amber}66, transparent)`, borderRadius: 8 }} />
        <div style={{ position: "absolute", top: "50%", left: `${value * 100}%`, transform: "translate(-50%, -50%)", width: 28, height: 28, background: "linear-gradient(145deg, #2a2a3e, #111118)", border: `1.5px solid ${C.border}`, borderRadius: 4, cursor: "ew-resize", boxShadow: "0 2px 8px rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 1.5, height: 10, background: C.border, borderRadius: 1 }} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Vertical Fader ───────────────────────────────────────────────────────────
function Fader({ value, onChange, color }) {
  const trackRef = useRef(null); const drag = useRef(false);
  useEffect(() => {
    const move = (e) => { if (!drag.current || !trackRef.current) return; const rect = trackRef.current.getBoundingClientRect(); onChange(1 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))); };
    const up = () => { drag.current = false; };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [onChange]);
  return (
    <div ref={trackRef} style={{ position: "relative", width: 20, height: 110, background: "#0a0a12", borderRadius: 10, border: `1px solid ${C.border}`, cursor: "ns-resize" }}
      onMouseDown={(e) => { const rect = e.currentTarget.getBoundingClientRect(); onChange(1 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))); drag.current = true; }}>
      <div style={{ position: "absolute", bottom: 4, left: 4, right: 4, height: `${value * (110 - 8)}px`, background: `linear-gradient(to top, ${color}, ${color}55)`, borderRadius: 6, boxShadow: `0 0 8px ${color}55` }} />
      <div style={{ position: "absolute", left: "50%", top: `${(1 - value) * (110 - 22)}px`, transform: "translateX(-50%)", width: 28, height: 22, background: "linear-gradient(145deg, #252535, #101018)", border: `1px solid ${C.border}`, borderRadius: 3, cursor: "ns-resize", boxShadow: "0 2px 6px rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 1.5, height: 7, background: C.border, borderRadius: 1 }} />)}
      </div>
    </div>
  );
}

// ─── Deck ─────────────────────────────────────────────────────────────────────
// gainNode  = crossfade-weighted master bus node (owned by App)
// cueGainNode = cue bus node (owned by App, always-on connection, gated by cueActive)
function Deck({ side, color, gainNode, cueGainNode, cueActive, onToggleCue }) {
  const [fileName, setFileName] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [tempo, setTempo] = useState(1.0);
  const [bpm, setBpm] = useState(128.0);
  const [eq, setEq] = useState({ hi: 1, mid: 1, lo: 1 });
  const [vuLevel, setVuLevel] = useState(0);
  const [loading, setLoading] = useState(false);

  const bufferRef    = useRef(null);
  const sourceRef    = useRef(null);
  const deckGainRef  = useRef(null);   // master path gain (volume)
  const cueGainRef   = useRef(null);   // cue path gain (volume, mirrors deckGain)
  const eqHiRef      = useRef(null);
  const eqMidRef     = useRef(null);
  const eqLoRef      = useRef(null);
  const analyserRef  = useRef(null);
  const startTimeRef = useRef(0);
  const offsetRef    = useRef(0);
  const vuTimerRef   = useRef(null);
  const clockRef     = useRef(null);

  // Build graph: source → deckEQ chain → analyser → [deckGain→masterBus] + [cueGain→cueBus]
  useEffect(() => {
    if (!gainNode || !cueGainNode) return;
    const ctx = getCtx();

    // EQ filters (shared pre-split)
    eqLoRef.current  = ctx.createBiquadFilter(); eqLoRef.current.type  = "lowshelf";  eqLoRef.current.frequency.value  = 200;
    eqMidRef.current = ctx.createBiquadFilter(); eqMidRef.current.type = "peaking";   eqMidRef.current.frequency.value = 1000; eqMidRef.current.Q.value = 1;
    eqHiRef.current  = ctx.createBiquadFilter(); eqHiRef.current.type  = "highshelf"; eqHiRef.current.frequency.value  = 4000;

    analyserRef.current = ctx.createAnalyser(); analyserRef.current.fftSize = 256;

    // Two post-EQ gain nodes — one for master path, one for cue path
    deckGainRef.current = ctx.createGain(); deckGainRef.current.gain.value = volume;
    cueGainRef.current  = ctx.createGain(); cueGainRef.current.gain.value  = 0; // start silent

    // Chain: eqLo → eqMid → eqHi → analyser → deckGain → masterBus
    //                                         └──────────→ cueGain → cueBus
    eqLoRef.current.connect(eqMidRef.current);
    eqMidRef.current.connect(eqHiRef.current);
    eqHiRef.current.connect(analyserRef.current);
    analyserRef.current.connect(deckGainRef.current);
    analyserRef.current.connect(cueGainRef.current);
    deckGainRef.current.connect(gainNode);
    cueGainRef.current.connect(cueGainNode);

    vuTimerRef.current = setInterval(() => {
      if (!analyserRef.current) return;
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);
      setVuLevel(data.reduce((a, b) => a + b, 0) / data.length / 100);
    }, 60);

    return () => {
      clearInterval(vuTimerRef.current);
      try { deckGainRef.current?.disconnect(); cueGainRef.current?.disconnect(); } catch (_) {}
    };
  }, [gainNode, cueGainNode]); // eslint-disable-line

  // Sync volume
  useEffect(() => {
    if (deckGainRef.current) deckGainRef.current.gain.value = volume;
    if (cueGainRef.current)  cueGainRef.current.gain.value  = cueActive ? volume : 0;
  }, [volume, cueActive]);

  // Sync cue on/off (without remounting)
  useEffect(() => {
    if (cueGainRef.current) cueGainRef.current.gain.value = cueActive ? volume : 0;
  }, [cueActive, volume]);

  // Sync EQ
  useEffect(() => {
    if (eqHiRef.current)  eqHiRef.current.gain.value  = (eq.hi  - 1) * 15;
    if (eqMidRef.current) eqMidRef.current.gain.value = (eq.mid - 1) * 15;
    if (eqLoRef.current)  eqLoRef.current.gain.value  = (eq.lo  - 1) * 15;
  }, [eq]);

  // Sync tempo to running source
  useEffect(() => { if (sourceRef.current) sourceRef.current.playbackRate.value = tempo; }, [tempo]);

  // Clock
  useEffect(() => {
    clockRef.current = setInterval(() => {
      if (!isPlaying || !bufferRef.current) return;
      const ctx = getCtx();
      const elapsed = (ctx.currentTime - startTimeRef.current) * tempo;
      setCurrentTime(Math.min(offsetRef.current + elapsed, duration));
    }, 100);
    return () => clearInterval(clockRef.current);
  }, [isPlaying, tempo, duration]);

  const loadFile = useCallback(async (file) => {
    setLoading(true); setIsPlaying(false);
    if (sourceRef.current) { try { sourceRef.current.stop(); } catch (_) {} sourceRef.current = null; }
    try {
      const ctx = getCtx();
      const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
      bufferRef.current = decoded; setDuration(decoded.duration); setCurrentTime(0); offsetRef.current = 0;
      setFileName(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) { alert("Could not decode audio. Try MP3 or WAV."); }
    setLoading(false);
  }, []);

  const _startSource = useCallback((offset) => {
    if (!bufferRef.current || !eqLoRef.current) return;
    const ctx = getCtx();
    const src = ctx.createBufferSource();
    src.buffer = bufferRef.current; src.playbackRate.value = tempo;
    src.connect(eqLoRef.current);
    src.start(0, offset);
    src.onended = () => { if (sourceRef.current === src) { setIsPlaying(false); offsetRef.current = 0; setCurrentTime(0); } };
    sourceRef.current = src; startTimeRef.current = ctx.currentTime; setIsPlaying(true);
  }, [tempo]);

  const play = useCallback(() => { _startSource(offsetRef.current); }, [_startSource]);

  const pause = useCallback(() => {
    if (!sourceRef.current) return;
    const elapsed = (getCtx().currentTime - startTimeRef.current) * tempo;
    offsetRef.current = Math.min(offsetRef.current + elapsed, duration);
    try { sourceRef.current.stop(); } catch (_) {}
    sourceRef.current = null; setIsPlaying(false);
  }, [tempo, duration]);

  const seek = useCallback((frac) => {
    const pos = frac * duration; const was = isPlaying;
    if (isPlaying) { try { sourceRef.current?.stop(); } catch (_) {} sourceRef.current = null; setIsPlaying(false); }
    offsetRef.current = pos; setCurrentTime(pos);
    if (was) setTimeout(() => _startSource(pos), 30);
  }, [isPlaying, duration, _startSource]);

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div style={{ flex: 1, minWidth: 0, background: C.surface, borderRadius: 12, border: `1px solid ${cueActive ? C.cue : C.border}`, padding: 14, display: "flex", flexDirection: "column", gap: 10, boxShadow: cueActive ? `0 0 20px ${C.cue}33` : `0 0 24px ${color}0d`, transition: "border-color 0.2s, box-shadow 0.2s" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 6, background: `${color}22`, border: `1px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color, flexShrink: 0 }}>{side}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loading ? "Loading…" : fileName || "No Track Loaded"}</div>
          <div style={{ fontSize: 10, color: C.muted }}>{duration > 0 ? `${fmt(currentTime)} / ${fmt(duration)}` : "—"}</div>
        </div>
        <label style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: `${color}1a`, color, border: `1px solid ${color}44`, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", flexShrink: 0 }}>
          Load <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac" onChange={(e) => e.target.files[0] && loadFile(e.target.files[0])} style={{ display: "none" }} />
        </label>
      </div>

      {/* Waveform */}
      <Waveform analyserRef={analyserRef} isPlaying={isPlaying} color={cueActive ? C.cue : color} />

      {/* Progress */}
      <div style={{ height: 5, background: C.panel, borderRadius: 3, cursor: duration > 0 ? "pointer" : "default" }}
        onClick={(e) => { if (!duration) return; const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); }}>
        <div style={{ height: "100%", width: `${duration ? (currentTime / duration) * 100 : 0}%`, background: cueActive ? C.cue : color, borderRadius: 3, boxShadow: `0 0 6px ${cueActive ? C.cue : color}`, transition: "width 0.1s linear" }} />
      </div>

      {/* Transport + CUE */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => seek(0)} style={{ width: 36, height: 36, borderRadius: 6, border: `1px solid ${C.border}`, background: C.panel, color: C.muted, cursor: "pointer", fontSize: 16 }}>⏮</button>
        <button onClick={isPlaying ? pause : play} disabled={!fileName || loading} style={{ flex: 1, height: 36, borderRadius: 6, border: `1px solid ${isPlaying ? color : color + "44"}`, background: isPlaying ? `${color}2a` : `${color}12`, color: isPlaying ? color : `${color}88`, cursor: fileName ? "pointer" : "not-allowed", fontSize: 18, fontWeight: 700, boxShadow: isPlaying ? `0 0 12px ${color}44` : "none", transition: "all 0.15s" }}>{isPlaying ? "⏸" : "▶"}</button>
        {/* CUE button */}
        <button
          onClick={onToggleCue}
          title="Toggle headphone cue — hear this deck privately without it going to master"
          style={{
            width: 52, height: 36, borderRadius: 6, fontSize: 13, fontWeight: 800, cursor: "pointer",
            border: `1.5px solid ${cueActive ? C.cue : C.border}`,
            background: cueActive ? `${C.cue}2a` : C.panel,
            color: cueActive ? C.cue : C.muted,
            boxShadow: cueActive ? `0 0 12px ${C.cue}55` : "none",
            transition: "all 0.15s", letterSpacing: 0.5,
          }}>
          {cueActive ? "🎧" : "CUE"}
        </button>
      </div>

      {/* BPM + Tempo */}
      <div style={{ background: C.panel, borderRadius: 8, border: `1px solid ${C.border}`, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>BPM</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <button onClick={() => setBpm(b => { const n = Math.round((Math.max(60, b - 0.1)) * 10) / 10; setTempo(n / 128); return n; })} style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, cursor: "pointer" }}>−</button>
              <div style={{ fontSize: 20, fontWeight: 900, color, minWidth: 54, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{bpm.toFixed(1)}</div>
              <button onClick={() => setBpm(b => { const n = Math.round((Math.min(200, b + 0.1)) * 10) / 10; setTempo(n / 128); return n; })} style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, cursor: "pointer" }}>+</button>
            </div>
          </div>
          <Knob value={tempo} onChange={(v) => { setTempo(v); setBpm(Math.round(128 * v * 10) / 10); }} min={0.5} max={2.0} label="Tempo" color={color} size={50} />
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Pitch</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: tempo !== 1 ? color : C.muted }}>{tempo > 1 ? "+" : ""}{((tempo - 1) * 100).toFixed(1)}%</div>
            <button onClick={() => { setTempo(1); setBpm(128.0); }} style={{ marginTop: 4, padding: "1px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, cursor: "pointer", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>Reset</button>
          </div>
        </div>
      </div>

      {/* EQ */}
      <div style={{ background: C.panel, borderRadius: 8, border: `1px solid ${C.border}`, padding: "10px 12px" }}>
        <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8, textAlign: "center" }}>EQ</div>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {[["hi", "HI"], ["mid", "MID"], ["lo", "LO"]].map(([k, lbl]) => (
            <Knob key={k} value={eq[k]} onChange={(v) => setEq(p => ({ ...p, [k]: v }))} min={0} max={2} label={lbl} color={color} size={48} />
          ))}
        </div>
      </div>

      {/* Volume + VU */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Vol</div>
          <Fader value={volume} onChange={setVolume} color={color} />
          <div style={{ fontSize: 11, color: C.muted }}>{Math.round(volume * 100)}%</div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", paddingBottom: 20 }}>
          <VuMeter level={isPlaying ? vuLevel : 0} color={cueActive ? C.cue : color} />
          <VuMeter level={isPlaying ? vuLevel * 0.88 : 0} color={cueActive ? C.cue : color} />
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function DJMixer() {
  const [ready, setReady]         = useState(false);
  const [crossfade, setCrossfade] = useState(0.5);
  const [masterVol, setMasterVol] = useState(0.85);
  const [cueVol, setCueVol]       = useState(0.8);
  const [cueA, setCueA]           = useState(false);
  const [cueB, setCueB]           = useState(false);

  // Master bus nodes
  const masterGainRef = useRef(null);
  const cueGainRef    = useRef(null);   // cue bus master level

  // Per-deck crossfade nodes (into master)
  const gainARef = useRef(null);
  const gainBRef = useRef(null);

  // Per-deck cue feed nodes (into cue bus)
  const cueAFeedRef = useRef(null);
  const cueBFeedRef = useRef(null);

  // State versions for passing as props (triggers re-render once)
  const [nodes, setNodes] = useState(null);

  const init = useCallback(() => {
    if (ready) return;
    const ctx = getCtx();

    // Master output
    const masterGain = ctx.createGain(); masterGain.gain.value = masterVol; masterGain.connect(ctx.destination); masterGainRef.current = masterGain;

    // Cue bus: separate gain into destination (same speakers — in real setups this would be a separate output device)
    const cueBus = ctx.createGain(); cueBus.gain.value = cueVol; cueBus.connect(ctx.destination); cueGainRef.current = cueBus;

    // Crossfade nodes feeding master
    const ga = ctx.createGain(); ga.gain.value = 1 - crossfade; ga.connect(masterGain); gainARef.current = ga;
    const gb = ctx.createGain(); gb.gain.value = crossfade;     gb.connect(masterGain); gainBRef.current = gb;

    // Cue feed nodes feeding cue bus (always connected, gated by gain inside Deck)
    const caf = ctx.createGain(); caf.gain.value = 1; caf.connect(cueBus); cueAFeedRef.current = caf;
    const cbf = ctx.createGain(); cbf.gain.value = 1; cbf.connect(cueBus); cueBFeedRef.current = cbf;

    setNodes({ ga, gb, caf, cbf });
    setReady(true);
  }, [ready]); // eslint-disable-line

  // Crossfade → master nodes
  // When a deck is cued, mute it from master (true split cue behavior)
  useEffect(() => {
    if (!gainARef.current) return;
    gainARef.current.gain.value = cueA ? 0 : (1 - crossfade);
  }, [crossfade, cueA]);
  useEffect(() => {
    if (!gainBRef.current) return;
    gainBRef.current.gain.value = cueB ? 0 : crossfade;
  }, [crossfade, cueB]);

  // Master vol
  useEffect(() => { if (masterGainRef.current) masterGainRef.current.gain.value = masterVol; }, [masterVol]);

  // Cue bus vol
  useEffect(() => { if (cueGainRef.current) cueGainRef.current.gain.value = cueVol; }, [cueVol]);

  const cueStatus = cueA || cueB;

  return (
    <div onClick={init} style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'SF Mono','Fira Code',monospace", padding: 14, boxSizing: "border-box" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: `linear-gradient(135deg, ${C.blue}, ${C.amber})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎛️</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.5 }}>DJ MIXER</div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 3, textTransform: "uppercase" }}>Pro Studio</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!ready && (
            <div style={{ fontSize: 10, color: C.amber, background: `${C.amber}11`, border: `1px solid ${C.amber}33`, borderRadius: 4, padding: "4px 10px", textTransform: "uppercase", letterSpacing: 1 }}>▶ Click to activate</div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Master</span>
            <Knob value={masterVol} onChange={setMasterVol} min={0} max={1} color={C.green} size={42} />
            <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>{Math.round(masterVol * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Decks */}
      {ready && nodes ? (
        <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
          <Deck side="A" color={C.blue}  gainNode={nodes.ga} cueGainNode={nodes.caf} cueActive={cueA} onToggleCue={() => setCueA(v => !v)} />
          <Deck side="B" color={C.amber} gainNode={nodes.gb} cueGainNode={nodes.cbf} cueActive={cueB} onToggleCue={() => setCueB(v => !v)} />
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 380, borderRadius: 12, border: `1px dashed ${C.border}`, flexDirection: "column", gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 44 }}>🎧</div>
          <div style={{ color: C.muted, fontSize: 14 }}>Click anywhere to start the DJ Mixer</div>
          <div style={{ color: C.muted, fontSize: 11, opacity: 0.6 }}>Browser audio requires a user click to activate</div>
        </div>
      )}

      {/* Crossfader + Cue Monitor */}
      <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 20 }}>
        {/* Crossfader */}
        <div style={{ flex: 1 }}>
          <Crossfader value={crossfade} onChange={setCrossfade} />
        </div>

        {/* Quick buttons */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {[["◀ A", 0, C.blue], ["Ctr", 0.5, C.muted], ["B ▶", 1, C.amber]].map(([lbl, val, col]) => (
            <button key={lbl} onClick={() => setCrossfade(val)} style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${col}44`, background: `${col}11`, color: col, cursor: "pointer", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{lbl}</button>
          ))}
        </div>

        {/* Cue monitor section */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, paddingLeft: 16, borderLeft: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            {/* Cue bus indicator */}
            <div style={{ fontSize: 11, fontWeight: 700, color: cueStatus ? C.cue : C.muted, textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 14 }}>🎧</span>
              <span>Cue</span>
              {cueStatus && (
                <span style={{ fontSize: 9, background: `${C.cue}22`, border: `1px solid ${C.cue}44`, color: C.cue, borderRadius: 4, padding: "1px 5px" }}>
                  {[cueA && "A", cueB && "B"].filter(Boolean).join("+")} LIVE
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Knob value={cueVol} onChange={setCueVol} min={0} max={1} label="Level" color={C.cue} size={44} />
              <span style={{ fontSize: 11, color: C.cue, fontWeight: 700, minWidth: 32 }}>{Math.round(cueVol * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Split Cue explanation */}
      <div style={{ marginTop: 8, textAlign: "center", fontSize: 9, color: C.muted, letterSpacing: 0.5, lineHeight: 1.6 }}>
        LOAD TRACKS → PRESS PLAY → MIX WITH CROSSFADER &nbsp;·&nbsp; HIT <span style={{ color: C.cue }}>CUE</span> ON A DECK TO MONITOR IT PRIVATELY WITHOUT SENDING IT TO MASTER
      </div>
    </div>
  );
}
