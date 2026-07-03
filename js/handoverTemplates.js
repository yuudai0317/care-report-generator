// Page3: 同じケア内容から「書き方・並び順」だけ異なる申し送り文を15種類生成する

var NO_ITEMS_TEXT = '（本日実施したケア項目のチェックがありません）';

function memoPart(v) {
  if (!v || !v.memo) return '';
  var m = String(v.memo).trim();
  if (!m) return '';
  return m.charAt(m.length - 1) === '。' ? m : m + '。';
}

function vitalsSummary(v) {
  var parts = [];
  if (v.temperature) parts.push('体温' + v.temperature + '℃');
  if (v.systolic || v.diastolic) parts.push('血圧' + (v.systolic || '-') + '/' + (v.diastolic || '-'));
  if (v.pulse) parts.push('脈拍' + v.pulse + '回/分');
  return parts.length > 0 ? parts.join('・') : '測定実施';
}

// 項目ごとの文面（tone別）。fact = 事実のみの短文 / polite = 丁寧文 / plain = 簡潔文 / clinical = 客観的文 / soft = やわらかい文
var ITEM_TEXT = {
  meal: {
    fact: function (v) { return '食事介助：' + (v.amount || '実施') + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return 'お食事の介助を行いました。摂取量は「' + (v.amount || '実施') + '」でした。' + memoPart(v); },
    plain: function (v) { return '食事介助' + (v.amount ? '（' + v.amount + '）' : '') + '。' + memoPart(v); },
    clinical: function (v) { return '食事摂取：' + (v.amount || '実施') + '。' + memoPart(v); },
    soft: function (v) { return 'お食事のお手伝いをしました。摂取量は「' + (v.amount || '実施') + '」でしたよ。' + memoPart(v); }
  },
  hydration: {
    fact: function (v) { return '水分補給：' + (v.amount || '実施') + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '水分補給を行い、摂取状況は' + (v.amount || '良好') + 'でした。' + memoPart(v); },
    plain: function (v) { return '水分補給（' + (v.amount || '実施') + '）。' + memoPart(v); },
    clinical: function (v) { return '水分摂取：' + (v.amount || '実施') + '。' + memoPart(v); },
    soft: function (v) { return 'お水分の摂取状況は「' + (v.amount || '良好') + '」でしたよ。' + memoPart(v); }
  },
  toileting: {
    fact: function (v) { return '排泄介助：' + (v.method || '実施') + (v.condition ? '／' + v.condition : '') + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '排泄介助（' + (v.method || '介助') + '）を行いました。' + (v.condition ? '排便状態は' + v.condition + 'でした。' : '') + memoPart(v); },
    plain: function (v) { return '排泄介助：' + (v.method || '実施') + (v.condition ? '（' + v.condition + '）' : '') + '。' + memoPart(v); },
    clinical: function (v) { return '排泄：' + (v.method || '実施') + '、排便状態' + (v.condition || '特記なし') + '。' + memoPart(v); },
    soft: function (v) { return 'お手洗いのお手伝いをしました（' + (v.method || '') + '）。' + (v.condition ? '排便は' + v.condition + 'でしたよ。' : '') + memoPart(v); }
  },
  bathing: {
    fact: function (v) { return '入浴介助：' + (v.method || '実施') + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return (v.method || '入浴') + 'の介助を行いました。' + memoPart(v); },
    plain: function (v) { return '入浴介助（' + (v.method || '実施') + '）。' + memoPart(v); },
    clinical: function (v) { return '入浴：' + (v.method || '実施') + '。' + memoPart(v); },
    soft: function (v) { return (v.method || '入浴') + 'で、さっぱりと心地よく過ごしていただきました。' + memoPart(v); }
  },
  wiping: {
    fact: function (v) { return '清拭：実施' + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '清拭を行いました。' + memoPart(v); },
    plain: function (v) { return '清拭実施。' + memoPart(v); },
    clinical: function (v) { return '清拭：実施。' + memoPart(v); },
    soft: function (v) { return '体を拭いてさっぱりしていただきました。' + memoPart(v); }
  },
  dressing: {
    fact: function (v) { return '更衣介助：実施' + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '更衣介助を行いました。' + memoPart(v); },
    plain: function (v) { return '更衣介助実施。' + memoPart(v); },
    clinical: function (v) { return '更衣：介助実施。' + memoPart(v); },
    soft: function (v) { return 'お着替えのお手伝いをしました。' + memoPart(v); }
  },
  transfer: {
    fact: function (v) { return '体位変換・移乗介助：実施' + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '体位変換・移動移乗の介助を行いました。' + memoPart(v); },
    plain: function (v) { return '体位変換／移乗介助実施。' + memoPart(v); },
    clinical: function (v) { return '体位変換・移乗：介助実施。' + memoPart(v); },
    soft: function (v) { return '姿勢の変更や移動のお手伝いをしました。' + memoPart(v); }
  },
  grooming: {
    fact: function (v) { return '整容：実施' + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '洗面・整容の介助を行いました。' + memoPart(v); },
    plain: function (v) { return '整容介助実施。' + memoPart(v); },
    clinical: function (v) { return '整容：介助実施。' + memoPart(v); },
    soft: function (v) { return '洗顔や身だしなみを整えるお手伝いをしました。' + memoPart(v); }
  },
  medication: {
    fact: function (v) { return '服薬介助：' + (v.status || '実施') + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '服薬介助を行いました。服薬状況は「' + (v.status || '確実に服用') + '」でした。' + memoPart(v); },
    plain: function (v) { return '服薬（' + (v.status || '実施') + '）。' + memoPart(v); },
    clinical: function (v) { return '服薬状況：' + (v.status || '確認済み') + '。' + memoPart(v); },
    soft: function (v) { return 'お薬の様子は「' + (v.status || '確実に服用') + '」でしたよ。' + memoPart(v); }
  },
  vitals: {
    fact: function (v) { return 'バイタル：' + vitalsSummary(v); },
    polite: function (v) { return 'バイタルサインを測定しました。' + vitalsSummary(v) + 'でした。' + memoPart(v); },
    plain: function (v) { return 'バイタル測定：' + vitalsSummary(v) + '。' + memoPart(v); },
    clinical: function (v) { return 'バイタル：' + vitalsSummary(v) + '。' + memoPart(v); },
    soft: function (v) { return '体温やお脈も測らせていただき、' + vitalsSummary(v) + 'でしたよ。' + memoPart(v); }
  },
  cleaning: {
    fact: function (v) { return '掃除：実施' + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '居室内の掃除を行いました。' + memoPart(v); },
    plain: function (v) { return '掃除実施。' + memoPart(v); },
    clinical: function (v) { return '生活援助（掃除）：実施。' + memoPart(v); },
    soft: function (v) { return 'お部屋のお掃除をしました。' + memoPart(v); }
  },
  laundry: {
    fact: function (v) { return '洗濯：実施' + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '洗濯を行いました。' + memoPart(v); },
    plain: function (v) { return '洗濯実施。' + memoPart(v); },
    clinical: function (v) { return '生活援助（洗濯）：実施。' + memoPart(v); },
    soft: function (v) { return 'お洗濯をしておきました。' + memoPart(v); }
  },
  cooking: {
    fact: function (v) { return '調理：実施' + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '調理を行いました。' + memoPart(v); },
    plain: function (v) { return '調理実施。' + memoPart(v); },
    clinical: function (v) { return '生活援助（調理）：実施。' + memoPart(v); },
    soft: function (v) { return 'お食事の準備をしました。' + memoPart(v); }
  },
  shopping: {
    fact: function (v) { return '買い物：実施' + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '買い物代行を行いました。' + memoPart(v); },
    plain: function (v) { return '買い物実施。' + memoPart(v); },
    clinical: function (v) { return '生活援助（買い物代行）：実施。' + memoPart(v); },
    soft: function (v) { return '必要な物のお買い物をしてきました。' + memoPart(v); }
  },
  bedmaking: {
    fact: function (v) { return 'ベッドメイキング：実施' + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return 'ベッドメイキングを行いました。' + memoPart(v); },
    plain: function (v) { return 'ベッドメイキング実施。' + memoPart(v); },
    clinical: function (v) { return '生活援助（ベッドメイキング）：実施。' + memoPart(v); },
    soft: function (v) { return 'ベッド周りを整えました。' + memoPart(v); }
  },
  garbage: {
    fact: function (v) { return 'ゴミ出し：実施' + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return 'ゴミ出しを行いました。' + memoPart(v); },
    plain: function (v) { return 'ゴミ出し実施。' + memoPart(v); },
    clinical: function (v) { return '生活援助（ゴミ出し）：実施。' + memoPart(v); },
    soft: function (v) { return 'ゴミ出しをしておきました。' + memoPart(v); }
  },
  skin: {
    fact: function (v) { return '皮膚状態：' + (v.condition || '観察済み') + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '皮膚状態を観察したところ「' + (v.condition || '良好') + '」でした。' + memoPart(v); },
    plain: function (v) { return '皮膚状態：' + (v.condition || '確認済み') + '。' + memoPart(v); },
    clinical: function (v) { return '皮膚観察：' + (v.condition || '異常なし') + '。' + memoPart(v); },
    soft: function (v) { return 'お肌の様子も見せていただき「' + (v.condition || '良好') + '」でしたよ。' + memoPart(v); }
  },
  mental: {
    fact: function (v) { return '精神状態：' + (v.condition || '観察済み') + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return 'ご様子は「' + (v.condition || '落ち着いている') + '」という状態でした。' + memoPart(v); },
    plain: function (v) { return '様子：' + (v.condition || '確認') + '。' + memoPart(v); },
    clinical: function (v) { return '精神状態：' + (v.condition || '安定') + '。' + memoPart(v); },
    soft: function (v) { return '今日のご様子は「' + (v.condition || '落ち着いている') + '」という感じでしたよ。' + memoPart(v); }
  },
  conversation: {
    fact: function (v) { return '会話の様子：確認済み' + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '会話を通じて、コミュニケーションの様子を確認しました。' + memoPart(v); },
    plain: function (v) { return '会話の様子確認。' + memoPart(v); },
    clinical: function (v) { return 'コミュニケーション状況：確認済み。' + memoPart(v); },
    soft: function (v) { return 'お話もたくさんしてくださいましたよ。' + memoPart(v); }
  },
  sleep: {
    fact: function (v) { return '睡眠状況：' + (v.condition || '確認済み') + (v.memo ? '（' + v.memo + '）' : ''); },
    polite: function (v) { return '睡眠状況は' + (v.condition || '良好') + 'とのことでした。' + memoPart(v); },
    plain: function (v) { return '睡眠：' + (v.condition || '確認') + '。' + memoPart(v); },
    clinical: function (v) { return '睡眠状況：' + (v.condition || '良好') + '。' + memoPart(v); },
    soft: function (v) { return '眠りについては「' + (v.condition || '良好') + '」とのことでしたよ。' + memoPart(v); }
  },
  emergency: {
    fact: function (v) { return '緊急時対応：' + (v.memo || 'あり'); },
    polite: function (v) { return '緊急時対応を行いました。' + (v.memo ? '内容：' + v.memo + '。' : ''); },
    plain: function (v) { return '緊急対応あり。' + (v.memo || ''); },
    clinical: function (v) { return '緊急対応：実施。' + (v.memo ? '内容：' + v.memo + '。' : ''); },
    soft: function (v) { return '急なことがあり対応させていただきました。' + (v.memo ? v.memo + '。' : ''); }
  }
};

function checkedItems(data) {
  return ITEM_DEFS.filter(function (def) {
    return data.items[def.id] && data.items[def.id].checked;
  }).map(function (def) {
    return { def: def, values: data.items[def.id] };
  });
}

function reorderByPriority(items, priorityIds) {
  var priority = [];
  var rest = [];
  items.forEach(function (it) {
    if (priorityIds.indexOf(it.def.id) !== -1) priority.push(it);
    else rest.push(it);
  });
  priority.sort(function (a, b) { return priorityIds.indexOf(a.def.id) - priorityIds.indexOf(b.def.id); });
  return priority.concat(rest);
}

function sortByCategory(items, categoryOrder) {
  var order = categoryOrder || CATEGORIES.map(function (c) { return c.id; });
  return items.slice().sort(function (a, b) {
    return order.indexOf(a.def.category) - order.indexOf(b.def.category);
  });
}

function headerLine(data) {
  var date = formatDateJP(data.visitDate);
  var time = (data.startTime || data.endTime) ? (data.startTime || '--:--') + '〜' + (data.endTime || '--:--') : '';
  return (data.userName ? data.userName + '様' : '利用者様') + '　' + date + (time ? ' ' + time : '') +
    '　訪問（担当：' + (data.staffName || '担当者未記入') + '）';
}

function bulletLines(items, textFn) {
  if (items.length === 0) return [NO_ITEMS_TEXT];
  return items.map(function (it) { return '・' + textFn(it.values, it.def); });
}

function sentenceLines(items, toneKey) {
  if (items.length === 0) return [NO_ITEMS_TEXT];
  return items.map(function (it) { return ITEM_TEXT[it.def.id][toneKey](it.values); });
}

var HANDOVER_TEMPLATES = [
  {
    id: 'chronological',
    title: '① 標準（時系列）順',
    description: '実施した順にそのまま並べる、基本の丁寧な申し送り文です。',
    generate: function (data) {
      var items = checkedItems(data);
      var lines = ['【申し送り：標準】', headerLine(data), ''];
      lines = lines.concat(sentenceLines(items, 'polite'));
      if (data.specialNotes) { lines.push(''); lines.push('【特記事項】' + data.specialNotes); }
      return lines.join('\n');
    }
  },
  {
    id: 'priority',
    title: '② 重要度優先順',
    description: '緊急対応・服薬・健康状態など重要な情報を先頭にまとめます。',
    generate: function (data) {
      var items = reorderByPriority(checkedItems(data), ['emergency', 'vitals', 'medication', 'skin', 'mental', 'toileting']);
      var lines = ['【申し送り：重要度優先】', headerLine(data)];
      if (data.specialNotes) lines.push('※特記事項：' + data.specialNotes);
      lines.push('');
      lines = lines.concat(sentenceLines(items, 'polite'));
      return lines.join('\n');
    }
  },
  {
    id: 'vitals-first',
    title: '③ バイタル最優先型',
    description: '健康チェックの結果を最初に、客観的な言い回しでまとめます。',
    generate: function (data) {
      var items = reorderByPriority(checkedItems(data), ['vitals', 'medication', 'toileting', 'skin']);
      var lines = ['【申し送り：バイタル最優先】', headerLine(data), '', '◆本日の健康状態'];
      lines = lines.concat(sentenceLines(items, 'clinical'));
      if (data.specialNotes) { lines.push(''); lines.push('◆特記事項：' + data.specialNotes); }
      return lines.join('\n');
    }
  },
  {
    id: 'concise-bullet',
    title: '④ 簡潔箇条書き型',
    description: '短い箇条書きのみで、要点だけをすばやく確認できます。',
    generate: function (data) {
      var items = checkedItems(data);
      var lines = ['【申し送り：簡潔箇条書き】', headerLine(data), ''];
      lines = lines.concat(bulletLines(items, function (v, def) { return ITEM_TEXT[def.id].fact(v); }));
      if (data.specialNotes) lines.push('・特記事項：' + data.specialNotes);
      return lines.join('\n');
    }
  },
  {
    id: 'polite-paragraph',
    title: '⑤ 丁寧文章型',
    description: 'ですます調の文章をひとつの段落にまとめた、読みやすい文体です。',
    generate: function (data) {
      var items = checkedItems(data);
      var body = items.length === 0 ? NO_ITEMS_TEXT : sentenceLines(items, 'polite').join('');
      var lines = ['【申し送り：丁寧文章】', headerLine(data), '', body];
      if (data.specialNotes) lines.push('\nなお、' + data.specialNotes);
      return lines.join('\n');
    }
  },
  {
    id: 'nursing',
    title: '⑥ 看護師向け客観記述型',
    description: '訪問看護など医療職への連携を意識し、客観的・簡潔な表現でまとめます。',
    generate: function (data) {
      var items = checkedItems(data);
      var lines = ['【訪問看護ご担当者様への申し送り】', headerLine(data), ''];
      lines = lines.concat(bulletLines(items, function (v, def) { return ITEM_TEXT[def.id].clinical(v); }));
      if (data.specialNotes) lines.push('・特記事項：' + data.specialNotes);
      return lines.join('\n');
    }
  },
  {
    id: 'family',
    title: '⑦ ご家族向けやわらか文体型',
    description: 'ご家族に向けて、あたたかく分かりやすい言葉遣いでまとめます。',
    generate: function (data) {
      var items = checkedItems(data);
      var lines = ['【ご家族の皆様へ】', headerLine(data), ''];
      lines = lines.concat(sentenceLines(items, 'soft'));
      if (data.specialNotes) { lines.push(''); lines.push('その他、' + data.specialNotes); }
      lines.push('');
      lines.push('本日も無事に訪問を終えましたのでご報告いたします。');
      return lines.join('\n');
    }
  },
  {
    id: 'numeric-first',
    title: '⑧ 数値データ先出し型',
    description: 'バイタルの数値を冒頭に整理してから、その他の内容を続けます。',
    generate: function (data) {
      var items = checkedItems(data);
      var lines = ['【申し送り：数値データ先出し】', headerLine(data), ''];
      var vitals = data.items.vitals;
      if (vitals && vitals.checked) {
        lines.push('◆測定値：' + vitalsSummary(vitals));
        lines.push('');
      }
      var rest = items.filter(function (it) { return it.def.id !== 'vitals'; });
      lines = lines.concat(bulletLines(rest, function (v, def) { return ITEM_TEXT[def.id].fact(v); }));
      if (data.specialNotes) lines.push('・特記事項：' + data.specialNotes);
      return lines.join('\n');
    }
  },
  {
    id: 'household-first',
    title: '⑨ 生活援助優先型',
    description: '掃除・洗濯・調理など生活援助の内容を先頭に記載します。',
    generate: function (data) {
      var items = sortByCategory(checkedItems(data), ['household', 'physical', 'observation', 'special']);
      var lines = ['【申し送り：生活援助優先】', headerLine(data), ''];
      lines = lines.concat(bulletLines(items, function (v, def) { return ITEM_TEXT[def.id].plain(v); }));
      if (data.specialNotes) lines.push('・特記事項：' + data.specialNotes);
      return lines.join('\n');
    }
  },
  {
    id: 'physical-first',
    title: '⑩ 身体介護優先型',
    description: '食事・排泄・入浴など身体介護の内容を先頭に記載します。',
    generate: function (data) {
      var items = sortByCategory(checkedItems(data), ['physical', 'special', 'observation', 'household']);
      var lines = ['【申し送り：身体介護優先】', headerLine(data), ''];
      lines = lines.concat(sentenceLines(items, 'polite'));
      if (data.specialNotes) { lines.push(''); lines.push('【特記事項】' + data.specialNotes); }
      return lines.join('\n');
    }
  },
  {
    id: 'special-emphasis',
    title: '⑪ 特記事項強調型',
    description: '特記・緊急事項を冒頭と末尾の両方で強調し、見落としを防ぎます。',
    generate: function (data) {
      var items = checkedItems(data);
      var lines = ['【申し送り：特記事項強調】', headerLine(data), ''];
      if (data.specialNotes) lines.push('⚠ 重要：' + data.specialNotes);
      var emergency = data.items.emergency;
      if (emergency && emergency.checked) lines.push('⚠ 緊急対応：' + (emergency.memo || 'あり'));
      lines.push('');
      lines = lines.concat(sentenceLines(items, 'polite'));
      if (data.specialNotes) { lines.push(''); lines.push('（再掲）特記事項：' + data.specialNotes); }
      return lines.join('\n');
    }
  },
  {
    id: 'next-shift',
    title: '⑫ 次回引き継ぎ重視型',
    description: '次回訪問者が確認すべき事項を中心に整理します。',
    generate: function (data) {
      var priorityIds = ['medication', 'toileting', 'skin', 'emergency', 'mental'];
      var items = checkedItems(data);
      var priorityItems = items.filter(function (it) { return priorityIds.indexOf(it.def.id) !== -1; });
      var otherItems = items.filter(function (it) { return priorityIds.indexOf(it.def.id) === -1; });
      var lines = ['【次回訪問時への申し送り】', headerLine(data), '', '◆次回確認・引き継ぎたいこと'];
      lines = lines.concat(priorityItems.length > 0
        ? bulletLines(priorityItems, function (v, def) { return ITEM_TEXT[def.id].plain(v); })
        : ['（特に引き継ぎ事項はありません）']);
      if (data.specialNotes) lines.push('・' + data.specialNotes);
      if (otherItems.length > 0) {
        lines.push('');
        lines.push('◆その他の実施内容');
        lines = lines.concat(bulletLines(otherItems, function (v, def) { return ITEM_TEXT[def.id].fact(v); }));
      }
      return lines.join('\n');
    }
  },
  {
    id: 'category-heading',
    title: '⑬ カテゴリ見出し型',
    description: '「身体介護」「生活援助」などカテゴリごとに見出しを付けて整理します。',
    generate: function (data) {
      var items = checkedItems(data);
      var lines = ['【申し送り：カテゴリ見出し】', headerLine(data), ''];
      var any = false;
      CATEGORIES.forEach(function (cat) {
        var group = items.filter(function (it) { return it.def.category === cat.id; });
        if (group.length === 0) return;
        any = true;
        lines.push('◆' + cat.label);
        lines = lines.concat(bulletLines(group, function (v, def) { return ITEM_TEXT[def.id].fact(v); }));
        lines.push('');
      });
      if (!any) lines.push(NO_ITEMS_TEXT);
      if (data.specialNotes) lines.push('◆特記事項\n・' + data.specialNotes);
      return lines.join('\n');
    }
  },
  {
    id: 'one-line-summary',
    title: '⑭ 一文要約型',
    description: '本日の内容をひとつの文章に要約します。概要だけ素早く伝えたいときに便利です。',
    generate: function (data) {
      var items = checkedItems(data);
      var lines = ['【申し送り：一文要約】', headerLine(data), ''];
      if (items.length === 0) {
        lines.push('本日は特にチェックされたケア項目はありませんでした。');
      } else {
        var phrase = items.map(function (it) { return ITEM_TEXT[it.def.id].fact(it.values); }).join('、');
        lines.push('本日は、' + phrase + '　を実施しました。');
      }
      if (data.specialNotes) lines.push('また、' + data.specialNotes);
      return lines.join('\n');
    }
  },
  {
    id: 'checklist',
    title: '⑮ チェックリスト型',
    description: '✅を使ったチェックリスト形式で、実施済み項目を一覧で確認できます。',
    generate: function (data) {
      var items = checkedItems(data);
      var lines = ['【申し送り：チェックリスト】', headerLine(data), ''];
      if (items.length === 0) {
        lines.push('⬜ 本日実施したケア項目はありません');
      } else {
        items.forEach(function (it) { lines.push('✅ ' + ITEM_TEXT[it.def.id].fact(it.values)); });
      }
      if (data.specialNotes) lines.push('📝 特記事項：' + data.specialNotes);
      return lines.join('\n');
    }
  }
];
