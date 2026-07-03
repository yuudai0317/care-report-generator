// 3ページ間でケア報告データを引き継ぐための localStorage ヘルパー

var STORAGE_KEY = 'careReportData';

function emptyData() {
  var items = {};
  ITEM_DEFS.forEach(function (def) {
    var item = { checked: false };
    def.fields.forEach(function (f) { item[f.key] = ''; });
    items[def.id] = item;
  });
  return {
    userName: '',
    visitDate: new Date().toISOString().slice(0, 10),
    startTime: '',
    endTime: '',
    staffName: '',
    items: items,
    specialNotes: ''
  };
}

function loadData() {
  var raw = localStorage.getItem(STORAGE_KEY);
  var base = emptyData();
  if (!raw) return base;
  try {
    var parsed = JSON.parse(raw);
    var mergedItems = {};
    Object.keys(base.items).forEach(function (id) {
      mergedItems[id] = Object.assign({}, base.items[id], (parsed.items || {})[id] || {});
    });
    return Object.assign({}, base, parsed, { items: mergedItems });
  } catch (e) {
    return base;
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function resetData() {
  localStorage.removeItem(STORAGE_KEY);
}

function hasAnyCareContent(data) {
  return ITEM_DEFS.some(function (def) {
    return data.items[def.id] && data.items[def.id].checked;
  });
}
