
import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  // Poll backend status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/status`);
        const data = await res.json();
        
        if (data.status !== status) {
          setStatus(data.status as ConnectionStatus);
          addLog(`System status changed to ${data.status}`);
        }
        setQrCode(data.qr);
      } catch (err) {
        setStatus(ConnectionStatus.DISCONNECTED);
      }
    };

    const interval = setInterval(checkStatus, 3000);
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
    addLog(`Sending to ${recipient}...`);

    try {
      const res = await fetch(`${BACKEND_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: recipient, message })
      });
      
      if (res.ok) {
        setHistory(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'sent' } : m));
        addLog(`Successfully sent to ${recipient}`, 'success');
        setMessage('');
      } else {
        throw new Error('Failed to send');
      }
    } catch (err) {
      addLog(`Failed to send to ${recipient}`, 'error');
    }
  };

  const handleEnhance = async () => {
    if (!message) return;
    setIsEnhancing(true);
    try {
      const enhanced = await enhanceMessage(message);
      setMessage(enhanced);
      addLog('Message enhanced by Gemini AI');
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 lg:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-white">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 whatsapp-gradient rounded-3xl flex items-center justify-center text-white text-3xl shadow-lg shadow-emerald-200">
              <i className="fab fa-whatsapp"></i>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-800">Baileys <span className="text-emerald-500 font-light">Pro</span></h1>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Multi-Device Sender</p>
            </div>
          </div>
          <StatusBadge status={status} />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: QR & Composer */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* QR Area */}
            {status !== ConnectionStatus.CONNECTED && (
              <div className="bg-white rounded-[2.5rem] p-12 shadow-2xl border border-white relative overflow-hidden group">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                  <div className="flex-1 space-y-6">
                    <h2 className="text-4xl font-black text-slate-800 tracking-tighter leading-none">
                      Link your <br/><span className="text-emerald-500">Device</span>
                    </h2>
                    <p className="text-slate-500 font-medium leading-relaxed">
                      Scan this QR code with your WhatsApp app to start sending messages directly from your browser.
                    </p>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                      <span className="px-3 py-1 bg-slate-100 rounded-full">MD-Engine</span>
                      <span className="px-3 py-1 bg-slate-100 rounded-full">Encrypted</span>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-[2rem] border-4 border-white shadow-inner">
                    {qrCode ? (
                      <img src={qrCode} alt="WhatsApp QR" className="w-64 h-64 rounded-xl" />
                    ) : (
                      <div className="w-64 h-64 flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Requesting QR...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Composer */}
            <div className={`bg-white rounded-[2.5rem] p-10 shadow-2xl border border-white transition-all duration-500 ${status !== ConnectionStatus.CONNECTED ? 'opacity-30 blur-[2px] pointer-events-none' : 'opacity-100'}`}>
               <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                 <i className="fas fa-paper-plane text-emerald-500"></i>
                 Compose Broadcast
               </h3>
               
               <form onSubmit={handleSendMessage} className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number</label>
                      <input 
                        className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 transition-all"
                        placeholder="e.g. 628123456789"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">AI Optimization</label>
                      <button 
                        type="button"
                        onClick={handleEnhance}
                        disabled={!message || isEnhancing}
                        className="w-full h-[60px] bg-emerald-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all disabled:opacity-50"
                      >
                        <i className={`fas ${isEnhancing ? 'fa-spinner fa-spin' : 'fa-magic'}`}></i>
                        Refine with Gemini
                      </button>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Message Content</label>
                    <textarea 
                      className="w-full bg-slate-50 border-none rounded-[2rem] p-8 text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none min-h-[180px]"
                      placeholder="Type your message here..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                 </div>

                 <button 
                  type="submit"
                  disabled={!recipient || !message}
                  className="w-full whatsapp-gradient py-6 rounded-[1.5rem] text-white font-black text-lg shadow-xl shadow-emerald-200 active:scale-[0.98] transition-all disabled:grayscale"
                 >
                   Send via Baileys Socket
                 </button>
               </form>
            </div>
          </div>

          {/* Right Column: Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Terminal Log */}
            <div className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Socket Console</span>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                </div>
              </div>
              <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2 font-mono text-[11px]">
                {logs.map(log => (
                  <div key={log.id} className="flex gap-3 leading-relaxed border-l-2 border-slate-800 pl-3">
                    <span className="text-slate-600 shrink-0">[{log.timestamp.toLocaleTimeString([], {hour12: false})}]</span>
                    <span className={log.type === 'error' ? 'text-rose-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent History */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-white flex flex-col h-[500px]">
               <h4 className="text-lg font-black text-slate-800 mb-6 flex justify-between items-center">
                 History
                 <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full text-slate-400 tracking-tighter uppercase">{history.length}</span>
               </h4>
               <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                 {history.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                     <i className="fas fa-inbox text-4xl mb-3"></i>
                     <p className="text-xs font-black uppercase tracking-widest">No Sent Data</p>
                   </div>
                 ) : (
                   history.map(item => (
                     <div key={item.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-lg transition-all">
                       <div className="flex justify-between items-start mb-2">
                         <span className="text-xs font-black text-slate-800">+{item.recipient}</span>
                         {item.status === 'sent' && <i className="fas fa-check-double text-blue-500 text-[10px]"></i>}
                       </div>
                       <p className="text-xs text-slate-500 line-clamp-2 italic">"{item.content}"</p>
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .whatsapp-gradient { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }
      `}</style>
    </div>
  );
};

export default App;
