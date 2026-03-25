const dropAreas = document.getElementsByClassName('dropArea');
const fileSelectors = document.getElementsByClassName('file_select');
const fileRequiredModal = new bootstrap.Modal('#fileRequired');

const patientCountsSelect = document.getElementById('selectPatientCounts');
const decimalInput = document.getElementById('decimal');
const exportSiteNames = document.getElementById('exportSiteNames');

const mapFiles = new Map();
const fileRawData = new Map();

const tableSiteRawCounts = new Map();
const tableSiteCounts = new Map();

const validSites = new Set();
const validSiteMap = new Map();

const totalCounts = new Map();

const data = {
    table: {
        r1c1: 0,
        r1c2: 0,
        r1c3: 0,
        r2c1: 0,
        r2c2: 0,
        r2c3: 0
    },
    stats: {
        irr: 0,
        stderr: 0,
        ci: 0,
        lower95CI: 0,
        upper95CI: 0
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

const readIn2ColumnData = (csvFile, label, fileRawDataMap, tableSiteRawCountsMap) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            complete: function (results) {
                const siteCounts = new Map();
                const counts = [];
                const lines = results.data;
                for (let i = 1; i < lines.length; i++) {
                    const data = lines[i];
                    if (data.length > 1) {
                        const site = data[0].trim();
                        const count = data[1].trim();
                        if (validSites.has(site)) {
                            counts.push(count);
                            siteCounts.set(site, count);
                        }
                    }
                }
                fileRawDataMap.set(label, counts);
                tableSiteRawCountsMap.set(label, siteCounts);

                resolve();
            }
        });
    });
};
const loadData = (callback) => {
    fileRawData.clear();
    tableSiteRawCounts.clear();

    const tasks = [];
    mapFiles.forEach((file, id) => {
        // initialize table-site counts
        tableSiteRawCounts.set(id, new Map());

        // add tasks
        tasks.push(readIn2ColumnData(file, id, fileRawData, tableSiteRawCounts));
    });

    Promise.all(tasks).then(() => {
        computeCounts();
        callback();
    });
};

const getColumnDataValidSiteTask = (csvFile) => {
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
const getValidSiteTasks = () => {
    const tasks = [];
    mapFiles.forEach((file, id) => {
        tasks.push(getColumnDataValidSiteTask(file));
    });

    return tasks;
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
    tableSiteCounts.clear();

    const countsForTenOrLess = parseInt(patientCountsSelect.options[patientCountsSelect.selectedIndex].value);
    fileRawData.forEach((rawData, id) => {
        // get the counts for the table sites
        const rawCountsMap = new Map();
        for (const [site, rawCounts] of tableSiteRawCounts.get(id)) {
            rawCountsMap.set(site, (rawCounts === '10 patients or fewer') ? countsForTenOrLess : parseInt(rawCounts));
        }
        tableSiteCounts.set(id, rawCountsMap);

        totalCounts.set(id, tallyCounts(rawData, countsForTenOrLess));
    });
};

const roundTo = (number, decimal) => {
    return Number(number.toFixed(decimal));
};
const construct2x2Table = () => {
    $('#tableColumnLabel').text($('#mainColumnLabel').text());
    $('#tableColumn1Label').text($('#column1Label').text());
    $('#tableColumn2Label').text($('#column2Label').text());
    $('#tableColumn3Label').text($('#column3Label').text());
    $('#tableColumn4Label').text($('#column4Label').text());

    $('#tableRowLabel').text($('#mainRowLabel').text());
    $('#tableRow1Label').text($('#row1Label').text());
    $('#tableRow2Label').text($('#row2Label').text());

    // display counts for r1c1,r1c2,r2c1,r2c2
    totalCounts.forEach((counts, id) => {
        $(`#${id}`).text(counts);
    });

    data.table.r1c1 = totalCounts.get('r1c1');
    data.table.r1c2 = totalCounts.get('r1c2');
    data.table.r1c3 = (data.table.r1c2 / data.table.r1c1) * 100;
    data.table.r2c1 = totalCounts.get('r2c1');
    data.table.r2c2 = totalCounts.get('r2c2');
    data.table.r2c3 = (data.table.r2c2 / data.table.r2c1) * 100;

    // incidence rate ratio
    // (num of no exposure) / (num of exposure)
    data.stats.irr = data.table.r2c3 / data.table.r1c3;

    data.stats.stderr = Math.sqrt((1.0 / data.table.r1c2) + (1.0 / data.table.r2c2));
    data.stats.ci = 1.96 * data.stats.stderr;
    data.stats.lower95CI = Math.exp(Math.log(data.stats.irr) - data.stats.ci);
    data.stats.upper95CI = Math.exp(Math.log(data.stats.irr) + data.stats.ci);

    loadTableData();
    loadSiteNames(document.getElementById('realSiteNames').checked);
};

const loadTableData = () => {
    const decimal = parseInt(decimalInput.value);

    $('#r1c3').text(roundTo(data.table.r1c3, decimal));
    $('#r2c3').text(roundTo(data.table.r2c3, decimal));
    $('#r2c4').text(`${roundTo(data.stats.irr, decimal)} (${roundTo(data.stats.lower95CI, decimal)}-${roundTo(data.stats.upper95CI, decimal)})`);

    $('#stderr').text(roundTo(data.stats.stderr, decimal));
    $('#irr').text(roundTo(data.stats.irr, decimal));
    $('#ci_lower').text(roundTo(data.stats.lower95CI, decimal));
    $('#ci_upper').text(roundTo(data.stats.upper95CI, decimal));
};
const loadSiteNames = (showSiteNames) => {
    $('#siteCounts').text(validSites.size);

    $('#siteNames tbody').empty();
    const siteNamesTbody = document.querySelector('#siteNames tbody');
    const names = showSiteNames ? [...validSiteMap.keys()] : [...validSiteMap.values()];
    names.sort().forEach(name => {
        const row = siteNamesTbody.insertRow(-1);
        row.insertCell(0).innerHTML = name;
    });
};

const saveInputData = (fileId, csvFile) => {
    fileId = fileId.trim();
    if (fileId && csvFile) {
        mapFiles.set(fileId, csvFile);

        const htmlCode = `<div class="alert alert-success" role="alert">
        <i class="bi bi-file-earmark-arrow-up"></i> ${csvFile.name}
</div>`;

        $(`#filename_${fileId}`).html(htmlCode);
    }
};

const generateTable = () => {
    if (!$('#label_inputs').valid()) {
        return false;
    }
    if (mapFiles.size < 4) {
        fileRequiredModal.show();
        return false;
    }

    validSites.clear();
    validSiteMap.clear();
    fileRawData.clear();
    Promise.all(getValidSiteTasks()).then((results) => {
        let sites = new Set();
        for (let i = 0; i < results.length; i++) {
            sites = sites.size > 0 ? sites.intersection(results[i]) : sites.union(results[i]);
        }
        sites.forEach(e => validSites.add(e));

        // map all valid site names to generic site names
        const shuffledIndexes = shuffle([...Array(validSites.size).keys()]);
        Array.from(validSites).forEach((site, index) => {
            validSiteMap.set(site, `Site ${shuffledIndexes[index]}`);
        });

        loadData(construct2x2Table);
    });

//    totalCounts.set('r1c1', 46575);
//    totalCounts.set('r1c2', 5640);
//    totalCounts.set('r2c1', 9165);
//    totalCounts.set('r2c2', 1185);
//    construct2x2Table();

    return true;
};

/**
 * Prevent default drag behaviors.
 */
const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
};
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
    for (const dropArea of dropAreas) {
        dropArea.addEventListener(event, preventDefaults, false);
    }
});

/**
 * Highlighting drop area when item is dragged over it.
 */
const highlight = (event) => event.target.classList.add('highlight');
['dragenter', 'dragover'].forEach(event => {
    for (const dropArea of dropAreas) {
        dropArea.addEventListener(event, highlight, false);
    }
});

/**
 * Remove highlighting from drop area when item is dropped.
 */
const unhighlight = (event) => event.target.classList.remove('highlight');
['dragleave'].forEach(event => {
    for (const dropArea of dropAreas) {
        dropArea.addEventListener(event, unhighlight, false);
    }
});

const getSiteNameContents = () => {
    const content = [];

    content.push('"Site Name","Generic Site Name"');
    [...validSiteMap.keys()].sort().forEach(name => {
        content.push(`"${name}","${validSiteMap.get(name)}"`);
    });

    return content.join('\r\n');
};

const handleExportSiteNames = (event) => {
    event.preventDefault();

    const content = getSiteNameContents();
    const blob = new Blob([content], {type: 'text/csv;charset=utf-8;'});

    const downloadLink = document.createElement("a");
    downloadLink.download = 'table1_sites.csv';
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.click();
};
const handleDrop = (event) => {
    if (event.dataTransfer.items) {
        // use DataTransferItemList interface to access the file(s)
        [...event.dataTransfer.items].forEach((item, i) => {
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
        [...event.dataTransfer.files].forEach((file, i) => {
            const fileId = event.target.id.replace('droparea_', '');
            saveInputData(fileId, file);
        });
    }
};
['drop'].forEach(event => {
    for (const dropArea of dropAreas) {
        dropArea.addEventListener(event, handleDrop, false);
    }
});

const handleFileSelect = (event) => {
    if (event.target.files.length > 0) {
        const fileId = event.target.id.replace('file_', '');
        saveInputData(fileId, event.target.files[0]);
    }
    event.target.value = "";
};
for (const fileSelector of fileSelectors) {
    fileSelector.addEventListener('change', handleFileSelect, false);
}

const updateMainRowLabel = () => {
    const inputValue = $('#mainRowLabelInput').val();
    $('#mainRowLabel').text(inputValue);
};
const updateRow1Label = () => {
    const inputValue = $('#row1LabelInput').val();
    $('#row1Label').text(inputValue);
};
const updateRow2Label = () => {
    const inputValue = $('#row2LabelInput').val();
    $('#row2Label').text(inputValue);
};

const updateMainColumnLabel = () => {
    const inputValue = $('#mainColumnLabelInput').val();
    $('#mainColumnLabel').text(inputValue);
};
const updateColumn1Label = () => {
    const inputValue = $('#column1LabelInput').val();
    $('#column1Label').text(inputValue);
};
const updateColumn2Label = () => {
    const inputValue = $('#column2LabelInput').val();
    $('#column2Label').text(inputValue);
};
const updateColumn3Label = () => {
    const inputValue = $('#column3LabelInput').val();
    $('#column3Label').text(inputValue);
};

const updateColumn4Label = () => {
    const inputValue = $('#column4LabelInput').val();
    $('#column4Label').text(inputValue);
};

const handlePatientCountChange = () => {
    if (totalCounts.size >= 4) {
        computeCounts();
        construct2x2Table();
    }
};

const resetData = () => {
    validSites.clear();
    validSiteMap.clear();

    // clear data
    $('#siteCounts').text(0);

    $('#siteNames tbody').empty();

    // bind the side-label input event to update the display dynamically
    $('#mainRowLabelInput').on('input', updateMainRowLabel);
    $('#row1LabelInput').on('input', updateRow1Label);
    $('#row2LabelInput').on('input', updateRow2Label);

    // bind the top-label input event to update the display dynamically
    $('#mainColumnLabelInput').on('input', updateMainColumnLabel);
    $('#column1LabelInput').on('input', updateColumn1Label);
    $('#column2LabelInput').on('input', updateColumn2Label);
    $('#column3LabelInput').on('input', updateColumn3Label);
    $('#column4LabelInput').on('input', updateColumn4Label);

    // update side labels
    updateMainRowLabel();
    updateRow1Label();
    updateRow2Label();

    // update top labels
    updateMainColumnLabel();
    updateColumn1Label();
    updateColumn2Label();
    updateColumn3Label();
    updateColumn4Label();
};

const handleNextStep = () => {
    if (generateTable()) {
        const activeTab = document.querySelector(".nav-link.active");
        const nextTab = activeTab.parentElement.nextElementSibling.querySelector("button");

        nextTab.classList.remove("disabled"); // Enable next step
        (new bootstrap.Tab(nextTab)).show();
    }
};
const handlePreviousStep = () => {
    const activeTab = document.querySelector(".nav-link.active");
    const prevTab = activeTab.parentElement.previousElementSibling.querySelector("button");

    (new bootstrap.Tab(prevTab)).show();
};

$(document).ready(function () {
    $('#generate_table').on('click', generateTable);

    $('#nextStep').on('click', handleNextStep);
    $('#prevStep').on('click', handlePreviousStep);

    patientCountsSelect.addEventListener('change', handlePatientCountChange, false);
    decimalInput.addEventListener('change', loadTableData, false);
    exportSiteNames.addEventListener('click', handleExportSiteNames, false);

    $('input[id="realSiteNames"]').on('change', function () {
        loadSiteNames(document.getElementById('realSiteNames').checked);
    });

    $('#label_inputs').validate({
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