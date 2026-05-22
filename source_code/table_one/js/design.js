const validSites = new Map();
const totalFiles = new Map();
let totalRawData = [];
let totalCounts = [];

const demoFiles = new Map();
const demoVarFiles = new Map();
const demoVarNames = new Set();
let demoRawData = [];
let demoCounts = [];
let demoVars = [];
let demVarIdNum = 0;

const comorbFiles = new Map();
let comorbRawData = [];
let comorbCounts = [];
let comorbVars = [];

const varsToExclude = [
    'Race Middle Eastern or North African'
];
const excludedVars = new Set(varsToExclude.map(item => item
            .replace('Demographic Distribution by', '')
            .replace('NIH Enrollment', '')
            .trim()));

let numOfCols = 0;
let currentNumOfCols = 0;

let isBreakdownQuery = true;

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
const getRegularQueryValidSitesTask = (csvFile) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            complete: function (results) {
                const sitesIncluded = new Set();
                const lines = results.data;
                for (let i = 1; i < lines.length; i++) {
                    const data = lines[i];
                    if (data.length > 1) {
                        const site = data[0].trim();
                        const count = data[1].trim().toLowerCase();
                        if (count === '10 patients or fewer' || !isNaN(count)) {
                            sitesIncluded.add(site);
                        }
                    }
                }

                resolve(sitesIncluded);
            }
        });
    });
};
const getBreakdownQueryValidSitesTask = (csvFile) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            complete: function (results) {
                const sitesIncluded = new Set();
                const rows = results.data;
                if (rows.length > 1) {
                    const sites = rows[0];
                    for (let r = 2; r < rows.length; r++) {
                        const cols = rows[r];
                        if (cols.length === sites.length) {
                            const variable = cols[0]
                                    .replace('Demographic Distribution by', '')
                                    .replace('NIH Enrollment', '')
                                    .trim();
                            if (excludedVars.has(variable)) {
                                continue;
                            }

                            for (let c = 2; c < cols.length; c++) {
                                const count = cols[c].trim().toLowerCase();
                                if (!(count === '10 patients or fewer' || !isNaN(count))) {
                                    sites[c] = null;
                                }
                            }
                        }
                    }

                    // get left over sites to include
                    for (let i = 2; i < sites.length; i++) {
                        if (sites[i]) {
                            sitesIncluded.add(sites[i].trim());
                        }
                    }
                }

                resolve(sitesIncluded);
            }
        });
    });
};
/**
 * A task for getting all sites that contain data (counts).
 *
 * @returns {Array|getValidSiteTasks.tasks}
 */
const getValidSiteTasks = () => {
    const tasks = [];

    for (let colNum = 1; colNum < numOfCols; colNum++) {
        // total counts
        tasks.push(getRegularQueryValidSitesTask(totalFiles.get(`c${colNum}_total`)));

        if (demoFiles.size > 0) {
            if (isBreakdownQuery) {
                tasks.push(getBreakdownQueryValidSitesTask(demoFiles.get(`c${colNum}_demo`)));
            } else {
                tasks.push(getRegularQueryValidSitesTask(demoFiles.get(`c${colNum}_demo`)));
            }
        }
    }

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

const readInRegularQueryData = (csvFile, index, rawData) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            complete: function (results) {
                const counts = [];
                const lines = results.data;
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.length > 1) {
                        const site = line[0].trim();
                        const data = line[1].trim().toLowerCase();
                        counts.push(validSites.has(site) ? data : 0);
                    }
                }
                rawData[index] = counts;

                resolve();
            }
        });
    });
};
const readInBreakdownQueryData = (csvFile, index, rawData, variables) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            complete: function (results) {
                const lines = results.data;
                // at least 2 lines
                if (lines.length > 1) {
                    // get valid columns (sites)
                    const sites = lines[0];
                    const isValidSites = new Array(sites.length).fill(false);
                    for (let i = 2; i < sites.length; i++) {
                        isValidSites[i] = validSites.has(sites[i].trim());
                    }

                    const needsToAddVariables = variables.length === 0;
                    const lineData = [];
                    for (let i = 2; i < lines.length; i++) {
                        const data = lines[i];
                        if (data.length !== sites.length) {
                            continue;
                        }

                        if (needsToAddVariables) {
                            const variable = data[0]
                                    .replace('Demographic Distribution by', '')
                                    .replace('NIH Enrollment', '')
                                    .replace('Charlson', '')
                                    .replace('Elixhauser', '')
                                    .replace('Comorbidities', '')
                                    .trim();
                            if (excludedVars.has(variable)) {
                                continue;
                            }

                            variables.push(variable);
                        }

                        const counts = new Array(data.length - 2).fill(0);
                        for (let j = 2; j < data.length; j++) {
                            counts.push(isValidSites[j] ? data[j].trim().toLowerCase() : 0);
                        }
                        lineData.push(counts);
                    }
                    rawData[index] = lineData;
                }
                resolve();
            }
        });
    });
};

const moveToNextTab = () => {
    const nextTab = $('.nav-link.active').parent().next().find('button');
    nextTab.removeClass('disabled');

    (new bootstrap.Tab(nextTab)).show();
};
const moveToPreviousTab = () => {
    const prevTab = $('.nav-link.active').parent().prev().find('button');

    (new bootstrap.Tab(prevTab)).show();
};

const addVariableDataToTable = (tbody, variables, counts, totals) => {
    const numOfVars = variables.length;

    // add new rows
    const tableRows = [];
    for (let i = 0; i < numOfVars; i++) {
        tableRows.push(tbody.insertRow(-1));
    }

    // add variable names
    for (let i = 0; i < numOfVars; i++) {
        tableRows[i].insertCell(0).outerHTML = `<td class="var_${i + 1}_label_text">${variables[i]}</td>`;
    }

    // add columns with counts
    for (let colNum = 1; colNum < numOfCols; colNum++) {
        for (let i = 0; i < numOfVars; i++) {
            const count = counts[colNum][i];
            const total = totals[colNum];
            const percentage = (total > 0) ? Math.round((count / total) * 100) : 0;
            tableRows[i].insertCell(colNum).innerHTML = `<span class="me-2">${count}</span> (${percentage}%)`;
        }
    }
};

// construct table 1
const addTableOneHeader = (thead) => {
    const theadRow = thead.insertRow(0);

    // first column header is empty
    theadRow.insertCell(0).outerHTML = '<th></th>';

    // add column labels
    for (let colNum = 1; colNum < numOfCols; colNum++) {
        const name = `c${colNum}_label`;
        const label = $(`#${name}`).text();
        theadRow.insertCell(colNum).outerHTML = `<th class="${name}_text">${label}</th>`;
    }
};
const addTableOneRowTotal = (tbody) => {
    const tbodyRow = tbody.insertRow(0);

    const id = 'total_label';
    const label = $(`#${id}`).text();
    tbodyRow.insertCell(0).outerHTML = `<th class="${id}_text">${label}</th>`;

    for (let colNum = 1; colNum < numOfCols; colNum++) {
        tbodyRow.insertCell(colNum).innerText = `(n=${totalCounts[colNum]})`;
    }
};
const addTableOneRowDemographics = (table) => {
    const tbody = table.createTBody();
    tbody.className = 'table-group-divider';

    const tbodyRow = tbody.insertRow(-1);
    tbodyRow.className = 'table-info';
    tbodyRow.insertCell(0).outerHTML = `<th class="demo_label_text" colspan="${numOfCols}">${$('#demo_label').text()}</th>`;

    addVariableDataToTable(tbody, demoVars, demoCounts, totalCounts);
};
const addTableOneRowComorbidity = (table) => {
    const tbody = table.createTBody();
    tbody.className = 'table-group-divider';

    const tbodyRow = tbody.insertRow(-1);
    tbodyRow.className = 'table-info';
    tbodyRow.insertCell(0).outerHTML = `<th class="comorb_label_text" colspan="${numOfCols}">${$('#comorb_label').text()}</th>`;

    addVariableDataToTable(tbody, comorbVars, comorbCounts, totalCounts);
};

const constructTableOne = () => {
    // clear table
    $('#tableOne').empty();

    // get table
    const table = document.getElementById('tableOne');
    const caption = table.createCaption();
    const thead = table.createTHead();
    const tbody = table.createTBody();

    caption.innerText = 'Table 1';
    tbody.className = 'table-group-divider';

    addTableOneHeader(thead);
    addTableOneRowTotal(tbody);
    if (demoFiles.size > 0 || demoVarFiles.size > 0) {
        addTableOneRowDemographics(table);
    }
    if (comorbFiles.size > 0) {
        addTableOneRowComorbidity(table);
    }
};

const getTotalCountsTasks = (tasks) => {
    totalRawData = new Array(numOfCols).fill(null);
    for (let colNum = 1; colNum < numOfCols; colNum++) {
        tasks.push(readInRegularQueryData(totalFiles.get(`c${colNum}_total`), colNum, totalRawData));
    }
};
const getDemographicsCountsTasks = (tasks) => {
    demoRawData = new Array(numOfCols).fill(null);
    demoVars = [];
    if (isBreakdownQuery) {
        for (let colNum = 1; colNum < numOfCols; colNum++) {
            tasks.push(readInBreakdownQueryData(demoFiles.get(`c${colNum}_demo`), colNum, demoRawData, demoVars));
        }
    } else {
        for (let colNum = 1; colNum < numOfCols; colNum++) {
            const varFiles = demoVarFiles.get(`c${colNum}_demo`);
            if (varFiles) {
                demoRawData[colNum] = new Array(varFiles.size).fill(null);
                let index = 0;
                for (const [key, file] of varFiles.entries()) {
                    tasks.push(readInRegularQueryData(file, index++, demoRawData[colNum]));
                }
            }
        }

        $('#demo_var_list li').each(function (index) {
            demoVars.push($(`#var_${index + 1}_label`).text());
        });
    }
};
const getComorbidityCountsTasks = (tasks) => {
    comorbRawData = new Array(numOfCols).fill(null);
    comorbVars = [];
    for (let colNum = 1; colNum < numOfCols; colNum++) {
        tasks.push(readInBreakdownQueryData(comorbFiles.get(`c${colNum}_comorb`), colNum, comorbRawData, comorbVars));
    }
};
const computeAggregateTotals = (countsForTenOrLess, rawData) => {
    const counts = new Array(numOfCols).fill(0);
    for (let colNum = 1; colNum < numOfCols; colNum++) {
        counts[colNum] = 0;
        rawData[colNum].forEach(count => {
            if (count === '10 patients or fewer') {
                counts[colNum] += countsForTenOrLess;
            } else {
                counts[colNum] += parseInt(count);
            }
        });
    }

    return counts;
};
const computeIndividualTotals = (countsForTenOrLess, rawData) => {
    const counts = new Array(numOfCols).fill(null);
    for (let colNum = 1; colNum < numOfCols; colNum++) {
        const lineData = rawData[colNum];
        counts[colNum] = new Array(lineData.length).fill(0);
        for (let varNum = 0; varNum < lineData.length; varNum++) {
            counts[colNum][varNum] = lineData[varNum]
                    .map(dat => (dat === '10 patients or fewer') ? countsForTenOrLess : dat)
                    .map(dat => isNaN(dat) ? 0 : parseInt(dat))
                    .reduce((n1, n2) => n1 + n2);
        }
    }

    return counts;
};

const computeCounts = () => {
    const countsForTenOrLess = parseInt($('#selectPatientCounts').val());
    totalCounts = computeAggregateTotals(countsForTenOrLess, totalRawData);
    if (demoFiles.size > 0 || demoVarFiles.size > 0) {
        demoCounts = computeIndividualTotals(countsForTenOrLess, demoRawData);
    }
    if (comorbFiles.size > 0) {
        comorbCounts = computeIndividualTotals(countsForTenOrLess, comorbRawData);
    }

    constructTableOne();
};

const loadData = () => {
    const tasks = [];
    getTotalCountsTasks(tasks);
    if (demoFiles.size > 0 || demoVarFiles.size > 0) {
        getDemographicsCountsTasks(tasks);
    }
    if (comorbFiles.size > 0) {
        getComorbidityCountsTasks(tasks);
    }

    Promise.all(tasks).then(() => {
        computeCounts();
        moveToNextTab();
    });
};
const generateTableOne = () => {
    if ($('#input_labels').valid() && hasMetAllRequirements()) {
        Promise.all(getValidSiteTasks()).then((siteNames) => {
            let sites = new Set();
            siteNames.forEach(siteName => {
                sites = sites.size > 0 ? sites.intersection(siteName) : sites.union(siteName);
            });

            validSites.clear();
            const shuffledIndexes = shuffle([...Array(sites.size).keys()]);
            Array.from(sites).forEach((site, index) => validSites.set(site, shuffledIndexes[index] + 1));

            loadData();
        });
    }
};

const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
};

const addLabelColumn = (tbody, colNum) => {
    const column = tbody.rows[0].cells[colNum];
    column.classList.add('text-center');
    column.innerHTML = `
<label for="c${colNum}_label_input">
<span class="h6 fw-bold" id="c${colNum}_label">Column ${colNum} <i class="bi bi-pencil"></i></span>
<input type="text" aria-label="Column ${colNum} label" class="form-control" id="c${colNum}_label_input" name="c${colNum}_label_input" value="" required="required" style="display: none;" />
</label>
`;

    addLabelEventListener(`c${colNum}_label`);
};
const addTotalColumn = (tbody, colNum) => {
    const column = tbody.rows[0].cells[colNum];
    column.classList.add('border', 'border-black', 'border-2');
    column.innerHTML = `
<div class="text-center align-middle p-4 dropArea" id="c${colNum}_total_droparea">
Drag &amp; Drop or
<input class="position-absolute invisible" id="c${colNum}_total_file" type="file" accept=".csv" />
<label class="btn btn-success" for="c${colNum}_total_file">Choose CSV File</label>
<div class="mt-3" style="width: fit-content; margin-inline: auto;">(Regular Query)</div>
</div>
<div id="c${colNum}_total_filename"></div>
`;
};
const addDemographicsColumn = (tbody, colNum) => {
    const column = tbody.rows[0].cells[colNum];
    column.classList.add('border', 'border-black', 'border-2');
    column.innerHTML = `
<div class="text-center align-middle p-4 dropArea" id="c${colNum}_demo_droparea">
Drag &amp; Drop or
<input class="position-absolute invisible" id="c${colNum}_demo_file" type="file" accept=".csv" />
<label class="btn btn-success" for="c${colNum}_demo_file">Choose CSV File</label>
<div class="mt-3" style="width: fit-content; margin-inline: auto;">(<span class="query_type"></span> Query)</div>
</div>
<div id="c${colNum}_demo_filename"></div>
<ul class="list-group" id="c${colNum}_demo_var_list"></ul>
`;
};
const addComorbColumn = (tbody, colNum) => {
    const column = tbody.rows[0].cells[colNum];
    column.classList.add('border', 'border-black', 'border-2');
    column.innerHTML = `
<div class="text-center align-middle p-4 dropArea" id="c${colNum}_comorb_droparea">
Drag &amp; Drop or
<input class="position-absolute invisible" id="c${colNum}_comorb_file" type="file" accept=".csv" />
<label class="btn btn-success" for="c${colNum}_comorb_file">Choose CSV File</label>
<div class="mt-3" style="width: fit-content; margin-inline: auto;">(<span class="query_type"></span> Query)</div>
</div>
<div id="c${colNum}_comorb_filename"></div>
`;
};

const removeExtraDemographicVars = () => {
    const numOfVarsRequired = calculateNumberOfVariablesRequired();
    let length = $('ul#demo_var_list li').length;
    while (length > numOfVarsRequired) {
        $('ul#demo_var_list li:last-child').remove();
        length--;
    }

    // remove error notification
    for (let colNum = 1; colNum < numOfCols; colNum++) {
        const fileId = `c${colNum}_demo`;
        const files = demoVarFiles.get(fileId);
        if (files.size === numOfVarsRequired) {
            const dropAreaId = `#${fileId}_droparea`;
            $(dropAreaId).removeClass('bg-danger-subtle');
        }
    }
};

const addColumns = () => {
    const table = document.getElementById('tableInput');
    const tbodies = table.tBodies;
    for (let t = 0; t < tbodies.length; t++) {
        const rows = tbodies[t].rows;
        for (let r = 0; r < rows.length; r++) {
            for (let c = currentNumOfCols; c < numOfCols; c++) {
                rows[r].insertCell(-1);
            }
        }
    }

    for (let colNum = currentNumOfCols; colNum < numOfCols; colNum++) {
        addLabelColumn(tbodies[0], colNum);
        addTotalColumn(tbodies[1], colNum);
        addDemographicsColumn(tbodies[2], colNum);
        addComorbColumn(tbodies[3], colNum);

        addFileEventListeners(colNum);
    }
    adjustDataType();
};
const removeColumns = () => {
    // remove previous data files
    let prevNumOfCols = currentNumOfCols;
    while (prevNumOfCols > numOfCols) {
        prevNumOfCols--;
        totalFiles.delete(`c${prevNumOfCols}_total`);
        comorbFiles.delete(`c${prevNumOfCols}_comorb`);

        const demoFileId = `c${prevNumOfCols}_demo`;
        demoFiles.delete(demoFileId);
        demoVarFiles.delete(demoFileId);
    }

    const table = document.getElementById('tableInput');
    const tbodies = table.tBodies;
    for (let t = 0; t < tbodies.length; t++) {
        const rows = tbodies[t].rows;
        for (let r = 0; r < rows.length; r++) {
            while (rows[r].cells.length > numOfCols) {
                rows[r].deleteCell(-1);
            }
        }
    }

    if (isBreakdownQuery) {
        const numOfRequiredFiles = numOfCols - 1;
        if (demoFiles.size === 0) {
            // remove error notification
            for (let colNum = 1; colNum < numOfCols; colNum++) {
                const fileId = `c${colNum}_demo`;
                const dropAreaId = `#${fileId}_droparea`;
                $(dropAreaId).removeClass('bg-danger-subtle');
            }
        }
    } else {
        removeExtraDemographicVars();
    }
};
const adjustNumberOfColumns = () => {
    numOfCols = parseInt($('#numOfCols').val()) + 1;
    if (currentNumOfCols < numOfCols) {
        addColumns();
    } else if (currentNumOfCols > numOfCols) {
        removeColumns();
    }
    currentNumOfCols = numOfCols;
};
const adjustPatientCountChange = () => {
    computeCounts();
};
const adjustDataType = () => {
    isBreakdownQuery = $('#demo_breakdown_query').is(':checked');
    if (isBreakdownQuery) {
        $('.query_type').text('Breakdown');

        for (let colNum = 1; colNum < numOfCols; colNum++) {
            const list = `#c${colNum}_demo_var_list`;
            $(list).empty();
            $(list).removeClass('mt-2');
        }
        demVarIdNum = 0;
        demoVarFiles.clear();

        const list = '#demo_var_list';
        $(list).empty();
        $(list).removeClass('mt-2');
    } else {
        $('.query_type').text('Regular');

        for (let colNum = 1; colNum < numOfCols; colNum++) {
            $(`#c${colNum}_demo_filename`).text('');
        }
        demoFiles.clear();
    }
};

const switchToEditMode = (name) => {
    const labelElement = $(`#${name}`);
    const inputElement = $(`#${name}_input`);

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
    const inputElement = $(`#${name}_input`);
    const textElement = $(`.${name}_text`);

    // update the label's text with the input's value
    const value = inputElement.val().trim();
    labelElement.html(`${value} <i class="bi bi-pencil"></i>`);
    textElement.text(value);

    if ($('#input_labels').valid()) {
        // Hide the input and show the label
        inputElement.hide();
        labelElement.show();

        $('#step2btn').prop('disabled', false);
        $('#nextStep').prop('disabled', false);
    } else {
        $('#step2btn').prop('disabled', true);
        $('#nextStep').prop('disabled', true);
    }
};
const saveOnEnter = (event, name) => {
    if (event.key === 'Enter') {
        switchToLabelMode(name);
    }
};

const isCurrentlyMetRequirements = () => {
    const numOfRequiredFiles = numOfCols - 1;
    if (totalFiles.size !== numOfRequiredFiles) {
        return false;
    }

    if (isBreakdownQuery) {
        if ((demoFiles.size > 0) && (demoFiles.size !== numOfRequiredFiles)) {
            return false;
        }
    } else {
        if (demoVarFiles.size > 0) {
            if ((demoVarFiles.size === numOfRequiredFiles)) {
                const numOfVarsRequired = calculateNumberOfVariablesRequired();
                for (let colNum = 1; colNum < numOfCols; colNum++) {
                    const fileId = `c${colNum}_demo`;
                    const varFiles = demoVarFiles.get(fileId);
                    if (varFiles.size !== numOfVarsRequired) {
                        return false;
                    }
                }
            } else {
                return false;
            }
        }
    }

    if ((comorbFiles.size > 0) && (comorbFiles.size !== numOfRequiredFiles)) {
        return false;
    }

    return true;
};
const hasMetAllRequirements = () => {
    let isAllValid = true;

    // check required files
    for (let colNum = 1; colNum < numOfCols; colNum++) {
        const fileId = `c${colNum}_total`;
        const dropAreaId = `#${fileId}_droparea`;
        if (totalFiles.has(fileId)) {
            $(dropAreaId).removeClass('bg-danger-subtle');
        } else {
            $(dropAreaId).addClass('bg-danger-subtle');
            $('#dataErrorMsg').show();

            isAllValid = false;
        }
    }

    // check optional files
    if (isBreakdownQuery) {
        if (demoFiles.size > 0) {
            for (let colNum = 1; colNum < numOfCols; colNum++) {
                const fileId = `c${colNum}_demo`;
                if (!demoFiles.has(fileId)) {
                    $(`#${fileId}_droparea`).addClass('bg-danger-subtle');
                    $('#dataErrorMsg').show();

                    isAllValid = false;
                }
            }
        }
    } else {
        if (demoVarFiles.size > 0) {
            const numOfVarsRequired = calculateNumberOfVariablesRequired();
            for (let colNum = 1; colNum < numOfCols; colNum++) {
                const fileId = `c${colNum}_demo`;
                const dropAreaId = `#${fileId}_droparea`;
                if (demoVarFiles.has(fileId)) {
                    const varFiles = demoVarFiles.get(fileId);
                    if (varFiles.size === numOfVarsRequired) {
                        $(dropAreaId).removeClass('bg-danger-subtle');
                    } else {
                        $(dropAreaId).addClass('bg-danger-subtle');
                        $('#dataErrorMsg').show();

                        isAllValid = false;
                    }
                } else {
                    $(dropAreaId).addClass('bg-danger-subtle');
                    $('#dataErrorMsg').show();

                    isAllValid = false;
                }
            }
        }
    }
    if (comorbFiles.size > 0) {
        for (let colNum = 1; colNum < numOfCols; colNum++) {
            const fileId = `c${colNum}_comorb`;
            const dropAreaId = `#${fileId}_droparea`;
            if (comorbFiles.has(fileId)) {
                $(dropAreaId).removeClass('bg-danger-subtle');
            } else {
                $(dropAreaId).addClass('bg-danger-subtle');
                $('#dataErrorMsg').show();

                isAllValid = false;
            }
        }
    }

    if (isAllValid) {
        $('#dataErrorMsg').hide();

        // clear all error in drop areas
        for (let colNum = 1; colNum < numOfCols; colNum++) {
            $(`#c${colNum}_total_droparea`).removeClass('bg-danger-subtle');
            $(`#c${colNum}_demo_droparea`).removeClass('bg-danger-subtle');
            $(`#c${colNum}_comorb_droparea`).removeClass('bg-danger-subtle');
        }
    }

    return isAllValid;
};

const calculateNumberOfVariablesRequired = () => {
    let maxVarItems = 0;
    for (let colNum = 1; colNum < numOfCols; colNum++) {
        const id = `c${colNum}_demo`;
        const files = demoVarFiles.get(id);
        if (files && (files.size > maxVarItems)) {
            maxVarItems = files.size;
        }
    }

    return maxVarItems;
};

const removeFile = (trashObj) => {
    const elementId = trashObj.parentElement.parentElement.id;
    $(`#${elementId}`).empty();

    const fileId = elementId.split('_', 2).join('_');
    if (fileId.includes('total')) {
        totalFiles.delete(fileId);
    } else if (fileId.includes('demo')) {
        demoFiles.delete(fileId);
    } else if (fileId.includes('comorb')) {
        comorbFiles.delete(fileId);
    }
};
const removeDemVar = (trashObj) => {
    const listItem = trashObj.parentElement;
    const listItemId = listItem.id;
    const fileId = listItemId.split('_', 2).join('_');

    // remove file
    const varFiles = demoVarFiles.get(fileId);
    if (varFiles) {
        varFiles.delete(listItemId);
        if (varFiles.size === 0) {
            demoVarFiles.delete(fileId);
        }
    }

    // remove item from variable file list
    const list = trashObj.parentElement.parentElement;
    list.removeChild(listItem);
    if (list.children.length === 0) {
        list.classList.remove('mt-2');
    }

    removeExtraDemographicVars();
};

const saveInputData = (fileId, csvFile) => {
    if (fileId && csvFile) {
        const type = fileId.replace(/.*(?=_)/, '');
        let htmlCode;
        switch (type) {
            case '_total':
                totalFiles.set(fileId, csvFile);

                htmlCode = `<div class="alert alert-info p-2 mb-0 mt-2" role="alert">
                                <i class="bi bi-file-earmark-arrow-up"></i> ${csvFile.name}
                                <a class="text-danger float-end" title="Delete" onclick="removeFile(this);"><i class="bi bi-trash3"></i></a>
                            </div>`;
                $(`#${fileId}_filename`).html(htmlCode);
                break;
            case '_demo':
                if (isBreakdownQuery) {
                    demoFiles.set(fileId, csvFile);

                    htmlCode = `<div class="alert alert-info p-2 mb-0 mt-2" role="alert">
                                    <i class="bi bi-file-earmark-arrow-up"></i> ${csvFile.name}
                                    <a class="text-danger float-end" title="Delete" onclick="removeFile(this);"><i class="bi bi-trash3"></i></a>
                                </div>`;
                    $(`#${fileId}_filename`).html(htmlCode);
                } else {
                    const varFileListId = `${fileId}_var`;
                    const varFileId = `${varFileListId}_${++demVarIdNum}`;

                    let varFiles = demoVarFiles.get(fileId);
                    if (!varFiles) {
                        varFiles = new Map();
                        demoVarFiles.set(fileId, varFiles);
                    }
                    varFiles.set(varFileId, csvFile);

                    // create list item for variable file
                    let li = document.createElement('li');
                    li.id = varFileId;
                    li.className = 'list-group-item list-group-item-info bg-opacity-10 border border-info';
                    li.innerHTML = `
                        <span><i class="bi bi-file-earmark-arrow-up"></i> ${csvFile.name}</span>
                        <a class="text-danger float-end" title="Delete" onclick="removeDemVar(this);"><i class="bi bi-trash3"></i></a>
                        `;
                    let ul = document.getElementById(`${varFileListId}_list`);
                    ul.classList.add('mt-2');
                    ul.appendChild(li);

                    const rowNum = varFiles.size;
                    const liVarNameId = `var_${rowNum}`;
                    li = document.getElementById(liVarNameId);
                    if (li) {
                        // already have variable name label
                        break;
                    }

                    const name = `${liVarNameId}_label`;
                    li = document.createElement('li');
                    li.id = liVarNameId;
                    li.className = 'list-group-item list-group-item-info bg-opacity-10 border border-info';
                    li.innerHTML = `
                        <label for="${name}_input">
                            <span class="h6" id="${name}">Variable ${rowNum} <i class="bi bi-pencil"></i></span>
                            <input type="text" aria-label="Demographic Variable" class="form-control" id="${name}_input" name="${name}_input" value="" required="required" style="display: none;" />
                        </label>
                        `;

                    ul = document.getElementById('demo_var_list');
                    ul.classList.add('mt-2');
                    ul.appendChild(li);

                    addLabelEventListener(name);
                }
                break;
            case '_comorb':
                comorbFiles.set(fileId, csvFile);

                htmlCode = `<div class="alert alert-info p-2 mb-0 mt-2" role="alert">
                                <i class="bi bi-file-earmark-arrow-up"></i> ${csvFile.name}
                                <a class="text-danger float-end" title="Delete" onclick="removeFile(this);"><i class="bi bi-trash3"></i></a>
                            </div>`;
                $(`#${fileId}_filename`).html(htmlCode);
                break;
        }

        // remove error alerts
        $(`#${fileId}_droparea`)
                .removeClass('bg-danger-subtle')
                .removeClass('highlight');

        if (isCurrentlyMetRequirements()) {
            $('#dataErrorMsg').hide();
        }
    }
};

const addWizardEventListeners = () => {
    $('#nextStep').on('click', generateTableOne);
    $('#prevStep').on('click', moveToPreviousTab);
};
const addLabelEventListener = (name) => {
    $(`#${name}`).on('dblclick', () => switchToEditMode(name));
    $(`#${name}_input`).on('focusout', () => switchToLabelMode(name));
    $(`#${name}_input`).on('keypress', event => saveOnEnter(event, name));
};
const addLabelEventListeners = () => {
    for (let i = 1; i <= numOfCols; i++) {
        addLabelEventListener(`c${i}_label`);
    }

    addLabelEventListener('total_label');
    addLabelEventListener('demo_label');
    addLabelEventListener('comorb_label');
};
const addSettingsEventListeners = () => {
    $('#numOfCols').on('change', adjustNumberOfColumns);
    $('#selectPatientCounts').on('change', adjustPatientCountChange);
    $('input[name="datatype"]').on('change', adjustDataType);
};
const addFileDrapDropEventListeners = (colNum) => {
    const totalDropArea = `#c${colNum}_total_droparea`;
    const demoDropArea = `#c${colNum}_demo_droparea`;
    const comorbDropArea = `#c${colNum}_comorb_droparea`;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
        $(totalDropArea).on(event, preventDefaults);
        $(demoDropArea).on(event, preventDefaults);
        $(comorbDropArea).on(event, preventDefaults);
    });

    // highlighting drop area when item is dragged over it
    const highlight = (event) => event.target.classList.add('highlight');
    ['dragenter', 'dragover'].forEach(event => {
        $(totalDropArea).on(event, highlight);
        $(demoDropArea).on(event, highlight);
        $(comorbDropArea).on(event, highlight);
    });

    // remove highlighting from drop area when item is dropped
    const unhighlight = (event) => event.target.classList.remove('highlight');
    ['dragleave'].forEach(event => {
        $(totalDropArea).on(event, unhighlight);
        $(demoDropArea).on(event, unhighlight);
        $(comorbDropArea).on(event, unhighlight);
    });

    // file drop action
    const handleFileDrop = (event) => {
        if (event.originalEvent.dataTransfer.items) {
            // use DataTransferItemList interface to access the file(s)
            [...event.originalEvent.dataTransfer.items].forEach(item => {
                // If dropped items aren't files, reject them
                if (item.kind === 'file' && item.type === 'text/csv') {
                    const fileId = event.target.id.replace('_droparea', '').trim();
                    saveInputData(fileId, item.getAsFile());
                }
            });
        } else {
            // use DataTransfer interface to access the file(s)
            [...event.originalEvent.dataTransfer.files].forEach(file => {
                if (file.type === 'text/csv') {
                    const fileId = event.target.id.replace('_droparea', '').trim();
                    saveInputData(fileId, file);
                }
            });
        }
    };
    ['drop'].forEach(event => {
        $(totalDropArea).on(event, handleFileDrop);
        $(demoDropArea).on(event, handleFileDrop);
        $(comorbDropArea).on(event, handleFileDrop);
    });
};
const addFileSelectEventListeners = (colNum) => {
    const totalDropArea = `#c${colNum}_total_droparea`;
    const demoDropArea = `#c${colNum}_demo_droparea`;
    const comorbDropArea = `#c${colNum}_comorb_droparea`;

    const handleFileSelect = (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            if (file.type === 'text/csv') {
                const fileId = event.target.id.replace('_file', '').trim();
                saveInputData(fileId, event.target.files[0]);
            }
        }
        event.target.value = "";
    };
    ['change'].forEach(event => {
        $(totalDropArea).on(event, handleFileSelect);
        $(demoDropArea).on(event, handleFileSelect);
        $(comorbDropArea).on(event, handleFileSelect);
    });
};
const addFileEventListeners = (colNum) => {
    addFileDrapDropEventListeners(colNum);
    addFileSelectEventListeners(colNum);
};
const addEventListeners = () => {
    addWizardEventListeners();
    addLabelEventListeners();
    addSettingsEventListeners();

    for (let colNum = 1; colNum < numOfCols; colNum++) {
        addFileEventListeners(colNum);
    }

    $('#input_labels').on('submit', preventDefaults);
};

const resetToDefault = () => {
    $('#numOfCols option').eq(0).prop('selected', true);
    $('#selectPatientCounts option').eq(10).prop('selected', true);
    $('#demo_breakdown_query').prop('checked', true);
//    $('#demo_reg_query').prop('checked', true);

    numOfCols = parseInt($('#numOfCols').val()) + 1;
    currentNumOfCols = 1;

    validSites.clear();

    totalFiles.clear();
    totalRawData = [];
    totalCounts = [];

    demoFiles.clear();
    demoVarFiles.clear();
    demoVarNames.clear();
    demoRawData = [];
    demoCounts = [];
    demoVars = [];

    comorbFiles.clear();
    comorbRawData = [];
    comorbCounts = [];
    comorbVars = [];
};

$(document).ready(function () {
    resetToDefault();
    addEventListeners();
    adjustNumberOfColumns();
    adjustDataType();

    $('#input_labels').validate({
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
});