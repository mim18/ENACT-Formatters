const patientCountsSelect = document.getElementById('selectPatientCounts');
const demographicRawData = new Map();
const dataCounts = new Map();
let numOfColumns = 0;
let numOfDemographicVars = 0;
let totalCounts = [];


/**
 * Tally all the counts in the data.
 * 
 * @param {type} rawData
 * @returns {Number}
 */
const tallyCounts = (rawData) => {
    const countsForTenOrLess = parseInt(patientCountsSelect.options[patientCountsSelect.selectedIndex].value);

    let count = 0;
    rawData.forEach(line => {
        const data = line.split(',');
        if (data.length === 2) {
            const dat = data[1].trim();
            if (dat === '10 patients or fewer') {
                count += countsForTenOrLess;
            } else if (!isNaN(dat)) {
                count += parseInt(dat);
            }
        }
    });

    return count;
};
const computeCounts = () => {
    // clear data
    totalCounts = Array.from({length: numOfColumns + 1}, () => 0);
    dataCounts.clear();

    for (let column = 1; column <= numOfColumns; column++) {
        for (let variable = 1; variable <= numOfDemographicVars; variable++) {
            const id = `demoVar${variable}Col${column}`;
            const count = tallyCounts(demographicRawData.get(id));

            dataCounts.set(id, count);

            totalCounts[column] += count;
        }
    }
};
/**
 * i2b2 query data format.
 * 
 * @param {type} csvFile
 * @param {type} label
 * @param {type} map
 * @returns {Promise}
 */
const readIn2ColumnData = (csvFile, label, map) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = [];
            event.target.result
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line !== '')
                    .forEach(line => data.push(line));
            map.set(label, data);

            resolve();
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(csvFile);
    });
};
/**
 * Read in demographic data from queries.
 * 
 * @param {type} readers
 * @returns {undefined}
 */
const getDemographicDataReaders = (readers) => {
    for (let column = 1; column <= numOfColumns; column++) {
        for (let variable = 1; variable <= numOfDemographicVars; variable++) {
            const id = `demoVar${variable}Col${column}`;

            const demographicFiles = document.getElementById(id).files;
            for (const file of demographicFiles) {
                readers.push(readIn2ColumnData(file, id, demographicRawData));
            }
        }
    }
};

/**
 * Load all data from input files.
 * 
 * @param {type} callback
 * @returns {undefined}
 */
const loadData = (callback) => {
    demographicRawData.clear();

    const readers = [];
    getDemographicDataReaders(readers);

    Promise.all(readers).then(() => {
        computeCounts();
        callback();
    });
};

const createColumnInput = (i) => {
    const id = `column${i}`;

    // <div class="row g-2 align-items-center"></div>
    const rowDiv = document.createElement('div');
    rowDiv.className = 'row g-2 align-items-center mb-3';
    rowDiv.innerHTML = `
<div class="col-auto">
    <label for="${id}" class="col-form-label fw-bold">Column ${i}:</label>
</div>
<div class="col-auto">
    <input type="text" class="form-control" id="${id}" name="${id}" required="required" />
</div>
`;

    return rowDiv;
};
const createVarInput = (i) => {
    const id = `demoVar${i}`;

    // <div class="row g-2 align-items-center"></div>
    const rowDiv = document.createElement('div');
    rowDiv.className = 'row g-2 align-items-center mb-3';
    rowDiv.innerHTML = `
<div class="col-auto">
    <label for="${id}" class="col-form-label fw-bold">Variable ${i}:</label>
</div>
<div class="col-auto">
    <input type="text" class="form-control" id="${id}" name="${id}" required="required" />
</div>
`;

    return rowDiv;
};
const addTableOneHeader = (thead) => {
    const theadRow = thead.insertRow(0);

    // first column header is empty
    theadRow.insertCell(0).outerHTML = '<th></th>';

    // add column labels
    $('form#step2Form :input[id^=column]').each(function (index) {
        const val = $(this).val().trim();
        theadRow.insertCell(index + 1).outerHTML = `<th>${val}</th>`;
    });
};
const addTableOneRowTotal = (tbody) => {
    const tbodyRow = tbody.insertRow(0);

    tbodyRow.insertCell(0).outerHTML = '<th>Total</th>';

    const numOfCols = $('#numOfCols').val();
    for (let i = 1; i <= numOfCols; i++) {
        tbodyRow.insertCell(i).innerText = `(n=${totalCounts[i]})`;
//        tbodyRow.insertCell(i).innerHTML = `(n=<span class="fw-bold">${totalCounts[i]}</span>)`;
    }
};
const addDemographicCounts = (tbody) => {
    const tableRows = [];

    // add demographic variables
    for (let variable = 1; variable <= numOfDemographicVars; variable++) {
        const tbodyRow = tbody.insertRow(-1);
        tbodyRow.insertCell(0).outerHTML = `<td>${$(`#demoVar${variable}`).val()}</td>`;

        tableRows.push(tbodyRow);
    }

    for (let column = 1; column <= numOfColumns; column++) {
        let rowIndex = 0;
        for (let variable = 1; variable <= numOfDemographicVars; variable++) {
            const id = `demoVar${variable}Col${column}`;
            const count = dataCounts.get(id);
            const percentage = Math.round((count / totalCounts[column]) * 100);

            // add counts to table
            tableRows[rowIndex++].insertCell(column).innerHTML = `<span class="me-4">${count}</span> (${percentage}%)`;
        }
    }
};
const addTableOneRowDemographics = (table) => {
    const tbody = table.createTBody();
    tbody.className = 'table-group-divider';

    const tbodyRow = tbody.insertRow(-1);
    tbodyRow.className = 'table-info';
    tbodyRow.insertCell(0).outerHTML = `<th colspan="${numOfColumns + 1}">Demographics</th>`;

    addDemographicCounts(tbody);
};
const constructTableOne = () => {
    // clear table
    $('#tableOne').empty();

    // get table
    const table = document.getElementById('tableOne');

    // create table caption
    const caption = table.createCaption();
    caption.innerText = 'Table 1';

    // create table head
    const thead = table.createTHead();

    // create table body
    const tbody = table.createTBody();
    tbody.className = 'table-group-divider';

    addTableOneHeader(thead);
    addTableOneRowTotal(tbody);
    addTableOneRowDemographics(table);
};
const setTableDemographicVarNames = () => {
    const demVarInputs = document.getElementById('demVarInputs');

    const numOfVarInputs = demVarInputs.childElementCount;
    if (numOfVarInputs < numOfDemographicVars) {
        // add more var inputs
        for (let i = numOfVarInputs + 1; i <= numOfDemographicVars; i++) {
            demVarInputs.appendChild(createVarInput(i));
        }
    } else if (numOfVarInputs > numOfDemographicVars) {
        // remove var inputs
        let counts = numOfVarInputs;
        while (counts > numOfDemographicVars) {
            // remove the last column input
            demVarInputs.removeChild(demVarInputs.lastChild);
            counts--;
        }
    }
};
const setTableColumnNames = () => {
    const columnInputs = document.getElementById('columnInputs');

    const numOfColumnInputs = columnInputs.childElementCount;
    if (numOfColumnInputs < numOfColumns) {
        // add more column inputs
        for (let i = numOfColumnInputs + 1; i <= numOfColumns; i++) {
            columnInputs.appendChild(createColumnInput(i));
        }
    } else if (numOfColumnInputs > numOfColumns) {
        // remove column inputs
        let counts = numOfColumnInputs;
        while (counts > numOfColumns) {
            // remove the last column input
            columnInputs.removeChild(columnInputs.lastChild);
            counts--;
        }
    }

    // create a new array of lenght (numOfCols + 1) initialized with zeros.
    totalCounts = Array.from({length: numOfColumns + 1}, () => 0);
};
const setTableVariables = () => {
    $('#demVarFieldset').hide();

    const datatype = $('input[type="radio"][name="datatype"]:checked').val();
    switch (datatype) {
        case 'query':
            setTableDemographicVarNames();
            $('#demVarFieldset').show();
            break;
        case 'breakdown':
            break;
    }
};
const constructFileUpload = () => {
    const fileUpload = document.getElementById('fileUpload');
    fileUpload.innerHTML = '';

    for (let column = 1; column <= numOfColumns; column++) {
        const columnName = $(`#column${column}`).val();

        const fieldset = document.createElement('fieldset');
        fieldset.className = 'mb-3';

        const legend = document.createElement('legend');
        legend.innerText = columnName;
        fieldset.appendChild(legend);

        for (let variable = 1; variable <= numOfDemographicVars; variable++) {
            const id = `demoVar${variable}Col${column}`;
            const variableName = $(`#demoVar${variable}`).val();

            const div = document.createElement('div');
            div.className = 'row g-2 align-items-center mb-3';
            div.innerHTML = `<div class="col-auto">
    <label for="${id}" class="col-form-label fw-bold">${variableName}:</label>
</div>
<div class="col-auto">
    <input id="${id}" name="${id}" type="file" required="required" />
</div>
`;
            fieldset.appendChild(div);
        }

        fileUpload.appendChild(fieldset);
    }
};
const defineTableStructure = () => {
    setTableColumnNames();
    setTableVariables();
};
const showTab = (current, next) => {
    if (current === 0 && next === 1) {
        if (!$('#setup1Form').valid()) {
            return;
        }

        // set number of columns and number of variables
        numOfColumns = parseInt($('#numOfCols').val());
        const datatype = $('input[type="radio"][name="datatype"]:checked').val();
        switch (datatype) {
            case 'query':
                numOfDemographicVars = parseInt($('#numOfDemVars').val());
                break;
            default :
                numOfDemographicVars = 0;
        }

        defineTableStructure();
    } else if (current === 1 && next === 2) {
        if (!$('#step2Form').valid()) {
            return;
        }
        constructFileUpload();
    } else if (current === 2 && next === 3) {
        if (!$('#step3Form').valid()) {
            return;
        }
        loadData(constructTableOne);
    }

    // show the current tab and hide others
    const tabs = document.querySelectorAll('.tab-pane');
    tabs.forEach(tab => tab.classList.remove('show', 'active'));
    tabs[next].classList.add('show', 'active');

    // update the navigation links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        link.classList.add('disabled');
    });
    navLinks[next].classList.add('active');
    navLinks[next].classList.remove('disabled');
};

const showDemographicOpts = (datatype) => {
    switch (datatype) {
        case 'query':
            $('#demQueryOpts').show();
            $('#demBreakdownOpts').hide();

            $('#numOfDemVars').prop('required', true);
            $('#charlson').prop('required', false);
            $('#elixhauser').prop('required', false);
            break;
        case 'breakdown':
            $('#demBreakdownOpts').show();
            $('#demQueryOpts').hide();

            $('#numOfDemVars').prop('required', false);
            $('#charlson').prop('required', true);
            $('#elixhauser').prop('required', true);
            break;
    }
};
const handlePatientCountChange = (event) => {
    computeCounts();
    constructTableOne();
};
$(document).ready(function () {
    showDemographicOpts($('input[type="radio"][name="datatype"]:checked').val());
    $('input[type="radio"][name="datatype"]').on('change', function () {
        showDemographicOpts($(this).val());
    });

    patientCountsSelect.addEventListener('change', handlePatientCountChange, false);

    $('#setup1Form').validate({
        rules: {
            numOfCols: {
                required: true,
                min: 1,
                max: 10
            },
            numOfDemVars: {
                required: true,
                min: 1,
                max: 10
            }
        },
        errorClass: 'text-danger',
        highlight: function (input) {
            $(input).addClass('is-invalid');
        },
        unhighlight: function (input) {
            $(input).removeClass('is-invalid');
        }
    });
    $('#step2Form').validate({
        errorClass: 'text-danger',
        highlight: function (input) {
            $(input).addClass('is-invalid');
        },
        unhighlight: function (input) {
            $(input).removeClass('is-invalid');
        }
    });
    $('#step3Form').validate({
        errorClass: 'text-danger',
        highlight: function (input) {
            $(input).addClass('is-invalid');
        },
        unhighlight: function (input) {
            $(input).removeClass('is-invalid');
        }
    });
});