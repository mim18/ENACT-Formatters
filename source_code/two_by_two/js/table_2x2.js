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
 * r1c1: group A count
 * r1c2: group A total count
 * r1c3: group A rate => count/(total count)
 * r2c1: group B count
 * r2c2: group B total count
 * r2c3: group B rate => count/(total count)
 * irr: incident rate ratio
 * lnIrr: ln(irr)
 * varlnIrr: variance of lnIrr
 * stderr: standard error
 * ci: 95% confidence interval
 * lower95CI: lower 95% confidence interval
 * upper95CI: uppper 95% confidence interval
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
    fixedIrr: 0, fixedLower95CI: 0, fixedUpper95CI: 0,
    randomIrr: 0, randomLower95CI: 0, randomUpper95CI: 0,
    tauSquare: 0,
    iSquare: 0
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

const computeCounts = () => {
    aggregateCounts.clear();
    siteGroupCounts.clear();

    const countsForTenOrLess = parseInt($('#selectPatientCounts').val());
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
 * Normal Distribution CDF (Standard Normal).
 *
 * @param {type} z
 * @returns {Number}
 */
const normalCDF = (z) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

    return z > 0 ? 1 - p : p;
};
const computeAggregateSiteStats = () => {
    const aggregate = stats.aggregate;

    // set the counts for r1c1,r1c2,r2c1,r2c2
    aggregateCounts.forEach((counts, cell) => aggregate[cell] = counts);

    // calculate the rate for group A and group B
    aggregate.r1c3 = (aggregate.r1c1 / aggregate.r1c2);
    aggregate.r2c3 = (aggregate.r2c1 / aggregate.r2c2);

    // incidence rate ratio
    // (num of no exposure) / (num of exposure)
    aggregate.irr = aggregate.r1c3 / aggregate.r2c3;
    aggregate.lnIrr = Math.log(aggregate.irr);
    aggregate.varLnIrr = (1.0 / aggregate.r1c1) + (1.0 / aggregate.r2c1);

    aggregate.lnStdErr = Math.sqrt(aggregate.varLnIrr);
    aggregate.ci = 1.959964 * aggregate.lnStdErr;
    aggregate.lower95CI = Math.exp(aggregate.lnIrr - aggregate.ci);
    aggregate.upper95CI = Math.exp(aggregate.lnIrr + aggregate.ci);

    aggregate.zScore = aggregate.lnIrr / aggregate.lnStdErr;
    aggregate.pValue = 2 * (1 - normalCDF(Math.abs(aggregate.zScore)));
};
/**
 * Source for calculation: https://drsm.in/Meta-analysis/Meta_AnalysisHelp1
 *
 * @returns {undefined}
 */
const computeIndividualSiteStats = () => {
    const indiv = stats.individual;
    indiv.clear();

    // initialize data
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
        data.pValue = 2 * (1 - normalCDF(Math.abs(data.zScore)));

        data.fixedWgt = 1 / data.varLnIrr;

        sumFixedWgt += data.fixedWgt;
        sumFixedWgtSq += data.fixedWgt * data.fixedWgt;
    });

    let sumFixedWgtLnIrr = 0; // sum(lnIRR*fixedWgtPct)
    indiv.values().forEach(data => {
        data.fixedWgtPct = data.fixedWgt / sumFixedWgt;

        sumFixedWgtLnIrr += data.lnIrr * data.fixedWgtPct;
    });

    let sumQ = 0;
    indiv.values().forEach(data => {
        // fixedWgt*(lnRR-weighted lnRR)^2
        sumQ += data.fixedWgt * Math.pow((data.lnIrr - sumFixedWgtLnIrr), 2);
    });

    const tauSq1 = sumQ - (indiv.size - 1);
    const tauSq2 = sumFixedWgt - (sumFixedWgtSq / sumFixedWgt);
    const tau = tauSq1 / tauSq2;
    stats.tauSquare = tau;

    let sumRandomWgt = 0;
    indiv.values().forEach(data => {
        data.randomWgt = 1 / (data.varLnIrr + tau);

        sumRandomWgt += data.randomWgt;
    });

    let sumFixedWgtIrr = 0;
    let sumRandomWgtIrr = 0;
    let sumFixedLowerCI = 0;
    let sumFixedUpperCI = 0;
    let sumRandomLowerCI = 0;
    let sumRandomUpperCI = 0;
    indiv.values().forEach(data => {
        data.randomWgtPct = data.randomWgt / sumRandomWgt;

        sumFixedWgtIrr += data.lnIrr * data.fixedWgtPct;
        sumRandomWgtIrr += data.lnIrr * data.randomWgtPct;

        sumFixedLowerCI += data.lnLower95CI * data.fixedWgtPct;
        sumFixedUpperCI += data.lnUpper95CI * data.fixedWgtPct;
        sumRandomLowerCI += data.lnLower95CI * data.randomWgtPct;
        sumRandomUpperCI += data.lnUpper95CI * data.randomWgtPct;
    });
    stats.fixedIrr = Math.exp(sumFixedWgtIrr);
    stats.fixedLower95CI = Math.exp(sumFixedLowerCI);
    stats.fixedUpper95CI = Math.exp(sumFixedUpperCI);
    stats.randomIrr = Math.exp(sumRandomWgtIrr);
    stats.randomLower95CI = Math.exp(sumRandomLowerCI);
    stats.randomUpper95CI = Math.exp(sumRandomUpperCI);
    stats.iSquare = 100 * (sumQ - (indiv.size - 1)) / sumQ;

    // convert to percentage from decimal
    indiv.values().forEach(data => {
        data.fixedWgtPct *= 100;
        data.randomWgtPct *= 100;
    });
};
const computeStats = () => {
    computeAggregateSiteStats();
    computeIndividualSiteStats();
};

const getStatsTableData = (decimal, showSiteNames) => {
    const tableData = new Map();

    stats.individual.forEach((stats, site) => {
        const data = [
            showSiteNames ? site : `Site ${stats.siteNumber}`,
            stats.r1c1, stats.r1c2, stats.r2c1, stats.r2c2,
            stats.lnStdErr.toFixed(decimal), stats.irr.toFixed(decimal),
            stats.lower95CI.toFixed(decimal), stats.upper95CI.toFixed(decimal),
            stats.fixedWgt.toFixed(decimal), stats.fixedWgtPct.toFixed(decimal),
            stats.randomWgt.toFixed(decimal), stats.randomWgtPct.toFixed(decimal)
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

/**
 * Get the pixel with of a string given font size.
 *
 * @param {type} text
 * @param {type} font
 * @returns {unresolved}
 */
const getStringWidth = (text, font = '14px Arial, sans-serif') => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = font;

    return context.measureText(text).width;
};
const getColumnPixelSize = (data, font) => {
    return Math.max(...data.map(value => Math.ceil(getStringWidth(value, font))));
};

const populateTableCounts = () => {
    // display counts for r1c1,r1c2,r2c1,r2c2
    aggregateCounts.forEach((counts, id) => $(`#${id}`).text(counts));
};
const populateTableProbabilities = (decimal) => {
    $('#r1c3').text(stats.aggregate.r1c3.toFixed(decimal));
    $('#r2c3').text(stats.aggregate.r2c3.toFixed(decimal));
    $('#r2c4').text(`${stats.aggregate.irr.toFixed(decimal)} (${stats.aggregate.lower95CI.toFixed(decimal)}-${stats.aggregate.upper95CI.toFixed(decimal)})`);

    $('#stderr').text(stats.aggregate.lnStdErr.toFixed(decimal));
    $('#irr').text(stats.aggregate.irr.toFixed(decimal));
    $('#ci_lower').text(stats.aggregate.lower95CI.toFixed(decimal));
    $('#ci_upper').text(stats.aggregate.upper95CI.toFixed(decimal));
};
const populateStatsTable = (decimal, showSiteNames, sortSiteNames) => {
    const tableData = getStatsTableData(decimal, showSiteNames);

    const tbody = document.querySelector('#stats tbody');
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
        row.cells[7].classList.add('table-info');
        row.cells[8].classList.add('table-info');
        row.cells[9].classList.add('table-secondary');
        row.cells[10].classList.add('table-secondary');
    });
};
const populateWeightedForestPlot = (plot, plotData, effectModel, isRandomEffect, decimal) => {
    const blankRow = {
        lower: effectModel.lower,
        upper: effectModel.upper
    };
    const data = [...plotData, blankRow, effectModel];

    const plotHeight = data.length * 50;
    const plotWidth = 450;

    // dimensions and margins
    const margin = {top: 50, right: 15, bottom: 30, left: 15};
    const width = plotWidth - margin.left - margin.right;
    const height = plotHeight - margin.top - margin.bottom;

    // remove previous chart
    d3.select(plot).selectAll('*').remove();

    const fontFamily = 'Arial, sans-serif';
    const fontSize = '0.875em';

    const svg = d3.select(plot)
            .attr('width', '100%')
            .attr('height', plotHeight)
            .attr('font-family', fontFamily)
            .attr('font-size', fontSize)
            .call(d3.zoom().scaleExtent([1, 5]).on('zoom', function (event) {
                svg.attr('transform', event.transform);
            }))
            .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // x-scale (effect size)
    const x = d3.scaleLinear()
            .domain([d3.min(data, d => d.lower - 0.05), d3.max(data, d => d.upper + 0.05)])
            .range([0, width]);

    // y-scale (studies)
    const y = d3.scaleBand()
            .domain(data.map(d => d.study))
            .range([0, height])
            .padding(1.25);

    const rows = svg.selectAll('.row')
            .data(data)
            .enter()
            .append('g')
            .attr('transform', d => `translate(0, ${y(d.study) + (y.bandwidth() / 2)})`);

    const yPosHeader = -25;
    const dxPos = 10;
    const dyHeader = -5;

    let xPos = 0;

    const font = '16px Arial, sans-serif';
    const lengthCol1 = getColumnPixelSize([...data.map(d => d.study ? d.study : ''), 'Site'], font);
    const lengthCol2 = getColumnPixelSize([...data.map(d => `${(d.groupA && d.groupATotal) ? `${d.groupA} / ${d.groupATotal}` : ''}`), 'Group A'], font);
    const lengthCol3 = getColumnPixelSize([...data.map(d => `${(d.groupB && d.groupBTotal) ? `${d.groupB} / ${d.groupBTotal}` : ''}`), 'Group B (Ref)'], font);
    const lengthCol4 = plotWidth;
    const lengthCol5 = getColumnPixelSize([...data.map(d => `${d.estimate ? d.estimate.toFixed(decimal) : ''}`), 'IRR'], font);
    const lengthCol6 = getColumnPixelSize([...data.map(d => `[${d.lower ? d.lower.toFixed(decimal) : ''}, ${d.upper ? d.upper.toFixed(decimal) : ''}]`), '95% CI'], font);
    const lengthCol7 = getColumnPixelSize([...data.map(d => d.wgtPct ? `${d.wgtPct.toFixed(decimal)}%` : ''), 'Weight'], font);

    // column 1: Site
    svg.append('text')
            .attr('x', 0)
            .attr('y', yPosHeader)
            .style('font-weight', 'bold')
            .text('Site');
    rows.append('text')
            .attr('x', 0)
            .attr('text-anchor', 'start')
            .attr('class', 'site-name')
            .text(d => d.study ? d.study : '');
    // bold effect model
    d3.selectAll('.site-name')
            .filter(d => d.effectModel)
            .style('font-weight', 'bold');

    // Column 2: Group A (n/N)
    xPos += lengthCol1 + (lengthCol2 / 2);
    svg.append('text')
            .attr('x', xPos)
            .attr('y', yPosHeader)
            .attr('text-anchor', 'middle')
            .style('font-weight', 'bold')
            .text('Group A');
    svg.append('text')
            .attr('x', xPos)
            .attr('dy', dyHeader)
            .attr('text-anchor', 'middle')
            .style('font-weight', 'bold')
            .text('(n/N)');
    rows.append('text')
            .attr('x', xPos)
            .attr('class', 'group-a')
            .attr('text-anchor', 'middle')
            .text(d => (d.groupA && d.groupATotal) ? `${d.groupA} / ${d.groupATotal}` : '');
    // bold effect model
    d3.selectAll('.group-a')
            .filter(d => d.effectModel)
            .style('font-weight', 'bold');

    // Column 3: Group B (n/N)
    xPos += (lengthCol2 + lengthCol3) / 2;
    svg.append('text')
            .attr('x', xPos)
            .attr('y', yPosHeader)
            .attr('text-anchor', 'middle')
            .style('font-weight', 'bold')
            .text('Group B (Ref)');
    svg.append('text')
            .attr('x', xPos)
            .attr('dy', dyHeader)
            .attr('text-anchor', 'middle')
            .style('font-weight', 'bold')
            .text('(n/N)');
    rows.append('text')
            .attr('x', xPos)
            .attr('class', 'group-b')
            .attr('text-anchor', 'middle')
            .text(d => (d.groupB && d.groupBTotal) ? `${d.groupB} / ${d.groupBTotal}` : '');
    // bold effect model
    d3.selectAll('.group-b')
            .filter(d => d.effectModel)
            .style('font-weight', 'bold');

    // Column 4: Incident Rate Ratio (forest plot)
    xPos += lengthCol3 / 2;
    svg.append('text')
            .attr('x', xPos + (width / 2) - (Math.ceil(getStringWidth('Incident Rate Ratio')) / 2))
            .attr('y', yPosHeader)
            .style('font-size', fontSize)
            .text('Incident Rate Ratio')
            .style('font-weight', 'bold');
    svg.append('g')
            .attr('transform', `translate(${xPos},${height})`)
            .call(d3.axisBottom(x));

    // add vertical reference line (null effect)
    svg.append('line')
            .attr('x1', x(1) + xPos)
            .attr('x2', x(1) + xPos)
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', 'red')
            .attr('stroke-dasharray', 'none');

    // effect model vertical reference line
    svg.append('line')
            .attr('x1', x(effectModel.estimate) + xPos)
            .attr('x2', x(effectModel.estimate) + xPos)
            .attr('y1', 0)
            .attr('y2', y(effectModel.study))
            .attr('stroke', 'blue')
            .attr('stroke-dasharray', '8');

    // draw confidence intervals (horizontal lines)
    const yShift = 5;
    svg.selectAll('.ci')
            .data(data)
            .enter()
            .append('line')
            .attr('x1', d => d.effectModel ? d.estimate : d.lower ? x(d.lower) + xPos : x(1) + xPos)
            .attr('x2', d => d.effectModel ? d.estimate : d.upper ? x(d.upper) + xPos : x(1) + xPos)
            .attr('y1', d => d.study ? y(d.study) + (y.bandwidth() / 2) - yShift : x(1) + xPos)
            .attr('y2', d => d.study ? y(d.study) + (y.bandwidth() / 2) - yShift : x(1) + xPos)
            .attr('stroke-width', 1)
            .attr('stroke', 'black');
    //    svg.selectAll('.ci')
    //            .data(data)
    //            .enter()
    //            .append('line')
    //            .attr('x1', d => d.lower ? x(d.lower) + xPos : x(1) + xPos)
    //            .attr('x2', d => d.lower ? x(d.lower) + xPos : x(1) + xPos)
    //            .attr('y1', d => d.study ? y(d.study) + (y.bandwidth() / 2) - (yShift * 2) : x(1) + xPos)
    //            .attr('y2', d => d.study ? y(d.study) + (y.bandwidth() / 2) : x(1) + xPos)
    //            .attr('stroke-width', 1)
    //            .attr('stroke', 'black');
    //    svg.selectAll('.ci')
    //            .data(data)
    //            .enter()
    //            .append('line')
    //            .attr('x1', d => d.upper ? x(d.upper) + xPos : x(1) + xPos)
    //            .attr('x2', d => d.upper ? x(d.upper) + xPos : x(1) + xPos)
    //            .attr('y1', d => d.study ? y(d.study) + (y.bandwidth() / 2) - (yShift * 2) : x(1) + xPos)
    //            .attr('y2', d => d.study ? y(d.study) + (y.bandwidth() / 2) : x(1) + xPos)
    //            .attr('stroke-width', 1)
    //            .attr('stroke', 'black');

    // draw effect size points (boxes)
    const sizeScale = d3.scaleSqrt()
            .domain([0, d3.max(data, d => d.wgt ? d.wgt : 0)])
            .range([0, 25]);
    svg.selectAll('.point')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'point')
            .attr('x', d => (d.estimate && d.wgt) ? x(d.estimate) - (sizeScale(d.wgt) / 2) + xPos : x(1) + xPos)
            .attr('y', d => (d.study && d.wgt) ? (y(d.study) + (y.bandwidth() / 2)) - (sizeScale(d.wgt) / 2) - yShift : x(1) + xPos)
            .attr('width', d => d.effectModel ? 0 : d.wgt ? sizeScale(d.wgt) : 0)
            .attr('height', d => d.effectModel ? 0 : d.wgt ? sizeScale(d.wgt) : 0)
            .attr('fill', 'black');

    // draw common effect point
    const size = 8;
    const lineGenerator = d3.line()
            .x(d => d.x)
            .y(d => d.y);
    const diamond = [
        {x: x(effectModel.lower) + xPos, y: y(effectModel.study) + (y.bandwidth() / 2) - yShift}, // left
        {x: x(effectModel.estimate) + xPos, y: y(effectModel.study) + (y.bandwidth() / 2) - yShift - size}, // top
        {x: x(effectModel.upper) + xPos, y: y(effectModel.study) + (y.bandwidth() / 2) - yShift}, // right
        {x: x(effectModel.estimate) + xPos, y: y(effectModel.study) + (y.bandwidth() / 2) - yShift + size} // bottom
    ];
    svg.append('path')
            .attr('d', lineGenerator(diamond) + 'Z') // 'Z' closes path
            .attr('fill', 'blue')
            .attr('stroke', 'blue');

    // Column 5: IRR
    xPos += lengthCol4 + (lengthCol5 / 2);
    svg.append('text')
            .attr('x', xPos)
            .attr('y', yPosHeader)
            .attr('text-anchor', 'end')
            .style('font-weight', 'bold')
            .text('IRR');
    rows.append('text')
            .attr('x', xPos)
            .attr('text-anchor', 'end')
            .attr('class', 'irr')
            .text(d => d.estimate ? d.estimate.toFixed(decimal) : '');
    // bold effect model (IRR)
    d3.selectAll('.irr')
            .filter(d => d.effectModel)
            .attr('x', xPos)
            .style('font-weight', 'bold');

    // Column 6: 95% CI
    xPos += dxPos;
    svg.append('text')
            .attr('x', xPos + decimal)
            .attr('y', yPosHeader)
            .style('font-weight', 'bold')
            .text('95% CI');
    rows.append('text')
            .attr('x', xPos)
            .attr('class', 'ci')
            .text(d => (d.lower && d.upper && d.estimate) ? `[${d.lower.toFixed(decimal)}, ${d.upper.toFixed(decimal)}]` : '');
    // bold effect model (95% CI)
    d3.selectAll('.ci')
            .filter(d => d.effectModel)
            .attr('x', xPos)
            .style('font-weight', 'bold');

    // Column 7: Fixed Weight
    xPos += lengthCol6 + lengthCol7 - dxPos;
    svg.append('text')
            .attr('x', xPos)
            .attr('y', yPosHeader)
            .attr('text-anchor', 'end')
            .style('font-weight', 'bold')
            .text(isRandomEffect ? 'Random' : 'Fixed');
    svg.append('text')
            .attr('x', xPos)
            .attr('dy', dyHeader)
            .attr('text-anchor', 'end')
            .style('font-weight', 'bold')
            .text('Weight');
    rows.append('text')
            .attr('x', xPos)
            .attr('text-anchor', 'end')
            .attr('class', 'weight-percent')
            .text(d => d.wgtPct ? (d.wgtPct === 100) ? '100%' : `${d.wgtPct.toFixed(decimal)}%` : '');
    // bold effect model (95% CI)
    d3.selectAll('.weight-percent')
            .filter(d => d.effectModel)
            .attr('x', xPos)
            .style('font-weight', 'bold');

    const iSq = stats.iSquare.toFixed(1);
    const tauSq = stats.tauSquare.toFixed(4);
    const pvalue = (stats.aggregate.pValue < 0.0001) ? 'p < 0.0001' : `p = ${stats.aggregate.pValue.toFixed(4)}`;
    svg.append('text')
            .attr('x', 0)
            .attr('y', height)
            .style('font-size', fontSize)
            .text(`Heterogeneity: I² = ${iSq}%, τ² = ${tauSq}, ${pvalue}`);
};
const populateForestPlot = (decimal, showSiteNames, sortSiteNames) => {
    const common = {
        study: 'Common effect model',
        groupA: stats.aggregate.r1c1,
        groupATotal: stats.aggregate.r1c2,
        groupB: stats.aggregate.r2c1,
        groupBTotal: stats.aggregate.r2c2,
        estimate: stats.aggregate.irr,
        lower: stats.aggregate.lower95CI,
        upper: stats.aggregate.upper95CI,
        wgtPct: 100,
        effectModel: true
    };
    populateWeightedForestPlot('#forestChartFixed', getForestPlotData(showSiteNames, sortSiteNames, false), common, false, decimal);

    const random = {
        study: 'Random effect model',
        groupA: stats.aggregate.r1c1,
        groupATotal: stats.aggregate.r1c2,
        groupB: stats.aggregate.r2c1,
        groupBTotal: stats.aggregate.r2c2,
        estimate: stats.randomIrr,
        lower: stats.randomLower95CI,
        upper: stats.randomUpper95CI,
        wgtPct: 100,
        effectModel: true
    };
    populateWeightedForestPlot('#forestChartRandom', getForestPlotData(showSiteNames, sortSiteNames, true), random, true, decimal);
};
const populateSiteTable = (showSiteNames, sortSiteNames) => {
    $('#siteCounts').text(validSites.size);

    let data = showSiteNames ? [...validSites.keys()] : [...validSites.values()];
    if (sortSiteNames) {
        data = showSiteNames ? data.sort() : data.sort((a, b) => a - b);
    }

    const tbody = document.querySelector('#siteNames tbody');
    tbody.innerHTML = '';
    data.forEach(name => {
        tbody.insertRow(-1).insertCell(0).innerHTML = showSiteNames ? name : `Site ${name}`;
    });
};

const constructTableAndPlot = () => {
    computeStats();
    populateTableCounts();

    const showSiteNames = $('#showSiteNames').prop('checked');
    const decimal = parseInt($('#decimal').val());
    const sortSiteNames = $('#sortSiteNames').prop('checked');
    populateTableProbabilities(decimal);
    populateStatsTable(decimal, showSiteNames, sortSiteNames);
    populateForestPlot(decimal, showSiteNames, sortSiteNames, false);
    populateSiteTable(showSiteNames, sortSiteNames);
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

const saveInputData = (fileId, csvFile) => {
    if (fileId && csvFile) {
        dataFiles.set(fileId, csvFile);

        const htmlCode = `<div class="alert alert-success p-2 m-0" role="alert"><i class="bi bi-file-earmark-arrow-up"></i> ${csvFile.name}</div>`;
        $(`#filename_${fileId}`).html(htmlCode);

        // remove error alerts
        $(`#droparea_${fileId}`).removeClass('bg-danger-subtle');
        if (dataFiles.size >= 4) {
            $('#dataErrorMsg').hide();
        }
    }
};

const advanceToNextTab = () => {
    constructTableAndPlot();

    const nextTab = $('.nav-link.active').parent().next().find('button');
    nextTab.removeClass('disabled');

    (new bootstrap.Tab(nextTab)).show();
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

const getIndividualDataContents = () => {
    const content = [];

    const rowLabel = $('.rowLabelText').first().text();
    const row1Label = $('.row1LabelText').first().text();
    const row2Label = $('.row2LabelText').first().text();
    const colLabel = $('.colLabelText').first().text();
    const col1Label = $('.col1LabelText').first().text();
    const col2Label = $('.col2LabelText').first().text();
    const header = [
        'Site',
        `${rowLabel} ${row1Label}: ${col1Label}`,
        `${rowLabel} ${row1Label}: ${col2Label}`,
        `${colLabel} ${row2Label}: ${col1Label}`,
        `${colLabel} ${row2Label}: ${col2Label}`,
        'SE ln(IRR)',
        'IRR',
        'Lower 95% CI',
        'Upper 95% CI',
        'Fixed Weight',
        'Fixed Weight %',
        'Random Weight',
        'Random Weight %'
    ];
    content.push(header.join(','));

    // settings
    const decimal = parseInt($('#decimal').val());
    const showSiteNames = $('#showSiteNames').prop('checked');
    const sortSiteNames = $('#sortSiteNames').prop('checked');

    const tableData = getStatsTableData(decimal, showSiteNames);
    const data = sortSiteNames
            ? showSiteNames ? [...tableData.keys()].sort() : [...tableData.keys()].sort((a, b) => a - b)
            : [...tableData.keys()];
    data.forEach(key => content.push(tableData.get(key).join(',')));

    return content.join('\r\n');
};
const getSiteNameContents = () => {
    const content = [];
    content.push('"Generic Name","Site Name"');

    const sortedMapByValue = new Map([...validSites].sort((a, b) => a[1] - b[1]));
    sortedMapByValue.forEach((number, name) => {
        content.push(`"Site ${number}","${name}"`);
    });

    return content.join('\r\n');
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

    $('#rowLabel').on('dblclick', () => switchToEditMode('rowLabel'));
    $('#rowLabelInput').on('focusout', () => switchToLabelMode('rowLabel'));
    $('#rowLabelInput').on('keypress', event => saveOnEnter(event, 'rowLabel'));

    $('#row1Label').on('dblclick', () => switchToEditMode('row1Label'));
    $('#row1LabelInput').on('focusout', () => switchToLabelMode('row1Label'));
    $('#row1LabelInput').on('keypress', event => saveOnEnter(event, 'row1Label'));

    $('#row2Label').on('dblclick', () => switchToEditMode('row2Label'));
    $('#row2LabelInput').on('focusout', () => switchToLabelMode('row2Label'));
    $('#row2LabelInput').on('keypress', event => saveOnEnter(event, 'row2Label'));

    $('#colLabel').on('dblclick', () => switchToEditMode('colLabel'));
    $('#colLabelInput').on('focusout', () => switchToLabelMode('colLabel'));
    $('#colLabelInput').on('keypress', event => saveOnEnter(event, 'colLabel'));

    $('#col1Label').on('dblclick', () => switchToEditMode('col1Label'));
    $('#col1LabelInput').on('focusout', () => switchToLabelMode('col1Label'));
    $('#col1LabelInput').on('keypress', event => saveOnEnter(event, 'col1Label'));

    $('#col2Label').on('dblclick', () => switchToEditMode('col2Label'));
    $('#col2LabelInput').on('focusout', () => switchToLabelMode('col2Label'));
    $('#col2LabelInput').on('keypress', event => saveOnEnter(event, 'col2Label'));

    $('#col3Label').on('dblclick', () => switchToEditMode('col3Label'));
    $('#col3LabelInput').on('focusout', () => switchToLabelMode('col3Label'));
    $('#col3LabelInput').on('keypress', event => saveOnEnter(event, 'col3Label'));

    $('#col4Label').on('dblclick', () => switchToEditMode('col4Label'));
    $('#col4LabelInput').on('focusout', () => switchToLabelMode('col4Label'));
    $('#col4LabelInput').on('keypress', event => saveOnEnter(event, 'col4Label'));
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
    $('#nextStep').on('click', () => {
        if (isValidInput()) {
            generateTableAndPlot();
        }
    });

    $('#prevStep').on('click', () => {
        const prevTab = $('.nav-link.active').parent().prev().find('button');

        (new bootstrap.Tab(prevTab)).show();
    });
};
const addSettingsEventListeners = () => {
    $('#selectPatientCounts').on('change', () => {
        if (aggregateCounts.size >= 4) {
            computeCounts();
            constructTableAndPlot();
        }
    });

    $('#decimal').on('change', () => {
        const showSiteNames = $('#showSiteNames').prop('checked');
        const decimal = parseInt($('#decimal').val());

        populateTableProbabilities(decimal);
        populateStatsTable(decimal, showSiteNames);
        populateForestPlot(decimal, showSiteNames);
    });

    const handleSiteNameChange = () => {
        const decimal = parseInt($('#decimal').val());
        const showSiteNames = $('#showSiteNames').prop('checked');
        const sortSiteNames = $('#sortSiteNames').prop('checked');

        populateSiteTable(showSiteNames, sortSiteNames);
        populateStatsTable(decimal, showSiteNames, sortSiteNames);
        populateForestPlot(decimal, showSiteNames, sortSiteNames);
    };
    $('#showSiteNames').on('change', handleSiteNameChange);
    $('#sortSiteNames').on('change', handleSiteNameChange);
};
const addExportEventListeners = () => {
    $('#exportIndividualData').on('click', (event) => {
        event.preventDefault();

        const content = getIndividualDataContents();
        const blob = new Blob([content], {type: 'text/csv;charset=utf-8;'});

        const downloadLink = document.createElement('a');
        downloadLink.download = 'stats.csv';
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.click();
    });

    $('#exportSiteNames').on('click', (event) => {
        event.preventDefault();

        const content = getSiteNameContents();
        const blob = new Blob([content], {type: 'text/csv;charset=utf-8;'});

        const downloadLink = document.createElement('a');
        downloadLink.download = 'sites.csv';
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.click();
    });

    const exportPlot = (plotId, outputFilename) => {
        const svg = d3.select(plotId).node();
        const {width, height} = svg.getBoundingClientRect();

        // get SVG as Base64 encode string
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgDataBase64 = btoa(unescape(encodeURIComponent(svgData)));
        const svgDataUrl = `data:image/svg+xml;charset=utf-8;base64,${svgDataBase64}`;

        const canvas = document.createElement('canvas');
        canvas.setAttribute('width', width);
        canvas.setAttribute('height', height);

        const context = canvas.getContext('2d');
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, width, height);

        const image = new Image();
        image.addEventListener('load', () => {
            context.drawImage(image, 0, 0, width, height);

            const downloadLink = document.createElement('a');
            downloadLink.download = outputFilename;
            downloadLink.href = canvas.toDataURL('image/png');
            downloadLink.click();
        });
        image.src = svgDataUrl;
    };
    $('#exportForestPlotFixed').on('click', (event) => {
        event.preventDefault();
        exportPlot('#forestChartFixed', 'forest_plot_fixed.png');
    });
    $('#exportForestPlotRandom').on('click', (event) => {
        event.preventDefault();
        exportPlot('#forestChartRandom', 'forest_plot_random.png');
    });
};
const addEventListeners = () => {
    addLabelEventListeners();
    addFileDrapDropEventListeners();
    addFileSelectEventListeners();
    addWizardEventListeners();

    addSettingsEventListeners();
    addExportEventListeners();
};

const applyInputLabels = () => {
    // side-label
    $('.rowLabel').text($('#rowLabelInput').val());
    $('.row1Label').text($('#row1LabelInput').val());
    $('.row2Label').text($('#row2LabelInput').val());

    // top-label
    $('.colLabel').text($('#colLabelInput').val());
    $('.col1Label').text($('#col1LabelInput').val());
    $('.col2Label').text($('#col2LabelInput').val());
    $('.col3Label').text($('#col3LabelInput').val());
    $('.col4Label').text($('#col4LabelInput').val());
};

const resetData = () => {
    clearDataStructures();
    applyInputLabels();
};

$(document).ready(function () {
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

    resetData();
});