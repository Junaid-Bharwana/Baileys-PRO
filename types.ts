
export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  QR_READY = 'QR_READY',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface WhatsAppMessage {
  id: string;
  recipient: string;
  content: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'failed';
}

export interface LogEntry {
  id: string;
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: Date;
}
