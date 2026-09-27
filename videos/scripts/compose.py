"""
The launch film's score, composed in code so it is ours outright (no licence).

120 BPM, 4/4, 28 bars (56 s), D major: Dmaj9 - Bm11 - Gmaj9 - Asus4 every
four bars. The sections follow the film's beat sheet (src/videos/launch/cues.ts):

  bars 1-2   logo: pad swell and a bell on the downbeat
  bars 3-4   first punchlines: pulse and sub bass come in
  bars 5-10  field app and review: the groove (kick, clap, hats, bass, arp)
  bar  11    punchline: drums thin out
  bars 12-15 trace a figure: full groove
  bar  16    build: riser and snare roll, last beat silent
  bars 17-22 the drop: reports and the assurance pack
  bars 23-24 breakdown for the last punchline
  bars 25-28 ending: impact, pad and bell hook, ring out

Also writes the film's sound effects (click, shutter, whoosh, chime, pop)
to sfx/ with each file's peak time in sfx-peaks.json.

  uv run --with numpy --with scipy python3 scripts/compose.py public/audio/launch
"""
import json
import os
import sys
import wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48_000
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 28
LENGTH = BARS * BAR
rng = np.random.default_rng(7)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def m(name):
    """'F#3' -> midi number."""
    pitch, octave = name[:-1], int(name[-1])
    return 12 * (octave + 1) + NOTE[pitch]


CHORDS = [
    ["D3", "F#3", "A3", "C#4", "E4"],  # Dmaj9
    ["B2", "D3", "F#3", "A3", "E4"],  # Bm11
    ["G2", "B2", "D3", "F#3", "A3"],  # Gmaj9
    ["A2", "D3", "E3", "A3", "C#4"],  # Asus4 (add 3 on top)
]
ROOTS = ["D2", "B1", "G1", "A1"]
ARP = [
    ["A4", "D5", "F#5", "E5"],
    ["F#4", "B4", "D5", "E5"],
    ["D5", "G4", "B4", "F#5"],
    ["E5", "A4", "C#5", "D5"],
]
HOOK = [  # bell hook over the drop and the ending, (beat offset in bar, note, beats)
    (0, "F#5", 1.5), (1.5, "E5", 0.5), (2, "D5", 1), (3, "A4", 1),
]


def t_at(bar, beat=1, frac=0.0):
    return ((bar - 1) * 4 + (beat - 1) + frac) * BEAT


def lp(x, cutoff, order=2):
    return sosfilt(butter(order, min(cutoff, SR / 2 - 100), "low", fs=SR, output="sos"), x)


def hp(x, cutoff, order=2):
    return sosfilt(butter(order, cutoff, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def adsr(n, a, d, s, r, sustain_len):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, int(sustain_len * SR) - a_n - d_n)
    env = np.concatenate([
        np.linspace(0, 1, max(a_n, 1), endpoint=False),
        np.linspace(1, s, max(d_n, 1), endpoint=False),
        np.full(s_n, s),
        np.linspace(s, 0, max(r_n, 1)),
    ])
    out = np.zeros(n)
    out[: min(n, len(env))] = env[:n]
    return out


def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((f * t + phase) % 1) - 1


class Mix:
    def __init__(self, seconds):
        self.n = int(seconds * SR)
        self.buses = {}

    def add(self, bus, start, signal, pan=0.0, gain=1.0):
        left, right = self.buses.setdefault(bus, (np.zeros(self.n), np.zeros(self.n)))
        i = int(start * SR)
        if i >= self.n:
            return
        sig = signal[: self.n - i] * gain
        lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        left[i : i + len(sig)] += sig * lg * 1.414
        right[i : i + len(sig)] += sig * rg * 1.414


# --- instruments ---------------------------------------------------------

def pad_note(f, seconds, cutoff):
    n = int((seconds + 1.4) * SR)
    voices = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-9, -3, 4, 10)) / 4
    voices = lp(voices, cutoff, 2)
    return voices * adsr(n, 0.7, 0.4, 0.8, 1.4, seconds)


def pluck(f, seconds=0.28, bright=2600):
    n = int((seconds + 0.2) * SR)
    t = np.arange(n) / SR
    tone = 0.6 * saw(f, n) + 0.4 * np.sign(np.sin(2 * np.pi * f * t))
    # A bright attack that closes into a dark body: two fixed filters crossfaded.
    out = lp(tone, bright) * np.exp(-t * 16) + lp(tone, 520) * np.exp(-t * 6) * 0.8
    return out * adsr(n, 0.003, 0.05, 0.7, 0.12, seconds)


def bass_note(f, seconds):
    n = int((seconds + 0.12) * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * f * t) + 0.35 * lp(saw(f, n), 420)
    return tone * adsr(n, 0.006, 0.12, 0.75, 0.1, seconds)


def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    freq = 46 + 90 * np.exp(-t * 32)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(n), 3000) * np.exp(-t * 400) * 0.25
    return np.tanh((body + click) * 1.6)


def clap():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 900, 3200)
    env = np.zeros(n)
    for k, off in enumerate((0, 0.011, 0.022)):
        env += (t >= off) * np.exp(-(t - off).clip(0) * (90 if k < 2 else 16))
    return noise * env * 0.7


def hat(open_=False):
    n = int((0.25 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7500) * np.exp(-t * (14 if open_ else 70)) * 0.5


def bell(f, seconds=1.8):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    tone = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in ((1, 1, 2.2), (2.0, 0.35, 3.5), (3.01, 0.18, 5), (4.2, 0.08, 7)))
    return tone * adsr(n, 0.002, 0.02, 1, 0.3, seconds - 0.3)


def riser(seconds):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    u = t / seconds
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    block = 2400
    for i in range(0, n, block):
        c = 400 + 9000 * u[i] ** 2
        out[i : i + block] = bp(noise[max(0, i - block): i + block], c * 0.6, min(c * 1.4, 20000))[-min(block, n - i):]
    return out * u ** 2.2 * 0.6


def impact():
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (38 + 40 * np.exp(-t * 6)) * t) * np.exp(-t * 2.2)
    air = lp(rng.standard_normal(n), 2500) * np.exp(-t * 5) * 0.35
    return np.tanh((boom + air) * 1.3)


def reverb(x, seconds=2.4, seed=1):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t * 6.9 / seconds)
    ir = lp(ir, 6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    return np.convolve(x, ir)[: len(x)] if len(x) < 200_000 else fft_conv(x, ir)


def fft_conv(x, ir):
    size = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)
    return y[: len(x)]


# --- arrangement ---------------------------------------------------------

def chord_of(bar):
    return (bar - 1) % 4


def compose():
    mix = Mix(LENGTH + 3.0)
    drums_on = set(range(5, 11)) | set(range(12, 17)) | set(range(17, 23))

    for bar in range(1, BARS + 1):
        c = chord_of(bar)
        start = t_at(bar)
        # Pad: through the whole film, brightening into the drop, bar 28 held.
        if bar <= 2:
            cutoff = 500 + 700 * (bar - 1 + 0.5)
        elif bar in (11, 16):
            cutoff = 900
        elif 17 <= bar <= 22:
            cutoff = 3400
        elif bar >= 25:
            cutoff = 2200
        else:
            cutoff = 1800
        length = BAR * (1.8 if bar == BARS else 1.0)
        for i, name in enumerate(CHORDS[c]):
            pan = -0.5 + i * 0.25
            mix.add("pad", start, pad_note(hz(m(name)), length, cutoff), pan, 0.16)
        if 17 <= bar <= 22 or bar >= 25:
            top = CHORDS[c][-1]
            mix.add("pad", start, pad_note(hz(m(top) + 12), length, cutoff), 0.3, 0.08)

        # Sub bass from bar 2, bass line 8ths in the grooves.
        root = hz(m(ROOTS[c]))
        if bar >= 2 and bar not in drums_on:
            mix.add("bass", start, bass_note(root, BAR * (1.6 if bar == BARS else 0.95)), 0, 0.55)
        if bar in drums_on:
            for eighth in range(8):
                f = root * (2 if eighth in (3, 7) else 1)
                mix.add("bass", start + eighth * BEAT / 2, bass_note(f, BEAT / 2 * 0.85), 0, 0.5)

        # Pulse: muted 8th plucks from bar 3 (not in the drop, where the arp leads).
        if 3 <= bar <= 16 or 23 <= bar <= 27:
            for eighth in range(8):
                note = CHORDS[c][1 if eighth % 2 else 2]
                g = 0.10 if bar in (11, 16) else 0.14
                mix.add("keys", start + eighth * BEAT / 2, pluck(hz(m(note) + 12), 0.16, 1600), 0.15 * (-1) ** eighth, g)

        # Arp: 16ths in the groove, brighter in the drop.
        if bar in drums_on:
            bright = 4200 if bar >= 17 else 2600
            g = 0.13 if bar >= 17 else (0.07 if bar <= 10 else 0.1)
            for s in range(16):
                note = ARP[c][s % 4]
                mix.add("keys", start + s * BEAT / 4, pluck(hz(m(note)), 0.2, bright), 0.35 * np.sin(s), g)

        # Drums.
        if bar in drums_on:
            for beat in range(4):
                bt = start + beat * BEAT
                mix.add("drums", bt, kick(), 0, 0.9)
                if beat in (1, 3):
                    mix.add("drums", bt, clap(), 0.05, 0.55)
                for s in range(4):
                    open_ = bar >= 17 and s == 2
                    mix.add("drums", bt + s * BEAT / 4, hat(open_), 0.25, 0.22 if s % 2 else 0.14)
        if bar == 11:  # punchline: soft kick on 1 and 3 only
            for beat in (0, 2):
                mix.add("drums", start + beat * BEAT, kick(), 0, 0.6)

        # Bells: the logo downbeat, and the hook in the drop and the ending.
        if bar == 1:
            mix.add("bells", start, bell(hz(m("D6")), 3.5), 0, 0.28)
            mix.add("bells", start + BEAT * 0.5, bell(hz(m("A5")), 3.0), 0.3, 0.14)
        if (17 <= bar <= 22 or 25 <= bar <= 27) and bar % 2 == 1:
            for off, name, beats in HOOK:
                mix.add("bells", start + off * BEAT, bell(hz(m(name)), 1.6), -0.2, 0.22)

    # Build into the drop (bar 16): riser, 16th snare roll, silence on the last beat.
    b16 = t_at(16)
    mix.add("fx", b16, riser(BAR - BEAT), 0, 0.5)
    for s in range(12):
        mix.add("drums", b16 + s * BEAT / 4, clap(), 0, 0.12 + 0.03 * s)
    # The drop and the ending.
    mix.add("fx", t_at(17), impact(), 0, 0.9)
    mix.add("fx", t_at(24, 3), riser(BEAT * 2), 0, 0.35)
    mix.add("fx", t_at(25), impact(), 0, 0.7)
    return mix


def master(mix):
    n = mix.n
    t = np.arange(n) / SR
    # Sidechain: duck pad, bass and keys on every kick in the groove.
    duck = np.ones(n)
    for bar in list(range(5, 11)) + list(range(12, 23)):
        for beat in range(4):
            i = int(t_at(bar, beat + 1) * SR)
            k = np.arange(int(0.3 * SR))
            seg = 1 - 0.45 * np.exp(-k / SR * 11)
            end = min(n, i + len(k))
            duck[i:end] = np.minimum(duck[i:end], seg[: end - i])
    # Cut the groove on the last beat of bar 16 (the breath before the drop).
    gap = np.ones(n)
    g0, g1 = int(t_at(16, 4) * SR), int(t_at(17) * SR)
    gap[g0:g1] = np.linspace(1, 0.15, g1 - g0) ** 3

    left = np.zeros(n)
    right = np.zeros(n)
    sends = {"pad": 0.35, "keys": 0.3, "bells": 0.55, "drums": 0.06, "bass": 0.0, "fx": 0.4}
    for bus, (l, r) in mix.buses.items():
        if bus in ("pad", "bass", "keys"):
            l, r = l * duck, r * duck
        if bus != "fx":
            l, r = l * gap, r * gap
        left += l
        right += r
        s = sends.get(bus, 0)
        if s:
            left += fft_conv(l, reverb_ir(1)) * s
            right += fft_conv(r, reverb_ir(2)) * s
    # Section levels (dB per bar) so the drop is the loudest thing in the film.
    levels = {1: -7, 2: -6, 3: -4.5, 4: -4.5, 11: -4.5, 16: -2.5, 23: -5, 24: -5, 25: -2, 26: -2.5, 27: -3, 28: -4}
    for bar in range(5, 16):
        levels.setdefault(bar, -3 if bar <= 10 else -2)
    for bar in range(17, 23):
        levels[bar] = 0
    curve = np.zeros(n)
    for bar in range(1, BARS + 2):
        a, b = int(t_at(bar) * SR), int(t_at(bar + 1) * SR)
        curve[a:b] = 10 ** (levels.get(min(bar, BARS), -4) / 20)
    ramp = int(0.03 * SR)
    curve = np.convolve(curve, np.ones(ramp) / ramp, mode="same")
    left, right = left * curve, right * curve
    stereo = np.stack([left, right], axis=1)
    stereo = hp(stereo.T, 28).T
    # Fade the ring-out and trim to the film length.
    end = int(LENGTH * SR)
    stereo = stereo[:end]
    fade = int(2.4 * SR)
    stereo[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
    stereo = np.tanh(stereo * 1.1)
    stereo *= 10 ** (-1 / 20) / np.max(np.abs(stereo))
    return stereo


_IR = {}


def reverb_ir(seed, seconds=2.6):
    if seed not in _IR:
        r = np.random.default_rng(seed)
        n = int(seconds * SR)
        t = np.arange(n) / SR
        ir = lp(r.standard_normal(n), 5500) * np.exp(-t * 6.9 / seconds)
        ir[: int(0.012 * SR)] = 0  # pre-delay
        _IR[seed] = ir / np.sqrt(np.sum(ir ** 2)) * 0.6
    return _IR[seed]


# --- sound effects -------------------------------------------------------

def sfx():
    n = lambda s: int(s * SR)
    out = {}
    t = np.arange(n(0.12)) / SR
    out["click"] = bp(rng.standard_normal(len(t)), 1800, 6000) * np.exp(-t * 180) * 0.6 + np.sin(2 * np.pi * 1400 * t) * np.exp(-t * 120) * 0.25
    t = np.arange(n(0.35)) / SR
    shutter = bp(rng.standard_normal(len(t)), 1200, 9000)
    out["shutter"] = shutter * (np.exp(-t * 60) + 0.7 * (t > 0.09) * np.exp(-(t - 0.09).clip(0) * 45)) * 0.6
    t = np.arange(n(0.7)) / SR
    u = t / 0.7
    w = rng.standard_normal(len(t))
    whoosh = np.zeros(len(t))
    for i in range(0, len(t), 1200):
        c = 500 + 4500 * np.sin(np.pi * u[i]) ** 2
        whoosh[i : i + 1200] = bp(w[max(0, i - 1200): i + 1200], c * 0.5, c * 1.5)[-min(1200, len(t) - i):]
    out["whoosh"] = whoosh * np.sin(np.pi * u) ** 2 * 0.8
    t = np.arange(n(1.4)) / SR
    out["chime"] = (bell(hz(m("A5")), 1.4) * 0.6 + np.pad(bell(hz(m("E6")), 1.3), (n(0.08), n(0.02)))[: len(t)] * 0.45)
    t = np.arange(n(0.15)) / SR
    out["pop"] = np.sin(2 * np.pi * (500 + 700 * np.exp(-t * 60)) * t) * np.exp(-t * 40) * 0.5
    return out


def write_wav(path, data):
    data = np.atleast_2d(data)
    if data.shape[0] < data.shape[1]:
        data = data.T
    pcm = np.int16(np.clip(data, -1, 1) * 32767)
    with wave.open(path, "wb") as f:
        f.setnchannels(pcm.shape[1])
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())


if __name__ == "__main__":
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "public/audio/launch"
    os.makedirs(os.path.join(out_dir, "sfx"), exist_ok=True)
    song = master(compose())
    write_wav(os.path.join(out_dir, "score.wav"), song)
    peaks = {}
    for name, sig in sfx().items():
        sig = sig / np.max(np.abs(sig)) * 0.9
        write_wav(os.path.join(out_dir, "sfx", f"{name}.wav"), sig)
        peaks[name] = round(float(np.argmax(np.abs(sig)) / SR), 4)
    with open(os.path.join(out_dir, "sfx-peaks.json"), "w") as f:
        json.dump(peaks, f, indent=2)
    print(f"score {len(song) / SR:.2f}s, sfx {sorted(peaks)}")
