/*
 * PORTED VERBATIM from the design handoff: `design/components/pond.js`.
 *
 * Ticket 05 is explicit — "copy `pond.js`, do not rewrite it". It is a
 * dependency-free Canvas 2D custom element: soft masses of colour drifting on
 * a slow clock, ten presets, six animated and two deliberately still. No
 * particle system, no shader, no library.
 *
 * Two rules it already obeys and must keep obeying, both with scars behind
 * them:
 *   - ONE requestAnimationFrame loop per element, guarded by `running`. An
 *     earlier version double-started and ran at double speed; the guard is
 *     why it is there.
 *   - `stop()` on disconnect.
 *
 * It also deliberately does NOT react to speech. That was tried; ripples on
 * speech read as noise.
 *
 * Not linted, not formatted, not "modernised". Changing it means changing the
 * design.
 */
/* eslint-disable */
// <oriso-pond> — the living backdrop.
//
// A real rendered surface, not a wallpaper: soft masses of colour drift very
// slowly, and some worlds carry blurred wavering bands whose thickness swells
// along the run — a river seen from above. Canvas 2D only, no shaders.
//
//   <oriso-pond palette="fluss"></oriso-pond>
//
// Honours prefers-reduced-motion by rendering one still frame.

const PALETTES = {
	teich: {
		label: 'Teich',
		base: '#fbf7f6',
		masses: ['#f6dcd8', '#eec8c6', '#f4e7dd', '#e8dcd8']
	},
	fluss: {
		label: 'Fluss von oben',
		base: '#fcf8f7',
		masses: ['#f7e2dd', '#f1d2cd'],
		lines: {
			count: 5,
			color: '#e6a79f',
			width: 62,
			amp: 0.075,
			wave: 0.72,
			speed: 0.05,
			blur: 20
		}
	},
	nebel: {
		label: 'Nebelbank',
		base: '#f8f8f7',
		masses: ['#e4e6e6', '#eceae7', '#dfe4e3'],
		lines: {
			count: 4,
			color: '#c9d2d2',
			width: 104,
			amp: 0.1,
			wave: 1.25,
			speed: 0.03,
			blur: 30
		}
	},
	glut: {
		label: 'Glut',
		base: '#fdf8f3',
		masses: ['#f8dcbc', '#f2c39a', '#eab19a', '#f7e6cf']
	},
	lichtung: {
		label: 'Lichtung',
		base: '#f9faf6',
		masses: ['#d8e7d6', '#e6eed6', '#f2e3d6', '#dce4dc'],
		lines: {
			count: 3,
			color: '#c3d8c6',
			width: 78,
			amp: 0.085,
			wave: 0.95,
			speed: 0.038,
			blur: 24
		}
	},
	// The proportions of "Fluss" turned inside out: the field carries the red,
	// the current runs light through it.
	strom: {
		label: 'Strom',
		base: '#b8231f',
		blend: 'multiply',
		masses: ['#a5000a', '#c4362c', '#96060f', '#cc4a36'],
		lines: {
			count: 5,
			color: '#ffe9e2',
			width: 70,
			amp: 0.08,
			wave: 0.78,
			speed: 0.048,
			blur: 22,
			blend: 'screen',
			alpha: 0.62
		}
	},
	// Almost black, with a red heart and pale light scattered through it. Kept
	// deliberately low-contrast — atmosphere, never a picture to look at.
	nacht: {
		label: 'Nachtrot',
		dark: true,
		base: '#1d1519',
		blend: 'screen',
		massAlpha: 0.34,
		masses: ['#3a151c', '#4a1a20', '#2a1219', '#3d1a24'],
		stars: {
			count: 30,
			color: '#e3b6bf',
			blur: 16,
			speed: 0.016,
			alpha: 0.4
		}
	},
	// A very slow tube of light coiling inward. No edges anywhere: the whole
	// spiral is drawn once and blurred until it is only a suggestion.
	spirale: {
		label: 'Spirale',
		dark: true,
		base: '#161217',
		blend: 'screen',
		massAlpha: 0.3,
		masses: ['#2f1f2c', '#241a26', '#3a2530'],
		spiral: {
			color: '#c79aa0',
			turns: 3.1,
			width: 52,
			blur: 38,
			speed: 0.021,
			alpha: 0.46
		}
	},
	// Bird's eye on a clearing at night: forest all around, a fire breathing in
	// the middle, a sliver of water down one side.
	lagerfeuer: {
		label: 'Lagerfeuer',
		dark: true,
		base: '#0e1310',
		blend: 'screen',
		massAlpha: 0.36,
		masses: ['#1a2a1f', '#132019', '#20301f', '#16241c'],
		fire: { color: '#e8a05a', core: '#f6d6a6', water: '#2c4a55', blur: 26 }
	},
	// Two quiet still frames — no motion at all, for rooms that need nothing.
	ruhe: {
		label: 'Ruhe',
		still: true,
		base: '#fcf9f9',
		blend: 'multiply',
		massAlpha: 0.6,
		masses: ['#f2e4e1', '#eadcda']
	},
	duene: {
		label: 'Düne',
		still: true,
		base: '#fbf6f2',
		blend: 'multiply',
		bands: [
			{ y: 0.42, color: '#f7e7dd', soft: 0.3 },
			{ y: 0.63, color: '#f0d3c7', soft: 0.22 },
			{ y: 0.82, color: '#e6b9ad', soft: 0.18 }
		]
	}
};

const REDUCED =
	typeof matchMedia === 'function' &&
	matchMedia('(prefers-reduced-motion: reduce)').matches;

class OrisoPond extends HTMLElement {
	static get observedAttributes() {
		return ['palette'];
	}

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this.shadowRoot.innerHTML =
			'<style>:host{display:block;overflow:hidden}canvas{display:block;width:100%;height:100%}</style><canvas></canvas>';
		this.canvas = this.shadowRoot.querySelector('canvas');
		this.ctx = this.canvas.getContext('2d');
		this.off = document.createElement('canvas');
		this.offCtx = this.off.getContext('2d');
		this.t = 0;
	}

	connectedCallback() {
		this.ro = new ResizeObserver(() => this.resize());
		this.ro.observe(this);
		this.resize();
		if (REDUCED || this.palette.still) this.frame();
		else this.loop();
	}

	disconnectedCallback() {
		this.ro && this.ro.disconnect();
		this.stop();
	}

	attributeChangedCallback(name, prev) {
		if (name !== 'palette' || !this.ctx) return;
		this.stop();
		this.frame();
		if (!REDUCED && !this.palette.still) this.loop();
	}

	get palette() {
		return PALETTES[this.getAttribute('palette')] || PALETTES.teich;
	}

	resize() {
		const r = this.getBoundingClientRect();
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		this.w = Math.max(1, Math.round(r.width));
		this.h = Math.max(1, Math.round(r.height));
		for (const [cv, cx] of [
			[this.canvas, this.ctx],
			[this.off, this.offCtx]
		]) {
			cv.width = Math.round(this.w * dpr);
			cv.height = Math.round(this.h * dpr);
			cx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}
		if (REDUCED || this.palette.still) this.frame();
	}

	stop() {
		this.running = false;
		cancelAnimationFrame(this.raf);
	}

	// Guarded so an attribute upgrade plus connectedCallback can't start two
	// concurrent rAF chains (which would double the clock).
	loop() {
		if (this.running) return;
		this.running = true;
		this.step();
	}

	step() {
		this.raf = requestAnimationFrame(() => this.step());
		// Clock is wall-time based (so it is identical on a 60Hz and a 120Hz
		// display) and runs at 2x, which is what the motion constants below and
		// the ripple durations are tuned against.
		const now = performance.now();
		const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
		this.last = now;
		this.t += dt * 2;
		if ((this.tick = (this.tick || 0) + 1) % 2) return; // ~30fps is plenty
		this.frame();
	}

	frame() {
		const { ctx, w, h } = this;
		if (!w) return;
		const p = this.palette,
			t = this.t,
			d = Math.hypot(w, h);

		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
		ctx.fillStyle = p.base;
		ctx.fillRect(0, 0, w, h);

		if (p.bands) {
			for (const b of p.bands) {
				const g = ctx.createLinearGradient(
					0,
					h * (b.y - b.soft),
					0,
					h * (b.y + b.soft)
				);
				g.addColorStop(0, p.base);
				g.addColorStop(0.5, b.color);
				g.addColorStop(1, p.base);
				ctx.globalCompositeOperation = 'multiply';
				ctx.globalAlpha = 0.9;
				ctx.fillStyle = g;
				ctx.fillRect(0, 0, w, h);
			}
			ctx.globalAlpha = 1;
			return;
		}

		// Slow drifting masses of colour — the "flowing" part.
		ctx.globalCompositeOperation = p.blend || 'multiply';
		(p.masses || []).forEach((col, i) => {
			const sp = 0.045 + i * 0.011;
			const cx =
				w *
				(0.5 +
					0.3 *
						Math.sin(t * sp + i * 1.7) *
						Math.cos(t * sp * 0.6 + i));
			const cy = h * (0.5 + 0.3 * Math.cos(t * sp * 0.85 + i * 2.3));
			const rad = d * (0.34 + 0.06 * Math.sin(t * sp * 1.3 + i));
			const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
			g.addColorStop(0, col);
			g.addColorStop(1, p.base);
			ctx.globalAlpha = p.massAlpha ?? 0.55;
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(cx, cy, rad, 0, Math.PI * 2);
			ctx.fill();
		});

		if (p.stars) this.drawStars(p.stars, t);
		if (p.spiral) this.drawSpiral(p.spiral, t);
		if (p.fire) this.drawFire(p.fire, t);

		// A river seen from above: wavering lines, blurred so they read as current
		// rather than as graphics.
		if (p.lines) this.drawLines(p.lines, t);

		ctx.globalAlpha = 1;
	}

	drawLines(cfg, t) {
		const { ctx, offCtx, w, h } = this;
		const g = offCtx;
		g.setTransform(g.getTransform());
		g.clearRect(0, 0, w, h);
		g.fillStyle = cfg.color;
		g.globalAlpha = 0.5;
		const wl = w * cfg.wave;
		const step = 12;
		for (let i = 0; i < cfg.count; i++) {
			const base = h * ((i + 0.7) / (cfg.count + 0.4));
			const ph = t * cfg.speed * (1 + i * 0.14) + i * 1.9;
			const spine = (x) =>
				base +
				Math.sin((x / wl) * Math.PI * 2 + ph) * h * cfg.amp +
				Math.sin((x / (wl * 0.43)) * Math.PI * 2 - ph * 1.6) *
					h *
					cfg.amp *
					0.38;
			// Thickness breathes along the run — three slow harmonics, never zero.
			const thick = (x) =>
				cfg.width *
				(0.42 +
					0.62 *
						(0.5 +
							0.5 *
								Math.sin(
									(x / (wl * 1.6)) * Math.PI * 2 +
										ph * 0.7 +
										i
								)) +
					0.24 *
						(0.5 +
							0.5 *
								Math.sin(
									(x / (wl * 0.66)) * Math.PI * 2 -
										ph * 1.1 +
										i * 2
								)));
			g.beginPath();
			for (let x = -60; x <= w + 60; x += step)
				g.lineTo(x, spine(x) - thick(x) / 2);
			for (let x = w + 60; x >= -60; x -= step)
				g.lineTo(x, spine(x) + thick(x) / 2);
			g.closePath();
			g.fill();
		}
		g.globalAlpha = 1;
		ctx.save();
		ctx.globalCompositeOperation = cfg.blend || 'multiply';
		if ('filter' in ctx) ctx.filter = `blur(${cfg.blur}px)`;
		ctx.globalAlpha = ('filter' in ctx ? 0.9 : 0.35) * (cfg.alpha ?? 1);
		ctx.drawImage(this.off, 0, 0, w, h);
		ctx.restore();
	}

	// Soft blurred points of light, drifting and breathing very slowly.
	drawStars(cfg, t) {
		const { ctx, w, h } = this;
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		if ('filter' in ctx) ctx.filter = `blur(${cfg.blur}px)`;
		for (let i = 0; i < cfg.count; i++) {
			// Deterministic scatter — the sky is the same every time you open it.
			const sx = (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1;
			const sy = (((Math.sin(i * 78.233) * 12345.6789) % 1) + 1) % 1;
			const sz = (((Math.sin(i * 39.425) * 24634.6345) % 1) + 1) % 1;
			const x = w * sx + Math.sin(t * cfg.speed + i) * 14;
			const y = h * sy + Math.cos(t * cfg.speed * 0.8 + i * 1.3) * 12;
			const r = 1.6 + sz * 5.4;
			ctx.globalAlpha =
				(0.16 + sz * 0.34) *
				(0.62 + 0.38 * Math.sin(t * 0.35 + i * 2.1)) *
				(cfg.alpha ?? 1);
			ctx.fillStyle = cfg.color;
			ctx.beginPath();
			ctx.arc(x, y, r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}

	// An Archimedean spiral drawn as one tapering stroke, then blurred hard so it
	// reads as a tube of light rather than as a line.
	drawSpiral(cfg, t) {
		const { ctx, offCtx: g, w, h } = this;
		g.clearRect(0, 0, w, h);
		const cx = w / 2,
			cy = h / 2,
			rMax = Math.hypot(w, h) * 0.46;
		const rot = t * cfg.speed;
		g.lineCap = 'round';
		g.strokeStyle = cfg.color;
		const steps = 240;
		for (let i = 0; i < steps; i++) {
			const u = i / steps;
			const a = u * cfg.turns * Math.PI * 2 + rot;
			const a2 = ((i + 1) / steps) * cfg.turns * Math.PI * 2 + rot;
			const r1 = rMax * Math.pow(u, 0.85),
				r2 = rMax * Math.pow((i + 1) / steps, 0.85);
			g.globalAlpha = 0.18 + 0.5 * u;
			g.lineWidth = cfg.width * (0.3 + 0.9 * u);
			g.beginPath();
			g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.78);
			g.lineTo(cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2 * 0.78);
			g.stroke();
		}
		g.globalAlpha = 1;
		ctx.save();
		ctx.globalCompositeOperation = 'screen';
		if ('filter' in ctx) ctx.filter = `blur(${cfg.blur}px)`;
		ctx.globalAlpha = cfg.alpha ?? 0.5;
		ctx.drawImage(this.off, 0, 0, w, h);
		ctx.restore();
	}

	// The clearing: water down one flank, a fire breathing in the middle, and a
	// dark canopy closing in at the edges.
	drawFire(cfg, t) {
		const { ctx, w, h } = this;
		const cx = w * 0.5,
			cy = h * 0.52,
			d = Math.hypot(w, h);
		ctx.save();
		if ('filter' in ctx) ctx.filter = `blur(${cfg.blur}px)`;

		ctx.globalCompositeOperation = 'screen';
		ctx.globalAlpha = 0.5;
		const wx = w * (0.08 + 0.012 * Math.sin(t * 0.05));
		const wg = ctx.createRadialGradient(
			wx,
			h * 0.5,
			0,
			wx,
			h * 0.5,
			d * 0.42
		);
		wg.addColorStop(0, cfg.water);
		wg.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = wg;
		ctx.fillRect(0, 0, w, h);

		// Two nested glows, breathing out of phase so the fire never pulses evenly.
		const breathe =
			0.86 + 0.14 * Math.sin(t * 0.5) + 0.06 * Math.sin(t * 1.31 + 1);
		for (const [col, sc, al] of [
			[cfg.color, 0.36, 0.34],
			[cfg.core, 0.15, 0.3]
		]) {
			const r = d * sc * breathe;
			const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
			gr.addColorStop(0, col);
			gr.addColorStop(1, 'rgba(0,0,0,0)');
			ctx.globalAlpha = al;
			ctx.fillStyle = gr;
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.globalCompositeOperation = 'multiply';
		ctx.globalAlpha = 0.9;
		const vg = ctx.createRadialGradient(cx, cy, d * 0.2, cx, cy, d * 0.6);
		vg.addColorStop(0, 'rgba(255,255,255,1)');
		vg.addColorStop(1, 'rgba(20,26,22,1)');
		ctx.fillStyle = vg;
		ctx.fillRect(0, 0, w, h);
		ctx.restore();
	}
}

if (!customElements.get('oriso-pond'))
	customElements.define('oriso-pond', OrisoPond);
window.ORISO_POND = PALETTES;
