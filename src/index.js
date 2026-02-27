/**
 * AudioPilot Pro - Main Entry Point
 * Enterprise-grade Audio Streaming and Processing Engine
 * 
 * Compatible with ES Modules, CommonJS, and Browser <script> tags via jsDelivr.
 */

// 1. Import Core DSP Math
import Biquad from './dsp/biquad.js';

// 2. Import Client-Side WebAudio SDK
import { Logger } from './client/Logger.js';
import { AudioProcessor } from './client/AudioProcessor.js';
import { AudioVisualizer } from './client/AudioVisualizer.js';
import { ConnectionManager } from './client/ConnectionManager.js';
import { AudioX, AUDIO_STATE } from './client/AudioX.js';
import { AudioPilot } from './client/AudioPilot.js';

// 3. Import React Components (For bundler environments like Next.js/Vite)
import BandControls from './react/BandControls.tsx';
import P5Visualizer from './react/P5Visualizer.tsx';
import PresetManager from './react/PresetManager.tsx';

// ============================================================================
// EXPORTS FOR ES MODULES (import { AudioPilot } from 'https://cdn.jsdelivr.net/...')
// ============================================================================
export {
    // Core DSP
    Biquad,
    
    // Client SDK
    Logger,
    AudioProcessor,
    AudioVisualizer,
    ConnectionManager,
    AudioX,
    AUDIO_STATE,
    AudioPilot,
    
    // React GUI Components
    BandControls,
    P5Visualizer,
    PresetManager
};

// ============================================================================
// GLOBAL BINDING FOR BROWSER <script> TAGS (jsDelivr classic usage)
// ============================================================================
if (typeof window !== 'undefined') {
    // Prevent overwriting if already initialized
    window.AudioPilotPro = window.AudioPilotPro || {};

    // Attach all modules to the global namespace
    Object.assign(window.AudioPilotPro, {
        Biquad,
        Logger,
        AudioProcessor,
        AudioVisualizer,
        ConnectionManager,
        AudioX,
        AUDIO_STATE,
        AudioPilot
    });

    // Auto-initialize the main AudioPilot instance if requested via data attribute
    // Example: <script src="..." data-auto-init="true"></script>
    const currentScript = document.currentScript;
    if (currentScript && currentScript.getAttribute('data-auto-init') === 'true') {
        window.addEventListener('DOMContentLoaded', () => {
            if (!window.AudioPilotPro.instance) {
                window.AudioPilotPro.instance = new AudioPilot();
            }
        });
    }

    console.log('%c🎧 AudioPilot Pro SDK Loaded Successfully', 'color: #6366f1; font-weight: bold; font-size: 14px;');
}
