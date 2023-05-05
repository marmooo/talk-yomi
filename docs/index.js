const replyPlease=document.getElementById("replyPlease"),reply=document.getElementById("reply"),playPanel=document.getElementById("playPanel"),countPanel=document.getElementById("countPanel"),scorePanel=document.getElementById("scorePanel"),gameTime=180;let yomiDict=new Map,problems=[],problemCandidate,answerKanji="漢字",answerYomis=["かんじ"],correctCount=problemCount=0;const audioContext=new AudioContext,audioBufferCache={};loadAudio("end","mp3/end.mp3"),loadAudio("correct","mp3/correct3.mp3"),loadAudio("incorrect","mp3/incorrect1.mp3");let japaneseVoices=[];loadVoices();const voiceInput=setVoiceInput();loadConfig();function loadConfig(){localStorage.getItem("darkMode")==1&&(document.documentElement.dataset.theme="dark")}function toggleDarkMode(){localStorage.getItem("darkMode")==1?(localStorage.setItem("darkMode",0),delete document.documentElement.dataset.theme):(localStorage.setItem("darkMode",1),document.documentElement.dataset.theme="dark")}async function playAudio(b,c){const d=await loadAudio(b,audioBufferCache[b]),a=audioContext.createBufferSource();if(a.buffer=d,c){const b=audioContext.createGain();b.gain.value=c,b.connect(audioContext.destination),a.connect(b),a.start()}else a.connect(audioContext.destination),a.start()}async function loadAudio(a,c){if(audioBufferCache[a])return audioBufferCache[a];const d=await fetch(c),e=await d.arrayBuffer(),b=await audioContext.decodeAudioData(e);return audioBufferCache[a]=b,b}function unlockAudio(){audioContext.resume()}function loadVoices(){const a=new Promise(function(b){let a=speechSynthesis.getVoices();if(a.length!==0)b(a);else{let c=!1;speechSynthesis.addEventListener("voiceschanged",()=>{c=!0,a=speechSynthesis.getVoices(),b(a)}),setTimeout(()=>{c||document.getElementById("noTTS").classList.remove("d-none")},1e3)}});a.then(a=>{japaneseVoices=a.filter(a=>a.lang=="ja-JP")})}function speak(b){speechSynthesis.cancel();const a=new SpeechSynthesisUtterance(b);a.voice=japaneseVoices[Math.floor(Math.random()*japaneseVoices.length)],a.lang="ja-JP",speechSynthesis.speak(a)}function getRandomInt(a,b){return a=Math.ceil(a),b=Math.floor(b),Math.floor(Math.random()*(b-a)+a)}function hideAnswer(){document.getElementById("answer").classList.add("d-none")}function sleep(a){return new Promise(b=>setTimeout(b,a))}async function showAnswer(){document.getElementById("answer").classList.remove("d-none"),speak(answerYomis.join(", ")),await sleep(2e3),replyPlease.classList.remove("d-none"),reply.classList.add("d-none"),nextProblem()}function nextProblem(){problemCount+=1,problemCandidate.length<=0&&(problemCandidate=problems.slice());const b=problemCandidate.splice(getRandomInt(0,problemCandidate.length),1)[0],[c,a]=b,d=a[getRandomInt(0,a.length)].length;answerKanji=c,answerYomis=a.filter(a=>a.length==d),hideAnswer(),document.getElementById("problem").textContent=answerKanji,document.getElementById("answer").textContent=answerYomis.join(", "),document.getElementById("reply").textContent="",startVoiceInput()}function initProblems(){const a=document.getElementById("gradeOption").selectedIndex+1;fetch("data/"+a+".tsv").then(a=>a.text()).then(a=>{problems=[],a.trimEnd().split(/\n/).forEach(a=>{const[b,c]=a.split("	");problems.push([b,c.split("|")])}),problemCandidate=problems.slice()})}let gameTimer;function startGameTimer(){clearInterval(gameTimer);const a=document.getElementById("time");initTime(),gameTimer=setInterval(()=>{const b=parseInt(a.textContent);b>0?a.textContent=b-1:(clearInterval(gameTimer),playAudio("end"),playPanel.classList.add("d-none"),scorePanel.classList.remove("d-none"),document.getElementById("score").textContent=correctCount,document.getElementById("total").textContent=problemCount)},1e3)}let countdownTimer;function countdown(){clearTimeout(countdownTimer),countPanel.classList.remove("d-none"),playPanel.classList.add("d-none"),scorePanel.classList.add("d-none");const a=document.getElementById("counter");a.textContent=3,countdownTimer=setInterval(()=>{const b=["skyblue","greenyellow","violet","tomato"];if(parseInt(a.textContent)>1){const c=parseInt(a.textContent)-1;a.style.backgroundColor=b[c],a.textContent=c}else clearTimeout(countdownTimer),countPanel.classList.add("d-none"),playPanel.classList.remove("d-none"),correctCount=problemCount=0,document.getElementById("score").textContent=correctCount,document.getElementById("total").textContent=problemCount-1,nextProblem(),startGameTimer()},1e3)}function initTime(){document.getElementById("time").textContent=gameTime}function setVoiceInput(){if("webkitSpeechRecognition"in window){const a=new webkitSpeechRecognition;return a.lang="ja-JP",a.continuous=!0,a.onstart=voiceInputOnStart,a.onend=()=>{speechSynthesis.speaking||a.start()},a.onresult=d=>{const b=d.results[0][0].transcript,c=document.getElementById("reply");answerYomis.some(a=>isEquals(b,a,yomiDict))?(playAudio("correct"),c.textContent="⭕ "+b,nextProblem(),correctCount+=1):(playAudio("incorrect"),c.textContent=b),replyPlease.classList.add("d-none"),reply.classList.remove("d-none"),a.stop()},a}else document.getElementById("noSTT").classList.remove("d-none")}function voiceInputOnStart(){document.getElementById("startVoiceInput").classList.add("d-none"),document.getElementById("stopVoiceInput").classList.remove("d-none")}function voiceInputOnStop(){document.getElementById("startVoiceInput").classList.remove("d-none"),document.getElementById("stopVoiceInput").classList.add("d-none")}function startVoiceInput(){try{voiceInput.start()}catch{}}function stopVoiceInput(){voiceInputOnStop(),voiceInput.stop()}function initYomiDict(){const b=document.getElementById("gradeOption").selectedIndex+1,a=new Map;return fetch(`data/${b}.yomi`).then(a=>a.text()).then(b=>{b.trimEnd().split("\n").forEach(d=>{const b=d.split(","),c=b[0],e=b.slice(1);for(const b of e)if(a.has(b)){const d=a.get(b);d.push(c),a.set(b,d)}else a.set(b,[c])});for(const[b,c]of a){const d=c.sort((a,b)=>b.length-a.length);a.set(b,d)}yomiDict=a})}const numbersToKanji=a=>{if(a===void 0||a===null||a==="")return"";if(!/^-?[0-9]+$/g.test(a))throw new TypeError("半角数字以外の文字が含まれています。漢数字に変換できませんでした。-> "+a);if(a=Number(a),!Number.isSafeInteger(a))throw new RangeError("数値が "+Number.MIN_SAFE_INTEGER+" ～ "+Number.MAX_SAFE_INTEGER+" の範囲外です。漢数字に変換できませんでした。-> "+a);if(a===0)return"零";let b="";a<0&&(b+="マイナス",a*=-1);const d=["","一","二","三","四","五","六","七","八","九"],e=["十","百","千","万","億","兆","京","垓","𥝱","穣","溝","澗","正","載","極","恒河沙","阿僧祇","那由他","不可思議","無量大数"],c=[1,2,3,4,8,12,16,20,24,28,32,36,40,44,48,52,56,60,64,68],f=c.length;for(let g=f;g>=0;--g){const h=Math.pow(10,c[g]);if(a>=h){const f=Math.floor(a/h);f>=10?b+=numbersToKanji(f):f==1&&c[g]<=3||(b+=d[f]),b+=e[g],a-=f*h}}return b+=d[a],b};function formatSentence(a){return hiraToKana(a).toLowerCase().replace(/\d+/g,a=>numbersToKanji(a))}function isEqualsYomi(q,p,m){const i=formatSentence(q),f=formatSentence(p),l=5,o=10,n=f.length*f.length*o;let k=0,c=0,a=1,b=0,d=0;const h=[0],g=[0],e=[1];let j=[];while(c<i.length){if(k+=1,k>n)return!1;const o=i.slice(c,c+a);if(m.has(o)){const n=m.get(o),k=n.filter(a=>{const c=f.slice(b,b+a.length);return a==c});if(j=k,k.length>0){const j=k[d];if(j){if(h.push(c),e.push(a),g.push(b),c+=a,b+=j.length,a=1,d=0,c==i.length){if(b==f.length)break;h.pop(),e.pop(),g.pop(),c=h.pop(),a=e.pop()+1,b=g.pop()}}else a=e.at(-1)+1,d=0}else a>=l||a>=f.length?h.length==0?(a+=1,d+=0):(c=h.pop(),a=e.pop()+1,b=g.pop()):(a+=1,d=0)}else if(o==f.slice(b,b+a)){if(e.push(a),c+=a,b+=a,d=0,a=1,h.push(c),g.push(b),c==i.length)break}else j.length>d+1?(d+=1,b=g.at(-1)+j[d].length):a==l?(c=h.pop(),a=e.pop()+1,b=g.pop()):a+=1}return b==f.length}function hiraToKana(a){return a.replace(/[\u3041-\u3096]/g,a=>{const b=a.charCodeAt(0)+96;return String.fromCharCode(b)})}function formatLongNote(a){return a=hiraToKana(a),a[0]+a.slice(1).replace(/[アイウエオ]/g,"ー")}function isEqualsLongNote(a,b){const c=formatLongNote(a),d=formatLongNote(b);return d==c}function isEquals(a,b,c){return!!isEqualsLongNote(a,b)||(!!isEqualsYomi(a,b,c))}initProblems(),initYomiDict(),document.getElementById("toggleDarkMode").onclick=toggleDarkMode,document.getElementById("restartButton").onclick=countdown,document.getElementById("startButton").onclick=countdown,document.getElementById("showAnswer").onclick=showAnswer,document.getElementById("startVoiceInput").onclick=startVoiceInput,document.getElementById("stopVoiceInput").onclick=stopVoiceInput,document.getElementById("gradeOption").onchange=initProblems,document.addEventListener("click",unlockAudio,{once:!0,useCapture:!0})