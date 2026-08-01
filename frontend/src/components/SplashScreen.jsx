// src/components/SplashScreen.jsx
import { useEffect, useRef, useState } from "react";
import "./SplashScreen.css";
import logoImg from "../assets/logo.png";

const SUBTITLE = "your journal and finance tracker";

export function SplashScreen({ onFinish }) {
  const [phase,   setPhase]   = useState("enter");
  const [typed,   setTyped]   = useState("");
  const [caretOn, setCaretOn] = useState(true);
  const [barFill, setBarFill] = useState(false);
  const timers = useRef([]);

  const T = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  };

  useEffect(() => {
    T(() => setBarFill(true), 1500);
    T(startTyping, 1300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => timers.current.forEach(clearTimeout);
  }, []); // eslint-disable-line

  function startTyping() {
    let i = 0;
    function tick() {
      if (i <= SUBTITLE.length) {
        setTyped(SUBTITLE.slice(0, i));
        i++;
        T(tick, i === 1 ? 0 : 46);
      } else {
        T(() => setCaretOn(false), 500);
        T(() => setCaretOn(true),  800);
        T(() => setCaretOn(false), 1100);
        T(triggerExit, 1400);
      }
    }
    tick();
  }

  function triggerExit() {
    setPhase("exit");
    T(() => onFinish?.(), 650);
  }

  return (
    <div className={`splash splash--${phase}`}>
      <div className="splash__rule" />
      <div className="splash__grid" />
      <div className="splash__center">
        <div className="splash__logo-wrap">
          <img className="splash__logo" src={logoImg} alt="kitta kat" draggable={false} />
        </div>
        <div className="splash__brand">kitta kat</div>
        <div className="splash__sub-row">
          <span className="splash__sub-txt">{typed}</span>
          <span className={`splash__caret${caretOn ? " splash__caret--on" : ""}`} />
        </div>
        <div className="splash__bar-track">
          <div className={`splash__bar-fill${barFill ? " splash__bar-fill--go" : ""}`} />
        </div>
      </div>
      <div className="splash__version">v6.0 · NEPSE Journal</div>
    </div>
  );
}
