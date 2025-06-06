const dropAreas = document.getElementsByClassName('dropArea');
const fileSelectors = document.getElementsByClassName('file_select');
const fileRequiredModal = new bootstrap.Modal('#fileRequired');

const patientCountsSelect = document.getElementById('selectPatientCounts');

const mapFiles = new Map();
const fileRawData = new Map();

const validSites = new Set();

const totalCounts = new Map();

const readIn2ColumnData = (csvFile, label, map) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            complete: function (results) {
                const counts = [];
                const lines = results.data;
                for (let i = 1; i < lines.length; i++) {
                    const data = lines[i];
                    if (data.length > 1) {
                        const site = data[0].trim();
                        const count = data[1].trim();
                        if (validSites.has(site)) {
                            counts.push(count);
                        }
                    }
                }
                map.set(label, counts);

                resolve();
            }
        });
    });
};
const loadData = (callback) => {
    fileRawData.clear();
    const tasks = [];
    mapFiles.forEach((file, id) => {
        tasks.push(readIn2ColumnData(file, id, fileRawData));
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

    const countsForTenOrLess = parseInt(patientCountsSelect.options[patientCountsSelect.selectedIndex].value);
    fileRawData.forEach((rawData, id) => {
        totalCounts.set(id, tallyCounts(rawData, countsForTenOrLess));
    });
};

const roundToThree = (number) => {
    return Number(number.toFixed(3));
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

    totalCounts.forEach((counts, id) => {
        $(`#${id}`).text(counts);
    });

    const r1c1 = totalCounts.get('r1c1');
    const r1c2 = totalCounts.get('r1c2');
    const r1c3 = (r1c2 / r1c1) * 100;
    const r2c1 = totalCounts.get('r2c1');
    const r2c2 = totalCounts.get('r2c2');
    const r2c3 = (r2c2 / r2c1) * 100;

    // incidence rate ratio
    // (num of no exposure) / (num of exposure)
    const irr = r2c3 / r1c3;

    const stderr = Math.sqrt((1.0 / r1c2) + (1.0 / r2c2));
    const ci = 1.96 * stderr;
    const lower95CI = Math.exp(Math.log(irr) - ci);
    const upper95CI = Math.exp(Math.log(irr) + ci);

    $('#r1c3').text(roundToThree(r1c3));
    $('#r2c3').text(roundToThree(r2c3));
    $('#r2c4').text(`${roundToThree(irr)} (${roundToThree(lower95CI)}-${roundToThree(upper95CI)})`);

    $('#stderr').text(roundToThree(stderr));
    $('#irr').text(roundToThree(irr));
    $('#ci_lower').text(roundToThree(lower95CI));
    $('#ci_upper').text(roundToThree(upper95CI));


    $('#siteList').val(Array.from(validSites).join('\n'));
    $('#siteCounts').text(validSites.size);
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
        return;
    }
    if (mapFiles.size < 4) {
        fileRequiredModal.show();
        return;
    }

    validSites.clear();
    fileRawData.clear();
    Promise.all(getValidSiteTasks()).then((results) => {
        let sites = new Set();
        for (let i = 0; i < results.length; i++) {
            sites = sites.size > 0 ? sites.intersection(results[i]) : sites.union(results[i]);
        }
        sites.forEach(e => validSites.add(e));
        loadData(construct2x2Table);
    });

//    totalCounts.set('r1c1', 46575);
//    totalCounts.set('r1c2', 5640);
//    totalCounts.set('r2c1', 9165);
//    totalCounts.set('r2c2', 1185);
//    construct2x2Table();
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

const handlePatientCountChange = (event) => {
    if (totalCounts.size >= 4) {
        computeCounts();
        construct2x2Table();
    }
};

const resetData = () => {
    // clear data
    $('#siteList').val('');
    $('#siteCounts').text(0);

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

$(document).ready(function () {
    $('#generate_table').on('click', generateTable);

    patientCountsSelect.addEventListener('change', handlePatientCountChange, false);

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