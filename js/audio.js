// ==================== SOUND SYSTEM ====================
export const AudioSystem = {
    ctx: null,
    enabled: true,
    initialized: false,
    
    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch(e) {
            console.warn('Web Audio not supported');
        }
    },
    
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        if (!this.initialized) this.init();
    },
    
    play(type) {
        if (!this.enabled || !this.ctx) return;
        
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            // Почистване след приключване
            osc.onended = () => {
                try { osc.disconnect(); } catch(e) {}
                try { gain.disconnect(); } catch(e) {}
            };
            
            switch(type) {
                case 'purchase':
                    osc.frequency.value = 880;
                    gain.gain.value = 0.15;
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.15);
                    setTimeout(() => {
                        const osc2 = this.ctx.createOscillator();
                        const gain2 = this.ctx.createGain();
                        osc2.connect(gain2);
                        gain2.connect(this.ctx.destination);
                        osc2.onended = () => { try { osc2.disconnect(); } catch(e) {} try { gain2.disconnect(); } catch(e) {} };
                        osc2.frequency.value = 1100;
                        gain2.gain.value = 0.1;
                        osc2.start();
                        osc2.stop(this.ctx.currentTime + 0.1);
                    }, 100);
                    break;
                    
                case 'flight_start':
                    osc.frequency.value = 440;
                    gain.gain.value = 0.1;
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.3);
                    setTimeout(() => {
                        const osc2 = this.ctx.createOscillator();
                        const gain2 = this.ctx.createGain();
                        osc2.connect(gain2);
                        gain2.connect(this.ctx.destination);
                        osc2.onended = () => { try { osc2.disconnect(); } catch(e) {} try { gain2.disconnect(); } catch(e) {} };
                        osc2.frequency.setValueAtTime(440, this.ctx.currentTime);
                        osc2.frequency.linearRampToValueAtTime(660, this.ctx.currentTime + 0.2);
                        gain2.gain.value = 0.08;
                        osc2.start();
                        osc2.stop(this.ctx.currentTime + 0.2);
                    }, 150);
                    break;
                    
                case 'flight_complete':
                    osc.frequency.value = 660;
                    gain.gain.value = 0.12;
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.2);
                    setTimeout(() => {
                        const osc2 = this.ctx.createOscillator();
                        const gain2 = this.ctx.createGain();
                        osc2.connect(gain2);
                        gain2.connect(this.ctx.destination);
                        osc2.onended = () => { try { osc2.disconnect(); } catch(e) {} try { gain2.disconnect(); } catch(e) {} };
                        osc2.frequency.value = 880;
                        gain2.gain.value = 0.12;
                        osc2.start();
                        osc2.stop(this.ctx.currentTime + 0.2);
                    }, 150);
                    setTimeout(() => {
                        const osc3 = this.ctx.createOscillator();
                        const gain3 = this.ctx.createGain();
                        osc3.connect(gain3);
                        gain3.connect(this.ctx.destination);
                        osc3.onended = () => { try { osc3.disconnect(); } catch(e) {} try { gain3.disconnect(); } catch(e) {} };
                        osc3.frequency.value = 1100;
                        gain3.gain.value = 0.1;
                        osc3.start();
                        osc3.stop(this.ctx.currentTime + 0.2);
                    }, 300);
                    break;
                    
                case 'achievement':
                    for(let i = 0; i < 4; i++) {
                        setTimeout(() => {
                            const o = this.ctx.createOscillator();
                            const g = this.ctx.createGain();
                            o.connect(g);
                            g.connect(this.ctx.destination);
                            o.onended = () => { try { o.disconnect(); } catch(e) {} try { g.disconnect(); } catch(e) {} };
                            o.frequency.value = 500 + i * 100;
                            g.gain.value = 0.1;
                            o.start();
                            o.stop(this.ctx.currentTime + 0.1);
                        }, i * 80);
                    }
                    break;
                    
                case 'money':
                    osc.frequency.value = 800;
                    gain.gain.value = 0.08;
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.08);
                    break;
                    
                case 'error':
                    osc.frequency.value = 300;
                    gain.gain.value = 0.15;
                    osc.type = 'sawtooth';
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.2);
                    break;
                    
                case 'click':
                    osc.frequency.value = 600;
                    gain.gain.value = 0.05;
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.05);
                    break;
                    
                default:
                    osc.frequency.value = 500;
                    gain.gain.value = 0.05;
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.05);
            }
        } catch(e) {
            // Silently fail if audio not available
        }
    },
    
    toggle() {
        this.enabled = !this.enabled;
        const status = this.enabled ? '🔊 Sound On' : '🔇 Sound Off';
        import('./ui.js').then(module => {
            module.showToast(status);
        });
        const toggle = document.getElementById('soundToggle');
        if (toggle) toggle.innerText = this.enabled ? '🔊' : '🔇';
        return this.enabled;
    }
};

// ==================== AUTO-RESUME ON USER INTERACTION ====================
document.addEventListener('click', () => {
    AudioSystem.resume();
}, { passive: true });

document.addEventListener('touchstart', () => {
    AudioSystem.resume();
}, { passive: true });