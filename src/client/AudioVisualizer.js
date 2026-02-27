export class AudioVisualizer {
    constructor(canvasElement, leftMeterElement, rightMeterElement) {
        this.canvas = canvasElement;
        if(this.canvas) this.ctx = canvasElement.getContext('2d');
        this.leftMeter = leftMeterElement;
        this.rightMeter = rightMeterElement;
        this.animationId = null;
        if(this.canvas) this.setupCanvas();
        this.startVisualization();
    }
    
    setupCanvas() {
        const resizeCanvas = () => { this.canvas.width = this.canvas.offsetWidth; this.canvas.height = this.canvas.offsetHeight; };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }
    
    startVisualization() {
        const drawVisualization = () => {
            if(!this.canvas) return;
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            const audioProcessor = window.audioProcessorInstance;
            if (audioProcessor && audioProcessor.analyser && audioProcessor.dataArray) {
                audioProcessor.analyser.getByteFrequencyData(audioProcessor.dataArray);
                this.drawFrequencyBars(audioProcessor.dataArray);
                this.updateVUMeters(audioProcessor.dataArray);
            }
            this.animationId = requestAnimationFrame(drawVisualization);
        };
        drawVisualization();
    }
    
    drawFrequencyBars(dataArray) {
        const barWidth = this.canvas.width / dataArray.length; let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const barHeight = (dataArray[i] / 255) * this.canvas.height;
            const gradient = this.ctx.createLinearGradient(0, this.canvas.height, 0, this.canvas.height - barHeight);
            gradient.addColorStop(0, '#00ff41'); gradient.addColorStop(0.5, '#ffff00'); gradient.addColorStop(1, '#ff6b35');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x, this.canvas.height - barHeight, barWidth, barHeight);
            x += barWidth;
        }
    }
    
    updateVUMeters(dataArray) {
        if (!dataArray || dataArray.length === 0 || !this.leftMeter || !this.rightMeter) return;
        const leftLevel = this.calculateChannelLevel(0, dataArray.length / 2, dataArray);
        const rightLevel = this.calculateChannelLevel(dataArray.length / 2, dataArray.length, dataArray);
        
        const buildGradient = level => `linear-gradient(to top, 
            rgba(0,0,0,0.8) ${100-level}%, #00ff41 ${100-level}%, 
            #ffff00 ${Math.max(0, 100-level-20)}%, #ff6b35 ${Math.max(0, 100-level-40)}%, #ff0000 ${Math.max(0, 100-level-60)}%)`;
            
        this.leftMeter.style.background = buildGradient(leftLevel);
        this.rightMeter.style.background = buildGradient(rightLevel);
    }
    
    calculateChannelLevel(start, end, dataArray) {
        let sum = 0;
        for (let i = start; i < end; i++) sum += dataArray[i];
        return (sum / (end - start)) / 255 * 100;
    }
    
    destroy() { if (this.animationId) cancelAnimationFrame(this.animationId); }
}
