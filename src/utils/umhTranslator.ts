import { ProcessId, UiLang } from '../types/umh';

export const UI_LANG_OPTIONS: { id: UiLang; short: string; label: string }[] = [
  { id: 'id', short: 'ID', label: 'Indonesia' },
  { id: 'en', short: 'EN', label: 'English' },
  { id: 'jp', short: 'JP', label: '日本語' },
];

const PROCESS_NAMES_BY_ID: Record<ProcessId, Record<UiLang, string>> = {
  1: {
    id: 'Cetak Kabel (Wire Printing)',
    en: 'Wire Printing',
    jp: '電線印字',
  },
  2: {
    id: 'Potong & Crimping Otomatis (Autocutting)',
    en: 'Autocutting',
    jp: '電線自動切断及び端子自動圧着',
  },
  3: {
    id: 'Potong Semi-Otomatis (Semi-Autocutting)',
    en: 'Semi-Autocutting',
    jp: '電線自動切断',
  },
  4: {
    id: 'Potong Manual / Air Cutting',
    en: 'Manual (Air) Cutting',
    jp: '電線手動切断',
  },
  5: {
    id: 'Pasang Aksesoris Manual',
    en: 'Manual Accessory',
    jp: 'ワイヤーシール・収縮チューブ・スリーブ等の手動挿入',
  },
  6: {
    id: 'Crimping Terminal Manual / Semi-Auto',
    en: 'Manual Crimping',
    jp: '半自動端子圧着',
  },
  7: {
    id: 'Twist (Pelintir Kabel)',
    en: 'Twist',
    jp: 'ツイスト',
  },
  8: {
    id: 'Kupas Tengah (Middle Stripping)',
    en: 'Middle Stripping',
    jp: '中間皮むき',
  },
  9: {
    id: 'Pra-Sambung (Pre-Joint)',
    en: 'Pre-Joint',
    jp: 'ジョイント前加工',
  },
  10: {
    id: 'Penyambungan (Joint)',
    en: 'Joint',
    jp: 'ジョイント',
  },
  11: {
    id: 'Solder & Solder Celup',
    en: 'Solder / Dip Soldering',
    jp: 'ハンダ、ハンダどぶ漬け',
  },
  12: {
    id: 'Uji Buzzer (Kabel Shielded)',
    en: 'Buzzer (Shielded)',
    jp: 'ブザー',
  },
  13: {
    id: 'Kupas Jacket & Twist Shield',
    en: 'Open Jacket & Twist Shield',
    jp: 'シールド線皮むき',
  },
  14: {
    id: 'Pemanasan Heat Shrink (Heating)',
    en: 'Heating',
    jp: 'チューブ収縮',
  },
  15: {
    id: 'Inspeksi Tengah (Middle Inspection)',
    en: 'Middle Inspection',
    jp: '中間検査',
  },
  16: {
    id: 'Perakitan Konektor (Housing)',
    en: 'Housing',
    jp: 'ハウジング',
  },
  17: {
    id: 'Perakitan Board (Assembly)',
    en: 'Assembly',
    jp: 'アッセンブリ',
  },
  18: {
    id: 'Anyam Kabel (Braiding)',
    en: 'Braiding',
    jp: 'ウーブンブレード',
  },
  19: {
    id: 'Inspeksi Visual',
    en: 'Visual Inspection',
    jp: 'ビジュアル検査',
  },
  20: {
    id: 'Uji Kontinuitas (Checker)',
    en: 'Checker Inspection',
    jp: '導通検査',
  },
  21: {
    id: 'Finishing Akhir',
    en: 'Finishing',
    jp: '後処理',
  },
};

const STAGE_LABELS: Record<string, Record<UiLang, string>> = {
  Dandori: { id: 'Dandori (Persiapan Mesin)', en: 'Dandori (Setup)', jp: '段取り' },
  Before: { id: 'Sebelum Proses', en: 'Before', jp: '前作業' },
  'Main Cutting': { id: 'Proses Utama Potong', en: 'Main Cutting', jp: '本作業（切断）' },
  Measuring: { id: 'Pengukuran Panjang', en: 'Measuring', jp: '測長' },
  After: { id: 'Sesudah Proses', en: 'After', jp: '後作業' },
  'Wire Seal': { id: 'Wire Seal', en: 'Wire Seal', jp: 'ワイヤーシール' },
  Marker: { id: 'Marker', en: 'Marker', jp: 'マーカー' },
  'Heat Shrink': { id: 'Heat Shrink Tube', en: 'Heat Shrink', jp: '収縮チューブ' },
  Sleeve: { id: 'Sleeve', en: 'Sleeve', jp: 'スリーブ' },
  'Vinyl Tube': { id: 'Vinyl Tube', en: 'Vinyl Tube', jp: 'ビニルチューブ' },
  'Main Crimping': { id: 'Proses Utama Crimping', en: 'Main Crimping', jp: '本作業（圧着）' },
  'Main Twist': { id: 'Proses Utama Twist', en: 'Main Twist', jp: '本作業（ツイスト）' },
  'Main Pre-Joint': { id: 'Proses Utama Pra-Joint', en: 'Main Pre-Joint', jp: '本作業（ジョイント前）' },
  'Main Joint': { id: 'Proses Utama Joint', en: 'Main Joint', jp: '本作業（ジョイント）' },
  Soldering: { id: 'Soldering', en: 'Soldering', jp: 'ハンダ付け' },
  'Dip In (Celup)': { id: 'Solder Celup (Dip In)', en: 'Dip Soldering', jp: 'ハンダどぶ漬け' },
  'Main Buzzer': { id: 'Proses Utama Buzzer', en: 'Main Buzzer', jp: '本作業（ブザー）' },
  'Main Shield': { id: 'Proses Utama Shield', en: 'Main Shield', jp: '本作業（シールド）' },
  'Main Heating': { id: 'Proses Utama Pemanasan', en: 'Main Heating', jp: '本作業（加熱収縮）' },
  'Pre-Housing': { id: 'Pra-Housing', en: 'Pre-Housing', jp: 'ハウジング前作業' },
  'Main Housing': { id: 'Proses Utama Housing', en: 'Main Housing', jp: '本作業（ハウジング）' },
  'Post-Housing': { id: 'Pasca-Housing', en: 'Post-Housing', jp: 'ハウジング後作業' },
  General: { id: 'Umum', en: 'General', jp: '一般作業' },
  'Under 99 CCT': { id: 'Di Bawah 99 CCT', en: 'Under 99 CCT', jp: '99CCT以下' },
  'Over 100 CCT': { id: '100 CCT ke Atas', en: 'Over 100 CCT', jp: '100CCT以上' },
  Accessories: { id: 'Aksesoris', en: 'Accessories', jp: '副資材取付' },
  Inspection: { id: 'Inspeksi', en: 'Inspection', jp: '検査' },
  Main: { id: 'Proses Utama', en: 'Main', jp: '本作業' },
};

const SUBSTEP_EXACT: Record<string, Record<UiLang, string>> = {
  'Replace applicator & terminals': {
    id: 'Pasang / ganti applicator & terminal',
    en: 'Replace applicator & terminals',
    jp: 'アプリケーター・端子交換',
  },
  'Check a trial shot': {
    id: 'Cek hasil uji tembak (trial shot)',
    en: 'Check a trial shot',
    jp: '試し打ち確認',
  },
  'Replace seal feeder & rubber seals': {
    id: 'Pasang / ganti seal feeder & rubber seal',
    en: 'Replace seal feeder & rubber seals',
    jp: 'シールフィーダー・防水栓交換',
  },
  'Replace the wire': {
    id: 'Pasang / ganti gulungan kabel',
    en: 'Replace the wire',
    jp: '電線交換',
  },
  'Scan the barcodes': {
    id: 'Scan barcode WOS / material',
    en: 'Scan the barcodes',
    jp: 'バーコード読取',
  },
  'Scan the barcode': {
    id: 'Scan barcode WOS',
    en: 'Scan the barcode',
    jp: 'バーコード読取',
  },
  'Set the parameters': {
    id: 'Atur parameter mesin',
    en: 'Set the parameters',
    jp: '加工条件設定',
  },
  'Wire setting': {
    id: 'Pasang & setting kabel pada mesin',
    en: 'Wire setting',
    jp: '電線セット',
  },
  'Add message to WOS': {
    id: 'Tambahkan catatan / pesan ke WOS',
    en: 'Add message to WOS',
    jp: 'WOSメッセージ入力',
  },
  'Set parameters (average)': {
    id: 'Atur parameter mesin (rata-rata)',
    en: 'Set parameters (average)',
    jp: 'パラメータ設定（平均）',
  },
  'Process after semi-auto (< 2sq)': {
    id: 'Proses lanjutan setelah semi-auto (< 2sq)',
    en: 'Process after semi-auto (< 2sq)',
    jp: '半自動切断後作業（2sq未満）',
  },
  'Process after semi-auto (2sq <= size < 20sq)': {
    id: 'Proses lanjutan setelah semi-auto (2sq <= ukuran < 20sq)',
    en: 'Process after semi-auto (2sq <= size < 20sq)',
    jp: '半自動切断後作業（2sq以上20sq未満）',
  },
  'Set the wire': {
    id: 'Pasang kabel pada alat potong',
    en: 'Set the wire',
    jp: '電線セット',
  },
  'Check & set the WOS': {
    id: 'Periksa & atur lembar WOS',
    en: 'Check & set the WOS',
    jp: 'WOS確認・セット',
  },
  'Set the length': {
    id: 'Atur ukuran panjang potong',
    en: 'Set the length',
    jp: '切断長設定',
  },
  'Process after manual cutting': {
    id: 'Proses lanjutan setelah potong manual',
    en: 'Process after manual cutting',
    jp: '手動切断後作業',
  },
  'Before: Take wires & check WOS': {
    id: 'Sebelum: Ambil kabel & periksa WOS',
    en: 'Before: Take wires & check WOS',
    jp: '前作業：電線取出・WOS確認',
  },
  'Before: Set seal box (per type)': {
    id: 'Sebelum: Siapkan kotak seal (per tipe)',
    en: 'Before: Set seal box (per type)',
    jp: '前作業：シール箱準備（品種別）',
  },
  'Before: Register WOS': {
    id: 'Sebelum: Registrasi WOS',
    en: 'Before: Register WOS',
    jp: '前作業：WOS登録',
  },
  'Main: Expose tips & insert seals': {
    id: 'Utama: Buka ujung kabel & pasang seal',
    en: 'Main: Expose tips & insert seals',
    jp: '本作業：端末出し・シール挿入',
  },
  'After: Sign WOS & hang wires': {
    id: 'Sesudah: Paraf WOS & gantung kabel',
    en: 'After: Sign WOS & hang wires',
    jp: '後作業：WOS記入・電線掛け',
  },
  'Before + Main: Remove, expose & insert (per pcs)': {
    id: 'Sebelum + Utama: Lepas, buka ujung & pasang marker (per pcs)',
    en: 'Before + Main: Remove, expose & insert (per pcs)',
    jp: '前＋本作業：取外し・端末出し・マーカー挿入（本別）',
  },
  'After: Bundle, sign WOS & hang (per CCT)': {
    id: 'Sesudah: Ikat bundel, paraf WOS & gantung (per CCT)',
    en: 'After: Bundle, sign WOS & hang (per CCT)',
    jp: '後作業：結束・WOS記入・ハンガー掛け（CCT別）',
  },
  'Before: Bring wires & tube box': {
    id: 'Sebelum: Bawa kabel & kotak tube',
    en: 'Before: Bring wires & tube box',
    jp: '前作業：電線・チューブ箱準備',
  },
  'Main + After: Expose, insert (2x shield), bundle & hang': {
    id: 'Utama + Sesudah: Pasang heat shrink (2x shield), ikat & gantung',
    en: 'Main + After: Expose, insert (2x shield), bundle & hang',
    jp: '本＋後作業：チューブ挿入（シールド2倍）・結束・掛け',
  },
  'Before + Main + After: Insert & bundle sleeves': {
    id: 'Sebelum + Utama + Sesudah: Pasang & ikat sleeve',
    en: 'Before + Main + After: Insert & bundle sleeves',
    jp: '前・本・後作業：スリーブ挿入・結束',
  },
  'Before + Main + After: VOX / VOB tubes': {
    id: 'Sebelum + Utama + Sesudah: Pemasangan tube VOX / VOB',
    en: 'Before + Main + After: VOX / VOB tubes',
    jp: '前・本・後作業：VOX / VOBチューブ挿入',
  },
  'Attach the applicator': {
    id: 'Pasang applicator ke mesin press',
    en: 'Attach the applicator',
    jp: 'アプリケーター取付',
  },
  'Set the terminals': {
    id: 'Pasang gulungan terminal',
    en: 'Set the terminals',
    jp: '端子リールセット',
  },
  'Take wires, sign WOS, scan & remove cap': {
    id: 'Ambil kabel, paraf WOS, scan & lepas tutup',
    en: 'Take wires, sign WOS, scan & remove cap',
    jp: '電線取出・WOS記入・スキャン・キャップ外し',
  },
  'Crimp (measure one) & check': {
    id: 'Crimping terminal (ukur tinggi) & periksa hasil',
    en: 'Crimp (measure one) & check',
    jp: '圧着・CH測定・外観確認',
  },
  'Measure one, check, cap & hang wires': {
    id: 'Ukur sampel, periksa, pasang tutup & gantung kabel',
    en: 'Measure one, check, cap & hang wires',
    jp: '抜取測定・確認・キャップ取付・ハンガー掛け',
  },
  'Check WOS, set rotations & remove rubber band (per bundle)': {
    id: 'Periksa WOS, atur putaran & lepas karet (per bundle)',
    en: 'Check WOS, set rotations & remove rubber band (per bundle)',
    jp: 'WOS確認・回転数設定・輪ゴム外し（束別）',
  },
  'Remove rubber band each bundle (per CCT)': {
    id: 'Lepas karet ikat tiap bundle (per CCT)',
    en: 'Remove rubber band each bundle (per CCT)',
    jp: '各束の輪ゴム外し（CCT別）',
  },
  'Attach & remove wire ends on machine (per bundle)': {
    id: 'Pasang & lepas ujung kabel di mesin twist (per bundle)',
    en: 'Attach & remove wire ends on machine (per bundle)',
    jp: 'ツイスト機への電線セット・取外し（束別）',
  },
  'Pull other end of wires (per CCT)': {
    id: 'Tarik ujung kabel sisi lainnya (per CCT)',
    en: 'Pull other end of wires (per CCT)',
    jp: '反対側電線の引出し（CCT別）',
  },
  'Run machine & measure length (per meter twist)': {
    id: 'Jalankan mesin twist & ukur panjang (per meter)',
    en: 'Run machine & measure length (per meter twist)',
    jp: 'ツイスト稼働・測長（m別）',
  },
  'Bundle, attach WOS, cap & hang (1x)': {
    id: 'Ikat bundel, pasang WOS, tutup & gantung (1x)',
    en: 'Bundle, attach WOS, cap & hang (1x)',
    jp: '結束・WOS添付・キャップ・掛け（1回）',
  },
  'Remove hanger, untangle & shelf (per joint)': {
    id: 'Lepas hanger, urai kabel & taruh di rak (per joint)',
    en: 'Remove hanger, untangle & shelf (per joint)',
    jp: 'ハンガー外し・さばき・棚置き（ジョイント別）',
  },
  'Check WOS & place on half-cylinder (per CCT)': {
    id: 'Periksa WOS & letakkan di dudukan setengah silinder (per CCT)',
    en: 'Check WOS & place on half-cylinder (per CCT)',
    jp: 'WOS確認・半円治具セット（CCT別）',
  },
  'Bundle together — Long (>1000mm)': {
    id: 'Gabung & rapikan kabel — Panjang (>1000mm)',
    en: 'Bundle together — Long (>1000mm)',
    jp: '束ね作業 — 長尺（1000mm超）',
  },
  'Bundle together — Short (<=1000mm)': {
    id: 'Gabung & rapikan kabel — Pendek (<=1000mm)',
    en: 'Bundle together — Short (<=1000mm)',
    jp: '束ね作業 — 短尺（1000mm以下）',
  },
  'Attach WOS & tie wire bundle (per joint)': {
    id: 'Pasang WOS & ikat bundel kabel (per joint)',
    en: 'Attach WOS & tie wire bundle (per joint)',
    jp: 'WOS添付・電線束結束（ジョイント別）',
  },
  'Open Barrel preparation (per joint & wire)': {
    id: 'Persiapan Open Barrel (per joint & kabel)',
    en: 'Open Barrel preparation (per joint & wire)',
    jp: 'オープンバレル前準備（ジョイント・線別）',
  },
  'Close Barrel preparation (per joint & wire)': {
    id: 'Persiapan Close Barrel (per joint & kabel)',
    en: 'Close Barrel preparation (per joint & wire)',
    jp: 'クローズバレル前準備（ジョイント・線別）',
  },
  'Open Barrel: Tube, gather & joint': {
    id: 'Open Barrel: Masukkan tube, kumpulkan & sambung',
    en: 'Open Barrel: Tube, gather & joint',
    jp: 'オープンバレル：チューブ挿入・まとめ・圧着',
  },
  'Close Barrel: Tube, gather & joint': {
    id: 'Close Barrel: Masukkan tube, kumpulkan & sambung',
    en: 'Close Barrel: Tube, gather & joint',
    jp: 'クローズバレル：チューブ挿入・まとめ・圧着',
  },
  'Measure, scan WOS & bundle (Open + Close)': {
    id: 'Ukur, scan WOS & ikat bundel (Open + Close)',
    en: 'Measure, scan WOS & bundle (Open + Close)',
    jp: '測定・WOSスキャン・結束（オープン＋クローズ）',
  },
  'Before + After Soldering': {
    id: 'Persiapan Sebelum & Sesudah Soldering',
    en: 'Before + After Soldering',
    jp: 'ハンダ前後の段取り作業',
  },
  'Main Soldering process': {
    id: 'Proses utama penyolderan (Soldering)',
    en: 'Main Soldering process',
    jp: 'ハンダ付け本作業',
  },
  'Before + After Solder Celup': {
    id: 'Persiapan Sebelum & Sesudah Solder Celup',
    en: 'Before + After Dip Soldering',
    jp: 'ハンダどぶ漬け前後の段取り作業',
  },
  'Main Solder Celup (Dip In)': {
    id: 'Proses utama Solder Celup (Dip In)',
    en: 'Main Dip Soldering',
    jp: 'ハンダどぶ漬け本作業',
  },
  'Check WOS, instruments & markers': {
    id: 'Periksa WOS, alat uji & marker',
    en: 'Check WOS, instruments & markers',
    jp: 'WOS・測定器・マーカー確認',
  },
  'Check continuity (per shield core CCT)': {
    id: 'Uji kontinuitas buzzer (per inti kabel shield)',
    en: 'Check continuity (per shield core CCT)',
    jp: '導通ブザー確認（シールド芯線別）',
  },
  'Mark & put label on shielded wire': {
    id: 'Tandai & tempel label pada kabel shielded',
    en: 'Mark & put label on shielded wire',
    jp: 'シールド線マーキング・ラベル貼付',
  },
  'Input to PC, message WOS & bundle wire': {
    id: 'Input hasil ke PC, catat WOS & ikat kabel',
    en: 'Input to PC, message WOS & bundle wire',
    jp: 'PC入力・WOS記入・電線結束',
  },
  'Calling up drawings from WOS': {
    id: 'Panggil & periksa gambar kerja dari WOS',
    en: 'Calling up drawings from WOS',
    jp: 'WOS図面呼出確認',
  },
  'Trim, loosen, gather & twist braid (both ends)': {
    id: 'Potong jacket, urai, rapikan & pelintir braid (kedua ujung)',
    en: 'Trim, loosen, gather & twist braid (both ends)',
    jp: '外皮カット・編組ほぐし・まとめ・ツイスト（両端）',
  },
  'Put on a rack': {
    id: 'Letakkan kabel pada rak',
    en: 'Put on a rack',
    jp: 'ラック掛け',
  },
  'Take wires from hanger & untie band': {
    id: 'Ambil kabel dari hanger & lepas ikatan',
    en: 'Take wires from hanger & untie band',
    jp: 'ハンガーから電線取出・結束解き',
  },
  'Align tubes, shrink with heat gun & tuck': {
    id: 'Posisikan tube, panaskan dengan heat gun & rapikan',
    en: 'Align tubes, shrink with heat gun & tuck',
    jp: 'チューブ位置合せ・ヒートガン収縮・整線',
  },
  'Remove holder, sign WOS, cap & bundle': {
    id: 'Lepas dudukan, paraf WOS, pasang tutup & ikat bundel',
    en: 'Remove holder, sign WOS, cap & bundle',
    jp: 'ホルダー外し・WOS記入・キャップ・結束',
  },
  'Pattern A (non-joint) & Pattern B (joint)': {
    id: 'Pola A (non-joint) & Pola B (joint)',
    en: 'Pattern A (non-joint) & Pattern B (joint)',
    jp: 'パターンA（非ジョイント）＆パターンB（ジョイント）',
  },
  'Prepare connector (Routing ID 20)': {
    id: 'Siapkan konektor (Routing ID 20)',
    en: 'Prepare connector (Routing ID 20)',
    jp: 'コネクタ準備（工程ID 20）',
  },
  'Prepare wire (All non-ring/joint CCT)': {
    id: 'Siapkan kabel (semua CCT non-ring/joint)',
    en: 'Prepare wire (All non-ring/joint CCT)',
    jp: '電線準備（丸端子・ジョイント以外の全CCT）',
  },
  'Insert terminal into connector (per pair)': {
    id: 'Masukkan terminal ke housing konektor (per pasang)',
    en: 'Insert terminal into connector (per pair)',
    jp: 'コネクタへの端子挿入（ペア別）',
  },
  'Making, organizing & tidying wire bundles': {
    id: 'Merapikan, menyusun & mengikat bundel kabel',
    en: 'Making, organizing & tidying wire bundles',
    jp: '電線束の整線・整理',
  },
  'Wire transport': {
    id: 'Transportasi kabel ke jig board',
    en: 'Wire transport',
    jp: '電線搬送',
  },
  'Setting wires on board (per dim point)': {
    id: 'Peletakan kabel di board (per titik dimensi)',
    en: 'Setting wires on board (per dim point)',
    jp: '治具板への電線布線（寸法点別）',
  },
  'Taping the wires (per mm non-B)': {
    id: 'Taping kabel (per mm non-Bare)',
    en: 'Taping the wires (per mm non-B)',
    jp: 'テープ巻き作業（非B部のmm別）',
  },
  'Taping COT (per C)': {
    id: 'Pemasangan & taping Corrugated Tube / COT (per C)',
    en: 'Taping COT (per C)',
    jp: 'コルゲートチューブ（COT）巻き（C別）',
  },
  'Measuring wire length (per dim point)': {
    id: 'Pengukuran panjang cabang harness (per titik dimensi)',
    en: 'Measuring wire length (per dim point)',
    jp: '製品長測定（寸法点別）',
  },
  'Markers, Spot Tape, Clips, Clamps & Nameplates': {
    id: 'Pasang Marker, Spot Tape, Clip, Clamp & Nameplate',
    en: 'Markers, Spot Tape, Clips, Clamps & Nameplates',
    jp: 'マーカー・スポットテープ・クリップ・クランプ・銘板取付',
  },
  'Attaching barcodes & removing harness from board': {
    id: 'Tempel barcode & lepas harness dari board',
    en: 'Attaching barcodes & removing harness from board',
    jp: 'バーコード貼付・治具板からの製品取外し',
  },
  'Transporting the harness': {
    id: 'Memindahkan harness hasil rakitan',
    en: 'Transporting the harness',
    jp: '完成ハーネス搬送',
  },
  'Visual inspection formula (0.0001*CCT + 0.0083)*86400': {
    id: 'Rumus inspeksi visual (0.0001×CCT + 0.0083)×86400',
    en: 'Visual inspection formula (0.0001*CCT + 0.0083)*86400',
    jp: '目視検査計算式 (0.0001×CCT + 0.0083)×86400',
  },
  'Checker Linear (<200 CCT)': {
    id: 'Uji Kontinuitas Linear (<200 CCT)',
    en: 'Checker Linear (<200 CCT)',
    jp: '導通検査 線形式（200CCT未満）',
  },
  'Checker Logarithmic LN (>=200 CCT)': {
    id: 'Uji Kontinuitas Logaritmik LN (>=200 CCT)',
    en: 'Checker Logarithmic LN (>=200 CCT)',
    jp: '導通検査 対数式LN（200CCT以上）',
  },
  'Finishing formula (0.00002*CCT + 0.0025)*86400': {
    id: 'Rumus finishing akhir (0.00002×CCT + 0.0025)×86400',
    en: 'Finishing formula (0.00002*CCT + 0.0025)*86400',
    jp: '後処理計算式 (0.00002×CCT + 0.0025)×86400',
  },
};

export function translateProcessName(
  processId: ProcessId,
  fallbackName: string,
  jpName: string,
  lang: UiLang
): string {
  const entry = PROCESS_NAMES_BY_ID[processId];
  if (entry) return entry[lang];
  if (lang === 'jp' && jpName) return jpName;
  return fallbackName;
}

export function translateStage(stage: string, lang: UiLang): string {
  const exact = STAGE_LABELS[stage];
  if (exact) return exact[lang];
  return stage;
}

export function translateSubStepName(name: string, lang: UiLang): string {
  const exact = SUBSTEP_EXACT[name];
  if (exact) return exact[lang];

  // Parameterized patterns
  const mAcCut = name.match(/^Cutting & crimping \((.+)\)$/);
  if (mAcCut) {
    const cleanRange = mAcCut[1].replace(/,\s*LOT\s*[^)]+/i, '');
    if (lang === 'id') return `Potong & crimping otomatis (${cleanRange})`;
    if (lang === 'en') return `Cutting & crimping (${cleanRange})`;
    return `自動切断・圧着（${cleanRange}）`;
  }

  const mAcAfter = name.match(/^Process after auto cutting \((.+)\)$/);
  if (mAcAfter) {
    if (lang === 'id') return `Proses sesudah autocutting (${mAcAfter[1]})`;
    if (lang === 'en') return `Process after auto cutting (${mAcAfter[1]})`;
    return `自動切断後作業（${mAcAfter[1]}）`;
  }

  const mSaCut = name.match(/^Semi-auto cutting \((.+)\)$/);
  if (mSaCut) {
    const cleanRange = mSaCut[1].replace(/,\s*LOT\s*[^)]+/i, '');
    if (lang === 'id') return `Potong semi-otomatis (${cleanRange})`;
    if (lang === 'en') return `Semi-auto cutting (${cleanRange})`;
    return `半自動切断（${cleanRange}）`;
  }

  const mMeas = name.match(/^Measuring length \((.+)\)$/);
  if (mMeas) {
    if (lang === 'id') return `Ukur panjang kabel (${mMeas[1]})`;
    if (lang === 'en') return `Measuring length (${mMeas[1]})`;
    return `測長作業（${mMeas[1]}）`;
  }

  const mMcCut = name.match(/^Manual cutting \((.+)\)$/);
  if (mMcCut) {
    const cleanRange = mMcCut[1].replace(/LOT\s*/i, '');
    if (lang === 'id') return `Potong manual kabel besar/shield (${cleanRange})`;
    if (lang === 'en') return `Manual cutting (${cleanRange})`;
    return `手動切断（${cleanRange}）`;
  }

  return name;
}

export function translateBasis(basis: string, lang: UiLang): string {
  if (lang === 'id') {
    if (basis === 'sec/lot -> sec/unit(pcs)') return 'dtk/lot -> dtk/pcs';
    if (basis === 'sec/unit(pcs)') return 'dtk/pcs';
    return basis;
  }
  if (lang === 'jp') {
    if (basis === 'sec/lot -> sec/unit(pcs)') return '秒/ロット -> 秒/本';
    if (basis === 'sec/unit(pcs)') return '秒/本';
    return basis;
  }
  return basis;
}

export function translateSummaryNote(note: string, lang: UiLang): string {
  if (!note) return note;
  if (
    note.startsWith('Dikecualikan (Mode SMV') ||
    note.startsWith('Tidak ada Autocutting pada mode SMV')
  ) {
    if (lang === 'en') return 'No Autocutting in SMV mode (all other processes remain active)';
    if (lang === 'jp') return 'SMVモードでは自動切断なし（他工程は通常通り維持）';
    return note;
  }
  if (note === 'Tidak digunakan (0)') {
    if (lang === 'en') return 'Not used (0)';
    if (lang === 'jp') return '未使用 (0)';
    return note;
  }
  return note;
}
