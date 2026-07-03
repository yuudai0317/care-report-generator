// Page1: 利用者情報の入力 & ケア内容チェックボックスフォームの描画

(function () {
  var data = loadData();

  var userNameEl = document.getElementById('userName');
  var visitDateEl = document.getElementById('visitDate');
  var startTimeEl = document.getElementById('startTime');
  var endTimeEl = document.getElementById('endTime');
  var staffNameEl = document.getElementById('staffName');
  var specialNotesEl = document.getElementById('specialNotes');
  var itemGroupsEl = document.getElementById('itemGroups');

  userNameEl.value = data.userName;
  visitDateEl.value = data.visitDate;
  startTimeEl.value = data.startTime;
  endTimeEl.value = data.endTime;
  staffNameEl.value = data.staffName;
  specialNotesEl.value = data.specialNotes;

  function fieldInput(def, field) {
    var itemValues = data.items[def.id];
    var id = 'field_' + def.id + '_' + field.key;
    var wrap = document.createElement('label');
    wrap.className = 'field';
    wrap.textContent = field.label;

    var input;
    if (field.type === 'select') {
      input = document.createElement('select');
      var blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '選択してください';
      input.appendChild(blank);
      field.options.forEach(function (opt) {
        var o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      });
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }
    input.id = id;
    input.value = itemValues[field.key] || '';
    input.addEventListener('input', function () {
      itemValues[field.key] = input.value;
    });
    input.addEventListener('change', function () {
      itemValues[field.key] = input.value;
    });

    wrap.appendChild(input);
    return wrap;
  }

  function renderItemBlock(def) {
    var itemValues = data.items[def.id];
    var block = document.createElement('div');
    block.className = 'item-block' + (itemValues.checked ? ' checked' : '');

    var header = document.createElement('label');
    header.className = 'item-header';

    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!itemValues.checked;
    checkbox.addEventListener('change', function () {
      itemValues.checked = checkbox.checked;
      block.classList.toggle('checked', checkbox.checked);
    });

    var labelText = document.createElement('span');
    labelText.textContent = def.label;

    header.appendChild(checkbox);
    header.appendChild(labelText);
    block.appendChild(header);

    if (def.fields.length > 0) {
      var details = document.createElement('div');
      details.className = 'item-details';
      def.fields.forEach(function (field) {
        details.appendChild(fieldInput(def, field));
      });
      block.appendChild(details);
    }

    return block;
  }

  CATEGORIES.forEach(function (cat) {
    var section = document.createElement('div');
    section.style.marginBottom = '18px';

    var heading = document.createElement('h3');
    heading.textContent = cat.label;
    heading.style.fontSize = '0.95rem';
    heading.style.color = '#3d4a3f';
    section.appendChild(heading);

    ITEM_DEFS.filter(function (d) { return d.category === cat.id; }).forEach(function (def) {
      section.appendChild(renderItemBlock(def));
    });

    itemGroupsEl.appendChild(section);
  });

  function persist() {
    data.userName = userNameEl.value;
    data.visitDate = visitDateEl.value;
    data.startTime = startTimeEl.value;
    data.endTime = endTimeEl.value;
    data.staffName = staffNameEl.value;
    data.specialNotes = specialNotesEl.value;
    saveData(data);
  }

  document.getElementById('nextBtn').addEventListener('click', function () {
    persist();
    window.location.href = 'report.html';
  });

  document.getElementById('resetBtn').addEventListener('click', function () {
    if (!confirm('入力内容をすべてリセットします。よろしいですか？')) return;
    resetData();
    window.location.reload();
  });

  // 離脱前に自動保存
  window.addEventListener('beforeunload', persist);
  [userNameEl, visitDateEl, startTimeEl, endTimeEl, staffNameEl, specialNotesEl].forEach(function (el) {
    el.addEventListener('input', persist);
    el.addEventListener('change', persist);
  });
})();
