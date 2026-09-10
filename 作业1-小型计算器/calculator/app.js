// 计算器逻辑 - 杨一 2024020
// 功能：四则运算 + 键盘支持 + 历史记录 + 除零提示

var resultEl = document.getElementById("calcResult");
var exprEl = document.getElementById("calcExpr");
var historyEl = document.getElementById("calcHistory");

var state = {
  current: "0",
  previous: null,
  operator: null,
  waiting: false
};

function inputDigit(d) {
  if (state.waiting) { state.current = d; state.waiting = false; }
  else { state.current = state.current === "0" ? d : state.current + d; }
}

function inputDot() {
  if (state.waiting) { state.current = "0."; state.waiting = false; return; }
  if (state.current.indexOf(".") === -1) state.current += ".";
}

function setOperator(op) {
  if (state.operator !== null && !state.waiting) calculate();
  state.operator = op;
  state.previous = state.current;
  state.waiting = true;
}

function calculate() {
  if (state.operator === null || state.previous === null) return;
  var a = parseFloat(state.previous);
  var b = parseFloat(state.current);
  var formula = state.previous + " " + state.operator + " " + b;
  var r;
  switch (state.operator) {
    case "+": r = a + b; break;
    case "-": r = a - b; break;
    case "*": r = a * b; break;
    case "/":
      if (b === 0) { r = "不能除以0"; break; }
      r = a / b;
      break;
    case "%": r = a % b; break;
    default: return;
  }
  r = typeof r === "string" ? r : parseFloat(r.toFixed(10));
  state.current = String(r);
  addHistory(formula, state.current);
  state.operator = null;
  state.previous = null;
  state.waiting = false;
}

function clearAll() {
  state.current = "0"; state.previous = null; state.operator = null; state.waiting = false;
}

function backspace() {
  if (state.waiting) return;
  state.current = state.current.length > 1 ? state.current.slice(0, -1) : "0";
}

function addHistory(formula, value) {
  var div = document.createElement("div");
  div.className = "history-entry";
  div.innerHTML = '<span class="formula">' + formula + ' =</span><span class="value">' + value + '</span>';
  historyEl.appendChild(div);
}

function handleKey(key) {
  if (/^[0-9]$/.test(key)) inputDigit(key);
  else if (key === ".") inputDot();
  else if (["+", "-", "*", "/", "%"].indexOf(key) !== -1) setOperator(key);
  else if (key === "Enter" || key === "=") calculate();
  else if (key === "C" || key === "Escape") clearAll();
  else if (key === "Backspace") backspace();
  updateDisplay();
}

function updateDisplay() {
  resultEl.textContent = state.current;
  exprEl.textContent = state.previous !== null ? state.previous + " " + state.operator : "\u00a0";
}

document.querySelectorAll(".key").forEach(function (btn) {
  btn.addEventListener("click", function () { handleKey(btn.dataset.key); });
});
document.addEventListener("keydown", function (e) {
  var target = e.target.tagName;
  if (target === "INPUT" || target === "TEXTAREA") return;
  handleKey(e.key);
});

document.getElementById("historyToggle").addEventListener("click", function () {
  historyEl.style.display = historyEl.style.display === "none" ? "block" : "none";
});
