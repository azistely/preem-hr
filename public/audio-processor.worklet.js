/**
 * AudioWorklet processor for capturing microphone audio as PCM chunks.
 * Buffers Float32 samples and posts them to the main thread when full.
 * Runs on the audio rendering thread for low-latency capture.
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 2048; // ~128ms at 16kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0];
    for (let i = 0; i < channel.length; i++) {
      this._buffer.push(channel[i]);
    }

    if (this._buffer.length >= this._bufferSize) {
      const chunk = new Float32Array(this._buffer);
      this.port.postMessage(chunk, [chunk.buffer]);
      this._buffer = [];
    }

    return true;
  }
}

registerProcessor('audio-capture', AudioCaptureProcessor);
