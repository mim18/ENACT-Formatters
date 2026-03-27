const dataFiles = new Map();
const dataFileRawData = new Map();

const validSites = new Map();

const totalCounts = new Map();
const siteGroupCounts = new Map();

/**
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
    total: {
        r1c1: 0, r1c2: 0, r1c3: 0,
        r2c1: 0, r2c2: 0, r2c3: 0,
        irr: 0,
        stderr: 0,
        ci: 0,
        lower95CI: 0,
        upper95CI: 0
    },
    indiv: new Map()
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
    validSites.clear();
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
const readIn2ColumnRowDataTask = (csvFile, id, map) => {
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
                map.set(id, rawSiteCounts);

                resolve();
            }
        });
    });
};

const tallyCounts = (rawData, countsForTenOrLess) => {
    let total = 0;
    rawData.forEach(count => {
        if (count === '10 patients or fewer') {
            total += countsForTenOrLess;
        } else {
            total += parseInt(count);
        }
    });

    return total;
};
const computeCounts = () => {
    totalCounts.clear();

    const countsForTenOrLess = parseInt($('#selectPatientCounts').val());
    dataFileRawData.forEach((rawSiteCounts, id) => {
        totalCounts.set(id, tallyCounts([...rawSiteCounts.values()], countsForTenOrLess));
    });
};

const computeTotalSiteStats = () => {
    const total = stats.total;

    // set the counts for r1c1,r1c2,r2c1,r2c2
    totalCounts.forEach((counts, id) => total[id] = counts);

    // calculate the rate for group A and group B
    total.r1c3 = (total.r1c2 / total.r1c1) * 100;
    total.r2c3 = (total.r2c2 / total.r2c1) * 100;

    // incidence rate ratio
    // (num of no exposure) / (num of exposure)
    total.irr = total.r2c3 / total.r1c3;

    total.stderr = Math.sqrt((1.0 / total.r1c2) + (1.0 / total.r2c2));
    total.ci = 1.96 * total.stderr;
    total.lower95CI = Math.exp(Math.log(total.irr) - total.ci);
    total.upper95CI = Math.exp(Math.log(total.irr) + total.ci);
};
const computeIndividualSiteStats = () => {
    const indiv = stats.indiv;
    [...validSites.keys()].forEach(site => {
        indiv.set(site, {
            r1c1: 0, r1c2: 0, r1c3: 0,
            r2c1: 0, r2c2: 0, r2c3: 0,
            irr: 0, lnirr: 0, varlnirr: 0,
            stderr: 0, ci: 0, lower95CI: 0, upper95CI: 0
        });
    });

    // set the counts for r1c1,r1c2,r2c1,r2c2
    dataFileRawData.forEach((siteCounts, id) => {
        siteCounts.forEach((counts, site) => {
            indiv.get(site)[id] = counts;
        });
    });

    // calculate the rate for group A and group B
    indiv.values().forEach(data => {
        data.r1c3 = data.r1c1 / data.r1c2;
        data.r2c3 = data.r2c1 / data.r2c2;

        data.irr = data.r1c3 / data.r2c3;
        data.lnirr = Math.log(data.irr);
        data.varlnirr = (1 / data.r1c1) + (1 / data.r2c1);

        data.stderr = Math.sqrt((1.0 / data.r1c2) + (1.0 / data.r2c2));
        data.ci = 1.96 * data.stderr;
        data.lower95CI = Math.exp(Math.log(data.irr) - data.ci);
        data.lower95CI = Math.exp(Math.log(data.irr) - data.ci);
        data.upper95CI = Math.exp(Math.log(data.irr) + data.ci);
    });
};
const computeStats = () => {
    computeTotalSiteStats();
    computeIndividualSiteStats();
};

const roundTo = (number, decimal) => {
    return Number(number.toFixed(decimal));
};
const populateTableProbabilities = (decimal) => {
    $('#r1c3').text(roundTo(stats.total.r1c3, decimal));
    $('#r2c3').text(roundTo(stats.total.r2c3, decimal));
    $('#r2c4').text(`${roundTo(stats.total.irr, decimal)} (${roundTo(stats.total.lower95CI, decimal)}-${roundTo(stats.total.upper95CI, decimal)})`);

    $('#stderr').text(roundTo(stats.total.stderr, decimal));
    $('#irr').text(roundTo(stats.total.irr, decimal));
    $('#ci_lower').text(roundTo(stats.total.lower95CI, decimal));
    $('#ci_upper').text(roundTo(stats.total.upper95CI, decimal));
};
const populateTableCounts = () => {
    // display counts for r1c1,r1c2,r2c1,r2c2
    totalCounts.forEach((counts, id) => $(`#${id}`).text(counts));
};
const populateStatsTable = (decimal) => {
    const tbody = document.querySelector('#stats tbody');
    tbody.innerHTML = '';

    const indiv = stats.indiv;
    indiv.forEach((stats, site) => {
        const row = tbody.insertRow(-1);
        const data = [
            site,
            stats.r1c1, stats.r1c2, stats.r2c1, stats.r2c2,
            roundTo(stats.r1c3, decimal), roundTo(stats.r2c3, decimal),
            roundTo(stats.irr, decimal), roundTo(stats.lnirr, decimal), roundTo(stats.varlnirr, decimal),
            roundTo(stats.lower95CI, decimal), roundTo(stats.upper95CI, decimal)
        ];
        data.forEach((value, index) => {
            row.insertCell(index).innerHTML = value;
        });
    });
};
const populateSiteTable = (showSiteNames) => {
    $('#siteCounts').text(validSites.size);

    const tbody = document.querySelector('#siteNames tbody');
    tbody.innerHTML = '';

    const sites = showSiteNames ? [...validSites.keys()] : [...validSites.values()];
    sites.sort().forEach(name => {
        tbody.insertRow(-1).insertCell(0).innerHTML = name;
    });
};
const constructTableAndPlot = () => {
    computeStats();

    applyInputLabels();

    populateTableCounts();
    populateSiteTable($('#showSiteNames').prop('checked'));

    let decimal = parseInt($('#decimal').val());
    decimal = (decimal >= 1 && decimal <= 6) ? decimal : 2;
    populateTableProbabilities(decimal);
    populateStatsTable(decimal);
};

const readInData = (callback) => {
    dataFileRawData.clear();

    const tasks = [];
    dataFiles.forEach((file, id) => {
        tasks.push(readIn2ColumnRowDataTask(file, id, dataFileRawData));
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
    }
};

const generateTableAndPlot = () => {
    if (!$('#inputLabels').valid()) {
        return false;
    }
    if (dataFiles.size < 4) {
        (new bootstrap.Modal('#fileRequired')).show();
        return false;
    }

    validSites.clear();
    Promise.all(getValidSiteTasks()).then((siteNames) => {
        let sites = new Set();
        siteNames.forEach(siteName => {
            sites = sites.size > 0 ? sites.intersection(siteName) : sites.union(siteName);
        });

        const shuffledIndexes = shuffle([...Array(sites.size).keys()]);
        Array.from(sites).forEach((site, index) => validSites.set(site, `Site ${shuffledIndexes[index]}`));

        readInData(constructTableAndPlot);
    });

    return true;
};

const getSiteNameContents = () => {
    const content = [];

    content.push('"Site Name","Generic Site Name"');
    [...validSites.keys()].sort().forEach(site => {
        content.push(`"${site}","${validSites.get(site)}"`);
    });

    return content.join('\r\n');
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
const addLabelEventListeners = () => {
    // bind the side-label input event to update the display dynamically
    $('#rowLabelInput').on('input', () => $('.rowLabel').text($('#rowLabelInput').val()));
    $('#row1LabelInput').on('input', () => $('.row1Label').text($('#row1LabelInput').val()));
    $('#row2LabelInput').on('input', () => $('.row2Label').text($('#row2LabelInput').val()));

    // bind the top-label input event to update the display dynamically
    $('#colLabelInput').on('input', () => $('.colLabel').text($('#colLabelInput').val()));
    $('#col1LabelInput').on('input', () => $('.col1Label').text($('#col1LabelInput').val()));
    $('#col2LabelInput').on('input', () => $('.col2Label').text($('#col2LabelInput').val()));
    $('#col3LabelInput').on('input', () => $('.col3Label').text($('#col3LabelInput').val()));
    $('#col4LabelInput').on('input', () => $('.col4Label').text($('#col4LabelInput').val()));
};
const addWizardEventListeners = () => {
    $('#nextStep').on('click', () => {
        if (generateTableAndPlot()) {
            const nextTab = $('.nav-link.active').parent().next().find('button');
            nextTab.removeClass('disabled');

            (new bootstrap.Tab(nextTab)).show();
        }
    });

    $('#prevStep').on('click', () => {
        const prevTab = $('.nav-link.active').parent().prev().find('button');

        (new bootstrap.Tab(prevTab)).show();
    });
};
const addIncidenceRateRatioEventListeners = () => {
    $('#selectPatientCounts').on('change', () => {
        if (totalCounts.size >= 4) {
            computeCounts();
            constructTableAndPlot();
        }
    });
    $('#decimal').on('change', () => {
        let decimal = parseInt($('#decimal').val());
        decimal = (decimal >= 1 && decimal <= 6) ? decimal : 2;
        populateTableProbabilities(decimal);
        populateStatsTable(decimal);
    });
};
const addSiteNameEventListeners = () => {
    $('#showSiteNames').on('change', () => populateSiteTable($('#showSiteNames').prop('checked')));

    $('#exportSiteNames').on('click', (event) => {
        event.preventDefault();

        const content = getSiteNameContents();
        const blob = new Blob([content], {type: 'text/csv;charset=utf-8;'});

        const downloadLink = document.createElement("a");
        downloadLink.download = 'table1_sites.csv';
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.click();
    });
};
const addEventListeners = () => {
    addFileDrapDropEventListeners();
    addFileSelectEventListeners();
    addLabelEventListeners();
    addWizardEventListeners();
    addIncidenceRateRatioEventListeners();
    addSiteNameEventListeners();
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