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

function pickTip(avgTemp, rain, diff) {
  const tips = [];
  if (avgTemp < 10) tips.push(pickFromPool(TIP_COLD, "tipCold"));
  else if (avgTemp >= 24) tips.push(pickFromPool(TIP_HOT, "tipHot"));
  else tips.push(pickFromPool(TIP_MILD, "tipMild"));

  if (rain > 0) tips.push(pickFromPool(TIP_RAIN, "tipRain"));
  else if (diff >= 8) tips.push(pickFromPool(TIP_DIFF_BIG, "tipDiffBig"));

  return tips.join(" ");
}

function pickFood(avgTemp) {
  if (avgTemp < 18) return pickFromPool(FOOD_WARM, "foodWarm");
  return pickFromPool(FOOD_COOL, "foodCool");
}


function buildScript(data) {
  const { region, tempHigh, tempLow, wind, humidity, cloud, rain, rainChance } = data;
  const avgTemp = Math.round((tempHigh + tempLow) / 2);
  const diff = tempHigh - tempLow;

  const isBadWeather = rain > 0 || /많|흐림|잔뜩/.test(cloud);

  const greeting = pickFromPool(GREETINGS, "greeting");
  const regionIntro = fillTemplate(pickFromPool(REGION_INTROS, "regionIntro"), {
    지역: region,
    은는: josaEunNeun(region)
  });
  const tempLine = fillTemplate(pickFromPool(TEMP_LINES, "temp"), {
    최고기온: tempHigh,
    최저기온: tempLow
  });
  const diffLine = fillTemplate(pickFromPool(DIFF_LINES, "diff"), { 일교차: diff });
  const windLine = fillTemplate(pickFromPool(WIND_LINES, "wind"), { 풍향: wind });
  const humidityLine = fillTemplate(pickFromPool(HUMIDITY_LINES, "humidity"), { 습도: humidity });
  const cloudLine = fillTemplate(pickFromPool(CLOUD_LINES, "cloud"), {
    구름양: cloud,
    로으로: josaRoEuro(cloud)
  });
  const rainLine = fillTemplate(pickFromPool(RAIN_LINES, "rain"), { 강수량: rain });
  const rainChanceLine = fillTemplate(pickFromPool(RAIN_CHANCE_LINES, "rainChance"), {
    강수확률: rainChance
  });
  const tipLine = pickTip(avgTemp, rain, diff);
  const foodLine = pickFood(avgTemp);
  const closingLine = pickFromPool(CLOSING_LINES, "closing");

  // 서술 모순 오류 1개: 실제 날씨와 반대되는 소감을 일부러 삽입
  const moodLine = isBadWeather
    ? pickFromPool(MOOD_GOOD_LINES, "moodGood")
    : pickFromPool(MOOD_BAD_LINES, "moodBad");

  // 서술 모순 오류 1개: 강수확률과 반대되는 단정 문장을 일부러 삽입
  const rainChanceWrongLine = rainChance >= 50
    ? pickFromPool(RAIN_CHANCE_WRONG_DRY, "rainChanceWrongDry")
    : pickFromPool(RAIN_CHANCE_WRONG_WET, "rainChanceWrongWet");

  return [
    greeting,
    regionIntro,
    tempLine,
    diffLine,
    windLine,
    humidityLine,
    cloudLine,
    rainLine,
    moodLine,
    tipLine,
    foodLine,
    rainChanceLine,
    rainChanceWrongLine,
    closingLine
  ].join(" ");
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

function matchChatKeyword(text) {
  const lower = text.trim();
  if (!lower) return null;
  for (const qa of CHAT_QA) {
    for (const kw of qa.keywords) {
      if (lower.includes(kw)) return qa.answer;
    }
  }
  return null;
}

document.addEventListener("DOMContentLoaded", function () {
  const plusBtn = document.getElementById("plusBtn");
  const formPanel = document.getElementById("formPanel");
  const genBtn = document.getElementById("genBtn");
  const formError = document.getElementById("formError");

  const regionInput = document.getElementById("region");
  const tempHighInput = document.getElementById("tempHigh");
  const tempLowInput = document.getElementById("tempLow");
  const windInput = document.getElementById("wind");
  const humidityInput = document.getElementById("humidity");
  const cloudInput = document.getElementById("cloud");
  const rainInput = document.getElementById("rain");
  const rainChanceInput = document.getElementById("rainChance");

  const resultArea = document.getElementById("resultArea");
  const loadingBox = document.getElementById("loadingBox");
  const resultBox = document.getElementById("resultBox");

  plusBtn.addEventListener("click", function () {
    formPanel.hidden = !formPanel.hidden;
  });

  genBtn.addEventListener("click", function () {
    const region = regionInput.value.trim();
    const tempHigh = tempHighInput.value;
    const tempLow = tempLowInput.value;
    const wind = windInput.value.trim();
    const humidity = humidityInput.value;
    const cloud = cloudInput.value.trim();
    const rain = rainInput.value;
    const rainChance = rainChanceInput.value;

    if (!region || tempHigh === "" || tempLow === "" || !wind || humidity === "" || !cloud || rain === "" || rainChance === "") {
      formError.textContent = "모든 칸을 채워주세요.";
      formError.hidden = false;
      return;
    }
    if (Number(rainChance) < 0 || Number(rainChance) > 100) {
      formError.textContent = "강수확률은 0에서 100 사이로 입력해주세요.";
      formError.hidden = false;
      return;
    }
    if (Number(tempLow) > Number(tempHigh)) {
      formError.textContent = "최저기온이 최고기온보다 높을 수 없어요.";
      formError.hidden = false;
      return;
    }
    formError.hidden = true;

    const data = {
      region,
      tempHigh: Number(tempHigh),
      tempLow: Number(tempLow),
      wind,
      humidity: Number(humidity),
      cloud,
      rain: Number(rain),
      rainChance: Number(rainChance)
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

  CHAT_QA.forEach(function (qa) {
    const btn = document.createElement("button");
    btn.textContent = qa.question;
    btn.addEventListener("click", function () {
      chatAnswer.textContent = qa.answer;
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
