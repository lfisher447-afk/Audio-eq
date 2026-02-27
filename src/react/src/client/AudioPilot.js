import { Logger } from './Logger.js';
import { AudioProcessor } from './AudioProcessor.js';
import { AudioVisualizer } from './AudioVisualizer.js';
import { ConnectionManager } from './ConnectionManager.js';

export class AudioPilot {
    constructor() {
        this.logger = null;
        this.audioProcessor = null;
        this.visualizer = null;
        this.connectionManager = null;
        this.initialize();
    }
    
    initialize() {
        console.log('🎧 AudioPilot - Initializing Mission Control Systems...');
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initializeModules());
            } else this.initializeModules();
        }
    }
    
    initializeModules() {
        try {
            const debugOutput = document.getElementById('debugOutput');
            this.logger = new Logger(debugOutput);
            this.logger.log('🚀 AudioPilot Systems Initializing...');
            
            this.audioProcessor = new AudioProcessor();
            window.audioProcessorInstance = this.audioProcessor;
            this.logger.log('🔊 Audio Processing System Online');
            
            const waveformCanvas = document.getElementById('waveformCanvas');
            const leftMeter = document.getElementById('leftMeter');
            const rightMeter = document.getElementById('rightMeter');
            if(waveformCanvas) {
                this.visualizer = new AudioVisualizer(waveformCanvas, leftMeter, rightMeter);
                this.logger.log('📊 Audio Visualization System Online');
            }
            
            this.connectionManager = new ConnectionManager(this.audioProcessor, this.logger);
            this.logger.log('🛰️ Connection Management System Online');
            
            this.logger.log('✅ AudioPilot Ready for Mission');
            this.logger.log('🎯 Awaiting Mission Commands...');
        } catch (error) {
            console.error('❌ AudioPilot Initialization Failed:', error);
            if (this.logger) this.logger.error('System Initialization Failed: ' + error.message);
        }
    }
    
    destroy() {
        if (this.visualizer) this.visualizer.destroy();
        if (this.connectionManager && this.connectionManager.isConnected()) this.connectionManager.disconnectFromMissionControl();
        console.log('🎧 AudioPilot Systems Shutdown Complete');
    }
}
// Auto Initialization bound to Window object
if(typeof window !== 'undefined') {
    const audiopilot = new AudioPilot();
    window.addEventListener('beforeunload', () => audiopilot.destroy());
    window.AudioPilot = audiopilot;
}
