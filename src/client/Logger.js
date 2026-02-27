export class Logger {
    constructor(outputElement) {
        this.outputElement = outputElement;
        this.debugHistory =[];
        this.maxDebugLines = 20;
        this.historyEnabled = false;
        this.log('AudioPilot System Online - Awaiting Commands...');
    }
    
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        if (this.historyEnabled) {
            this.debugHistory.push(logEntry);
            if (this.debugHistory.length > this.maxDebugLines) this.debugHistory.shift();
            if(this.outputElement) this.outputElement.textContent = this.debugHistory.join('\n');
        } else {
            if(this.outputElement) this.outputElement.textContent = logEntry;
        }
        if(this.outputElement) this.outputElement.scrollTop = this.outputElement.scrollHeight;
        console.log(logEntry);
    }
    
    enableHistory() { this.historyEnabled = true; this.log('Debug history enabled - logs will accumulate'); }
    disableHistory() { this.historyEnabled = false; this.debugHistory =[]; this.log('Debug history disabled - showing current only'); }
    clear() { this.debugHistory =[]; if(this.outputElement) this.outputElement.textContent = 'AudioPilot System Online - Awaiting Commands...'; }
    error(message) { this.log('❌ ERROR: ' + message); console.error(message); }
    warn(message) { this.log('⚠️ WARNING: ' + message); console.warn(message); }
    info(message) { this.log('ℹ️ INFO: ' + message); console.info(message); }
    success(message) { this.log('✅ SUCCESS: ' + message); console.log(message); }
}
