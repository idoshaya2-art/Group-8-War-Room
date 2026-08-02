const {loadPW,APP,CHROME}=require('./lib.cjs');
const { chromium } = loadPW();
(async()=>{
const b=await chromium.launch({executablePath:CHROME});
const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto(APP); await p.waitForTimeout(600);
const R=await p.evaluate(()=>{
  const rows=[]; const add=(sheet,item,ok,detail)=>rows.push({sheet,item,ok:!!ok,detail:detail||''});
  const D=DATALOG, has=v=>v!==undefined&&v!==null;

  // 01 ExchangeRates
  add('01 FX','4 currencies', has(D.fx.USD)&&has(D.fx.EUR)&&has(D.fx.BRL)&&has(D.fx.SF), JSON.stringify(D.fx));
  // 02 Chip->PC
  const m=D.chipPerPC; const cells=m.length===10&&m.every(r=>r.length===10);
  add('02 Chip→PC','10x10 grade matrix', cells, m.length+'x'+(m[0]||[]).length);
  add('02 Chip→PC','incompatible pairs encoded as 0', m[0][3]===0&&m[9][0]===0);
  // 03 Production
  add('03 Prod','capacity X&Y x3 areas', has(D.capacity.X.us)&&has(D.capacity.Y.brazil), JSON.stringify(D.capacity));
  add('03 Prod','plant acquisition cost', has(D.plantAcqCost.X.us)&&has(D.plantAcqCost.Y.brazil));
  add('03 Prod','fixed cost per plant #1-3', (D.plantFixedCost.X.us||[]).length===3);
  add('03 Prod','depreciation X8%/Y5%', D.depreciation.X===8&&D.depreciation.Y===5);
  add('03 Prod','variable mfg % of retail', !!D.varMfgCostPctOfRetail.X&&!!D.varMfgCostPctOfRetail.Y);
  add('03 Prod','Brazil plant deposit', D.brazilPlantDepositBRL===1000000);
  add('03 Prod','regional cost pattern (US cheap chips/dear PCs vs EU)', typeof RULES!=='undefined'&&!!(RULES.production&&RULES.production.regionalCostPattern));
  // 04 Marketing
  add('04 Mktg','initial consumer prices', has(D.initialConsumerPrice.Y.us)&&has(D.initialConsumerPrice.X.brazil));
  add('04 Mktg','minimum price change', has(D.minPriceChange.Y.brazil));
  add('04 Mktg','max PC price Y0-Y3 = 1400', D.maxPCPriceY0toY3===1400);
  add('04 Mktg','agent C&A per unit (4 scenarios)', has(D.sellingCostPerUnit.xOnly)&&has(D.sellingCostPerUnit.xyY));
  add('04 Mktg','office fixed cost central/regional', has(D.officeFixedCost.central.us)&&has(D.officeFixedCost.regional.brazil));
  add('04 Mktg','office combo limits (min 1c+1r, max 1c+9r)', !!(typeof RULES!=='undefined'&&RULES.offices&&RULES.offices.maxRegional));
  // 05 Transfer
  add('05 Freight','surface rates 3x6', !!D.freight.surface.us&&!!D.freight.surface.brazil);
  add('05 Freight','air rates 3x6', !!D.freight.air.us);
  add('05 Freight','breakpoints surface+air', !!D.freight.breakSurface&&!!D.freight.breakAir);
  add('05 Freight','above-breakpoint discount 50%/33.3%', D.freight.discountAboveBreak.surface===0.5);
  add('05 Freight','engine function computes freight', typeof freightCostLC==='function');
  // 06 Inventory & R&D
  add('06 Inv/RD','carrying cost per unit', has(D.carryingCostPerUnit.Y.europe));
  add('06 Inv/RD','no carrying charge in production quarter', !!(typeof RULES!=='undefined'&&RULES.inventory&&RULES.inventory.noChargeInProductionQuarter));
  add('06 Inv/RD','R&D minimum per scientist/Q', D.rdMinPerQuarter.X===40000&&D.rdMinPerQuarter.Y===70000);
  // 07 Finance
  add('07 Fin','corporation tax x4', D.tax.us===50&&D.tax.hq===15);
  add('07 Fin','loss carry-forward (US .6 / EU .3 / HO 1)', !!(typeof RULES!=='undefined'&&RULES.tax&&RULES.tax.lossCarryForward));
  add('07 Fin','area bank loan rates', has(D.interest.areaBankLoan.us));
  add('07 Fin','government securities rates', has(D.interest.govSecurities.brazil));
  add('07 Fin','HO loans + securities', has(D.interest.hoLoan.brl)&&has(D.interest.hoSecurities.usd));
  add('07 Fin','supplier credit + switchover', has(D.interest.supplierCredit.switchover.us));
  add('07 Fin','interest on POSITIVE local balances', !!(D.interest.posBalance));
  add('07 Fin','interest on negative balances', !!D.interest.negBalance);
  add('07 Fin','exchange commission', has(D.exchangeCommission.brazil));
  // 08 Time lags
  add('08 Lags','production→sale 1Q', !!(typeof RULES!=='undefined'&&RULES.lags&&RULES.lags.productionToSale));
  add('08 Lags','airfreight resell same Q', !!(typeof RULES!=='undefined'&&RULES.lags&&RULES.lags.airResellSameQuarter));
  add('08 Lags','surface transfer 1Q', !!(typeof RULES!=='undefined'&&RULES.lags&&RULES.lags.surfaceTransfer));
  add('08 Lags','patent licence timing (1Q/1Q/min 2Q)', !!(typeof RULES!=='undefined'&&RULES.lags&&RULES.lags.patent));
  add('08 Lags','advertising residual decay', !!(typeof RULES!=='undefined'&&RULES.adv&&RULES.adv.sameQuarterShare));
  add('08 Lags','stock-market confidence lag', !!(typeof RULES!=='undefined'&&RULES.lags&&RULES.lags.stockConfidence));
  // 09 AR/AP
  add('09 AR/AP','collection split x3 areas', !!D.collection.us&&!!D.collection.brazil);
  add('09 AR/AP','taxes go to A/P1', !!(typeof RULES!=='undefined'&&RULES.arap&&RULES.arap.taxToAP1));
  // 10 Key params
  add('10 Key','starting capital SF 8M', D.startingCapitalSF===8000000);
  add('10 Key','minimum HO cash SF 20k', D.minHOCashSF===20000);
  add('10 Key','PC market potential ~1.2 plants', !!(typeof RULES!=='undefined'&&RULES.potential&&RULES.potential.pcPlantsPerArea));
  add('10 Key','chip market ~1/4 of PC', !!(typeof RULES!=='undefined'&&RULES.potential&&RULES.potential.chipShareOfPcMarket));
  add('10 Key','n<N marketing companies → potential', !!(typeof RULES!=='undefined'&&RULES.potential&&RULES.potential.nLessThanN));
  // Guide behavioural
  add('§4.9 Guide','MAX TWO GRADES per product per area', !!(typeof RULES!=='undefined'&&RULES.grades&&RULES.grades.maxPerProductPerArea));
  add('§4.9 Guide','third grade downgrades the middle grade', !!(typeof RULES!=='undefined'&&RULES.grades&&RULES.grades.thirdGradePenalty));
  add('§4.7 Guide','two grades in one plant = interference cost', !!(typeof RULES!=='undefined'&&RULES.production&&RULES.production.twoGradeInterference));
  add('§5.3 Guide','price elasticity by region x product', !!(typeof RULES!=='undefined'&&RULES.price));
  add('§5.3 Guide','goodwill loss on stockout', !!(typeof RULES!=='undefined'&&RULES.goodwill));
  add('§5.4 Guide','advertising elasticity + threshold', !!(typeof RULES!=='undefined'&&RULES.adv&&RULES.adv.threshold));
  add('§5.2 Guide','chip/PC cross-elasticity', !!(typeof RULES!=='undefined'&&RULES.cross));
  return rows;
});
const miss=R.filter(r=>!r.ok), ok=R.filter(r=>r.ok);
console.log('COVERAGE: '+ok.length+'/'+R.length+' present, '+miss.length+' missing\n');
console.log('--- MISSING ---'); miss.forEach(r=>console.log('  ✗ ['+r.sheet+'] '+r.item));
console.log('\npageErrors:',errs);
await b.close();
process.exit((typeof R!=='undefined'&&R.fail&&R.fail.length)?1:0);
})();
