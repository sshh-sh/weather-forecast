// 날씨알리미 - 동작 로직

// 각 문장 풀에서 "이미 쓴 표현은 최대한 피하고" 뽑기 위한 사용 기록
const usedTracker = {};

function pickFromPool(pool, poolName) {
  if (!usedTracker[poolName]) usedTracker[poolName] = new Set();
  const used = usedTracker[poolName];
  if (used.size >= pool.length) used.clear();

  let index;
  do {
    index = Math.floor(Math.random() * pool.length);
  } while (used.has(index) && used.size < pool.length);

  used.add(index);
  return pool[index];
}

function hasBatchim(word) {
  const lastChar = word.trim().slice(-1);
  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function josaEunNeun(word) {
  return hasBatchim(word) ? "은" : "는";
}

function josaRoEuro(word) {
  return hasBatchim(word) ? "으로" : "로";
}

function fillTemplate(template, values) {
  let result = template;
  for (const key in values) {
    result = result.split("{" + key + "}").join(values[key]);
  }
  return result;
}

function isCloudMany(cloudText) {
  return /많|흐림|잔뜩/.test(cloudText);
}

// 습도/강수/구름 입력 여부에 따라 생활 팁을 조합 (아무것도 없으면 기본 팁)
function pickTip(humidity, rain, cloud) {
  const tips = [];

  if (humidity !== null) {
    if (humidity >= 60) tips.push(pickFromPool(TIP_HUMIDITY_HIGH, "tipHumidityHigh"));
    else tips.push(pickFromPool(TIP_HUMIDITY_LOW, "tipHumidityLow"));
  }

  if (rain !== null && rain > 0) {
    tips.push(pickFromPool(TIP_RAIN, "tipRain"));
  } else if (cloud !== null && !isCloudMany(cloud)) {
    tips.push(pickFromPool(TIP_SUNNY, "tipSunny"));
  }

  if (tips.length === 0) {
    tips.push(pickFromPool(TIP_GENERIC, "tipGeneric"));
  }

  return tips.join(" ");
}

// 습도 우선, 없으면 구름양 기준, 둘 다 없으면 무작위로 음식 추천
function pickFood(humidity, cloud) {
  if (humidity !== null) {
    return humidity >= 60
      ? pickFromPool(FOOD_COOL, "foodCool")
      : pickFromPool(FOOD_WARM, "foodWarm");
  }
  if (cloud !== null) {
    return isCloudMany(cloud)
      ? pickFromPool(FOOD_WARM, "foodWarm")
      : pickFromPool(FOOD_COOL, "foodCool");
  }
  return Math.random() < 0.5
    ? pickFromPool(FOOD_WARM, "foodWarm")
    : pickFromPool(FOOD_COOL, "foodCool");
}

function buildScript(data) {
  const { region, wind, humidity, cloud, rain } = data;

  const parts = [];

  parts.push(fillTemplate(OPENING_LINE, { 지역: region }));

  if (humidity !== null) {
    parts.push(fillTemplate(pickFromPool(HUMIDITY_LINES, "humidity"), { 습도: humidity }));
  }
  if (wind) {
    parts.push(fillTemplate(pickFromPool(WIND_LINES, "wind"), { 풍향: wind }));
  }
  if (cloud) {
    parts.push(fillTemplate(pickFromPool(CLOUD_LINES, "cloud"), {
      구름양: cloud,
      로으로: josaRoEuro(cloud)
    }));
  }
  if (rain !== null) {
    parts.push(fillTemplate(pickFromPool(RAIN_LINES, "rain"), { 강수량: rain }));
  }

  // 서술 모순 오류: 구름/강수 정보가 있을 때만, 실제와 반대로 단정하는 문장을 일부러 삽입
  if (cloud !== null || rain !== null) {
    const isBadWeather = (rain !== null && rain > 0) || (cloud !== null && isCloudMany(cloud));
    const moodLine = isBadWeather
      ? pickFromPool(MOOD_GOOD_LINES, "moodGood")
      : pickFromPool(MOOD_BAD_LINES, "moodBad");
    parts.push(moodLine);
  }

  // 생활 팁과 음식 추천 중 1개만 소개
  if (Math.random() < 0.5) {
    parts.push(pickTip(humidity, rain, cloud));
  } else {
    parts.push(pickFood(humidity, cloud));
  }

  parts.push(pickFromPool(CLOSING_LINES, "closing"));

  return parts.join(" ");
}

function typeText(el, text, onDone) {
  el.textContent = "";
  let i = 0;
  function step() {
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      i += 2;
      setTimeout(step, 20);
    } else if (onDone) {
      onDone();
    }
  }
  step();
}

function findChatTopic(text) {
  for (const topic of CHAT_TOPICS) {
    for (const kw of topic.keywords) {
      if (text.includes(kw)) return topic;
    }
  }
  return null;
}

function matchChatKeyword(text) {
  const q = text.trim();
  if (!q) return null;

  const topic = findChatTopic(q);
  if (!topic) return null;

  if (topic.high && CHAT_HIGH_WORDS.some(w => q.includes(w))) return topic.high;
  if (topic.low && CHAT_LOW_WORDS.some(w => q.includes(w))) return topic.low;
  return topic.general;
}

function answerForQuickButton(btnDef) {
  const topic = CHAT_TOPICS.find(t => t.id === btnDef.topicId);
  if (!topic) return DEFAULT_CHAT_ANSWER;
  if (btnDef.variant === "high") return topic.high || topic.general;
  if (btnDef.variant === "low") return topic.low || topic.general;
  return topic.general;
}

document.addEventListener("DOMContentLoaded", function () {
  const plusBtn = document.getElementById("plusBtn");
  const formPanel = document.getElementById("formPanel");
  const genBtn = document.getElementById("genBtn");
  const formError = document.getElementById("formError");

  const regionInput = document.getElementById("region");
  const windInput = document.getElementById("wind");
  const humidityInput = document.getElementById("humidity");
  const cloudInput = document.getElementById("cloud");
  const rainInput = document.getElementById("rain");

  const resultArea = document.getElementById("resultArea");
  const loadingBox = document.getElementById("loadingBox");
  const resultBox = document.getElementById("resultBox");

  plusBtn.addEventListener("click", function () {
    formPanel.hidden = !formPanel.hidden;
  });

  genBtn.addEventListener("click", function () {
    const region = regionInput.value.trim();
    const wind = windInput.value.trim();
    const humidityRaw = humidityInput.value;
    const cloud = cloudInput.value.trim();
    const rainRaw = rainInput.value;

    if (!region) {
      formError.textContent = "지역은 꼭 입력해주세요.";
      formError.hidden = false;
      return;
    }
    if (!wind && humidityRaw === "" && !cloud && rainRaw === "") {
      formError.textContent = "바람, 습도, 구름의 양, 강수량 중 최소 한 가지는 입력해주세요.";
      formError.hidden = false;
      return;
    }
    formError.hidden = true;

    const data = {
      region,
      wind: wind || null,
      humidity: humidityRaw === "" ? null : Number(humidityRaw),
      cloud: cloud || null,
      rain: rainRaw === "" ? null : Number(rainRaw)
    };

    const script = buildScript(data);

    resultArea.hidden = false;
    loadingBox.hidden = false;
    resultBox.hidden = true;

    setTimeout(function () {
      loadingBox.hidden = true;
      resultBox.hidden = false;
      typeText(resultBox, script);
    }, 900);
  });

  // 챗봇
  const fab = document.getElementById("fab");
  const chatPanel = document.getElementById("chatPanel");
  const closeChat = document.getElementById("closeChat");
  const chatQuickBtns = document.getElementById("chatQuickBtns");
  const chatAnswer = document.getElementById("chatAnswer");
  const chatInput = document.getElementById("chatInput");
  const chatAskBtn = document.getElementById("chatAskBtn");

  CHAT_QUICK_BUTTONS.forEach(function (btnDef) {
    const btn = document.createElement("button");
    btn.textContent = btnDef.label;
    btn.addEventListener("click", function () {
      chatAnswer.textContent = answerForQuickButton(btnDef);
    });
    chatQuickBtns.appendChild(btn);
  });

  fab.addEventListener("click", function () {
    chatPanel.hidden = !chatPanel.hidden;
  });
  closeChat.addEventListener("click", function () {
    chatPanel.hidden = true;
  });

  function askChat() {
    const q = chatInput.value;
    const answer = matchChatKeyword(q);
    chatAnswer.textContent = answer || DEFAULT_CHAT_ANSWER;
    chatInput.value = "";
  }

  chatAskBtn.addEventListener("click", askChat);
  chatInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") askChat();
  });
});
