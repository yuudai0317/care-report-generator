// Page2: 選択されたケア内容から「ケア報告書」テキストを組み立てる

function formatDateJP(isoDate) {
  if (!isoDate) return '未入力';
  var d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return isoDate;
  var week = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日(' + week + ')';
}

function formatItemDetail(def, values) {
  var parts = [];
  def.fields.forEach(function (f) {
    var v = values[f.key];
    if (!v) return;
    if (f.key === 'memo') {
      parts.push(v);
    } else {
      parts.push(f.label + '：' + v);
    }
  });
  return parts.join('、');
}

function buildReportText(data) {
  var lines = [];
  lines.push('【訪問介護 ケア報告書】');
  lines.push('利用者名：' + (data.userName || '未入力') + ' 様');

  var dateLabel = formatDateJP(data.visitDate);
  var timeLabel = (data.startTime || data.endTime)
    ? (data.startTime || '--:--') + '〜' + (data.endTime || '--:--')
    : '未入力';
  lines.push('訪問日時：' + dateLabel + ' ' + timeLabel);
  lines.push('担当ヘルパー：' + (data.staffName || '未入力'));
  lines.push('');

  var anyCategory = false;
  CATEGORIES.forEach(function (cat) {
    var defs = ITEM_DEFS.filter(function (d) {
      return d.category === cat.id && data.items[d.id] && data.items[d.id].checked;
    });
    if (defs.length === 0) return;
    anyCategory = true;
    lines.push('■' + cat.label);
    defs.forEach(function (def) {
      var detail = formatItemDetail(def, data.items[def.id]);
      lines.push('・' + def.label + (detail ? '：' + detail : ''));
    });
    lines.push('');
  });

  if (!anyCategory) {
    lines.push('（実施したケア項目が選択されていません）');
    lines.push('');
  }

  lines.push('■特記事項');
  lines.push(data.specialNotes ? data.specialNotes : '特になし');

  return lines.join('\n');
}
