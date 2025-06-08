import { TextLineStream } from "jsr:@std/streams/text-line-stream";

function hiraToKana(str) {
  return str.replace(/[ぁ-ゖ]/g, (match) => {
    const chr = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(chr);
  });
}

function getYomis(yomiSentence, dict) {
  const result = [];
  for (let i = 0; i < yomiSentence.length; i++) {
    for (let j = 1; j <= 10; j++) {
      const str = yomiSentence.slice(i, i + j);
      if (str in dict) {
        result.push(str);
      }
    }
  }
  return Array.from(new Set(result));
}

async function getMorphemes(tsvFile) {
  const result = {};
  const file = await Deno.open(tsvFile);
  const lineStream = file.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());
  for await (const line of lineStream) {
    if (line.startsWith("#")) continue;
    // if (line.startsWith("#")) {
    //   line = line.slice(2);
    // }
    const yomiSentences = line.split("\t")[1].split("|")
      .map((x) => hiraToKana(x));
    yomiSentences.forEach((yomiSentence) => {
      const yomis = getYomis(yomiSentence, dict);
      for (const yomi of yomis) {
        result[yomi] = dict[yomi];
      }
    });
  }
  return result;
}

async function loadSudachiDict() {
  const dict = {};
  const paths = [
    "SudachiDict/src/main/text/small_lex.csv",
    "SudachiDict/src/main/text/core_lex.csv",
    "SudachiDict/src/main/text/notcore_lex.csv",
  ];
  for (const path of paths) {
    const file = await Deno.open(path);
    const lineStream = file.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream());
    for await (const line of lineStream) {
      const arr = line.split(",");
      const lemma = hiraToKana(arr[0]);
      const leftId = arr[1];
      const yomi = arr[11];
      // 文字数の制約を付けておくと解析が高速になる
      if (
        /[a-zA-Z一-龠々ヵヶ]/.test(lemma) && lemma.length <= 5 && leftId != "-1"
      ) {
        if (yomi in dict) {
          dict[yomi].push(lemma);
        } else {
          dict[yomi] = [lemma];
        }
      }
    }
  }
  for (const [yomi, lemmas] of Object.entries(dict)) {
    dict[yomi] = Array.from(new Set(lemmas));
  }
  return dict;
}

async function parseOnkun(dict) {
  const paths = [
    "SudachiDict/src/main/text/small_lex.csv",
    "SudachiDict/src/main/text/core_lex.csv",
    "SudachiDict/src/main/text/notcore_lex.csv",
  ];
  for (const path of paths) {
    const file = await Deno.open(path);
    const lineStream = file.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream());
    for await (const line of lineStream) {
      const arr = line.split(",");
      const leftId = arr[1];
      if (leftId == "-1") continue;
      const lemma = arr[0];
      const yomi = arr[11];
      const regexp = /^([ぁ-んァ-ヴー]*)[一-龠々ヵヶ]([ぁ-んァ-ヴー]*)$/;
      const matchResult = lemma.match(regexp);
      if (matchResult) {
        const p1 = matchResult[1].length;
        const p2 = matchResult[2].length;
        const kanji = lemma.slice(p1, p1 + 1);
        const kun = yomi.slice(p1, yomi.length - p2);
        if (kun in dict) {
          dict[kun].push(kanji);
        } else {
          dict[kun] = [kanji];
        }
        if (lemma.length > 1) {
          let kanjis = dict[yomi];
          if (kanjis) { // lemma.length > 5
            kanjis = kanjis.filter((x) => x != hiraToKana(lemma));
            if (kanjis.length > 0) {
              dict[yomi] = kanjis;
            } else {
              delete dict[yomi];
            }
          }
        }
      } else if (/^[一-龠々ヵヶ]+$/.test(lemma)) {
        dict[lemma] = yomi;
      }
    }
  }
  for (const [yomi, lemmas] of Object.entries(dict)) {
    dict[yomi] = Array.from(new Set(lemmas));
  }
  return dict;
}

async function removeIdiom2(dict) {
  const paths = [
    "SudachiDict/src/main/text/small_lex.csv",
    "SudachiDict/src/main/text/core_lex.csv",
    "SudachiDict/src/main/text/notcore_lex.csv",
  ];
  for (const path of paths) {
    const file = await Deno.open(path);
    const lineStream = file.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream());
    for await (const line of lineStream) {
      const arr = line.split(",");
      const lemma = arr[0];
      const yomi = hiraToKana(arr[11]);
      if (yomi in dict === false) continue;
      if (/^[一-龠々ヵヶ]{2,2}$/.test(lemma)) {
        for (let i = 1; i < yomi.length; i++) {
          const y1 = yomi.slice(0, i);
          const y2 = yomi.slice(i);
          // 一般的な音訓で構成されるニ字熟語は辞書から除外
          // TODO: 熟語から読みを推定できる(ただし特殊な読みが含まれる)
          // TODO: 三字熟語や「疾走する」のような活用にも適用できる
          // TODO: どこまで単一漢字にするべきかは課題(今は効果の明確なものだけ)
          const l1 = dict[y1];
          const l2 = dict[y2];
          if (
            l1 && l1.includes(lemma[0]) &&
            l2 && l2.includes(lemma[1])
          ) {
            const idioms = dict[yomi].filter((x) => x != lemma);
            dict[yomi] = idioms;
            if (idioms.length == 0) {
              delete dict[yomi];
            }
            break;
          }
        }
      }
    }
  }
  return dict;
}

const dict = await loadSudachiDict();
await parseOnkun(dict);
await removeIdiom2(dict);
for (let i = 1; i <= 10; i++) {
  const result = await getMorphemes(`src/data/${i}.tsv`);
  const tsv = Object.entries(result).map((row) => {
    const [yomi, morphemes] = row;
    return yomi + "," + morphemes.join(",");
  }).join("\n");
  Deno.writeTextFileSync(`src/data/${i}.yomi`, tsv);
}
