import { useEffect, useRef } from "react";
import type { AmbientPreset } from "../types";

interface NoiseGraph {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

function createNoiseBuffer(context: AudioContext, preset: AmbientPreset): AudioBuffer {
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  let previous = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;

    if (preset === "white") {
      data[index] = white * 0.35;
      continue;
    }

    if (preset === "rain") {
      const pink = 0.985 * previous + 0.015 * white;
      previous = pink;
      const droplet = Math.random() > 0.996 ? (Math.random() * 2 - 1) * 0.4 : 0;
      data[index] = (pink + droplet) * 0.45;
      continue;
    }

    previous = (previous + 0.04 * white) / 1.04;
    const lowHum = Math.sin((2 * Math.PI * index) / (context.sampleRate / 80)) * 0.03;
    data[index] = previous * 0.35 + lowHum;
  }

  return buffer;
}

function createGraph(context: AudioContext, preset: AmbientPreset): NoiseGraph {
  const source = context.createBufferSource();
  source.buffer = createNoiseBuffer(context, preset);
  source.loop = true;

  const gain = context.createGain();
  gain.gain.value = preset === "white" ? 0.12 : 0.09;

  if (preset === "white") {
    source.connect(gain);
  }

  if (preset === "rain") {
    const lowPass = context.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.value = 3400;

    const highPass = context.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.value = 280;

    source.connect(lowPass);
    lowPass.connect(highPass);
    highPass.connect(gain);
  }

  if (preset === "cafe") {
    const bandPass = context.createBiquadFilter();
    bandPass.type = "bandpass";
    bandPass.frequency.value = 760;
    bandPass.Q.value = 0.6;

    source.connect(bandPass);
    bandPass.connect(gain);
  }

  gain.connect(context.destination);
  source.start();

  return {
    source,
    gain
  };
}

export function useAmbientAudio(enabled: boolean, preset: AmbientPreset): void {
  const contextRef = useRef<AudioContext | null>(null);
  const graphRef = useRef<NoiseGraph | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (graphRef.current) {
        graphRef.current.source.stop();
        graphRef.current.source.disconnect();
        graphRef.current.gain.disconnect();
        graphRef.current = null;
      }
      return;
    }

    const context = contextRef.current ?? new AudioContext();
    contextRef.current = context;

    const run = async (): Promise<void> => {
      if (context.state !== "running") {
        await context.resume();
      }

      if (graphRef.current) {
        graphRef.current.source.stop();
        graphRef.current.source.disconnect();
        graphRef.current.gain.disconnect();
      }

      graphRef.current = createGraph(context, preset);
    };

    void run();

    return () => {
      if (!graphRef.current) {
        return;
      }

      graphRef.current.source.stop();
      graphRef.current.source.disconnect();
      graphRef.current.gain.disconnect();
      graphRef.current = null;
    };
  }, [enabled, preset]);

  useEffect(
    () => () => {
      if (contextRef.current) {
        void contextRef.current.close();
        contextRef.current = null;
      }
    },
    []
  );
}
