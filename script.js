// === Chatbot Script (Speech + One-shot Formspree logging, per-stage columns, no manual typing) ===

// 0) 替换为你的 Formspree 端点
const FORM_ENDPOINT = 'https://formspree.io/f/mpwjlwbk';

// 1) DOM
const chatLog  = document.getElementById('chat-log');
const userInput= document.getElementById('user-input');
const micBtn   = document.getElementById('mic-btn');
const sendBtn  = document.getElementById('send-btn');

// 2) 对话阶段：0 -> 首问；1 -> 结束并一次性上报
let stage = 0;

// 3) 仅收集“用户输入”的缓冲 & 一次性上报控制
const userMessages = [];
let submitted = false; // 防重复上报
function generateConvoId() {
  const num = Math.floor(Math.random() * 1000)   // 0~999
                .toString()
                .padStart(3, '0');               // 补齐成三位
  return 'v' + num;
}

const convoId = generateConvoId();

// ---------- helper: chat bubble ----------
function createMsg(text, sender){
  const wrap   = document.createElement('div');
  wrap.className = 'msg-wrapper ' + sender;

  const avatar = document.createElement('div');
  avatar.className = 'avatar ' + sender;

  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + sender;
  bubble.innerHTML = text.replace(/\n/g,'<br>');

  if(sender === 'bot'){
    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
  }else{
    wrap.appendChild(bubble);
    wrap.appendChild(avatar);
  }
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ---------- Init ----------
window.onload = ()=>{
  createMsg('我是您的智能点餐助手，很高兴为您服务。请问需要我帮您推荐餐品吗？例如，您可以输入“推荐双人餐”。','bot');

  // 禁止手动输入
  userInput.readOnly = true;
  userInput.addEventListener('keydown',e=>e.preventDefault());
};

// ---------- Speech Recognition ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if(recognition){
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
}

micBtn.onclick = () => {
  if(!recognition){ alert('当前浏览器不支持语音识别'); return; }
  recognition.start();
  micBtn.textContent = '⏺';
};

if(recognition){
  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    userInput.value = transcript;
    micBtn.textContent = '🎤';
  };
  recognition.onerror = () => { micBtn.textContent = '🎤'; };
}
sendBtn.onclick = sendMessage;
userInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };


// ---------- 结束时一次性提交（静默）：按阶段拆列 ----------
// 规则：为每个出现过的 stage 生成 payload 字段：stage{n}_text
// 若同一 stage 有多条输入，则以 " | " 连接
async function submitAllMessagesOnce() {
  if (submitted) return;
  submitted = true;

  const startedAt = performance.timing?.navigationStart
    ? new Date(performance.timing.navigationStart).toISOString()
    : null;

  // 按阶段汇总文本
  const stageBuckets = {};
  userMessages.forEach(m => {
    const key = String(m.stage);
    if (!stageBuckets[key]) stageBuckets[key] = [];
    stageBuckets[key].push(m.text);
  });

  // 组装 payload（基础字段）
  const payload = {
    convoId,
    path: location.pathname,
    startedAt,
    finishedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    // 备份完整数组（不需要可删除此行）
    all_messages: userMessages
  };

  // 动态加入各阶段列：stage0_text, stage1_text, ...
  Object.keys(stageBuckets)
    .sort((a,b)=>+a-+b)
    .forEach(stageKey => {
      const joined = stageBuckets[stageKey].join(' | ');
      payload[`stage${stageKey}_text`] = joined;
    });

  // 尝试 1：正常 JSON（Formspree 可解析）
  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) return; // 静默成功
  } catch (e) {
    // 静默失败，继续降级
    console.debug('Direct JSON submit failed (silenced):', e);
  }

  // 尝试 2：no-cors（尽力送达，无法读取响应）
  try {
    await fetch(FORM_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e2) {
    console.debug('no-cors submit failed (silenced):', e2);
  }
}

// ---------- Bot response ----------
function botRespond() {
  if (stage === 0) {
    createMsg('本店主打融合菜系，可选：川菜 / 粤菜 / 淮扬菜 / 素食等。您更偏好哪种口味呢？', 'bot');
    stage = 1; // 等待用户回答菜系
    return;
  }
  if (stage === 1) {
    createMsg('好的，我这边记录下来了～请问有没有忌口或不吃的食材呢？我来为您推荐合适的套餐哦！', 'bot');
    stage = 2; // 等待用户说忌口
    return;
  }
  if (stage === 2) {
    createMsg(`🎉 感谢您的反馈，本轮对话已结束，您的服务代码是 <b>${convoId}</b>，<b>服务结果将在随后呈现</b>，请返回问卷继续作答。`, 'bot');
    submitAllMessagesOnce();
    stage = 3; // 结束
  }
}


// ---------- send message ----------
async function sendMessage(){
  const text = userInput.value.trim();
  if(!text) return;

  // 渲染 & 清空
  createMsg(text,'user');
  userInput.value = '';
  sendBtn.disabled = true;

  // 仅缓存在内存，不立刻上传
  userMessages.push({ text, stage, ts: new Date().toISOString() });

  setTimeout(()=>{
    sendBtn.disabled = false;
    botRespond();
  }, 1000);
}

sendBtn.o


