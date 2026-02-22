import { TextLineStream } from "@std/streams";
import { assertEquals } from "@std/assert";

// https://jsr.io/@std/streams/doc/unstable-to-lines/~/toLines
function toLines(readable, options) {
  return readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream(), options);
}

async function loadTestData(tsvFile) {
  const arr = [];
  const file = await Deno.open(tsvFile);
  for await (const line of toLines(file.readable)) {
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
  for await (const line of toLines(file.readable)) {
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

function matchesYomi(reply, answer, yomiDict, debug = false) {
  const formatedReply = formatSentence(reply);
  const formatedAnswer = formatSentence(answer);
  const maxLength = 5;
  const maxYomiNum = 10;
  const stop = formatedAnswer.length * formatedAnswer.length * maxYomiNum;
  let cnt = 0;

  const log = (...args) => {
    if (debug) console.log(...args);
  };

  // 位置 i（reply）と k（answer）から試せる候補リストを作る。
  // maxLength から 1 の順（長いgramを優先）で辞書を引き、
  // answer の位置 k からの文字列と一致する読みがあれば候補に追加する。
  // 辞書にない文字列は直接一致（カタカナ同士など）も候補に加える。
  // 戻り値: [{ str, jj, matched }] の配列
  //   str     : reply から切り出した文字列
  //   jj      : str の文字数（reply を何文字進めるか）
  //   matched : answer と一致した読みの配列（yomiDict の値のサブセット）
  function getCandidates(i, k) {
    const candidates = [];
    for (let jj = maxLength; jj >= 1; jj--) {
      const str = formatedReply.slice(i, i + jj);
      if (str === "") continue;
      if (yomiDict.has(str)) {
        const matched = yomiDict.get(str).filter((yomi) =>
          formatedAnswer.slice(k, k + yomi.length) == yomi
        );
        if (matched.length > 0) {
          candidates.push({ str, jj, matched });
        }
      } else if (str == formatedAnswer.slice(k, k + jj)) {
        // 辞書にない文字列（カタカナや英数字など）は直接一致を試みる
        candidates.push({ str, jj, matched: [str] });
      }
    }
    return candidates;
  }

  // バックトラック付きの照合ループ
  // 基本戦略：
  //   1. 現在位置 i から getCandidates で候補リストを作る
  //   2. 候補を順番に試して reply と answer を同時に消費していく
  //   3. reply を最後まで消費したとき answer も最後まで消費できていれば成功
  //   4. 失敗したらスタックから前の状態を復元して次の候補を試す
  //
  // スタックの各要素: { i, k, candidates, ci, l }
  //   i          : reply の位置
  //   k          : answer の位置
  //   candidates : その i, k で作った候補リスト
  //   ci         : candidates の現在インデックス
  //   l          : matched（読み候補）の現在インデックス
  //
  // 次の候補への移り方：
  //   - まず matched の次の読み（l+1）を試す
  //   - matched が尽きたら candidates の次のgramパターン（ci+1）へ
  //   - candidates も尽きたらスタックをポップしてさらに前へ戻る
  const stack = [];

  let i = 0;
  let k = 0;
  let candidates = getCandidates(i, k);
  let ci = 0; // candidates のインデックス
  let l = 0; // matched のインデックス

  while (true) {
    cnt += 1;
    if (cnt > stop) {
      log("STOP");
      return false;
    }

    log(
      `cnt=${cnt} i=${i} k=${k} ci=${ci} l=${l} candidates=${
        JSON.stringify(candidates.map((c) => c.str))
      }`,
    );

    if (ci < candidates.length && candidates[ci].matched[l]) {
      // 現在の候補で前進できる
      const { str, jj, matched } = candidates[ci];
      const yomi = matched[l];
      log(`  -> advance str=${str} yomi=${yomi}`);

      // 前に戻れるよう現在の状態をスタックに積む
      stack.push({ i, k, candidates, ci, l });

      i += jj;
      k += yomi.length;
      l = 0;

      if (i == formatedReply.length) {
        if (k == formatedAnswer.length) {
          // reply と answer を同時に使い切った → 一致成功
          log(`  -> done!`);
          return true;
        } else {
          // reply は終わったが answer が残っている → バックトラック
          log(
            `  -> end of reply but k=${k} != ${formatedAnswer.length}, backtrack`,
          );
          const prev = stack.pop();
          if (!prev) return false;
          ({ i, k, candidates, ci, l } = prev);
          // 次の候補へ
          if (candidates[ci].matched[l + 1]) {
            l += 1; // 同じgramで別の読みを試す
          } else {
            ci += 1; // 次のgramパターンへ
            l = 0;
          }
        }
      } else {
        // まだ reply が残っている → 次の位置の候補リストを作る
        candidates = getCandidates(i, k);
        ci = 0;
        l = 0;
      }
    } else {
      // 現在位置の候補が全部尽きた → バックトラック
      log(`  -> backtrack`);
      const prev = stack.pop();
      if (!prev) return false; // スタックが空 = どこにも戻れない → 不一致
      ({ i, k, candidates, ci, l } = prev);
      // 次の候補へ
      if (candidates[ci].matched[l + 1]) {
        l += 1; // 同じgramで別の読みを試す
      } else {
        ci += 1; // 次のgramパターンへ
        l = 0;
      }
    }
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
        const result = matchesYomi(reply, answer, yomiDict);
        if (!result) matchesYomi(reply, answer, yomiDict, true);
        assertEquals(result, true);
      });
    });
  }
}
