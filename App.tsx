
import React, { useState, useEffect, useCallback } from 'react';
import { ConnectionStatus, WhatsAppMessage, LogEntry } from './types';
import { enhanceMessage } from './services/geminiService';

const BACKEND_URL = 'http://localhost:3000';

const StatusBadge: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const configs = {
    [ConnectionStatus.DISCONNECTED]: { color: 'bg-gray-200 text-gray-700', icon: 'fa-unlink', label: 'Offline' },
    [ConnectionStatus.CONNECTING]: { color: 'bg-blue-100 text-blue-700 animate-pulse', icon: 'fa-spinner fa-spin', label: 'Syncing...' },
    [ConnectionStatus.QR_READY]: { color: 'bg-amber-100 text-amber-700', icon: 'fa-qrcode', label: 'Scan Required' },
    [ConnectionStatus.CONNECTED]: { color: 'bg-emerald-500 text-white', icon: 'fa-check-circle', label: 'Connected' },
    [ConnectionStatus.ERROR]: { color: 'bg-red-100 text-red-700', icon: 'fa-exclamation-triangle', label: 'Error' },
  };
  const config = configs[status] || configs[ConnectionStatus.DISCONNECTED];
  return (
    <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold shadow-sm transition-all ${config.color}`}>
      <i className={`fas ${config.icon}`}></i>
      {config.label}
    </div>
  );
};

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<WhatsAppMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      message,
      type,
      timestamp: new Date()
    }, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    let interval: number;
    
    const checkStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/status`);
        if (!res.ok) throw new Error('Backend unreachable');
        const data = await res.json();
        
        if (data.status !== status) {
          setStatus(data.status as ConnectionStatus);
          addLog(`System status: ${data.status}`, data.status === 'CONNECTED' ? 'success' : 'info');
        }
        setQrCode(data.qr);
      } catch (err) {
        if (status !== ConnectionStatus.DISCONNECTED) {
          setStatus(ConnectionStatus.DISCONNECTED);
          addLog('Lost connection to backend server', 'error');
        }
      }
    };

    checkStatus();
    interval = window.setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [status, addLog]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !message) return;

    const newMessage: WhatsAppMessage = {
      id: Date.now().toString(),
      recipient,
      content: message,
      timestamp: new Date(),
      status: 'pending'
    };

    setHistory(prev => [newMessage, ...prev]);
    addLog(`Attempting to send to ${recipient}...`);

    try {
      const res = await fetch(`${BACKEND_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: recipient, message })
      });
      
      if (res.ok) {
        setHistory(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'sent' } : m));
        addLog(`Message delivered to ${recipient}`, 'success');
        setMessage('');
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to send');
      }
    } catch (err: any) {
      setHistory(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'failed' } : m));
      addLog(`Error: ${err.message}`, 'error');
    }
  };

  const handleEnhance = async () => {
    if (!message) return;
    setIsEnhancing(true);
    try {
      const enhanced = await enhanceMessage(message);
      setMessage(enhanced);
      addLog('Draft refined by Gemini AI');
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-white/60">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 md:w-16 md:h-16 whatsapp-gradient rounded-[1.5rem] flex items-center justify-center text-white text-3xl shadow-lg shadow-emerald-200/50">
              <i className="fab fa-whatsapp"></i>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-800">Baileys <span className="text-emerald-500 font-light">Connect</span></h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise Multi-Device Node</p>
            </div>
          </div>
          <div className="mt-4 md:mt-0">
            <StatusBadge status={status} />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {status !== ConnectionStatus.CONNECTED && (
              <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-white relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                  <div className="flex-1 space-y-6 text-center md:text-left">
                    <h2 className="text-4xl font-black text-slate-800 tracking-tighter leading-none">
                      Link <span className="text-emerald-500">Device</span>
                    </h2>
                    <p className="text-slate-500 font-medium leading-relaxed max-w-md">
                      Sync your account by scanning the QR. This creates a secure, persistent session on your local server.
                    </p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3">
                      <span className="px-4 py-2 bg-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-400 tracking-widest border border-slate-200">v7.0 Stable</span>
                      <span className="px-4 py-2 bg-emerald-50 rounded-2xl text-[10px] font-black uppercase text-emerald-600 tracking-widest border border-emerald-100">Encrypted</span>
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-slate-100">
                    {qrCode ? (
                      <div className="relative">
                        <img src={qrCode} alt="WhatsApp QR" className="w-64 h-64 rounded-xl" />
                        <div className="absolute inset-0 border-4 border-emerald-500/10 rounded-xl pointer-events-none animate-pulse"></div>
                      </div>
                    ) : (
                      <div className="w-64 h-64 flex flex-col items-center justify-center gap-6 text-center">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full animate-ping absolute inset-0"></div>
                          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin relative"></div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 animate-pulse">Socket Initializing...</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-50 rounded-full blur-[100px] opacity-60"></div>
              </div>
            )}

            <div className={`bg-white rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-white transition-all duration-700 ${status !== ConnectionStatus.CONNECTED ? 'opacity-30 blur-sm pointer-events-none scale-[0.98]' : 'opacity-100 scale-100'}`}>
               <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                   <i className="fas fa-paper-plane text-sm"></i>
                 </div>
                 Direct Message
               </h3>
               
               <form onSubmit={handleSendMessage} className="space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Destination Number</label>
                      <div className="relative group">
                        <i className="fas fa-hashtag absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors"></i>
                        <input 
                          className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] py-5 pl-14 pr-6 text-sm font-bold focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none"
                          placeholder="e.g. 628123456789"
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">AI Smart Refine</label>
                      <button 
                        type="button"
                        onClick={handleEnhance}
                        disabled={!message || isEnhancing}
                        className="w-full h-[64px] bg-slate-900 text-white rounded-[1.5rem] font-bold flex items-center justify-center gap-3 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <i className={`fas ${isEnhancing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-emerald-400`}></i>
                        Refine via Gemini
                      </button>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Message Body</label>
                    <textarea 
                      className="w-full bg-slate-50 border-2 border-transparent rounded-[2rem] p-8 text-sm font-medium focus:bg-white focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none resize-none min-h-[220px]"
                      placeholder="Enter the message text here..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                 </div>

                 <button 
                  type="submit"
                  disabled={!recipient || !message}
                  className="w-full whatsapp-gradient py-6 rounded-[2rem] text-white font-black text-lg shadow-2xl shadow-emerald-200/50 hover:shadow-emerald-300/60 active:scale-[0.98] transition-all disabled:grayscale disabled:opacity-40"
                 >
                   Broadcast via WhatsApp
                 </button>
               </form>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-950 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-slate-800">
              <div className="flex items-center justify-between mb-6 border-b border-slate-900 pb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">Live Engine Console</span>
                <div className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-pulse"></div>
                </div>
              </div>
              <div className="space-y-4 max-h-[250px] overflow-y-auto custom-scrollbar pr-2 font-mono text-[11px]">
                {logs.length === 0 ? (
                  <div className="py-12 text-center opacity-10">
                    <i className="fas fa-terminal text-3xl mb-3"></i>
                    <p className="font-black uppercase tracking-widest text-[8px]">Waiting for events...</p>
                  </div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="flex gap-3 leading-relaxed border-l border-slate-800 pl-4 group transition-colors hover:border-slate-700">
                      <span className="text-slate-700 shrink-0 select-none">[{log.timestamp.toLocaleTimeString([], {hour12: false})}]</span>
                      <span className={log.type === 'error' ? 'text-rose-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-400'}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-white flex flex-col max-h-[600px]">
               <h4 className="text-lg font-black text-slate-800 mb-8 flex justify-between items-center px-2">
                 Session Log
                 <span className="text-[10px] bg-slate-100 px-4 py-1.5 rounded-full text-slate-400 tracking-tighter font-black uppercase">{history.length} Entries</span>
               </h4>
               <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                 {history.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-12">
                     <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                       <i className="fas fa-ghost text-2xl"></i>
                     </div>
                     <p className="text-[10px] font-black uppercase tracking-[0.2em]">No Activity Found</p>
                   </div>
                 ) : (
                   history.map(item => (
                     <div key={item.id} className="p-6 bg-slate-50/50 rounded-[1.5rem] border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/40">
                       <div className="flex justify-between items-start mb-3">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-[10px] font-black">
                              WA
                            </div>
                            <span className="text-xs font-black text-slate-800">+{item.recipient}</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <span className="text-[9px] font-bold text-slate-400">{item.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           {item.status === 'sent' && <i className="fas fa-check-double text-blue-500 text-[9px]"></i>}
                           {item.status === 'failed' && <i className="fas fa-times-circle text-rose-500 text-[9px]"></i>}
                         </div>
                       </div>
                       <p className="text-xs text-slate-500 line-clamp-2 font-medium bg-white/50 p-3 rounded-xl border border-slate-100/50 italic">
                         "{item.content}"
                       </p>
                     </div>
                   ))
                 )}
               </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .whatsapp-gradient { background: linear-gradient(135deg, #22c55e 0%, #10b981 100%); }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
    </div>
  );
};

export default App;
