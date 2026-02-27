export class AudioProcessor {
    constructor() {
        this.sharedAudioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.eqSettings = { bass: 0, mid: 0, treble: 0 };
        this.pitchShift = 0;
        this.masterVolume = 0.5;
        this.audioFilterMode = true;
        this.activeEffects = { reverb: false, echo: false, distortion: false, chorus: false };
        this.isPlaying = false;
        this.audioBuffer = [];
        this.audioQueue =[];
        this.consecutiveErrors = 0;
    }
    
    initializeAudioContext() {
        try {
            if (!this.sharedAudioContext) {
                this.sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('🔊 Shared Audio Context Created');
            }
            if (!this.analyser) {
                this.analyser = this.sharedAudioContext.createAnalyser();
                this.analyser.fftSize = 256;
                this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
                console.log('🔊 Audio Analysis System Online');
            }
            if (this.sharedAudioContext.state === 'suspended') {
                this.sharedAudioContext.resume().then(() => console.log('🔊 Audio Context Resumed'));
            }
            return true;
        } catch (error) {
            console.error('❌ Audio Analysis Failed:', error.message);
            return false;
        }
    }

    softClip(sample) {
        if (sample > 0.95) return 0.95;
        if (sample < -0.95) return -0.95;
        if (Math.abs(sample) > 0.7) {
            const sign = sample > 0 ? 1 : -1;
            return sign * (0.7 + (Math.abs(sample) - 0.7) * 0.3);
        }
        return sample;
    }

    applySmoothingFilter(channelData) {
        const alpha = 0.1;
        for (let i = 1; i < channelData.length; i++) {
            channelData[i] = alpha * channelData[i] + (1 - alpha) * channelData[i - 1];
        }
    }

    applyPitchShift(audioBuffer, cents) {
        const pitchRatio = Math.pow(2, cents / 1200);
        const channels = audioBuffer.numberOfChannels;
        for (let channel = 0; channel < channels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            const newChannelData = new Float32Array(channelData.length);
            for (let i = 0; i < newChannelData.length; i++) {
                const sourceIndex = i * pitchRatio;
                const index1 = Math.floor(sourceIndex);
                const index2 = Math.min(index1 + 1, channelData.length - 1);
                const fraction = sourceIndex - index1;
                if (index1 < channelData.length) {
                    newChannelData[i] = channelData[index1] * (1 - fraction) + channelData[index2] * fraction;
                }
            }
            channelData.set(newChannelData);
        }
    }

    playRawAudio(rawChunks, onComplete) {
        try {
            if (!this.sharedAudioContext) this.initializeAudioContext();
            if (this.sharedAudioContext.state === 'suspended') this.sharedAudioContext.resume();
            
            Promise.all(rawChunks.map(chunk => 
                chunk instanceof ArrayBuffer ? Promise.resolve(chunk) : chunk.arrayBuffer()
            )).then(arrayBuffers => {
                let totalLength = arrayBuffers.reduce((acc, buffer) => acc + buffer.byteLength / 8, 0);
                const audioBuffer = this.sharedAudioContext.createBuffer(2, totalLength, 48000);
                const leftChannel = audioBuffer.getChannelData(0);
                const rightChannel = audioBuffer.getChannelData(1);
                
                let offset = 0;
                arrayBuffers.forEach(buffer => {
                    const audioData = new Float32Array(buffer);
                    for (let i = 0; i < audioData.length; i += 2) {
                        if (offset < totalLength) {
                            let leftSample = audioData[i];
                            let rightSample = audioData[i + 1];
                            const threshold = 0.001;
                            if (Math.abs(leftSample) < threshold) leftSample = 0;
                            if (Math.abs(rightSample) < threshold) rightSample = 0;
                            
                            leftChannel[offset] = this.softClip(leftSample);
                            rightChannel[offset] = this.softClip(rightSample);
                            offset++;
                        }
                    }
                });
                
                if (this.audioFilterMode) {
                    this.applySmoothingFilter(leftChannel);
                    this.applySmoothingFilter(rightChannel);
                    if (this.pitchShift !== 0) this.applyPitchShift(audioBuffer, this.pitchShift);
                    this.playWithFullProcessing(audioBuffer, onComplete);
                } else {
                    this.playRawOnly(audioBuffer, onComplete);
                }
            }).catch(error => {
                this.consecutiveErrors++;
                if (onComplete) onComplete();
            });
        } catch (error) {
            this.consecutiveErrors++;
            if (onComplete) onComplete();
        }
    }

    playWithFullProcessing(audioBuffer, onComplete) {
        const source = this.sharedAudioContext.createBufferSource();
        const gainNode = this.sharedAudioContext.createGain();
        source.buffer = audioBuffer;
        gainNode.gain.value = this.masterVolume;
        
        // Setup Biquads
        const bassFilter = this.sharedAudioContext.createBiquadFilter(); bassFilter.type = 'lowshelf'; bassFilter.frequency.value = 320; bassFilter.gain.value = this.eqSettings.bass;
        const midFilter = this.sharedAudioContext.createBiquadFilter(); midFilter.type = 'peaking'; midFilter.frequency.value = 1000; midFilter.Q.value = 1; midFilter.gain.value = this.eqSettings.mid;
        const trebleFilter = this.sharedAudioContext.createBiquadFilter(); trebleFilter.type = 'highshelf'; trebleFilter.frequency.value = 3200; trebleFilter.gain.value = this.eqSettings.treble;
        const hpFilter = this.sharedAudioContext.createBiquadFilter(); hpFilter.type = 'highpass'; hpFilter.frequency.value = 80; hpFilter.Q.value = 0.7;
        const lpFilter = this.sharedAudioContext.createBiquadFilter(); lpFilter.type = 'lowpass'; lpFilter.frequency.value = 15000; lpFilter.Q.value = 0.7;
        
        const compressor = this.sharedAudioContext.createDynamicsCompressor();
        compressor.threshold.value = -24; compressor.knee.value = 30; compressor.ratio.value = 12; compressor.attack.value = 0.003; compressor.release.value = 0.25;

        // Routing Chain
        let currentNode = source;
        [hpFilter, lpFilter, bassFilter, midFilter, trebleFilter, compressor].forEach(node => {
            currentNode.connect(node);
            currentNode = node;
        });
        
        currentNode = this.applyAudioEffects(currentNode);
        currentNode.connect(gainNode);

        if (this.analyser) {
            gainNode.connect(this.analyser);
            this.analyser.connect(this.sharedAudioContext.destination);
        } else {
            gainNode.connect(this.sharedAudioContext.destination);
        }
        
        source.start();
        source.onended = () => { this.consecutiveErrors = 0; if (onComplete) onComplete(); };
    }

    playRawOnly(audioBuffer, onComplete) {
        const source = this.sharedAudioContext.createBufferSource();
        const gainNode = this.sharedAudioContext.createGain();
        source.buffer = audioBuffer;
        gainNode.gain.value = this.masterVolume;
        source.connect(gainNode);
        if (this.analyser) { gainNode.connect(this.analyser); this.analyser.connect(this.sharedAudioContext.destination); }
        else gainNode.connect(this.sharedAudioContext.destination);
        source.start();
        source.onended = () => { this.consecutiveErrors = 0; if (onComplete) onComplete(); };
    }

    createReverbImpulse() {
        const length = this.sharedAudioContext.sampleRate * 2;
        const impulse = this.sharedAudioContext.createBuffer(2, length, this.sharedAudioContext.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
        return impulse;
    }

    createDistortionCurve(amount) {
        const samples = 44100; const curve = new Float32Array(samples); const deg = Math.PI / 180;
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }
        return curve;
    }

    applyAudioEffects(inputNode) {
        let currentNode = inputNode;
        if (this.activeEffects.reverb) {
            const convolver = this.sharedAudioContext.createConvolver();
            convolver.buffer = this.createReverbImpulse();
            const reverbGain = this.sharedAudioContext.createGain(); Object.assign(reverbGain.gain, {value: 0.3});
            const dryGain = this.sharedAudioContext.createGain(); Object.assign(dryGain.gain, {value: 0.7});
            const merger = this.sharedAudioContext.createChannelMerger(2);
            currentNode.connect(convolver); convolver.connect(reverbGain); reverbGain.connect(merger, 0, 0);
            currentNode.connect(dryGain); dryGain.connect(merger, 0, 1);
            currentNode = merger;
        }
        if (this.activeEffects.echo) {
            const delay = this.sharedAudioContext.createDelay(1.0); delay.delayTime.value = 0.3;
            const feedback = this.sharedAudioContext.createGain(); feedback.gain.value = 0.4;
            const echoGain = this.sharedAudioContext.createGain(); echoGain.gain.value = 0.3;
            currentNode.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(echoGain);
            const merger = this.sharedAudioContext.createChannelMerger(2);
            currentNode.connect(merger, 0, 0); echoGain.connect(merger, 0, 1);
            currentNode = merger;
        }
        if (this.activeEffects.distortion) {
            const waveshaper = this.sharedAudioContext.createWaveShaper();
            waveshaper.curve = this.createDistortionCurve(50); waveshaper.oversample = '4x';
            currentNode.connect(waveshaper); currentNode = waveshaper;
        }
        if (this.activeEffects.chorus) {
            const delay1 = this.sharedAudioContext.createDelay(0.1); delay1.delayTime.value = 0.02;
            const delay2 = this.sharedAudioContext.createDelay(0.1); delay2.delayTime.value = 0.03;
            const lfo1 = this.sharedAudioContext.createOscillator(); lfo1.frequency.value = 0.5;
            const lfo2 = this.sharedAudioContext.createOscillator(); lfo2.frequency.value = 0.7;
            const lfoGain1 = this.sharedAudioContext.createGain(); lfoGain1.gain.value = 0.005;
            const lfoGain2 = this.sharedAudioContext.createGain(); lfoGain2.gain.value = 0.007;
            lfo1.connect(lfoGain1); lfoGain1.connect(delay1.delayTime);
            lfo2.connect(lfoGain2); lfoGain2.connect(delay2.delayTime);
            const merger = this.sharedAudioContext.createChannelMerger(2);
            currentNode.connect(delay1); currentNode.connect(delay2);
            delay1.connect(merger, 0, 0); delay2.connect(merger, 0, 1);
            lfo1.start(); lfo2.start();
            currentNode = merger;
        }
        return currentNode;
    }

    playTestTone() {
        if (!this.sharedAudioContext) this.initializeAudioContext();
        if (this.sharedAudioContext.state === 'suspended') this.sharedAudioContext.resume();
        const oscillator = this.sharedAudioContext.createOscillator();
        const gainNode = this.sharedAudioContext.createGain();
        oscillator.connect(gainNode); gainNode.connect(this.sharedAudioContext.destination);
        oscillator.frequency.value = 440; gainNode.gain.value = this.masterVolume * 0.3;
        oscillator.start(); oscillator.stop(this.sharedAudioContext.currentTime + 0.5);
        return true;
    }
}
