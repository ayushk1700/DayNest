import { isMusicEqPreset, musicEqPreset, type MusicEqPreset } from '../music/equalizer';

interface EqChrome {
  runtime: { onMessage: { addListener(listener: (message: unknown, sender: { id?: string }, sendResponse: (response: unknown) => void) => boolean | void): void }; id?: string };
}
const chromeApi = (globalThis as typeof globalThis & { chrome?: EqChrome }).chrome;
let context: AudioContext | undefined;
let stream: MediaStream | undefined;
let filters: BiquadFilterNode[] = [];
let eqOutput: AudioNode | undefined;
let compressor: DynamicsCompressorNode | undefined;
let spatialNodes: AudioNode[] = [];
let spatialEnabled = false;

function applyPreset(value: unknown) {
  if (!isMusicEqPreset(value) || !context) return false;
  const preset = musicEqPreset(value);
  filters.forEach((filter, index) => filter.gain.setTargetAtTime(preset.bands[index] ?? 0, context!.currentTime, 0.08));
  return true;
}

async function stop() {
  stream?.getTracks().forEach(track => track.stop());
  stream = undefined;
  spatialNodes.forEach(node => node.disconnect());
  spatialNodes = [];
  eqOutput?.disconnect();
  eqOutput = undefined;
  compressor = undefined;
  spatialEnabled = false;
  filters = [];
  if (context) await context.close().catch(() => undefined);
  context = undefined;
}

function applySpatial(enabled: boolean) {
  if (!context || !eqOutput || !compressor) return false;
  spatialNodes.forEach(node => node.disconnect());
  spatialNodes = [];
  eqOutput.disconnect();
  if (!enabled) {
    eqOutput.connect(compressor);
    spatialEnabled = false;
    return true;
  }

  // A lightweight center/side upmix: center-heavy material stays forward,
  // while side information is rendered as two wider headphone sources.
  const input = context.createChannelSplitter(2);
  const midLeft = context.createGain();
  const midRight = context.createGain();
  const sideLeft = context.createGain();
  const sideRight = context.createGain();
  for (const monoGain of [midLeft, midRight, sideLeft, sideRight]) {
    monoGain.channelCount = 1;
    monoGain.channelCountMode = 'explicit';
    monoGain.channelInterpretation = 'discrete';
  }
  midLeft.gain.value = 0.5;
  midRight.gain.value = 0.5;
  sideLeft.gain.value = 0.5;
  sideRight.gain.value = -0.5;
  const mid = context.createGain();
  const side = context.createGain();
  for (const monoGain of [mid, side]) {
    monoGain.channelCount = 1;
    monoGain.channelCountMode = 'explicit';
    monoGain.channelInterpretation = 'discrete';
  }
  midLeft.connect(mid);
  midRight.connect(mid);
  sideLeft.connect(side);
  sideRight.connect(side);

  const centerPanner = context.createPanner();
  const leftPanner = context.createPanner();
  const rightPanner = context.createPanner();
  for (const panner of [centerPanner, leftPanner, rightPanner]) {
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'linear';
    panner.refDistance = 1;
    panner.maxDistance = 10000;
    panner.rolloffFactor = 0;
    panner.positionY.value = 0;
    panner.positionZ.value = -1.25;
  }
  centerPanner.positionX.value = 0;
  leftPanner.positionX.value = -1.05;
  rightPanner.positionX.value = 1.05;
  const centerChannels = context.createChannelSplitter(2);
  const leftChannels = context.createChannelSplitter(2);
  const rightChannels = context.createChannelSplitter(2);
  const leftMix = context.createGain();
  const rightMix = context.createGain();
  leftMix.gain.value = 0.42;
  rightMix.gain.value = 0.42;
  const merger = context.createChannelMerger(2);
  const dryGain = context.createGain();
  const spatialGain = context.createGain();
  // Preserve the original stereo image and blend in a restrained HRTF layer.
  // A fully wet binaural render can sound distant or phasey on music mixes.
  dryGain.gain.value = 0.82;
  spatialGain.gain.value = 0.32;

  eqOutput.connect(dryGain);
  dryGain.connect(compressor);
  eqOutput.connect(input);
  input.connect(midLeft, 0);
  input.connect(midRight, 1);
  input.connect(sideLeft, 0);
  input.connect(sideRight, 1);
  mid.connect(centerPanner);
  side.connect(leftPanner);
  side.connect(rightPanner);
  centerPanner.connect(centerChannels);
  leftPanner.connect(leftChannels);
  rightPanner.connect(rightChannels);
  centerChannels.connect(leftMix, 0);
  centerChannels.connect(rightMix, 1);
  leftChannels.connect(leftMix, 0);
  rightChannels.connect(leftMix, 0);
  leftChannels.connect(rightMix, 1);
  rightChannels.connect(rightMix, 1);
  leftMix.connect(merger, 0, 0);
  rightMix.connect(merger, 0, 1);
  merger.connect(spatialGain);
  spatialGain.connect(compressor);
  spatialNodes = [input, midLeft, midRight, sideLeft, sideRight, mid, side, centerPanner, leftPanner, rightPanner, centerChannels, leftChannels, rightChannels, leftMix, rightMix, merger, dryGain, spatialGain];
  spatialEnabled = true;
  return true;
}

async function start(streamId: string, presetValue: unknown, spatial: boolean) {
  await stop();
  const constraints = {
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }
  } as unknown as MediaStreamConstraints;
  stream = await navigator.mediaDevices.getUserMedia(constraints);
  context = new AudioContext();
  if (context.state === 'suspended') await context.resume();
  const source = context.createMediaStreamSource(stream);
  const frequencies = [100, 250, 1000, 4000, 10000];
  const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
  filters = frequencies.map((frequency, index) => {
    const filter = context!.createBiquadFilter();
    filter.type = types[index];
    filter.frequency.value = frequency;
    filter.Q.value = index === 0 || index === 4 ? 0.75 : 1;
    return filter;
  });
  compressor = context.createDynamicsCompressor();
  // Keep EQ boosts below full scale, then catch remaining peaks after the
  // EQ/spatial branches. This avoids hard clipping on already-loud masters.
  compressor.threshold.value = -3;
  compressor.knee.value = 3;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.18;
  const output = context.createGain();
  output.gain.value = 0.96;
  const inputHeadroom = context.createGain();
  inputHeadroom.gain.value = 0.5;
  source.connect(inputHeadroom).connect(filters[0]);
  for (let index = 0; index < filters.length - 1; index++) filters[index].connect(filters[index + 1]);
  eqOutput = filters.at(-1)!;
  compressor.connect(output).connect(context.destination);
  applySpatial(spatial);
  stream.getAudioTracks().forEach(track => track.addEventListener('ended', () => { void stop(); }, { once: true }));
  if (!applyPreset(presetValue)) applyPreset('studio');
  return { ok: true, active: true, spatial: spatialEnabled, preset: isMusicEqPreset(presetValue) ? presetValue : 'studio' };
}

chromeApi?.runtime.onMessage.addListener((message, _sender, respond) => {
  if (!message || typeof message !== 'object') return;
  const request = message as { target?: string; type?: string; streamId?: string; preset?: MusicEqPreset; spatial?: boolean; enabled?: boolean };
  if (request.target !== 'equalizer-offscreen' || !request.type?.startsWith('music:eq:')) return;
  if (request.type === 'music:eq:start' && request.streamId) {
    void start(request.streamId, request.preset, request.spatial === true).then(respond, error => {
      void stop();
      respond({ ok: false, active: false, error: error instanceof Error ? error.message : 'Audio capture failed.' });
    });
    return true;
  }
  if (request.type === 'music:eq:set') { respond({ ok: true, active: !!context && applyPreset(request.preset), preset: request.preset }); return; }
  if (request.type === 'music:eq:spatial') { const applied = !!context && applySpatial(request.enabled === true); respond({ ok: true, active: !!context, spatial: context ? spatialEnabled : false, applied }); return; }
  if (request.type === 'music:eq:status') { respond({ ok: true, active: !!context, spatial: spatialEnabled }); return; }
  if (request.type === 'music:eq:stop') { void stop().then(() => respond({ ok: true, active: false })); return true; }
});
