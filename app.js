/**
 * 启蒙星球
 * 学科化任务结构 + Edge/Microsoft TTS + 答题反馈
 */
'use strict';

var appData = null;
var currentModuleIndex = 0;
var currentQuestionIndex = 0;
var selectedVoice = null;
var voices = [];
var voiceEnabled = true;
var autoNextTimer = null;
var studyTimer = null;
var deferredInstallPrompt = null;

var STORAGE_KEY = 'qimeng_planet_subject_progress_v1';
var INTRO_SEEN_KEY = 'qimeng_planet_intro_seen_v1';
var progress = {
  stars: 0,
  correct: 0,
  wrong: 0,
  studyTime: 0,
  answered: {},
  exchangeLog: []
};

var moduleIconMap = {
  chinese: './assets/icon-chinese.jpg',
  pinyin: './assets/icon-pinyin.jpg',
  math: './assets/icon-math.jpg',
  logic: './assets/icon-logic.jpg',
  english: './assets/icon-english.jpg',
  reading: './assets/icon-science.jpg'
};

var el = {};

function $(id) {
  return document.getElementById(id);
}

function bindElements() {
  el.introCard = $('intro-card');
  el.introDismiss = $('intro-dismiss');
  el.moduleList = $('module-list');
  el.moduleKicker = $('module-kicker');
  el.moduleTitle = $('module-title');
  el.moduleDesc = $('module-desc');
  el.topicChips = $('topic-chips');
  el.questionCard = $('question-card');
  el.questionCount = $('question-count');
  el.visualEmoji = $('visual-emoji');
  el.visualText = $('visual-text');
  el.questionTitle = $('question-title');
  el.questionPrompt = $('question-prompt');
  el.optionList = $('option-list');
  el.feedback = $('feedback');
  el.speakModuleBtn = $('speak-module-btn');
  el.speakQuestionBtn = $('speak-question-btn');
  el.prevQuestionBtn = $('prev-question-btn');
  el.nextQuestionBtn = $('next-question-btn');
  el.voiceSelect = $('voice-select');
  el.voiceToggle = $('voice-toggle');
  el.voiceToggleIcon = $('voice-toggle-icon');
  el.voiceToggleText = $('voice-toggle-text');
  el.achievementToggle = $('achievement-toggle');
  el.taskRing = $('task-ring');
  el.ringPercent = $('ring-percent');
  el.ringStars = $('ring-stars');
  el.parentModal = $('parent-modal');
  el.parentBackdrop = $('parent-backdrop');
  el.parentClose = $('parent-close');
  el.parentView = $('parent-view');
  el.installBtn = $('install-btn');
  el.progressStars = $('progress-stars');
  el.progressCorrect = $('progress-correct');
  el.progressWrong = $('progress-wrong');
  el.progressTime = $('progress-time');
  el.parentSummary = $('parent-summary');
  el.exchangeMessage = $('exchange-message');
  el.exchangeLog = $('exchange-log');
}

function readProgress() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    var saved = JSON.parse(raw);
    progress.stars = saved.stars || 0;
    progress.correct = saved.correct || 0;
    progress.wrong = saved.wrong || 0;
    progress.studyTime = saved.studyTime || 0;
    progress.answered = saved.answered || {};
    progress.exchangeLog = Array.isArray(saved.exchangeLog) ? saved.exchangeLog : [];
  } catch (error) {
    console.warn('读取进度失败：', error);
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.warn('保存进度失败：', error);
  }
}

function updateParentStats() {
  if (el.progressStars) el.progressStars.textContent = progress.stars;
  if (el.progressCorrect) el.progressCorrect.textContent = progress.correct;
  if (el.progressWrong) el.progressWrong.textContent = progress.wrong;
  if (el.progressTime) el.progressTime.textContent = formatTime(progress.studyTime);
  updateAchievementRing();
  renderExchangeLog();
  if (el.parentSummary) {
    if (progress.correct + progress.wrong === 0) {
      el.parentSummary.textContent = '还没有答题记录，先从孩子感兴趣的板块开始。';
    } else {
      el.parentSummary.textContent = '已完成 ' + (progress.correct + progress.wrong) + ' 次答题，答对 ' + progress.correct + ' 次。';
    }
  }
}

function updateAchievementRing() {
  var total = getTotalQuestionCount();
  var finished = Object.keys(progress.answered || {}).length;
  var percent = total > 0 ? Math.min(100, Math.round((finished / total) * 100)) : 0;
  if (el.taskRing) el.taskRing.style.setProperty('--progress', Math.round(percent * 3.6) + 'deg');
  if (el.ringPercent) el.ringPercent.textContent = percent + '%';
  if (el.ringStars) el.ringStars.textContent = '⭐ ' + progress.stars + ' 颗星';
}

function getTotalQuestionCount() {
  return getModules().reduce(function(total, module) {
    return total + getQuestions(module).length;
  }, 0);
}

function renderExchangeLog() {
  if (!el.exchangeLog) return;
  el.exchangeLog.innerHTML = '';
  if (!progress.exchangeLog || progress.exchangeLog.length === 0) {
    var empty = document.createElement('li');
    empty.textContent = '暂无兑换记录';
    el.exchangeLog.appendChild(empty);
    return;
  }
  progress.exchangeLog.slice().reverse().forEach(function(item) {
    var li = document.createElement('li');
    li.textContent = item.time + ' 兑换「' + item.reward + '」，消耗 ' + item.cost + ' 颗星';
    el.exchangeLog.appendChild(li);
  });
}

function formatTime(seconds) {
  var minute = Math.floor(seconds / 60);
  var second = seconds % 60;
  return String(minute).padStart(2, '0') + ':' + String(second).padStart(2, '0');
}

function startStudyTimer() {
  if (studyTimer) return;
  studyTimer = window.setInterval(function() {
    progress.studyTime += 1;
    updateParentStats();
    if (progress.studyTime % 10 === 0) saveProgress();
  }, 1000);
}

function initSpeech() {
  if (!('speechSynthesis' in window)) {
    voiceEnabled = false;
    if (el.voiceToggle) el.voiceToggle.disabled = true;
    if (el.voiceSelect) el.voiceSelect.disabled = true;
    return;
  }
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = window.speechSynthesis.getVoices()
    .filter(function(voice) {
      var lang = String(voice.lang || '').toLowerCase();
      return lang.indexOf('zh') === 0 || lang.indexOf('en') === 0;
    })
    .sort(function(a, b) {
      return voiceScore(b) - voiceScore(a);
    });
  renderVoiceSelect();
}

function voiceScore(voice) {
  var name = String(voice.name || '');
  var score = 0;
  if (/Microsoft/i.test(name)) score += 4;
  if (/Neural|Xiaoxiao|Yunxi|Jenny|Huihui|Yaoyao|Kangkang/i.test(name)) score += 3;
  if (String(voice.lang || '').toLowerCase().indexOf('zh') === 0) score += 1;
  return score;
}

function renderVoiceSelect() {
  if (!el.voiceSelect) return;
  el.voiceSelect.innerHTML = '';
  if (!voices.length) {
    var empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '系统语音';
    el.voiceSelect.appendChild(empty);
    return;
  }
  voices.forEach(function(voice, index) {
    var option = document.createElement('option');
    option.value = String(index);
    option.textContent = cleanVoiceName(voice.name);
    el.voiceSelect.appendChild(option);
  });
  selectedVoice = voices[0];
  el.voiceSelect.value = '0';
}

function cleanVoiceName(name) {
  return String(name || '语音')
    .replace('Microsoft ', '')
    .replace(' - Chinese (Simplified, PRC)', '')
    .replace(' - English (United States)', '');
}

function pickVoice(lang) {
  if (!voices.length) return null;
  var prefix = String(lang || 'zh-CN').toLowerCase().indexOf('en') === 0 ? 'en' : 'zh';
  if (selectedVoice && String(selectedVoice.lang || '').toLowerCase().indexOf(prefix) === 0) {
    return selectedVoice;
  }
  return voices.find(function(voice) {
    return String(voice.lang || '').toLowerCase().indexOf(prefix) === 0 && /Microsoft|Neural|Jenny|Xiaoxiao/i.test(String(voice.name || ''));
  }) || voices.find(function(voice) {
    return String(voice.lang || '').toLowerCase().indexOf(prefix) === 0;
  }) || voices[0];
}

function speak(text, lang) {
  if (!voiceEnabled || !text || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  var utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang || 'zh-CN';
  utterance.rate = appData && appData.ttsConfig ? appData.ttsConfig.rate || 0.9 : 0.9;
  utterance.pitch = appData && appData.ttsConfig ? appData.ttsConfig.pitch || 1 : 1;
  var voice = pickVoice(utterance.lang);
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function getModules() {
  return appData && Array.isArray(appData.modules) ? appData.modules : [];
}

function getCurrentModule() {
  var modules = getModules();
  return modules[currentModuleIndex] || modules[0] || null;
}

function getQuestions(module) {
  return module && Array.isArray(module.questions) ? module.questions : [];
}

function getCurrentQuestion() {
  var module = getCurrentModule();
  var questions = getQuestions(module);
  return questions[currentQuestionIndex] || questions[0] || null;
}

function iconFor(module) {
  if (!module) return './assets/icon.svg';
  if (moduleIconMap[module.id]) return moduleIconMap[module.id];
  return module.icon ? './assets/' + module.icon : './assets/icon.svg';
}

function renderModules() {
  if (!el.moduleList) return;
  el.moduleList.innerHTML = '';
  getModules().forEach(function(module, index) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'module-btn' + (index === currentModuleIndex ? ' active' : '');
    button.setAttribute('aria-label', module.name);

    var img = document.createElement('img');
    img.src = iconFor(module);
    img.alt = module.name;

    var text = document.createElement('div');
    var title = document.createElement('strong');
    title.textContent = module.name;
    var sub = document.createElement('span');
    sub.textContent = (module.topics || []).slice(0, 2).join(' · ');
    text.appendChild(title);
    text.appendChild(sub);

    button.appendChild(img);
    button.appendChild(text);
    button.addEventListener('click', function() {
      clearAutoNext();
      currentModuleIndex = index;
      currentQuestionIndex = 0;
      renderApp();
      speak(module.name + '。' + module.description, 'zh-CN');
    });
    el.moduleList.appendChild(button);
  });
}

function renderModuleSummary() {
  var module = getCurrentModule();
  if (!module) return;
  if (el.moduleKicker) el.moduleKicker.textContent = module.name;
  if (el.moduleTitle) el.moduleTitle.textContent = module.name;
  if (el.moduleDesc) el.moduleDesc.textContent = module.description || '';
  if (!el.topicChips) return;
  el.topicChips.innerHTML = '';
  (module.topics || []).forEach(function(topic) {
    var chip = document.createElement('span');
    chip.className = 'topic-chip';
    chip.textContent = topic;
    el.topicChips.appendChild(chip);
  });
}

function renderQuestion() {
  var module = getCurrentModule();
  var questions = getQuestions(module);
  var question = getCurrentQuestion();
  if (!question) return;

  if (el.questionCard) {
    el.questionCard.classList.remove('correct', 'wrong');
  }
  if (el.questionCount) {
    el.questionCount.textContent = (currentQuestionIndex + 1) + ' / ' + questions.length;
  }
  if (el.visualEmoji) el.visualEmoji.textContent = question.visualEmoji || '🌟';
  if (el.visualText) el.visualText.textContent = question.visualText || question.topic || '';
  if (el.questionTitle) el.questionTitle.textContent = question.title || '';
  if (el.questionPrompt) el.questionPrompt.textContent = question.prompt || '';
  if (el.feedback) {
    el.feedback.textContent = '';
    el.feedback.className = 'feedback';
  }

  renderOptions(question);
}

function renderOptions(question) {
  if (!el.optionList) return;
  el.optionList.innerHTML = '';
  (question.options || []).forEach(function(option) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'option-btn';
    button.textContent = option;
    button.addEventListener('click', function() {
      chooseAnswer(button, option, question);
    });
    el.optionList.appendChild(button);
  });
}

function chooseAnswer(button, option, question) {
  clearAutoNext();
  var isCorrect = option === question.answer;
  var buttons = Array.prototype.slice.call(el.optionList.querySelectorAll('.option-btn'));
  buttons.forEach(function(btn) {
    btn.disabled = isCorrect;
    btn.classList.remove('correct', 'wrong');
    if (btn.textContent === question.answer && isCorrect) btn.classList.add('correct');
  });

  if (isCorrect) {
    button.classList.add('correct');
    showFeedback(true, question.success || '答对了！3秒后进入下一题。');
    markCorrect();
    speak((question.success || '答对了。') + ' 三秒后进入下一题。', question.lang || 'zh-CN');
    autoNextTimer = window.setTimeout(function() {
      nextQuestion();
    }, 3000);
  } else {
    button.classList.add('wrong');
    showFeedback(false, question.hint || '再观察一下，重新选择。');
    progress.wrong += 1;
    saveProgress();
    updateParentStats();
    speak(question.hint || '答错了，请再试一次。', question.lang || 'zh-CN');
  }
}

function showFeedback(correct, text) {
  if (el.questionCard) {
    el.questionCard.classList.remove('correct', 'wrong');
    el.questionCard.classList.add(correct ? 'correct' : 'wrong');
  }
  if (el.feedback) {
    el.feedback.textContent = text;
    el.feedback.className = 'feedback ' + (correct ? 'correct' : 'wrong');
  }
}

function answerKey() {
  var module = getCurrentModule();
  return (module ? module.id : 'module') + '_' + currentQuestionIndex;
}

function markCorrect() {
  var key = answerKey();
  if (!progress.answered[key]) {
    progress.answered[key] = true;
  }
  progress.correct += 1;
  progress.stars += 1;
  saveProgress();
  updateParentStats();
}

function clearAutoNext() {
  if (autoNextTimer) {
    window.clearTimeout(autoNextTimer);
    autoNextTimer = null;
  }
}

function nextQuestion() {
  clearAutoNext();
  var module = getCurrentModule();
  var questions = getQuestions(module);
  if (!questions.length) return;
  currentQuestionIndex = (currentQuestionIndex + 1) % questions.length;
  renderQuestion();
}

function prevQuestion() {
  clearAutoNext();
  var module = getCurrentModule();
  var questions = getQuestions(module);
  if (!questions.length) return;
  currentQuestionIndex = (currentQuestionIndex - 1 + questions.length) % questions.length;
  renderQuestion();
}

function renderApp() {
  renderModules();
  renderModuleSummary();
  renderQuestion();
  updateParentStats();
}

async function loadContent() {
  try {
    var response = await fetch('./data/content.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    appData = await response.json();
    renderApp();
  } catch (error) {
    console.error('内容加载失败：', error);
    if (el.feedback) {
      el.feedback.textContent = '内容加载失败，请检查 data/content.json。';
      el.feedback.className = 'feedback wrong';
    }
  }
}

function bindEvents() {
  initIntroCard();

  if (el.voiceSelect) {
    el.voiceSelect.addEventListener('change', function() {
      var index = Number(el.voiceSelect.value);
      if (!Number.isNaN(index) && voices[index]) selectedVoice = voices[index];
    });
  }

  if (el.voiceToggle) {
    el.voiceToggle.addEventListener('click', function() {
      voiceEnabled = !voiceEnabled;
      if (!voiceEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      el.voiceToggle.classList.toggle('active', voiceEnabled);
      if (el.voiceToggleIcon) el.voiceToggleIcon.textContent = voiceEnabled ? '🔊' : '🔇';
      if (el.voiceToggleText) el.voiceToggleText.textContent = voiceEnabled ? '语音开' : '语音关';
    });
  }

  if (el.speakModuleBtn) {
    el.speakModuleBtn.addEventListener('click', function() {
      var module = getCurrentModule();
      if (module) speak(module.name + '。' + module.description, 'zh-CN');
    });
  }

  if (el.speakQuestionBtn) {
    el.speakQuestionBtn.addEventListener('click', function() {
      var question = getCurrentQuestion();
      if (!question) return;
      el.speakQuestionBtn.classList.add('speaking');
      speak(question.tts || question.prompt, question.lang || 'zh-CN');
      window.setTimeout(function() {
        el.speakQuestionBtn.classList.remove('speaking');
      }, 1200);
    });
  }

  if (el.prevQuestionBtn) el.prevQuestionBtn.addEventListener('click', prevQuestion);
  if (el.nextQuestionBtn) el.nextQuestionBtn.addEventListener('click', nextQuestion);

  if (el.achievementToggle) el.achievementToggle.addEventListener('click', openParentModal);
  if (el.parentClose) el.parentClose.addEventListener('click', closeParentModal);
  if (el.parentBackdrop) el.parentBackdrop.addEventListener('click', closeParentModal);

  Array.prototype.slice.call(document.querySelectorAll('.exchange-item')).forEach(function(button) {
    button.addEventListener('click', function() {
      redeemReward(button);
    });
  });
}

function initIntroCard() {
  var hasSeen = localStorage.getItem(INTRO_SEEN_KEY) === '1';
  if (hasSeen && el.introCard) {
    el.introCard.classList.add('dismissed');
  }
  if (el.introDismiss) {
    el.introDismiss.addEventListener('click', function() {
      localStorage.setItem(INTRO_SEEN_KEY, '1');
      if (el.introCard) el.introCard.classList.add('dismissed');
    });
  }
}

function openParentModal() {
  updateParentStats();
  if (el.parentModal) el.parentModal.hidden = false;
}

function closeParentModal() {
  if (el.parentModal) el.parentModal.hidden = true;
}

function redeemReward(button) {
  var cost = Number(button.getAttribute('data-cost') || 0);
  var reward = button.getAttribute('data-reward') || '星星奖励';
  if (progress.stars < cost) {
    if (el.exchangeMessage) {
      el.exchangeMessage.textContent = '星星还不够，继续学习再来兑换吧。';
      el.exchangeMessage.className = 'exchange-message warn';
    }
    speak('星星还不够，继续学习再来兑换吧。', 'zh-CN');
    return;
  }

  progress.stars -= cost;
  progress.exchangeLog.push({
    reward: reward,
    cost: cost,
    time: formatDateTime(new Date())
  });
  saveProgress();
  updateParentStats();
  if (el.exchangeMessage) {
    el.exchangeMessage.textContent = '兑换成功：' + reward + '。';
    el.exchangeMessage.className = 'exchange-message success';
  }
  speak('兑换成功，' + reward + '。', 'zh-CN');
}

function formatDateTime(date) {
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var day = String(date.getDate()).padStart(2, '0');
  var hour = String(date.getHours()).padStart(2, '0');
  var minute = String(date.getMinutes()).padStart(2, '0');
  return month + '-' + day + ' ' + hour + ':' + minute;
}

function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function(error) {
      console.warn('Service Worker 注册失败：', error);
    });
  }

  window.addEventListener('beforeinstallprompt', function(event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (el.installBtn) el.installBtn.hidden = false;
  });

  if (el.installBtn) {
    el.installBtn.addEventListener('click', function() {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.finally(function() {
        deferredInstallPrompt = null;
        el.installBtn.hidden = true;
      });
    });
  }
}

function init() {
  bindElements();
  readProgress();
  updateParentStats();
  bindEvents();
  initSpeech();
  initPWA();
  startStudyTimer();
  loadContent();
}

document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    saveProgress();
    if (studyTimer) {
      window.clearInterval(studyTimer);
      studyTimer = null;
    }
  } else {
    startStudyTimer();
  }
});

window.addEventListener('beforeunload', function() {
  clearAutoNext();
  saveProgress();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
