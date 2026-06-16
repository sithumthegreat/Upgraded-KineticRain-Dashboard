import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Icons ──────────────────────────────────────────────
const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IconWifi     = () => <Icon d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />;
const IconWifiOff  = () => <Icon d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />;
const IconPlay     = () => <Icon d="M5 3l14 9-14 9V3z" />;
const IconStop     = () => <Icon d="M18 6H6v12h12z" />;
const IconHome     = () => <Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />;
const IconZap      = () => <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />;
const IconWaves    = () => <Icon d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />;
const IconGrid     = () => <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />;
const IconWind     = () => <Icon d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />;
const IconActivity = () => <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" />;

// ── Constants ──────────────────────────────────────────
const NUM_SLAVES       = 10;
const MOTORS_PER_SLAVE = 5;

const PATTERNS = [
  { id: 1, label: 'Staircase Drop',    icon: <IconZap />,   grad: 'from-cyan-500 to-blue-600' },
  { id: 2, label: 'Wave Cascade',      icon: <IconWaves />, grad: 'from-violet-500 to-purple-600' },
  { id: 3, label: 'Alternating Pulse', icon: <IconGrid />,  grad: 'from-fuchsia-500 to-pink-600' },
  { id: 4, label: 'Breathing Motion',  icon: <IconWind />,  grad: 'from-amber-500 to-orange-600' },
];

const STATUS_MAP = {
  ALL_SLAVES_READY:    { text: 'ALL SYSTEMS READY',      color: 'text-cyan-400' },
  HOMING:              { text: 'HOMING IN PROGRESS',     color: 'text-yellow-400' },
  STOPPED:             { text: 'SYSTEM STOPPED',         color: 'text-red-400' },
  INITIALIZING:        { text: 'INITIALIZING',           color: 'text-slate-400' },
  PATTERN_1_RUNNING:   { text: 'RUNNING — STAIRCASE',    color: 'text-blue-400' },
  PATTERN_2_RUNNING:   { text: 'RUNNING — WAVE CASCADE', color: 'text-blue-400' },
  PATTERN_3_RUNNING:   { text: 'RUNNING — ALT PULSE',    color: 'text-blue-400' },
  PATTERN_4_RUNNING:   { text: 'RUNNING — BREATHING',    color: 'text-blue-400' },
};

const ts = () => new Date().toTimeString().slice(0, 8);

// ── Main Component ─────────────────────────────────────
export default function App() {
  const [status,         setStatus]         = useState('INITIALIZING');
  const [autoCycle,      setAutoCycle]      = useState(false);
  const [currentPattern, setCurrentPattern] = useState(0);
  const [connected,      setConnected]      = useState(false);
  const [espIP,          setEspIP]          = useState('10.88.143.190');
  const [ipInput,        setIpInput]        = useState('10.88.143.190');

  // ✅ Per-slave state now includes connected, homed, running
  const [slaves, setSlaves] = useState(
    Array.from({ length: NUM_SLAVES }, (_, i) => ({
      id: i + 1,
      connected: false,
      homed:     false,
      running:   false,
    }))
  );

  const [log, setLog] = useState([{ time: ts(), msg: 'System initialized.' }]);

  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);
  const logEndRef    = useRef(null);
  const logContainerRef = useRef(null);

  const addLog = useCallback((msg) => {
    setLog(prev => [...prev.slice(-199), { time: ts(), msg }]);
  }, []);

 useEffect(() => {
  const container = logContainerRef.current;
  if (!container) return;
  const isNearBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 80;
  if (isNearBottom) {
    container.scrollTop = container.scrollHeight;
  }
}, [log]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    clearTimeout(reconnectRef.current);

    const ws = new WebSocket(`ws://${espIP}/ws`);

    ws.onopen = () => {
      setConnected(true);
      wsRef.current = ws;
      ws.send('REQUEST_STATUS');
      addLog(`Connected to master at ${espIP}`);
    };

    ws.onmessage = ({ data: raw }) => {
      try {
        const d = JSON.parse(raw);
        setStatus(d.status || 'UNKNOWN');
        setAutoCycle(d.autoCycleRunning || false);
        setCurrentPattern(d.currentPattern || 0);

        if (Array.isArray(d.slaves)) {
          setSlaves(prev => prev.map(s => {
            const u = d.slaves.find(ds => ds.id === s.id);
            if (!u) return s;
            if (!s.connected && u.connected) addLog(`NODE ${String(s.id).padStart(2,'0')} ONLINE ✓`);
            if (!s.homed && u.homed)         addLog(`NODE ${String(s.id).padStart(2,'0')} HOMED ✓`);
            if (s.connected && !u.connected) addLog(`NODE ${String(s.id).padStart(2,'0')} OFFLINE`);
            return {
              ...s,
              connected: !!u.connected,
              homed:     !!u.homed,
              running:   !!u.running,
            };
          }));
        }

        if (d.status && d.status !== 'INITIALIZING')
          addLog(`Status → ${d.status}`);
      } catch {
        addLog('Error parsing JSON');
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      addLog('Disconnected. Retrying in 3s...');
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      addLog(`Connection failed: ws://${espIP}/ws`);
      ws.close();
    };

    wsRef.current = ws;
  }, [espIP, addLog]);

  useEffect(() => {
    connect();
    return () => { wsRef.current?.close(); clearTimeout(reconnectRef.current); };
  }, [connect]);

  const send = useCallback((cmd) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(cmd);
      addLog(`TX → ${cmd}`);
    } else {
      addLog('⚠ Not connected');
    }
  }, [addLog]);

  // Derived state
  const connectedCount = slaves.filter(s => s.connected).length;
  const homedCount     = slaves.filter(s => s.homed).length;
  const anyOnline      = connectedCount > 0;
  const anyRunning     = slaves.some(s => s.running);
  const canControl     = connected && anyOnline && !autoCycle && !anyRunning;
  const statusInfo     = STATUS_MAP[status] || { text: status.replace(/_/g,' '), color: 'text-slate-300' };

  // Node card border/background by state
  const nodeStyle = (s) => {
    if (!s.connected) return 'border-slate-800 bg-slate-900/40';
    if (s.running)    return 'border-yellow-600 bg-yellow-950/30';
    if (s.homed)      return 'border-cyan-700 bg-cyan-950/40';
    return 'border-slate-600 bg-slate-800/50'; // connected but not homed
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-mono">

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-widest text-cyan-400">⬡ KINETIC RAIN</h1>
            <p className="text-xs text-slate-500 tracking-wider">
              {NUM_SLAVES} NODES · {NUM_SLAVES * MOTORS_PER_SLAVE} MOTORS
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded border text-xs tracking-wider
            ${connected ? 'border-cyan-700 bg-cyan-950 text-cyan-400' : 'border-red-800 bg-red-950 text-red-400'}`}>
            {connected ? <IconWifi /> : <IconWifiOff />}
            {connected ? 'MASTER ONLINE' : 'OFFLINE'}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={ipInput}
              onChange={e => setIpInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setEspIP(ipInput)}
              className="w-36 px-2 py-1 text-xs bg-slate-800 border border-slate-700
                         rounded text-cyan-300 focus:outline-none focus:border-cyan-500"
              placeholder="Master IP"
            />
            <button
              onClick={() => { setEspIP(ipInput); wsRef.current?.close(); }}
              className="px-3 py-1 text-xs bg-cyan-800 hover:bg-cyan-700 text-white rounded"
            >
              CONNECT
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Status Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg px-6 py-4 flex flex-wrap items-center gap-4">
          <IconActivity />
          <div className="flex-1">
            <p className="text-xs text-slate-500 tracking-widest uppercase mb-1">System Status</p>
            <p className={`text-2xl font-bold tracking-wider ${statusInfo.color}`}>
              {statusInfo.text}
            </p>
          </div>
          {autoCycle && (
            <div className="text-xs text-purple-400 border border-purple-800 bg-purple-950 px-3 py-1 rounded tracking-wider">
              AUTO-CYCLE · PTN {currentPattern}/4
            </div>
          )}
          <div className="text-right text-xs text-slate-500 space-y-0.5">
            <div className="tracking-wider">{connectedCount}/{NUM_SLAVES} ONLINE</div>
            <div className="tracking-wider">{homedCount}/{NUM_SLAVES} HOMED</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* ── Slave Node Grid with individual HOME buttons ── */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-500 tracking-widest uppercase mb-4">
                Slave Nodes — Individual Control
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {slaves.map(s => (
                  <div key={s.id}
                    className={`rounded border p-3 text-center transition-all duration-300 ${nodeStyle(s)}`}
                  >
                    {/* Node ID */}
                    <div className={`text-xs font-bold tracking-widest mb-1
                      ${s.connected ? 'text-slate-200' : 'text-slate-600'}`}>
                      N{String(s.id).padStart(2, '0')}
                    </div>

                    {/* Connection indicator */}
                    <div className="text-base leading-none mb-1">
                      <span className={s.connected ? 'text-green-400' : 'text-slate-700'}>
                        {s.connected ? '●' : '○'}
                      </span>
                    </div>

                    {/* State label */}
                    <div className={`text-xs mb-2 tracking-wide ${
                      s.running    ? 'text-yellow-400' :
                      s.homed      ? 'text-cyan-500'   :
                      s.connected  ? 'text-slate-400'  :
                                     'text-slate-700'
                    }`}>
                      {s.running    ? '⟳ RUN'  :
                       s.homed      ? '✓ HMD'  :
                       s.connected  ? '— IDLE' :
                                      'OFF'}
                    </div>

                    {/* Individual HOME button */}
                    <button
                      onClick={() => send(`HOME_${s.id}`)}
                      disabled={!s.connected || s.running || anyRunning}
                      className={`w-full text-xs py-1 rounded transition-all tracking-wider ${
                        !s.connected || s.running || anyRunning
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                          : 'bg-indigo-900 hover:bg-indigo-800 text-indigo-300 border border-indigo-700'
                      }`}
                    >
                      <IconHome size={10} /> HOME
                    </button>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex gap-4 mt-4 text-xs text-slate-600 tracking-wider">
                <span><span className="text-green-400">●</span> ONLINE</span>
                <span><span className="text-cyan-500">✓ HMD</span> HOMED</span>
                <span><span className="text-yellow-400">⟳ RUN</span> RUNNING</span>
                <span><span className="text-slate-700">○</span> OFFLINE</span>
              </div>

              {!anyOnline && connected && (
                <p className="text-center text-yellow-500 text-xs mt-3 tracking-wider">
                  ⚠ NO NODES ONLINE — Power on slave boards
                </p>
              )}
            </section>

            {/* Pattern Buttons */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-500 tracking-widest uppercase mb-4">
                Pattern Select — runs on all online nodes
              </p>
              <div className="grid grid-cols-2 gap-3">
                {PATTERNS.map(p => (
                  <button key={p.id}
                    onClick={() => send(`PATTERN_${p.id}`)}
                    disabled={!canControl}
                    className={`flex items-center gap-3 px-4 py-4 rounded border
                      font-semibold text-sm tracking-wider transition-all
                      ${!canControl
                        ? 'border-slate-700 bg-slate-800 text-slate-600 cursor-not-allowed'
                        : `border-transparent bg-gradient-to-r ${p.grad}
                           text-white hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5`}`}
                  >
                    <span className="shrink-0">{p.icon}</span>
                    <div className="text-left">
                      <div>PTN {p.id}</div>
                      <div className="text-xs opacity-75 font-normal">{p.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Global Controls */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-500 tracking-widest uppercase mb-4">
                Global Controls
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => send('START_AUTO_CYCLE')}
                  disabled={!canControl}
                  className={`flex items-center justify-center gap-2 px-4 py-3
                    rounded border text-sm tracking-wider font-semibold transition-all
                    ${!canControl
                      ? 'border-slate-700 bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'border-emerald-700 bg-emerald-900/60 text-emerald-400 hover:bg-emerald-900'}`}
                >
                  <IconPlay /> AUTO-CYCLE
                </button>
                <button
                  onClick={() => send('STOP_ALL')}
                  disabled={!connected}
                  className={`flex items-center justify-center gap-2 px-4 py-3
                    rounded border text-sm tracking-wider font-semibold transition-all
                    ${!connected
                      ? 'border-slate-700 bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'border-red-700 bg-red-900/60 text-red-400 hover:bg-red-900'}`}
                >
                  <IconStop /> STOP ALL
                </button>
              </div>
            </section>
          </div>

          {/* Log Panel */}
          <div className="lg:col-span-1">
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500 tracking-widest uppercase">Live System Log</p>
                <button onClick={() => setLog([])}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                  CLEAR
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 max-h-[560px] pr-1">
                {log.map((entry, i) => (
                  <div key={i} className="flex gap-2 text-xs leading-relaxed">
                    <span className="text-slate-600 shrink-0">{entry.time}</span>
                    <span className={
                      entry.msg.startsWith('TX')         ? 'text-cyan-400'   :
                      entry.msg.startsWith('Status')     ? 'text-purple-400' :
                      entry.msg.startsWith('NODE') && entry.msg.includes('ONLINE')  ? 'text-green-400' :
                      entry.msg.startsWith('NODE') && entry.msg.includes('HOMED')   ? 'text-cyan-400'  :
                      entry.msg.startsWith('NODE') && entry.msg.includes('OFFLINE') ? 'text-red-400'   :
                      entry.msg.startsWith('⚠')          ? 'text-yellow-400' :
                      entry.msg.startsWith('Connect')    ? 'text-green-400'  :
                      entry.msg.startsWith('Disconn')    ? 'text-red-400'    :
                      entry.msg.startsWith('Connection') ? 'text-red-400'    :
                      'text-slate-400'
                    }>
                      {entry.msg}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </section>
          </div>
        </div>

        <footer className="text-center text-xs text-slate-700 tracking-widest pt-2 pb-4">
          KINETIC RAIN · MASTER + {NUM_SLAVES} SLAVES · {NUM_SLAVES * MOTORS_PER_SLAVE} MOTORS
        </footer>
      </main>
    </div>
  );
}