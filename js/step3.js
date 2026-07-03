// Page3: 15種類の申し送り文を描画し、個別コピーできるようにする

(function () {
  var data = loadData();
  var listEl = document.getElementById('handoverList');
  var emptyWarningEl = document.getElementById('emptyWarning');
  var toastEl = document.getElementById('toast');

  if (!hasAnyCareContent(data)) {
    emptyWarningEl.style.display = 'block';
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(function () { toastEl.classList.remove('show'); }, 1600);
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).then(function () {
      showToast('コピーしました');
    }).catch(function () {
      var temp = document.createElement('textarea');
      temp.value = text;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
      showToast('コピーしました');
    });
  }

  HANDOVER_TEMPLATES.forEach(function (template) {
    var text = template.generate(data);

    var card = document.createElement('div');
    card.className = 'handover-card';

    var heading = document.createElement('h3');
    var titleSpan = document.createElement('span');
    titleSpan.textContent = template.title;
    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'secondary small';
    copyBtn.textContent = 'コピー';
    copyBtn.addEventListener('click', function () { copyText(text); });
    heading.appendChild(titleSpan);
    heading.appendChild(copyBtn);

    var desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = template.description;

    var pre = document.createElement('pre');
    pre.textContent = text;

    card.appendChild(heading);
    card.appendChild(desc);
    card.appendChild(pre);
    listEl.appendChild(card);
  });

  document.getElementById('backBtn').addEventListener('click', function () {
    window.location.href = 'report.html';
  });

  document.getElementById('startOverBtn').addEventListener('click', function () {
    if (!confirm('入力内容をすべてリセットして最初からやり直します。よろしいですか？')) return;
    resetData();
    window.location.href = 'index.html';
  });
})();
