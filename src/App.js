import { useState, useEffect, useRef } from "react";

function App() {
  // Application State
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("0");
  const [isRad, setIsRad] = useState(true);
  
  // History timeline state for Undo/Redo operations
  const [history, setHistory] = useState([""]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const containerRef = useRef(null);

  // Push new expression modification snapshot into timeline state
  const updateExpression = (newExpr) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    setExpression(newExpr);
    setHistory([...updatedHistory, newExpr]);
    setHistoryIndex(updatedHistory.length);
    calculateLivePreview(newExpr);
  };

  // Real-time expression evaluation engine
  const calculateLivePreview = (expr) => {
    if (!expr) {
      setResult("0");
      return;
    }
    try {
      let sanitized = sanitizeExpression(expr);
      // Auto-balance open parentheses so incomplete brackets evaluate gracefully while typing
      const openBrackets = (sanitized.match(/\(/g) || []).length;
      const closeBrackets = (sanitized.match(/\)/g) || []).length;
      if (openBrackets > closeBrackets) {
        sanitized += ")".repeat(openBrackets - closeBrackets);
      }
      
      const evalFn = new Function(`return (${sanitized})`);
      const evaluated = evalFn();
      
      if (typeof evaluated === "number" && !isNaN(evaluated)) {
        if (!isFinite(evaluated)) {
          setResult("Error");
        } else {
          setResult(String(parseFloat(evaluated.toFixed(10))));
        }
      } else {
        setResult("Error");
      }
    } catch {
      // Retain the current running calculation result while syntax string is typing/incomplete
    }
  };

  // Convert presentation display tokens into native valid JavaScript Math code execution
  const sanitizeExpression = (expr) => {
    let s = expr;
    s = s.replace(/×/g, "*").replace(/÷/g, "/");
    s = s.replace(/π/g, String(Math.PI)).replace(/e/g, String(Math.E));

    // Functional parsing regex mappings
    s = s.replace(/abs\(([^)]+)\)/g, "Math.abs($1)");
    s = s.replace(/cbrt\(([^)]+)\)/g, "Math.cbrt($1)");
    s = s.replace(/sqrt\(([^)]+)\)/g, "Math.sqrt($1)");
    s = s.replace(/ln\(([^)]+)\)/g, "Math.log($1)");
    s = s.replace(/log\(([^)]+)\)/g, "Math.log10($1)");

    // Trigonometric context calculations relative to Angles system configuration settings
    const angleConv = isRad ? "" : " * (Math.PI / 180)";
    const invAngleConv = isRad ? "" : " * (180 / Math.PI)";

    s = s.replace(/asin\(([^)]+)\)/g, `(Math.asin($1)${invAngleConv})`);
    s = s.replace(/acos\(([^)]+)\)/g, `(Math.acos($1)${invAngleConv})`);
    s = s.replace(/atan\(([^)]+)\)/g, `(Math.atan($1)${invAngleConv})`);
    s = s.replace(/sin\(([^)]+)\)/g, `Math.sin(($1)${angleConv})`);
    s = s.replace(/cos\(([^)]+)\)/g, `Math.cos(($1)${angleConv})`);
    s = s.replace(/tan\(([^)]+)\)/g, `Math.tan(($1)${angleConv})`);

    // Factorial parsing module (!)
    s = s.replace(/(\d+(\.\d+)?|π|e|(?:\([^)]+\)))\!/g, (match, p1) => {
      let val = p1;
      if (val === "π") val = Math.PI;
      else if (val === "e") val = Math.E;
      else if (val.startsWith("(")) {
        const subExpr = val.slice(1, -1);
        const nestedEval = new Function(`return (${sanitizeExpression(subExpr)})`);
        val = nestedEval();
      } else {
        val = Number(val);
      }
      if (val < 0 || !Number.isInteger(val)) return "NaN";
      let fact = 1;
      for (let i = 2; i <= val; i++) fact *= i;
      return String(fact);
    });

    // Custom structural mathematical operations mapping
    s = s.replace(/root\(([^,]+),([^)]+)\)/g, "Math.pow($1, 1/($2))");
    s = s.replace(/([^+\-*/()^]+)\^([^+\-*/()^]+)/g, "Math.pow($1,$2)");

    return s;
  };

  // Keyboard binding logic
  useEffect(() => {
    const handleKeyDown = (e) => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;

      if (e.key >= "0" && e.key <= "9") appendToken(e.key);
      else if (e.key === ".") appendToken(".");
      else if (e.key === "+") appendToken("+");
      else if (e.key === "-") appendToken("-");
      else if (e.key === "*") appendToken("×");
      else if (e.key === "/") appendToken("÷");
      else if (e.key === "(") appendToken("(");
      else if (e.key === ")") appendToken(")");
      else if (e.key === "!") appendToken("!");
      else if (e.key === "%") appendToken("/100");
      else if (e.key === "^") appendToken("^");
      else if (e.key === "Enter" || e.key === "=") { e.preventDefault(); handleEquals(); }
      else if (e.key === "Backspace") backspace();
      else if (e.key === "Escape") clearAll();
      else if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      else if (e.ctrlKey && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expression, history, historyIndex]);

  const appendToken = (token) => {
    updateExpression(expression + token);
  };

  const appendFunction = (funcName) => {
    updateExpression(expression + funcName + "(");
  };

  const handleEquals = () => {
    if (!expression) return;
    try {
      let sanitized = sanitizeExpression(expression);
      const openBrackets = (sanitized.match(/\(/g) || []).length;
      const closeBrackets = (sanitized.match(/\)/g) || []).length;
      if (openBrackets > closeBrackets) {
        sanitized += ")".repeat(openBrackets - closeBrackets);
      }

      const evalFn = new Function(`return (${sanitized})`);
      const finalVal = evalFn();

      if (typeof finalVal === "number" && !isNaN(finalVal)) {
        if (!isFinite(finalVal)) {
          setResult("Error");
        } else {
          const formatted = String(parseFloat(finalVal.toFixed(10)));
          setResult(formatted);
          setExpression(formatted);
          setHistory([...history.slice(0, historyIndex + 1), formatted]);
          setHistoryIndex(historyIndex + 1);
        }
      } else {
        setResult("Error");
      }
    } catch {
      setResult("Error");
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result);
      alert(`Copied output result: ${result}`);
    } catch {
      alert("Clipboard access failed.");
    }
  };

  const injectRandomNumber = () => {
    const randStr = parseFloat(Math.random().toFixed(4));
    appendToken(String(randStr));
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setExpression(history[prevIndex]);
      calculateLivePreview(history[prevIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setExpression(history[nextIndex]);
      calculateLivePreview(history[nextIndex]);
    }
  };

  const backspace = () => {
    if (expression.length > 0) {
      updateExpression(expression.slice(0, -1));
    }
  };

  const clearAll = () => {
    setExpression("");
    setResult("0");
    setHistory([""]);
    setHistoryIndex(0);
  };

  // Inject dynamic micro styles directly into page layout DOM Context
  return (
    <div className="App" ref={containerRef} style={{ maxWidth: "420px", margin: "40px auto", padding: "20px", fontFamily: "system-ui, sans-serif", background: "#0f0f12", borderRadius: "16px", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
      <style>{`
        .display-panel { background: #18181c; padding: 20px; borderRadius: 12px; margin-bottom: 16px; text-align: right; box-shadow: inset 0 2px 8px rgba(0,0,0,0.8); }
        .expr-preview { color: #a0a0ab; min-height: 28px; font-size: 1.2rem; word-break: break-all; letter-spacing: 0.5px; }
        .result-display { color: #ffffff; font-size: 2.4rem; font-weight: 700; margin-top: 8px; word-break: break-all; }
        .control-ribbon { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
        .calc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .btn { padding: 14px 8px; border: none; borderRadius: 8px; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: background 0.15s ease, transform 0.05s ease; color: #fff; }
        .btn:active { transform: scale(0.96); }
        .sci-btn { background: #27272a; color: #e4e4e7; }
        .sci-btn:hover { background: #3f3f46; }
        .num-btn { background: #3f3f46; color: #ffffff; font-size: 1.2rem; }
        .num-btn:hover { background: #52525b; }
        .op-btn { background: #f97316; color: #ffffff; }
        .op-btn:hover { background: #ea580c; }
        .action-btn { background: #ef4444; color: #ffffff; }
        .action-btn:hover { background: #dc2626; }
        .btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
      `}</style>

      <h2 style={{ color: "#ffffff", textAlign: "center", margin: "0 0 20px 0", fontSize: "1.4rem", letterSpacing: "1px" }}>SCIENTIFIC CALCULATOR</h2>

      {/* Screen Interface Display */}
      <div className="display-panel">
        <div className="expr-preview">{expression || "0"}</div>
        <div className="result-display">{result}</div>
      </div>

      {/* Auxiliary Global Command Operations Ribbon */}
      <div className="control-ribbon">
        <button type="button" className="btn sci-btn" onClick={() => setIsRad(!isRad)}>{isRad ? "Rad" : "Deg"}</button>
        <button type="button" className="btn sci-btn" onClick={copyToClipboard}>Copy</button>
        <button type="button" className="btn sci-btn" onClick={undo} disabled={historyIndex === 0}>Undo</button>
                <button type="button" className="btn sci-btn" onClick={redo} disabled={historyIndex === history.length - 1}>Redo</button>
      </div>

      {/* Core Interface Keyboard Grid */}
      <form onSubmit={(e) => e.preventDefault()} className="calc-grid">
        {/* Row 1 Scientific Functions Extensions */}
        <button type="button" className="btn sci-btn" onClick={() => appendFunction("sin")}>sin</button>
        <button type="button" className="btn sci-btn" onClick={() => appendFunction("cos")}>cos</button>
        <button type="button" className="btn sci-btn" onClick={() => appendFunction("tan")}>tan</button>
        <button type="button" className="btn sci-btn" onClick={() => appendToken("^3")}>x³</button>

        {/* Row 2 Scientific Functions Extensions */}
        <button type="button" className="btn sci-btn" onClick={() => appendFunction("asin")}>sin⁻¹</button>
        <button type="button" className="btn sci-btn" onClick={() => appendFunction("acos")}>cos⁻¹</button>
        <button type="button" className="btn sci-btn" onClick={() => appendFunction("atan")}>tan⁻¹</button>
        <button type="button" className="btn sci-btn" onClick={() => appendFunction("cbrt")}>³√x</button>

        {/* Row 3 Scientific Functions Extensions */}
        <button type="button" className="btn sci-btn" onClick={() => appendFunction("sqrt")}>√x</button>
        <button type="button" className="btn sci-btn" onClick={() => appendFunction("root")}>ⁿ√x</button>
        <button type="button" className="btn sci-btn" onClick={() => appendFunction("abs")}>|x|</button>
        <button type="button" className="btn sci-btn" onClick={() => appendToken("!")}>x!</button>

        {/* Row 4 Groupings & Multi-Operations */}
        <button type="button" className="btn sci-btn" onClick={() => appendToken("(")}>(</button>
        <button type="button" className="btn sci-btn" onClick={() => appendToken(")")}>)</button>
        <button type="button" className="btn sci-btn" onClick={() => appendToken("/100")}>%</button>
        <button type="button" className="btn sci-btn" onClick={injectRandomNumber}>Rand</button>

        <button type="button" className="btn sci-btn" onClick={() => appendToken("π")}>π</button>
        <button type="button" className="btn sci-btn" onClick={() => appendToken("e")}>e</button>
        <button type="button" className="btn sci-btn" onClick={() => appendToken("^")}>x^y</button>
        <button type="button" className="btn sci-btn" onClick={() => appendFunction("ln")}>ln</button>

        <button type="button" className="btn sci-btn" onClick={() => appendFunction("log")}>log</button>
        <button type="button" className="btn action-btn" onClick={clearAll}>AC</button>
        <button type="button" className="btn action-btn" onClick={backspace}>⌫</button>
        <button type="button" className="btn op-btn" onClick={() => appendToken("÷")}>÷</button>

        {/* Numeric Buttons Matrix */}
        <button type="button" className="btn num-btn" onClick={() => appendToken("7")}>7</button>
        <button type="button" className="btn num-btn" onClick={() => appendToken("8")}>8</button>
        <button type="button" className="btn num-btn" onClick={() => appendToken("9")}>9</button>
        <button type="button" className="btn op-btn" onClick={() => appendToken("×")}>×</button>

        <button type="button" className="btn num-btn" onClick={() => appendToken("4")}>4</button>
        <button type="button" className="btn num-btn" onClick={() => appendToken("5")}>5</button>
        <button type="button" className="btn num-btn" onClick={() => appendToken("6")}>6</button>
        <button type="button" className="btn op-btn" onClick={() => appendToken("-")}>-</button>

        <button type="button" className="btn num-btn" onClick={() => appendToken("1")}>1</button>
        <button type="button" className="btn num-btn" onClick={() => appendToken("2")}>2</button>
        <button type="button" className="btn num-btn" onClick={() => appendToken("3")}>3</button>
        <button type="button" className="btn op-btn" onClick={() => appendToken("+")}>+</button>

        <button type="button" className="btn num-btn" onClick={() => appendToken("0")}>0</button>
        <button type="button" className="btn num-btn" onClick={() => appendToken(".")}>.</button>
        <button type="button" className="btn op-btn" style={{ gridColumn: "span 2", background: "#10b981" }} onClick={handleEquals}>=</button>
      </form>
    </div>
  );
}

export default App;