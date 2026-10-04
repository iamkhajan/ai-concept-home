import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// Where Alex stands and what they look at.
export const SPOTS = {
  island: { pos: V(0.35, 0, 0.45), face: V(1.2, 1, -1.2) },
  islandSpeaker: { pos: V(0.35, 0, 0.45), face: V(0.8, 1, -0.45) },
  islandTable: { pos: V(0.35, 0, 0.45), face: V(0.35, 1, -1) },
  counter: { pos: V(1.35, 0, -1.95), face: V(1.35, 1, -3) },
  oven: { pos: V(2.6, 0, -1.4), face: V(2.6, 1, -3) },
};

export const COOK_TIME = 45 * 60;
const START = 18 * 60 + 5; // 6:05 PM
const VOICE_REQUEST = 'Steak, medium rare';

// Full scene state, rebuilt every frame from (step, time-in-step), so scrolling
// back and forth always lands in a consistent state.
function baseState() {
  return {
    spot: SPOTS.island,
    pose: 'idle',
    door: 0,
    temp: 22,
    heating: false,
    ovenLight: false,
    display: { mode: 'off', temp: 22, timer: 0 },
    tray: 'counter', // counter | hands | insert | oven | island
    trayInsert: 0,
    doneness: 0,
    steam: false,
    phone: { screen: 'home', pressed: false, toast: null, temp: 22, progress: 0, timer: COOK_TIME, status: 'Idle', notif: null, voice: null },
    phoneVisible: true,
    userSay: null,
    speakerSay: null,
    clock: START,
    timelapse: false,
  };
}

// Camera keyframes: [position, look-at target]
export const STEPS = [
  {
    // 0 — intro
    cam: [V(5.4, 3.4, 5.6), V(0.5, 1.0, -1.1)],
    run(s) {
      s.phoneVisible = false;
      s.spot = SPOTS.islandTable;
    },
  },
  {
    // 1 — ask Cook AI Assistant by voice, send the plan to the oven
    cam: [V(-2.0, 2.3, 2.1), V(1.3, 1.1, -1.4)],
    run(s, t, once) {
      s.pose = 'phone';
      s.clock = START + 1;
      s.phone.status = 'Idle';
      if (t < 4.6) {
        s.phone.screen = 'assistant';
        const typed = Math.floor(clamp01((t - 1.6) / 1.4) * VOICE_REQUEST.length);
        s.phone.voice = { listening: t > 0.8 && t < 3.3, text: VOICE_REQUEST.slice(0, typed), pressed: t > 3.9 };
        if (t > 1.4 && t < 3.6) s.userSay = VOICE_REQUEST;
        return;
      }
      s.phone.screen = 'recipe';
      if (t > 6.4) s.phone.pressed = true;
      once('send', t > 6.6, (fx) => fx.signal('phone', 'oven'));
      if (t > 7.0) s.phone.toast = '✓ Sent to Wall Oven — Conv. Bake, 135°C';
      if (t > 7.8) s.display.mode = 'loaded';
    },
  },
  {
    // 2 — remote preheat
    cam: [V(-2.0, 2.9, 2.7), V(1.6, 1.0, -1.6)],
    run(s, t, once) {
      s.pose = 'phone';
      s.display.mode = 'loaded';
      s.phone.screen = 'preheat';
      once('start', t > 0.3, (fx) => fx.signal('phone', 'oven'));
      const p = clamp01((t - 1.5) / 7);
      if (t > 1.5) {
        s.heating = true;
        s.ovenLight = true;
        s.temp = lerp(22, 135, ease(p));
        s.display.mode = p < 1 ? 'preheat' : 'preheated';
        s.display.temp = s.temp;
      }
      s.phone.temp = s.temp;
      s.phone.progress = p;
      s.phone.status = p < 1 ? `Heating · ~${Math.max(1, Math.ceil((1 - p) * 9))} min left` : 'Ready';
      s.clock = START + 3 + p * 9;
      s.timelapse = t > 1.5 && p < 1;
      once('ready', p >= 1, (fx) => fx.signal('oven', 'phone', 0xffb347));
      if (p >= 1 && t > 9.8) s.phone.notif = { title: 'Wall Oven · Preheated', body: '135°C reached. Your oven is ready for the steak.' };
    },
  },
  {
    // 3 — tray in, recipe settings already loaded
    cam: [V(0.4, 2.3, 2.3), V(2.0, 1.05, -2.1)],
    run(s, t) {
      Object.assign(s, { heating: true, ovenLight: true, temp: 135 });
      s.clock = START + 13;
      s.display.mode = 'preheated';
      s.phone.screen = 'preheat';
      s.phone.temp = 135;
      s.phone.progress = 1;
      s.phone.status = 'Ready';
      s.spot = t < 3.4 ? SPOTS.counter : SPOTS.oven;
      if (t > 3.0 && t < 6.8) {
        s.pose = 'carry';
        s.tray = 'hands';
      }
      if (t > 4.0 && t < 7.4) s.door = 1;
      if (t > 5.6) {
        s.tray = 'insert';
        s.trayInsert = clamp01((t - 5.6) / 1.1);
      }
      if (t > 6.8) {
        s.tray = 'oven';
        s.pose = 'idle';
      }
      if (t > 8.0) {
        const elapsed = t - 8.0;
        s.display.mode = 'cook';
        s.display.timer = COOK_TIME - elapsed;
        s.phone.screen = 'cooking';
        s.phone.timer = s.display.timer;
        s.phone.progress = elapsed / COOK_TIME;
        s.phone.status = 'Door closed · timer started';
      }
    },
  },
  {
    // 4 — voice assistant (time-lapse)
    cam: [V(3.4, 2.3, 2.7), V(0.4, 1.15, -0.5)],
    run(s, t, once) {
      Object.assign(s, { heating: true, ovenLight: true, temp: 135, tray: 'oven', pose: 'idle' });
      s.spot = SPOTS.islandSpeaker;
      const lapse = clamp01(t / 4);
      let timer = lerp(COOK_TIME - 10, 12 * 60 + 4, ease(lapse));
      if (t > 4) timer = 12 * 60 + 4 - (t - 4);
      if (t > 13.6) timer += 5 * 60;
      s.timelapse = t < 4;
      s.clock = START + 13 + lapse * 33 + Math.max(0, t - 4) / 60;
      s.doneness = 0.1 + 0.6 * ease(lapse);
      s.display.mode = 'cook';
      s.display.timer = timer;
      s.phone.screen = 'cooking';
      s.phone.timer = timer;
      s.phone.progress = 1 - timer / (COOK_TIME + (t > 13.6 ? 300 : 0));
      s.phone.status = t > 13.6 ? 'Broil sear added by voice' : 'Cooking';

      if (t > 4.5 && t < 7.4) s.userSay = 'Hey Kitchen, how’s the steak doing?';
      if (t > 7.0 && t < 10.6) s.speakerSay = 'It’s at 46°C inside. 12 minutes to medium rare.';
      if (t > 10.9 && t < 13.8) s.userSay = 'Add a 5-minute sear at the end. I want a good crust.';
      once('voice', t > 13.0, (fx) => fx.signal('speaker', 'oven'));
      if (t > 13.8 && t < 19) s.speakerSay = 'Sear added. 17 minutes remaining. I’ll let you know when it’s ready.';
    },
  },
  {
    // 5 — ready: notification, oven off to rest, door open
    cam: [V(3.6, 1.9, 0.9), V(2.2, 1.1, -2.1)],
    run(s, t, once) {
      Object.assign(s, { tray: 'oven', doneness: 1, temp: lerp(135, 60, clamp01(t / 8)), ovenLight: true });
      s.clock = START + 65;
      s.spot = t < 2.2 ? SPOTS.islandSpeaker : SPOTS.oven;
      s.display.mode = t < 3.5 ? 'done' : 'warm';
      s.phone.screen = 'ready';
      once('notify', t > 0.2, (fx) => {
        fx.signal('oven', 'phone', 0x6dff9e);
        fx.signal('oven', 'speaker', 0x6dff9e);
      });
      if (t > 1.3) s.phone.notif = { title: 'Dinner is ready 🥩', body: 'Ribeye is medium rare (54°C core). Oven is off. Rest 5 minutes, then slice.' };
      if (t > 1.3 && t < 5.5) s.speakerSay = 'Steak’s ready, medium rare! Let it rest 5 minutes.';
      if (t > 5.2) s.door = 1;
      if (t > 5.4) s.steam = true;
    },
  },
  {
    // 6 — outro: tray to the island
    cam: [V(4.6, 3.3, 5.0), V(0.4, 1.0, -1.0)],
    run(s, t, once) {
      Object.assign(s, { tray: 'oven', doneness: 1, temp: 60, ovenLight: true });
      s.clock = START + 67;
      s.display.mode = 'warm';
      s.phone.screen = 'ready';
      s.spot = SPOTS.oven;
      s.door = t < 3.2 ? 1 : 0;
      s.steam = t < 3;
      if (t > 0.8) {
        s.pose = 'carry';
        s.tray = 'hands';
      }
      if (t > 1.6) s.spot = SPOTS.islandTable;
      const placed = once('placed', t > 2.5 && this.personArrived, () => {});
      if (placed) {
        s.tray = 'island';
        s.pose = 'idle';
        s.userSay = t < 7 ? 'Dinner’s served!' : null;
      }
    },
  },
];

export class Story {
  constructor(fx) {
    this.fx = fx;
    this.index = 0;
    this.t = 0;
    this.fired = new Set();
    this.state = baseState();
  }

  setStep(i) {
    if (i === this.index) return;
    this.index = i;
    this.t = 0;
    this.fired.clear();
  }

  restart() {
    this.t = 0;
    this.fired.clear();
  }

  update(dt, ctx) {
    this.t += dt;
    const s = baseState();
    const once = (key, cond, fn) => {
      if (this.fired.has(key)) return true;
      if (!cond) return false;
      this.fired.add(key);
      fn(this.fx);
      return true;
    };
    const step = STEPS[this.index];
    step.personArrived = ctx.personArrived;
    step.run(s, this.t, once);
    this.state = s;
    return s;
  }
}
