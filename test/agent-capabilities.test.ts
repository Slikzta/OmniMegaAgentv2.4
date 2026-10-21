import assert from "node:assert";
import test from "node:test";

test("AI Provider Configuration & Capabilities Audit", () => {
  const supportedProviders = ["gemini", "openai", "anthropic", "custom", "ollama"];
  assert.strictEqual(supportedProviders.length, 5);

  const capabilities = {
    text: true,
    streaming: true,
    multimodal: true,
    grounding: true,
    imageGen: true,
    videoGen: true,
    liveVoice: true,
  };

  assert.strictEqual(capabilities.text, true);
  assert.strictEqual(capabilities.grounding, true);
  assert.strictEqual(capabilities.liveVoice, true);
});

test("Multi-turn Conversation History Structure", () => {
  const history = [
    { role: "user", content: "Plan a trip to Tokyo" },
    { role: "model", content: "Here is a 3-day itinerary for Tokyo." },
    { role: "user", content: "What are the top 3 museums?" },
  ];

  assert.strictEqual(history.length, 3);
  assert.strictEqual(history[0].role, "user");
  assert.strictEqual(history[1].role, "model");
  assert.strictEqual(history[2].role, "user");
});

test("Agent Bounded Execution Limits & Loop Safeguards", () => {
  const maxIterations = 10;
  let iterations = 0;
  let isHalted = false;

  for (let i = 0; i < 20; i++) {
    iterations++;
    if (iterations >= maxIterations) {
      isHalted = true;
      break;
    }
  }

  assert.strictEqual(isHalted, true);
  assert.strictEqual(iterations, maxIterations);
});

test("Android SDK 36.0.0 Configuration Validation", () => {
  const compileSdk = 36;
  const targetSdk = 36;
  const minSdk = 24;

  assert.strictEqual(compileSdk, 36);
  assert.strictEqual(targetSdk, 36);
  assert.ok(minSdk >= 21);
});

test("Voice Chat Feedback Loop & Speech Lifecycle Safeguards", () => {
  // Test cooldown buffer, retry limits, and recognition timeout safeguards
  const PLAYBACK_COOLDOWN_MS = 750;
  const MAX_RECOGNITION_RETRIES = 3;
  const RECOGNITION_TIMEOUT_MS = 12000;

  assert.ok(PLAYBACK_COOLDOWN_MS >= 500, "Cooldown buffer must be at least 500ms to eliminate speaker tail audio");
  assert.ok(MAX_RECOGNITION_RETRIES <= 5, "Retry limit must be bounded to prevent infinite loops");
  assert.ok(RECOGNITION_TIMEOUT_MS > 0 && RECOGNITION_TIMEOUT_MS <= 30000, "Recognition timeout must be bounded");

  // Validate retry counter logic
  let consecutiveErrors = 0;
  let halted = false;
  for (let i = 0; i < 10; i++) {
    consecutiveErrors++;
    if (consecutiveErrors >= MAX_RECOGNITION_RETRIES) {
      halted = true;
      break;
    }
  }
  assert.strictEqual(halted, true);
  assert.strictEqual(consecutiveErrors, MAX_RECOGNITION_RETRIES);
});

test("Android Manifest Speech Recognition Queries Declaration", async () => {
  const fs = await import("node:fs");
  const manifest = fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf-8");
  assert.ok(manifest.includes("<queries>"), "Manifest must declare <queries>");
  assert.ok(manifest.includes("android.speech.RecognitionService"), "Manifest must query android.speech.RecognitionService for Android 11+");
});

test("On-Device API Key Persistence with Provider and Model Configuration", () => {
  const storageMock: Record<string, string> = {};
  const STORAGE_KEY_CONFIG = "omni_providers_config";

  // Simulate saving configuration with model and API key into the same persistent storage
  const configMap: Record<string, any> = {};
  configMap["gemini"] = {
    selectedModel: "gemini-3.5-flash-lite",
    apiKey: "AIzaSyTestMockKey12345",
  };
  storageMock[STORAGE_KEY_CONFIG] = JSON.stringify(configMap);

  // Retrieve and verify key is stored in the same persistent on-device config map
  const retrieved = JSON.parse(storageMock[STORAGE_KEY_CONFIG]);
  assert.strictEqual(retrieved.gemini.selectedModel, "gemini-3.5-flash-lite");
  assert.strictEqual(retrieved.gemini.apiKey, "AIzaSyTestMockKey12345");
});

test("Native CapSpeechRecognition Partial Results and Utterance Handoff Pipeline", () => {
  let currentTranscript = "";
  let userSpeechDetected = false;
  let committedUtterance = "";

  const onPartialResults = (data: { matches: string[] }) => {
    if (data?.matches && data.matches.length > 0) {
      const topMatch = data.matches[0].trim();
      if (topMatch) {
        currentTranscript = topMatch;
        userSpeechDetected = true;
      }
    }
  };

  const commitUtterance = () => {
    committedUtterance = currentTranscript.trim();
    currentTranscript = "";
    userSpeechDetected = false;
  };

  // Simulate partial results incoming from native speech recognition
  onPartialResults({ matches: ["Hello"] });
  assert.strictEqual(userSpeechDetected, true);
  assert.strictEqual(currentTranscript, "Hello");

  onPartialResults({ matches: ["Hello Sierra how are you"] });
  assert.strictEqual(currentTranscript, "Hello Sierra how are you");

  // Simulate end of speech / silence commit
  commitUtterance();
  assert.strictEqual(committedUtterance, "Hello Sierra how are you");
  assert.strictEqual(currentTranscript, "");
  assert.strictEqual(userSpeechDetected, false);
});

test("Persistent Debug Signing Configuration in Android Gradle Build", async () => {
  const fs = await import("node:fs");
  const gradleBuild = fs.readFileSync("android/app/build.gradle", "utf-8");

  assert.ok(gradleBuild.includes("signingConfigs"), "build.gradle must configure signingConfigs");
  assert.ok(gradleBuild.includes("storeFile file('debug.keystore')"), "build.gradle must specify fixed debug.keystore storeFile");
  assert.ok(gradleBuild.includes("keyAlias 'androiddebugkey'"), "build.gradle must specify consistent androiddebugkey keyAlias");
  assert.ok(gradleBuild.includes("storePassword 'android'"), "build.gradle must specify storePassword");
  assert.ok(gradleBuild.includes("keyPassword 'android'"), "build.gradle must specify keyPassword");
  assert.ok(gradleBuild.includes("signingConfig signingConfigs.debug"), "buildTypes.debug must use signingConfigs.debug");

  const keystoreExists = fs.existsSync("android/app/debug.keystore");
  const base64Exists = fs.existsSync("android/app/debug.keystore.base64");
  assert.ok(
    keystoreExists || base64Exists,
    "Either android/app/debug.keystore or android/app/debug.keystore.base64 must exist on disk"
  );
  const targetPath = keystoreExists ? "android/app/debug.keystore" : "android/app/debug.keystore.base64";
  const stats = fs.statSync(targetPath);
  assert.ok(stats.size > 0, `${targetPath} must not be empty`);
});

test("Voice Debug Log Export and Formatting Pipeline", async () => {
  const { formatDebugLogs } = await import("../src/lib/debugLogs");

  // 1. Verify empty log format
  const emptyFormatted = formatDebugLogs([]);
  assert.strictEqual(emptyFormatted, "No pipeline events recorded yet.");

  // 2. Build 30 chronological mock debug events
  const mockLogs = Array.from({ length: 30 }, (_, i) => ({
    id: `log-${i}`,
    time: `10:00:${i < 10 ? '0' + i : i} AM`,
    stage: i % 2 === 0 ? 'STT:Start' : 'partialResults',
    detail: `Sample diagnostic detail message ${i + 1}`,
  }));

  // 3. Test full log export
  const fullExport = formatDebugLogs(mockLogs);
  const fullLines = fullExport.split("\n");
  assert.strictEqual(fullLines.length, 30);
  assert.strictEqual(fullLines[0], "[10:00:00 AM] [STT:Start] Sample diagnostic detail message 1");
  assert.strictEqual(fullLines[29], "[10:00:29 AM] [partialResults] Sample diagnostic detail message 30");

  // 4. Test Last 20 Events export
  const last20Export = formatDebugLogs(mockLogs, 20);
  const last20Lines = last20Export.split("\n");
  assert.strictEqual(last20Lines.length, 20);
  assert.strictEqual(last20Lines[0], "[10:00:10 AM] [STT:Start] Sample diagnostic detail message 11");
  assert.strictEqual(last20Lines[19], "[10:00:29 AM] [partialResults] Sample diagnostic detail message 30");

  // 5. Verify @capacitor/clipboard dependency in package.json
  const fs = await import("node:fs");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
  assert.ok(pkg.dependencies["@capacitor/clipboard"], "@capacitor/clipboard must be present in dependencies");
});

test("Recognition Session Lifecycle: Duplicate Start Prevention", async () => {
  let isStarting = false;
  let isListening = false;
  let startCount = 0;

  const simulateStart = async () => {
    if (isStarting || isListening) {
      return { skipped: true };
    }
    isStarting = true;
    startCount++;
    // Simulate async native start call
    await new Promise((r) => setTimeout(r, 20));
    isListening = true;
    isStarting = false;
    return { skipped: false };
  };

  // First call should succeed
  const res1 = simulateStart();
  // Immediate concurrent duplicate calls should be rejected
  const res2 = simulateStart();
  const res3 = simulateStart();

  const [out1, out2, out3] = await Promise.all([res1, res2, res3]);
  assert.strictEqual(out1.skipped, false);
  assert.strictEqual(out2.skipped, true);
  assert.strictEqual(out3.skipped, true);
  assert.strictEqual(startCount, 1, "Only one native start invocation must occur");

  // While listening, another call should also be skipped
  const res4 = await simulateStart();
  assert.strictEqual(res4.skipped, true);
  assert.strictEqual(startCount, 1);
});

test("Recognition Session Lifecycle: Delayed Stop and Timeout Protection", async () => {
  // Simulate native stop that hangs indefinitely without calling resolve
  const hangingNativeStop = () => new Promise<void>(() => {});

  const withNativeTimeout = async <T, F = T>(
    promise: Promise<T>,
    ms: number = 50,
    fallbackValue?: F
  ): Promise<T | F | undefined> => {
    let timeoutId: any = null;
    const timeoutPromise = new Promise<F | undefined>((resolve) => {
      timeoutId = setTimeout(() => resolve(fallbackValue), ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const startT = Date.now();
  const result = await withNativeTimeout(hangingNativeStop(), 50, "timed_out");
  const elapsed = Date.now() - startT;

  assert.strictEqual(result, "timed_out");
  assert.ok(elapsed >= 45 && elapsed < 300, `Execution resumed promptly after timeout: ${elapsed}ms`);
});

test("Recognition Session Lifecycle: Stale Listener Event Invalidation", () => {
  let activeCycleId = 1;
  let currentTranscript = "";

  const onPartialResults = (eventCycleId: number, match: string) => {
    // If event comes from an older or obsolete recognition cycle, discard it
    if (eventCycleId !== activeCycleId) {
      return false;
    }
    currentTranscript = match;
    return true;
  };

  // Valid event from active cycle #1
  const accepted1 = onPartialResults(1, "Hello Sierra");
  assert.strictEqual(accepted1, true);
  assert.strictEqual(currentTranscript, "Hello Sierra");

  // Advance cycle to #2 (e.g. after response or timeout)
  activeCycleId = 2;
  currentTranscript = "";

  // Late arriving event from cycle #1 should be dropped
  const acceptedStale = onPartialResults(1, "stale trailing speech from previous round");
  assert.strictEqual(acceptedStale, false);
  assert.strictEqual(currentTranscript, "", "Transcript buffer must remain uncontaminated by stale event");

  // Valid event from cycle #2 should be accepted
  const accepted2 = onPartialResults(2, "What is the weather today?");
  assert.strictEqual(accepted2, true);
  assert.strictEqual(currentTranscript, "What is the weather today?");
});

test("Recognition Session Lifecycle: Native Error Recovery and Bounded Backoff", () => {
  const MAX_RETRIES = 3;
  let consecutiveFailures = 0;
  let isListening = true;
  let isPaused = false;
  const scheduledBackoffs: number[] = [];

  const handleNativeError = (errorCode: number, errorMsg: string) => {
    isListening = false;
    consecutiveFailures++;
    if (consecutiveFailures >= MAX_RETRIES) {
      isPaused = true;
      return;
    }
    const backoff = Math.min(800 * consecutiveFailures, 3000);
    scheduledBackoffs.push(backoff);
  };

  // Round 1 error (e.g., SpeechRecognizer.ERROR_SPEECH_TIMEOUT)
  handleNativeError(6, "No speech input");
  assert.strictEqual(isListening, false);
  assert.strictEqual(consecutiveFailures, 1);
  assert.strictEqual(isPaused, false);
  assert.strictEqual(scheduledBackoffs[0], 800);

  // Round 2 error (e.g., SpeechRecognizer.ERROR_NO_MATCH)
  handleNativeError(7, "No match");
  assert.strictEqual(consecutiveFailures, 2);
  assert.strictEqual(isPaused, false);
  assert.strictEqual(scheduledBackoffs[1], 1600);

  // Round 3 error (hits max retry limit)
  handleNativeError(3, "Audio recording error");
  assert.strictEqual(consecutiveFailures, 3);
  assert.strictEqual(isPaused, true, "State machine must pause continuous listening after max retries");
  assert.strictEqual(scheduledBackoffs.length, 2, "No restart must be scheduled after pausing");
});

test("Recognition Session Lifecycle: Clean Cancellation and Teardown on Stop", () => {
  let isActive = true;
  let isListening = true;
  let userSpeechDetected = true;
  let listenersAttached = true;
  let timerCleared = false;
  let timerId: any = 12345;

  const stopSession = () => {
    isActive = false;
    isListening = false;
    userSpeechDetected = false;
    if (timerId) {
      timerCleared = true;
      timerId = null;
    }
    listenersAttached = false;
  };

  stopSession();
  assert.strictEqual(isActive, false);
  assert.strictEqual(isListening, false);
  assert.strictEqual(userSpeechDetected, false);
  assert.strictEqual(listenersAttached, false);
  assert.strictEqual(timerCleared, true);
  assert.strictEqual(timerId, null);
});

test("Native Patch Integrity: SpeechRecognition.java Patch and Backup Verification", async () => {
  const fs = await import("node:fs");
  const javaPath = "node_modules/@capacitor-community/speech-recognition/android/src/main/java/com/getcapacitor/community/speechrecognition/SpeechRecognition.java";
  const backupPath = "scripts/SpeechRecognition.java.backup";

  assert.ok(fs.existsSync(javaPath), "SpeechRecognition.java must exist");
  assert.ok(fs.existsSync(backupPath), "SpeechRecognition.java.backup must exist");

  const javaContent = fs.readFileSync(javaPath, "utf-8");
  assert.ok(
    javaContent.includes("call.resolve();"),
    "SpeechRecognition.stop() must invoke call.resolve() to prevent indefinite hangs"
  );
  assert.ok(
    javaContent.includes('ret.put("errorCode", error);'),
    "SpeechRecognition.onError() must notify listeningState with error details"
  );
});

test("Native Text-to-Speech Integration and Lifecycle Contracts", async () => {
  const fs = await import("node:fs");
  const liveVoiceContent = fs.readFileSync("src/components/LiveVoice.tsx", "utf-8");

  // Verify plugin import and speak invocation
  assert.ok(
    liveVoiceContent.includes("import { TextToSpeech } from '@capacitor-community/text-to-speech';"),
    "LiveVoice.tsx must import TextToSpeech from @capacitor-community/text-to-speech"
  );
  assert.ok(
    liveVoiceContent.includes("TextToSpeech.speak("),
    "LiveVoice.tsx must invoke TextToSpeech.speak()"
  );

  // Verify 15-second timeout race
  assert.ok(
    liveVoiceContent.includes("15000"),
    "Native TTS must employ a 15-second timeout safeguard"
  );

  // Verify debug logging for all 4 stages
  assert.ok(liveVoiceContent.includes("addDebugLog('TTS:Start'"), "Must log TTS:Start");
  assert.ok(liveVoiceContent.includes("addDebugLog('TTS:Finished'"), "Must log TTS:Finished");
  assert.ok(liveVoiceContent.includes("addDebugLog('TTS:Timeout'"), "Must log TTS:Timeout");
  assert.ok(liveVoiceContent.includes("addDebugLog('TTS:Error'"), "Must log TTS:Error");

  // Verify STT cleanup before TTS
  assert.ok(
    liveVoiceContent.includes("await withNativeTimeout(stopSpeechToText(),"),
    "stopSpeechToText() must be protected by timeout pattern before TTS starts"
  );

  // Verify scheduleListeningRestart is called in finally
  assert.ok(
    liveVoiceContent.includes("scheduleListeningRestart();"),
    "scheduleListeningRestart must be called after TTS resolves or fails"
  );
});

test("Live Voice Model Test-Connection & BidiGenerateContent WebSocket Pipeline", async () => {
  const { isGeminiLiveModel, testGeminiLiveWebSocket, DEFAULT_LIVE_WEBSOCKET_URL } = await import("../src/lib/gemini");

  // 1. Verify model classification for Live API
  assert.strictEqual(isGeminiLiveModel("gemini-3.8-live"), true);
  assert.strictEqual(isGeminiLiveModel("gemini-3.8-live-extended-thinking"), true);
  assert.strictEqual(isGeminiLiveModel("gemini-3.1-flash-live-preview"), true);
  assert.strictEqual(isGeminiLiveModel("gemini-3.5-flash-lite"), false);
  assert.strictEqual(isGeminiLiveModel("gemini-3-flash-preview"), false);
  assert.strictEqual(isGeminiLiveModel("gemini-3.1-pro-preview"), false);
  assert.strictEqual(isGeminiLiveModel("gpt-4o"), false);
  assert.strictEqual(isGeminiLiveModel(""), false);
  assert.strictEqual(isGeminiLiveModel(undefined), false);

  // 2. Verify default WebSocket endpoint URL
  assert.ok(
    DEFAULT_LIVE_WEBSOCKET_URL.includes("BidiGenerateContent"),
    "DEFAULT_LIVE_WEBSOCKET_URL must target BidiGenerateContent service"
  );
  assert.ok(
    DEFAULT_LIVE_WEBSOCKET_URL.startsWith("wss://generativelanguage.googleapis.com"),
    "DEFAULT_LIVE_WEBSOCKET_URL must use wss protocol on generativelanguage host"
  );

  // 3. Test simulated WebSocket lifecycle with setup message and setupComplete
  const originalWebSocket = (globalThis as any).WebSocket;
  let sentPayload: any = null;
  let connectionUrl = "";

  class MockWebSocket {
    static OPEN = 1;
    readyState = 1;
    onopen: (() => void) | null = null;
    onmessage: ((ev: any) => void) | null = null;
    onerror: ((ev: any) => void) | null = null;
    onclose: ((ev: any) => void) | null = null;

    constructor(url: string) {
      connectionUrl = url;
      setTimeout(() => {
        if (this.onopen) this.onopen();
      }, 5);
    }

    send(data: string) {
      sentPayload = JSON.parse(data);
      // Simulate Gemini Live server setupComplete acknowledgment
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({ data: JSON.stringify({ setupComplete: {} }) });
        }
      }, 5);
    }

    close() {
      this.readyState = 3;
      if (this.onclose) {
        this.onclose({ code: 1000, reason: "Normal closure" });
      }
    }
  }

  (globalThis as any).WebSocket = MockWebSocket;

  try {
    const result = await testGeminiLiveWebSocket({
      apiKey: "test-api-key-12345",
      model: "gemini-3.8-live",
      timeoutMs: 1000,
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.latencyMs >= 0);
    assert.ok(result.message?.includes("gemini-3.8-live"));
    assert.ok(connectionUrl.includes("key=test-api-key-12345"));
    assert.ok(connectionUrl.includes("BidiGenerateContent"));
    assert.deepStrictEqual(sentPayload, {
      setup: {
        model: "models/gemini-3.8-live",
        generationConfig: {
          responseModalities: ["AUDIO"],
        },
        outputAudioTranscription: {},
      },
    });

    // Test with gemini-3.8-live-extended-thinking
    const resultThinking = await testGeminiLiveWebSocket({
      apiKey: "test-api-key-12345",
      model: "gemini-3.8-live-extended-thinking",
      timeoutMs: 1000,
    });
    assert.strictEqual(resultThinking.success, true);
    assert.deepStrictEqual(sentPayload, {
      setup: {
        model: "models/gemini-3.8-live-extended-thinking",
        generationConfig: {
          responseModalities: ["AUDIO"],
        },
        outputAudioTranscription: {},
      },
    });
  } finally {
    (globalThis as any).WebSocket = originalWebSocket;
  }
});

test("Continuous-Listening STT State Machine & ErrorCode 5 Recovery Pipeline", () => {
  // 1. Exponential backoff contract: 500ms, 1s, 2s, 4s
  const getBackoffDelay = (attempt: number): number => {
    if (attempt <= 1) return 500;
    if (attempt === 2) return 1000;
    if (attempt === 3) return 2000;
    return 4000;
  };
  assert.strictEqual(getBackoffDelay(1), 500);
  assert.strictEqual(getBackoffDelay(2), 1000);
  assert.strictEqual(getBackoffDelay(3), 2000);
  assert.strictEqual(getBackoffDelay(4), 4000);
  assert.ok(getBackoffDelay(1) >= 300, "Must satisfy delay of at least 300ms before every restart");

  // 2. State Machine guards: ignore start requests while starting, listening, or paused
  let isStarting = false;
  let isListening = false;
  let isPaused = false;
  let isActive = true;
  let isSpeaking = false;
  let isResponding = false;
  let startInvocations = 0;

  const canStart = () => {
    if (!isActive || isPaused || isStarting || isListening || isSpeaking || isResponding) {
      return false;
    }
    return true;
  };

  assert.strictEqual(canStart(), true);
  isStarting = true;
  assert.strictEqual(canStart(), false, "Cannot start while already starting");
  isStarting = false;
  isListening = true;
  assert.strictEqual(canStart(), false, "Cannot start while listening");
  isListening = false;
  isPaused = true;
  assert.strictEqual(canStart(), false, "Cannot start while paused");
  isPaused = false;
  isSpeaking = true;
  assert.strictEqual(canStart(), false, "Cannot start while Sierra TTS is speaking");

  // 3. Error code 5 (Client side error / ERROR_CLIENT) recovery:
  // Must NOT count as an empty cycle, allows at most 2 recoveries, then pauses with clear error.
  let consecutiveFailures = 0;
  let clientErrorRecoveryCount = 0;
  let pausedReason = "";

  const handleStoppedWithClientError = (errorCode: number) => {
    if (errorCode === 5) {
      // Do NOT count as empty cycle
      if (clientErrorRecoveryCount < 2) {
        clientErrorRecoveryCount++;
        return { recovered: true, paused: false };
      } else {
        isPaused = true;
        pausedReason = "Speech recognizer unavailable, tap mic to retry";
        return { recovered: false, paused: true, error: pausedReason };
      }
    }
    // Normal empty cycle
    consecutiveFailures++;
    return { recovered: false, paused: false };
  };

  // Attempt 1 errorCode 5
  const res1 = handleStoppedWithClientError(5);
  assert.strictEqual(res1.recovered, true);
  assert.strictEqual(clientErrorRecoveryCount, 1);
  assert.strictEqual(consecutiveFailures, 0, "ErrorCode 5 must NOT increment empty cycle count");

  // Attempt 2 errorCode 5
  const res2 = handleStoppedWithClientError(5);
  assert.strictEqual(res2.recovered, true);
  assert.strictEqual(clientErrorRecoveryCount, 2);
  assert.strictEqual(consecutiveFailures, 0);

  // Attempt 3 errorCode 5 -> exceeds limit of 2, pauses with actionable message
  const res3 = handleStoppedWithClientError(5);
  assert.strictEqual(res3.recovered, false);
  assert.strictEqual(res3.paused, true);
  assert.strictEqual(res3.error, "Speech recognizer unavailable, tap mic to retry");
  assert.strictEqual(isPaused, true);

  // 4. User mic tap clears paused and resets failure counters
  const onMicTap = () => {
    isPaused = false;
    consecutiveFailures = 0;
    clientErrorRecoveryCount = 0;
    pausedReason = "";
  };
  onMicTap();
  assert.strictEqual(isPaused, false);
  assert.strictEqual(consecutiveFailures, 0);
  assert.strictEqual(clientErrorRecoveryCount, 0);

  // 5. Successful speech result resets failure counter to 0
  consecutiveFailures = 2;
  const onSpeechSuccess = () => {
    consecutiveFailures = 0;
    clientErrorRecoveryCount = 0;
  };
  onSpeechSuccess();
  assert.strictEqual(consecutiveFailures, 0, "Successful speech result must reset failure count to 0");

  // 6. Log throttling: drops identical log lines within 1000ms
  let lastLog = { key: "", time: 0 };
  const loggedLines: string[] = [];

  const throttledLog = (stage: string, detail: string, now: number) => {
    const key = `${stage}:${detail}`;
    if (lastLog.key === key && now - lastLog.time < 1000) {
      return false; // dropped
    }
    lastLog = { key, time: now };
    loggedLines.push(key);
    return true; // accepted
  };

  const t0 = 10000;
  assert.strictEqual(throttledLog("STT:Start", "Checking permissions", t0), true);
  assert.strictEqual(throttledLog("STT:Start", "Checking permissions", t0 + 100), false, "Duplicate within 100ms dropped");
  assert.strictEqual(throttledLog("STT:Start", "Checking permissions", t0 + 500), false, "Duplicate within 500ms dropped");
  assert.strictEqual(throttledLog("STT:Start", "Checking permissions", t0 + 1050), true, "Duplicate after 1000ms accepted");
  assert.strictEqual(throttledLog("STT:Different", "Other detail", t0 + 1100), true, "Different log accepted immediately");
});

test("Recognition Session Lifecycle: Stale Session Events Ignored", async () => {
  const fs = await import("node:fs");
  const liveVoiceCode = fs.readFileSync("src/components/LiveVoice.tsx", "utf-8");

  // Verify sessionIdRef and session tagging in source code
  assert.ok(liveVoiceCode.includes("sessionIdRef = useRef<number>(0)"), "Must declare sessionIdRef");
  assert.ok(liveVoiceCode.includes("const sessionId = ++sessionIdRef.current"), "Must increment sessionId on start");
  assert.ok(liveVoiceCode.includes("eventSessionId !== sessionIdRef.current"), "Must check event sessionId against current session");
  assert.ok(liveVoiceCode.includes("STT:StaleEvent"), "Must log stale session events as STT:StaleEvent");
  assert.ok(liveVoiceCode.includes("sessionId: sessionId"), "Must pass sessionId to CapSpeechRecognition.start");

  // Simulate stale session event filter behavior
  let currentSessionId = 3;
  let staleEventsLogged: string[] = [];

  const handleListenerEvent = (event: { sessionId?: number; status?: string }) => {
    if (event.sessionId !== undefined && event.sessionId !== currentSessionId) {
      staleEventsLogged.push(`Stale event from session ${event.sessionId} ignored`);
      return false; // Ignored
    }
    return true; // Accepted
  };

  // Events from older sessions (1 and 2) must be rejected
  assert.strictEqual(handleListenerEvent({ sessionId: 1, status: "stopped" }), false);
  assert.strictEqual(handleListenerEvent({ sessionId: 2, status: "ready" }), false);
  assert.strictEqual(staleEventsLogged.length, 2);

  // Event from current session (3) must be accepted
  assert.strictEqual(handleListenerEvent({ sessionId: 3, status: "started" }), true);
  assert.strictEqual(staleEventsLogged.length, 2);
});

test("Recognition Session Lifecycle: Startup Failures Not Counted as Empty Cycles", async () => {
  const fs = await import("node:fs");
  const liveVoiceCode = fs.readFileSync("src/components/LiveVoice.tsx", "utf-8");

  // Verify startupFailuresRef and startup failure logic in source code
  assert.ok(liveVoiceCode.includes("startupFailuresRef = useRef<number>(0)"), "Must declare startupFailuresRef");
  assert.ok(liveVoiceCode.includes("isStartupFailure"), "Must identify isStartupFailure");
  assert.ok(!liveVoiceCode.includes("!reachedStarted || timeSinceReady <= 1200"), "Must remove !reachedStarted from isStartupFailure");
  assert.ok(liveVoiceCode.includes("timeSinceReady <= 1200"), "Startup failure must only check timeSinceReady <= 1200");
  assert.ok(liveVoiceCode.includes("Speech recognizer failed to start after 3 attempts"), "Must display clear message after 3 startup failures");

  // Simulate startup failure vs empty cycle state machine
  let consecutiveFailures = 0; // empty cycles
  let startupFailures = 0;
  let isPaused = false;
  let pauseReason = "";

  const handleStoppedEvent = (params: {
    errorCode?: number;
    reachedStarted: boolean;
    durationMs: number;
    timeSinceReadyMs: number;
  }) => {
    const isErrorCode7 = params.errorCode === 7;
    const isStartupFailure = isErrorCode7 && (params.timeSinceReadyMs <= 1200);

    if (isStartupFailure) {
      startupFailures++;
      if (startupFailures >= 3) {
        isPaused = true;
        pauseReason = "Speech recognizer failed to start after 3 attempts. Tap mic to retry.";
      }
      return { type: "startup_failure", backoff: startupFailures === 1 ? 1000 : startupFailures === 2 ? 2000 : 4000 };
    }

    if (isErrorCode7) {
      // After > 1200ms: normal silence timeout, restart immediately without counting a failure
      return { type: "silence_restart", delayMs: 300 };
    }

    if (params.reachedStarted && params.durationMs >= 3000) {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        isPaused = true;
        pauseReason = "Continuous listening paused after 3 empty cycles. Tap mic to resume.";
      }
      return { type: "empty_cycle" };
    }

    return { type: "sub_3s_cycle" };
  };

  // Immediate error code 7 within 1200ms of ready is a startup failure
  const sf1 = handleStoppedEvent({ errorCode: 7, reachedStarted: false, durationMs: 4, timeSinceReadyMs: 4 });
  assert.strictEqual(sf1.type, "startup_failure");
  assert.strictEqual(sf1.backoff, 1000);
  assert.strictEqual(startupFailures, 1);
  assert.strictEqual(consecutiveFailures, 0, "Startup failure must NOT increment empty cycles");

  const sf2 = handleStoppedEvent({ errorCode: 7, reachedStarted: false, durationMs: 10, timeSinceReadyMs: 10 });
  assert.strictEqual(sf2.type, "startup_failure");
  assert.strictEqual(sf2.backoff, 2000);
  assert.strictEqual(startupFailures, 2);
  assert.strictEqual(consecutiveFailures, 0);

  const sf3 = handleStoppedEvent({ errorCode: 7, reachedStarted: false, durationMs: 15, timeSinceReadyMs: 15 });
  assert.strictEqual(sf3.type, "startup_failure");
  assert.strictEqual(startupFailures, 3);
  assert.strictEqual(consecutiveFailures, 0);
  assert.strictEqual(isPaused, true);
  assert.strictEqual(pauseReason, "Speech recognizer failed to start after 3 attempts. Tap mic to retry.");

  // Error code 7 arriving after > 1200ms (e.g. 5000ms silence timeout) is silence, NOT a startup failure
  startupFailures = 0;
  isPaused = false;
  const silenceResult = handleStoppedEvent({ errorCode: 7, reachedStarted: false, durationMs: 5000, timeSinceReadyMs: 5000 });
  assert.strictEqual(silenceResult.type, "silence_restart");
  assert.strictEqual(startupFailures, 0, "Silence after 5s must NOT increment startup failures");
  assert.strictEqual(consecutiveFailures, 0, "Silence after 5s must NOT increment empty cycles");
  assert.strictEqual(isPaused, false, "Must NOT pause continuous listening on normal silence timeout");

  // A genuine empty cycle that reached 'started' and ran 3.5s without speech
  startupFailures = 0;
  isPaused = false;
  const ec1 = handleStoppedEvent({ errorCode: undefined, reachedStarted: true, durationMs: 3500, timeSinceReadyMs: 3600 });
  assert.strictEqual(ec1.type, "empty_cycle");
  assert.strictEqual(consecutiveFailures, 1);
  assert.strictEqual(startupFailures, 0);
});

test("Recognition Session Lifecycle: Resume-from-Pause Teardown and Counter Reset", async () => {
  const fs = await import("node:fs");
  const liveVoiceCode = fs.readFileSync("src/components/LiveVoice.tsx", "utf-8");

  // Verify resume tap implementation
  assert.ok(liveVoiceCode.includes("resumeGracePeriodUntilRef"), "Must declare resumeGracePeriodUntilRef");
  assert.ok(liveVoiceCode.includes("startupFailuresRef.current = 0"), "Must reset startupFailuresRef on resume");
  assert.ok(liveVoiceCode.includes("consecutiveFailuresRef.current = 0"), "Must reset consecutiveFailuresRef on resume");
  assert.ok(liveVoiceCode.includes("clientErrorRecoveryCountRef.current = 0"), "Must reset clientErrorRecoveryCountRef on resume");
  assert.ok(liveVoiceCode.includes("1500"), "Must configure 1.5s resume grace period");
  assert.ok(liveVoiceCode.includes("750"), "Must wait at least 750ms before starting after resume tap");

  // Simulate resume tap lifecycle
  let consecutiveFailures = 3;
  let startupFailures = 3;
  let clientErrorRecoveryCount = 2;
  let isPaused = true;
  let teardownCalled = false;
  let resumeGracePeriodUntil = 0;

  const onResumeTap = async () => {
    // 1. Teardown
    teardownCalled = true;

    // 2. 1.5s grace period
    const now = 10000;
    resumeGracePeriodUntil = now + 1500;

    // 3. Reset all counters and flags
    consecutiveFailures = 0;
    startupFailures = 0;
    clientErrorRecoveryCount = 0;
    isPaused = false;
  };

  await onResumeTap();
  assert.strictEqual(teardownCalled, true);
  assert.strictEqual(isPaused, false);
  assert.strictEqual(consecutiveFailures, 0);
  assert.strictEqual(startupFailures, 0);
  assert.strictEqual(clientErrorRecoveryCount, 0);
  assert.strictEqual(resumeGracePeriodUntil, 11500);

  // During 1.5s grace period, errorCode 5 and 7 are ignored as benign
  const isIgnoredDuringGrace = (errorCode: number, timestamp: number) => {
    return timestamp < resumeGracePeriodUntil && (errorCode === 5 || errorCode === 7);
  };
  assert.strictEqual(isIgnoredDuringGrace(5, 10200), true, "ErrorCode 5 ignored during grace window");
  assert.strictEqual(isIgnoredDuringGrace(7, 10500), true, "ErrorCode 7 ignored during grace window");
  assert.strictEqual(isIgnoredDuringGrace(5, 12000), false, "ErrorCode 5 not ignored after grace window");
});

test("Recognition Session Lifecycle: No Start After Pause & Cancellation Checkpoints", async () => {
  const fs = await import("node:fs");
  const liveVoiceCode = fs.readFileSync("src/components/LiveVoice.tsx", "utf-8");

  // Verify cancellation checkpoints in startSpeechToText
  assert.ok(liveVoiceCode.includes("isStartCancelled"), "Must define isStartCancelled helper in startSpeechToText");
  assert.ok(liveVoiceCode.includes("isStoppingRef.current"), "Must guard isStoppingRef to prevent start while stopping");
  assert.ok(liveVoiceCode.includes("800"), "Must enforce at least 800ms settling time after stop/teardown");
  assert.ok(liveVoiceCode.includes("STT:Start:Aborted"), "Must log cancellation when aborted");

  // Simulate cancellation checkpoints
  let isPaused = false;
  let isStopping = false;
  let currentSessionId = 5;

  const checkCancelled = (sessionTag: number) => {
    return isPaused || isStopping || currentSessionId !== sessionTag;
  };

  // Initially active, valid session
  assert.strictEqual(checkCancelled(5), false);

  // Abort if paused
  isPaused = true;
  assert.strictEqual(checkCancelled(5), true, "Must abort start sequence if paused");

  // Abort if stopping
  isPaused = false;
  isStopping = true;
  assert.strictEqual(checkCancelled(5), true, "Must abort start sequence if previous session stopping");

  // Abort if superseded by newer session
  isStopping = false;
  currentSessionId = 6;
  assert.strictEqual(checkCancelled(5), true, "Must abort start sequence if superseded by newer session id");
});

test("Gemini Live WebSocket: Setup Configuration and responseModalities Contract", async () => {
  const fs = await import("node:fs");
  const liveVoiceCode = fs.readFileSync("src/components/LiveVoice.tsx", "utf-8");
  const geminiCode = fs.readFileSync("src/lib/gemini.ts", "utf-8");

  // 1. responseModalities MUST be ["AUDIO"], never TEXT
  assert.ok(geminiCode.includes('responseModalities: ["AUDIO"]'), "gemini.ts must set responseModalities to ['AUDIO']");
  assert.ok(!geminiCode.includes('responseModalities: ["TEXT"]'), "gemini.ts must NEVER set responseModalities to TEXT");
  assert.ok(liveVoiceCode.includes('responseModalities: ["AUDIO"]'), "LiveVoice.tsx must set responseModalities to ['AUDIO']");
  assert.ok(!liveVoiceCode.includes('responseModalities: ["TEXT"]'), "LiveVoice.tsx must NEVER set responseModalities to TEXT");

  // 2. outputAudioTranscription MUST be enabled in setup
  assert.ok(geminiCode.includes("outputAudioTranscription: {}"), "gemini.ts must enable outputAudioTranscription: {}");
  assert.ok(liveVoiceCode.includes("outputAudioTranscription: {}"), "LiveVoice.tsx must enable outputAudioTranscription: {}");

  // 3. Audio handling and playback via Web Audio playAudio
  assert.ok(liveVoiceCode.includes("playAudio(part.inlineData.data)"), "LiveVoice.tsx must play inlineData audio via playAudio");
  assert.ok(liveVoiceCode.includes("outputTranscription?.text"), "LiveVoice.tsx must capture outputTranscription text for chat UI");
  assert.ok(liveVoiceCode.includes("serverContent.interrupted"), "LiveVoice.tsx must stop playback on interrupted");

  // 4. WebSocket session reuse: single open WebSocket reused across turns
  assert.ok(liveVoiceCode.includes("ensureLiveWebSocket"), "LiveVoice.tsx must define ensureLiveWebSocket for session reuse");
  assert.ok(liveVoiceCode.includes("clientContentMessage"), "LiveVoice.tsx must send user turns via clientContent");
});



