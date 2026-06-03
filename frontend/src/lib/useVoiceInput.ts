import { useCallback, useEffect, useRef, useState } from "react";

type BrowserSpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

function formatVoiceInputError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return `Something went wrong: ${message || "Unknown error"}`;
}

export function useVoiceInput({
  onError,
  onTranscript,
}: {
  onError: (message: string | null) => void;
  onTranscript: (transcript: string) => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-GB";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ");

      onTranscript(transcript);
    };
    recognition.onerror = () => {
      setIsListening(false);
      onError("Voice input was interrupted. Please try again.");
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    speechRecognitionRef.current = recognition;
    setIsSupported(true);

    return () => {
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      recognition.abort();
      speechRecognitionRef.current = null;
    };
  }, [onError, onTranscript]);

  const toggleVoiceInput = useCallback(() => {
    const recognition = speechRecognitionRef.current;

    if (!recognition) {
      onError("Voice input is not supported in this browser.");
      return;
    }

    onError(null);

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }

    try {
      recognition.start();
      setIsListening(true);
    } catch (error) {
      setIsListening(false);
      onError(formatVoiceInputError(error));
    }
  }, [isListening, onError]);

  return {
    isListening,
    isSupported,
    toggleVoiceInput,
  };
}
