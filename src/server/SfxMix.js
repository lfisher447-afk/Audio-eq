import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';

export class SfxMix {
    constructor(config = {}) {
        this.actions =[];
        this.currentFile = null;
        this.tempCounter = 0;
        this.bitrate = config.bitrate !== undefined ? config.bitrate : 64000;
        try {
            const tmpBase = config.tmpDir || os.tmpdir();
            this.TMP_DIR = fs.mkdtempSync(path.join(tmpBase, 'sfxmix-'));
        } catch (err) { throw new Error('Unable to create temporary directory'); }
        this.cleanupHandler = () => this.cleanup();
        process.on('exit', this.cleanupHandler);
        process.on('SIGINT', () => { this.cleanup(); process.exit(); });
        process.on('SIGTERM', () => { this.cleanup(); process.exit(); });
    }
    
    getTempFile(prefix) { return path.join(this.TMP_DIR, `${prefix}_${++this.tempCounter}.mp3`); }
    cleanup() { try { if (this.TMP_DIR && fs.existsSync(this.TMP_DIR)) fs.rmSync(this.TMP_DIR, { recursive: true, force: true }); } catch (err) {} }
    add(input) { this.actions.push({ type: 'add', input }); return this; }
    mix(input, options = {}) { this.actions.push(this.actions.length === 0 ? { type: 'add', input } : { type: 'mix', input, options }); return this; }
    silence(milliseconds) { this.actions.push({ type: 'silence', duration: milliseconds }); return this; }
    filter(filterName, options = {}) { this.actions.push({ type: 'filter', filterName, options }); return this; }
    trim(options = {}) { this.actions.push({ type: 'trim', options }); return this; }
    normalize(tp = -1.5) { return this.filter('normalize', { tp }); }

    convertAudio(inputFile, outputFile, outputOptions = {}) {
        return new Promise((resolve, reject) => {
            const command = ffmpeg().input(inputFile);
            if (Object.keys(outputOptions).length > 0) {
                const arr = []; for (const[k, v] of Object.entries(outputOptions)) arr.push(`-${k}`, v);
                command.outputOptions(arr);
            } else {
                const ext = path.extname(outputFile).toLowerCase();
                switch (ext) {
                    case '.ogg': command.audioCodec('libopus').format('ogg'); break;
                    case '.wav': command.audioCodec('pcm_s16le').format('wav'); break;
                    case '.flac': command.audioCodec('flac').format('flac'); break;
                    case '.aac': case '.m4a': command.audioCodec('aac').format('mp4'); break;
                    default: command.audioCodec('libmp3lame').format('mp3'); break;
                }
            }
            command.output(outputFile).on('end', resolve).on('error', reject).run();
        });
    }

    async _processActions() {
        for (let action of this.actions) {
            if (action.type === 'add') {
                if (!this.currentFile) this.currentFile = path.resolve(process.cwd(), action.input);
                else {
                    const tmp = this.getTempFile('concat');
                    await this.concatenateAudioFiles([this.currentFile, action.input], tmp);
                    if (this.isTempFile(this.currentFile)) this.safeDeleteFile(this.currentFile);
                    this.currentFile = tmp;
                }
            } else if (action.type === 'mix') {
                const tmp = this.getTempFile('mix');
                await this.mixAudioFiles(this.currentFile, action.input, tmp, action.options);
                if (this.isTempFile(this.currentFile)) this.safeDeleteFile(this.currentFile);
                this.currentFile = tmp;
            } else if (action.type === 'silence') {
                const tmp = this.getTempFile('silence');
                await this.generateSilence(action.duration, tmp, null);
                if (!this.currentFile) this.currentFile = tmp; else {
                    const ccatParams = this.getTempFile('concat');
                    await this.concatenateAudioFiles([this.currentFile, tmp], ccatParams);
                    this.safeDeleteFile(tmp); this.currentFile = ccatParams;
                }
            } else if (action.type === 'filter') {
                const tmp = this.getTempFile('filter');
                await this.applyFilter(this.currentFile, action.filterName, action.options, tmp);
                if (this.isTempFile(this.currentFile)) this.safeDeleteFile(this.currentFile);
                this.currentFile = tmp;
            } else if (action.type === 'trim') {
                const tmp = this.getTempFile('trim');
                await this.applyTrim(this.currentFile, action.options, tmp);
                if (this.isTempFile(this.currentFile)) this.safeDeleteFile(this.currentFile);
                this.currentFile = tmp;
            }
        }
    }

    save(output, outputOptions = {}) {
        return new Promise(async (resolve, reject) => {
            try {
                await this._processActions();
                const absoluteOutput = path.resolve(process.cwd(), output);
                const outputDir = path.dirname(absoluteOutput);
                if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
                const needsConversion = Object.keys(outputOptions).length > 0 || /\.(ogg|wav|flac|aac|m4a)$/i.test(output);
                if (needsConversion) await this.convertAudio(this.currentFile, absoluteOutput, outputOptions);
                else {
                    if (this.isTempFile(this.currentFile)) {
                        try { fs.renameSync(this.currentFile, absoluteOutput); } catch { fs.copyFileSync(this.currentFile, absoluteOutput); }
                    } else fs.copyFileSync(this.currentFile, absoluteOutput);
                }
                this.reset(); resolve(absoluteOutput);
            } catch (err) { reject(err); }
        });
    }

    reset() { this.actions =[]; this.currentFile = null; return this; }
    isTempFile(filename) { return filename.startsWith(this.TMP_DIR); }
    safeDeleteFile(filePath) { if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {} }

    concatenateAudioFiles(files, output) {
        return new Promise((resolve, reject) => {
            const listFile = path.join(this.TMP_DIR, `concat_${++this.tempCounter}.txt`);
            fs.writeFileSync(listFile, files.map(file => `file '${path.resolve(process.cwd(), file)}'`).join('\n'), 'utf8');
            ffmpeg().input(listFile).inputOptions(['-f', 'concat', '-safe', '0']).outputOptions(['-c', 'copy']).output(output)
                .on('end', () => { this.safeDeleteFile(listFile); resolve(); })
                .on('error', err => { this.safeDeleteFile(listFile); reject(err); }).run();
        });
    }

    mixAudioFiles(in1, in2, out, opts) {
        return new Promise((resolve, reject) => {
            ffmpeg().input(in1).input(in2).complexFilter([{ filter: 'amix', options: { inputs: 2, duration: opts.duration || 'longest' } }])
                .audioCodec('libmp3lame').format('mp3').output(out).on('end', resolve).on('error', reject).run();
        });
    }

    getFilterChain(name, opts) {
        switch (name) {
            case 'normalize': return `loudnorm=I=${opts.i ?? -18}:LRA=${opts.lra ?? 11}:TP=${opts.tp ?? -3}`;
            case 'telephone': return `highpass=f=${opts.lowFreq || 300}, lowpass=f=${opts.highFreq || 2800}`;
            case 'echo': return `aecho=${opts.inGain ?? 0.8}:${opts.outGain ?? 0.9}:${(opts.delays ?? [1]).join('|')}:${(opts.decays ?? [0.5]).join('|')}`;
            case 'highpass': return `highpass=f=${opts.frequency}`;
            case 'lowpass': return `lowpass=f=${opts.frequency}`;
            case 'pitch': return `asetrate=44100*${Math.pow(2, (opts.pitch ?? 0) / 12)},aresample=44100`;
            default: return '';
        }
    }

    applyFilter(inFile, name, opts, outFile) {
        return new Promise((resolve, reject) => {
            ffmpeg().input(inFile).audioFilters(this.getFilterChain(name, opts)).audioCodec('libmp3lame').audioBitrate('128k').format('mp3')
                .output(outFile).on('end', resolve).on('error', reject).run();
        });
    }

    applyTrim(inFile, opts, outFile) {
        return new Promise((resolve, reject) => {
            const startStr = `silenceremove=start_periods=1:start_duration=${opts.startDuration ?? 0}:start_threshold=${opts.startThreshold ?? -30}dB:detection=peak`;
            const endStr = `silenceremove=start_periods=1:start_duration=${opts.stopDuration ?? 0.05}:start_threshold=${opts.stopThreshold ?? -30}dB:detection=peak`;
            ffmpeg().input(inFile).audioFilters([startStr, 'areverse', endStr, 'areverse', 'aresample=async=1']).audioCodec('libmp3lame').audioBitrate('128k').format('mp3')
                .output(outFile).on('end', resolve).on('error', reject).run();
        });
    }

    generateSilence(ms, out, info) {
        return new Promise((resolve, reject) => {
            let totalBytes = Math.floor((ms / 1000) * 44100 * 2 * 2);
            const silenceStream = new Readable({
                read(size) {
                    const chunk = Math.min(size, totalBytes);
                    if (chunk <= 0) { this.push(null); return; }
                    this.push(Buffer.alloc(chunk, 0)); totalBytes -= chunk;
                }
            });
            ffmpeg().input(silenceStream).inputFormat('s16le').audioChannels(2).audioFrequency(44100).audioCodec('libmp3lame').format('mp3')
                .output(out).on('end', resolve).on('error', reject).run();
        });
    }
}
