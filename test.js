import { TextLineStream } from "@std/streams";
import { assertEquals } from "@std/assert";

async function loadTestData(tsvFile) {
  const arr = [];
  const file = await Deno.open(tsvFile);
  const lineStream = file.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());
  for await (const line of lineStream) {
    if (line.startsWith("#")) continue;
    // if (line.startsWith("#")) {
    //   line = line.slice(2);
    // }
    const [kanji, yomis] = line.split("\t");
    arr.push([kanji, yomis.split("|")]);
  }
  return arr;
}

async function initYomiDict(yomiFile) {
  // https://jsben.ch/q4RPK
  const yomiDict = new Map();
  const file = await Deno.open(yomiFile);
  const lineStream = file.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());
  for await (const line of lineStream) {
    line.split("\n").forEach((line) => {
      const arr = line.split(",");
      const yomi = arr[0];
      const kanjis = arr.slice(1);
      for (const kanji of kanjis) {
        if (yomiDict.has(kanji)) {
          const yomis = yomiDict.get(kanji);
          yomis.push(yomi);
          yomiDict.set(kanji, yomis);
        } else {
          yomiDict.set(kanji, [yomi]);
        }
      }
    });
  }
  for (const [kanji, yomis] of yomiDict) {
    const sortedYomis = yomis.sort((a, b) => b.length - a.length);
    yomiDict.set(kanji, sortedYomis);
  }
  return yomiDict;
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
    .replace(/[\s　・。、「」!！?？]/g, "")
    .replace(/\d+/g, (n) => numbersToKanji(n));
}

function isEquals(reply, answer, yomiDict) {
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

for (let i = 1; i <= 10; i++) {
  const yomiDict = await initYomiDict(`src/data/${i}.yomi`);
  const testData = await loadTestData(`src/data/${i}.tsv`);
  for (const datum of testData) {
    const [reply, answers] = datum;
    answers.forEach((answer) => {
      Deno.test(reply, () => {
        assertEquals(isEquals(reply, answer, yomiDict), true);
      });
    });
  }
}
