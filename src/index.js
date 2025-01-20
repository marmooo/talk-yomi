const replyPlease = document.getElementById("replyPlease");
const reply = document.getElementById("reply");
const playPanel = document.getElementById("playPanel");
const infoPanel = document.getElementById("infoPanel");
const countPanel = document.getElementById("countPanel");
const scorePanel = document.getElementById("scorePanel");
const gameTime = 180;
let yomiDict = new Map();
let problems = [];
let problemCandidate;
let answerKanji = "漢字";
let answerYomis = ["かんじ"];
let correctCount = problemCount = 0;
let audioContext;
const audioBufferCache = {};
let japaneseVoices = [];
loadVoices();
const voiceInput = setVoiceInput();
loadConfig();

function loadConfig() {
  if (localStorage.getItem("darkMode") == 1) {
    document.documentElement.setAttribute("data-bs-theme", "dark");
  }
}

function toggleDarkMode() {
  if (localStorage.getItem("darkMode") == 1) {
    localStorage.setItem("darkMode", 0);
    document.documentElement.setAttribute("data-bs-theme", "light");
  } else {
    localStorage.setItem("darkMode", 1);
    document.documentElement.setAttribute("data-bs-theme", "dark");
  }
}

function createAudioContext() {
  if (globalThis.AudioContext) {
    return new globalThis.AudioContext();
  } else {
    console.error("Web Audio API is not supported in this browser");
    return null;
  }
}

function unlockAudio() {
  if (audioContext) {
    audioContext.resume();
  } else {
    audioContext = createAudioContext();
    loadAudio("end", "mp3/end.mp3");
    loadAudio("correct", "mp3/correct3.mp3");
    loadAudio("incorrect", "mp3/incorrect1.mp3");
  }
  document.removeEventListener("pointerdown", unlockAudio);
  document.removeEventListener("keydown", unlockAudio);
}

async function loadAudio(name, url) {
  if (!audioContext) return;
  if (audioBufferCache[name]) return audioBufferCache[name];
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioBufferCache[name] = audioBuffer;
    return audioBuffer;
  } catch (error) {
    console.error(`Loading audio ${name} error:`, error);
    throw error;
  }
}

function playAudio(name, volume) {
  if (!audioContext) return;
  const audioBuffer = audioBufferCache[name];
  if (!audioBuffer) {
    console.error(`Audio ${name} is not found in cache`);
    return;
  }
  const sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  const gainNode = audioContext.createGain();
  if (volume) gainNode.gain.value = volume;
  gainNode.connect(audioContext.destination);
  sourceNode.connect(gainNode);
  sourceNode.start();
}

function loadVoices() {
  // https://stackoverflow.com/questions/21513706/
  const allVoicesObtained = new Promise((resolve) => {
    let voices = speechSynthesis.getVoices();
    if (voices.length !== 0) {
      resolve(voices);
    } else {
      let supported = false;
      speechSynthesis.addEventListener("voiceschanged", () => {
        supported = true;
        voices = speechSynthesis.getVoices();
        resolve(voices);
      });
      setTimeout(() => {
        if (!supported) {
          document.getElementById("noTTS").classList.remove("d-none");
        }
      }, 1000);
    }
  });
  allVoicesObtained.then((voices) => {
    japaneseVoices = voices.filter((voice) => voice.lang == "ja-JP");
  });
}

function speak(text) {
  speechSynthesis.cancel();
  const msg = new globalThis.SpeechSynthesisUtterance(text);
  msg.voice = japaneseVoices[Math.floor(Math.random() * japaneseVoices.length)];
  msg.lang = "ja-JP";
  speechSynthesis.speak(msg);
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

function hideAnswer() {
  document.getElementById("answer").classList.add("d-none");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function showAnswer() {
  document.getElementById("answer").classList.remove("d-none");
  speak(answerYomis.join(", "));
  await sleep(2000);
  replyPlease.classList.remove("d-none");
  reply.classList.add("d-none");
  nextProblem();
}

function nextProblem() {
  problemCount += 1;
  if (problemCandidate.length <= 0) {
    problemCandidate = problems.slice();
  }
  const problem =
    problemCandidate.splice(getRandomInt(0, problemCandidate.length), 1)[0];
  const [kanji, yomis] = problem;
  const yomiLength = yomis[getRandomInt(0, yomis.length)].length;
  answerKanji = kanji;
  answerYomis = yomis.filter((yomi) => yomi.length == yomiLength);
  hideAnswer();
  document.getElementById("problem").textContent = answerKanji;
  document.getElementById("answer").textContent = answerYomis.join(", ");
  document.getElementById("reply").textContent = "";
  startVoiceInput();
}

function initProblems() {
  const grade = document.getElementById("gradeOption").selectedIndex + 1;
  fetch("data/" + grade + ".tsv")
    .then((response) => response.text())
    .then((tsv) => {
      problems = [];
      tsv.trimEnd().split(/\n/).forEach((line) => {
        const [kanji, yomis] = line.split("\t");
        problems.push([kanji, yomis.split("|")]);
      });
      problemCandidate = problems.slice();
    });
}

let gameTimer;
function startGameTimer() {
  clearInterval(gameTimer);
  const timeNode = document.getElementById("time");
  initTime();
  gameTimer = setInterval(() => {
    const t = parseInt(timeNode.textContent);
    if (t > 0) {
      timeNode.textContent = t - 1;
    } else {
      clearInterval(gameTimer);
      playAudio("end");
      playPanel.classList.add("d-none");
      scorePanel.classList.remove("d-none");
      document.getElementById("score").textContent = correctCount;
      document.getElementById("total").textContent = problemCount;
    }
  }, 1000);
}

let countdownTimer;
function countdown() {
  clearTimeout(countdownTimer);
  countPanel.classList.remove("d-none");
  infoPanel.classList.add("d-none");
  playPanel.classList.add("d-none");
  scorePanel.classList.add("d-none");
  const counter = document.getElementById("counter");
  counter.textContent = 3;
  countdownTimer = setInterval(() => {
    const colors = ["skyblue", "greenyellow", "violet", "tomato"];
    if (parseInt(counter.textContent) > 1) {
      const t = parseInt(counter.textContent) - 1;
      counter.style.backgroundColor = colors[t];
      counter.textContent = t;
    } else {
      clearTimeout(countdownTimer);
      countPanel.classList.add("d-none");
      infoPanel.classList.remove("d-none");
      playPanel.classList.remove("d-none");
      correctCount = problemCount = 0;
      document.getElementById("score").textContent = correctCount;
      document.getElementById("total").textContent = problemCount - 1;
      nextProblem();
      startGameTimer();
    }
  }, 1000);
}

function initTime() {
  document.getElementById("time").textContent = gameTime;
}

function setVoiceInput() {
  if (!globalThis.webkitSpeechRecognition) {
    document.getElementById("noSTT").classList.remove("d-none");
  } else {
    const voiceInput = new globalThis.webkitSpeechRecognition();
    voiceInput.lang = "ja-JP";
    // voiceInput.interimResults = true;
    voiceInput.continuous = true;

    voiceInput.onstart = voiceInputOnStart;
    voiceInput.onend = () => {
      if (!speechSynthesis.speaking) {
        voiceInput.start();
      }
    };
    voiceInput.onresult = (event) => {
      const replyText = event.results[0][0].transcript;
      const replyObj = document.getElementById("reply");
      const correct = answerYomis
        .some((answerYomi) => isEquals(replyText, answerYomi, yomiDict));
      if (correct) {
        playAudio("correct");
        replyObj.textContent = "⭕ " + replyText;
        nextProblem();
        correctCount += 1;
      } else {
        playAudio("incorrect");
        replyObj.textContent = replyText;
      }
      replyPlease.classList.add("d-none");
      reply.classList.remove("d-none");
      voiceInput.stop();
    };
    return voiceInput;
  }
}

function voiceInputOnStart() {
  document.getElementById("startVoiceInput").classList.add("d-none");
  document.getElementById("stopVoiceInput").classList.remove("d-none");
}

function voiceInputOnStop() {
  document.getElementById("startVoiceInput").classList.remove("d-none");
  document.getElementById("stopVoiceInput").classList.add("d-none");
}

function startVoiceInput() {
  try {
    voiceInput.start();
  } catch {
    // continue regardless of error
  }
}

function stopVoiceInput() {
  voiceInputOnStop();
  voiceInput.stop();
}

function initYomiDict() {
  const grade = document.getElementById("gradeOption").selectedIndex + 1;
  const dict = new Map();
  return fetch(`data/${grade}.yomi`)
    .then((response) => response.text())
    .then((csv) => {
      csv.trimEnd().split("\n").forEach((line) => {
        const arr = line.split(",");
        const yomi = arr[0];
        const kanjis = arr.slice(1);
        for (const kanji of kanjis) {
          if (dict.has(kanji)) {
            const yomis = dict.get(kanji);
            yomis.push(yomi);
            dict.set(kanji, yomis);
          } else {
            dict.set(kanji, [yomi]);
          }
        }
      });
      for (const [kanji, yomis] of dict) {
        const sortedYomis = yomis.sort((a, b) => b.length - a.length);
        dict.set(kanji, sortedYomis);
      }
      yomiDict = dict;
    });
}

/**
 * https://note.kiriukun.com/entry/20181229-numbers-to-chinese-numerals
 * 数値を漢数字表記に変換
 * @param  {String|Number} num - 半角数字
 * @return {String} 漢数字表記
 * @throws {TypeError} 半角数字以外の文字が含まれている場合
 * @throws {RangeError} 数値が Number.MIN_SAFE_INTEGER ～ Number.MAX_SAFE_INTEGER の範囲外の場合
 */
const numbersToKanji = (num) => {
  if (num === undefined || num === null || num === "") {
    return "";
  }
  if (!(/^-?[0-9]+$/g.test(num))) {
    throw new TypeError(
      "半角数字以外の文字が含まれています。漢数字に変換できませんでした。-> " +
        num,
    );
  }
  num = Number(num);
  if (!Number.isSafeInteger(num)) {
    throw new RangeError(
      "数値が " + Number.MIN_SAFE_INTEGER + " ～ " + Number.MAX_SAFE_INTEGER +
        " の範囲外です。漢数字に変換できませんでした。-> " + num,
    );
  }
  if (num === 0) {
    return "零";
  }
  let ret = "";
  if (num < 0) {
    ret += "マイナス";
    num *= -1;
  }
  const kanjiNums = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const kanjiNames = [
    "十",
    "百",
    "千",
    "万",
    "億",
    "兆",
    "京",
    "垓",
    "𥝱",
    "穣",
    "溝",
    "澗",
    "正",
    "載",
    "極",
    "恒河沙",
    "阿僧祇",
    "那由他",
    "不可思議",
    "無量大数",
  ];
  const exponents = [
    1,
    2,
    3,
    4,
    8,
    12,
    16,
    20,
    24,
    28,
    32,
    36,
    40,
    44,
    48,
    52,
    56,
    60,
    64,
    68,
  ];
  const exponentsLen = exponents.length;
  for (let i = exponentsLen; i >= 0; --i) {
    const bias = Math.pow(10, exponents[i]);
    if (num >= bias) {
      const top = Math.floor(num / bias);
      if (top >= 10) {
        ret += numbersToKanji(top);
      } else {
        if (top == 1 && exponents[i] <= 3) {
          // ※先頭の数字が1、かつ指数が3 (千の位) 以下の場合のみ『一』をつけない
        } else {
          ret += kanjiNums[top];
        }
      }
      ret += kanjiNames[i];
      num -= top * bias;
    }
  }
  ret += kanjiNums[num];
  return ret;
};

function formatSentence(sentence) {
  return hiraToKana(sentence)
    .toLowerCase()
    .replace(/\d+/g, (n) => numbersToKanji(n));
}

function isEqualsYomi(reply, answer, yomiDict) {
  // 音声認識では記号が付かないので、解答側で使う一部記号だけを揃える
  const formatedReply = formatSentence(reply);
  const formatedAnswer = formatSentence(answer);
  const maxLength = 5; // build.js で制限して高速化 (普通は残り文字数)
  const maxYomiNum = 10; // yomi-dict の最大読み方パターン数
  const stop = formatedAnswer.length * formatedAnswer.length * maxYomiNum;
  let cnt = 0;
  let i = 0;
  let j = 1;
  let k = 0;
  let l = 0;
  const pi = [0];
  const pk = [0];
  const pj = [1];
  let pl = [];
  while (i < formatedReply.length) {
    cnt += 1;
    if (cnt > stop) return false;
    const str = formatedReply.slice(i, i + j);
    if (yomiDict.has(str)) {
      const yomis = yomiDict.get(str);
      const matched = yomis.filter((yomi) => {
        const check = formatedAnswer.slice(k, k + yomi.length);
        if (yomi == check) {
          return true;
        } else {
          return false;
        }
      });
      pl = matched;
      if (matched.length > 0) {
        const yomi = matched[l];
        if (yomi) {
          pi.push(i);
          pj.push(j);
          pk.push(k);
          i += j;
          k += yomi.length;
          j = 1;
          l = 0;
          if (i == formatedReply.length) {
            if (k == formatedAnswer.length) {
              break;
            } else {
              pi.pop();
              pj.pop();
              pk.pop();
              i = pi.pop(); // 前の文字に戻って
              j = pj.pop() + 1; // gram を増やす
              k = pk.pop();
            }
          }
        } else {
          j = pj.at(-1) + 1;
          l = 0;
        }
      } else { // 辞書に登録はされているが読みの選択が悪く一致しない時など
        if (j >= maxLength || j >= formatedAnswer.length) {
          if (pi.length == 0) {
            j += 1;
            l += 0;
          } else {
            i = pi.pop(); // 前の文字に戻って
            j = pj.pop() + 1; // gram を増やす
            k = pk.pop();
          }
        } else { // gramを増やして一致をさがす
          j += 1;
          l = 0;
        }
      }
    } else if (str == formatedAnswer.slice(k, k + j)) {
      pj.push(j);
      i += j;
      k += j;
      l = 0;
      j = 1;
      pi.push(i);
      pk.push(k);
      if (i == formatedReply.length) break;
      // 辞書に読みが登録されていない時
    } else {
      if (pl.length > l + 1) { // 読みが複数あれば
        l += 1;
        k = pk.at(-1) + pl[l].length; // その読みを試してみる
      } else if (j == maxLength) { // 前方の読みが合わないなら
        i = pi.pop(); // 前の文字に戻って
        j = pj.pop() + 1; // gram を増やす
        k = pk.pop();
      } else { // gramを増やして一致をさがす
        j += 1;
      }
    }
  }
  if (k == formatedAnswer.length) {
    return true;
  } else {
    return false;
  }
}

function hiraToKana(str) {
  return str.replace(/[ぁ-ゖ]/g, (match) => {
    const chr = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(chr);
  });
}

function formatLongNote(text) {
  text = hiraToKana(text);
  return text[0] + text.slice(1).replace(/[アイウエオ]/g, "ー");
}

function isEqualsLongNote(reply, answer) {
  const formatReply = formatLongNote(reply);
  const formatAnswer = formatLongNote(answer);
  if (formatAnswer == formatReply) {
    return true;
  } else {
    return false;
  }
}

function isEquals(reply, answer, yomiDict) {
  if (isEqualsLongNote(reply, answer)) return true;
  if (isEqualsYomi(reply, answer, yomiDict)) return true;
  return false;
}

initProblems();
initYomiDict();

document.getElementById("toggleDarkMode").onclick = toggleDarkMode;
document.getElementById("restartButton").onclick = countdown;
document.getElementById("startButton").onclick = countdown;
document.getElementById("showAnswer").onclick = showAnswer;
document.getElementById("startVoiceInput").onclick = startVoiceInput;
document.getElementById("stopVoiceInput").onclick = stopVoiceInput;
document.getElementById("gradeOption").onchange = initProblems;
document.addEventListener("pointerdown", unlockAudio, { once: true });
document.addEventListener("keydown", unlockAudio, { once: true });
