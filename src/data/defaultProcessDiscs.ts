import { ProcessId, ProcessLogicDisc } from '../types/umh';

export function createEmptyDiscTemplateCode(processId: ProcessId, processName: string): string {
  return `function calculate(ctx) {
  // Template Logic Disc Kosong untuk Proses #${processId}: ${processName}
  // Gunakan ctx.lot, ctx.cctMaster, ctx.ppcsList, ctx.partList, ctx.assemblyCotList,
  // ctx.stdDb, dan ctx.helpers (getP, mkSub, parseWireSize, buildCircuitAllocs, dll).
  //
  // Contoh implementasi:
  // const rate = ctx.helpers.getP('parameter_id');
  // const qty = ctx.ppcsList.length;
  // const subSteps = [
  //   ctx.helpers.mkSub('Main', '${processName} main process', 'sec/unit(pcs)', qty, rate, qty * rate),
  // ];
  // return {
  //   active: subSteps.some((s) => s.baseSec > 0),
  //   summaryNote: 'Qty: ' + qty,
  //   subSteps,
  // };

  return {
    active: false,
    summaryNote: 'Tidak digunakan (0)',
    subSteps: [],
  };
}`;
}

const NOW_ISO = '2026-11-17T00:00:00.000Z';

export const DEFAULT_PROCESS_DISCS: ProcessLogicDisc[] = [
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 1,
    processName: 'Wire printing',
    jpName: '電線印字',
    weight: 1.0,
    version: '1.0.0',
    description: 'Template kosong untuk proses Wire printing (belum diaktifkan secara default).',
    isEmptyTemplate: true,
    code: createEmptyDiscTemplateCode(1, 'Wire printing'),
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 2,
    processName: 'Autocutting',
    jpName: '電線自動切断及び端子自動圧着',
    weight: 1.05,
    version: '1.0.0',
    description: 'Perhitungan Autocutting menggunakan Matriks 2D (LOT x Panjang Kabel), applicator, trial shot, seal feeder, dan after.',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, lotMetrics, stdDb, feederList, helpers } = ctx;
  const { getP, mkSub, buildCircuitAllocs } = helpers;
  const isAcLotActive = lotMetrics.isAutoCutActive;
  const circuitAllocs = buildCircuitAllocs();

  const acThresholds = [1, 11, 21, 31, 41, 51];
  const acRowLabels = ['1~10', '11~20', '21~30', '31~40', '41~50', '51~'];
  let acRowIdx = 0;
  acThresholds.forEach((v, idx) => {
    if (lot >= v) acRowIdx = idx;
  });
  const acRates = stdDb.acMatrix[acRowIdx] || stdDb.acMatrix[0];

  const activeAcApps = new Set();
  const activeAcFeeders = new Set();

  circuitAllocs.forEach(({ row: r, eligibleR, eligibleF, acShare }) => {
    if (acShare > 0) {
      if (eligibleR && r.termR) activeAcApps.add(r.termR.toUpperCase());
      if (eligibleF && r.termF) activeAcApps.add(r.termF.toUpperCase());
    }
    if (r.rAf && acShare > 0) {
      [r.accR1, r.accR2].forEach((a) => {
        if (a && feederList.some((f) => f.seal.toLowerCase() === a.toLowerCase())) {
          activeAcFeeders.add(a.toUpperCase());
        }
      });
    }
    if (r.fAf && acShare > 0) {
      [r.accF1, r.accF2].forEach((a) => {
        if (a && feederList.some((f) => f.seal.toLowerCase() === a.toLowerCase())) {
          activeAcFeeders.add(a.toUpperCase());
        }
      });
    }
  });

  const cApp = isAcLotActive ? activeAcApps.size : 0;
  const cFeeder = isAcLotActive ? activeAcFeeders.size : 0;
  const cWireAc = circuitAllocs.reduce((s, c) => s + c.acShare, 0);

  const subSteps = [
    mkSub('Dandori', 'Replace applicator & terminals', 'sec/lot -> sec/unit(pcs)', cApp, getP('ac_rep_app'), (cApp * getP('ac_rep_app')) / lot),
    mkSub('Dandori', 'Check a trial shot', 'sec/lot -> sec/unit(pcs)', cApp, getP('ac_trial'), (cApp * getP('ac_trial')) / lot),
    mkSub('Dandori', 'Replace seal feeder & rubber seals', 'sec/lot -> sec/unit(pcs)', cFeeder, getP('ac_rep_feeder'), (cFeeder * getP('ac_rep_feeder')) / lot),
    mkSub('Dandori', 'Replace the wire', 'sec/lot -> sec/unit(pcs)', cWireAc, getP('ac_rep_wire'), (cWireAc * getP('ac_rep_wire')) / lot),
    mkSub('Before', 'Scan the barcodes', 'sec/lot -> sec/unit(pcs)', cWireAc, getP('ac_scan'), (cWireAc * getP('ac_scan')) / lot),
    mkSub('Before', 'Set the parameters', 'sec/lot -> sec/unit(pcs)', cWireAc, getP('ac_param'), (cWireAc * getP('ac_param')) / lot),
  ];

  const lenRanges7 = [
    ['0~1000mm', (r) => r.cl > 0 && r.cl <= 1000],
    ['1001~2000mm', (r) => r.cl > 1000 && r.cl <= 2000],
    ['2001~3000mm', (r) => r.cl > 2000 && r.cl <= 3000],
    ['3001~4000mm', (r) => r.cl > 3000 && r.cl <= 4000],
    ['4001~5000mm', (r) => r.cl > 4000 && r.cl <= 5000],
    ['5001~6000mm', (r) => r.cl > 5000 && r.cl <= 6000],
    ['6001mm~', (r) => r.cl >= 6001],
  ];
  lenRanges7.forEach(([lbl, pred], i) => {
    const q = circuitAllocs.filter((c) => c.acShare > 0 && pred(c.row)).reduce((s, c) => s + c.acShare, 0);
    if (q > 0) {
      subSteps.push(
        mkSub(
          'Main Cutting',
          'Cutting & crimping (' + lbl + ', LOT ' + acRowLabels[acRowIdx] + ')',
          'sec/lot -> sec/unit(pcs)',
          q,
          acRates[i],
          (q * acRates[i]) / lot
        )
      );
    }
  });

  const acAftRanges = [
    ['<= 1.5m', getP('ac_after_15'), (r) => r.cl > 0 && r.cl <= 1500],
    ['<= 3.0m', getP('ac_after_30'), (r) => r.cl > 1500 && r.cl <= 3000],
    ['> 3.0m', getP('ac_after_45'), (r) => r.cl > 3000],
  ];
  acAftRanges.forEach(([lbl, rate, pred]) => {
    const q = circuitAllocs.filter((c) => c.acShare > 0 && pred(c.row)).reduce((s, c) => s + c.acShare, 0);
    if (q > 0) {
      subSteps.push(
        mkSub('After', 'Process after auto cutting (' + lbl + ')', 'sec/lot -> sec/unit(pcs)', q, rate, (q * rate) / lot)
      );
    }
  });

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'CCT Efektif: ' + cWireAc.toFixed(2) + ' | App: ' + cApp + ' | Feeder: ' + cFeeder + ' | LOT ' + acRowLabels[acRowIdx],
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 3,
    processName: 'Semi-autocutting',
    jpName: '電線自動切断',
    weight: 1.1,
    version: '1.0.0',
    description: 'Perhitungan Semi-autocutting menggunakan Matriks 2D, wire setting, measuring, dan after (<2sq & >=2sq).',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, stdDb, helpers } = ctx;
  const { getP, mkSub, buildCircuitAllocs } = helpers;
  const circuitAllocs = buildCircuitAllocs();

  const semiAllocs = circuitAllocs.filter((c) => {
    const r = c.row;
    const isSingle =
      r.colour !== '' &&
      (r.colour.length < 2 || r.colour[1].toUpperCase() !== 'C') &&
      c.sz < 20;
    return isSingle && c.remShare > 0;
  });
  const cSemi = semiAllocs.reduce((s, c) => s + c.remShare, 0);

  const saThresholds = [1, 6, 11, 21, 31, 41, 51];
  const saRowLabels = ['1~5', '6~10', '11~20', '21~30', '31~40', '41~50', '51~'];
  let saRowIdx = 0;
  saThresholds.forEach((v, idx) => {
    if (lot >= v) saRowIdx = idx;
  });
  const saRates = stdDb.saMatrix[saRowIdx] || stdDb.saMatrix[0];

  const subSteps = [
    mkSub('Dandori', 'Wire setting', 'sec/lot -> sec/unit(pcs)', cSemi, getP('sa_wire_set'), (cSemi * getP('sa_wire_set')) / lot),
    mkSub('Before', 'Scan the barcodes', 'sec/lot -> sec/unit(pcs)', cSemi, getP('sa_scan'), (cSemi * getP('sa_scan')) / lot),
    mkSub('Before', 'Add message to WOS', 'sec/lot -> sec/unit(pcs)', cSemi, getP('sa_msg'), (cSemi * getP('sa_msg')) / lot),
    mkSub('Before', 'Set parameters (average)', 'sec/lot -> sec/unit(pcs)', cSemi, getP('sa_param'), (cSemi * getP('sa_param')) / lot),
  ];

  const lenRanges7 = [
    ['0~1000mm', (r) => r.cl > 0 && r.cl <= 1000],
    ['1001~2000mm', (r) => r.cl > 1000 && r.cl <= 2000],
    ['2001~3000mm', (r) => r.cl > 2000 && r.cl <= 3000],
    ['3001~4000mm', (r) => r.cl > 3000 && r.cl <= 4000],
    ['4001~5000mm', (r) => r.cl > 4000 && r.cl <= 5000],
    ['5001~6000mm', (r) => r.cl > 5000 && r.cl <= 6000],
    ['6001mm~', (r) => r.cl >= 6001],
  ];
  lenRanges7.forEach(([lbl, pred], i) => {
    const q = semiAllocs.filter((c) => pred(c.row)).reduce((s, c) => s + c.remShare, 0);
    if (q > 0) {
      subSteps.push(
        mkSub(
          'Main Cutting',
          'Semi-auto cutting (' + lbl + ', LOT ' + saRowLabels[saRowIdx] + ')',
          'sec/lot -> sec/unit(pcs)',
          q,
          saRates[i],
          (q * saRates[i]) / lot
        )
      );
    }
  });

  const saMeasRanges = [
    ['<= 1.5m', getP('sa_meas_15'), (r) => r.cl > 0 && r.cl <= 1500],
    ['<= 3.0m', getP('sa_meas_30'), (r) => r.cl > 1500 && r.cl <= 3000],
    ['<= 4.5m', getP('sa_meas_45'), (r) => r.cl > 3000 && r.cl <= 4500],
    ['<= 6.0m', getP('sa_meas_60'), (r) => r.cl > 4500],
  ];
  saMeasRanges.forEach(([lbl, rate, pred]) => {
    const q = semiAllocs.filter((c) => pred(c.row)).reduce((s, c) => s + c.remShare, 0);
    if (q > 0) {
      subSteps.push(
        mkSub('Measuring', 'Measuring length (' + lbl + ')', 'sec/lot -> sec/unit(pcs)', q, rate, (q * rate) / lot)
      );
    }
  });

  const qSaLt2 = semiAllocs.filter((c) => c.sz < 2).reduce((s, c) => s + c.remShare, 0);
  const qSaGe2 = semiAllocs.filter((c) => c.sz >= 2 && c.sz < 20).reduce((s, c) => s + c.remShare, 0);
  if (qSaLt2 > 0) {
    subSteps.push(mkSub('After', 'Process after semi-auto (< 2sq)', 'sec/lot -> sec/unit(pcs)', qSaLt2, getP('sa_after_lt2'), (qSaLt2 * getP('sa_after_lt2')) / lot));
  }
  if (qSaGe2 > 0) {
    subSteps.push(mkSub('After', 'Process after semi-auto (2sq <= size < 20sq)', 'sec/lot -> sec/unit(pcs)', qSaGe2, getP('sa_after_ge2'), (qSaGe2 * getP('sa_after_ge2')) / lot));
  }

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'CCT Efektif: ' + cSemi.toFixed(2) + ' | Matrix LOT ' + saRowLabels[saRowIdx],
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 4,
    processName: 'Manual-（Air）cutting',
    jpName: '電線手動切断',
    weight: 1.2,
    version: '1.0.0',
    description: 'Perhitungan pemotongan manual untuk kabel shielded (C), blank colour, atau ukuran >=20sq.',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, ppcsList: ppcs, stdDb, helpers } = ctx;
  const { getP, mkSub, parseWireSize } = helpers;

  const manRows = ppcs.filter((r) => {
    const isC = r.colour.length >= 2 && r.colour[1].toUpperCase() === 'C';
    const isBlank = r.colour === '';
    const isBig = parseWireSize(r.sizeRaw) >= 20;
    return (isC || isBlank || isBig) && r.kind !== '';
  });
  const cMan = manRows.length;
  const mcThresholds = [1, 4, 6, 11, 21, 31, 41, 51];
  const mcRowLabels = ['1~3', '4~5', '6~10', '11~20', '21~30', '31~40', '41~50', '51~'];
  let mcRowIdx = 0;
  mcThresholds.forEach((v, idx) => {
    if (lot >= v) mcRowIdx = idx;
  });
  const mcRates = stdDb.mcMatrix[mcRowIdx] || stdDb.mcMatrix[0];

  const mcMainSec =
    (manRows.filter((r) => r.cl > 0 && r.cl <= 1000).length * mcRates[0] +
      manRows.filter((r) => r.cl > 1000 && r.cl <= 2000).length * mcRates[1] +
      manRows.filter((r) => r.cl > 2000 && r.cl <= 5000).length * mcRates[2] +
      manRows.filter((r) => r.cl > 5000).length * mcRates[3]) /
    lot;
  const mcAfterSec =
    (manRows.filter((r) => r.cl > 0 && r.cl <= 1000).length * getP('mc_aft_1000') +
      manRows.filter((r) => r.cl > 1000 && r.cl <= 2000).length * getP('mc_aft_2000') +
      manRows.filter((r) => r.cl > 2000 && r.cl <= 3000).length * getP('mc_aft_3000') +
      manRows.filter((r) => r.cl > 3000 && r.cl <= 4000).length * getP('mc_aft_4000') +
      manRows.filter((r) => r.cl > 4000 && r.cl <= 6000).length * getP('mc_aft_6000') +
      manRows.filter((r) => r.cl > 6000 && r.cl <= 8000).length * getP('mc_aft_8000') +
      manRows.filter((r) => r.cl > 8000 && r.cl <= 10000).length * getP('mc_aft_10000') +
      manRows.filter((r) => r.cl > 10000).length * getP('mc_aft_10001')) /
    lot;

  const subSteps = [
    mkSub('Dandori', 'Set the wire', 'sec/lot -> sec/unit(pcs)', cMan, getP('mc_set_wire'), (cMan * getP('mc_set_wire')) / lot),
    mkSub('Dandori', 'Check & set the WOS', 'sec/lot -> sec/unit(pcs)', cMan, getP('mc_chk_wos'), (cMan * getP('mc_chk_wos')) / lot),
    mkSub('Before', 'Scan the barcodes', 'sec/lot -> sec/unit(pcs)', cMan, getP('mc_scan'), (cMan * getP('mc_scan')) / lot),
    mkSub('Before', 'Set the length', 'sec/lot -> sec/unit(pcs)', cMan, getP('mc_set_len'), (cMan * getP('mc_set_len')) / lot),
    mkSub('Main Cutting', 'Manual cutting (LOT ' + mcRowLabels[mcRowIdx] + ')', 'sec/lot -> sec/unit(pcs)', cMan, cMan ? (mcMainSec * lot) / cMan : 0, mcMainSec),
    mkSub('After', 'Process after manual cutting', 'sec/lot -> sec/unit(pcs)', cMan, cMan ? (mcAfterSec * lot) / cMan : 0, mcAfterSec),
  ];

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'CCT (Shield/20sq~): ' + cMan + ' | Matrix LOT ' + mcRowLabels[mcRowIdx],
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 5,
    processName: 'Manual-Accesary',
    jpName: 'ワイヤーシール・収縮チューブ・スリーブ等の手動挿入',
    weight: 1.25,
    version: '1.0.0',
    description: 'Pemasangan manual Wire Seal, Marker, Heat Shrink Tube, Sleeve, dan Vinyl Tube VOX/VOB.',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, partList: pl, ppcsList: ppcs, feederList, helpers } = ctx;
  const { getP, mkSub, buildCircuitAllocs } = helpers;
  const circuitAllocs = buildCircuitAllocs();

  let autoFedSealUsed = 0;
  const manualAutoFeederSealByPn = {};
  circuitAllocs.forEach(({ row: r, acShare, remShare }) => {
    if (r.rAf) {
      autoFedSealUsed += acShare;
      [r.accR1, r.accR2].forEach((a) => {
        if (a && feederList.some((f) => f.seal.toLowerCase() === a.toLowerCase())) {
          if (remShare > 0) {
            manualAutoFeederSealByPn[a.toUpperCase()] =
              (manualAutoFeederSealByPn[a.toUpperCase()] || 0) + remShare;
          }
        }
      });
    }
    if (r.fAf) {
      autoFedSealUsed += acShare;
      [r.accF1, r.accF2].forEach((a) => {
        if (a && feederList.some((f) => f.seal.toLowerCase() === a.toLowerCase())) {
          if (remShare > 0) {
            manualAutoFeederSealByPn[a.toUpperCase()] =
              (manualAutoFeederSealByPn[a.toUpperCase()] || 0) + remShare;
          }
        }
      });
    }
  });

  const sealAllQty = pl.filter((r) => r.partName.toLowerCase() === 'seal').reduce((a, b) => a + b.qty, 0);
  const sealQty = Math.max(0, sealAllQty - autoFedSealUsed);
  const sealTypes = pl.filter((r) => {
    if (r.partName.toLowerCase() !== 'seal') return false;
    if (r.desc !== 'auto feeder') return true;
    return (manualAutoFeederSealByPn[r.partNumber.toUpperCase()] || 0) > 0.0001;
  }).length;

  const markerTotal =
    ppcs.filter((r) => r.markerR !== '').length + ppcs.filter((r) => r.markerF !== '').length;
  const markerCcts = ppcs.filter((r) => r.markerR !== '' || r.markerF !== '').length;

  const ringTerms = pl
    .filter(
      (r) =>
        r.partName.toLowerCase() === 'terminal' &&
        (['110400', '110800', '8110-', '8150-', '7009-'].some((k) => r.partNumber.includes(k)) ||
          r.partNumber.toUpperCase().startsWith('R'))
    )
    .reduce((a, b) => a + b.qty, 0);
  const shieldWires = ppcs.filter(
    (r) => r.colour.length >= 2 && r.colour[1].toUpperCase() === 'C'
  ).length;
  const hsD9 = ringTerms + shieldWires;
  const hsL10 = ringTerms + shieldWires * 2;
  const tubeTypes = pl.filter((r) => r.partName.toLowerCase().includes('tube')).length;
  const sleeveQty = pl
    .filter((r) => r.partName.toLowerCase().includes('sleeve'))
    .reduce((a, b) => a + b.qty, 0);
  const sleeveTypes = pl.filter((r) => r.partName.toLowerCase().includes('sleeve')).length;

  const isVoxVob = (str) => {
    const u = str.toUpperCase();
    return u.includes('VOX') || u.includes('VOB');
  };
  const voPl = pl.filter((r) => isVoxVob(r.partName) || isVoxVob(r.partNumber)).length;
  const voPpcs =
    ppcs.filter((r) => isVoxVob(r.tubeR)).length + ppcs.filter((r) => isVoxVob(r.tubeF)).length;
  const voQty = Math.max(voPl, voPpcs);

  const subSteps = [
    mkSub('Wire Seal', 'Before: Take wires & check WOS', 'sec/lot -> sec/unit(pcs)', sealQty, getP('ma_seal_b1'), (sealQty * getP('ma_seal_b1')) / lot),
    mkSub('Wire Seal', 'Before: Set seal box (per type)', 'sec/lot -> sec/unit(pcs)', sealTypes, getP('ma_seal_b2'), (sealTypes * getP('ma_seal_b2')) / lot),
    mkSub('Wire Seal', 'Before: Register WOS', 'sec/lot -> sec/unit(pcs)', sealQty, getP('ma_seal_b3'), (sealQty * getP('ma_seal_b3')) / lot),
    mkSub('Wire Seal', 'Main: Expose tips & insert seals', 'sec/lot -> sec/unit(pcs)', sealQty, getP('ma_seal_m1') + getP('ma_seal_m2'), (sealQty * (getP('ma_seal_m1') + getP('ma_seal_m2'))) / lot),
    mkSub('Wire Seal', 'After: Sign WOS & hang wires', 'sec/lot -> sec/unit(pcs)', sealQty, getP('ma_seal_a1') + getP('ma_seal_a2'), (sealQty * (getP('ma_seal_a1') + getP('ma_seal_a2'))) / lot),
    mkSub('Marker', 'Before + Main: Remove, expose & insert (per pcs)', 'sec/lot -> sec/unit(pcs)', markerTotal, getP('ma_mrk_b1') + getP('ma_mrk_m1') + getP('ma_mrk_m2'), (markerTotal * (getP('ma_mrk_b1') + getP('ma_mrk_m1') + getP('ma_mrk_m2'))) / lot),
    mkSub('Marker', 'After: Bundle, sign WOS & hang (per CCT)', 'sec/lot -> sec/unit(pcs)', markerCcts, getP('ma_mrk_a1') + getP('ma_mrk_a2') + getP('ma_mrk_a3'), (markerCcts * (getP('ma_mrk_a1') + getP('ma_mrk_a2') + getP('ma_mrk_a3'))) / lot),
    mkSub('Heat Shrink', 'Before: Bring wires & tube box', 'sec/lot -> sec/unit(pcs)', hsD9, getP('ma_hst_b1'), (hsD9 * getP('ma_hst_b1') + tubeTypes * getP('ma_hst_b2')) / lot),
    mkSub('Heat Shrink', 'Main + After: Expose, insert (2x shield), bundle & hang', 'sec/lot -> sec/unit(pcs)', hsL10, getP('ma_hst_m2') + getP('ma_hst_a2'), (hsD9 * (getP('ma_hst_m1') + getP('ma_hst_a1') + getP('ma_hst_a3')) + hsL10 * (getP('ma_hst_m2') + getP('ma_hst_a2'))) / lot),
    mkSub('Sleeve', 'Before + Main + After: Insert & bundle sleeves', 'sec/lot -> sec/unit(pcs)', sleeveQty, 37, (sleeveQty * (getP('ma_slv_b1') + getP('ma_slv_b3') + getP('ma_slv_m1') + getP('ma_slv_m2') + getP('ma_slv_a1') + getP('ma_slv_a2') + getP('ma_slv_a3')) + sleeveTypes * getP('ma_slv_b2')) / lot),
    mkSub('Vinyl Tube', 'Before + Main + After: VOX / VOB tubes', 'sec/lot -> sec/unit(pcs)', voQty, 44, (voQty * (getP('ma_vo_b1') + getP('ma_vo_m1') + getP('ma_vo_m2') + getP('ma_vo_a1') + getP('ma_vo_a2') + getP('ma_vo_a3'))) / lot),
  ];

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'Seal Manual: ' + sealQty.toFixed(2) + ' (' + sealTypes + ' box) | Mrk: ' + markerTotal + 'pcs | HS: ' + hsD9 + '/' + hsL10 + ' | Slv: ' + sleeveQty,
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 6,
    processName: 'Manual-Crimping',
    jpName: '半自動端子圧着',
    weight: 1.3,
    version: '1.0.0',
    description: 'Crimping terminal semi-otomatis/manual untuk ujung terminal yang tidak ter-cover autocut.',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, partList: pl, helpers } = ctx;
  const { getP, mkSub, buildCircuitAllocs, isNonCrimpTerm } = helpers;
  const circuitAllocs = buildCircuitAllocs();

  const manualAppSet = new Set();
  pl.forEach((r) => {
    if (r.partName.toLowerCase() === 'terminal' && r.desc === '' && !isNonCrimpTerm(r.partNumber)) {
      manualAppSet.add(r.partNumber.toUpperCase());
    }
  });

  let manualEndsTotal = 0;
  circuitAllocs.forEach(({ row: r, eligibleR, eligibleF, remShare }) => {
    if (!r.kind) return;
    if (!isNonCrimpTerm(r.termR)) {
      const endShareR = eligibleR ? remShare : 1.0;
      manualEndsTotal += endShareR;
      if (endShareR > 0.0001) manualAppSet.add(r.termR.toUpperCase());
    }
    if (!isNonCrimpTerm(r.termF)) {
      const endShareF = eligibleF ? remShare : 1.0;
      manualEndsTotal += endShareF;
      if (endShareF > 0.0001) manualAppSet.add(r.termF.toUpperCase());
    }
  });

  const appMc = manualAppSet.size;
  const subSteps = [
    mkSub('Dandori', 'Attach the applicator', 'sec/lot -> sec/unit(pcs)', appMc, getP('mcr_app'), (appMc * getP('mcr_app')) / lot),
    mkSub('Dandori', 'Set the terminals', 'sec/lot -> sec/unit(pcs)', appMc, getP('mcr_term'), (appMc * getP('mcr_term')) / lot),
    mkSub('Before', 'Take wires, sign WOS, scan & remove cap', 'sec/lot -> sec/unit(pcs)', manualEndsTotal, getP('mcr_b1') + getP('mcr_b2') + getP('mcr_b3') + getP('mcr_b4'), (manualEndsTotal * (getP('mcr_b1') + getP('mcr_b2') + getP('mcr_b3') + getP('mcr_b4'))) / lot),
    mkSub('Main Crimping', 'Crimp (measure one) & check', 'sec/unit(pcs)', manualEndsTotal, getP('mcr_main'), manualEndsTotal * getP('mcr_main')),
    mkSub('After', 'Measure one, check, cap & hang wires', 'sec/lot -> sec/unit(pcs)', manualEndsTotal, getP('mcr_a1') + getP('mcr_a2'), (manualEndsTotal * (getP('mcr_a1') + getP('mcr_a2'))) / lot),
  ];

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'Manual Ends: ' + manualEndsTotal.toFixed(2) + ' | App (incl. Shield): ' + appMc,
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 7,
    processName: 'Twist',
    jpName: 'ツイスト',
    weight: 1.2,
    version: '1.0.0',
    description: 'Pengelompokan bundle twist dengan Disjoint Set (Union-Find) serta perhitungan panjang twist (meter).',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, helpers } = ctx;
  const { getP, mkSub, groupTwistBundles } = helpers;
  const { bundles: twBundles, ccts: twCcts, totalLenM: twLenM } = groupTwistBundles();

  const subSteps = [
    mkSub('Before', 'Check WOS, set rotations & remove rubber band (per bundle)', 'sec/lot -> sec/unit(pcs)', twBundles, getP('tw_b1') + getP('tw_b2') + getP('tw_b3'), (twBundles * (getP('tw_b1') + getP('tw_b2') + getP('tw_b3'))) / lot),
    mkSub('Before', 'Remove rubber band each bundle (per CCT)', 'sec/lot -> sec/unit(pcs)', twCcts, getP('tw_b4'), (twCcts * getP('tw_b4')) / lot),
    mkSub('Main Twist', 'Attach & remove wire ends on machine (per bundle)', 'sec/unit(pcs)', twBundles, getP('tw_m1') + getP('tw_m4'), twBundles * (getP('tw_m1') + getP('tw_m4'))),
    mkSub('Main Twist', 'Pull other end of wires (per CCT)', 'sec/unit(pcs)', twCcts, getP('tw_m2'), twCcts * getP('tw_m2')),
    mkSub('Main Twist', 'Run machine & measure length (per meter twist)', 'sec/unit(pcs)', twLenM, getP('tw_m3') + getP('tw_m5'), twLenM * (getP('tw_m3') + getP('tw_m5'))),
    mkSub('After', 'Bundle, attach WOS, cap & hang (1x)', 'sec/lot -> sec/unit(pcs)', twBundles, getP('tw_a1'), (twBundles * getP('tw_a1')) / lot),
  ];

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'Bundles: ' + twBundles + ' (' + twCcts + ' CCT) | Len: ' + twLenM.toFixed(2) + 'm',
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 8,
    processName: 'Middle stripping',
    jpName: '中間皮むき',
    weight: 1.0,
    version: '1.0.0',
    description: 'Template kosong untuk proses Middle stripping (belum diaktifkan secara default).',
    isEmptyTemplate: true,
    code: createEmptyDiscTemplateCode(8, 'Middle stripping'),
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 9,
    processName: 'Pre-joint',
    jpName: 'ジョイント前加工',
    weight: 1.2,
    version: '1.0.0',
    description: 'Pemisahan kabel joint panjang (>1000mm) dan pendek (<=1000mm) serta persiapan sebelum joint.',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, partList: pl, ppcsList: ppcs, helpers } = ctx;
  const { getP, mkSub, JOINT_CODES } = helpers;
  const jointSet = new Set(JOINT_CODES);

  const jointSumPl = pl
    .filter((r) => jointSet.has(r.partNumber.toUpperCase()))
    .reduce((a, b) => a + b.qty, 0);
  const jointCctsAll = ppcs.filter((r) => r.jointNo !== '');
  const nLong = jointCctsAll.filter((r) => r.cl > 1000).length;
  const nShort = jointCctsAll.filter((r) => r.cl > 0 && r.cl <= 1000).length;
  const pjLongSec =
    jointCctsAll.length > 0 ? getP('pj_long_slope') * nLong + getP('pj_long_int') : 0;
  const pjShortSec =
    jointCctsAll.length > 0 ? getP('pj_short_slope') * (nShort + 1) + getP('pj_short_int') : 0;

  const subSteps = [
    mkSub('Before', 'Remove hanger, untangle & shelf (per joint)', 'sec/lot -> sec/unit(pcs)', jointSumPl, getP('pj_b1') + getP('pj_b3') + getP('pj_b4'), (jointSumPl * (getP('pj_b1') + getP('pj_b3') + getP('pj_b4'))) / lot),
    mkSub('Before', 'Check WOS & place on half-cylinder (per CCT)', 'sec/lot -> sec/unit(pcs)', jointCctsAll.length, getP('pj_b2') + getP('pj_b5'), (jointCctsAll.length * (getP('pj_b2') + getP('pj_b5'))) / lot),
    mkSub('Main Pre-Joint', 'Bundle together — Long (>1000mm)', 'sec/unit(pcs)', nLong, getP('pj_long_slope'), pjLongSec),
    mkSub('Main Pre-Joint', 'Bundle together — Short (<=1000mm)', 'sec/unit(pcs)', nShort, getP('pj_short_slope'), pjShortSec),
    mkSub('After', 'Attach WOS & tie wire bundle (per joint)', 'sec/lot -> sec/unit(pcs)', jointSumPl, getP('pj_a1') + getP('pj_a2'), (jointSumPl * (getP('pj_a1') + getP('pj_a2'))) / lot),
  ];

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'Joints: ' + jointSumPl + ' | Long (>1m): ' + nLong + ' | Short (<=1m): ' + nShort,
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 10,
    processName: 'Joint',
    jpName: 'ジョイント',
    weight: 1.35,
    version: '1.0.0',
    description: 'Perhitungan penyambungan kabel Open Barrel (553800/565200) vs Close Barrel (P/B).',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, partList: pl, ppcsList: ppcs, helpers } = ctx;
  const { getP, mkSub, JOINT_CODES } = helpers;
  const jointSet = new Set(JOINT_CODES);

  const jointSumPl = pl
    .filter((r) => jointSet.has(r.partNumber.toUpperCase()))
    .reduce((a, b) => a + b.qty, 0);
  const openJoints = pl
    .filter((r) => ['553800', '565200'].includes(r.partNumber))
    .reduce((a, b) => a + b.qty, 0);
  const closeJoints = jointSumPl - openJoints;
  const openWiresJ = ppcs.filter((r) =>
    ['553800', '565200'].some((k) => r.termR.includes(k) || r.termF.includes(k))
  ).length;
  const closeWiresJ = ppcs.filter((r) =>
    ['P', 'B'].some((k) => r.termR.toUpperCase().includes(k) || r.termF.toUpperCase().includes(k))
  ).length;

  const subSteps = [
    mkSub('Before', 'Open Barrel preparation (per joint & wire)', 'sec/lot -> sec/unit(pcs)', openJoints, 57.5, (openJoints * (getP('jt_b_take_o') + getP('jt_b_wos_o') + getP('jt_b_unb_o') + getP('jt_b_tub_o')) + openWiresJ * getP('jt_b_mat_o')) / lot),
    mkSub('Before', 'Close Barrel preparation (per joint & wire)', 'sec/lot -> sec/unit(pcs)', closeJoints, 59, (closeJoints * (getP('jt_b_take_c') + getP('jt_b_wos_c') + getP('jt_b_unb_c') + getP('jt_b_box_c') + getP('jt_b_tub_c')) + closeWiresJ * getP('jt_b_mat_c')) / lot),
    mkSub('Main Joint', 'Open Barrel: Tube, gather & joint', 'sec/unit(pcs)', openJoints, 7.3, openJoints * (getP('jt_m_ins_o') + getP('jt_m_jnt_o')) + 2 * openWiresJ * getP('jt_m_gat_o')),
    mkSub('Main Joint', 'Close Barrel: Tube, gather & joint', 'sec/unit(pcs)', closeJoints, 10, closeJoints * (getP('jt_m_ins_c') + getP('jt_m_jnt_c')) + closeWiresJ * getP('jt_m_gat_c')),
    mkSub('After', 'Measure, scan WOS & bundle (Open + Close)', 'sec/lot -> sec/unit(pcs)', jointSumPl, 231.4, (openJoints * (getP('jt_a_mea_o') + getP('jt_a_scn_o') + getP('jt_a_bnd_o')) + closeJoints * (getP('jt_a_mea_c') + getP('jt_a_scn_c') + getP('jt_a_bnd_c'))) / lot),
  ];

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'Open: ' + openJoints + ' (' + openWiresJ + 'w) | Close: ' + closeJoints + ' (' + closeWiresJ + 'w)',
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 11,
    processName: 'Solder、SolderCelup',
    jpName: 'ハンダ、ハンダどぶ漬け',
    weight: 1.25,
    version: '1.0.0',
    description: 'Perhitungan penyolderan manual (Soldering) dan celup timah (Dip In / Solder Celup).',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, ppcsList: ppcs, helpers } = ctx;
  const { getP, mkSub } = helpers;

  const dipCcts = ppcs.filter(
    (r) =>
      r.kind !== '' &&
      [r.termR, r.accR1, r.accR2, r.termF, r.accF1, r.accF2].some((x) =>
        x.toLowerCase().includes('celup')
      )
  ).length;
  const solderCcts = ppcs.filter(
    (r) =>
      r.kind !== '' &&
      [r.termR, r.accR1, r.accR2, r.termF, r.accF1, r.accF2].some(
        (x) => x.toLowerCase().includes('solder') && !x.toLowerCase().includes('celup')
      )
  ).length;

  const subSteps = [
    mkSub('Soldering', 'Before + After Soldering', 'sec/lot -> sec/unit(pcs)', solderCcts, 37.8, (solderCcts * (getP('sd_b1') + getP('sd_b2') + getP('sd_b3') + getP('sd_a1') + getP('sd_a2'))) / lot),
    mkSub('Soldering', 'Main Soldering process', 'sec/unit(pcs)', solderCcts, getP('sd_m1'), solderCcts * getP('sd_m1')),
    mkSub('Dip In (Celup)', 'Before + After Solder Celup', 'sec/lot -> sec/unit(pcs)', dipCcts, 66.5, (dipCcts * (getP('dp_b1') + getP('dp_b2') + getP('dp_a1') + getP('dp_a2') + getP('dp_a3'))) / lot),
    mkSub('Dip In (Celup)', 'Main Solder Celup (Dip In)', 'sec/unit(pcs)', dipCcts, getP('dp_m1'), dipCcts * getP('dp_m1')),
  ];

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'Soldering: ' + solderCcts + ' CCT | Dip In (Celup): ' + dipCcts + ' CCT',
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 12,
    processName: 'Buzzer(shielded)',
    jpName: 'ブザー',
    weight: 1.15,
    version: '1.0.0',
    description: 'Pengecekan kontinuitas inti kabel shielded, penandaan label, dan input PC.',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, ppcsList: ppcs, helpers } = ctx;
  const { getP, mkSub } = helpers;

  const shieldWires = ppcs.filter(
    (r) => r.colour.length >= 2 && r.colour[1].toUpperCase() === 'C'
  ).length;

  let shieldCoreCcts = 0;
  ppcs.forEach((r) => {
    const idx = r.colour.toUpperCase().indexOf('C');
    if (idx > 0) {
      const n = parseFloat(r.colour.slice(0, idx));
      if (!Number.isNaN(n)) shieldCoreCcts += n;
    }
  });

  const subSteps = [
    mkSub('Before', 'Check WOS, instruments & markers', 'sec/lot -> sec/unit(pcs)', shieldWires, 39.3, (shieldWires * (getP('bz_b1') + getP('bz_b2') + getP('bz_b3') + getP('bz_b4'))) / lot),
    mkSub('Main Buzzer', 'Check continuity (per shield core CCT)', 'sec/unit(pcs)', shieldCoreCcts, getP('bz_m1'), shieldCoreCcts * getP('bz_m1')),
    mkSub('Main Buzzer', 'Mark & put label on shielded wire', 'sec/unit(pcs)', shieldWires, getP('bz_m2') + getP('bz_m3') + getP('bz_m4'), shieldWires * (getP('bz_m2') + getP('bz_m3') + getP('bz_m4'))),
    mkSub('After', 'Input to PC, message WOS & bundle wire', 'sec/lot -> sec/unit(pcs)', shieldWires, 155, (shieldWires * (getP('bz_a1') + getP('bz_a2') + getP('bz_a3'))) / lot),
  ];

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'Shield Wires: ' + shieldWires + ' | Core CCT: ' + shieldCoreCcts,
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 13,
    processName: 'Open Jacket&Shield,Twist the shield',
    jpName: 'シールド線皮むき',
    weight: 1.25,
    version: '1.0.0',
    description: 'Pengupasan jacket & braid kabel shielded serta twist shield kedua sisi.',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, ppcsList: ppcs, helpers } = ctx;
  const { getP, mkSub } = helpers;

  const shieldWires = ppcs.filter(
    (r) => r.colour.length >= 2 && r.colour[1].toUpperCase() === 'C'
  ).length;

  const subSteps = [
    mkSub('Before', 'Calling up drawings from WOS', 'sec/lot -> sec/unit(pcs)', shieldWires, getP('oj_b1'), (shieldWires * getP('oj_b1')) / lot),
    mkSub('Main Shield', 'Trim, loosen, gather & twist braid (both ends)', 'sec/unit(pcs)', shieldWires, 29.7, shieldWires * (getP('oj_m1') * 2 + getP('oj_m2') + getP('oj_m3') * 2 + getP('oj_m4') * 2 + getP('oj_m5') * 2)),
    mkSub('After', 'Put on a rack', 'sec/lot -> sec/unit(pcs)', shieldWires, getP('oj_a1'), (shieldWires * getP('oj_a1')) / lot),
  ];

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'Shield Wires: ' + shieldWires + ' | Twist Coeff: 2.83',
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 14,
    processName: 'Heating',
    jpName: 'チューブ収縮',
    weight: 1.15,
    version: '1.0.0',
    description: 'Pemanasan heat shrink tube untuk terminal ring/joint, J0 solder, dan kedua ujung kabel shield.',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, partList: pl, ppcsList: ppcs, helpers } = ctx;
  const { getP, mkSub } = helpers;

  const shieldWires = ppcs.filter(
    (r) => r.colour.length >= 2 && r.colour[1].toUpperCase() === 'C'
  ).length;
  const ringAndJointPl = pl
    .filter(
      (r) =>
        r.partName.toLowerCase() === 'terminal' &&
        (['110400', '110800', '8110-', '8150-', '7009-', '553800', '565200'].some((k) =>
          r.partNumber.includes(k)
        ) ||
          r.partNumber.toUpperCase().startsWith('R') ||
          r.partNumber.toUpperCase().startsWith('B-') ||
          r.partNumber.toUpperCase().startsWith('P-'))
    )
    .reduce((a, b) => a + b.qty, 0);
  const j0SolderCount = ppcs.filter(
    (r) =>
      (r.from.toUpperCase() === 'J0' || r.to.toUpperCase() === 'J0') &&
      (r.termR.toLowerCase().includes('solder') || r.termF.toLowerCase().includes('solder'))
  ).length;
  const heatQty = ringAndJointPl + j0SolderCount + shieldWires * 2;

  const subSteps = [
    mkSub('Before', 'Take wires from hanger & untie band', 'sec/lot -> sec/unit(pcs)', heatQty, getP('ht_b1') + getP('ht_b2'), (heatQty * (getP('ht_b1') + getP('ht_b2'))) / lot),
    mkSub('Main Heating', 'Align tubes, shrink with heat gun & tuck', 'sec/unit(pcs)', heatQty, getP('ht_m1') + getP('ht_m2'), heatQty * (getP('ht_m1') + getP('ht_m2'))),
    mkSub('After', 'Remove holder, sign WOS, cap & bundle', 'sec/lot -> sec/unit(pcs)', heatQty, 77.6, (heatQty * (getP('ht_a1') + getP('ht_a2') + getP('ht_a3') + getP('ht_a4') + getP('ht_a5') + getP('ht_a6'))) / lot),
  ];

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'Qty: ' + heatQty + ' (Ring/Joint: ' + ringAndJointPl + ' + J0 Solder: ' + j0SolderCount + ' + 2x Shield: ' + (shieldWires * 2) + ')',
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 15,
    processName: 'Middle inspection',
    jpName: '中間検査',
    weight: 1.0,
    version: '1.0.0',
    description: 'Template kosong untuk proses Middle inspection (belum diaktifkan secara default).',
    isEmptyTemplate: true,
    code: createEmptyDiscTemplateCode(15, 'Middle inspection'),
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 16,
    processName: 'Housing',
    jpName: 'ハウジング',
    weight: 1.35,
    version: '1.0.0',
    description: 'Pre-housing (Pattern A/B), Main Housing (Connector Routing ID 20, wire, terminal pair), dan Post-housing.',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, partList: pl, ppcsList: ppcs, ppcsCount, helpers } = ctx;
  const { getP, mkSub } = helpers;

  const jointCctsAll = ppcs.filter((r) => r.jointNo !== '');
  const connQty = pl
    .filter((r) => r.routingId === 20 && r.partName.toLowerCase() === 'connector')
    .reduce((a, b) => a + b.qty, 0);
  const sleeveQty = pl
    .filter((r) => r.partName.toLowerCase().includes('sleeve'))
    .reduce((a, b) => a + b.qty, 0);

  const nonJointCct = ppcsCount - jointCctsAll.length;
  const hsBefore =
    (nonJointCct * getP('hs_b1') * getP('hs_b1_pq') +
      jointCctsAll.length * getP('hs_b2') * getP('hs_b2_pq')) /
    lot;
  const housingCcts = ppcs.filter((r) => {
    if (!r.cctNo) return false;
    const exclKeys = ['110400', '110800', '8110-', '8150-', '7009-', '553800', '565200'];
    const bothKey = exclKeys.some((k) => r.termR.includes(k) && r.termF.includes(k));
    const bothPref = ['R', 'B', 'P'].some(
      (p) => r.termR.toUpperCase().startsWith(p) && r.termF.toUpperCase().startsWith(p)
    );
    const bothSlv =
      r.af.toLowerCase().includes('sleeve') && r.ag.toLowerCase().includes('sleeve');
    return !(bothKey || bothPref || bothSlv);
  }).length;
  const housingTerms =
    pl
      .filter(
        (r) =>
          r.partName.toLowerCase() === 'terminal' &&
          !['110400', '110800', '8110-', '8150-', '7009-', '553800', '565200'].some((k) =>
            r.partNumber.includes(k)
          ) &&
          !['R', 'B', 'P'].includes(r.partNumber.toUpperCase()[0] || '')
      )
      .reduce((a, b) => a + b.qty, 0) - sleeveQty;

  const hsAfter =
    ((housingCcts * getP('hs_a1') + getP('hs_a2') + getP('hs_a3')) * getP('hs_a_pq')) / lot;

  const subSteps = [
    mkSub('Pre-Housing', 'Pattern A (non-joint) & Pattern B (joint)', 'sec/lot -> sec/unit(pcs)', ppcsCount, 15.45, hsBefore),
    mkSub('Main Housing', 'Prepare connector (Routing ID 20)', 'sec/unit(pcs)', connQty, getP('hs_m1'), getP('hs_m1') * connQty),
    mkSub('Main Housing', 'Prepare wire (All non-ring/joint CCT)', 'sec/unit(pcs)', housingCcts, getP('hs_m2'), getP('hs_m2') * housingCcts),
    mkSub('Main Housing', 'Insert terminal into connector (per pair)', 'sec/unit(pcs)', housingTerms / 2, getP('hs_m3'), getP('hs_m3') * (housingTerms / 2)),
    mkSub('Post-Housing', 'Making, organizing & tidying wire bundles', 'sec/lot -> sec/unit(pcs)', housingCcts, 3.16, hsAfter),
  ];

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'PQ=1 | Non-J: ' + nonJointCct + ', J: ' + jointCctsAll.length + ' | Conn: ' + connQty + ' | Term: ' + housingTerms,
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 17,
    processName: 'Assembly',
    jpName: 'アッセンブリ',
    weight: 1.45,
    version: '1.0.0',
    description: 'Perakitan harness di board (Under 99 vs Over 100 CCT), taping, COT, aksesoris (marker/spot tape/clip/clamp/nameplate).',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { lot, ppcsCount, assemblyCotList: dwg, assemblyComponents, helpers } = ctx;
  const { getP, mkSub } = helpers;

  const isOver100 = ppcsCount > 100;
  const dimPoints = dwg.length;
  const totalTl = dwg.reduce((a, b) => a + b.tl, 0);
  const bareTl = dwg.filter((r) => r.type === 'B').reduce((a, b) => a + b.tl, 0);
  const tapingTl = totalTl - bareTl;
  const cotCount = dwg.filter((r) => r.type === 'C').length;
  const {
    markerQty: nm = 0,
    spotTapeQty: ns = 0,
    namePlateQty: nn = 0,
    clipQty: nx = 0,
    clampQty: ny = 0,
  } = assemblyComponents;

  const tier = isOver100 ? 'Over 100 CCT' : 'Under 99 CCT';
  const subSteps = [
    mkSub('General', 'Scan the barcode', 'sec/lot -> sec/unit(pcs)', 1, getP('as_scan'), getP('as_scan') / lot),
    mkSub('General', 'Wire transport', 'sec/unit(pcs)', 1, getP('as_tr_in'), getP('as_tr_in')),
    mkSub(tier, 'Setting wires on board (per dim point)', 'sec/unit(pcs)', dimPoints, isOver100 ? getP('as_set_o100') : getP('as_set_u99'), dimPoints * (isOver100 ? getP('as_set_o100') : getP('as_set_u99'))),
    mkSub(tier, 'Taping the wires (per mm non-B)', 'sec/unit(pcs)', tapingTl, isOver100 ? getP('as_tap_o100') : getP('as_tap_u99'), tapingTl * (isOver100 ? getP('as_tap_o100') : getP('as_tap_u99'))),
    mkSub(tier, 'Taping COT (per C)', 'sec/unit(pcs)', cotCount, isOver100 ? getP('as_cot_o100') : getP('as_cot_u99'), cotCount * (isOver100 ? getP('as_cot_o100') : getP('as_cot_u99'))),
    mkSub(tier, 'Measuring wire length (per dim point)', 'sec/unit(pcs)', dimPoints, isOver100 ? getP('as_mea_o100') : getP('as_mea_u99'), dimPoints * (isOver100 ? getP('as_mea_o100') : getP('as_mea_u99'))),
    mkSub('Accessories', 'Markers, Spot Tape, Clips, Clamps & Nameplates', 'sec/unit(pcs)', nm + ns + nx + ny + nn, 0, nm * getP('as_mrk') + ns * (isOver100 ? getP('as_spt_o100') : getP('as_spt_u99')) + nx * getP('as_clp') + ny * getP('as_clm') + nn * getP('as_nmp')),
    mkSub(tier, 'Attaching barcodes & removing harness from board', 'sec/unit(pcs)', dimPoints, isOver100 ? getP('as_rem_o100') : getP('as_rem_u99'), (isOver100 ? getP('as_bar_o100') : 0) + dimPoints * (isOver100 ? getP('as_rem_o100') : getP('as_rem_u99'))),
    mkSub('General', 'Transporting the harness', 'sec/lot -> sec/unit(pcs)', 1, getP('as_tr_out'), getP('as_tr_out') / lot),
  ];

  const baseSec = subSteps.reduce((s, x) => s + x.baseSec, 0);
  return {
    active: baseSec > 0,
    summaryNote: 'Dim: ' + dimPoints + ' | Taping: ' + tapingTl + 'mm | COT: ' + cotCount,
    subSteps,
    baseSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 18,
    processName: 'Braiding',
    jpName: 'ウーブンブレード',
    weight: 1.0,
    version: '1.0.0',
    description: 'Template kosong untuk proses Braiding (belum diaktifkan secara default).',
    isEmptyTemplate: true,
    code: createEmptyDiscTemplateCode(18, 'Braiding'),
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 19,
    processName: 'Visual',
    jpName: 'ビジュアル検査',
    weight: 1.05,
    version: '1.0.0',
    description: 'Rumus inspeksi visual: (slope * Master CCT + intercept) * 86400 detik.',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { cctMaster, helpers } = ctx;
  const { getP, mkSub } = helpers;
  const visualSec = (getP('in_vis_slope') * cctMaster + getP('in_vis_int')) * 86400;
  const subSteps = [
    mkSub('Inspection', 'Visual inspection formula (0.0001*CCT + 0.0083)*86400', 'sec/unit(pcs)', cctMaster, 8.64, visualSec),
  ];
  return {
    active: visualSec > 0,
    summaryNote: 'CCT Master: ' + cctMaster,
    subSteps,
    baseSec: visualSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 20,
    processName: 'Checker',
    jpName: '導通検査',
    weight: 1.0,
    version: '1.0.0',
    description: 'Rumus uji kontinuitas Checker: Linear (<200 CCT) vs Logaritmik LN (>=200 CCT).',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { cctMaster, ppcsCount, helpers } = ctx;
  const { getP, mkSub } = helpers;
  const checkerSec =
    ppcsCount < 200
      ? (getP('in_chk_slope') * cctMaster + getP('in_chk_int')) * 86400
      : cctMaster > 0
      ? (getP('in_chk200_slope') * Math.log(cctMaster) + getP('in_chk200_int')) * 86400
      : 0;
  const subSteps = [
    mkSub(
      'Inspection',
      ppcsCount < 200 ? 'Checker Linear (<200 CCT)' : 'Checker Logarithmic LN (>=200 CCT)',
      'sec/unit(pcs)',
      cctMaster,
      0,
      checkerSec
    ),
  ];
  return {
    active: checkerSec > 0,
    summaryNote: 'PPCS CCT: ' + ppcsCount + ' (' + (ppcsCount < 200 ? 'Linear F3' : 'LN F4') + ')',
    subSteps,
    baseSec: checkerSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
  {
    format: 'UMH_PROCESS_DISC_V1',
    processId: 21,
    processName: 'finishing',
    jpName: '後処理',
    weight: 1.0,
    version: '1.0.0',
    description: 'Rumus proses finishing akhir: (slope * Master CCT + intercept) * 86400 detik.',
    isEmptyTemplate: false,
    code: `function calculate(ctx) {
  const { cctMaster, helpers } = ctx;
  const { getP, mkSub } = helpers;
  const finishingSec = (getP('in_fin_slope') * cctMaster + getP('in_fin_int')) * 86400;
  const subSteps = [
    mkSub('Inspection', 'Finishing formula (0.00002*CCT + 0.0025)*86400', 'sec/unit(pcs)', cctMaster, 1.728, finishingSec),
  ];
  return {
    active: finishingSec > 0,
    summaryNote: 'CCT Master: ' + cctMaster,
    subSteps,
    baseSec: finishingSec,
  };
}`,
    updatedAt: NOW_ISO,
  },
];
