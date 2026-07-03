// ケア項目の定義（カテゴリ・ラベル・詳細入力欄）
// 3ページ全体で共有するマスターデータ

var CATEGORIES = [
  { id: 'physical', label: '身体介護' },
  { id: 'household', label: '生活援助' },
  { id: 'observation', label: '状態観察・様子' },
  { id: 'special', label: '緊急対応' }
];

var ITEM_DEFS = [
  { id: 'meal', category: 'physical', label: '食事介助', fields: [
    { key: 'amount', label: '摂取量', type: 'select', options: ['全量', '8割程度', '半分程度', '少量', 'ほとんど摂取なし'] },
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'hydration', category: 'physical', label: '水分補給', fields: [
    { key: 'amount', label: '摂取状況', type: 'select', options: ['良好', 'やや少なめ', '不良'] },
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'toileting', category: 'physical', label: '排泄介助', fields: [
    { key: 'method', label: '方法', type: 'select', options: ['トイレ誘導', 'ポータブルトイレ', 'おむつ交換'] },
    { key: 'condition', label: '排便状態', type: 'select', options: ['普通便', '軟便', '下痢', '便秘気味', '特になし'] },
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'bathing', category: 'physical', label: '入浴介助', fields: [
    { key: 'method', label: '方法', type: 'select', options: ['全身浴', 'シャワー浴', '清拭のみ'] },
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'wiping', category: 'physical', label: '清拭', fields: [
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'dressing', category: 'physical', label: '更衣介助', fields: [
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'transfer', category: 'physical', label: '体位変換・移動移乗介助', fields: [
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'grooming', category: 'physical', label: '整容（洗面・歯磨き・整髪等）', fields: [
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'medication', category: 'physical', label: '服薬介助', fields: [
    { key: 'status', label: '服薬状況', type: 'select', options: ['確実に服用', '一部拒否あり', '全量拒否'] },
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'vitals', category: 'physical', label: 'バイタルサイン測定', fields: [
    { key: 'temperature', label: '体温(℃)', type: 'text' },
    { key: 'systolic', label: '血圧(上)', type: 'text' },
    { key: 'diastolic', label: '血圧(下)', type: 'text' },
    { key: 'pulse', label: '脈拍(回/分)', type: 'text' }
  ]},
  { id: 'cleaning', category: 'household', label: '掃除', fields: [
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'laundry', category: 'household', label: '洗濯', fields: [
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'cooking', category: 'household', label: '調理', fields: [
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'shopping', category: 'household', label: '買い物', fields: [
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'bedmaking', category: 'household', label: 'ベッドメイキング', fields: [
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'garbage', category: 'household', label: 'ゴミ出し', fields: [
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'skin', category: 'observation', label: '皮膚状態観察', fields: [
    { key: 'condition', label: '状態', type: 'select', options: ['良好', '発赤あり', '褥瘡あり', '傷あり', '乾燥あり'] },
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'mental', category: 'observation', label: '精神状態・様子', fields: [
    { key: 'condition', label: '様子', type: 'select', options: ['落ち着いている', '元気', '不安げ', '不穏', 'ふさぎがち'] },
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'conversation', category: 'observation', label: '会話・コミュニケーションの様子', fields: [
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'sleep', category: 'observation', label: '睡眠状況', fields: [
    { key: 'condition', label: '状況', type: 'select', options: ['良好', '浅い', '不眠の訴えあり'] },
    { key: 'memo', label: 'メモ', type: 'text' }
  ]},
  { id: 'emergency', category: 'special', label: '緊急時対応の有無', fields: [
    { key: 'memo', label: '対応内容', type: 'text' }
  ]}
];
