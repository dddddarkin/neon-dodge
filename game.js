
    (function () {
      'use strict';

      /* ==================== 工具 ==================== */
      var TAU = Math.PI * 2;
      function rand(a, b) { return a + Math.random() * (b - a); }
      function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
      function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
      function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
      function hyp(x, y) { return Math.sqrt(x * x + y * y); }
      function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
      function escapeHTML(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }

      /* ==================== 种子随机 ==================== */
      function mulberry32(a) {
        return function () {
          a |= 0; a = (a + 0x6D2B79F5) | 0;
          var t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      function hashStr(s) {
        var h = 2166136261;
        for (var i = 0; i < s.length; i++) {
          h ^= s.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        return h >>> 0;
      }
      var srnd = Math.random;
      function sRand(a, b) { return a + srnd() * (b - a); }
      function sPick(arr) { return arr[(srnd() * arr.length) | 0]; }

      /* ==================== 画布 ==================== */
      var canvas = document.getElementById('game');
      var ctx = canvas.getContext('2d', { alpha: false });
      var W = 1, H = 1, dpr = 1;
      var bgGrad = null, vignette = null;

      function buildBg() {
            var sky = chapterTheme().sky;
        bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, sky[0]);
        bgGrad.addColorStop(0.55, sky[1]);
        bgGrad.addColorStop(1, sky[2]);
        vignette = ctx.createRadialGradient(W * .5, H * .5, Math.min(W, H) * .22, W * .5, H * .5, Math.max(W, H) * .8);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.72)');
      }

      function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.max(320, window.innerWidth);
        H = Math.max(320, window.innerHeight);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildBg();
        initStars();
        initSpeedLines();
      }

      /* ==================== 常量 ==================== */
      var DASH_CD = 2.4;
      var MAX_SPEED = 800;
      var COMBO_TIME = 3.6;
      var GRAZE_BAND = 20;
      var SLOW_FACTOR = 0.42;
      var TOUCH_SENS = 1.15;
      var BOSS_HP = 5;
      var METEOR_COLORS = ['#ff5c8a', '#ff8a3d', '#a06bff', '#ff3ea5', '#ffd166'];
      var PICKUP_TYPES = ['shield', 'slow', 'magnet', 'double', 'pulse'];

      /* ==================== 玩家 ==================== */
      function defaultMods() {
        return {
          speedMul: 1, dashCdMul: 1, magnetR: 0, magnetAlways: false,
          scoreMul: 1, grazeBand: 0, grazeMul: 1, dashInvuln: 1,
          shieldMax: 2, pickupMul: 1
        };
      }

      var player = {
        x: 0, y: 0, vx: 0, vy: 0, r: 14, tilt: 0,
        shield: 0, invuln: 0, dashCd: 0, dashTime: 0,
        trail: [], mods: defaultMods()
      };

      /* ==================== 游戏状态 ==================== */
      var game = {
        mode: 'menu', time: 0, score: 0, best: 0,
        shake: 0, flash: 0, hitstop: 0,
        paused: false, deathT: 0, newBest: false,
        combo: 0, comboT: 0, comboPop: 0,
        grazes: 0, shatters: 0, maxMult: 1,
        daily: false, prefDaily: false, seed: 0,
        phase: 'calm', phaseT: 6, eventType: '',
        eventElapsed: 0, eventFired: 0, rainT: 0,
        spawnT: 1, orbT: 2, powerT: 11,
        slowT: 0, magnetT: 0, doubleT: 0,
            boss: null,
            nextBoss: 55,

            wave: 0,
          waveState: 'break',
          waveGoal: 0,
          threatBonus: 0,
          mat: 0,
          shopOpen: false,
          shopOffers: [],

            waveT: 0,
            breakT: 0,
            waveBudget: 0,
            waveSpawned: 0,
                waveKills: 0,
           totalKills: 0,
           freeWeaponGiven: false,
           victoryOpen: false,
            waveDamaged: false,
            lastGrade: '',
            lastWave: 0,
            lastGain: 0,
            shopDelay: 0,
            chapter: 1,
            waveIsBoss: false,
            bossSpawned: false,
            cleared: false,

        banner: '', bannerColor: '#39f6ff', bannerT: 0, bannerMax: 2,
        upgrading: false, upgradeChoices: [], upgradeStacks: {},
        upgradeLevel: 0, nextUpgrade: 500,
           glitchT: 0,
              whiteFlash: 0,
            debug: false,
            debugInv: false,
               debugOneShot: false,
                debugBossOneShot: false,
                      debugSkipShop: false,
                  debugHitbox: false,
        debugNoAttack: false,
        debugFreeShop: false,
        debugDmgMul: 1,
        debugNoDashCd: false,
        debugFreeze: false,
        fps: 0,
            debugSpeed: 1,

           glitchDur: 0.35
      };

      try { game.best = parseInt(localStorage.getItem('neonDodgeBest'), 10) || 0; } catch (e) { game.best = 0; }

      var pendingEntry = false;

      var meteors = [], orbs = [], pickups = [], particles = [];
        var bullets = [], bulletPool = [], materials = [];
      var floaters = [], sparks = [];
      var shockwaves = [];
      var stars = [], speedLines = [], holes = [], sats = [], warns = [];

      /* ===== 第 1 段结束 · 请继续粘贴第 2 段 ===== */
      /* ==================== 故障特效 ==================== */
      var glitchTimer = 0;

      function glitch(power, dur) {
        var d = dur || 0.32;
        game.glitchT = Math.max(game.glitchT, d);
        game.glitchDur = d;
        canvas.classList.remove('glitch');
        void canvas.offsetWidth;
        canvas.classList.add('glitch');
        game.shake = Math.max(game.shake, 6 * (power || 1));
        if (glitchTimer) clearTimeout(glitchTimer);
        glitchTimer = setTimeout(function () { canvas.classList.remove('glitch'); }, 420);
      }

      /* ==================== 成就 ==================== */
            var ACH_LIST = [
        { id: 'first', name: '初次起飞', desc: '完成一次飞行',
          icon: '<path d="M20 30V9"/><path d="M13 16l7-7 7 7"/><path d="M15 33q5 4 10 0"/>' },
        { id: 'survive60', name: '生存专家', desc: '单局存活 60 秒',
          icon: '<path d="M11 7h18M11 33h18"/><path d="M14 7c0 8 6 9 6 13s-6 5-6 13"/><path d="M26 7c0 8-6 9-6 13s6 5 6 13"/>' },
        { id: 'graze30', name: '刀尖舞者', desc: '单局擦身 30 次',
          icon: '<path d="M8 32L24 8"/><path d="M32 32L16 8"/><circle cx="20" cy="20" r="1.8" fill="currentColor" stroke="none"/>' },
        { id: 'shatter20', name: '碎星者', desc: '单局击碎 20 颗陨石',
          icon: '<path d="M12 10l14-2 7 11-6 13H14L7 20z"/><path d="M20 8l-2 10 6 3-5 10"/><path d="M18 18l9 1"/>' },
        { id: 'mult5', name: '连击达人', desc: '达到 ×5 连击倍率',
          icon: '<path d="M23 5L13 22h7l-3 13 11-16h-7z"/><text x="31" y="14" font-size="10" text-anchor="middle" fill="currentColor" stroke="none">5</text>' },
        { id: 'boss1', name: '屠龙者', desc: '击败一只陨石母体',
          icon: '<path d="M32 17a12 12 0 0 0-22-4"/><path d="M8 23a12 12 0 0 0 22 4"/><circle cx="20" cy="20" r="3.4" fill="currentColor" stroke="none"/>' },
        { id: 'score5000', name: '五千里程', desc: '单局得分达到 5000',
          icon: '<path d="M7 28a13 13 0 0 1 26 0"/><path d="M20 28l6-10"/><circle cx="20" cy="28" r="2.2" fill="currentColor" stroke="none"/><path d="M11 28h2M27 28h2"/>' },
        { id: 'clear', name: '通关者', desc: '完成 4 章主线',
          icon: '<path d="M20 5l13 11-13 19L7 16z"/><path d="M7 16h26"/><path d="M20 5l-6 11 6 19 6-19z"/>' }

      ];


           var unlocked = {};
      try {
        var rawAch = localStorage.getItem('neonDodgeAch');
        if (rawAch) {
          var parsedAch = JSON.parse(rawAch);
          if (parsedAch && !Array.isArray(parsedAch) && typeof parsedAch === 'object') {
            for (var ak0 in parsedAch) if (typeof parsedAch[ak0] === 'number') unlocked[ak0] = parsedAch[ak0];
          } else {
            localStorage.removeItem('neonDodgeAch');
          }
        }
      } catch (e) { }

      var achOpen = false;

      function achCount() { return Object.keys(unlocked).length; }

      function fmtAchTime(ts) {
        var d = new Date(ts), n = new Date();
        var p2 = function (v) { return (v < 10 ? '0' : '') + v; };
        var hm = p2(d.getHours()) + ':' + p2(d.getMinutes());
        var sameDay = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
        if (sameDay) return '今天 ' + hm;
        if (d.getFullYear() === n.getFullYear()) return p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + hm;
        return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      }

      function unlock(id) {
        if (unlocked[id]) return;
        var item = null;
        for (var i = 0; i < ACH_LIST.length; i++) if (ACH_LIST[i].id === id) item = ACH_LIST[i];
        if (!item) return;
        unlocked[id] = Date.now();
        try { localStorage.setItem('neonDodgeAch', JSON.stringify(unlocked)); } catch (e) { }
        toast('成就解锁 · ' + item.name);
        Sound.milestone();
      }


      /* ==================== Web Audio：音效 + BGM ==================== */
      var Sound = (function () {
        var ac = null, master = null, noiseBuf = null, muted = false, lastGraze = 0;

        var STEP_DUR = 60 / 96 / 4;
          var bgm = { gain: null, timer: null, on: false, step: 0, next: 0, level: 0, pattern: 0, tempo: 1, pitch: 0 };

        var BASS_PATTERNS = [
          [0, -1, 0, 0, -1, 0, 3, -1, 0, -1, 0, 5, -1, 3, -1, 7],
          [0, 0, -1, 7, 0, -1, 3, 0, 5, -1, 0, 3, -1, 7, 5, -1],
          [0, -1, 3, -1, 5, -1, 7, -1, 0, -1, 3, -1, 5, -1, 7, -1],
          [0, 0, 5, 0, 0, 7, 0, 3, 0, 0, 5, 0, 7, 0, 3, 0]
        ];
        var ARP = [12, 15, 19, 22, 19, 15];

        function init() {
          if (ac) {
            if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { } }
            return;
          }
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          try { ac = new AC(); } catch (e) { ac = null; return; }
          master = ac.createGain();
          master.gain.value = 0.28;
          master.connect(ac.destination);
          var len = Math.floor(ac.sampleRate);
          noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
          var d = noiseBuf.getChannelData(0);
          for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }

        function tone(f1, f2, dur, type, vol, delay) {
          if (!ac || muted) return;
          var t = ac.currentTime + (delay || 0);
          var o = ac.createOscillator(), g = ac.createGain();
          o.type = type || 'sine';
          o.frequency.setValueAtTime(Math.max(20, f1), t);
          if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g); g.connect(master);
          o.start(t); o.stop(t + dur + 0.06);
        }

        function noise(dur, vol, f1, f2, type, delay) {
          if (!ac || muted || !noiseBuf) return;
          var t = ac.currentTime + (delay || 0);
          var src = ac.createBufferSource();
          src.buffer = noiseBuf;
          var flt = ac.createBiquadFilter();
          flt.type = type || 'lowpass';
          flt.frequency.setValueAtTime(Math.max(40, f1), t);
          if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t + dur);
          var g = ac.createGain();
          g.gain.setValueAtTime(Math.max(0.0004, vol), t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          src.connect(flt); flt.connect(g); g.connect(master);
          src.start(t); src.stop(t + dur + 0.06);
        }

        /* ---- BGM 乐器 ---- */
        function bBass(t, freq, dur) {
          if (!ac || muted) return;
          var o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.setValueAtTime(620, t);
          f.frequency.exponentialRampToValueAtTime(180, t + dur * 0.8);
          f.Q.value = 6;
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(freq, t);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(f); f.connect(g); g.connect(bgm.gain);
          o.start(t); o.stop(t + dur + 0.05);
        }

        function bArp(t, freq) {
          if (!ac || muted) return;
          var o = ac.createOscillator(), g = ac.createGain();
          o.type = 'square';
          o.frequency.setValueAtTime(freq, t);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.024, t + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
          o.connect(g); g.connect(bgm.gain);
          o.start(t); o.stop(t + 0.17);
        }

        function bKick(t) {
          if (!ac || muted) return;
          var o = ac.createOscillator(), g = ac.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(135, t);
          o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.16, t + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
          o.connect(g); g.connect(bgm.gain);
          o.start(t); o.stop(t + 0.26);
        }

        function bHat(t) {
          if (!ac || !noiseBuf || muted) return;
          var s = ac.createBufferSource();
          s.buffer = noiseBuf;
          var f = ac.createBiquadFilter();
          f.type = 'highpass';
          f.frequency.value = 7200;
          var g = ac.createGain();
          g.gain.setValueAtTime(0.055, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
          s.connect(f); f.connect(g); g.connect(bgm.gain);
          s.start(t); s.stop(t + 0.09);
        }
              /* ---- 每章一套和弦进行 ---- */
    var CHAPTER_MUSIC = [
      {
        name: '近地轨道',
        transpose: 0,
        chords: [
          { root: 0,  third: 3, fifth: 7 },
          { root: -4, third: 4, fifth: 7 },
          { root: 3,  third: 4, fifth: 7 },
          { root: -2, third: 3, fifth: 7 }
        ]
      },
      {
        name: '小行星带',
        transpose: 2,
        chords: [
          { root: 5,  third: 3, fifth: 7 },
          { root: -2, third: 4, fifth: 7 },
          { root: -4, third: 4, fifth: 7 },
          { root: 3,  third: 4, fifth: 7 }
        ]
      },
      {
        name: '引力深渊',
        transpose: -3,
        chords: [
          { root: 7,  third: 3, fifth: 7 },
          { root: 3,  third: 4, fifth: 7 },
          { root: -2, third: 4, fifth: 7 },
          { root: 5,  third: 4, fifth: 7 }
        ]
      },
      {
        name: '离子风暴',
        transpose: 4,
        chords: [
          { root: -4, third: 3, fifth: 7 },
          { root: 1,  third: 4, fifth: 7 },
          { root: -5, third: 4, fifth: 7 },
          { root: -7, third: 4, fifth: 7 }
        ]
      }
    ];

    /* ---- 主旋律动机：16 步，-1 = 休止 ---- */
    var MELODY = [
      12, -1, -1, 15, -1, 19, -1, -1,
      17, -1, 15, -1, -1, 12, -1, -1
    ];

    function ensureFx() {
      if (!ac || !bgm.gain) return;

      if (!bgm.reverb) {
        var len = Math.floor(ac.sampleRate * 1.6);
        var ir = ac.createBuffer(2, len, ac.sampleRate);
        for (var ch = 0; ch < 2; ch++) {
          var data = ir.getChannelData(ch);
          for (var i = 0; i < len; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
          }
        }
        bgm.reverb = ac.createConvolver();
        bgm.reverb.buffer = ir;

        var rg = ac.createGain();
        rg.gain.value = 0.32;
        bgm.reverb.connect(rg);
        rg.connect(bgm.gain);
      }

      if (!bgm.delay) {
        bgm.delay = ac.createDelay(1.0);
        bgm.delay.delayTime.value = STEP_DUR * 3;

        var fb = ac.createGain();
        fb.gain.value = 0.26;
        bgm.delay.connect(fb);
        fb.connect(bgm.delay);

        var dg = ac.createGain();
        dg.gain.value = 0.22;
        bgm.delay.connect(dg);
        dg.connect(bgm.gain);
      }
    }

    function bLead(t, freq, dur) {
      if (!ac || muted) return;

      var o = ac.createOscillator();
      var f = ac.createBiquadFilter();
      var g = ac.createGain();

      f.type = 'lowpass';
      f.frequency.setValueAtTime(2800, t);
      f.Q.value = 1;

      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, t);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.055, t + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      o.connect(f);
      f.connect(g);
      g.connect(bgm.gain);
      if (bgm.reverb) g.connect(bgm.reverb);
      if (bgm.delay) g.connect(bgm.delay);

      o.start(t);
      o.stop(t + dur + 0.06);
    }

    function bChord(t, root, chord, pf) {
      if (!ac || muted) return;

      var g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.016, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
      g.connect(bgm.gain);
      if (bgm.reverb) g.connect(bgm.reverb);

      var semis = [0, chord.third, chord.fifth, 12];
      var vols = [1, 0.6, 0.6, 0.35];

      for (var i = 0; i < semis.length; i++) {
        var o = ac.createOscillator();
        var og = ac.createGain();

        o.type = i === 0 ? 'triangle' : 'sine';
        o.frequency.setValueAtTime(root * Math.pow(2, semis[i] / 12), t);
        og.gain.value = vols[i];

        o.connect(og);
        og.connect(g);
        o.start(t);
        o.stop(t + 2.2);
      }
    }


                    function playStep(step, t) {
      var s16 = step % 16;
      var bar = Math.floor(step / 16) % 8;
      var ci = bar % 4;

      var mi = Math.min(3, Math.max(0, (game.chapter - 1) % 4));
      var music = CHAPTER_MUSIC[mi];
      var chord = music.chords[ci];

      var pf = Math.pow(2, bgm.pitch / 12);
      var root = 110 * pf * Math.pow(2, chord.root / 12);

      if (s16 % 8 === 0) bKick(t);

      var bassSemi = (s16 % 4 === 0) ? 0 : ((s16 % 4 === 2) ? 12 : -1);
      if (bassSemi >= 0) {
        bBass(t, root * Math.pow(2, bassSemi / 12), STEP_DUR * 1.8);
      }

      if (bgm.level >= 1 && s16 % 2 === 0) {
        var arpNotes = [chord.root, chord.root + chord.third, chord.root + chord.fifth, chord.root + 12];
        var an = arpNotes[Math.floor(step / 2) % arpNotes.length];
        var oct = (bar >= 4) ? 12 : 0;
        bArp(t, 220 * pf * Math.pow(2, (an + oct) / 12));
      }

      if (bgm.level >= 2 && s16 % 2 === 1) bHat(t);
      if (bgm.level >= 2 && bar === 7 && s16 % 2 === 0) bHat(t);

      if (bar < 4 && bar % 2 === 0) {
        var mn = MELODY[s16];
        if (mn >= 0) {
          var trans = music.transpose + ((bar === 2) ? 2 : 0);
          bLead(t, 220 * pf * Math.pow(2, (mn + trans) / 12), STEP_DUR * 2.6);
        }
      }

      if (bgm.level >= 3) {
        if (s16 === 0) bChord(t, root, chord, pf);
        if (s16 % 4 === 2) bHat(t);
      }
    }



    function bPad(t, f1, f2) {
      if (!ac || muted) return;

      var g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.020, t + 0.28);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
      g.connect(bgm.gain);

      var o1 = ac.createOscillator();
      o1.type = 'triangle';
      o1.frequency.setValueAtTime(f1, t);
      o1.connect(g);
      o1.start(t);
      o1.stop(t + 2.0);

      var o2 = ac.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(f2 * 1.5, t);
      o2.connect(g);
      o2.start(t);
      o2.stop(t + 2.0);
    }


        function bgmTick() {
          if (!ac || !bgm.on) return;
          var now = ac.currentTime;
          if (bgm.next < now - 0.5) bgm.next = now + 0.05;
          var look = 0.18;
          var guard = 0;
          while (bgm.next < now + look && guard < 32) {
            playStep(bgm.step, bgm.next);
                    bgm.step = (bgm.step + 1) % 128;
                    bgm.next += STEP_DUR / (bgm.tempo || 1);
            guard++;
          }
        }

        function bgmStart(seed) {
          if (!ac || !master) return;
                if (!bgm.gain) {
        bgm.gain = ac.createGain();
        bgm.gain.gain.value = 0.0001;
        bgm.gain.connect(master);
      }

      ensureFx();
          bgm.pattern = Math.abs(seed | 0) % BASS_PATTERNS.length;
          bgm.level = 0;
         bgm.step = 0;
         bgm.on = true;
         bgm.tempo = 1;
         bgm.pitch = 0;
          bgm.next = ac.currentTime + 0.08;

          var t = ac.currentTime;
          bgm.gain.gain.cancelScheduledValues(t);
          bgm.gain.gain.setValueAtTime(0.0001, t);
          bgm.gain.gain.exponentialRampToValueAtTime(1, t + 1.0);
          if (bgm.timer) clearInterval(bgm.timer);
          bgm.timer = setInterval(bgmTick, 25);
        }

        function bgmStop() {
          bgm.on = false;
          if (bgm.timer) { clearInterval(bgm.timer); bgm.timer = null; }
          if (bgm.gain && ac) {
            var t = ac.currentTime;
            bgm.gain.gain.cancelScheduledValues(t);
            bgm.gain.gain.setValueAtTime(Math.max(0.0001, bgm.gain.gain.value), t);
            bgm.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
          }
        }

        function bgmPause() {
          bgm.on = false;
          if (bgm.timer) { clearInterval(bgm.timer); bgm.timer = null; }
        }

        function bgmResume() {
          if (!ac || bgm.on) return;
          bgm.on = true;
          bgm.next = ac.currentTime + 0.06;
          if (bgm.timer) clearInterval(bgm.timer);
          bgm.timer = setInterval(bgmTick, 25);
        }

        return {
          init: init,
          isMuted: function () { return muted; },
          toggleMute: function () { muted = !muted; return muted; },
          orb: function (combo) {
            var base = 700 + Math.min(combo, 24) * 16;
            tone(base, base * 1.9, 0.1, 'sine', 0.16);
            tone(base * 1.5, base * 2.2, 0.08, 'triangle', 0.07, 0.02);
          },
          graze: function () {
            var t = performance.now();
            if (t - lastGraze < 55) return;
            lastGraze = t;
            tone(1550, 2400, 0.05, 'triangle', 0.05);
            noise(0.05, 0.045, 4500, 9000, 'highpass');
          },
          shatter: function () { noise(0.26, 0.2, 2400, 130, 'lowpass'); tone(190, 55, 0.22, 'sawtooth', 0.09); },
          dash: function () { noise(0.22, 0.13, 320, 2800, 'bandpass'); tone(240, 760, 0.16, 'sine', 0.09); },
      shock: function () {
        noise(0.28, 0.16, 900, 120, 'lowpass');
        tone(320, 90, 0.24, 'sine', 0.12);
      },
                shoot: function (type) {
        if (type === 'shotgun') {
          noise(0.16, 0.10, 1400, 200, 'lowpass');
          tone(180, 70, 0.12, 'square', 0.06);
        } else if (type === 'laser') {
          tone(1400, 420, 0.16, 'sawtooth', 0.05);
          noise(0.14, 0.05, 3000, 900, 'bandpass');
        } else if (type === 'arc') {
          noise(0.09, 0.07, 5200, 2400, 'highpass');
          tone(1800, 900, 0.06, 'square', 0.03);
        } else {
          tone(1050, 720, 0.055, 'square', 0.03);
        }
      },
          shieldBreak: function () { tone(520, 170, 0.26, 'square', 0.09); noise(0.2, 0.11, 1400, 320, 'bandpass'); },
          death: function () {
            noise(0.7, 0.24, 1700, 60, 'lowpass');
            tone(320, 40, 0.6, 'sawtooth', 0.13);
            tone(900, 130, 0.3, 'square', 0.05, 0.02);
          },
          milestone: function () {
            var s = [0, 0.07, 0.14];
            for (var i = 0; i < 3; i++) tone(660 * Math.pow(1.26, i), null, 0.12, 'triangle', 0.09, s[i]);
          },
          pickup: function () { tone(880, 1320, 0.1, 'sine', 0.12); tone(1320, 1760, 0.12, 'sine', 0.09, 0.06); },
          pulse: function () {
            noise(0.5, 0.24, 300, 4000, 'bandpass');
            tone(120, 60, 0.45, 'sawtooth', 0.14);
            tone(1200, 200, 0.35, 'square', 0.06);
          },
          laserCharge: function () { tone(300, 1100, 0.9, 'sine', 0.05); },
          laserFire: function () { noise(0.35, 0.16, 2600, 500, 'bandpass'); tone(1400, 380, 0.3, 'sawtooth', 0.07); },
          bossWarn: function () { tone(110, 70, 0.9, 'sawtooth', 0.12); tone(220, 130, 0.9, 'square', 0.05, 0.05); },
          bossOpen: function () { tone(420, 900, 0.3, 'triangle', 0.09); tone(640, 1280, 0.3, 'sine', 0.06, 0.06); },
          bossHit: function () { noise(0.4, 0.24, 1800, 80, 'lowpass'); tone(140, 45, 0.4, 'sawtooth', 0.14); },
          bossDie: function () {
            noise(1.1, 0.3, 2200, 40, 'lowpass');
            tone(180, 30, 0.9, 'sawtooth', 0.16);
            tone(760, 90, 0.6, 'square', 0.07);
          },
          levelUp: function () {
            var n = [523, 659, 784, 1046];
            for (var i = 0; i < n.length; i++) tone(n[i], n[i] * 1.01, 0.14, 'triangle', 0.1, i * 0.06);
          },
          choose: function () { tone(760, 1140, 0.1, 'sine', 0.12); tone(1140, 1520, 0.12, 'triangle', 0.08, 0.05); },
          bgmStart: bgmStart,
          bgmStop: bgmStop,
          bgmPause: bgmPause,
          bgmResume: bgmResume,
          setBgmLevel: function (n) { bgm.level = n; },
          setBgmTempo: function (tempo, pitch) {
        bgm.tempo = tempo || 1;
        bgm.pitch = pitch || 0;
      }
        };
      })();

      /* ==================== 提示气泡 ==================== */
      var toastBox = document.getElementById('toastBox');
      function toast(msg) {
        var el = document.createElement('div');
        el.className = 'toast';
        el.textContent = msg;
        toastBox.appendChild(el);
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
      }

      /* ==================== 日期 / 排行榜 ==================== */
      function todayKey() {
        var d = new Date();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return d.getFullYear() + '-' + m + '-' + day;
      }

      var LB_KEY = 'neonDodgeTop5';
      var LB_DAILY = 'neonDodgeTop5:';
      var NAME_KEY = 'neonDodgeName';

      function lbKey(daily) { return daily ? LB_DAILY + todayKey() : LB_KEY; }

      function loadBoard(daily) {
        try {
          var raw = localStorage.getItem(lbKey(daily));
          var list = raw ? JSON.parse(raw) : [];
          return Array.isArray(list) ? list.slice(0, 5) : [];
        } catch (e) { return []; }
      }

      function saveBoard(daily, list) {
        try { localStorage.setItem(lbKey(daily), JSON.stringify(list.slice(0, 5))); } catch (e) { }
      }

      function qualifiesEntry(score) {
        if (score <= 0) return false;
        var list = loadBoard(game.daily);
        if (list.length < 5) return true;
        return score > list[list.length - 1].score;
      }

      function getSavedName() {
        try {
          var n = localStorage.getItem(NAME_KEY);
          if (n) return n;
        } catch (e) { }
        return 'AAA';
      }

      function insertEntry(name) {
        var list = loadBoard(game.daily);
        var entry = {
          name: name, score: Math.floor(game.score),
          time: +game.time.toFixed(1), mult: game.maxMult,
          date: todayKey(), hl: true
        };
        list.push(entry);
        list.sort(function (a, b) { return b.score - a.score || b.time - a.time; });
        var top = list.slice(0, 5);
        for (var i = 0; i < top.length; i++) if (top[i] !== entry) top[i].hl = false;
        saveBoard(game.daily, top);
        return top;
      }

      function boardHTML(list) {
        if (!list || !list.length) return '<div class="lb-empty">暂 无 记 录</div>';
        var medals = ['①', '②', '③', '④', '⑤'];
        var h = '';
        for (var i = 0; i < list.length; i++) {
          var e = list[i];
          h += '<div class="lb-row' + (e.hl ? ' hl' : '') + '">' +
            '<span class="lb-rank">' + (medals[i] || (i + 1)) + '</span>' +
            '<span class="lb-name">' + escapeHTML(e.name || '---') + '</span>' +
            '<span class="lb-score">' + (e.score | 0) + '</span></div>';
        }
        return h;
      }

      function refreshBestName() {
        var el = document.getElementById('bestName');
        if (!el) return;
        var list = loadBoard(game.daily);
        el.textContent = list.length ? list[0].name : '';
      }

      function getDailyBest() {
        try { return parseInt(localStorage.getItem('neonDodgeDaily:' + todayKey()), 10) || 0; }
        catch (e) { return 0; }
      }
      function setDailyBest(v) {
        try { localStorage.setItem('neonDodgeDaily:' + todayKey(), String(v)); } catch (e) { }
      }

      /* ==================== 星空 / 速度线 ==================== */
      function initStars() {
        stars.length = 0;
        var n = clamp(Math.round((W * H) / 6500), 90, 340);
        for (var i = 0; i < n; i++) {
          stars.push({ x: rand(0, W), y: rand(0, H), z: rand(0.18, 1), tw: rand(0, TAU), ts: rand(1.2, 3.6) });
        }
      }

      function initSpeedLines() {
        speedLines.length = 0;
        for (var i = 0; i < 70; i++) {
          speedLines.push({ x: rand(0, W), y: rand(0, H), len: rand(50, 220), sp: rand(700, 1600), a: rand(0.05, 0.2) });
        }
      }

      function updateStars(dt) {
        var boost = game.mode === 'play' ? Math.min(1 + game.time * 0.05, 2.6) : 0.45;
        for (var i = 0; i < stars.length; i++) {
          var s = stars[i];
          s.y += (18 + 95 * s.z) * boost * dt;
          s.tw += dt * s.ts;
          if (s.y > H + 2) { s.y = -2; s.x = rand(0, W); }
        }
      }

      function updateSpeedLines(dt, intensity) {
        for (var i = 0; i < speedLines.length; i++) {
          var l = speedLines[i];
          l.y += l.sp * dt * (0.3 + intensity * 1.5);
          if (l.y - l.len > H) {
            l.y = rand(-260, -20); l.x = rand(0, W);
            l.len = rand(50, 220); l.sp = rand(700, 1600);
          }
        }
      }

      function drawStars() {
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < stars.length; i++) {
          var s = stars[i];
          var a = 0.16 + 0.62 * Math.abs(Math.sin(s.tw)) * s.z;
          var size = s.z * 2.1;
          ctx.fillStyle = 'rgba(160,225,255,' + a.toFixed(3) + ')';
          ctx.fillRect(s.x - size * 0.5, s.y - size * 0.5, size, size);
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      function drawSpeedLines(intensity) {
        if (intensity <= 0.01) return;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 1.2;
        for (var i = 0; i < speedLines.length; i++) {
          var l = speedLines[i];
          var a = l.a * intensity;
          if (a < 0.004) continue;
          var g = ctx.createLinearGradient(l.x, l.y - l.len, l.x, l.y);
          g.addColorStop(0, 'rgba(120,220,255,0)');
          g.addColorStop(1, 'rgba(150,235,255,' + a.toFixed(3) + ')');
          ctx.strokeStyle = g;
          ctx.beginPath();
          ctx.moveTo(l.x, l.y - l.len);
          ctx.lineTo(l.x, l.y);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      /* ==================== 输入 ==================== */
      var keys = { left: false, right: false, up: false, down: false };
      var pointer = { x: 0, y: 0, active: false, down: false, mode: 'absolute', id: null, lastX: 0, lastY: 0 };

      var KEYMAP = {
        ArrowLeft: 'left', KeyA: 'left',
        ArrowRight: 'right', KeyD: 'right',
        ArrowUp: 'up', KeyW: 'up',
        ArrowDown: 'down', KeyS: 'down'
      };

      window.addEventListener('keydown', function (e) {
            var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                  if (e.code === 'Backquote' || e.code === 'F2') {
      e.preventDefault();
      debugToggle();
      return;
    }

    if (achOpen) {
      if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        closeAchievements();
      } else {
        e.preventDefault();
      }
      return;
    }



    if (game.shopOpen) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        closeShop();
      } else {
        e.preventDefault();
      }
      return;
    }

        if (game.upgrading) {
          if (e.code === 'Digit1' || e.code === 'Numpad1') { e.preventDefault(); chooseUpgrade(0); return; }
          if (e.code === 'Digit2' || e.code === 'Numpad2') { e.preventDefault(); chooseUpgrade(1); return; }
          if (e.code === 'Digit3' || e.code === 'Numpad3') { e.preventDefault(); chooseUpgrade(2); return; }
          e.preventDefault();
          return;
        }

        var act = KEYMAP[e.code];
        if (act) {
          keys[act] = true;
          pointer.active = false;
          e.preventDefault();
          return;
        }

        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
          e.preventDefault();
          if (game.mode === 'menu' || game.mode === 'over') startGame(game.prefDaily);
          else if (game.mode === 'play' && !game.paused) tryDash();
          return;
        }

        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          e.preventDefault();
          if (game.mode === 'play' && !game.paused) tryDash();
          return;
        }

        if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause(); return; }

        if (e.code === 'KeyM') {
          var m = Sound.toggleMute();
          var el = document.getElementById('sndTxt');
          el.textContent = m ? 'SFX OFF' : 'SFX';
          el.classList.toggle('on', !m);
        }
      });

      window.addEventListener('keyup', function (e) {
        var act = KEYMAP[e.code];
        if (act) { keys[act] = false; e.preventDefault(); }
      });

      canvas.addEventListener('pointerdown', function (e) {
        if (pointer.id === null) pointer.id = e.pointerId;
        pointer.down = true;
        pointer.active = true;
        pointer.lastX = e.clientX;
        pointer.lastY = e.clientY;
        if (e.pointerType === 'touch') {
          pointer.mode = 'relative';
          pointer.x = player.x;
          pointer.y = player.y;
        } else {
          pointer.mode = 'absolute';
          pointer.x = e.clientX;
          pointer.y = e.clientY;
        }
        if (canvas.setPointerCapture) {
          try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
        }
      });

      window.addEventListener('pointermove', function (e) {
        if (pointer.id !== null && e.pointerId !== pointer.id) return;
        if (e.pointerType === 'touch') {
          if (!pointer.down) return;
          if (pointer.mode !== 'relative') {
            pointer.mode = 'relative';
            pointer.lastX = e.clientX;
            pointer.lastY = e.clientY;
            pointer.x = player.x;
            pointer.y = player.y;
            return;
          }
          var dx = e.clientX - pointer.lastX;
          var dy = e.clientY - pointer.lastY;
          pointer.lastX = e.clientX;
          pointer.lastY = e.clientY;
          pointer.x = clamp(pointer.x + dx * TOUCH_SENS, 0, W);
          pointer.y = clamp(pointer.y + dy * TOUCH_SENS, 0, H);
          pointer.active = true;
        } else {
          pointer.mode = 'absolute';
          pointer.x = e.clientX;
          pointer.y = e.clientY;
          pointer.active = true;
        }
      });

           window.addEventListener('pointerup', function (e) {
        if (e.pointerId === pointer.id) pointer.id = null;
        pointer.down = false;
        if (pointer.mode === 'relative') pointer.active = false;
      });

      /* ---- 手机双击冲刺 ---- */
      var tapT = 0, tapX = 0, tapY = 0, tapDownT = 0;
      canvas.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' || e.isPrimary === false) return;
        tapDownT = performance.now();
        tapX = e.clientX;
        tapY = e.clientY;
      });
      canvas.addEventListener('pointerup', function (e) {
        if (e.pointerType === 'mouse' || e.isPrimary === false) return;
        var now = performance.now();
        if (now - tapDownT > 260) { tapT = 0; return; }
        if (hyp(e.clientX - tapX, e.clientY - tapY) > 18) { tapT = 0; return; }
        if (now - tapT < 340) {
          tapT = 0;
          tryDash();
          if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { } }
        } else {
          tapT = now;
        }
      });
      canvas.addEventListener('pointercancel', function () { tapT = 0; });

      window.addEventListener('pointercancel', function (e) {
        if (e.pointerId === pointer.id) pointer.id = null;
        pointer.down = false;
        if (pointer.mode === 'relative') pointer.active = false;
      });

      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          if (game.mode === 'play') game.paused = true;
          Sound.bgmPause();
        } else if (game.mode === 'play' && !game.paused && !game.upgrading) {
          Sound.bgmResume();
        }
      });

      /* ===== 第 2 段结束 · 请继续粘贴第 3 段 ===== */
      /* ==================== 分数 / 连击 ==================== */
      function addScore(v) {
        var mul = (game.doubleT > 0 ? 2 : 1) * player.mods.scoreMul;
        game.score += v * mul;
      }

      function getMult() {
        return clamp(1 + Math.floor(game.combo / 5), 1, 8);
      }

      function addCombo(n) {
        if (game.mode !== 'play') return;
        var before = getMult();
        game.combo += n;
        game.comboT = COMBO_TIME;
        game.comboPop = 0.18;
        var after = getMult();
        if (after > before) {
          Sound.milestone();
          game.maxMult = Math.max(game.maxMult, after);
          if (after >= 5) unlock('mult5');
        }
      }

      function breakCombo() {
        game.combo = 0;
        game.comboT = 0;
      }

      /* ==================== 局内天赋 ==================== */
      var UPGRADES = [
        {
          id: 'dash', name: '超载引擎', desc: '冲刺冷却 -18%', max: 4, color: '#39f6ff',
          apply: function () { player.mods.dashCdMul *= 0.82; }
        },
        {
          id: 'speed', name: '矢量推进', desc: '移动速度 +10%', max: 4, color: '#5cff9d',
          apply: function () { player.mods.speedMul *= 1.10; }
        },
        {
          id: 'magnet', name: '引力场', desc: '能量球吸附范围 +120', max: 3, color: '#ffcf8a',
          apply: function () { player.mods.magnetR += 120; }
        },
        {
          id: 'alwaysmagnet', name: '永磁核心', desc: '永久开启能量磁铁', max: 1, color: '#ffcf8a',
          apply: function () { player.mods.magnetAlways = true; }
        },
        {
          id: 'shield', name: '应急护盾', desc: '立即获得 1 层护盾', max: 3, color: '#8ef4ff',
          apply: function () { player.shield = Math.min(player.mods.shieldMax, player.shield + 1); }
        },
        {
          id: 'shieldmax', name: '护盾扩容', desc: '护盾上限 +1 并立即获得', max: 2, color: '#8ef4ff',
          apply: function () {
            player.mods.shieldMax += 1;
            player.shield = Math.min(player.mods.shieldMax, player.shield + 1);
          }
        },
        {
          id: 'score', name: '数据复利', desc: '所有得分 +12%', max: 4, color: '#ffd166',
          apply: function () { player.mods.scoreMul *= 1.12; }
        },
        {
          id: 'graze', name: '刀锋边缘', desc: '擦身判定 +8，擦身得分翻倍', max: 3, color: '#ff9ecb',
          apply: function () { player.mods.grazeBand += 8; player.mods.grazeMul *= 2; }
        },
        {
          id: 'dashpd', name: '相位跃迁', desc: '冲刺无敌时间 +50%', max: 2, color: '#a06bff',
          apply: function () { player.mods.dashInvuln *= 1.5; }
        },
        {
          id: 'orbmag', name: '拾取扩容', desc: '拾取判定范围 +30%', max: 2, color: '#5cff9d',
          apply: function () { player.mods.pickupMul *= 1.3; }
        }
      ];

      function availableUpgrades() {
        return UPGRADES.filter(function (u) {
          return (game.upgradeStacks[u.id] || 0) < u.max;
        });
      }

      function pickUpgrades() {
        var pool = availableUpgrades().slice();
        var out = [];
        while (out.length < 3 && pool.length > 0) {
          var i = Math.floor(Math.random() * pool.length);
          out.push(pool.splice(i, 1)[0]);
        }
        return out;
      }

      function openUpgrade() {
        var choices = pickUpgrades();
        if (choices.length === 0) { game.nextUpgrade = game.score + 900; return; }

        game.upgrading = true;
        game.upgradeChoices = choices;

        var wrap = document.getElementById('upCards');
        wrap.innerHTML = '';

        choices.forEach(function (u, i) {
          var b = document.createElement('button');
          b.className = 'up-card';
          var lv = (game.upgradeStacks[u.id] || 0) + 1;

          var num = document.createElement('span');
          num.className = 'up-num';
          num.textContent = '0' + (i + 1);

          var name = document.createElement('span');
          name.className = 'up-name';
          name.textContent = u.name;
          name.style.color = u.color;
          name.style.textShadow = '0 0 14px ' + u.color;

          var desc = document.createElement('span');
          desc.className = 'up-desc';
          desc.textContent = u.desc;

          var stack = document.createElement('span');
          stack.className = 'up-stack';
          stack.textContent = 'Lv.' + lv + ' / ' + u.max;

          b.appendChild(num);
          b.appendChild(name);
          b.appendChild(desc);
          b.appendChild(stack);
          b.addEventListener('click', function () { chooseUpgrade(i); });
          wrap.appendChild(b);
        });

        document.getElementById('upgrade').classList.add('show');
        Sound.levelUp();
      }

      function chooseUpgrade(i) {
        if (!game.upgrading) return;
        var u = game.upgradeChoices[i];
        if (!u) return;

        game.upgradeStacks[u.id] = (game.upgradeStacks[u.id] || 0) + 1;
        u.apply();

        document.getElementById('upgrade').classList.remove('show');
        game.upgrading = false;
        game.upgradeChoices = [];
        game.upgradeLevel += 1;
        game.nextUpgrade = game.score + 550 + game.upgradeLevel * 220;

        Sound.choose();
        toast(u.name + ' Lv.' + game.upgradeStacks[u.id]);
        burst(player.x, player.y, u.color, 26, 300);
        game.flash = Math.max(game.flash, 0.3);

        lastTime = 0;
        updateHUD();
      }

      /* ==================== 实体生成 ==================== */
      function makeShape(r) {
        var n = randInt(8, 12);
        var shape = [];
        for (var i = 0; i < n; i++) {
          shape.push({ a: (i / n) * TAU + rand(-0.12, 0.12), rr: r * rand(0.72, 1.16) });
        }
        return shape;
      }

      function makeMeteor(x, y, r, vx, vy, kind) {
        return {
          x: x, y: y, r: r, hitR: r * 0.84,
          vx: vx, vy: vy,
          rot: rand(0, TAU), rotSpd: rand(-1.5, 1.5),
          shape: makeShape(r),
             color: kind === 'homing' ? '#ff3ea5' : pickThemeMeteor(),
          tier: 0, kind: kind || 'rock', grazeCd: 0, life: 11
        };
      }

      function spawnMeteor() {
        var r = sRand(12, 29);
        var x = sRand(r * 1.4, W - r * 1.4);
        var speed = 155 + Math.min(game.time * 7, 400) + sRand(0, 70);
        meteors.push(makeMeteor(x, -r - 24, r, sRand(-55, 55), speed, 'rock'));
      }

      function spawnMeteorAt(x, y, r, vy, kind) {
        meteors.push(makeMeteor(x, y, r, sRand(-30, 30), vy, kind || 'rock'));
      }

      function spawnHoming() {
        var r = sRand(13, 19);
        var x = sRand(r * 2, W - r * 2);
        var m = makeMeteor(x, -r - 20, r, sRand(-40, 40), 130, 'homing');
        m.life = 10;
        meteors.push(m);
      }

      function spawnShard(x, y, r) {
        var m = makeMeteor(x, y, r, sRand(-170, 170), sRand(-120, 90), 'rock');
        m.tier = 1;
        m.rotSpd = sRand(-3.4, 3.4);
        meteors.push(m);
      }

      function spawnWall() {
        var count = 9;
        var gapX = sRand(W * 0.18, W * 0.82);
        var gapW = W * 0.15;
        var vy = 230 + Math.min(game.time * 5, 220);
        for (var i = 0; i < count; i++) {
          var x = ((i + 0.5) / count) * W;
          if (Math.abs(x - gapX) < gapW) continue;
          spawnMeteorAt(x, sRand(-120, -40), sRand(15, 23), vy, 'rock');
        }
      }

      function spawnStrike() {
        warns.push({ x: sRand(W * 0.1, W * 0.9), t: 0.95, total: 0.95, r: sRand(16, 26) });
      }

      function spawnHole() {
        holes.push({
          x: sRand(W * 0.22, W * 0.78), y: sRand(H * 0.18, H * 0.55),
          r: 74, life: 8.5, maxLife: 8.5, rot: rand(0, TAU), born: 0
        });
      }

      function spawnSat() {
        var fromLeft = Math.random() < 0.5;
        sats.push({
          x: fromLeft ? -40 : W + 40,
          y: sRand(H * 0.12, H * 0.3),
          vx: (fromLeft ? 1 : -1) * sRand(85, 125),
          r: 16, charge: 1.4, fire: 0, cool: 0, shots: 0, rot: 0, leaving: false
        });
      }

      function spawnOrb() {
        orbs.push({ x: sRand(46, W - 46), y: -24, r: 9, vx: 0, vy: sRand(95, 160), ph: rand(0, TAU) });
      }

      function spawnPickup() {
        pickups.push({
          x: sRand(60, W - 60), y: -30, r: 15,
          vy: sRand(75, 110), rot: rand(0, TAU), type: pick(PICKUP_TYPES)
        });
      }

      function burst(x, y, color, count, speed) {
        for (var i = 0; i < count; i++) {
          var ang = rand(0, TAU);
          var sp = speed * rand(0.25, 1);
          particles.push({
            x: x, y: y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            r: rand(1.2, 3.4), life: rand(0.35, 0.85), max: 0.85, color: color
          });
        }
      }

      function banner(text, color) {
        game.banner = text;
        game.bannerColor = color || '#39f6ff';
        game.bannerT = 2.0;
        game.bannerMax = 2.0;
      }

      /* ==================== 陨石破碎 ==================== */
      function destroyMeteor(index, byDash) {
        var m = meteors[index];
            if (!m) return;
        meteors.splice(index, 1);
            game.waveKills += 1;
    game.totalKills = (game.totalKills || 0) + 1;


        burst(m.x, m.y, m.color, 18, 330);
        burst(m.x, m.y, '#ffffff', 6, 190);
        
        var dropN = m.tier === 0 ? randInt(4, 7) : 2;
    for (var d = 0; d < dropN; d++) {
      materials.push({
        x: m.x + rand(-10, 10),
        y: m.y + rand(-10, 10),
                vx: rand(-90, 90),
                vy: rand(-150, -50),
                r: 5,
                life: 12,
        ph: rand(0, TAU)
      });
    }

        if (m.tier === 0 && m.r >= 18) {
          var n = randInt(2, 3);
          for (var k = 0; k < n; k++) {
            spawnShard(m.x + rand(-8, 8), m.y + rand(-8, 8), m.r * rand(0.45, 0.6));
          }
        }

            if (byDash) {
      game.shatters++;
      game.dashKills = (game.dashKills || 0) + 1;
      addCombo(2);
      addScore(45 * getMult());
                    addFloater(m.x, m.y - m.r * 0.6, '+' + Math.round(45 * getMult()), '#ffe9a8', 22);
      addSparks(m.x, m.y, 10, '#ffe9a8');
          game.hitstop = Math.max(game.hitstop, 0.05);
          game.shake = Math.max(game.shake, 9);
          game.flash = Math.max(game.flash, 0.28);
          if (game.shatters >= 20) unlock('shatter20');
        }
        Sound.shatter();
      }

      /* ==================== 玩家更新 ==================== */
            function releaseShockwave(x, y, radius, dmg) {
    shockwaves.push({ x: x, y: y, r: 12, max: radius, life: 0.34, maxLife: 0.34 });

    for (var i = meteors.length - 1; i >= 0; i--) {
      var m = meteors[i];
      var d = hyp(m.x - x, m.y - y);
      if (d < radius + m.r) {
        var ang = Math.atan2(m.y - y, m.x - x);
        m.vx += Math.cos(ang) * 220;
        m.vy += Math.sin(ang) * 220;
        damageMeteor(i, dmg);
      }
    }

    burst(x, y, '#9ff8ff', 18, 330);
    game.shake = Math.max(game.shake, 9);
    Sound.shock();
  }

  function updateShockwaves(dt) {
    for (var i = shockwaves.length - 1; i >= 0; i--) {
      var s = shockwaves[i];
      s.life -= dt;
      if (s.life <= 0) { shockwaves.splice(i, 1); continue; }
      var k = 1 - s.life / s.maxLife;
      s.r = 12 + (s.max - 12) * (1 - Math.pow(1 - k, 2));
    }
  }

  function drawShockwaves() {
    if (!shockwaves.length) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (var i = 0; i < shockwaves.length; i++) {
      var s = shockwaves[i];
      var a = clamp(s.life / s.maxLife, 0, 1);

      ctx.strokeStyle = 'rgba(160,248,255,' + (a * 0.9).toFixed(3) + ')';
      ctx.lineWidth = 3 * a + 1;
      ctx.shadowColor = '#39f6ff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
  }


      function updatePlayer(dt) {
        var p = player;
        var mods = p.mods;

        for (var i = 0; i < holes.length; i++) {
          var h = holes[i];
          var hdx = h.x - p.x, hdy = h.y - p.y;
          var hd = hyp(hdx, hdy) || 1;
          if (hd < 430) {
            var f = (1 - hd / 430) * 1050;
            p.vx += (hdx / hd) * f * dt;
            p.vy += (hdy / hd) * f * dt;
          }
        }

        if (p.dashTime > 0) {
          p.dashTime -= dt;
          var dk = Math.pow(0.15, dt);
          p.vx *= dk;
          p.vy *= dk;
         p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 16) p.trail.shift();

                if (p.dashTime <= 0) {
        p.dashTime = 0;
        releaseShockwave(p.x, p.y, 100, 2);

        if (game.dashKills >= 2) {
          addFloater(player.x, player.y - 34, '×' + game.dashKills, '#ffd166', 22);
          game.flash = Math.max(game.flash, 0.18);
          game.shake = Math.max(game.shake, 12);
        }
      }
    } else {
          if (p.trail.length) p.trail.length = 0;

          var maxSp = MAX_SPEED * mods.speedMul;
          var tx = null, ty = null;
          var kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
          var ky = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);

          if (kx !== 0 || ky !== 0) {
            var l = hyp(kx, ky);
            tx = (kx / l) * maxSp;
            ty = (ky / l) * maxSp;
          } else if (pointer.active) {
            var dx = pointer.x - p.x;
            var dy = pointer.y - p.y;
            var d = hyp(dx, dy);
            if (d > 3) {
              var sp = Math.min(d * 11, maxSp);
              tx = (dx / d) * sp;
              ty = (dy / d) * sp;
            } else { tx = 0; ty = 0; }
          }

          if (tx !== null) {
            var k = 1 - Math.exp(-26 * dt);
            p.vx += (tx - p.vx) * k;
            p.vy += (ty - p.vy) * k;
          } else {
            var kk = 1 - Math.exp(-8 * dt);
            p.vx -= p.vx * kk;
            p.vy -= p.vy * kk;
          }
        }

        var vsp = hyp(p.vx, p.vy);
        var maxNow = 1500 * mods.speedMul;
        if (vsp > maxNow) {
          p.vx = (p.vx / vsp) * maxNow;
          p.vy = (p.vy / vsp) * maxNow;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        var m = 16;
        if (p.x < m) { p.x = m; if (p.vx < 0) p.vx *= -0.25; }
        if (p.x > W - m) { p.x = W - m; if (p.vx > 0) p.vx *= -0.25; }
        if (p.y < m) { p.y = m; if (p.vy < 0) p.vy *= -0.25; }
        if (p.y > H - m) { p.y = H - m; if (p.vy > 0) p.vy *= -0.25; }

        var tiltT = clamp(p.vx / 1500, -0.55, 0.55);
        p.tilt += (tiltT - p.tilt) * Math.min(1, 10 * dt);

        if (p.dashCd > 0) p.dashCd -= dt;
        if (p.invuln > 0) p.invuln -= dt;
      }

      /* ==================== 实体更新 ==================== */
      function updateMeteors(wdt) {
        for (var i = meteors.length - 1; i >= 0; i--) {
          var m = meteors[i];

          if (m.kind === 'homing') {
            var dx = player.x - m.x;
            var dy = player.y - m.y;
            var d = hyp(dx, dy) || 1;
            m.vx += (dx / d) * 300 * wdt;
            m.vy += (dy / d) * 300 * wdt;
            var sp = hyp(m.vx, m.vy);
            var mx = 210 + Math.min(game.time * 2.4, 150);
            if (sp > mx) {
              m.vx = (m.vx / sp) * mx;
              m.vy = (m.vy / sp) * mx;
            }
            m.life -= wdt;
            if (m.life <= 0) {
              burst(m.x, m.y, '#ff3ea5', 12, 220);
              meteors.splice(i, 1);
              continue;
            }
          } else {
            m.vy += 16 * wdt;
          }

          m.x += m.vx * wdt;
          m.y += m.vy * wdt;
          m.rot += m.rotSpd * wdt;
          if (m.grazeCd > 0) m.grazeCd -= wdt;

          if (m.x < m.r) { m.x = m.r; m.vx = Math.abs(m.vx); }
          if (m.x > W - m.r) { m.x = W - m.r; m.vx = -Math.abs(m.vx); }

          if (m.y - m.r > H + 80 || m.y < -H) meteors.splice(i, 1);
        }
      }

      function updateOrbs(wdt, dt) {
        var magnet = game.magnetT > 0 || player.mods.magnetAlways;
        var radius = 320 + player.mods.magnetR;

        for (var i = orbs.length - 1; i >= 0; i--) {
          var o = orbs[i];
          var vx = o.vx || 0;

          o.x += vx * wdt;
          o.y += o.vy * wdt;
          o.ph += dt * 5;
          o.vx = vx * Math.pow(0.25, wdt);

          if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx) * 0.6; }
          if (o.x > W - o.r) { o.x = W - o.r; o.vx = -Math.abs(o.vx) * 0.6; }

          if (magnet) {
            var dx = player.x - o.x;
            var dy = player.y - o.y;
            var d = hyp(dx, dy);
            if (d < radius && d > 1) {
              var pull = 700 * (1 - d / radius) + 180;
              o.x += (dx / d) * pull * dt;
              o.y += (dy / d) * pull * dt;
            }
          }

          if (o.y - o.r > H + 40) orbs.splice(i, 1);
        }
      }

      function updatePickups(wdt) {
        for (var i = pickups.length - 1; i >= 0; i--) {
          var k = pickups[i];
          k.y += k.vy * wdt;
          k.rot += wdt * 1.6;
          if (k.y - k.r > H + 40) pickups.splice(i, 1);
        }
      }

      function updateHoles(wdt) {
        for (var i = holes.length - 1; i >= 0; i--) {
          var h = holes[i];
          h.life -= wdt;
          h.born += wdt;
          h.rot += wdt * 0.9;

          for (var j = orbs.length - 1; j >= 0; j--) {
            var o = orbs[j];
            var dx = h.x - o.x, dy = h.y - o.y;
            var d = hyp(dx, dy) || 1;
            if (d < 320) {
              o.x += (dx / d) * 120 * wdt;
              o.y += (dy / d) * 120 * wdt;
            }
          }

          if (h.life <= 0) holes.splice(i, 1);
        }
      }

      function updateSats(wdt) {
        for (var i = sats.length - 1; i >= 0; i--) {
          var s = sats[i];
          s.x += s.vx * wdt;
          s.rot += wdt * 2.4;

          if (s.x < -60 || s.x > W + 60) { sats.splice(i, 1); continue; }

          if (s.fire > 0) {
            s.fire -= wdt;
          } else if (s.cool > 0) {
            s.cool -= wdt;
          } else {
            s.charge -= wdt;
            if (s.charge <= 0) {
              s.fire = 0.45;
              s.cool = 1.5;
              s.charge = 1.4;
              s.shots++;
              Sound.laserFire();
              if (s.shots >= 3) s.leaving = true;
            }
          }

          if (s.leaving) s.vx *= 1.005;
        }
      }

      function updateWarns(wdt) {
        for (var i = warns.length - 1; i >= 0; i--) {
          var w = warns[i];
          w.t -= wdt;
          if (w.t <= 0) {
            spawnMeteorAt(w.x, -w.r - 20, w.r, 1050, 'rock');
            burst(w.x, w.r * 0.5, '#ff8a3d', 16, 300);
            warns.splice(i, 1);
          }
        }
      }

      function updateParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
          var pt = particles[i];
          pt.life -= dt;
          if (pt.life <= 0) { particles.splice(i, 1); continue; }
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          var drag = Math.pow(0.04, dt);
          pt.vx *= drag;
          pt.vy *= drag;
        }
      }




             /* ==================== Boss ==================== */

  var BOSS_KINDS = ['mother', 'twin', 'gravity', 'final'];

    function bossKindByChapter() {
    return BOSS_KINDS[themeIndex() - 1];
  }


  function bossColor(b) {
    if (b.kind === 'twin') return '#ffd166';
    if (b.kind === 'gravity') return '#a06bff';
    if (b.kind === 'final') return '#ff3e6c';
    return '#ff5c8a';
  }

  function bossName(kind) {
    if (kind === 'twin') return '双核母体';
    if (kind === 'gravity') return '引力核心';
    if (kind === 'final') return '终焉';
    return '陨石母体';
  }

  function bossCorePos(b) {
    if (b.kind === 'twin') {
      return { x: b.x + b.coreSide * b.r * 0.42, y: b.y };
    }
    return { x: b.x, y: b.y };
  }

  function spawnBoss() {
    var kind = bossKindByChapter();

    var hp = (kind === 'final') ? 120 : 60;    var hp = 5;
    if (kind === 'twin') hp = 4;
    else if (kind === 'gravity') hp = 6;
    else if (kind === 'final') hp = 9;

    var loop = Math.floor((game.chapter - 1) / 4);
    hp += loop * 2;

       var r = ((kind === 'final') ? 70 : 62) + Math.min(16, loop * 4);

    game.boss = {
          kind: kind,
      loop: loop,
      x: W * 0.5,
      y: -110,
      targetY: Math.min(150, H * 0.22),
      r: r,
      hp: hp,
      maxHp: hp,
      ghost: hp,
      phase: 1,
      maxPhase: (kind === 'final') ? 3 : 1,
      coreSide: 1,
      vx: sRand(70, 110) * (Math.random() < 0.5 ? 1 : -1),
      open: false,
      stateT: 3.0,
      spawnT: 2.2,
      hurtT: 0,
      rot: 0,
      bob: 0,
      entered: false
    };

        banner(bossName(kind) + (loop > 0 ? ' · 强化 ' + loop : ''), '#ff5c8a');
    Sound.bossWarn();
    game.shake = Math.max(game.shake, 10);
    glitch(1.2, 0.45);
  }

  function updateBoss(wdt) {
    var b = game.boss;
    if (!b) return;

    b.rot += wdt * 0.45;
    b.bob += wdt * 1.6;

    if (!b.entered) {
      b.y += (b.targetY - b.y) * Math.min(1, 2.0 * wdt);
      if (Math.abs(b.y - b.targetY) < 2.5) { b.y = b.targetY; b.entered = true; }
    } else {
      var spd = (b.kind === 'twin') ? 1.6 : 1;
      b.x += b.vx * spd * wdt;
      if (b.x < b.r + 24) { b.x = b.r + 24; b.vx = Math.abs(b.vx); }
      if (b.x > W - b.r - 24) { b.x = W - b.r - 24; b.vx = -Math.abs(b.vx); }
    }

    if (b.hurtT > 0) b.hurtT -= wdt;
    if (b.ghost > b.hp) b.ghost = Math.max(b.hp, b.ghost - wdt * 1.8);

    if (b.kind === 'gravity' && b.entered) {
      var dx = b.x - player.x;
      var dy = b.y - player.y;
      var d = hyp(dx, dy) || 1;
      if (d < 720) {
        var ratio = 1 - b.hp / b.maxHp;
        var f = 280 + 420 * ratio;
        player.vx += (dx / d) * f * wdt;
        player.vy += (dy / d) * f * wdt;
      }
    }

    b.stateT -= wdt;
    if (b.stateT <= 0) {
      if (b.open) {
        b.open = false;
        b.stateT = (b.kind === 'gravity') ? 1.5 : 3.4;
        if (b.kind === 'twin') b.coreSide = -b.coreSide;
      } else {
        b.open = true;
        b.stateT = (b.kind === 'gravity') ? 3.2 : 2.4;
        Sound.bossOpen();
      }
    }

    b.spawnT -= wdt;
    if (b.spawnT <= 0) {
      if (b.kind === 'mother') {
        b.spawnT = 2.3;
        spawnMeteorAt(b.x + sRand(-46, 46), b.y + b.r * 0.5, sRand(12, 19), sRand(170, 250), 'rock');
      } else if (b.kind === 'twin') {
        b.spawnT = 3.0;
        spawnMeteorAt(b.x + sRand(-30, 30), b.y + b.r * 0.5, sRand(11, 17), sRand(190, 260), 'rock');
      } else if (b.kind === 'gravity') {
        b.spawnT = 3.4;
        spawnStrike();
        spawnStrike();
      } else if (b.kind === 'final') {
        if (b.phase === 1) {
          b.spawnT = 2.0;
          spawnMeteorAt(b.x + sRand(-60, 60), b.y + b.r * 0.5, sRand(12, 18), sRand(200, 280), 'rock');
        } else if (b.phase === 2) {
          b.spawnT = 2.4;
          spawnHoming();
          spawnHoming();
        } else {
          b.spawnT = 2.8;
          spawnWall();
        }
      }
    }
  }

  function hitBoss() {
    var b = game.boss;
    if (!b || b.hurtT > 0) return;

    var dmg = 1;

    if (game.debugBossOneShot) {
      if (b.kind === 'final') {
        var per = b.maxHp / 3;
        var nextThreshold = Math.max(0, Math.ceil(b.hp / per) * per - per);
        dmg = Math.max(1, b.hp - nextThreshold);
      } else {
        dmg = 999;
      }
    }

    b.hp -= dmg;

    b.hurtT = 1.0;
    b.open = false;
    b.stateT = 2.6;

    game.hitstop = Math.max(game.hitstop, 0.1);
    game.shake = 22;
    game.flash = 0.6;
    addScore(320);
    addCombo(3);
    burst(b.x, b.y, '#ffd166', 34, 460);
    burst(b.x, b.y, '#ffffff', 16, 260);
    Sound.bossHit();
    glitch(0.9, 0.3);

    if (b.hp <= 0) { bossDefeat(); return; }

    if (b.kind === 'final') {
      var ph = Math.min(3, 1 + Math.floor((1 - b.hp / b.maxHp) * 3));
      if (ph !== b.phase) {
        b.phase = ph;
        banner('第 ' + ph + ' 阶 段', ph >= 3 ? '#ff3e6c' : '#ffd166');
        game.shake = 26;
        game.flash = 0.8;
        glitch(1.2, 0.4);
        Sound.bossWarn();
      }
    }
  }

  function dropLoot(x, y) {
    for (var i = 0; i < 14; i++) {
      var a = rand(0, TAU);
      var sp = rand(150, 340);
      orbs.push({
        x: x + rand(-12, 12),
        y: y + rand(-12, 12),
        r: 9,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.45 + rand(60, 130),
        ph: rand(0, TAU)
      });
    }
    pickups.push({ x: x - 58, y: y, r: 15, vy: 95, rot: 0, type: 'shield' });
    pickups.push({ x: x + 58, y: y, r: 15, vy: 95, rot: 0, type: 'shield' });
  }

  function bossDefeat() {
    var b = game.boss;
    if (!b) return;

    burst(b.x, b.y, '#ff5c8a', 60, 620);
    burst(b.x, b.y, '#ffd166', 40, 420);
    burst(b.x, b.y, '#ffffff', 26, 300);
    game.shake = 32;
    game.flash = 1;
    game.hitstop = Math.max(game.hitstop, 0.18);
    addScore(1500);
    unlock('boss1');
    Sound.bossDie();
    glitch(1.5, 0.6);

    for (var i = meteors.length - 1; i >= 0; i--) {
      burst(meteors[i].x, meteors[i].y, meteors[i].color, 6, 220);
      meteors.splice(i, 1);
    }

    dropLoot(b.x, b.y);
    game.mat += 25;
    banner(bossName(b.kind) + ' 瓦 解　+25 材 料', '#ffd166');
    game.boss = null;
  }


      /* ==================== 事件调度 ==================== */
      function beginEvent() {
        var pool = ['rain', 'homing', 'swarm'];
        if (game.time > 25) pool.push('blackhole');
        if (game.time > 40) pool.push('laser');
        if (game.time > 30) pool.push('strike');

        var type = sPick(pool);
        if (type === game.eventType && pool.length > 1) type = sPick(pool);

        game.eventType = type;
        game.phase = 'event';
        game.eventElapsed = 0;
        game.eventFired = 0;
        game.rainT = 0;

        if (type === 'rain') { game.phaseT = 6.5; banner('陨 石 雨', '#ff8a3d'); }
        else if (type === 'homing') { game.phaseT = 7.0; banner('追 踪 陨 石', '#ff3ea5'); }
        else if (type === 'swarm') { game.phaseT = 5.8; banner('陨 石 墙', '#a06bff'); }
        else if (type === 'blackhole') { game.phaseT = 6.0; banner('引 力 坍 缩', '#8f8fff'); spawnHole(); }
        else if (type === 'laser') { game.phaseT = 8.0; banner('激 光 卫 星', '#ff5c8a'); }
        else if (type === 'strike') { game.phaseT = 6.0; banner('陨 石 坠 击', '#ff8a3d'); }
      }

      function updateEvent(wdt) {
        game.eventElapsed += wdt;
        var t = game.eventType;

        if (t === 'rain') {
          game.rainT -= wdt;
          if (game.rainT <= 0) { game.rainT = 0.13; spawnMeteor(); }
        } else if (t === 'homing') {
          if (game.eventFired < 4 && game.eventElapsed > game.eventFired * 0.9) {
            game.eventFired++;
            spawnHoming();
          }
        } else if (t === 'swarm') {
          if (game.eventFired === 0 && game.eventElapsed > 0.3) { game.eventFired = 1; spawnWall(); }
          else if (game.eventFired === 1 && game.eventElapsed > 2.8) { game.eventFired = 2; spawnWall(); }
        } else if (t === 'laser') {
          if (game.eventFired === 0 && game.eventElapsed > 0.4) { game.eventFired = 1; spawnSat(); Sound.laserCharge(); }
          else if (game.eventFired === 1 && game.eventElapsed > 3.6) { game.eventFired = 2; spawnSat(); Sound.laserCharge(); }
        } else if (t === 'strike') {
          if (game.eventElapsed > game.eventFired * 0.8 && game.eventFired < 5) {
            game.eventFired++;
            spawnStrike();
          }
        }
      }

      function director(wdt) {
        if (!game.boss && game.time > game.nextBoss) {
          spawnBoss();
          game.nextBoss = game.time + 80;
          return;
        }
        if (game.boss) return;

        game.phaseT -= wdt;
        if (game.phaseT <= 0) {
          if (game.phase === 'calm') {
            beginEvent();
          } else {
            game.phase = 'calm';
            game.eventType = '';
            game.phaseT = rand(3.4, 5.0);
          }
        }

        if (game.phase === 'event') updateEvent(wdt);

        game.spawnT -= wdt;
        if (game.spawnT <= 0) {
          spawnMeteor();
          if (game.time > 20 && Math.random() < 0.28) spawnMeteor();
          var rate = Math.max(0.22, 0.95 - game.time * 0.011);
          game.spawnT = rate * rand(0.75, 1.3) * (game.phase === 'event' ? 0.65 : 1);
        }

        game.orbT -= wdt;
        if (game.orbT <= 0) { spawnOrb(); game.orbT = rand(2.0, 3.4); }

        game.powerT -= wdt;
        if (game.powerT <= 0) { spawnPickup(); game.powerT = rand(9.5, 15); }
      }
          /* ==================== 武器表 ==================== */

  var WEAPON_DEFS = {
    pulse: {
      name: '脉冲炮', color: '#39f6ff', range: 430, interval: 0.42,
      dmg: 2, speed: 780, desc: '均衡的中距离主武器'
    },
    shotgun: {
      name: '霰弹枪', color: '#ffd166', range: 215, interval: 0.78,
      dmg: 3, speed: 720, pellets: 5, spread: 0.55, desc: '贴脸爆发，5 发散射'
    },
    arc: {
      name: '电弧', color: '#a06bff', range: 195, interval: 0.60,
      dmg: 2, speed: 0, chain: 3, desc: '链式闪电，扎进怪堆才有效'
    },
    laser: {
      name: '激光', color: '#ff5c8a', range: 520, interval: 1.15,
      dmg: 9, speed: 2200, pierce: 3, desc: '高速穿透，射速很慢'
    }
  };

  var WEAPON_KEYS = ['pulse', 'shotgun', 'arc', 'laser'];
  var MAX_SLOTS = 4;
  var arcFx = [];

  function wStat(w) {
    var d = WEAPON_DEFS[w.type] || WEAPON_DEFS.pulse;
    var lv = w.lv || 1;
    return {
      name: d.name,
      color: d.color,
      range: d.range * (1 + 0.06 * (lv - 1)),
      interval: d.interval * Math.pow(0.9, lv - 1),
      dmg: d.dmg * (1 + 0.45 * (lv - 1)),
      speed: d.speed,
      pellets: d.pellets || 1,
      spread: d.spread || 0,
      chain: d.chain || 0,
      pierce: d.pierce || 0
    };
  }

  function hasWeapon(type) {
    for (var i = 0; i < player.weapons.length; i++) {
      if (player.weapons[i].type === type) return true;
    }
    return false;
  }

  function initWeapons() {
    player.weapons = [ { type: 'pulse', lv: 1 } ];
  }

  function findTarget(x, y, range, exclude) {
    var best = null;
    var bestD = range * range;
    for (var i = 0; i < meteors.length; i++) {
      var m = meteors[i];
      if (m.y < -30 || m.y > H + 40) continue;
      if (exclude && exclude.indexOf(m) >= 0) continue;
      var d = dist2(m.x, m.y, x, y);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  function spawnBullet(x, y, ang, speed, dmg, opts) {
    opts = opts || {};
    var b = bulletPool.pop();
    if (!b) b = { x: 0, y: 0, vx: 0, vy: 0, r: 3.2, dmg: 1, life: 0, pierce: 0, hits: [], color: '#39f6ff' };
    b.x = x;
    b.y = y;
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed;
    b.dmg = dmg;
    b.life = 1.6;
    b.r = opts.r || 3.2;
    b.color = opts.color || '#39f6ff';
    b.pierce = opts.pierce || 0;
    b.hits.length = 0;
    bullets.push(b);
  }

  function fireArc(st) {
    var p = player;
    var used = [];
    var from = { x: p.x, y: p.y };

    for (var n = 0; n < st.chain; n++) {
      var t = findTarget(from.x, from.y, n === 0 ? st.range : 150, used);
      if (!t) break;
      used.push(t);
      arcFx.push({
        x1: from.x, y1: from.y,
        x2: t.x, y2: t.y,
        until: performance.now() + 140
      });
      from = t;
    }

    for (var i = 0; i < used.length; i++) {
      var idx = meteors.indexOf(used[i]);
      if (idx >= 0) damageMeteor(idx, st.dmg);
    }

    if (arcFx.length > 60) arcFx.splice(0, arcFx.length - 60);
  }

      function updateWeapons(dt) {
    if (game.debugNoAttack) return;
    var p = player;
    if (!p.weapons) return;

    for (var i = 0; i < p.weapons.length; i++) {
      var w = p.weapons[i];
      var st = wStat(w);

      w.cd = (w.cd || 0) - dt;
      if (w.cd > 0) continue;

      if (w.type === 'arc') {
        var t0 = findTarget(p.x, p.y, st.range);
        if (!t0) continue;
        w.cd = st.interval;
                fireArc(st);
        Sound.shoot('arc');
        continue;
      }

      var t = findTarget(p.x, p.y, st.range);
      if (!t) continue;

      w.cd = st.interval;
      var ang = Math.atan2(t.y - p.y, t.x - p.x);

      if (w.type === 'shotgun') {
        for (var k = 0; k < st.pellets; k++) {
          var off = (k - (st.pellets - 1) / 2) * (st.spread / st.pellets);
          spawnBullet(p.x, p.y - 8, ang + off, st.speed, st.dmg, { r: 2.6, color: st.color });
        }
      } else if (w.type === 'laser') {
        spawnBullet(p.x, p.y - 10, ang, st.speed, st.dmg, { r: 2.2, color: st.color, pierce: st.pierce });
      } else {
              spawnBullet(p.x, p.y - 10, ang, st.speed, st.dmg, { r: 3.4, color: st.color });
      }

      Sound.shoot(w.type);

    }
  }

  function updateBullets(dt) {
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      if (b.life <= 0 || b.x < -60 || b.x > W + 60 || b.y < -60 || b.y > H + 60) {
        bullets.splice(i, 1);
        bulletPool.push(b);
        continue;
      }

      var gone = false;
      for (var j = meteors.length - 1; j >= 0; j--) {
        var m = meteors[j];
        if (b.hits.indexOf(m) >= 0) continue;
        var rr = m.hitR + b.r;
        if (dist2(m.x, m.y, b.x, b.y) < rr * rr) {
          b.hits.push(m);
          damageMeteor(j, b.dmg);
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            bullets.splice(i, 1);
            bulletPool.push(b);
            gone = true;
          }
          break;
        }
      }
      if (gone) continue;
    }
  }

    function damageMeteor(index, dmg) {
    var m = meteors[index];
    if (!m) return;

    dmg = dmg * (game.debugDmgMul || 1);
    if (m.hp === undefined) {
      m.maxHp = Math.max(1, Math.round(m.r / 6)) +
                (m.kind === 'homing' ? 2 : 0) +
                Math.floor(game.wave / 6);
      m.hp = m.maxHp;
    }

        m.hp -= (game.debugOneShot ? 9999 : dmg);
          m.flashUntil = performance.now() + 110;
    burst(m.x, m.y, '#ffffff', 5, 140);
    addSparks(m.x, m.y, 5, '#ffffff');
        if (dmg >= 5) {
      addFloater(m.x, m.y - m.r * 0.5, String(Math.round(dmg)), '#dff6ff', 13);
    }
        if (m.hp <= 0) {
                addFloater(m.x, m.y - m.r * 0.6, '+' + Math.round(14 * getMult()), '#ffd166', 18);
      addSparks(m.x, m.y, 9, '#ffd166');
      addScore(14 * getMult());
      addCombo(1);
      destroyMeteor(index, false);
    }
  }

  function updateMaterials(wdt, dt) {
    var magnet = game.magnetT > 0 || player.mods.magnetAlways;

    for (var i = materials.length - 1; i >= 0; i--) {
      var s = materials[i];

      s.vy += 105 * wdt;
      s.vx *= Math.pow(0.4, wdt);
      s.x += s.vx * wdt;
      s.y += s.vy * wdt;
      s.life -= wdt;
      s.ph += dt * 8;

      if (s.x < 6) { s.x = 6; s.vx = Math.abs(s.vx) * 0.5; }
      if (s.x > W - 6) { s.x = W - 6; s.vx = -Math.abs(s.vx) * 0.5; }

      if (magnet) {
        var dx = player.x - s.x;
        var dy = player.y - s.y;
        var d = hyp(dx, dy);
        if (d < 300 && d > 1) {
          s.x += (dx / d) * 520 * dt;
          s.y += (dy / d) * 520 * dt;
        }
      }

          var rr = s.r + player.r + 22;
      if (dist2(s.x, s.y, player.x, player.y) < rr * rr) {
        materials.splice(i, 1);
        game.mat += 1;
        addCombo(1);
        addScore(4);
        burst(s.x, s.y, '#7fffd4', 6, 120);
        continue;
      }

      if (s.life <= 0 || s.y > H + 50) materials.splice(i, 1);
    }
  }
      function drawHitboxes() {
    if (!game.debugHitbox) return;

    ctx.save();
    ctx.lineWidth = 1;

    ctx.strokeStyle = 'rgba(57,246,255,0.9)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, TAU);
    ctx.stroke();

    for (var i = 0; i < meteors.length; i++) {
      var m = meteors[i];
      var hitR = m.hitR + player.r * 0.7;

      ctx.strokeStyle = 'rgba(255,70,90,0.85)';
      ctx.beginPath();
      ctx.arc(m.x, m.y, hitR, 0, TAU);
      ctx.stroke();

      var gr = hitR + GRAZE_BAND + player.mods.grazeBand;
      ctx.strokeStyle = 'rgba(255,209,102,0.30)';
      ctx.beginPath();
      ctx.arc(m.x, m.y, gr, 0, TAU);
      ctx.stroke();
    }

    if (game.boss) {
      var c = bossCorePos(game.boss);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, game.boss.r * 0.58, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();
  }
      /* ==================== 飘字 & 火花 ==================== */

  function addFloater(x, y, text, color, size) {
    floaters.push({
      x: x + rand(-8, 8),
      y: y,
      text: text,
      color: color || '#ffffff',
      size: size || 13,
      vy: -70,
      life: 0.75,
      maxLife: 0.75
    });
    if (floaters.length > 50) floaters.shift();
  }

  function updateFloaters(dt) {
    for (var i = floaters.length - 1; i >= 0; i--) {
      var f = floaters[i];
      f.life -= dt;
      if (f.life <= 0) { floaters.splice(i, 1); continue; }
      f.y += f.vy * dt;
      f.vy *= Math.pow(0.2, dt);
    }
  }

  function drawFloaters() {
    if (!floaters.length) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (var i = 0; i < floaters.length; i++) {
      var f = floaters[i];
      var k = f.life / f.maxLife;
      var alpha = k > 0.7 ? 1 : k / 0.7;
      var scale = 1 + (1 - k) * 0.25;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 8;
      ctx.font = '700 ' + (f.size * scale).toFixed(1) + 'px -apple-system,"PingFang SC",sans-serif';
      ctx.fillText(f.text, f.x, f.y);
    }

    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  function addSparks(x, y, n, color) {
    for (var i = 0; i < n; i++) {
      sparks.push({
        x: x,
        y: y,
        a: rand(0, TAU),
        len: rand(10, 24),
        life: 0.16,
        maxLife: 0.16,
        color: color || '#ffffff'
      });
    }
    if (sparks.length > 140) sparks.splice(0, sparks.length - 140);
  }

  function updateSparks(dt) {
    for (var i = sparks.length - 1; i >= 0; i--) {
      sparks[i].life -= dt;
      if (sparks[i].life <= 0) sparks.splice(i, 1);
    }
  }

  function drawSparks() {
    if (!sparks.length) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.7;

    for (var i = 0; i < sparks.length; i++) {
      var s = sparks[i];
      var k = 1 - s.life / s.maxLife;
      var alpha = 1 - k;
      var r0 = s.len * 0.25 * k;
      var r1 = s.len * (0.35 + k);

      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(s.x + Math.cos(s.a) * r0, s.y + Math.sin(s.a) * r0);
      ctx.lineTo(s.x + Math.cos(s.a) * r1, s.y + Math.sin(s.a) * r1);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawBullets() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];

      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    var now = performance.now();
    for (var a = arcFx.length - 1; a >= 0; a--) {
      var fx = arcFx[a];
      if (now > fx.until) { arcFx.splice(a, 1); continue; }

      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#c9a6ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#a06bff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(fx.x1, fx.y1);

      var seg = 3;
      for (var s2 = 1; s2 <= seg; s2++) {
        var tx = fx.x1 + (fx.x2 - fx.x1) * (s2 / seg);
        var ty = fx.y1 + (fx.y2 - fx.y1) * (s2 / seg);
        if (s2 < seg) {
          tx += rand(-7, 7);
          ty += rand(-7, 7);
        }
        ctx.lineTo(tx, ty);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawMaterials() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < materials.length; i++) {
      var s = materials[i];
      var a = clamp(s.life / 1.5, 0, 1);
      var sc = 1 + Math.sin(s.ph) * 0.18;

      ctx.globalAlpha = a;
      ctx.fillStyle = '#9dffe4';
      ctx.shadowColor = '#5cff9d';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.r * sc);
      ctx.lineTo(s.x + s.r * sc, s.y);
      ctx.lineTo(s.x, s.y + s.r * sc);
      ctx.lineTo(s.x - s.r * sc, s.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ==================== 波次系统 ==================== */
      var CHAPTERS = [
    {
      name: '近地轨道', accent: '#39f6ff',
      sky: ['#050912', '#070a16', '#0c0718'],
      meteor: ['#39f6ff', '#5cff9d', '#7fbfff', '#a06bff']
    },
    {
      name: '小行星带', accent: '#ff8a3d',
      sky: ['#140a05', '#1a0d07', '#1f100a'],
      meteor: ['#ff8a3d', '#ffd166', '#ff5c8a', '#ffb347']
    },
    {
      name: '引力深渊', accent: '#a06bff',
      sky: ['#0a0616', '#120a22', '#18092c'],
      meteor: ['#a06bff', '#7f7fff', '#c78bff', '#ff5cf0']
    },
    {
      name: '离子风暴', accent: '#ff3e6c',
      sky: ['#170409', '#1e050b', '#26060e'],
      meteor: ['#ff3e6c', '#ff5c8a', '#ff9ecb', '#ffd166']
    }
  ];

    function chapterTheme() {
    return CHAPTERS[themeIndex() - 1];
  }


  function pickThemeMeteor() {
    var th = chapterTheme();
    return th.meteor[(Math.random() * th.meteor.length) | 0];
  }

    function onChapterChange(ch) {
    var th = CHAPTERS[(ch - 1) % CHAPTERS.length];
    game.whiteFlash = 1;
    glitch(1.3, 0.5);
    banner('第 ' + ch + ' 章 · ' + th.name, th.accent);
    buildBg();
    Sound.bgmStart(ch - 1);
  }


  var WAVE_TIME = 22;

    function waveChapter(w) {
    return Math.floor((w - 1) / 4) + 1;
  }

  function themeIndex() {
    return ((game.chapter - 1) % CHAPTERS.length) + 1;
  }


        function gradeColor(g) {
    if (g === 'S') return '#ffd166';
    if (g === 'A') return '#5cff9d';
    if (g === 'B') return '#39f6ff';
    return '#ff8a3d';
  }

  function waveGrade() {
    var pts = 0;
    if (game.waveKills >= game.waveGoal) pts += 1;
    if (game.waveKills >= Math.ceil(game.waveGoal * 1.5)) pts += 1;
    if (!game.waveDamaged) pts += 1;

    if (pts >= 3) return 'S';
    if (pts >= 2) return 'A';
    if (pts >= 1) return 'B';
    return 'C';
  }

  function startWave() {
    game.wave += 1;
    game.waveState = 'battle';

    var newCh = waveChapter(game.wave);
    var changed = (newCh !== game.chapter);
    game.chapter = newCh;

        game.waveT = WAVE_TIME;
    game.waveSpawned = 0;
    game.waveKills = 0;
    game.waveDamaged = false;
    game.waveIsBoss = (game.wave % 4 === 0);
    game.bossSpawned = false;
    game.spawnT = 0.6;

    game.waveBudget = Math.min(84, Math.round((14 + game.wave * 4) * (1 + game.threatBonus)));
    game.waveGoal = Math.ceil(game.waveBudget * 0.6);

    player.invuln = Math.max(player.invuln, 1.0);

    if (changed) onChapterChange(newCh);

    if (game.waveIsBoss) {
      game.waveT = 999;
      game.waveGoal = 0;
      spawnBoss();
      game.bossSpawned = true;
    } else if (!changed) {
      banner('第 ' + game.wave + ' 波', chapterTheme().accent);
    }
  }

        function endWave() {
    if (game.waveState !== 'battle') return;

    game.waveState = 'shop';
    game.lastWave = game.wave;
    game.lastGrade = '';
    game.lastGain = 0;

    for (var i = meteors.length - 1; i >= 0; i--) {
      burst(meteors[i].x, meteors[i].y, meteors[i].color, 5, 220);
      meteors.splice(i, 1);
    }
    for (var j = warns.length - 1; j >= 0; j--) warns.splice(j, 1);

    if (game.wave === 16 && !game.cleared) {
      game.cleared = true;
      addScore(3000);
      unlock('clear');
      Sound.levelUp();

      if (materials.length > 0) {
        game.mat += materials.length;
        materials.length = 0;
      }

      showVictory();
      return;
    } else if (game.waveIsBoss) {
      var bg = game.waveDamaged ? 'A' : 'S';
      game.lastGrade = bg;
      banner('B O S S 击 破 · ' + bg, gradeColor(bg));
      if (bg === 'S') Sound.milestone();
    } else {
      game.mat += 8;

      var g = waveGrade();
      var gBonus = (g === 'S') ? 12 : (g === 'A' ? 8 : (g === 'B' ? 4 : 0));
      game.mat += gBonus;

      game.lastGrade = g;
      game.lastGain = 8 + gBonus;

      banner(
        '第 ' + game.wave + ' 波 · ' + g +
        (gBonus > 0 ? '　+' + (8 + gBonus) + ' 材料' : ''),
        gradeColor(g)
      );

      if (g === 'C') game.threatBonus = Math.min(1.5, game.threatBonus + 0.12);
      if (g === 'S') Sound.milestone();
    }

    if (materials.length > 0) {
      game.mat += materials.length;
      burst(player.x, player.y, '#7fffd4', 12, 200);
      materials.length = 0;
    }

    game.shopDelay = 0.9;
  }



  function spawnWaveEnemy() {
    var ch = game.chapter;
    var r = Math.random();

    if (ch >= 4 && r < 0.12 && sats.length < 2) { spawnSat(); return; }
    if (ch >= 3 && r < 0.20 && holes.length === 0) { spawnHole(); return; }
    if (ch >= 2 && r < 0.34) { spawnWall(); return; }
    if (ch >= 2 && r < 0.46) { spawnStrike(); return; }
    if (ch >= 1 && r < 0.60) { spawnHoming(); return; }

    spawnMeteor();
  }

      function waveDirector(wdt) {
    if (game.mode !== 'play') return;

    if (game.shopDelay > 0) {
      game.shopDelay -= wdt;
      if (game.shopDelay <= 0) {
        game.shopDelay = 0;
        openShop();
      }
      return;
    }

    if (game.waveState !== 'battle') return;


    if (game.waveIsBoss) {
      if (game.bossSpawned && !game.boss) { endWave(); return; }
      if (game.boss) {
        game.spawnT -= wdt;
        if (game.spawnT <= 0) {
          game.spawnT = 1.6;
          spawnMeteor();
        }
      }
      return;
    }

    game.waveT -= wdt;
    if (game.waveT <= 0) { endWave(); return; }

    if (game.waveSpawned < game.waveBudget) {
      game.spawnT -= wdt;
      if (game.spawnT <= 0) {
        game.waveSpawned += 1;
        spawnWaveEnemy();
        var base = WAVE_TIME / Math.max(1, game.waveBudget);
        game.spawnT = Math.max(0.13, base) * rand(0.8, 1.25);
      }
    }

    game.orbT -= wdt;
    if (game.orbT <= 0) { spawnOrb(); game.orbT = rand(2.0, 3.4); }

    game.powerT -= wdt;
    if (game.powerT <= 0) { spawnPickup(); game.powerT = rand(9.5, 15); }
  }

  function drawWaveHUD() {
    if (game.mode !== 'play') return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (game.waveState === 'battle') {
      var label = '第 ' + game.wave + ' 波 · 第 ' + game.chapter + ' 章';
      if (!game.waveIsBoss) {
        label += '　击杀 ' + game.waveKills + ' / ' + game.waveGoal;
      }
      ctx.fillStyle = 'rgba(200,235,250,0.75)';
      ctx.font = '700 13px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(label, W / 2, H - 58);

      if (!game.waveIsBoss) {
        var p = clamp(game.waveT / WAVE_TIME, 0, 1);
        var bw = Math.min(240, W * 0.42);
        var bx = W / 2 - bw / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(bx, H - 46, bw, 3);
        ctx.fillStyle = 'rgba(57,246,255,0.85)';
        ctx.fillRect(bx, H - 46, bw * p, 3);
      }
    }

    var ws = player.weapons || [];
    var startX = W / 2 - (MAX_SLOTS * 26) / 2 + 13;
    for (var k = 0; k < MAX_SLOTS; k++) {
      var cx = startX + k * 26;
      var cy = H - 80;

      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, TAU);

      var w = ws[k];
      if (w) {
        var d = WEAPON_DEFS[w.type];
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = d.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#04060d';
        ctx.font = '700 9px -apple-system,sans-serif';
        ctx.fillText(String(w.lv || 1), cx, cy + 0.5);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /* ==================== 商店 ==================== */

  function buildOffers() {
    var pool = [];
    var wave = game.wave;

    if (player.weapons.length < MAX_SLOTS) {
      var avail = [];
      for (var i = 0; i < WEAPON_KEYS.length; i++) {
        if (!hasWeapon(WEAPON_KEYS[i])) avail.push(WEAPON_KEYS[i]);
      }
      if (avail.length) {
        var t = pick(avail);
        var d = WEAPON_DEFS[t];
        pool.push({
          kind: 'weapon', type: t,
          name: '新武器 · ' + d.name,
          desc: d.desc,
          color: d.color,
          price: 22 + wave * 2
        });
      }
    }

    for (var k = 0; k < player.weapons.length; k++) {
      var w = player.weapons[k];
      var lv = w.lv || 1;
      if (lv >= 5) continue;
      var dd = WEAPON_DEFS[w.type];
      pool.push({
        kind: 'upgrade', slot: k,
        name: dd.name + ' 强化',
        desc: 'Lv.' + lv + ' → Lv.' + (lv + 1) + '　伤害 +45%',
        color: dd.color,
        price: 16 + wave * 2 + lv * 4
      });
    }

       pool.push({ kind: 'shield', name: '应急护盾', desc: '立即获得 1 层护盾', color: '#8ef4ff', price: 12 + wave });
    pool.push({ kind: 'speed', name: '矢量推进', desc: '移动速度 +8%', color: '#5cff9d', price: 14 + wave });
    pool.push({ kind: 'magnet', name: '引力场', desc: '材料吸附范围 +100', color: '#ffcf8a', price: 12 + wave });
    pool.push({ kind: 'graze', name: '刀锋边缘', desc: '擦身得分 ×1.5', color: '#ff9ecb', price: 15 + wave });
    pool.push({ kind: 'shieldmax', name: '护盾扩容', desc: '护盾上限 +1', color: '#8ef4ff', price: 20 + wave * 2 });

    var out = [];
    var copy = pool.slice();
    while (out.length < 3 && copy.length > 0) {
      var idx = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  }

      function openShop() {
    if (game.debugSkipShop) {
      startWave();
      return;
    }

    if (!game.freeWeaponGiven && player.weapons.length < MAX_SLOTS) {
      game.freeWeaponGiven = true;

      var freePool = [];
      for (var fi = 0; fi < WEAPON_KEYS.length; fi++) {
        if (!hasWeapon(WEAPON_KEYS[fi])) freePool.push(WEAPON_KEYS[fi]);
      }

      if (freePool.length > 0) {
        var ft = pick(freePool);
        player.weapons.push({ type: ft, lv: 1 });
        toast('首战补给 · ' + WEAPON_DEFS[ft].name);
        Sound.choose();
      }
    }


    game.shopOpen = true;
    game.shopOffers = buildOffers();
    renderShop();
    Sound.choose();
  }

  function renderShop() {
    var box = document.getElementById('upgrade');
    var wrap = document.getElementById('upCards');
    var head = box.querySelector('.up-head');
    var sub = box.querySelector('.up-sub');
    var hint = box.querySelector('.up-hint');

    var gEl = document.getElementById('shopGrade');
    if (!gEl) {
      gEl = document.createElement('div');
      gEl.id = 'shopGrade';
      gEl.style.cssText =
        'text-align:center;font-size:14px;letter-spacing:.18em;' +
        'margin-bottom:8px;font-weight:700;';
      box.querySelector('.up-inner').insertBefore(gEl, head);
    }

    if (game.lastGrade) {
      gEl.style.color = gradeColor(game.lastGrade);
      gEl.textContent = '第 ' + game.lastWave + ' 波 · ' + game.lastGrade +
        (game.lastGain > 0 ? '　+' + game.lastGain + ' 材料' : '');
    } else {
      gEl.textContent = '';
    }

    head.textContent = '商 店';

        var buildNames = [];
    for (var wi = 0; wi < player.weapons.length; wi++) {
      var ww = player.weapons[wi];
      buildNames.push(wStat(ww).name + ' Lv.' + (ww.lv || 1));
    }
    sub.textContent = buildNames.join(' · ') +
      '　｜　护盾 ' + player.shield + '/' + player.mods.shieldMax +
      '　｜　材料 ' + game.mat;
    hint.textContent = '点击购买　·　点「继续」或按空格进入下一波';

    wrap.innerHTML = '';

    if (game.shopOffers.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'up-card';
      empty.style.cursor = 'default';
      empty.innerHTML = '<span class="up-name">已 售 罄</span>';
      wrap.appendChild(empty);
    }

    game.shopOffers.forEach(function (o, i) {
      var b = document.createElement('button');
      b.className = 'up-card';
      if (game.mat < o.price) b.style.opacity = '0.42';

      var num = document.createElement('span');
      num.className = 'up-num';
      num.textContent = '0' + (i + 1);

      var name = document.createElement('span');
      name.className = 'up-name';
      name.textContent = o.name;
      name.style.color = o.color;
      name.style.textShadow = '0 0 14px ' + o.color;

      var desc = document.createElement('span');
      desc.className = 'up-desc';
      desc.textContent = o.desc;

      var price = document.createElement('span');
      price.className = 'up-stack';
      price.textContent = o.price + ' 材料';
      price.style.color = game.mat >= o.price ? 'rgba(92,255,157,.9)' : 'rgba(255,95,95,.85)';

      b.appendChild(num);
      b.appendChild(name);
      b.appendChild(desc);
      b.appendChild(price);
      b.addEventListener('click', function () { buyOffer(i); });
      wrap.appendChild(b);
    });

    var cont = document.getElementById('shopContinue');
    if (!cont) {
      cont = document.createElement('button');
      cont.id = 'shopContinue';
      cont.className = 'btn';
      cont.style.marginTop = '18px';
      cont.textContent = '继 续 ▶';
      cont.addEventListener('click', closeShop);
      box.querySelector('.up-inner').appendChild(cont);
    }

    box.classList.add('show');
  }

  function buyOffer(i) {
    var o = game.shopOffers[i];
    if (!o) return;
       if (!game.debugFreeShop && game.mat < o.price) { Sound.shieldBreak(); return; }

    if (!game.debugFreeShop) game.mat -= o.price;

    if (o.kind === 'weapon') {
      player.weapons.push({ type: o.type, lv: 1 });
    } else if (o.kind === 'upgrade') {
      var w = player.weapons[o.slot];
      if (w) w.lv = (w.lv || 1) + 1;
    } else if (o.kind === 'shield') {
      player.shield = Math.min(player.mods.shieldMax, player.shield + 1);
    } else if (o.kind === 'shieldmax') {
      player.mods.shieldMax += 1;
      player.shield = Math.min(player.mods.shieldMax, player.shield + 1);
    } else if (o.kind === 'speed') {
      player.mods.speedMul *= 1.08;
    } else if (o.kind === 'magnet') {
      player.mods.magnetR += 100;
    } else if (o.kind === 'graze') {
      player.mods.grazeMul *= 1.5;
    }

    game.shopOffers.splice(i, 1);
    Sound.choose();
    renderShop();
  }

    function closeShop() {
    if (game.victoryOpen) { closeVictory(); return; }

    game.shopOpen = false;
    document.getElementById('upgrade').classList.remove('show');
    startWave();
  }


  /* ==================== 碰撞 ==================== */

        function damage() {
    var p = player;
    if (p.invuln > 0 || game.debugInv) return false;
    breakCombo();
    game.waveDamaged = true;

        if (p.shield > 0) {
          p.shield--;
          p.invuln = 1.2;
          game.shake = 15;
          game.flash = 0.55;
          game.hitstop = Math.max(game.hitstop, 0.12);
          burst(p.x, p.y, '#39f6ff', 20, 280);
          Sound.shieldBreak();
          glitch(0.9, 0.3);
          return true;
        }
        die();
        return false;
      }

      function collisions() {
        var p = player;
        var mods = p.mods;

                 var b = game.boss;
    if (b && b.entered) {
      var coreP = bossCorePos(b);
      var bd = hyp(p.x - coreP.x, p.y - coreP.y);
      var bodyD = hyp(p.x - b.x, p.y - b.y);

      if (bd < b.r * 0.58) {
        if (b.open && p.dashTime > 0 && b.hurtT <= 0) { hitBoss(); return; }
        damage();
        return;
      } else if (bodyD < b.r * 0.95) {
        damage();
        return;
      }
    }


        for (var i = meteors.length - 1; i >= 0; i--) {
          var m = meteors[i];
          var hitR = m.hitR + p.r * 0.7;
          var d2 = dist2(m.x, m.y, p.x, p.y);

          if (d2 < hitR * hitR) {
            if (p.dashTime > 0) { destroyMeteor(i, true); continue; }
                    if (p.invuln > 0 || game.debugInv) continue;


            meteors.splice(i, 1);
            burst(m.x, m.y, m.color, 22, 340);
            damage();
            if (game.mode !== 'play') return;
            continue;
          }

          var grazeR = hitR + GRAZE_BAND + mods.grazeBand;
          if (d2 < grazeR * grazeR && m.grazeCd <= 0 && p.invuln <= 0) {
            m.grazeCd = 0.4;
            game.grazes++;
            addCombo(1);
            addScore(10 * getMult() * mods.grazeMul);
            game.flash = Math.max(game.flash, 0.1);
            burst((m.x + p.x) * 0.5, (m.y + p.y) * 0.5, '#ffffff', 5, 150);
            Sound.graze();
            if (game.grazes >= 30) unlock('graze30');
          }
        }

        for (var s = 0; s < sats.length; s++) {
          var sat = sats[s];
          if (sat.fire > 0 && Math.abs(p.x - sat.x) < 15 && p.y > sat.y) {
            damage();
            if (game.mode !== 'play') return;
          }
        }

        var pickR = 12 * mods.pickupMul;
        for (var o = orbs.length - 1; o >= 0; o--) {
          var orb = orbs[o];
          var rr = orb.r + p.r + pickR;
          if (dist2(orb.x, orb.y, p.x, p.y) < rr * rr) {
            orbs.splice(o, 1);
            addCombo(2);
            addScore(25 * getMult());
            burst(orb.x, orb.y, '#5cff9d', 14, 230);
            Sound.orb(game.combo);
          }
        }

        for (var k = pickups.length - 1; k >= 0; k--) {
          var pk = pickups[k];
          var pr = pk.r + p.r + 6 + pickR;
          if (dist2(pk.x, pk.y, p.x, p.y) < pr * pr) {
            pickups.splice(k, 1);
            applyPickup(pk.type, pk.x, pk.y);
          }
        }
      }

      function applyPickup(type, x, y) {
        var p = player;

        if (type === 'shield') {
          p.shield = Math.min(p.mods.shieldMax, p.shield + 1);
          burst(x, y, '#39f6ff', 22, 270);
          toast('护盾 +1');
        } else if (type === 'slow') {
          game.slowT = 4.2;
          burst(x, y, '#8fd6ff', 22, 270);
          toast('时间减速');
        } else if (type === 'magnet') {
          game.magnetT = 8;
          burst(x, y, '#ffcf8a', 22, 270);
          toast('能量磁铁');
        } else if (type === 'double') {
          game.doubleT = 10;
          burst(x, y, '#ff9ecb', 22, 270);
          toast('双倍积分');
        } else if (type === 'pulse') {
          game.flash = 0.9;
          game.shake = 24;
          game.hitstop = Math.max(game.hitstop, 0.1);
          glitch(1.0, 0.35);
          for (var i = meteors.length - 1; i >= 0; i--) {
            var m = meteors[i];
            burst(m.x, m.y, m.color, 10, 300);
            addScore(30);
            meteors.splice(i, 1);
          }
          burst(x, y, '#ffffff', 30, 400);
          toast('清屏脉冲');
          Sound.pulse();
        }

        addScore(60);
        Sound.pickup();
      }

      /* ==================== 冲刺 / 死亡 ==================== */
      function tryDash() {
        var p = player;
        if (game.mode !== 'play' || game.paused || game.upgrading) return;
        if (p.dashCd > 0 || p.dashTime > 0) return;

                p.dashCd = game.debugNoDashCd ? 0 : DASH_CD * p.mods.dashCdMul;
    game.dashKills = 0;
        p.dashTime = 0.18;
        p.invuln = Math.max(p.invuln, 0.45 * p.mods.dashInvuln);

               var dx = p.vx, dy = p.vy;
        var d = hyp(dx, dy);
        if (d >= 30) {
          p.lastDirX = dx / d;
          p.lastDirY = dy / d;
        } else if (p.lastDirX || p.lastDirY) {
          dx = p.lastDirX; dy = p.lastDirY; d = 1;
        } else {
          dx = 0; dy = -1; d = 1;
        }
        p.vx = (dx / d) * 1350 * p.mods.speedMul;
        p.vy = (dy / d) * 1350 * p.mods.speedMul;

        game.shake = Math.max(game.shake, 6);
        burst(p.x, p.y, '#39f6ff', 14, 220);
        Sound.dash();
      }

      function die() {
        game.mode = 'dying';
        game.deathT = 0.9;
        game.shake = 28;
        game.flash = 1;
        game.hitstop = Math.max(game.hitstop, 0.15);
        breakCombo();
        burst(player.x, player.y, '#ff3ea5', 55, 540);
        burst(player.x, player.y, '#ffffff', 22, 280);
        burst(player.x, player.y, '#39f6ff', 30, 380);
        Sound.death();
        glitch(1.4, 0.5);
        unlock('first');
      }

      /* ==================== 主更新 ==================== */
      function checkAch() {
        if (game.time >= 60) unlock('survive60');
        if (game.score >= 5000) unlock('score5000');
      }

      function update(dt) {
        updateStars(dt);
            updateParticles(dt);
       updateFloaters(dt);
       updateSparks(dt);
        updateShockwaves(dt);

        game.shake *= Math.exp(-6 * dt);
        if (game.shake < 0.05) game.shake = 0;
            game.flash = Math.max(0, game.flash - dt * 2.2);
    game.whiteFlash = Math.max(0, game.whiteFlash - dt * 2.6);
        if (game.comboPop > 0) game.comboPop -= dt;
        if (game.bannerT > 0) game.bannerT -= dt;

        if (game.mode === 'dying') {
          game.deathT -= dt;
          updateMeteors(dt * 0.7);
          if (game.deathT <= 0) endGame();
          return;
        }

        if (game.mode !== 'play') return;

        var wdt = dt * (game.slowT > 0 ? SLOW_FACTOR : 1);

        game.time += dt;
        if (game.slowT > 0) game.slowT -= dt;
        if (game.magnetT > 0) game.magnetT -= dt;
        if (game.doubleT > 0) game.doubleT -= dt;

            addScore(dt * 6);

        if (game.combo > 0) {
          game.comboT -= dt;
          if (game.comboT <= 0) breakCombo();
        }

        updatePlayer(dt);
        updateWeapons(dt);
        if (!game.debugFreeze) updateMeteors(wdt);
       updateBullets(wdt);
       updateOrbs(wdt, dt);
        updateMaterials(wdt, dt);
        updatePickups(wdt);
        updateHoles(wdt);
        updateSats(wdt);
        updateWarns(wdt);
        updateBoss(wdt);

        collisions();

        if (game.mode !== 'play') { updateHUD(); return; }

            waveDirector(wdt);

            // 局内成长已交给波间商店，分数不再触发三选一
            var bgmLevel = 0;
    if (game.chapter >= 3) bgmLevel = 2;
    else if (game.chapter >= 2) bgmLevel = 1;
    if (game.boss) bgmLevel = 3;

    Sound.setBgmLevel(bgmLevel);
    Sound.setBgmTempo(game.boss ? 1.22 : 1, game.boss ? 3 : 0);

        updateHUD();
        checkAch();
      }

      /* ===== 第 4 段结束 · 请继续粘贴第 5 段 ===== */
    


  /* ==================== 绘制：飞船 ==================== */
  function drawShip() {
    var p = player;

    if (p.dashTime > 0 && p.trail.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < p.trail.length; i++) {
        var t = p.trail[i];
        var a = (i / p.trail.length) * 0.25;
        ctx.fillStyle = 'rgba(57,246,255,' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(t.x, t.y, p.r * 0.95, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    var blink = p.invuln > 0 && game.mode === 'play' && Math.floor(p.invuln * 14) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.4 : 1;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.tilt);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    var f = 0.65 + Math.random() * 0.7;
    ctx.shadowColor = '#39f6ff';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(-4.5, 6); ctx.lineTo(0, 8 + 15 * f); ctx.lineTo(4.5, 6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(120,240,255,0.55)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-2, 7); ctx.lineTo(0, 7 + 9 * f); ctx.lineTo(2, 7);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(6, 0);
    ctx.lineTo(12, 8);
    ctx.lineTo(5, 6);
    ctx.lineTo(3, 11);
    ctx.lineTo(-3, 11);
    ctx.lineTo(-5, 6);
    ctx.lineTo(-12, 8);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(16,72,110,0.55)';
    ctx.fill();
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#9ff8ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -3.5, 3.2, 0, TAU);
    ctx.fillStyle = '#e9ffff';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#ffffff';
    ctx.fill();
    ctx.restore();

    if (p.shield > 0) {
      var tt = performance.now() * 0.003;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(tt);
      ctx.shadowColor = '#39f6ff';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = 'rgba(120,245,255,' + (0.5 + 0.25 * Math.sin(tt * 3)).toFixed(2) + ')';
      ctx.lineWidth = 2;
      var R = p.r + 12;
      ctx.beginPath();
      for (var j = 0; j <= 6; j++) {
        var ang = (j / 6) * TAU;
        var px = Math.cos(ang) * R, py = Math.sin(ang) * R;
        if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      if (p.shield > 1) {
        ctx.beginPath();
        ctx.arc(0, 0, R + 7, 0, TAU);
        ctx.strokeStyle = 'rgba(57,246,255,0.28)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    if (p.dashTime > 0) {
      var kk = 1 - p.dashTime / 0.18;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(160,250,255,' + (0.5 * (1 - kk)).toFixed(3) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18 + kk * 46, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawTouchTarget() {
    if (pointer.mode !== 'relative' || !pointer.down) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(57,246,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 16, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pointer.x - 24, pointer.y); ctx.lineTo(pointer.x - 9, pointer.y);
    ctx.moveTo(pointer.x + 9, pointer.y); ctx.lineTo(pointer.x + 24, pointer.y);
    ctx.moveTo(pointer.x, pointer.y - 24); ctx.lineTo(pointer.x, pointer.y - 9);
    ctx.moveTo(pointer.x, pointer.y + 9); ctx.lineTo(pointer.x, pointer.y + 24);
    ctx.stroke();
    ctx.restore();
  }

  /* ==================== 绘制：陨石 ==================== */
  function drawMeteors() {
    for (var i = 0; i < meteors.length; i++) {
      var m = meteors[i];
      var s = m.shape;

      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rot);

      ctx.beginPath();
      ctx.moveTo(Math.cos(s[0].a) * s[0].rr, Math.sin(s[0].a) * s[0].rr);
      for (var j = 1; j < s.length; j++) {
        ctx.lineTo(Math.cos(s[j].a) * s[j].rr, Math.sin(s[j].a) * s[j].rr);
      }
      ctx.closePath();
      ctx.fillStyle = m.kind === 'homing' ? 'rgba(255,62,165,0.10)' : 'rgba(255,255,255,0.035)';
      ctx.fill();

      ctx.shadowColor = m.color;
      ctx.shadowBlur = m.kind === 'homing' ? 22 : 16;
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.beginPath();
      for (var k = 0; k < s.length; k += 2) {
        var px = Math.cos(s[k].a) * s[k].rr * 0.48;
        var py = Math.sin(s[k].a) * s[k].rr * 0.48;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (m.kind === 'homing') {
        ctx.shadowColor = '#ff3ea5';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, 0, m.r * 0.3, 0, TAU);
        ctx.fillStyle = 'rgba(255,190,225,0.9)';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ==================== 绘制：黑洞 ==================== */
  function drawHoles() {
    for (var i = 0; i < holes.length; i++) {
      var h = holes[i];
      var fade = clamp(h.life / 1.2, 0, 1) * clamp(h.born / 0.5, 0, 1);

      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.globalAlpha = fade;

      var g = ctx.createRadialGradient(0, 0, h.r * 0.25, 0, 0, h.r * 2.2);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(0.45, 'rgba(20,10,50,0.75)');
      g.addColorStop(0.75, 'rgba(120,80,255,0.16)');
      g.addColorStop(1, 'rgba(120,80,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, h.r * 2.2, 0, TAU);
      ctx.fill();

      ctx.rotate(h.rot);
      ctx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(0, 0, h.r * (1.05 + k * 0.22), k * 1.7, k * 1.7 + 2.1);
        ctx.strokeStyle = k === 0 ? 'rgba(160,120,255,0.85)' : 'rgba(110,80,220,0.35)';
        ctx.lineWidth = 2 - k * 0.5;
        ctx.shadowColor = '#8f7bff';
        ctx.shadowBlur = 18;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';

      ctx.beginPath();
      ctx.arc(0, 0, h.r * 0.42, 0, TAU);
      ctx.fillStyle = '#01010a';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 30;
      ctx.fill();
      ctx.restore();
    }
  }

  /* ==================== 绘制：预警 ==================== */
  function drawWarns() {
    for (var i = 0; i < warns.length; i++) {
      var w = warns[i];
      var k = 1 - w.t / w.total;
      var a = 0.25 + 0.55 * Math.abs(Math.sin(k * Math.PI * 6));

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      var g = ctx.createLinearGradient(w.x, 0, w.x, H);
      g.addColorStop(0, 'rgba(255,90,90,0)');
      g.addColorStop(0.7, 'rgba(255,120,60,' + (0.14 * a).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,60,60,' + (0.30 * a).toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(w.x - 13, 0, 26, H);

      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = 'rgba(255,120,90,' + (0.55 * a + 0.2).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w.x, 0);
      ctx.lineTo(w.x, H);
      ctx.stroke();
      ctx.setLineDash([]);

      var t = performance.now() * 0.005;
      ctx.beginPath();
      ctx.arc(w.x, H - 40, w.r * (0.8 + 0.25 * Math.sin(t)), 0, TAU);
      ctx.strokeStyle = 'rgba(255,140,90,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ==================== 绘制：激光卫星 ==================== */
  function drawSats() {
    for (var i = 0; i < sats.length; i++) {
      var s = sats[i];
      var charging = s.fire <= 0 && s.cool <= 0;

      if (charging) {
        var k = 1 - s.charge / 1.4;
        ctx.save();
        ctx.setLineDash([8, 12]);
        ctx.strokeStyle = 'rgba(255,92,138,' + (0.2 + 0.5 * k).toFixed(3) + ')';
        ctx.lineWidth = 1 + k * 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x, H);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else if (s.fire > 0) {
        var fk = s.fire / 0.45;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var g = ctx.createLinearGradient(s.x - 20, 0, s.x + 20, 0);
        g.addColorStop(0, 'rgba(255,60,140,0)');
        g.addColorStop(0.5, 'rgba(255,200,240,' + (0.9 * fk).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,60,140,0)');
        ctx.fillStyle = g;
        ctx.fillRect(s.x - 20, s.y, 40, H - s.y);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * fk).toFixed(3) + ')';
        ctx.fillRect(s.x - 3, s.y, 6, H - s.y);
        ctx.restore();
      }

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.shadowColor = '#ff5c8a';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#ff9ec4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -s.r); ctx.lineTo(s.r, 0); ctx.lineTo(0, s.r); ctx.lineTo(-s.r, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,60,140,0.12)';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, TAU);
      ctx.fillStyle = '#ffe6f2';
      ctx.fill();
      ctx.restore();
    }
  }

  /* ==================== 绘制：Boss ==================== */
  function roundRectPath(x, y, w, h, r) {
    var rr = Math.max(0, Math.min(r, h / 2, w / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2);
    ctx.lineTo(x + rr, y + h);
    ctx.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI);
    ctx.lineTo(x, y + rr);
    ctx.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5);
    ctx.closePath();
  }

        function drawBoss() {
    var b = game.boss;
    if (!b) return;

    var col = bossColor(b);
    var py = b.y + Math.sin(b.bob) * 5;

    ctx.save();
    ctx.translate(b.x, py);

    ctx.rotate(b.rot);
    ctx.globalCompositeOperation = 'lighter';
              var rings = ((b.kind === 'final') ? 3 : 2) + Math.min(3, b.loop || 0);
    for (var k = 0; k < rings; k++) {
      ctx.beginPath();
      ctx.arc(0, 0, b.r * (1.12 + k * 0.16), k * 1.2, k * 1.2 + 2.4);
      ctx.strokeStyle = k === 0
        ? col
        : ((b.loop >= 1) ? 'rgba(255,120,120,0.46)' : 'rgba(255,180,90,0.4)');
      ctx.lineWidth = Math.max(1, 2.5 - k * 0.3);
      ctx.shadowColor = col;
      ctx.shadowBlur = 22;
      ctx.stroke();
    }

    if (b.loop > 0) {
      var marks = Math.min(6, b.loop * 2);
      for (var mk = 0; mk < marks; mk++) {
        var ma = (mk / marks) * TAU;
        var mx = Math.cos(ma) * b.r * 1.52;
        var my = Math.sin(ma) * b.r * 1.52;
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 12;
        ctx.fill();
      }
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(-b.rot);

    if (b.kind === 'gravity') {
      var g = ctx.createRadialGradient(0, 0, b.r * 0.2, 0, 0, b.r * 1.1);
      g.addColorStop(0, 'rgba(30,6,50,0.98)');
      g.addColorStop(0.7, 'rgba(90,40,160,0.55)');
      g.addColorStop(1, 'rgba(120,80,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, b.r * 1.1, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = 'rgba(180,140,255,0.5)';
      ctx.lineWidth = 1.5;
      for (var s = 0; s < 3; s++) {
        ctx.beginPath();
        for (var a = 0; a < 2.2; a += 0.15) {
          var rr = b.r * (0.25 + a * 0.3);
          var ang = a + b.rot * 2 + s * 2.1;
          var xx = Math.cos(ang) * rr;
          var yy = Math.sin(ang) * rr;
          if (a === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
    } else {
      var sides = (b.kind === 'final') ? 8 : (b.kind === 'twin' ? 6 : 7);
      ctx.beginPath();
      for (var i = 0; i < sides; i++) {
        var aa = (i / sides) * TAU - Math.PI / 2;
        var rrad = b.r * (0.92 + 0.08 * Math.sin(i * 2.1 + b.rot));
        var px2 = Math.cos(aa) * rrad;
        var py2 = Math.sin(aa) * rrad;
        if (i === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.closePath();
      ctx.fillStyle = b.kind === 'final' ? 'rgba(50,6,20,0.88)' : 'rgba(40,10,26,0.8)';
      ctx.fill();
      ctx.strokeStyle = b.hurtT > 0 ? '#ffffff' : col;
      ctx.lineWidth = 3;
      ctx.shadowColor = col;
      ctx.shadowBlur = 26;
      ctx.stroke();
    }

    ctx.save();

    if (b.kind === 'twin') {
      ctx.save();
      ctx.translate(-b.coreSide * b.r * 0.42, 0);
      ctx.beginPath();
      ctx.arc(0, 0, b.r * 0.34, 0, TAU);
      ctx.fillStyle = 'rgba(255,210,102,0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,102,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      ctx.translate(b.coreSide * b.r * 0.42, 0);
    }

    var coreR = b.r * (b.kind === 'twin' ? 0.34 : 0.55);

    if (b.open) {
      var pulse = 1 + Math.sin(performance.now() * 0.012) * 0.12;
      var cg = ctx.createRadialGradient(0, 0, 4, 0, 0, coreR * pulse);
      cg.addColorStop(0, 'rgba(255,255,255,1)');
      cg.addColorStop(0.35, 'rgba(255,220,120,0.95)');
      cg.addColorStop(0.75, 'rgba(255,140,60,0.5)');
      cg.addColorStop(1, 'rgba(255,60,140,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, 0, coreR * pulse, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, coreR * 1.05, 0, TAU);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, coreR * 0.5, 0, TAU);
      ctx.fillStyle = 'rgba(255,90,140,0.35)';
      ctx.shadowColor = col;
      ctx.shadowBlur = 20;
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();

    var barW = Math.min(320, W * 0.64);
    var barH = 9;
    var bx = W / 2 - barW / 2;
    var by = 64;

    ctx.save();

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRectPath(bx, by, barW, barH, barH / 2);
    ctx.fill();

    var gw = barW * (b.ghost / b.maxHp);
    if (gw > 0.5) {
      ctx.fillStyle = 'rgba(255,255,255,0.34)';
      roundRectPath(bx, by, gw, barH, barH / 2);
      ctx.fill();
    }

    var fw = barW * (b.hp / b.maxHp);
    if (fw > 0.5) {
      var lg = ctx.createLinearGradient(bx, 0, bx + barW, 0);
      lg.addColorStop(0, col);
      lg.addColorStop(1, '#ffd166');
      ctx.fillStyle = lg;
      ctx.shadowColor = col;
      ctx.shadowBlur = 18;
      roundRectPath(bx, by, fw, barH, barH / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.strokeStyle = 'rgba(4,6,13,0.9)';
    ctx.lineWidth = 2;
    for (var s2 = 1; s2 < b.maxHp; s2++) {
      var lx = bx + (barW / b.maxHp) * s2;
      ctx.beginPath();
      ctx.moveTo(lx, by + 1);
      ctx.lineTo(lx, by + barH - 1);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,140,180,0.55)';
    ctx.lineWidth = 1;
    roundRectPath(bx, by, barW, barH, barH / 2);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '600 10px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(255,200,220,0.78)';

        var label = bossName(b.kind) + '   ' + b.hp + ' / ' + b.maxHp;
    if (b.kind === 'final') label += '   · 第 ' + b.phase + ' 阶段';
    if (b.loop > 0) label += '   · 强化 ' + b.loop;

    ctx.fillText(label, W / 2, by - 9);
    ctx.restore();
  }

  function drawOrbs() {
    for (var i = 0; i < orbs.length; i++) {
      var o = orbs[i];
      var pulse = 1 + Math.sin(o.ph) * 0.18;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.shadowColor = '#5cff9d';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, o.r * pulse, 0, TAU);
      ctx.fillStyle = 'rgba(92,255,157,0.22)';
      ctx.fill();
      ctx.strokeStyle = '#b6ffd4';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-o.r * 0.25, -o.r * 0.25, o.r * 0.32, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
      ctx.restore();
    }
  }


  function drawPickups() {
    for (var i = 0; i < pickups.length; i++) {
      var k = pickups[i];
      var col = '#8ef4ff', label = 'S';
      if (k.type === 'slow') { col = '#8fd6ff'; label = 'T'; }
      else if (k.type === 'magnet') { col = '#ffcf8a'; label = 'M'; }
      else if (k.type === 'double') { col = '#ff9ecb'; label = '2'; }
      else if (k.type === 'pulse') { col = '#ffffff'; label = 'P'; }

      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.rotate(k.rot);
      ctx.shadowColor = col;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var j = 0; j <= 6; j++) {
        var a = (j / 6) * TAU;
        var px = Math.cos(a) * k.r, py = Math.sin(a) * k.r;
        if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.rotate(-k.rot);
      ctx.fillStyle = col;
      ctx.font = '700 12px -apple-system,"PingFang SC",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 1);
      ctx.restore();
    }
  }

  function drawParticles() {
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < particles.length; i++) {
      var pt = particles[i];
      var a = clamp(pt.life / pt.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r * a + 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawBanner() {
    if (game.bannerT <= 0) return;
    var life = game.bannerMax - game.bannerT;
    var a = clamp(Math.min(life * 5, game.bannerT * 2), 0, 1);
    var sc = 1 + (1 - clamp(life * 6, 0, 1)) * 0.25;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(W / 2, H * 0.24);
    ctx.scale(sc, sc);
    ctx.shadowColor = game.bannerColor;
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(game.banner, 0, 0);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = game.bannerColor;
    ctx.lineWidth = 1;
    ctx.strokeText(game.banner, 0, 0);
    ctx.restore();
  }
      function drawDangerVignette() {
    if (game.mode !== 'play') return;
    if (game.shopOpen || game.upgrading || game.paused) return;

    var lvl = 0;
    if (player.shield <= 0) lvl = 1;
    else if (player.shield === 1) lvl = 0.35;
    if (lvl <= 0) return;

    var pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.0025);
    var a = (0.08 + 0.15 * pulse) * lvl;

    var g = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.30,
      W / 2, H / 2, Math.max(W, H) * 0.72
    );
    g.addColorStop(0, 'rgba(255,40,70,0)');
    g.addColorStop(0.62, 'rgba(255,40,70,' + (a * 0.4).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,20,50,' + a.toFixed(3) + ')');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawGlitch() {
    if (game.glitchT <= 0) return;
    var k = clamp(game.glitchT / game.glitchDur, 0, 1);

    for (var i = 0; i < 4; i++) {
      var hh = rand(6, 32);
      var y = rand(0, Math.max(1, H - hh));
      var off = rand(-1, 1) * 26 * k;
      try {
        ctx.drawImage(
          canvas,
          0, Math.floor(y * dpr), canvas.width, Math.max(1, Math.floor(hh * dpr)),
          off, y, W, hh
        );
      } catch (e) {}
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var j = 0; j < 3; j++) {
      var h2 = rand(2, 10);
      var y2 = rand(0, H);
      var dy = rand(-7, 7);
      ctx.fillStyle = 'rgba(255,60,110,' + (0.13 * k).toFixed(3) + ')';
      ctx.fillRect(0, y2 + dy, W, h2);
      ctx.fillStyle = 'rgba(60,220,255,' + (0.13 * k).toFixed(3) + ')';
      ctx.fillRect(0, y2 - dy, W, h2);
    }
    ctx.restore();
  }

  /* ==================== 主渲染 ==================== */
  function render() {
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    var intensity = 0;
    if (game.mode === 'play') intensity = clamp((game.time - 6) / 45, 0, 1);
    if (player.dashTime > 0) intensity = Math.min(1.6, intensity + 0.9);
    if (game.slowT > 0) intensity *= 0.4;
    if (game.mode === 'dying') intensity *= 0.5;

    ctx.save();
    if (game.shake > 0.1) {
      ctx.translate(rand(-1, 1) * game.shake, rand(-1, 1) * game.shake);
    }

    drawStars();
    drawSpeedLines(intensity);
    drawHoles();
    drawWarns();
    drawOrbs();
    drawPickups();
    drawMeteors();
    drawBullets();
    drawMaterials();
    drawSats();

    drawBoss();

    if (game.mode === 'play') {
      drawShip();
      drawTouchTarget();
    }

        drawShockwaves();
       drawHitboxes();
           drawSparks();
    drawFloaters();
    drawParticles();
      ctx.restore();

      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

    drawDangerVignette();


    if (game.slowT > 0) {
      ctx.fillStyle = 'rgba(80,160,255,' + (0.06 + 0.03 * Math.sin(performance.now() * 0.006)).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

        if (game.whiteFlash > 0.01) {
      ctx.fillStyle = 'rgba(255,255,255,' + (game.whiteFlash * 0.7).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    if (game.flash > 0.01) {
      ctx.fillStyle = 'rgba(255,70,120,' + (game.flash * 0.42).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    drawBanner();

        if (game.paused && game.mode === 'play' && !game.upgrading) {
      drawStatsCard();
    }


       drawWaveHUD();
      drawGlitch();

  }
      /* ==================== 属性面板 ==================== */

  function drawStatsCard() {
    ctx.save();
    ctx.fillStyle = 'rgba(3,6,14,0.78)';
    ctx.fillRect(0, 0, W, H);

    var rows = [];
    rows.push({ head: '武 器' });

    var ws = player.weapons || [];
    if (ws.length === 0) rows.push({ l: '（无武器）', r: '' });

    for (var i = 0; i < ws.length; i++) {
      var w = ws[i];
      var st = wStat(w);
      rows.push({
        l: st.name + '  Lv.' + (w.lv || 1),
        r: st.dmg.toFixed(1) + ' 伤害 · ' + st.interval.toFixed(2) + 's'
      });
    }

    rows.push({ head: '属 性' });
    var m = player.mods;

    rows.push({ l: '移动速度', r: '+' + Math.round((m.speedMul - 1) * 100) + '%' });
    rows.push({ l: '冲刺冷却', r: (DASH_CD * m.dashCdMul).toFixed(2) + 's' });
    rows.push({ l: '冲刺无敌', r: (0.45 * m.dashInvuln).toFixed(2) + 's' });
    rows.push({ l: '护盾', r: player.shield + ' / ' + m.shieldMax });
    rows.push({ l: '拾取范围', r: '+' + Math.round(m.magnetR) });
    rows.push({ l: '擦身判定', r: '+' + Math.round(m.grazeBand) });
    rows.push({ l: '擦身收益', r: '×' + m.grazeMul.toFixed(1) });

    var rowH = 22;
    var pw = Math.min(430, W - 36);
    var ph = 62 + rows.length * rowH + 46;
    var px = W / 2 - pw / 2;
    var py = Math.max(16, H / 2 - ph / 2);

    roundRectPath(px, py, pw, ph, 14);
    ctx.fillStyle = 'rgba(8,16,28,0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(57,246,255,0.32)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = '#39f6ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#c9fbff';
    ctx.font = '700 20px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('已 暂 停', W / 2, py + 28);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(170,215,235,0.5)';
    ctx.font = '400 11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('按 P 或 Esc 继续', W / 2, py + 48);

    var y = py + 74;

    for (var k = 0; k < rows.length; k++) {
      var r = rows[k];

      if (r.head) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(57,246,255,0.8)';
        ctx.font = '700 10.5px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
        ctx.fillText(r.head, px + 20, y);
        y += rowH;
        continue;
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(200,230,245,0.85)';
      ctx.font = '400 12.5px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(r.l, px + 20, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '600 12.5px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(r.r, px + pw - 20, y);

      y += rowH;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(160,200,220,0.55)';
    ctx.font = '400 11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(
      '第 ' + game.wave + ' 波 · 第 ' + game.chapter + ' 章 · 材料 ' + game.mat,
      W / 2, y + 12
    );

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }


  /* ==================== HUD ==================== */
  var $score = document.getElementById('score');
  var $best = document.getElementById('best');
  var $modeTag = document.getElementById('modeTag');
   var $lvTag = document.getElementById('lvTag');
  var $matTag = document.getElementById('matTag');
  var $dashFill = document.getElementById('dashFill');
  var $dashTxt = document.getElementById('dashTxt');
  var $shieldTxt = document.getElementById('shieldTxt');
  var $comboWrap = document.getElementById('comboWrap');
  var $comboMult = document.getElementById('comboMult');
  var $comboFill = document.getElementById('comboFill');
  var $chipSlow = document.getElementById('chipSlow');
  var $chipMag = document.getElementById('chipMag');
  var $chipDbl = document.getElementById('chipDbl');
  var overlay = document.getElementById('overlay');

  function setChip(el, t, label) {
    if (t > 0.05) {
      var txt = label + ' ' + t.toFixed(1);
      if (el.textContent !== txt) el.textContent = txt;
      if (el.style.display !== 'inline-block') el.style.display = 'inline-block';
    } else if (el.style.display !== 'none') {
      el.style.display = 'none';
    }
  }

  function updateHUD() {
    var s = String(Math.floor(game.score));
    if ($score.textContent !== s) $score.textContent = s;

    var b = String(game.best);
    if ($best.textContent !== b) $best.textContent = b;

    var cdMax = DASH_CD * player.mods.dashCdMul;
    var ready = 1 - clamp(player.dashCd / cdMax, 0, 1);
    $dashFill.style.transform = 'scaleX(' + ready.toFixed(3) + ')';
    var dtxt = player.dashCd > 0 ? '冷却' : '就绪';
    if ($dashTxt.textContent !== dtxt) $dashTxt.textContent = dtxt;

    var stxt = player.shield > 0 ? '×' + player.shield : '—';
    if ($shieldTxt.textContent !== stxt) $shieldTxt.textContent = stxt;
    $shieldTxt.classList.toggle('on', player.shield > 0);

       var lvTxt = game.upgradeLevel > 0 ? '强化 Lv.' + game.upgradeLevel : '';
    if ($lvTag.textContent !== lvTxt) $lvTag.textContent = lvTxt;

    var mtxt = '材料 ' + game.mat;
    if ($matTag && $matTag.textContent !== mtxt) $matTag.textContent = mtxt;

    var mult = getMult();
    var show = mult > 1 && game.mode === 'play';
    $comboWrap.style.opacity = show ? '1' : '0';
    if (show) {
      var mtxt = '×' + mult;
      if ($comboMult.textContent !== mtxt) $comboMult.textContent = mtxt;
      var sc = 1 + Math.max(0, game.comboPop) * 1.6;
      $comboWrap.style.transform = 'translateX(-50%) scale(' + sc.toFixed(3) + ')';
      $comboFill.style.transform = 'scaleX(' + clamp(game.comboT / COMBO_TIME, 0, 1).toFixed(3) + ')';
    }

    setChip($chipSlow, game.slowT, '减速');
    setChip($chipMag, game.magnetT, '磁铁');
    setChip($chipDbl, game.doubleT, '双倍');
  }

  /* ==================== 界面 ==================== */
  function showMenu() {
    var dbest = getDailyBest();
    var board = loadBoard(false);

        overlay.innerHTML =
      '<h1 class="title">NEON DODGE</h1>' +
      '<p class="sub">霓 虹 陨 石</p>' +
      '<p class="sub2" style="margin-top:12px;color:rgba(160,210,235,.72);letter-spacing:.3em">越 靠 近 危 险　越 强</p>' +
      '<p class="hint">' +
        '<b>鼠标移动 / 手指拖拽</b> 操控　·　<b>WASD / 方向键</b> 同样可用<br>' +
        '<b>空格 / Shift</b> 冲刺，可撞碎陨石　·　手机<b>双击屏幕</b>冲刺<br>' +
        '每波 22 秒，达成<span class="o">击杀目标</span>拿 S 评级，波间进 <span class="c">商店</span> 变强<br>' +
        '共 <b>16 波 · 4 章 · 4 个 Boss</b>，通关后进入 <span class="v">无尽模式</span>' +
      '</p>' +
      '<button class="btn" id="startBtn">开 始 游 戏</button>' +
      '<button class="btn ghost" id="dailyBtn">每 日 挑 战' + (dbest > 0 ? ' · ' + dbest : '') + '</button>' +
      '<div class="lb"><div class="lb-title">本 机 前 五</div>' + boardHTML(board) + '</div>' +
            '<button class="ach-line ach-entry" id="achBtn">成 就 <b>' + achCount() + ' / ' + ACH_LIST.length + '</b><span class="ach-arrow">›</span></button>' +
      '<p class="tip">空格 开始　·　M 静音　·　P 暂停 / 查看属性</p>';


    overlay.classList.add('show');
    document.getElementById('startBtn').addEventListener('click', function () { startGame(false); });
        document.getElementById('dailyBtn').addEventListener('click', function () { startGame(true); });
    document.getElementById('achBtn').addEventListener('click', showAchievements);
  }

    function showAchievements() {
    achOpen = true;

    var order = [];
    for (var i = 0; i < ACH_LIST.length; i++) order.push({ a: ACH_LIST[i], i: i });
    order.sort(function (p, q) {
      var up = unlocked[p.a.id] ? 1 : 0, uq = unlocked[q.a.id] ? 1 : 0;
      if (up !== uq) return uq - up;
      return p.i - q.i;
    });

    var rows = '';
    for (var j = 0; j < order.length; j++) {
      var a = order[j].a;
      var ts = unlocked[a.id] || 0;
      var meta = ts
        ? '<span class="ach-when">' + fmtAchTime(ts) + '</span><span class="ach-badge">已 解 锁</span>'
        : '<svg class="ach-lock" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.4" y="7" width="9.2" height="6.4" rx="1.6"/><path d="M5.6 7V5.4a2.4 2.4 0 0 1 4.8 0V7"/></svg><span class="ach-badge off">未 解 锁</span>';

      rows += '<div class="ach-row' + (ts ? ' on' : '') + '">' +
        '<div class="ach-ico"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + a.icon + '</svg></div>' +
        '<div class="ach-body">' +
          '<div class="ach-name">' + a.name + '</div>' +
          '<div class="ach-desc">' + a.desc + '</div>' +
        '</div>' +
        '<div class="ach-meta">' + meta + '</div>' +
      '</div>';
    }

    var pct = Math.round(achCount() / ACH_LIST.length * 100);

    overlay.innerHTML =
      '<p class="over-label">成 就 档 案</p>' +
      '<div class="ach-count"><b>' + achCount() + '</b> / ' + ACH_LIST.length + '</div>' +
      '<div class="ach-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="ach-list">' + rows + '</div>' +
      '<button class="btn ghost small" id="achBack" style="margin-top:14px">‹ 返 回 首 页</button>';

    overlay.classList.add('show');
    document.getElementById('achBack').addEventListener('click', closeAchievements);
  }

  function closeAchievements() {
    if (!achOpen) return;
    achOpen = false;
    Sound.choose();
    showMenu();
  }

  function boardForOver() {

    return loadBoard(game.daily);
  }
      function showVictory() {
    game.shopOpen = true;
    game.victoryOpen = true;

    var html = '';
    html += '<p class="over-label" style="color:#ffd166;text-shadow:0 0 14px rgba(255,209,102,.85)">主 线 通 关</p>';
    html += '<div class="score-big">' + Math.floor(game.score) + '</div>';
    html += '<p class="sub2" style="color:#ffd166;letter-spacing:.3em">四 章 全 部 击 破</p>';

    html += '<div class="stats">' +
      '<span>用时 <b>' + game.time.toFixed(1) + 's</b></span>' +
      '<span>击杀 <b>' + (game.totalKills || 0) + '</b></span>' +
      '<span>擦身 <b>' + game.grazes + '</b></span>' +
      '<span>最高倍率 <b>×' + game.maxMult + '</b></span>' +
      '</div>';

    html += '<p class="sub2" style="margin-top:20px;color:rgba(170,215,235,.82);letter-spacing:.12em">' +
      '接下来进入 <b style="color:#39f6ff">无 尽 模 式</b>　敌人会持续变强' +
      '</p>';

    html += '<button class="btn" id="victoryBtn">继 续 ▶</button>';
    html += '<p class="tip">空格 / 回车 也可以继续</p>';

    overlay.innerHTML = html;
    overlay.classList.add('show');

    document.getElementById('victoryBtn').addEventListener('click', closeVictory);
  }

  function closeVictory() {
    game.victoryOpen = false;
    game.shopOpen = false;
    overlay.classList.remove('show');
    openShop();
  }


  function showOver() {
    var s = Math.floor(game.score);
    var list = boardForOver();

    var line = game.newBest
      ? '<p class="sub2" style="color:#ffd166;text-shadow:0 0 14px rgba(255,209,102,.8)">★ 新 纪 录 ★</p>'
      : '<p class="sub2">' + (game.daily ? '今日最佳 ' + getDailyBest() : '最高纪录 ' + game.best) + '</p>';

    var html = '';
    html += '<p class="over-label">' + (game.daily ? '每 日 挑 战 · ' + todayKey() : '飞 行 结 束') + '</p>';
    html += '<div class="score-big">' + s + '</div>';
    html += line;
    html += '<div class="stats">' +
      '<span>存活 <b>' + game.time.toFixed(1) + 's</b></span>' +
      '<span>擦身 <b>' + game.grazes + '</b></span>' +
      '<span>击碎 <b>' + game.shatters + '</b></span>' +
            '<span>到达 <b>第 ' + game.wave + ' 波</b></span>' +
      '<span>最高倍率 <b>×' + game.maxMult + '</b></span>' +
      '</div>';
    html += '<div class="stats" style="margin-top:8px">' +
      '<span>强化 <b>Lv.' + game.upgradeLevel + '</b></span>' +
      '<span>成就 <b>' + achCount() + '/' + ACH_LIST.length + '</b></span>' +
      '</div>';

    if (pendingEntry) {
      html += '<div class="name-box">' +
        '<div class="nb-title">冲 进 本 机 排 行 榜 ！</div>' +
        '<div class="nb-row">' +
          '<input id="nameInput" class="nb-input" maxlength="6" value="' + escapeHTML(getSavedName()) + '" autocomplete="off" spellcheck="false">' +
          '<button class="btn small" id="okName">确 定</button>' +
        '</div></div>';
    }

    html += '<div class="lb"><div class="lb-title">本 机 前 五</div>' + boardHTML(list) + '</div>';
    html += '<button class="btn" id="startBtn">再 来 一 局</button>';
    html += '<button class="btn ghost" id="menuBtn">返 回 菜 单</button>';
    html += '<p class="tip">空格 重新开始</p>';

    overlay.innerHTML = html;
    overlay.classList.add('show');

    document.getElementById('startBtn').addEventListener('click', function () { startGame(game.daily); });
    document.getElementById('menuBtn').addEventListener('click', function () {
      game.mode = 'menu';
      Sound.bgmStop();
      showMenu();
    });

    if (pendingEntry) {
      var input = document.getElementById('nameInput');
      var ok = document.getElementById('okName');
      if (ok) ok.addEventListener('click', submitName);
      if (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); submitName(); }
          e.stopPropagation();
        });
        var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        if (!coarse) {
          setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 120);
        }
      }
    }
  }

  function submitName() {
    var el = document.getElementById('nameInput');
    var name = el ? el.value : '';
    name = String(name).replace(/[<>'&"]/g, '').trim().slice(0, 6);
    if (!name) name = 'AAA';

    try { localStorage.setItem(NAME_KEY, name); } catch (e) {}
    insertEntry(name);
    pendingEntry = false;

    Sound.choose();
    showOver();
  }

  function hideOverlay() {
    overlay.classList.remove('show');
  }

  /* ==================== 流程 ==================== */
  function resetPlayer() {
    player.x = W * 0.5;
    player.y = H * 0.75;
    player.vx = 0;
    player.vy = 0;
    player.tilt = 0;
    player.shield = 0;
    player.invuln = 1.4;
    player.dashCd = 0;
    player.dashTime = 0;
    player.trail.length = 0;
    player.mods = defaultMods();
    initWeapons();

  }

  function startGame(isDaily) {
    Sound.init();

    game.prefDaily = !!isDaily;
    game.daily = !!isDaily;

    if (isDaily) {
      game.seed = hashStr('neondodge-' + todayKey());
      srnd = mulberry32(game.seed);
    } else {
      game.seed = 0;
      srnd = Math.random;
    }

    game.mode = 'play';
    game.time = 0;
    game.score = 0;
    game.shake = 0;
    game.flash = 0;
    game.hitstop = 0;
    game.paused = false;
    game.deathT = 0;
    game.newBest = false;

    game.combo = 0;
    game.comboT = 0;
    game.comboPop = 0;
    game.grazes = 0;
    game.shatters = 0;
    game.maxMult = 1;

    game.phase = 'calm';
    game.phaseT = 5.5;
    game.eventType = '';
    game.eventElapsed = 0;
    game.eventFired = 0;
    game.rainT = 0;
    game.spawnT = 1.0;
    game.orbT = 2.0;
    game.powerT = 10;

    game.slowT = 0;
    game.magnetT = 0;
    game.doubleT = 0;

    game.boss = null;
    game.nextBoss = 55;

    game.banner = '';
    game.bannerT = 0;

    game.upgrading = false;
    game.upgradeChoices = [];
    game.upgradeStacks = {};
    game.upgradeLevel = 0;
    game.nextUpgrade = 500;

    game.glitchT = 0;
    pendingEntry = false;

    meteors.length = 0;
    orbs.length = 0;
    pickups.length = 0;
    particles.length = 0;
    bullets.length = 0;
    bulletPool.length = 0;
    materials.length = 0;

    holes.length = 0;
    sats.length = 0;
    warns.length = 0;

    document.getElementById('upgrade').classList.remove('show');
    canvas.classList.remove('glitch');

    resetPlayer();
    pointer.active = false;
    pointer.down = false;
    pointer.id = null;
    keys.left = keys.right = keys.up = keys.down = false;

    $modeTag.textContent = isDaily ? 'DAILY' : '';
    $modeTag.classList.toggle('small', isDaily);

    hideOverlay();
    refreshBestName();
    updateHUD();
        lastTime = 0;
    Sound.bgmStart(isDaily ? (game.seed % 4) : (Math.random() * 4 | 0));
    Sound.setBgmLevel(0);

            game.wave = 0;
    game.cleared = false;
    game.waveKills = 0;
    game.totalKills = 0;
    game.freeWeaponGiven = false;
    game.victoryOpen = false;
    game.boss = null;
    game.mat = 0;
    game.threatBonus = 0;
    game.shopOpen = false;
    game.shopDelay = 0;
    game.lastGrade = '';

    game.shopOffers = [];
    startWave();
    debugSync();



    
  }

  function endGame() {
    game.mode = 'over';
    var s = Math.floor(game.score);

    if (game.daily) {
      var db = getDailyBest();
      game.newBest = s > db && s > 0;
      if (game.newBest) setDailyBest(s);
      $best.textContent = String(Math.max(db, s));
    } else {
      game.newBest = s > game.best;
      if (game.newBest) {
        game.best = s;
        try { localStorage.setItem('neonDodgeBest', String(s)); } catch (e) {}
      }
      $best.textContent = String(game.best);
    }

    pendingEntry = qualifiesEntry(s);

    checkAch();
    updateHUD();

    Sound.bgmStop();
    refreshBestName();
    showOver();
  }

  function togglePause() {
        if (game.mode !== 'play' || game.upgrading || game.shopOpen) return;
    game.paused = !game.paused;
    if (game.paused) Sound.bgmPause();
    else { Sound.bgmResume(); lastTime = 0; }
  }
          /* ==================== 调试面板 ==================== */
      function debugJumpTo(n) {
    if (game.mode !== 'play') return;

    n = parseInt(n, 10);
    if (!n || n < 1) return;
    n = Math.min(999, n);

    if (game.shopOpen) {
      game.shopOpen = false;
      var box = document.getElementById('upgrade');
      if (box) box.classList.remove('show');
    }

    game.wave = n - 1;
    meteors.length = 0;
    warns.length = 0;
    bullets.length = 0;
    game.boss = null;

    startWave();
  }

  function debugBuild() {
    if (document.getElementById('dbgPanel')) return;

    var wrap = document.createElement('div');
    wrap.id = 'dbgPanel';
    wrap.style.cssText =
      'position:fixed;right:12px;top:12px;z-index:9999;pointer-events:auto;' +
      'background:rgba(6,12,22,.93);border:1px solid rgba(57,246,255,.45);' +
      'border-radius:10px;padding:10px;display:none;min-width:158px;' +
      'font:12px/1.6 -apple-system,"PingFang SC",sans-serif;color:#bfe9ff;' +
            'box-shadow:0 0 24px rgba(0,0,0,.7);' +
      'max-height:88vh;overflow-y:auto;';

    var title = document.createElement('div');
    title.textContent = 'DEBUG  按 ` 关闭';
    title.style.cssText = 'font-weight:700;color:#39f6ff;margin-bottom:8px;';
    wrap.appendChild(title);

    var info = document.createElement('div');
    info.id = 'dbgInfo';
    info.style.cssText = 'font-size:11px;color:rgba(160,210,235,.72);margin-bottom:8px;white-space:pre-line;';
    wrap.appendChild(info);

    function addBtn(label, id, fn) {
      var b = document.createElement('button');
      b.textContent = label;
      if (id) b.id = id;
      b.style.cssText =
        'display:block;width:100%;margin:4px 0;padding:5px 8px;cursor:pointer;' +
        'background:rgba(57,246,255,.08);border:1px solid rgba(57,246,255,.35);' +
        'border-radius:6px;color:#d8f6ff;font:inherit;text-align:left;';
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        fn(b);
      });
      wrap.appendChild(b);
      return b;
    }

    addBtn('材料 +500', null, function () { game.mat += 500; });

    addBtn('无敌：关', 'dbgInv', function () {
      game.debugInv = !game.debugInv;
      debugSync();
    });

        addBtn('一击必碎：关', 'dbgOne', function () {
      game.debugOneShot = !game.debugOneShot;
      debugSync();
    });

        addBtn('Boss 一击必杀：关', 'dbgBoss', function () {
      game.debugBossOneShot = !game.debugBossOneShot;
      debugSync();
    });

            addBtn('自动跳过商店：关', 'dbgSkipShop', function () {
      game.debugSkipShop = !game.debugSkipShop;
      debugSync();
    });

    addBtn('显示判定框：关', 'dbgHitbox', function () {
      game.debugHitbox = !game.debugHitbox;
      debugSync();
    });
        addBtn('停止攻击：关', 'dbgNoAtk', function () {
      game.debugNoAttack = !game.debugNoAttack;
      debugSync();
    });

    addBtn('材料不减：关', 'dbgFree', function () {
      game.debugFreeShop = !game.debugFreeShop;
      debugSync();
    });

    addBtn('伤害 x1', 'dbgDmg', function () {
      if (game.debugDmgMul === 1) game.debugDmgMul = 2;
      else if (game.debugDmgMul === 2) game.debugDmgMul = 5;
      else game.debugDmgMul = 1;
      debugSync();
    });

    addBtn('刷：追踪石', null, function () { if (game.mode === 'play') spawnHoming(); });
    addBtn('刷：陨石墙', null, function () { if (game.mode === 'play') spawnWall(); });
    addBtn('刷：黑洞', null, function () { if (game.mode === 'play' && holes.length === 0) spawnHole(); });
    addBtn('刷：激光卫星', null, function () { if (game.mode === 'play') spawnSat(); });
    addBtn('刷：坠石', null, function () { if (game.mode === 'play') spawnStrike(); });

    var jumpRow = document.createElement('div');
    jumpRow.style.cssText = 'display:flex;gap:4px;margin:5px 0;';

    var jumpInput = document.createElement('input');
    jumpInput.type = 'number';
    jumpInput.min = '1';
    jumpInput.max = '999';
    jumpInput.placeholder = '波次';
    jumpInput.style.cssText =
      'flex:1;width:0;padding:5px 6px;background:rgba(2,8,16,.85);' +
      'border:1px solid rgba(57,246,255,.35);border-radius:6px;color:#d8f6ff;' +
      'font:12px -apple-system,sans-serif;';

    var jumpBtn = document.createElement('button');
    jumpBtn.textContent = '跳';
    jumpBtn.style.cssText =
      'padding:5px 10px;cursor:pointer;background:rgba(57,246,255,.12);' +
      'border:1px solid rgba(57,246,255,.4);border-radius:6px;color:#d8f6ff;' +
      'font:12px -apple-system,sans-serif;';
    jumpBtn.addEventListener('click', function () {
      debugJumpTo(jumpInput.value);
    });

    jumpRow.appendChild(jumpInput);
    jumpRow.appendChild(jumpBtn);
    wrap.appendChild(jumpRow);

    addBtn('清空排行榜', null, function () {
      try {
        localStorage.removeItem('neonDodgeTop5');
        localStorage.removeItem('neonDodgeTop5:' + todayKey());
      } catch (e) {}
      refreshBestName();
    });
          addBtn('清空成就', null, function () {
      for (var ak in unlocked) delete unlocked[ak];
      try { localStorage.removeItem('neonDodgeAch'); } catch (e) {}
      if (achOpen) showAchievements();
    });
    addBtn('解锁全部成就', null, function () {
      var now = Date.now();
      for (var i = 0; i < ACH_LIST.length; i++) {
        if (!unlocked[ACH_LIST[i].id]) unlocked[ACH_LIST[i].id] = now - i * 86400000;
      }
      try { localStorage.setItem('neonDodgeAch', JSON.stringify(unlocked)); } catch (e) {}
      if (achOpen) showAchievements();
    });

    addBtn('冲刺无 CD：关', 'dbgNoCd', function () {
      game.debugNoDashCd = !game.debugNoDashCd;
      debugSync();
    });

    addBtn('冻结敌人：关', 'dbgFreeze', function () {
      game.debugFreeze = !game.debugFreeze;
      debugSync();
    });
    addBtn('跳到下一 Boss', null, function () {
      if (game.mode !== 'play') return;

      if (game.shopOpen) {
        game.shopOpen = false;
        var upBox = document.getElementById('upgrade');
        if (upBox) upBox.classList.remove('show');
      }

      var next = Math.floor(game.wave / 4) * 4 + 4;
      game.wave = next - 1;

      meteors.length = 0;
      warns.length = 0;
      bullets.length = 0;
      game.boss = null;

      startWave();
    });



    addBtn('给全套武器 Lv5', null, function () {
      player.weapons = [];
      for (var i = 0; i < WEAPON_KEYS.length; i++) {
        player.weapons.push({ type: WEAPON_KEYS[i], lv: 5 });
      }
    });

    addBtn('跳过本波', null, function () {
      if (game.mode === 'play' && game.waveState === 'battle') endWave();
    });

    addBtn('秒杀 Boss', null, function () {
      if (game.boss) bossDefeat();
    });

    addBtn('清空陨石', null, function () { meteors.length = 0; });

    addBtn('速度 x1', 'dbgSpd', function () {
      if (game.debugSpeed === 1) game.debugSpeed = 2;
      else if (game.debugSpeed === 2) game.debugSpeed = 4;
      else game.debugSpeed = 1;
      debugSync();
    });

    addBtn('重新开局', null, function () {
      startGame(game.prefDaily);
    });

    document.body.appendChild(wrap);
    setInterval(debugRefresh, 250);
  }

  function debugSync() {
    var a = document.getElementById('dbgInv');
    var b = document.getElementById('dbgOne');
    var c = document.getElementById('dbgSpd');
    if (a) a.textContent = '无敌：' + (game.debugInv ? '开' : '关');
        if (b) b.textContent = '一击必碎：' + (game.debugOneShot ? '开' : '关');

        var d = document.getElementById('dbgBoss');
    if (d) d.textContent = 'Boss 一击必杀：' + (game.debugBossOneShot ? '开' : '关');

        var e = document.getElementById('dbgSkipShop');
        if (e) e.textContent = '自动跳过商店：' + (game.debugSkipShop ? '开' : '关');

    var hb = document.getElementById('dbgHitbox');
    if (hb) hb.textContent = '显示判定框：' + (game.debugHitbox ? '开' : '关');
        var na = document.getElementById('dbgNoAtk');
    if (na) na.textContent = '停止攻击：' + (game.debugNoAttack ? '开' : '关');

    var fs = document.getElementById('dbgFree');
    if (fs) fs.textContent = '材料不减：' + (game.debugFreeShop ? '开' : '关');

    var dm = document.getElementById('dbgDmg');
    if (dm) dm.textContent = '伤害 x' + game.debugDmgMul;
    var f = document.getElementById('dbgNoCd');
    if (f) f.textContent = '冲刺无 CD：' + (game.debugNoDashCd ? '开' : '关');

    var h = document.getElementById('dbgFreeze');
    if (h) h.textContent = '冻结敌人：' + (game.debugFreeze ? '开' : '关');
    if (c) c.textContent = '速度 x' + game.debugSpeed;
  }

  function debugRefresh() {
    var el = document.getElementById('dbgInfo');
    if (!el || !game.debug) return;

    el.textContent =
      '波次 ' + game.wave + '　' + game.waveState + '\n' +
      '击杀 ' + game.waveKills + '　材料 ' + game.mat + '\n' +
      '陨石 ' + meteors.length + '　子弹 ' + bullets.length + '\n' +
      'FPS ' + (game.fps || 0);

    var panel = document.getElementById('dbgPanel');
    if (panel && panel.parentNode !== document.body) {
      document.body.appendChild(panel);
    }
  }

  function debugToggle() {
    game.debug = !game.debug;
    var el = document.getElementById('dbgPanel');
    if (el) {
      el.style.display = game.debug ? 'block' : 'none';
      if (game.debug) document.body.appendChild(el);
    }
    debugSync();
    if (game.debug) debugRefresh();
  }


  /* ==================== 主循环 ==================== */
  var lastTime = 0;

  function frame(now) {
    requestAnimationFrame(frame);

    if (!lastTime) lastTime = now;
          var dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0) game.fps = Math.round(1 / dt);
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    if (game.debug && game.debugSpeed > 1) dt = Math.min(0.12, dt * game.debugSpeed);

    if (game.glitchT > 0) game.glitchT -= dt;

        if (!game.paused && !game.upgrading && !game.shopOpen) {
      if (game.hitstop > 0) game.hitstop -= dt;
      else update(dt);
    }

    var inten = 0;
    if (game.mode === 'play') inten = clamp((game.time - 6) / 45, 0, 1);
    if (player.dashTime > 0) inten = Math.min(1.6, inten + 0.9);
    if (!game.paused) updateSpeedLines(dt, inten);

    render();
  }

  /* ==================== 启动 ==================== */
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 150); });

    resize();
  resetPlayer();
  debugBuild();
  if (/(\?|&)debug=1/.test(location.search)) {
    game.debug = true;
    var dbgEl = document.getElementById('dbgPanel');
    if (dbgEl) dbgEl.style.display = 'block';
  }
  $best.textContent = String(game.best);
  refreshBestName();
  updateHUD();
  showMenu();
  requestAnimationFrame(frame);
})();
  