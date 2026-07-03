// Page2: 報告書プレビューの表示・編集・コピー

(function () {
  var data = loadData();
  var reportTextEl = document.getElementById('reportText');
  var emptyWarningEl = document.getElementById('emptyWarning');
  var toastEl = document.getElementById('toast');

  if (!hasAnyCareContent(data)) {
    emptyWarningEl.style.display = 'block';
  }

  reportTextEl.value = typeof data.reportTextOverride === 'string' && data.reportTextOverride.length > 0
    ? data.reportTextOverride
    : buildReportText(data);

  reportTextEl.addEventListener('input', function () {
    data.reportTextOverride = reportTextEl.value;
    saveData(data);
  });

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(function () { toastEl.classList.remove('show'); }, 1600);
  }

  document.getElementById('regenerateBtn').addEventListener('click', function () {
    reportTextEl.value = buildReportText(data);
    data.reportTextOverride = reportTextEl.value;
    saveData(data);
    showToast('選択内容から再生成しました');
  });

  document.getElementById('copyBtn').addEventListener('click', function () {
    navigator.clipboard.writeText(reportTextEl.value).then(function () {
      showToast('コピーしました');
    }).catch(function () {
      reportTextEl.select();
      document.execCommand('copy');
      showToast('コピーしました');
    });
  });

  document.getElementById('backBtn').addEventListener('click', function () {
    window.location.href = 'index.html';
  });

  document.getElementById('nextBtn').addEventListener('click', function () {
    saveData(data);
    window.location.href = 'handover.html';
  });
})();
