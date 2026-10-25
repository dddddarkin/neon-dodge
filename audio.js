/* 贴脸 · 音频模块（程序化音乐 + 音效） */
      var Sound = (function () {
        var ac = null, master = null, noiseBuf = null, muted = false, lastGraze = 0;

        var STEP_DUR = 60 / 96 / 4;
          var bgm = { gain: null, timer: null, on: false, step: 0, next: 0, level: 0, pattern: 0, tempo: 1, pitch: 0 };

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
        function bBass(t, freq, dur, wave, bright) {
          if (!ac || muted) return;
          var o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
          var br = bright || 1;
          f.type = 'lowpass';
          f.frequency.setValueAtTime(620 * br, t);
          f.frequency.exponentialRampToValueAtTime(180 * br, t + dur * 0.8);
          f.Q.value = 6;
          o.type = wave || 'sawtooth';
          o.frequency.setValueAtTime(freq, t);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(f); f.connect(g); g.connect(bgm.gain);
          o.start(t); o.stop(t + dur + 0.05);
        }

        function bArp(t, freq, wave) {
          if (!ac || muted) return;
          var o = ac.createOscillator(), g = ac.createGain();
          o.type = wave || 'square';
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
      },
      {
        name: '熔渣海',
        transpose: -2,
        chords: [
          { root: 0,  third: 3, fifth: 7 },
          { root: 5,  third: 4, fifth: 7 },
          { root: -3, third: 4, fifth: 7 },
          { root: 2,  third: 3, fifth: 7 }
        ]
      },
      {
        name: '回声壁',
        transpose: 5,
        chords: [
          { root: -2, third: 4, fifth: 7 },
          { root: 3,  third: 4, fifth: 7 },
          { root: -5, third: 3, fifth: 7 },
          { root: 0,  third: 4, fifth: 7 }
        ]
      }
    ];

    /* ==================== 音乐风格包（每局/每章随机） ==================== */
    var MUSIC_STYLES = [
      {
        name: '霓虹脉冲', chordSet: 0, tempo: 1.0,
        leadWave: 'triangle', arpWave: 'square', bassWave: 'sawtooth', chordWave: 'triangle',
        kick: 'normal', hat: 'offbeat',
        bassPat: [0, -1, 12, -1],
        mel: [12, -1, -1, 15, -1, 19, -1, -1, 17, -1, 15, -1, -1, 12, -1, -1],
        mels: [
          [12, -1, -1, 15, -1, 19, -1, -1, 17, -1, 15, -1, -1, 12, -1, -1],
          [19, -1, 17, -1, 15, -1, -1, 12, -1, 15, -1, 17, -1, 19, -1, -1],
          [12, 15, -1, 19, -1, -1, 17, -1, 15, -1, 12, -1, 7, -1, -1, -1]
        ]
      },
      {
        name: '深空回声', chordSet: 2, tempo: 0.82,
        leadWave: 'sine', arpWave: 'triangle', bassWave: 'sine', chordWave: 'sine',
        kick: 'sparse', hat: 'offbeat',
        bassPat: [0, -1, -1, 12],
        mel: [-1, 12, -1, -1, 19, -1, -1, 15, -1, -1, 12, -1, 7, -1, -1, -1],
        mels: [
          [-1, 12, -1, -1, 19, -1, -1, 15, -1, -1, 12, -1, 7, -1, -1, -1],
          [-1, -1, 19, -1, -1, 12, -1, -1, 15, -1, -1, -1, 12, -1, 7, -1]
        ]
      },
      {
        name: '工业碾核', chordSet: 3, tempo: 1.22,
        leadWave: 'sawtooth', arpWave: 'square', bassWave: 'square', chordWave: 'sawtooth',
        kick: 'dense', hat: 'dense',
        bassPat: [0, 0, 12, 0],
        mel: [0, 0, 7, -1, 0, 0, 10, -1, 0, 0, 7, -1, 5, 3, 0, -1]
      },
      {
        name: '冷光旋律', chordSet: 1, tempo: 1.08,
        leadWave: 'square', arpWave: 'triangle', bassWave: 'sawtooth', chordWave: 'triangle',
        kick: 'normal', hat: 'dense',
        bassPat: [0, -1, 7, -1],
        mel: [19, -1, 15, -1, 12, -1, 19, 22, 17, -1, 15, -1, 12, -1, -1, -1]
      },
      {
        name: '低频压迫', chordSet: 4, tempo: 0.9,
        leadWave: 'triangle', arpWave: 'sine', bassWave: 'sine', chordWave: 'triangle',
        kick: 'normal', hat: 'offbeat',
        bassPat: [0, -1, -1, -1],
        mel: [7, -1, -1, -1, 12, -1, -1, -1, 10, -1, -1, 7, -1, -1, -1, -1]
      },
      {
        name: '故障回旋', chordSet: 5, tempo: 1.14,
        leadWave: 'square', arpWave: 'sawtooth', bassWave: 'sawtooth', chordWave: 'square',
        kick: 'dense', hat: 'dense',
        bassPat: [0, 1, 12, 10],
        mel: [12, 13, -1, 15, -1, 14, 12, -1, 19, -1, 17, 15, -1, 14, -1, 12]
      },
      {
        name: '氛围空间', chordSet: 2, tempo: 0.7,
        leadWave: 'sine', arpWave: 'sine', bassWave: 'sine', chordWave: 'sine', bright: 0.7,
        kick: 'sparse', hat: 'none',
        bassPat: [0, -1, -1, -1],
        mel: [-1, -1, 12, -1, -1, -1, 19, -1, -1, -1, 15, -1, -1, 12, -1, -1]
      },
      {
        name: '碎拍切割', chordSet: 3, tempo: 1.3,
        leadWave: 'square', arpWave: 'sawtooth', bassWave: 'square', chordWave: 'square', bright: 1.15,
        kick: 'break', hat: 'dense',
        bassPat: [0, -1, -1, 12, -1, 0, -1, -1, 7, -1, 12, -1, -1, 5, -1, -1],
        mel: [15, -1, 12, -1, 17, -1, 15, 12, -1, 19, -1, 15, -1, 12, -1, -1]
      },
      {
        name: '霓虹迪斯科', chordSet: 1, tempo: 1.16,
        leadWave: 'triangle', arpWave: 'square', bassWave: 'sawtooth', chordWave: 'triangle',
        kick: 'four', hat: 'dense',
        bassPat: [0, -1, 12, -1],
        mel: [19, -1, 19, -1, 15, -1, 17, -1, 19, -1, 22, -1, 19, 15, -1, -1]
      }
    ];

    var MUSIC_STYLE_KEY = 'neonDodgeMusicStyle';

    function musicLast() {
      try { return localStorage.getItem(MUSIC_STYLE_KEY) || ''; } catch (e) { return ''; }
    }

    function musicPick(avoid) {
      var cands = [];
      for (var i = 0; i < MUSIC_STYLES.length; i++) {
        if (MUSIC_STYLES[i].name === avoid) continue;
        cands.push(MUSIC_STYLES[i]);
      }
      if (!cands.length) cands = MUSIC_STYLES.slice(0);
      var pick = cands[Math.floor(Math.random() * cands.length)];
      try { localStorage.setItem(MUSIC_STYLE_KEY, pick.name); } catch (e) { }
      return pick;
    }

    /* 旧版共用旋律已移除，每个风格包自带 mel */

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

    function bLead(t, freq, dur, wave, bright) {
      if (!ac || muted) return;

      var o = ac.createOscillator();
      var f = ac.createBiquadFilter();
      var g = ac.createGain();

      f.type = 'lowpass';
      f.frequency.setValueAtTime(2800 * (bright || 1), t);
      f.Q.value = 1;

      o.type = wave || 'triangle';
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

    function bChord(t, root, chord, pf, wave) {
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

        o.type = i === 0 ? (wave || 'triangle') : 'sine';
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
      var bar32 = Math.floor(step / 16) % 32;
      var section = Math.floor(bar32 / 8);      // 0 引子 / 1 主题 / 2 推进 / 3 高潮
      var barInSec = bar32 % 8;

      // 每 4 小节（一个乐句）换一种变奏
      var phrase = Math.floor(step / 64);
      if (phrase !== bgm.phrase) {
        bgm.phrase = phrase;
        bgm.phraseVar = Math.floor(Math.random() * 4);
      }
      var pv = bgm.phraseVar || 0;

      var st = bgm.style || MUSIC_STYLES[0];
      var music = CHAPTER_MUSIC[st.chordSet % CHAPTER_MUSIC.length];
      var ci = (section >= 2) ? (Math.floor(step / 8) % 4) : (Math.floor(step / 16) % 4);
      var chord = music.chords[ci];

      var pf = Math.pow(2, bgm.pitch / 12);
      var root = 110 * pf * Math.pow(2, (chord.root + music.transpose) / 12);
      var bright = [0.55, 1, 1.3, 1.65][section] * (st.bright || 1);

      var kickOn = false;
      if (st.kick === 'dense' || st.kick === 'four') kickOn = (s16 % 4 === 0);
      else if (st.kick === 'sparse') kickOn = (s16 === 0);
      else if (st.kick === 'break') kickOn = (s16 === 3 || s16 === 10 || s16 === 14);
      else kickOn = (s16 % 8 === 0);
      if (section === 0) kickOn = kickOn && (s16 % 8 === 0);
      if (section === 3 && st.kick !== 'break') kickOn = kickOn || s16 === 14;
      if (kickOn) bKick(t);

      var bs = (st.bassPat.length === 16) ? st.bassPat[s16] : st.bassPat[s16 % 4];
      if (bs >= 0) {
        var boct = (section === 3) ? 12 : 0;
        bBass(t, root * Math.pow(2, (bs + boct) / 12), STEP_DUR * (section === 0 ? 2.4 : 1.8), st.bassWave, bright);
      }

      var arpRate = (section === 0) ? 4 : (section >= 2 ? 1 : 2);
      if (bgm.level >= 1 && s16 % arpRate === 0) {
        var arpNotes = [chord.root, chord.root + chord.third, chord.root + chord.fifth, chord.root + 12];
        var ai = Math.floor(step / arpRate);
        var an = arpNotes[(pv === 2 ? (arpNotes.length - 1 - (ai % arpNotes.length)) : (ai % arpNotes.length))];
        var oct = (section >= 2) ? 12 : 0;
        bArp(t, 220 * pf * Math.pow(2, (an + oct + music.transpose) / 12), st.arpWave);
      }

      if (st.hat === 'dense') {
        if (s16 % 2 === 1 || section >= 2) bHat(t);
      } else if (st.hat === 'offbeat') {
        if (bgm.level >= 2 && s16 % 2 === 1) bHat(t);
      }
      if (st.hat !== 'none' && section >= 2 && s16 === 15) bHat(t);

      var playMel = false, melShift = 0;
      if (section === 0) playMel = (barInSec % 4 === 0);
      else if (section === 1) playMel = (barInSec % 2 === 0);
      else playMel = true;
      if (playMel) {
        var mels = st.mels || null;
        var src = mels ? mels[pv % mels.length] : st.mel;
        var mn = src[s16];
        if (mn >= 0 && pv === 1) mn -= 12;                      // 变奏：低八度
        if (mn >= 0 && pv === 2 && s16 % 8 >= 4) mn += 7;       // 变奏：后半句上行七度
        if (mn >= 0 && pv === 3 && s16 % 2 === 1) mn = -1;      // 变奏：切碎
        if (mn >= 0) {
          var trans = music.transpose + melShift + ((section === 2 && s16 % 4 === 0) ? 7 : 0);
          bLead(t, 220 * pf * Math.pow(2, (mn + trans) / 12), STEP_DUR * (section === 0 ? 3.4 : 2.6), st.leadWave, bright);
        }
      }

      // 乐句末尾：贝斯过门
      if (pv >= 2 && s16 === 15) bBass(t, root * 2, STEP_DUR * 0.5, st.bassWave, bright);

      if (bgm.level >= 2 && (s16 === 0 || (section === 3 && s16 === 8))) bChord(t, root, chord, pf, st.chordWave);

      if (barInSec === 7 && section >= 1 && s16 >= 12 && s16 % 2 === 0) bHat(t);
      if (s16 === 14 && barInSec === 7 && section >= 1) {
        bHat(t);
        if (section >= 2) bKick(t);
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
                    bgm.step = (bgm.step + 1) % 512;
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
          bgm.style = musicPick(musicLast());
          bgm.phrase = -1;
          bgm.pattern = 0;
          bgm.level = 0;
         bgm.step = 0;
         bgm.on = true;
         bgm.tempo = bgm.style.tempo;
         bgm.pitch = 0;
          bgm.next = ac.currentTime + 0.08;

          var t = ac.currentTime;
          bgm.gain.gain.cancelScheduledValues(t);
          bgm.gain.gain.setValueAtTime(0.0001, t);
          bgm.gain.gain.exponentialRampToValueAtTime(1, t + 1.0);
          if (bgm.timer) clearInterval(bgm.timer);
          bgm.timer = setInterval(bgmTick, 25);
        }

        function bgmRestyle() {
          if (!bgm.on || !ac) return;
          bgm.style = musicPick(bgm.style ? bgm.style.name : '');
          bgm.phrase = -1;
          bgm.tempo = bgm.style.tempo;
          bgm.step = 0;
          bgm.next = Math.max(bgm.next, ac.currentTime + 0.05);
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
        } else if (type === 'shock') {
          noise(0.15, 0.13, 900, 120, 'lowpass');
          tone(130, 48, 0.2, 'square', 0.07);
        } else if (type === 'boomerang') {
          tone(760, 1240, 0.1, 'sine', 0.05);
          noise(0.08, 0.04, 2600, 1200, 'bandpass');
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
          execTick: function () { tone(220, 90, 0.14, 'sine', 0.16); },
    dangerBurst: function () {
      tone(110, 520, 0.34, 'sawtooth', 0.2);
      tone(72, 220, 0.52, 'sine', 0.18, 0.04);
      noise(0.22, 0.1, 1800, 300, 'highpass');
    },
          execGo: function () { tone(520, 1560, 0.35, 'triangle', 0.16); tone(120, 60, 0.5, 'sawtooth', 0.1); },
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
        bgmRestyle: bgmRestyle,
        musicPick: musicPick,
        MUSIC_STYLES: MUSIC_STYLES,
        bgmState: bgm,
          bgmPause: bgmPause,
          bgmResume: bgmResume,
          setBgmLevel: function (n) { bgm.level = n; },
          setBgmTempo: function (tempo, pitch) {
        var base = bgm.style ? bgm.style.tempo : 1;
        bgm.tempo = base * (tempo || 1);
        bgm.pitch = pitch || 0;
      }
        };
      })();
