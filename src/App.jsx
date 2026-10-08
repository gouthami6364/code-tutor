import { useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "@monaco-editor/react";
import { findSyntaxError } from "./checkSyntax";
import "./App.css";

const starterCode = `function calculateTotal(price, tax {
  console.log("Calculating..."
  return price + tax
`;

const DEBOUNCE_MS = 300;
const HINT_API_URL = "https://code-tutor-vwf9.onrender.com/api/hint";
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
  const [fileName, setFileName] = useState("main.js");
  const [code, setCode] = useState(starterCode);
  const [buildState, setBuildState] = useState("Checking...");
  const [theme, setTheme] = useState(() => localStorage.getItem("code-tutor-theme") || "dark");
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("code-tutor-theme", theme);
    document.documentElement.dataset.theme = theme;
    monacoRef.current?.editor?.setTheme(
      theme === "light" ? "code-tutor-light" : "code-tutor-dark"
    );
  }, [theme]);

  const check = useCallback((value) => {
    const found = findSyntaxError(value);
    setError(found);
    setHint(null);
    setBuildState(found ? "Build failed" : "Build passed");

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

    monaco.editor.defineTheme("code-tutor-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "7C3AED" },
        { token: "string", foreground: "0891B2" },
        { token: "number", foreground: "B45309" },
        { token: "comment", foreground: "64748B" },
      ],
      colors: {
        "editor.background": "#F8FAFC",
        "editor.foreground": "#172033",
        "editorLineNumber.foreground": "#94A3B8",
        "editorLineNumber.activeForeground": "#475569",
        "editorCursor.foreground": "#2563EB",
        "editor.selectionBackground": "#BFDBFE",
        "editor.lineHighlightBackground": "#EEF4FF",
        "editorIndentGuide.background1": "#E2E8F0",
        "editorIndentGuide.activeBackground1": "#CBD5E1",
      },
    });

    monaco.editor.defineTheme("code-tutor-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "C084FC" },
        { token: "string", foreground: "67E8F9" },
        { token: "number", foreground: "FBBF24" },
        { token: "comment", foreground: "64748B" },
      ],
      colors: {
        "editor.background": "#07111F",
        "editor.foreground": "#DCE7F7",
        "editorLineNumber.foreground": "#40516B",
        "editorLineNumber.activeForeground": "#93A9C5",
        "editorCursor.foreground": "#67E8F9",
        "editor.selectionBackground": "#1D4ED855",
        "editor.lineHighlightBackground": "#0E1B2D",
        "editorIndentGuide.background1": "#17263A",
        "editorIndentGuide.activeBackground1": "#28415E",
      },
    });
  };

  const handleMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    check(editor.getValue());
  };

  const handleChange = (value = "") => {
    setCode(value);
    setBuildState("Checking...");
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

  const runCode = () => {
    const current = editorRef.current?.getValue() ?? code;
    check(current);
    editorRef.current?.focus();
  };

  const formatCode = async () => {
    const action = editorRef.current?.getAction("editor.action.formatDocument");
    if (!action) return;
    try {
      await action.run();
    } catch {
      // Formatting is optional; the tutor still works without it.
    }
  };

  const resetCode = () => {
    setFileName("main.js");
    setCode(starterCode);
    setHint(null);
    editorRef.current?.setValue(starterCode);
    check(starterCode);
  };

  const createFile = () => {
    setFileName("untitled.js");
    setCode("");
    setHint(null);
    setError(null);
    setBuildState("Ready");
    editorRef.current?.setValue("");
  };

  const loadExample = () => {
    const example = `function calculateTotal(price, tax) {
  console.log("Calculating...");
  return price + tax;
}

const total = calculateTotal(100, 18);
console.log(total);`;

    setFileName("example.js");
    setCode(example);
    setHint(null);
    editorRef.current?.setValue(example);
    check(example);
  };

  const getHint = async (level) => {
    if (!error) return;

    setHintLoading(true);
    setHint(null);

    try {
      const res = await fetch(HINT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editorRef.current?.getValue() ?? code,
          error,
          level,
        }),
      });

      const data = await res.json();
      setHint(res.ok ? data.hint : `Error: ${data.error}`);
    } catch {
      setHint("Couldn't reach the tutor server. Is the tutor server running?");
    } finally {
      setHintLoading(false);
    }
  };

  const currentLine = error
    ? (code.split("\n")[error.line - 1] || "").trim()
    : "";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">ϟ</div>
          <span>Code Tutor</span>
        </div>

        <nav className="top-nav" aria-label="Main navigation">
          <span className="active">Learn</span>
          <span>Build</span>
          <span>Improve</span>
        </nav>

        <div className="top-actions">
          <div className="language-select">
            <span className="js-badge">JS</span>
            <span>JavaScript</span>
            <span className="chevron">⌄</span>
          </div>
          <button
            className="theme-toggle"
            onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <span className={theme === "light" ? "active" : ""}>☀</span>
            <span className={theme === "dark" ? "active" : ""}>☾</span>
          </button>
          <button className="icon-button" aria-label="Settings">⚙</button>
          <span className="online"><i /> Online</span>
        </div>
      </header>

      <main className="workspace">
        <section className="welcome-card">
          <div className="welcome-icon">&lt;/&gt;</div>

          <div className="welcome-copy">
            <h1>Welcome back!</h1>
            <p>Write your code, fix the issues, and learn as you go.</p>
          </div>

          <div className="welcome-divider" />

          <div className="quick-actions">
            <span className="quick-label">Quick Actions</span>
            <div className="quick-buttons">
              <button onClick={createFile}>＋ <span>New File</span></button>
              <button onClick={loadExample}>◈ <span>View Examples</span></button>
              <button onClick={() => getHint(2)} disabled={!error || hintLoading}>
                ? <span>Get Help</span>
              </button>
            </div>
          </div>
        </section>

        <section className="ide-grid">
          <aside className="file-sidebar">
            <div className="sidebar-heading">
              <span>FILES</span>
              <button onClick={createFile} aria-label="New file">＋</button>
            </div>

            <button
              className="file-item selected"
              onClick={() => {
                setFileName("main.js");
                setCode(starterCode);
                editorRef.current?.setValue(starterCode);
                check(starterCode);
              }}
            >
              <span className="file-icon">JS</span>
              <span>{fileName}</span>
            </button>

            <div className="file-item muted">
              <span className="doc-icon">▤</span>
              <span>README.md</span>
            </div>

            <div className="sidebar-spacer" />

            <div className="sidebar-tip">
              <span>⌁</span>
              <div>
                <strong>Learn while coding</strong>
                <small>Your mistakes become practice.</small>
              </div>
            </div>
          </aside>

          <section className="editor-area">
            <div className="editor-tabs">
              <div className="editor-tab active">
                <span className="file-icon">JS</span>
                <span>{fileName}</span>
                <button onClick={resetCode} aria-label="Reset file">×</button>
              </div>
            </div>

            <div className="editor-toolbar">
              <div className="toolbar-spacer" />
              <button className="tool-button run" onClick={runCode}>
                ▶ <span>Run</span>
              </button>
              <button className="tool-button" onClick={formatCode}>
                &lt;/&gt; <span>Format</span>
              </button>
              <button className="tool-button" onClick={resetCode}>
                ↻ <span>Reset</span>
              </button>
            </div>

            <div className="monaco-wrap">
              <Editor
                height="100%"
                defaultLanguage="javascript"
                defaultValue={starterCode}
                theme={theme === "light" ? "code-tutor-light" : "code-tutor-dark"}
                beforeMount={handleBeforeMount}
                onMount={handleMount}
                onChange={handleChange}
                options={{
                  automaticLayout: true,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineHeight: 23,
                  padding: { top: 12, bottom: 20 },
                  scrollBeyondLastLine: false,
                  roundedSelection: false,
                  renderLineHighlight: "all",
                  smoothScrolling: true,
                }}
              />
            </div>
          </section>

          <aside className="inspector">
            {error ? (
              <div className="inspector-content">
                <div className="error-header">
                  <div className="error-symbol">!</div>

                  <div className="error-title">
                    <h2>Unexpected token</h2>
                    <p>Line {error.line}, Column {error.column}</p>
                  </div>

                  <span className="status-pill">Error</span>
                  <button className="close-error" onClick={() => setError(null)} aria-label="Close">
                    ×
                  </button>
                </div>

                <div className="explanation">
                  <h3>What happened?</h3>
                  <p>{error.message}</p>
                </div>

                <div className="error-snippet">
                  <span>{error.line}</span>
                  <code>{currentLine || " "}</code>
                  <b>⌃</b>
                </div>

                <div className="concept-block">
                  <span>CONCEPT</span>
                  <strong>{error.conceptLabel}</strong>

                  {conceptCounts[error.concept] > 1 && (
                    <p>
                      You've hit this concept {conceptCounts[error.concept]} times.
                      Worth reviewing.
                    </p>
                  )}
                </div>

                <div className="actions-title">Quick actions</div>

                <div className="hint-ladder">
                  <button onClick={() => getHint(1)} disabled={hintLoading}>
                    <span>✦</span> Nudge
                  </button>
                  <button onClick={() => getHint(2)} disabled={hintLoading}>
                    <span>💡</span> Explain
                  </button>
                  <button onClick={() => getHint(3)} disabled={hintLoading}>
                    <span>&lt;/&gt;</span> Show fix
                  </button>
                </div>

                <button className="go-error" onClick={goToError}>
                  ⌖ Go to error
                </button>

                {hintLoading && <p className="hint-loading">Tutor is thinking…</p>}
                {hint && <p className="hint-text">{hint}</p>}
              </div>
            ) : (
              <div className="success-state">
                <div className="success-icon">✓</div>
                <span className="success-label">BUILD PASSED</span>
                <h2>Nice work!</h2>
                <p>No syntax errors. Your code is clean and ready to go.</p>
                <div className="success-badge">+1 Build Confidence</div>
              </div>
            )}
          </aside>
        </section>
      </main>

      <footer className="statusbar">
        <div className="status-left">
          <span className="js-badge small">JS</span>
          <span>JavaScript</span>
          <span className="status-separator" />
          <span className="status-item">☷</span>
          <span>Ln {error?.line ?? 1}, Col {error?.column ?? 1}</span>
        </div>

        <div className={`build-status ${error ? "failed" : "passed"}`}>
          <i />
          {buildState}
        </div>

        <div className="status-right">
          <span>〉_</span>
          <em>Better code. Brighter future.</em>
        </div>
      </footer>
    </div>
  );
}

export default App;
