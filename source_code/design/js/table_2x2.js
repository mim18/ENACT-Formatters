const prevTab = $('#nav-data-tab');
const nextTab = $('#nav-analysis-tab');
const prevBtn = $('#prevBtn');
const nextBtn = $('#nextBtn');

/**
 * Contains input files.
 *
 * key: group r1c1,r1c2,r2c1,r2c2
 * value: CSV file
 *
 * @type Map
 */
const dataFiles = new Map();
/**
 * Contains the original data read from files.
 *
 * key: group r1c1,r1c2,r2c1,r2c2
 * value: map containing site names and their counts => map(site, counts)
 *
 * @type Map
 */
const dataFileRawData = new Map();

/**
 * Contains all the sites that don't have missing counts.
 * The site number is used to anonymously show the counts for sites.
 *
 * key: site name
 * value: site number that is random assigned
 *
 * @type Map
 */
const validSites = new Map();

/**
 * Holds the aggregate counts of sites in each group r1c1,r1c2,r2c1,r2c2.
 *
 * key: group r1c1,r1c2,r2c1,r2c2
 * value: total counts of all sites in each group
 *
 * @type Map
 */
const aggregateCounts = new Map();

/**
 * Holds individual site counts for each group r1c1,r1c2,r2c1,r2c2.
 *
 * key: group r1c1,r1c2,r2c1,r2c2
 * value: map contain individual site counts => map(site, counts)
 *
 * @type Map
 */
const siteGroupCounts = new Map();

/**
 * Group A is experimental group.
 * Group B is control group.
 *
 * r1c1 = group A count
 * r1c2 = group A total count
 * r1c3 = group A rate
 * r2c1 = group B count
 * r2c2 = group B total count
 * r2c3 = group B rate
 *
 * @type type
 */
const stats = {
    aggregate: {
        r1c1: 0, r1c2: 0, r1c3: 0,
        r2c1: 0, r2c2: 0, r2c3: 0,
        irr: 0, lnIrr: 0, varLnIrr: 0,
        lnStdErr: 0, ci: 0, lower95CI: 0, upper95CI: 0,
        zScore: 0, pValue: 0
    },
    individual: new Map(),
    metaAnalysis: {
        fixedEffect: {
            irr: 0,
            lnIrr: 0,
            lnStdErr: 0,
            ci: 0, lower95CI: 0, upper95CI: 0, lnLower95CI: 0, lnUpper95CI: 0,
            zScore: 0, pValue: 0
        },
        randomEffect: {
            irr: 0,
            lnIrr: 0,
            lnStdErr: 0,
            ci: 0, lower95CI: 0, upper95CI: 0, lnLower95CI: 0, lnUpper95CI: 0,
            zScore: 0, pValue: 0
        },
        heterogeneity: {
            Q: 0,
            df: 0,
            tauSq: 0,
            ISq: 0,
            pValue: 0
        }
    },
    normalCDF: (z) => {
        const t = 1 / (1 + 0.2316419 * Math.abs(z));
        const d = 0.3989423 * Math.exp(-z * z / 2);
        const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

        return z > 0 ? 1 - p : p;
    },
    chiSquarePValue: (chiSq, df) => {
        if (chiSq < 0 || df < 1)
            return 1;

        // Approximation for the Incomplete Gamma Function
        function gammaCDF(x, a) {
            if (x <= 0)
                return 0;
            let sum = 1 / a;
            let term = sum;
            for (let i = 1; i < 100; i++) {
                term *= x / (a + i);
                sum += term;
                if (term < sum * 1e-14)
                    break;
            }
            return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
        }

        function logGamma(n) {
            // Lanczos approximation
            const coeff = [76.18009172947146, -86.50532032941677, 24.01409824083091,
                -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
            let x = n, y = n;
            let tmp = x + 5.5;
            tmp -= (x + 0.5) * Math.log(tmp);
            let ser = 1.000000000190015;
            for (let j = 0; j <= 5; j++)
                ser += coeff[j] / ++y;
            return -tmp + Math.log(2.5066282746310005 * ser / x);
        }

        // Chi-Square P-Value is 1 - CDF
        return 1 - gammaCDF(chiSq / 2, df / 2);
    }
};

const computeCounts = () => {
    aggregateCounts.clear();
    siteGroupCounts.clear();

    const countsForTenOrLess = parseInt($('#select_patient_counts').val());
    if (countsForTenOrLess >= 1 && countsForTenOrLess <= 10) {
        for (const [group, rawSiteCounts] of dataFileRawData) {
            let total = 0;
            const siteCounts = new Map();
            for (const [site, rawCounts] of rawSiteCounts) {
                const counts = (rawCounts === '10 patients or fewer') ? countsForTenOrLess : parseInt(rawCounts);
                siteCounts.set(site, counts);
                total += counts;
            }

            aggregateCounts.set(group, total);
            siteGroupCounts.set(group, siteCounts);
        }
    }
};

/**
 * Fisher-Yates Shuffle
 *
 * @param {type} array
 * @returns {shuffled array}
 */
const shuffle = (array) => {
    let randomIndex;
    let currentIndex = array.length;
    while (currentIndex !== 0) {
        // pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // swap it with the current element
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
};

/**
 * A site is valid if it has data (counts).
 *
 * @param {type} csvFile
 * @returns {Promise}
 */
const getRowDataValidSiteTask = (csvFile) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            complete: function (results) {
                const sites = new Set();
                const lines = results.data;
                for (let i = 1; i < lines.length; i++) {
                    const data = lines[i];
                    if (data.length > 1) {
                        const site = data[0].trim();
                        const count = data[1].trim();
                        if (count === '10 patients or fewer' || !isNaN(count)) {
                            sites.add(site);
                        }
                    }
                }

                resolve(sites);
            }
        });
    });
};
const readIn2ColumnRowDataTask = (csvFile, group, map) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            complete: function (results) {
                const rawSiteCounts = new Map();
                const lines = results.data;
                for (let i = 1; i < lines.length; i++) {
                    const data = lines[i];
                    if (data.length > 1) {
                        const site = data[0].trim();
                        const count = data[1].trim();
                        if (validSites.has(site)) {
                            rawSiteCounts.set(site, count);
                        }
                    }
                }
                map.set(group, rawSiteCounts);

                resolve();
            }
        });
    });
};

const readInData = (callback) => {
    dataFileRawData.clear();

    const tasks = [];
    dataFiles.forEach((file, group) => {
        tasks.push(readIn2ColumnRowDataTask(file, group, dataFileRawData));
    });

    Promise.all(tasks).then(() => {
        computeCounts();
        callback();
    });
};

const computeAggregateSiteStats = () => {
    const aggr = stats.aggregate;

    // set the counts for r1c1,r1c2,r2c1,r2c2
    aggregateCounts.forEach((counts, cell) => aggr[cell] = counts);

    // calculate the rate for group A and group B
    aggr.r1c3 = (aggr.r1c1 / aggr.r1c2);
    aggr.r2c3 = (aggr.r2c1 / aggr.r2c2);

    // incidence rate ratio
    // (num of no exposure) / (num of exposure)
    aggr.irr = aggr.r1c3 / aggr.r2c3;
    aggr.lnIrr = Math.log(aggr.irr);
    aggr.varLnIrr = (1.0 / aggr.r1c1) + (1.0 / aggr.r2c1);

    aggr.lnStdErr = Math.sqrt(aggr.varLnIrr);
    aggr.ci = 1.959964 * aggr.lnStdErr;
    aggr.lower95CI = Math.exp(aggr.lnIrr - aggr.ci);
    aggr.upper95CI = Math.exp(aggr.lnIrr + aggr.ci);

    aggr.zScore = aggr.lnIrr / aggr.lnStdErr;
    aggr.pValue = 2 * (1 - stats.normalCDF(Math.abs(aggr.zScore)));
};
/**
 * Source for calculation: https://drsm.in/Meta-analysis/Meta_AnalysisHelp1
 *
 * @returns {undefined}
 */
const computeIndividualSiteStats = () => {
    const indiv = stats.individual;
    const fixedEffect = stats.metaAnalysis.fixedEffect;
    const randomEffect = stats.metaAnalysis.randomEffect;
    const heterogeneity = stats.metaAnalysis.heterogeneity;

    // initialize data
    indiv.clear();
    validSites.forEach((siteNumber, siteName) => {
        indiv.set(siteName, {
            siteName: siteName,
            siteNumber: siteNumber,
            r1c1: 0, r1c2: 0, r1c3: 0,
            r2c1: 0, r2c2: 0, r2c3: 0,
            irr: 0, lnIrr: 0, varLnIrr: 0,
            lnStdErr: 0, ci: 0,
            lower95CI: 0, upper95CI: 0, lnLower95CI: 0, lnUpper95CI: 0,
            zScore: 0, pValue: 0,
            fixedWgt: 0, fixedWgtPct: 0,
            randomWgt: 0, randomWgtPct: 0
        });
    });

    // set the counts for r1c1,r1c2,r2c1,r2c2 for individual site
    siteGroupCounts.forEach((siteCounts, group) => {
        siteCounts.forEach((counts, site) => {
            indiv.get(site)[group] = counts;
        });
    });

    // calculate the stats
    let sumFixedWgt = 0; // sum(fixedWgt)
    let sumFixedWgtSq = 0; // sum(fixedWgt^2)
    indiv.values().forEach(data => {
        // calcuate the rates
        data.r1c3 = data.r1c1 / data.r1c2;
        data.r2c3 = data.r2c1 / data.r2c2;

        data.irr = data.r1c3 / data.r2c3;
        data.lnIrr = Math.log(data.irr);
        data.varLnIrr = (1.0 / data.r1c1) + (1.0 / data.r2c1);

        data.lnStdErr = Math.sqrt(data.varLnIrr);
        data.ci = 1.959964 * data.lnStdErr;
        data.lnLower95CI = data.lnIrr - data.ci;
        data.lnUpper95CI = data.lnIrr + data.ci;
        data.lower95CI = Math.exp(data.lnLower95CI);
        data.upper95CI = Math.exp(data.lnUpper95CI);

        data.zScore = data.lnIrr / data.lnStdErr;
        data.pValue = 2 * (1 - stats.normalCDF(Math.abs(data.zScore)));

        // weights (W) of each included studies under fixed effect model (inverse variance method) 
        data.fixedWgt = 1 / data.varLnIrr;

        sumFixedWgt += data.fixedWgt;
        sumFixedWgtSq += data.fixedWgt * data.fixedWgt;
    });

    // summary Log IRR (meta-analysis Log IRR) under fixed effect model
    let sumFixedWgtLnIrr = 0; // sum(lnIRR*fixedWgtPct)
    indiv.values().forEach(data => {
        data.fixedWgtPct = data.fixedWgt / sumFixedWgt;

        sumFixedWgtLnIrr += data.lnIrr * data.fixedWgtPct;
    });
    fixedEffect.irr = Math.exp(sumFixedWgtLnIrr);
    fixedEffect.lnIrr = sumFixedWgtLnIrr;
    fixedEffect.lnStdErr = 1.0 / Math.sqrt(sumFixedWgt);
    fixedEffect.ci = 1.959964 * fixedEffect.lnStdErr;
    fixedEffect.lnLower95CI = fixedEffect.lnIrr - fixedEffect.ci;
    fixedEffect.lnUpper95CI = fixedEffect.lnIrr + fixedEffect.ci;
    fixedEffect.lower95CI = Math.exp(fixedEffect.lnLower95CI);
    fixedEffect.upper95CI = Math.exp(fixedEffect.lnUpper95CI);
    fixedEffect.zScore = fixedEffect.lnIrr / fixedEffect.lnStdErr;
    fixedEffect.pValue = 2 * (1 - stats.normalCDF(Math.abs(fixedEffect.zScore)));

    let sumQ = 0;
    indiv.values().forEach(data => {
        // fixedWgt*(lnRR-weighted lnRR)^2
        sumQ += data.fixedWgt * Math.pow((data.lnIrr - sumFixedWgtLnIrr), 2);
    });

    const degreeFreedom = indiv.size - 1;
    const tauSq1 = sumQ - (indiv.size - 1);
    const tauSq2 = sumFixedWgt - (sumFixedWgtSq / sumFixedWgt);
    const tauSq = tauSq1 / tauSq2;
    heterogeneity.df = degreeFreedom;
    heterogeneity.Q = sumQ;
    heterogeneity.tauSq = tauSq;
    heterogeneity.ISq = ((sumQ - degreeFreedom) / sumQ) * 100;

    // compare the statistic against a (chi-squared) distribution with degrees of freedom
    heterogeneity.pValue = stats.chiSquarePValue(sumQ, degreeFreedom);

    let sumRandomWgt = 0;
    indiv.values().forEach(data => {
        data.randomWgt = 1 / (data.varLnIrr + tauSq);

        sumRandomWgt += data.randomWgt;
    });

    // summary Log IRR (meta-analysis Log IRR) under random effect model
    let sumRandomWgtLnIrr = 0;
    indiv.values().forEach(data => {
        data.randomWgtPct = data.randomWgt / sumRandomWgt;

        sumRandomWgtLnIrr += data.lnIrr * data.randomWgtPct;
    });
    randomEffect.irr = Math.exp(sumRandomWgtLnIrr);
    randomEffect.lnIrr = sumRandomWgtLnIrr;
    randomEffect.lnStdErr = 1.0 / Math.sqrt(sumRandomWgt);
    randomEffect.ci = 1.959964 * randomEffect.lnStdErr;
    randomEffect.lnLower95CI = randomEffect.lnIrr - randomEffect.ci;
    randomEffect.lnUpper95CI = randomEffect.lnIrr + randomEffect.ci;
    randomEffect.lower95CI = Math.exp(randomEffect.lnLower95CI);
    randomEffect.upper95CI = Math.exp(randomEffect.lnUpper95CI);
    randomEffect.zScore = randomEffect.lnIrr / randomEffect.lnStdErr;
    randomEffect.pValue = 2 * (1 - stats.normalCDF(Math.abs(randomEffect.zScore)));

    // convert to percentage from decimal (do this last)
    indiv.values().forEach(data => {
        data.fixedWgtPct *= 100;
        data.randomWgtPct *= 100;
    });
};
const computeStats = () => {
    computeAggregateSiteStats();
    computeIndividualSiteStats();
};

const Round = {
    toTwo: function (value, decimal) {
        return (decimal < 1) ? value.toFixed(2) : value.toFixed(decimal);
    },
    toFour: function (value, decimal) {
        return (decimal < 1) ? value.toFixed(4) : value.toFixed(decimal);
    }
};

const getMetaAnalysisData = (decimal, showSiteNames, isExport) => {
    const tableData = new Map();

    stats.individual.forEach((stats, site) => {
        const name = showSiteNames ? site : `Site ${stats.siteNumber}`;
        const data = [
            isExport ? `"${name}"` : name,
            stats.r1c1, stats.r1c2, stats.r2c1, stats.r2c2,
            Round.toFour(stats.lnStdErr, decimal), Round.toFour(stats.irr, decimal),
            Round.toFour(stats.lower95CI, decimal), Round.toFour(stats.upper95CI, decimal),
            Round.toTwo(stats.fixedWgt, decimal), Round.toTwo(stats.fixedWgtPct, decimal),
            Round.toTwo(stats.randomWgt, decimal), Round.toTwo(stats.randomWgtPct, decimal),
            Round.toTwo(stats.zScore, decimal),
            stats.pValue < 0.0001 ? '< 0.0001' : Round.toFour(stats.pValue, decimal)
        ];

        if (showSiteNames) {
            tableData.set(site, data);
        } else {
            tableData.set(stats.siteNumber, data);
        }
    });

    return tableData;
};
const getForestPlotData = (showSiteNames, sortSiteNames, isRandomEffect) => {
    let data = [];
    for (const value of stats.individual.values()) {
        data.push({
            study: showSiteNames ? value.siteName : `Site ${value.siteNumber}`,
            studyNumber: value.siteNumber,
            groupA: value.r1c1,
            groupATotal: value.r1c2,
            groupB: value.r2c1,
            groupBTotal: value.r2c2,
            estimate: value.irr,
            lower: value.lower95CI,
            upper: value.upper95CI,
            wgt: isRandomEffect ? value.randomWgt : value.fixedWgt,
            wgtPct: isRandomEffect ? value.randomWgtPct : value.fixedWgtPct,
            effectModel: false
        });
    }

    if (sortSiteNames) {
        data = showSiteNames ? data.sort((a, b) => a.study.localeCompare(b.study)) : data.sort((a, b) => a.studyNumber - b.studyNumber);
    }

    return data;
};

const populateTableCounts = () => {
    // display counts for r1c1,r1c2,r2c1,r2c2
    aggregateCounts.forEach((counts, id) => $(`#${id}`).text(counts));
};
const populateAggregateStatsTable = (decimal) => {
    const aggr = stats.aggregate;

    $('#r1c3').text(Round.toTwo(aggr.r1c3 * 100, decimal));
    $('#r2c3').text(Round.toTwo(aggr.r2c3 * 100, decimal));
    $('#r1c4').text(`${Round.toFour(aggr.irr, decimal)} (${Round.toFour(aggr.lower95CI, decimal)}-${Round.toFour(aggr.upper95CI, decimal)})`);

    $('#stderr').text(Round.toFour(aggr.lnStdErr, decimal));
    $('#irr').text(Round.toFour(aggr.irr, decimal));
    $('#ci_lower').text(Round.toFour(aggr.lower95CI, decimal));
    $('#ci_upper').text(Round.toFour(aggr.upper95CI, decimal));
    $('#p_value').text(aggr.pValue < 0.0001 ? '< 0.0001' : Round.toFour(aggr.pValue));
};
const populateMetaAnalysisTable = (decimal, showSiteNames, sortSiteNames) => {
    const isDefault = decimal < 1;
    const tableData = getMetaAnalysisData(decimal, showSiteNames, false);

    const tbody = document.querySelector('#meta_analysis tbody');
    tbody.innerHTML = '';
    const data = sortSiteNames
            ? showSiteNames ? [...tableData.keys()].sort() : [...tableData.keys()].sort((a, b) => a - b)
            : [...tableData.keys()];
    data.forEach(key => {
        const row = tbody.insertRow(-1);
        tableData.get(key).forEach((value, index) => {
            row.insertCell(index).innerHTML = value;
        });

        // add backgroud color to columns
        row.cells[1].classList.add('table-success');
        row.cells[2].classList.add('table-success');
        row.cells[3].classList.add('table-warning');
        row.cells[4].classList.add('table-warning');
        row.cells[7].classList.add('table-secondary');
        row.cells[8].classList.add('table-secondary');
        row.cells[9].classList.add('table-info');
        row.cells[10].classList.add('table-info');
        row.cells[11].classList.add('table-primary');
        row.cells[12].classList.add('table-primary');
    });
};
const populateForestPlot = (plot, plotData, effectModel, isRandomEffect, decimal) => {
    const blankRow = {};
    const data = [...plotData, blankRow, effectModel];

    const plotHeight = data.length * 50;
    const plotWidth = 450;

    // dimensions and margins
    const margin = {top: 40, right: 30, bottom: 90, left: 30};
    const width = plotWidth - margin.left - margin.right;
    const height = plotHeight - margin.top - margin.bottom;
    const yPlotStart = 40;

    // remove previous chart
    d3.select(plot).selectAll('*').remove();

    const fontFamily = 'Arial, sans-serif';
    const fontSize = '0.875em';

    const zoom = d3.zoom().scaleExtent([1, 5]).on('zoom', function (event) {
        svg.attr('transform', event.transform);
    });

    const svg = d3.select(plot)
            .attr('width', '100%')
            .attr('height', height + margin.top + margin.bottom)
            .style('font-family', fontFamily)
            .style('font-size', fontSize)
            .call(zoom)
            .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // x-scale (effect size)
    const x = d3.scaleLinear()
            .domain([d3.min(data, d => d.lower - 0.05), d3.max(data, d => d.upper + 0.05)])
            .range([0, width]);

    // y-scale (studies)
    const y = d3.scaleBand()
            .domain(data.map(d => d.study))
            .range([yPlotStart, height])
            .padding(1.25);

    const rows = svg.selectAll('.row')
            .data(data)
            .enter()
            .append('g')
            .attr('transform', d => `translate(0, ${y(d.study) + (y.bandwidth() / 2)})`);

    const dxPos = 10;
    const dyPos = 20;

    const row1Txt = $('.row1LabelText').first().text();
    const row2Txt = $('.row2LabelText').first().text();
    const col1Txt = $('.col1LabelText').first().text();
    const col2Txt = $('.col2LabelText').first().text();
    const groupCntLbl = `${col1Txt} / ${col2Txt}`;
};
const populateForestPlots = (decimal, showSiteNames, sortSiteNames) => {
    const aggr = stats.aggregate;

    const fixed = stats.metaAnalysis.fixedEffect;
    const common = {
        study: 'Fixed effect model',
        groupA: aggr.r1c1,
        groupATotal: aggr.r1c2,
        groupB: aggr.r2c1,
        groupBTotal: aggr.r2c2,
        estimate: fixed.irr,
        lower: fixed.lower95CI,
        upper: fixed.upper95CI,
        wgtPct: 100,
        effectModel: true
    };
    populateForestPlot('#forestChartFixed', getForestPlotData(showSiteNames, sortSiteNames, false), common, false, decimal);

    const rand = stats.metaAnalysis.randomEffect;
    const random = {
        study: 'Random effects model',
        groupA: aggr.r1c1,
        groupATotal: aggr.r1c2,
        groupB: aggr.r2c1,
        groupBTotal: aggr.r2c2,
        estimate: rand.irr,
        lower: rand.lower95CI,
        upper: rand.upper95CI,
        wgtPct: 100,
        effectModel: true
    };
    populateForestPlot('#forestChartRandom', getForestPlotData(showSiteNames, sortSiteNames, true), random, true, decimal);
};
const constructTableAndPlot = () => {
    computeStats();
    populateTableCounts();

    const showSiteNames = $('#show_site_names').prop('checked');
    const decimal = parseInt($('#round_decimal').val());
    const sortSiteNames = $('#sort_site_names').prop('checked');
    populateAggregateStatsTable(decimal);
    populateMetaAnalysisTable(decimal, showSiteNames, sortSiteNames);
    populateForestPlots(decimal, showSiteNames, sortSiteNames, false);
//    populateSiteTable(showSiteNames, sortSiteNames);
};

/**
 * A task for getting all sites that contain data (counts).
 *
 * @returns {Array|getValidSiteTasks.tasks}
 */
const getValidSiteTasks = () => {
    const tasks = [];
    for (const file of dataFiles.values()) {
        tasks.push(getRowDataValidSiteTask(file));
    }

    return tasks;
};

const advanceToNextTab = () => {
    constructTableAndPlot();

    nextTab.removeClass('disabled');
    nextTab.trigger('click', [true]);
};

const generateTableAndPlot = () => {
    Promise.all(getValidSiteTasks()).then((siteNames) => {
        let sites = new Set();
        siteNames.forEach(siteName => {
            sites = sites.size > 0 ? sites.intersection(siteName) : sites.union(siteName);
        });

        validSites.clear();
        const shuffledIndexes = shuffle([...Array(sites.size).keys()]);
        Array.from(sites).forEach((site, index) => validSites.set(site, shuffledIndexes[index] + 1));

        readInData(advanceToNextTab);
    });

    return true;
};

const clearDataStructures = () => {
    dataFiles.clear();
    dataFileRawData.clear();

    validSites.clear();

    aggregateCounts.clear();
    siteGroupCounts.clear();

    stats.aggregate = {
        r1c1: 0, r1c2: 0, r1c3: 0,
        r2c1: 0, r2c2: 0, r2c3: 0,
        irr: 0, lnIrr: 0, varLnIrr: 0,
        lnStdErr: 0, ci: 0, lower95CI: 0, upper95CI: 0,
        zScore: 0, pValue: 0
    };
    stats.individual.clear();
    stats.fixedIrr = 0;
    stats.fixedLower95CI = 0;
    stats.fixedUpper95CI = 0;
    stats.randomIrr = 0;
    stats.randomLower95CI = 0;
    stats.randomUpper95CI = 0;
    stats.tauSquare = 0;
    stats.iSquare = 0;
};

const saveInputData = (fileId, csvFile) => {
    if (fileId && csvFile) {
        dataFiles.set(fileId, csvFile);

        const htmlCode = `<div class="alert alert-light p-2 m-0" role="alert"><i class="bi bi-file-earmark-arrow-up"></i> ${csvFile.name}</div>`;
        $(`#filename_${fileId}`).html(htmlCode);

        // remove error alerts
        $(`#droparea_${fileId}`)
                .removeClass('bg-danger-subtle')
                .removeClass('highlight')
                .addClass('bg-dropped');

        if (dataFiles.size >= 4) {
            $('#dataErrorMsg').hide();
        }
    }
};

const validInputFiles = () => {
    if (dataFiles.size < 4) {
        for (const rc of ['r1c1', 'r1c2', 'r2c1', 'r2c2']) {
            if (dataFiles.has(rc)) {
                continue;
            }

            $(`#droparea_${rc}`).addClass('bg-danger-subtle');
            $('#dataErrorMsg').show();
        }

        return false;
    }

    $('.dropArea').removeClass('bg-danger-subtle');
    $('#dataErrorMsg').hide();

    return true;
};
const isValidInput = () => {
    return $('#inputLabels').valid() && validInputFiles();
};

const switchToEditMode = (name) => {
    const labelElement = $(`#${name}`);
    const inputElement = $(`#${name}Input`);

    // Set the input's value to the label's current text
    inputElement.val(labelElement.text().trim());

    // Hide the label and show the input
    labelElement.hide();
    inputElement.show();

    // Focus the input field and select all its text
    inputElement.focus();
};
const switchToLabelMode = (name) => {
    const labelElement = $(`#${name}`);
    const inputElement = $(`#${name}Input`);
    const textElement = $(`.${name}Text`);

    // Update the label's text with the input's value
    labelElement.html(`${inputElement.val().trim()} <i class="bi bi-pencil"></i>`);
    textElement.text(inputElement.val().trim());

    if ($('#inputLabels').valid()) {
        // Hide the input and show the label
        inputElement.hide();
        labelElement.show();

        $('#step2btn').prop('disabled', false);
    } else {
        $('#step2btn').prop('disabled', true);
    }
};
const addLabelEventListeners = () => {
    const saveOnEnter = (event, name) => {
        if (event.key === 'Enter') {
            switchToLabelMode(name);
        }
    };

    // exposure label (row)
    $('#rowLabel').on('dblclick', () => switchToEditMode('rowLabel'));
    $('#rowLabelInput').on('focusout', () => switchToLabelMode('rowLabel'));
    $('#rowLabelInput').on('keypress', event => saveOnEnter(event, 'rowLabel'));

    // experimental label (row 1)
    $('#row1Label').on('dblclick', () => switchToEditMode('row1Label'));
    $('#row1LabelInput').on('focusout', () => switchToLabelMode('row1Label'));
    $('#row1LabelInput').on('keypress', event => saveOnEnter(event, 'row1Label'));

    // control label (row 2)
    $('#row2Label').on('dblclick', () => switchToEditMode('row2Label'));
    $('#row2LabelInput').on('focusout', () => switchToLabelMode('row2Label'));
    $('#row2LabelInput').on('keypress', event => saveOnEnter(event, 'row2Label'));

    // column label (col)
    $('#colLabel').on('dblclick', () => switchToEditMode('colLabel'));
    $('#colLabelInput').on('focusout', () => switchToLabelMode('colLabel'));
    $('#colLabelInput').on('keypress', event => saveOnEnter(event, 'colLabel'));

    // column label (col 1)
    $('#col1Label').on('dblclick', () => switchToEditMode('col1Label'));
    $('#col1LabelInput').on('focusout', () => switchToLabelMode('col1Label'));
    $('#col1LabelInput').on('keypress', event => saveOnEnter(event, 'col1Label'));

    // column label (col 2)
    $('#col2Label').on('dblclick', () => switchToEditMode('col2Label'));
    $('#col2LabelInput').on('focusout', () => switchToLabelMode('col2Label'));
    $('#col2LabelInput').on('keypress', event => saveOnEnter(event, 'col2Label'));
};

const addFileDrapDropEventListeners = () => {
    // prevent default drag behaviors
    const preventDefaults = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => $('.dropArea').on(event, preventDefaults));

    // highlighting drop area when item is dragged over it
    const highlight = (event) => event.target.classList.add('highlight');
    ['dragenter', 'dragover'].forEach(event => $('.dropArea').on(event, highlight));

    // remove highlighting from drop area when item is dropped
    const unhighlight = (event) => event.target.classList.remove('highlight');
    $('.dropArea').on('dragleave', unhighlight);

    // file drop action
    const handleFileDrop = (event) => {
        if (event.originalEvent.dataTransfer.items) {
            // use DataTransferItemList interface to access the file(s)
            [...event.originalEvent.dataTransfer.items].forEach(item => {
                // If dropped items aren't files, reject them
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file.type === 'text/csv') {
                        const fileId = event.target.id.replace('droparea_', '');
                        saveInputData(fileId, file);
                    }
                }
            });
        } else {
            // use DataTransfer interface to access the file(s)
            [...event.originalEvent.dataTransfer.files].forEach(file => {
                const fileId = event.target.id.replace('droparea_', '');
                saveInputData(fileId, file);
            });
        }
    };
    $('.dropArea').on('drop', handleFileDrop);
};
const addFileSelectEventListeners = () => {
    const handleFileSelect = (event) => {
        if (event.target.files.length > 0) {
            const fileId = event.target.id.replace('file_', '').trim();
            $(`#droparea_${fileId}`).addClass('highlight');
            saveInputData(fileId, event.target.files[0]);
        }
        event.target.value = "";
    };
    $('.file_select').on('change', handleFileSelect);
};
const addWizardEventListeners = () => {
    prevBtn.on('click', () => {
        prevTab.trigger('click');
    });
    nextBtn.on('click', () => {
        if (isValidInput()) {
            generateTableAndPlot();
        }
    });

    prevTab.on("click", () => {
        prevBtn.addClass('disabled');
        nextBtn.removeClass('disabled');
    });
    nextTab.on("click", (event, noRerun) => {
        if (noRerun) {
            prevBtn.removeClass('disabled');
            nextBtn.addClass('disabled');
        } else {
            nextTab.addClass('disabled');
            prevTab.trigger('click');
            nextBtn.trigger('click');
        }
    });
};
const addSettingsEventListeners = () => {
    $('#select_patient_counts').on('change', () => {
        if (aggregateCounts.size >= 4) {
            computeCounts();
            constructTableAndPlot();
        }
    });

    $('#round_decimal').on('change', () => {
        const showSiteNames = $('#show_site_names').prop('checked');
        const decimal = parseInt($('#round_decimal').val());

        populateAggregateStatsTable(decimal);
        populateMetaAnalysisTable(decimal, showSiteNames);
//        populateForestPlot(decimal, showSiteNames);
    });

    const handleSiteNameChange = () => {
        const decimal = parseInt($('#round_decimal').val());
        const showSiteNames = $('#show_site_names').prop('checked');
        const sortSiteNames = $('#sort_site_names').prop('checked');

//        populateSiteTable(showSiteNames, sortSiteNames);
        populateMetaAnalysisTable(decimal, showSiteNames, sortSiteNames);
//        populateForestPlot(decimal, showSiteNames, sortSiteNames);
    };
    $('#show_site_names').on('change', handleSiteNameChange);
    $('#sort_site_names').on('change', handleSiteNameChange);
};
const addExportEventListeners = () => {
};
const addEventListeners = () => {
    addLabelEventListeners();
    addFileDrapDropEventListeners();
    addFileSelectEventListeners();
    addWizardEventListeners();
    addSettingsEventListeners();
    addExportEventListeners();
};

$(document).ready(function () {
    $('#copyright_year').text(new Date().getFullYear());

    addEventListeners();

    $('#inputLabels').validate({
        errorElement: "em",
        errorClass: 'text-danger',
        errorPlacement: function (error, element) {
            error.addClass("invalid-feedback");
            error.insertAfter(element);
        },
        highlight: function (element) {
            $(element).addClass("is-invalid").removeClass("is-valid");
        },
        unhighlight: function (element) {
            $(element).addClass("is-valid").removeClass("is-invalid");
        }
    });

    clearDataStructures();
});