import { useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "@monaco-editor/react";
import { findSyntaxError } from "./checkSyntax";
import "./App.css";

const starterCode = `function calculateTotal(price, tax {
  console.log("Calculating..."
  return price + tax
`;

const DEBOUNCE_MS = 300;
const HINT_API_URL = "http://localhost:3001/api/hint";
const STORAGE_KEY = "code-tutor-concept-counts";

function loadCounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function App() {
  const [error, setError] = useState(null);
  const [hint, setHint] = useState(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [conceptCounts, setConceptCounts] = useState(loadCounts);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const timerRef = useRef(null);

  const check = useCallback((code) => {
    const found = findSyntaxError(code);
    setError(found);
    setHint(null); // clear any old hint once the error changes

    if (found) {
      setConceptCounts((prev) => {
        const next = {
          ...prev,
          [found.concept]: (prev[found.concept] ?? 0) + 1,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }

    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!monaco || !model) return;

    monaco.editor.setModelMarkers(
      model,
      "code-tutor",
      found
        ? [
            {
              severity: monaco.MarkerSeverity.Error,
              message: found.message,
              startLineNumber: found.line,
              startColumn: found.column,
              endLineNumber: found.line,
              endColumn: found.column + 1,
            },
          ]
        : []
    );
  }, []);

  const handleBeforeMount = (monaco) => {
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSyntaxValidation: true,
      noSemanticValidation: true,
    });
  };

  const handleMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    check(editor.getValue());
  };

  const handleChange = (value = "") => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => check(value), DEBOUNCE_MS);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const goToError = () => {
    const editor = editorRef.current;
    if (!editor || !error) return;
    editor.revealLineInCenter(error.line);
    editor.setPosition({ lineNumber: error.line, column: error.column });
    editor.focus();
  };

  // Calls our backend, which calls Groq, grounded in the current code + error
  const getHint = async (level) => {
    setHintLoading(true);
    setHint(null);
    try {
      const res = await fetch(HINT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editorRef.current.getValue(),
          error,
          level,
        }),
      });
      const data = await res.json();
      setHint(res.ok ? data.hint : `Error: ${data.error}`);
    } catch {
      setHint("Couldn't reach the tutor server. Is it running on port 3001?");
    } finally {
      setHintLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="hero">
        <div>
          <h1>⚡ Code Tutor</h1>
          <p>Find syntax mistakes instantly and celebrate every clean build.</p>
        </div>
        <div className="hero-badge">🚀 1% Better Every Commit</div>
      </header>

      <div className="app">
        <div className="editor-pane">
          <Editor
            height="500px"
            defaultLanguage="javascript"
            defaultValue={starterCode}
            theme="hc-black"
            beforeMount={handleBeforeMount}
            onMount={handleMount}
            onChange={handleChange}
            options={{ automaticLayout: true }}
          />
        </div>

        <div className="panel">
          {error ? (
            <div className="error-card">
              <h2>Line {error.line} has a problem</h2>
              <p className="concept-label">{error.conceptLabel}</p>
              <p>{error.message}</p>
              <button onClick={goToError}>Go to error</button>

              {conceptCounts[error.concept] > 1 && (
                <p className="repeat-note">
                  You've hit "{error.conceptLabel}" {conceptCounts[error.concept]} times.
                  Worth reviewing this concept.
                </p>
              )}

              <div className="hint-ladder">
                <button onClick={() => getHint(1)} disabled={hintLoading}>
                  Nudge
                </button>
                <button onClick={() => getHint(2)} disabled={hintLoading}>
                  Explain
                </button>
                <button onClick={() => getHint(3)} disabled={hintLoading}>
                  Show fix
                </button>
              </div>

              {hintLoading && <p className="hint-loading">Thinking…</p>}
              {hint && <p className="hint-text">{hint}</p>}
            </div>
          ) : (
            <div className="success-card">
              <div className="success-icon">🎉</div>
              <h2>1% Better!</h2>
              <p>No syntax errors. Your code is clean and ready to go.</p>
              <div className="success-badge">✓ Build Confidence +1</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;