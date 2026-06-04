import { act, renderHook } from "@testing-library/react";
import { useVoiceInput } from "@/lib/useVoiceInput";

const speechRecognitionInstances: MockSpeechRecognition[] = [];

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null = null;
  abort = jest.fn();
  start = jest.fn();
  stop = jest.fn();

  constructor() {
    speechRecognitionInstances.push(this);
  }
}

function mockBrowserSpeechRecognition() {
  Object.defineProperty(window, "SpeechRecognition", {
    configurable: true,
    value: MockSpeechRecognition,
  });
}

describe("useVoiceInput", () => {
  beforeEach(() => {
    speechRecognitionInstances.length = 0;
    Reflect.deleteProperty(window, "SpeechRecognition");
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
  });

  it("reports voice input as unsupported when the browser API is unavailable", () => {
    const onError = jest.fn();
    const onTranscript = jest.fn();

    const { result } = renderHook(() =>
      useVoiceInput({ onError, onTranscript }),
    );

    expect(result.current.isSupported).toBe(false);
    expect(result.current.isListening).toBe(false);

    act(() => {
      result.current.toggleVoiceInput();
    });

    expect(onError).toHaveBeenCalledWith(
      "Voice input is not supported in this browser.",
    );
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it("starts and stops speech recognition", () => {
    const onError = jest.fn();
    const onTranscript = jest.fn();
    mockBrowserSpeechRecognition();

    const { result } = renderHook(() =>
      useVoiceInput({ onError, onTranscript }),
    );

    expect(result.current.isSupported).toBe(true);
    expect(speechRecognitionInstances[0]).toMatchObject({
      continuous: false,
      interimResults: false,
      lang: "en-GB",
    });

    act(() => {
      result.current.toggleVoiceInput();
    });

    expect(onError).toHaveBeenCalledWith(null);
    expect(speechRecognitionInstances[0].start).toHaveBeenCalled();
    expect(result.current.isListening).toBe(true);

    act(() => {
      result.current.toggleVoiceInput();
    });

    expect(speechRecognitionInstances[0].stop).toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
  });

  it("passes recognised transcripts to the caller", () => {
    const onError = jest.fn();
    const onTranscript = jest.fn();
    mockBrowserSpeechRecognition();

    renderHook(() => useVoiceInput({ onError, onTranscript }));

    act(() => {
      speechRecognitionInstances[0].onresult?.({
        results: [[{ transcript: "scale this" }], [{ transcript: "for four" }]],
      });
    });

    expect(onTranscript).toHaveBeenCalledWith("scale this for four");
  });

  it("stops listening and reports recognition errors", () => {
    const onError = jest.fn();
    const onTranscript = jest.fn();
    mockBrowserSpeechRecognition();

    const { result } = renderHook(() =>
      useVoiceInput({ onError, onTranscript }),
    );

    act(() => {
      result.current.toggleVoiceInput();
    });
    expect(result.current.isListening).toBe(true);

    act(() => {
      speechRecognitionInstances[0].onerror?.();
    });

    expect(result.current.isListening).toBe(false);
    expect(onError).toHaveBeenCalledWith(
      "Voice input was interrupted. Please try again.",
    );
  });

  it("reports errors thrown when recognition cannot start", () => {
    const onError = jest.fn();
    const onTranscript = jest.fn();
    mockBrowserSpeechRecognition();

    const { result } = renderHook(() =>
      useVoiceInput({ onError, onTranscript }),
    );
    speechRecognitionInstances[0].start.mockImplementationOnce(() => {
      throw new Error("microphone blocked");
    });

    act(() => {
      result.current.toggleVoiceInput();
    });

    expect(result.current.isListening).toBe(false);
    expect(onError).toHaveBeenLastCalledWith(
      "Something went wrong: microphone blocked",
    );
  });

  it("aborts speech recognition on cleanup", () => {
    const onError = jest.fn();
    const onTranscript = jest.fn();
    mockBrowserSpeechRecognition();

    const { unmount } = renderHook(() =>
      useVoiceInput({ onError, onTranscript }),
    );
    const recognition = speechRecognitionInstances[0];

    unmount();

    expect(recognition.abort).toHaveBeenCalled();
    expect(recognition.onend).toBeNull();
    expect(recognition.onerror).toBeNull();
    expect(recognition.onresult).toBeNull();
  });
});
