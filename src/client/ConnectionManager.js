export class ConnectionManager {
    constructor(audioProcessor, logger) {
        this.audioProcessor = audioProcessor;
        this.logger = logger;
        this.websocket = null;
        this.heartbeatInterval = null;
        this.isConnecting = false;
        this.manualDisconnect = false;
        this.detectedFormat = 'audio/webm';
        this.bufferSize = 5;
    }
    
    connectToMissionControl() {
        if (this.isConnecting) return Promise.reject('Already connecting');
        return new Promise((resolve, reject) => {
            this.isConnecting = true; this.manualDisconnect = false;
            this.logger.log('🔗 Establishing Link to Mission Control...');
            try {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                this.websocket = new WebSocket(protocol + '//' + window.location.host);
                this.websocket.onopen = () => {
                    this.isConnecting = false;
                    this.logger.log('✅ Link Established - AudioPilot Online');
                    this.audioProcessor.audioBuffer = []; this.audioProcessor.audioQueue =[];
                    this.audioProcessor.isPlaying = false; this.audioProcessor.consecutiveErrors = 0;
                    this.detectedFormat = 'audio/webm';
                    this.websocket.send(JSON.stringify({ type: 'role', role: 'receiver' }));
                    this.websocket.onmessage = e => this.handleMissionData(e);
                    this.websocket.onclose = () => this.handleLinkLoss();
                    this.websocket.onerror = () => this.handleLinkError();
                    this.startHeartbeat();
                    this.audioProcessor.initializeAudioContext();
                    if (this.onConnectionChange) this.onConnectionChange(true);
                    resolve();
                };
                this.websocket.onclose = () => this.handleLinkLoss();
                this.websocket.onerror = err => { this.isConnecting = false; reject(err); };
            } catch (error) { this.isConnecting = false; reject(error); }
        });
    }
    
    disconnectFromMissionControl() {
        this.logger.log('🔌 Terminating Mission Control Link...');
        this.manualDisconnect = true;
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.websocket) { this.websocket.close(); this.websocket = null; }
        if (this.onConnectionChange) this.onConnectionChange(false);
    }
    
    reconnectToMissionControl() {
        this.logger.log('🔄 Manual Reconnect Initiated'); 
        this.manualDisconnect = false; return this.connectToMissionControl();
    }
    
    handleMissionData(event) {
        if (typeof event.data === 'string') {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'raw-audio') {
                    this.detectedFormat = 'raw-audio';
                    if (this.onAudioStateChange) this.onAudioStateChange(true);
                    this.logger.log(`🎵 Audio Format: ${message.sampleRate}Hz, ${message.channels}ch`);
                }
            } catch (e) {}
        } else {
            this.audioProcessor.audioBuffer.push(event.data);
            if (this.onBufferUpdate) this.onBufferUpdate(this.audioProcessor.audioBuffer.length, this.bufferSize);
            if (this.audioProcessor.audioBuffer.length >= this.bufferSize && !this.audioProcessor.isPlaying) {
                this.playBufferedAudio();
            } else if (this.audioProcessor.isPlaying && this.audioProcessor.audioBuffer.length >= this.bufferSize) {
                this.queueNextBatch();
            }
        }
    }
    
    handleLinkLoss() {
        if (this.websocket === null) return;
        this.isConnecting = false; this.logger.log('❌ Mission Control Link Lost');
        if (this.onConnectionChange) this.onConnectionChange(false);
        if (this.onAudioStateChange) this.onAudioStateChange(false);
        this.audioProcessor.audioBuffer =[]; this.audioProcessor.audioQueue =[]; this.audioProcessor.isPlaying = false;
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (!this.manualDisconnect) {
            this.logger.log('🔄 Auto-Reconnect in 3 seconds...');
            setTimeout(() => { if (!this.isConnecting && !this.manualDisconnect) this.connectToMissionControl().catch(()=>{}); }, 3000);
        }
    }
    
    handleLinkError() { this.isConnecting = false; this.logger.log('❌ Mission Control Link Error'); }
    startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(() => {
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) this.websocket.send(JSON.stringify({ type: 'ping' }));
        }, 5000);
    }
    
    playBufferedAudio() {
        if (this.audioProcessor.isPlaying) return;
        try {
            this.audioProcessor.isPlaying = true;
            if (this.detectedFormat === 'raw-audio') {
                this.audioProcessor.playRawAudio(this.audioProcessor.audioBuffer, () => this.playNext());
            } else { this.logger.log('❌ Unsupported Audio Format'); this.audioProcessor.isPlaying = false; }
            this.audioProcessor.audioBuffer =[];
        } catch (error) { this.logger.log('❌ Audio Playback Error: ' + error.message); this.audioProcessor.isPlaying = false; }
    }
    
    playNext() {
        this.audioProcessor.isPlaying = false;
        if (this.audioProcessor.audioQueue.length > 0) {
            this.audioProcessor.audioBuffer = this.audioProcessor.audioQueue.shift();
            this.playBufferedAudio();
        }
    }
    
    queueNextBatch() {
        if (this.audioProcessor.audioBuffer.length >= this.bufferSize) {
            this.audioProcessor.audioQueue.push([...this.audioProcessor.audioBuffer]);
            this.audioProcessor.audioBuffer =[];
        }
    }
    isConnected() { return this.websocket && this.websocket.readyState === WebSocket.OPEN; }
    setBufferSize(size) { this.bufferSize = size; this.logger.log(`🔧 Buffer Size: ${size}`); }
}
