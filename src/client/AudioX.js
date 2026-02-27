export const AUDIO_STATE = {
    playbackState: "idle", duration: 0, bufferedDuration: 0, progress: 0, 
    volume: 50, playbackRate: 1, error: { code: null, message: "", readable: "" }, 
    currentTrack: {}, currentTrackPlayTime: 0, previousTrackPlayTime: 0
};

class ChangeNotifier {
    static listeners = {};
    static notifierState = {};

    static notify(e, t, i = "audiox_notifier_default") {
        let r = this.listeners[e];
        if (r && t !== null) {
            this.notifierState[e] = { ...(this.notifierState[e] || {}), ...t };
            r.forEach(a => a(this.notifierState[e]));
        }
    }

    static listen(e, t, i = {}) {
        if (this.listeners[e]) this.listeners[e].add(t);
        else { this.notifierState[e] = i; this.listeners[e] = new Set([t]); }
        return () => {
            let r = this.listeners[e];
            if (r) { r.delete(t); if (r.size === 0) delete this.listeners[e]; }
        };
    }
}

export class AudioX {
    constructor() {
        if (AudioX._instance) return AudioX._instance;
        this._audio = typeof Audio !== 'undefined' ? new Audio() : null;
        this._queue =[]; this._currentQueueIndex = 0;
        this.loopMode = "OFF";
        AudioX._instance = this;
    }
    async init(e = {}) {
        let { preloadStrategy: t = "auto", autoPlay: i = false, crossOrigin: F = null } = e;
        if (this._audio) { this._audio.setAttribute("id", "audio_x_instance"); this._audio.preload = t; this._audio.autoplay = i; this._audio.crossOrigin = F; }
    }
    async addMedia(e) {
        if (!e) return;
        if (this._audio) { this._audio.src = e.source; ChangeNotifier.notify("AUDIO_STATE", { playbackState: "trackchanged", currentTrack: e }); this._audio.load(); }
    }
    async play() { if (this._audio && this._audio.src) await this._audio.play().catch(() => {}); }
    async addMediaAndPlay(e) { if (e) await this.addMedia(e); setTimeout(() => this.play(), 950); }
    pause() { if (this._audio) this._audio.pause(); }
    stop() { if (this._audio) { this._audio.pause(); this._audio.currentTime = 0; } }
    setVolume(e) { if (this._audio) { this._audio.volume = e / 100; ChangeNotifier.notify("AUDIO_STATE", { volume: e }); } }
    setPlaybackRate(e) { if (this._audio) { this._audio.playbackRate = e; ChangeNotifier.notify("AUDIO_STATE", { playbackRate: e }); } }
    seek(e) { if (this._audio) this._audio.currentTime = e; }
    mute() { if (this._audio) this._audio.muted = true; }
    addQueue(e, t = "DEFAULT") { this._queue = Array.isArray(e) ? e.slice() :[]; if (t === "REVERSE") this._queue.reverse(); }
    playNext() {
        let e = this._currentQueueIndex + 1;
        if (this._queue && this._queue.length > e) { this.addMediaAndPlay(this._queue[e]); this._currentQueueIndex = e; }
        else { this.stop(); ChangeNotifier.notify("AUDIO_STATE", { playbackState: "queueended" }); }
    }
    playPrevious() {
        let e = this._currentQueueIndex - 1;
        if (e >= 0) { this.addMediaAndPlay(this._queue[e]); this._currentQueueIndex = e; }
    }
    clearQueue() { this._queue =[]; this._currentQueueIndex = 0; }
    getQueue() { return this._queue; }
    subscribe(e, t, i = {}) { return ChangeNotifier.listen(e, t, i); }
    static getAudioInstance() { return AudioX._instance ? AudioX._instance._audio : null; }
}
