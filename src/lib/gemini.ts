import { GoogleGenAI, Modality, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const getGeminiAI = () => {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  return new GoogleGenAI({ apiKey });
};

export const MODELS = {
  CHAT_PRO: 'gemini-3.1-pro-preview',
  CHAT_FLASH: 'gemini-3-flash-preview',
  CHAT_LITE: 'gemini-3.1-flash-lite-preview',
  IMAGE_FLASH: 'gemini-3.1-flash-image-preview',
  IMAGE_PRO: 'gemini-3-pro-image-preview',
  VIDEO: 'veo-3.1-lite-generate-preview',
  VIDEO_PRO: 'veo-3.1-generate-preview',
  LIVE: 'gemini-3.8-live',
  LIVE_EXTENDED_THINKING: 'gemini-3.8-live-extended-thinking',
  LIVE_FLASH: 'gemini-3.1-flash-live-preview',
};

export const LIVE_VOICE_MODELS = [
  { id: 'gemini-3.8-live', name: 'Gemini 3.8 Live (Fast Spoken Dialogue)' },
  { id: 'gemini-3.8-live-extended-thinking', name: 'Gemini 3.8 Live Extended Thinking (Deep Parallel Reasoning)' },
  { id: 'gemini-3.1-flash-live-preview', name: 'Gemini 3.1 Flash Live (Preview)' },
  { id: 'gemini-2.5-flash-live', name: 'Gemini 2.5 Flash Live' },
  { id: 'gemini-2.0-flash-live', name: 'Gemini 2.0 Flash Live' },
] as const;

export const DEFAULT_LIVE_WEBSOCKET_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export function isGeminiLiveModel(model?: string): boolean {
  if (!model) return false;
  const m = model.toLowerCase().trim();
  return (
    m === 'gemini-3.8-live' ||
    m === 'gemini-3.8-live-extended-thinking' ||
    m === 'models/gemini-3.8-live' ||
    m === 'models/gemini-3.8-live-extended-thinking' ||
    m.includes('-live') ||
    m.includes('live')
  );
}

export async function testGeminiLiveWebSocket(params: {
  apiKey: string;
  model: string;
  liveWsUrl?: string;
  timeoutMs?: number;
}): Promise<{ success: boolean; latencyMs: number; message?: string; error?: string }> {
  const startTime = Date.now();
  const timeoutMs = params.timeoutMs ?? 10000;
  const targetModel = params.model || 'gemini-3.8-live';
  const formattedModel = targetModel.startsWith('models/') ? targetModel : `models/${targetModel}`;

  const baseEndpoint = (params.liveWsUrl && params.liveWsUrl.trim())
    ? params.liveWsUrl.trim()
    : DEFAULT_LIVE_WEBSOCKET_URL;

  let wsUrl = baseEndpoint;
  if (!wsUrl.includes('key=')) {
    const separator = wsUrl.includes('?') ? '&' : '?';
    wsUrl = `${wsUrl}${separator}key=${encodeURIComponent(params.apiKey)}`;
  }

  return new Promise((resolve) => {
    let settled = false;
    let ws: any = null;

    const cleanup = () => {
      clearTimeout(timer);
      if (ws) {
        try {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;
          if (ws.readyState === (ws.OPEN || 1) || ws.readyState === (ws.CONNECTING || 0)) {
            ws.close();
          }
        } catch (_) {}
      }
    };

    const finish = (result: { success: boolean; latencyMs: number; message?: string; error?: string }) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        success: false,
        latencyMs: Date.now() - startTime,
        error: `WebSocket connection timed out after ${timeoutMs}ms while connecting to live endpoint.`,
      });
    }, timeoutMs);

    try {
      const WebSocketClass = typeof WebSocket !== 'undefined' ? WebSocket : (globalThis as any).WebSocket;
      if (!WebSocketClass) {
        finish({
          success: false,
          latencyMs: Date.now() - startTime,
          error: 'WebSocket API is not supported in this runtime environment.',
        });
        return;
      }

      ws = new WebSocketClass(wsUrl);

      ws.onopen = () => {
        // Send Gemini Live BidiGenerateContent setup payload
        const setupMessage = {
          setup: {
            model: formattedModel,
          },
        };
        try {
          ws.send(JSON.stringify(setupMessage));
        } catch (sendErr: any) {
          finish({
            success: false,
            latencyMs: Date.now() - startTime,
            error: `Failed to send setup message over WebSocket: ${sendErr?.message || sendErr}`,
          });
        }
      };

      ws.onmessage = async (event: any) => {
        const latencyMs = Date.now() - startTime;
        let dataStr = '';
        try {
          if (typeof event.data === 'string') {
            dataStr = event.data;
          } else if (event.data instanceof Blob) {
            dataStr = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            dataStr = new TextDecoder().decode(event.data);
          } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(event.data)) {
            dataStr = event.data.toString('utf-8');
          } else if (event.data && typeof event.data.toString === 'function') {
            dataStr = event.data.toString();
          }

          const parsed = JSON.parse(dataStr);
          if (parsed.setupComplete !== undefined || parsed.serverContent !== undefined || parsed.toolCall !== undefined) {
            finish({
              success: true,
              latencyMs,
              message: `Successfully connected to Gemini Live (${targetModel}) via WebSocket (setup acknowledged in ${latencyMs}ms).`,
            });
            return;
          }

          if (parsed.error) {
            const errMsg = parsed.error.message || JSON.stringify(parsed.error);
            finish({
              success: false,
              latencyMs,
              error: `Gemini Live error: ${errMsg}`,
            });
            return;
          }

          finish({
            success: true,
            latencyMs,
            message: `Successfully connected to Gemini Live (${targetModel}) via WebSocket.`,
          });
        } catch (_) {
          finish({
            success: true,
            latencyMs,
            message: `Connected to Gemini Live WebSocket (${targetModel}).`,
          });
        }
      };

      ws.onerror = (err: any) => {
        const latencyMs = Date.now() - startTime;
        const msg = err?.message || (err?.error ? String(err.error) : 'WebSocket network error');
        finish({
          success: false,
          latencyMs,
          error: `WebSocket error connecting to ${baseEndpoint}: ${msg}`,
        });
      };

      ws.onclose = (event: any) => {
        const latencyMs = Date.now() - startTime;
        if (!settled) {
          const reason = event?.reason ? ` Reason: ${event.reason}` : '';
          const code = event?.code !== undefined ? ` (code ${event.code})` : '';
          finish({
            success: false,
            latencyMs,
            error: `WebSocket closed before setup completed${code}.${reason}`,
          });
        }
      };
    } catch (initErr: any) {
      finish({
        success: false,
        latencyMs: Date.now() - startTime,
        error: `Could not initiate WebSocket connection: ${initErr?.message || initErr}`,
      });
    }
  });
}

export async function streamGeminiLiveWebSocket(params: {
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  systemInstruction?: string;
  liveWsUrl?: string;
  callbacks: {
    onChunk: (text: string) => void;
    onMetadata?: (meta: any) => void;
    onDone: () => void;
    onError: (err: Error) => void;
  };
}): Promise<() => void> {
  const targetModel = params.model || 'gemini-3.8-live';
  const formattedModel = targetModel.startsWith('models/') ? targetModel : `models/${targetModel}`;

  const baseEndpoint = (params.liveWsUrl && params.liveWsUrl.trim())
    ? params.liveWsUrl.trim()
    : DEFAULT_LIVE_WEBSOCKET_URL;

  let wsUrl = baseEndpoint;
  if (!wsUrl.includes('key=')) {
    const separator = wsUrl.includes('?') ? '&' : '?';
    wsUrl = `${wsUrl}${separator}key=${encodeURIComponent(params.apiKey)}`;
  }

  const WebSocketClass = typeof WebSocket !== 'undefined' ? WebSocket : (globalThis as any).WebSocket;
  if (!WebSocketClass) {
    params.callbacks.onError(new Error('WebSocket API is not supported in this runtime environment.'));
    return () => {};
  }

  let ws: any = null;
  let isDone = false;
  let receivedAnyText = false;

  const closeWs = () => {
    if (ws) {
      try {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === (ws.OPEN || 1) || ws.readyState === (ws.CONNECTING || 0)) {
          ws.close();
        }
      } catch (_) {}
    }
  };

  try {
    ws = new WebSocketClass(wsUrl);

    ws.onopen = () => {
      const setupMessage: any = {
        setup: {
          model: formattedModel,
          generationConfig: {
            responseModalities: ["TEXT"],
          },
        },
      };
      if (params.systemInstruction) {
        setupMessage.setup.systemInstruction = {
          parts: [{ text: params.systemInstruction }],
        };
      }
      try {
        ws.send(JSON.stringify(setupMessage));
      } catch (sendErr: any) {
        if (!isDone) {
          isDone = true;
          params.callbacks.onError(new Error(`Failed to send setup message: ${sendErr?.message || sendErr}`));
          closeWs();
        }
      }
    };

    ws.onmessage = async (event: any) => {
      let dataStr = '';
      try {
        if (typeof event.data === 'string') {
          dataStr = event.data;
        } else if (event.data instanceof Blob) {
          dataStr = await event.data.text();
        } else if (event.data instanceof ArrayBuffer) {
          dataStr = new TextDecoder().decode(event.data);
        } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(event.data)) {
          dataStr = event.data.toString('utf-8');
        } else if (event.data && typeof event.data.toString === 'function') {
          dataStr = event.data.toString();
        }

        const parsed = JSON.parse(dataStr);

        if (parsed.setupComplete !== undefined) {
          const turns = params.messages.map((m) => ({
            role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.content || '' }],
          }));
          const clientContentMessage = {
            clientContent: {
              turns: turns.length > 0 ? turns : [{ role: 'user', parts: [{ text: 'Hello' }] }],
              turnComplete: true,
            },
          };
          ws.send(JSON.stringify(clientContentMessage));
          return;
        }

        if (parsed.error) {
          const errMsg = parsed.error.message || JSON.stringify(parsed.error);
          if (!isDone) {
            isDone = true;
            params.callbacks.onError(new Error(`Gemini Live WebSocket error: ${errMsg}`));
            closeWs();
          }
          return;
        }

        if (parsed.serverContent) {
          const parts = parsed.serverContent.modelTurn?.parts;
          if (Array.isArray(parts)) {
            for (const part of parts) {
              if (part?.text) {
                receivedAnyText = true;
                params.callbacks.onChunk(part.text);
              }
            }
          }

          if (parsed.serverContent.turnComplete) {
            if (!isDone) {
              isDone = true;
              params.callbacks.onDone();
              closeWs();
            }
            return;
          }
        }
      } catch (parseErr: any) {
        console.warn("[GeminiLiveWS] Message parse exception:", parseErr);
      }
    };

    ws.onerror = (err: any) => {
      if (!isDone) {
        isDone = true;
        const msg = err?.message || 'WebSocket connection error';
        params.callbacks.onError(new Error(`Gemini Live WebSocket error: ${msg}`));
        closeWs();
      }
    };

    ws.onclose = (event: any) => {
      if (!isDone) {
        isDone = true;
        if (receivedAnyText) {
          params.callbacks.onDone();
        } else if (event.code !== 1000) {
          params.callbacks.onError(new Error(`Gemini Live WebSocket closed (code ${event.code}: ${event.reason || 'connection closed'}).`));
        } else {
          params.callbacks.onDone();
        }
      }
    };
  } catch (initErr: any) {
    if (!isDone) {
      isDone = true;
      params.callbacks.onError(initErr instanceof Error ? initErr : new Error(String(initErr)));
    }
  }

  return () => {
    isDone = true;
    closeWs();
  };
}


export const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9", "1:4", "1:8", "4:1", "8:1"] as const;
export const IMAGE_SIZES = ["512px", "1K", "2K", "4K"] as const;
export const VIDEO_RESOLUTIONS = ["720p", "1080p", "4k"] as const;
export const VIDEO_FPS = [24, 30, 60] as const;
export const VIDEO_MODELS = [
  { id: MODELS.VIDEO, name: "Veo Fast (Preview)" },
  { id: MODELS.VIDEO_PRO, name: "Veo Pro (Preview)" },
] as const;

export { SIERRA_SAFETY_SETTINGS, SIERRA_CORE_PERSONA, SIERRA_PERSONAS } from './persona';

export const CHAT_MODELS = [
  { id: MODELS.CHAT_FLASH, name: "Gemini 3 Flash", badge: "Fast & Natural" },
  { id: MODELS.CHAT_LITE, name: "Gemini 3.1 Lite", badge: "Ultra Fast" },
  { id: MODELS.CHAT_PRO, name: "Gemini 3.1 Pro", badge: "Deep Reasoner" },
] as const;
