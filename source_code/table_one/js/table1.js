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

const addVarFiles = new Map();
let numOfGroups = 1;
let groupVarIdNum = 0;

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

    for (let colNum = 1; colNum <= numOfCols; colNum++) {
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
    for (let colNum = 1; colNum <= numOfCols; colNum++) {
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
    for (let colNum = 1; colNum <= numOfCols; colNum++) {
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

    for (let colNum = 1; colNum <= numOfCols; colNum++) {
        tbodyRow.insertCell(colNum).innerText = `(n=${totalCounts[colNum]})`;
    }
};
const addTableOneRowDemographics = (table) => {
    const tbody = table.createTBody();
    tbody.className = 'table-group-divider';

    const tbodyRow = tbody.insertRow(-1);
    tbodyRow.className = 'table-info';
    tbodyRow.insertCell(0).outerHTML = `<th class="demo_label_text" colspan="${numOfCols + 1}">${$('#demo_label').text()}</th>`;

    addVariableDataToTable(tbody, demoVars, demoCounts, totalCounts);
};
const addTableOneRowComorbidity = (table) => {
    const tbody = table.createTBody();
    tbody.className = 'table-group-divider';

    const tbodyRow = tbody.insertRow(-1);
    tbodyRow.className = 'table-info';
    tbodyRow.insertCell(0).outerHTML = `<th class="comorb_label_text" colspan="${numOfCols + 1}">${$('#comorb_label').text()}</th>`;

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
    totalRawData = new Array(numOfCols + 1).fill(null);
    for (let colNum = 1; colNum <= numOfCols; colNum++) {
        tasks.push(readInRegularQueryData(totalFiles.get(`c${colNum}_total`), colNum, totalRawData));
    }
};
const getDemographicsCountsTasks = (tasks) => {
    demoRawData = new Array(numOfCols + 1).fill(null);
    demoVars = [];
    if (isBreakdownQuery) {
        for (let colNum = 1; colNum <= numOfCols; colNum++) {
            tasks.push(readInBreakdownQueryData(demoFiles.get(`c${colNum}_demo`), colNum, demoRawData, demoVars));
        }
    } else {
        for (let colNum = 1; colNum <= numOfCols; colNum++) {
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
    comorbRawData = new Array(numOfCols + 1).fill(null);
    comorbVars = [];
    for (let colNum = 1; colNum <= numOfCols; colNum++) {
        tasks.push(readInBreakdownQueryData(comorbFiles.get(`c${colNum}_comorb`), colNum, comorbRawData, comorbVars));
    }
};
const computeAggregateTotals = (countsForTenOrLess, rawData) => {
    const counts = new Array(numOfCols + 1).fill(0);
    for (let colNum = 1; colNum <= numOfCols; colNum++) {
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
    const counts = new Array(numOfCols + 1).fill(null);
    for (let colNum = 1; colNum <= numOfCols; colNum++) {
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

const moveToNextTab = () => {
    const nextTab = $('.nav-link.active').parent().next().find('button');
    nextTab.removeClass('disabled');

    (new bootstrap.Tab(nextTab)).show();
};
const moveToPreviousTab = () => {
    const prevTab = $('.nav-link.active').parent().prev().find('button');

    (new bootstrap.Tab(prevTab)).show();
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

const getCurrentMaxNumOfDemoVarFiles = () => {
    let maxVarItems = 0;
    for (let colNum = 1; colNum <= numOfCols; colNum++) {
        const files = demoVarFiles.get(`c${colNum}_demo`);
        if (files && (files.size > maxVarItems)) {
            maxVarItems = files.size;
        }
    }

    return maxVarItems;
};
const getCurrentMaxNumOfGroupVarFiles = (groupId) => {
    let maxVarItems = 0;

    const groupFiles = addVarFiles.get(groupId);
    if (groupFiles) {
        for (let colNum = 1; colNum <= numOfCols; colNum++) {
            const files = groupFiles.get(`${groupId}c${colNum}_addvar`);
            if (files && (files.size > maxVarItems)) {
                maxVarItems = files.size;
            }
        }
    }

    return maxVarItems;
};

const hasMetAllRequirements = () => {
    let isAllValid = true;

    // check files for total counts (required files)
    for (let colNum = 1; colNum <= numOfCols; colNum++) {
        const fileId = `c${colNum}_total`;
        const dropAreaId = `#${fileId}_droparea`;
        if (totalFiles.has(fileId)) {
            $(dropAreaId).removeClass('bg-danger-subtle');
        } else {
            $(dropAreaId).addClass('bg-danger-subtle');
            isAllValid = false;
        }
    }

    // check demographic files (optional files)
    if (isBreakdownQuery) {
        if (demoFiles.size > 0) {
            for (let colNum = 1; colNum <= numOfCols; colNum++) {
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
            const numOfVarsRequired = getCurrentMaxNumOfDemoVarFiles();
            for (let colNum = 1; colNum <= numOfCols; colNum++) {
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
        for (let colNum = 1; colNum <= numOfCols; colNum++) {
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
    if (addVarFiles.size > 0) {
        for (let groupNum = 1; groupNum <= numOfGroups; groupNum++) {
            const groupId = `g${groupNum}`;
            const groupFiles = addVarFiles.get(groupId);
            if (groupFiles && groupFiles.size > 0) {
                const numOfVarsRequired = getCurrentMaxNumOfGroupVarFiles(groupId);
                for (let colNum = 1; colNum <= numOfCols; colNum++) {
                    const fileId = `g${groupNum}c${colNum}_addvar`;
                    const dropAreaId = `#${fileId}_droparea`;
                    if (groupFiles.has(fileId)) {
                        const varFiles = groupFiles.get(fileId);
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
    }

    if (isAllValid) {
        $('#dataErrorMsg').hide();

        // clear all error in drop areas
        for (let colNum = 1; colNum <= numOfCols; colNum++) {
            $(`#c${colNum}_total_droparea`).removeClass('bg-danger-subtle');
            $(`#c${colNum}_demo_droparea`).removeClass('bg-danger-subtle');
            $(`#c${colNum}_comorb_droparea`).removeClass('bg-danger-subtle');
        }
        for (let groupNum = 1; groupNum <= numOfGroups; groupNum++) {
            for (let colNum = 1; colNum <= numOfCols; colNum++) {
                $(`#g${groupNum}c${colNum}_addvar_droparea`).removeClass('bg-danger-subtle');
            }
        }
    } else {
        $('#dataErrorMsg').show();
    }

    return isAllValid;
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

const isCurrentlyMetRequirements = () => {
    if (totalFiles.size !== numOfCols) {
        return false;
    }

    if (isBreakdownQuery) {
        if ((demoFiles.size > 0) && (demoFiles.size !== numOfCols)) {
            return false;
        }
    } else {
        if (demoVarFiles.size > 0) {
            if ((demoVarFiles.size === numOfCols)) {
                const numOfVarsRequired = getCurrentMaxNumOfDemoVarFiles();
                for (let colNum = 1; colNum <= numOfCols; colNum++) {
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

    if ((comorbFiles.size > 0) && (comorbFiles.size !== numOfCols)) {
        return false;
    }

    return true;
};

const removeGroupVariableErrorNotifications = (groupId) => {
    const groupFiles = addVarFiles.get(groupId);
    if (groupFiles) {
        const numOfVarsRequired = getCurrentMaxNumOfGroupVarFiles(groupId);

        // remove all error notification
        for (let colNum = 1; colNum <= numOfCols; colNum++) {
            const fileId = `${groupId}c${colNum}_addvar`;
            const files = groupFiles.get(fileId);
            if (files && (files.size === numOfVarsRequired)) {
                const dropAreaId = `#${fileId}_droparea`;
                $(dropAreaId).removeClass('bg-danger-subtle');
            }
        }
    }
};
const removeDemographicVariableErrorNotifications = () => {
    const numOfVarsRequired = getCurrentMaxNumOfDemoVarFiles();
    // remove all error notification
    for (let colNum = 1; colNum <= numOfCols; colNum++) {
        const fileId = `c${colNum}_demo`;
        const files = demoVarFiles.get(fileId);
        if (files && (files.size === numOfVarsRequired)) {
            const dropAreaId = `#${fileId}_droparea`;
            $(dropAreaId).removeClass('bg-danger-subtle');
        }
    }
};
const removeDemographicErrorNotifications = () => {
    // remove all error notifications if there's no data
    if (demoFiles.size === 0) {
        for (let colNum = 1; colNum <= numOfCols; colNum++) {
            const fileId = `c${colNum}_demo`;
            const dropAreaId = `#${fileId}_droparea`;
            $(dropAreaId).removeClass('bg-danger-subtle');
        }
    }
};
const removeComorbidityErrorNotifications = () => {
    // remove all error notifications if there's no data
    if (comorbFiles.size === 0) {
        for (let colNum = 1; colNum <= numOfCols; colNum++) {
            const fileId = `c${colNum}_comorb`;
            const dropAreaId = `#${fileId}_droparea`;
            $(dropAreaId).removeClass('bg-danger-subtle');
        }
    }
};

const removeFile = (trashObj) => {
    const elementId = trashObj.parentElement.parentElement.id;
    $(`#${elementId}`).empty();

    const fileId = elementId.split('_', 2).join('_');
    if (fileId.includes('total')) {
        totalFiles.delete(fileId);
    } else if (fileId.includes('demo')) {
        demoFiles.delete(fileId);
        removeDemographicErrorNotifications();
    } else if (fileId.includes('comorb')) {
        comorbFiles.delete(fileId);
        removeComorbidityErrorNotifications();
    }

    if (isCurrentlyMetRequirements()) {
        $('#dataErrorMsg').hide();
    }
};
const removeDemVar = (trashObj) => {
    const listItem = trashObj.parentElement;
    const varFileId = listItem.id;
    const fileId = varFileId.split('_', 2).join('_');

    // remove file
    const varFiles = demoVarFiles.get(fileId);
    if (varFiles) {
        varFiles.delete(varFileId);
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
    removeDemographicVariableErrorNotifications();
};
const removeGroupVar = (trashObj) => {
    const listItem = trashObj.parentElement;
    const varFileId = listItem.id;
    const fileId = varFileId.split('_', 2).join('_');

    const id = fileId.replace('_addvar', '');
    const pos = id.indexOf('c');
    const groupId = id.substring(0, pos);
    const columnId = id.substring(pos);

    // remove file
    let groupFiles = addVarFiles.get(groupId);
    if (groupFiles) {
        let varFiles = groupFiles.get(fileId);
        if (varFiles) {
            varFiles.delete(varFileId);
            if (varFiles.size === 0) {
                groupFiles.delete(fileId);
            }
        }

        if (groupFiles.size === 0) {
            addVarFiles.delete(groupId);
        }
    }

    // remove item from variable file list
    const list = trashObj.parentElement.parentElement;
    list.removeChild(listItem);
    if (list.children.length === 0) {
        list.classList.remove('mt-2');
    }

    removeExtraGroupVars(groupId);
    removeGroupVariableErrorNotifications(groupId);
};

const createFileDroppedHtml = (filename) => {
    return `
<div class="alert alert-info p-2 mb-0 mt-2" role="alert">
<i class="bi bi-file-earmark-arrow-up"></i> ${filename}
<a class="text-danger float-end" title="Delete" onclick="removeFile(this);"><i class="bi bi-trash3"></i></a>
</div>
`;
};

const saveInputData = (fileId, csvFile) => {
    // return if either does not exist
    if (!(fileId && csvFile)) {
        return;
    }

    const type = fileId.replace(/.*(?=_)/, '');
    switch (type) {
        case '_total':
            totalFiles.set(fileId, csvFile);

            $(`#${fileId}_filename`).html(createFileDroppedHtml(csvFile.name));
            break;
        case '_demo':
            if (isBreakdownQuery) {
                demoFiles.set(fileId, csvFile);

                $(`#${fileId}_filename`).html(createFileDroppedHtml(csvFile.name));
            } else {
                let varFileListId = `${fileId}_var`;
                let varFileId = `${varFileListId}_${++demVarIdNum}`;

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

            $(`#${fileId}_filename`).html(createFileDroppedHtml(csvFile.name));
            break;
        case '_addvar':
            const id = fileId.replace('_addvar', '');
            const pos = id.indexOf('c');
            const groupId = id.substring(0, pos);
            const columnId = id.substring(pos);

            const varFileListId = `${fileId}_var`;
            const varFileId = `${varFileListId}_${++groupVarIdNum}`;

            let groupFiles = addVarFiles.get(groupId);
            if (!groupFiles) {
                groupFiles = new Map();
                addVarFiles.set(groupId, groupFiles);
            }

            let varFiles = groupFiles.get(fileId);
            if (!varFiles) {
                varFiles = new Map();
                groupFiles.set(fileId, varFiles);
            }
            varFiles.set(varFileId, csvFile);

            // create list item for variable file
            let li = document.createElement('li');
            li.id = varFileId;
            li.className = 'list-group-item list-group-item-info bg-opacity-10 border border-info';
            li.innerHTML = `
<span><i class="bi bi-file-earmark-arrow-up"></i> ${csvFile.name}</span>
<a class="text-danger float-end" title="Delete" onclick="removeGroupVar(this);"><i class="bi bi-trash3"></i></a>
`;
            let ul = document.getElementById(`${varFileListId}_list`);
            ul.classList.add('mt-2');
            ul.appendChild(li);

            const rowNum = varFiles.size;
            const liVarNameId = `${groupId}_var_${rowNum}`;
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

            ul = document.getElementById(`${groupId}_var_list`);
            ul.classList.add('mt-2');
            ul.appendChild(li);

            addLabelEventListener(name);
            break;
    }

    // remove error alerts
    $(`#${fileId}_droparea`)
            .removeClass('bg-danger-subtle')
            .removeClass('highlight');

    if (isCurrentlyMetRequirements()) {
        $('#dataErrorMsg').hide();
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

const adjustDataType = () => {
    isBreakdownQuery = $('#demo_breakdown_query').is(':checked');
    if (isBreakdownQuery) {
        $('.query_type').text('Breakdown');

        for (let colNum = 1; colNum <= numOfCols; colNum++) {
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

        for (let colNum = 1; colNum <= numOfCols; colNum++) {
            $(`#c${colNum}_demo_filename`).text('');
        }
        demoFiles.clear();
    }
};

const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
};
const highlight = (event) => event.target.classList.add('highlight');
const unhighlight = (event) => event.target.classList.remove('highlight');
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

const addGroupFileDrapDropEventListeners = (groupNum, colNum) => {
    const groupDropArea = `#g${groupNum}c${colNum}_addvar_droparea`;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
        $(groupDropArea).on(event, preventDefaults);
    });

    // highlighting drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(event => {
        $(groupDropArea).on(event, highlight);
    });

    // remove highlighting from drop area when item is dropped
    ['dragleave'].forEach(event => {
        $(groupDropArea).on(event, unhighlight);
    });

    // file drop action
    ['drop'].forEach(event => {
        $(groupDropArea).on(event, handleFileDrop);
    });
};
const addGroupFileSelectEventListeners = (groupNum, colNum) => {
    const groupDropArea = `#g${groupNum}c${colNum}_addvar_droparea`;

    // file select action
    ['change'].forEach(event => {
        $(groupDropArea).on(event, handleFileSelect);
    });
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
    ['dragenter', 'dragover'].forEach(event => {
        $(totalDropArea).on(event, highlight);
        $(demoDropArea).on(event, highlight);
        $(comorbDropArea).on(event, highlight);
    });

    // remove highlighting from drop area when item is dropped
    ['dragleave'].forEach(event => {
        $(totalDropArea).on(event, unhighlight);
        $(demoDropArea).on(event, unhighlight);
        $(comorbDropArea).on(event, unhighlight);
    });

    // file drop action
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

    // file select action
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
const addGroupFileEventListeners = (groupNum, colNum) => {
    addGroupFileDrapDropEventListeners(groupNum, colNum);
    addGroupFileSelectEventListeners(groupNum, colNum);
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
    const name = `c${colNum}_total`;

    const column = tbody.rows[0].cells[colNum];
    column.classList.add('border', 'border-black', 'border-2');
    column.innerHTML = `
<div class="text-center align-middle p-4 dropArea" id="${name}_droparea">
    Drag &amp; Drop or
    <input class="position-absolute invisible" id="${name}_file" type="file" accept=".csv" />
    <label class="btn btn-success" for="${name}_file">Choose CSV File</label>
    <div class="mt-3" style="width: fit-content; margin-inline: auto;">(Regular Query)</div>
</div>
<div id="${name}_filename"></div>
`;
};
const addDemographicsColumn = (tbody, colNum) => {
    const name = `c${colNum}_demo`;

    const column = tbody.rows[0].cells[colNum];
    column.classList.add('border', 'border-black', 'border-2');
    column.innerHTML = `
<div class="text-center align-middle p-4 dropArea" id="${name}_droparea">
    Drag &amp; Drop or
    <input class="position-absolute invisible" id="${name}_file" type="file" accept=".csv" />
    <label class="btn btn-success" for="${name}_file">Choose CSV File</label>
    <div class="mt-3" style="width: fit-content; margin-inline: auto;">(<span class="query_type"></span> Query)</div>
</div>
<div id="${name}_filename"></div>
<ul class="list-group" id="${name}_var_list"></ul>
`;
};
const addComorbColumn = (tbody, colNum) => {
    const name = `c${colNum}_comorb`;

    const column = tbody.rows[0].cells[colNum];
    column.classList.add('border', 'border-black', 'border-2');
    column.innerHTML = `
<div class="text-center align-middle p-4 dropArea" id="${name}_droparea">
    Drag &amp; Drop or
    <input class="position-absolute invisible" id="${name}_file" type="file" accept=".csv" />
    <label class="btn btn-success" for="${name}_file">Choose CSV File</label>
    <div class="mt-3" style="width: fit-content; margin-inline: auto;">(Breakdown Query)</div>
</div>
<div id="${name}_filename"></div>
`;
};
const addGroupColumn = (tbody, colNum, groupNum) => {
    const name = `g${groupNum}c${colNum}_addvar`;

    const column = tbody.rows[0].cells[colNum];
    column.classList.add('border', 'border-black', 'border-2');
    column.innerHTML = `
<div class="text-center align-middle p-4 dropArea" id="${name}_droparea">
    Drag &amp; Drop or
    <input class="position-absolute invisible" id="${name}_file" type="file" accept=".csv" />
    <label class="btn btn-success" for="${name}_file">Choose CSV File</label>
    <div class="mt-3" style="width: fit-content; margin-inline: auto;">(Regular Query)</div>
</div>
<ul class="list-group" id="${name}_var_list"></ul>
`;
};
const addColumns = () => {
    const table = document.getElementById('tableInput');
    const tbodies = table.tBodies;
    for (let t = 0; t < tbodies.length; t++) {
        const rows = tbodies[t].rows;
        if (t === 4) {
            rows[0].cells[0].colSpan = numOfCols + 1;
        } else {
            for (let r = 0; r < rows.length; r++) {
                for (let c = currentNumOfCols; c < numOfCols; c++) {
                    rows[r].insertCell(-1);
                }
            }
        }
    }

    for (let colNum = currentNumOfCols + 1; colNum <= numOfCols; colNum++) {
        addLabelColumn(tbodies[0], colNum);
        addTotalColumn(tbodies[1], colNum);
        addDemographicsColumn(tbodies[2], colNum);
        addComorbColumn(tbodies[3], colNum);

        addFileEventListeners(colNum);

        const groupCounts = numOfGroups + 4;
        for (let i = 5, groupNum = 1; i <= groupCounts, groupNum <= numOfGroups; i++, groupNum++) {
            addGroupColumn(tbodies[i], colNum, groupNum);
            addGroupFileEventListeners(groupNum, colNum);
        }
    }
    adjustDataType();
};

const removeExtraDemographicVars = () => {
    const numOfVarsRequired = getCurrentMaxNumOfDemoVarFiles();
    let length = $('ul#demo_var_list li').length;
    while (length > numOfVarsRequired) {
        $('ul#demo_var_list li:last-child').remove();
        length--;
    }
};
const removeExtraGroupVars = (groupId) => {
    const numOfVarsRequired = getCurrentMaxNumOfGroupVarFiles(groupId);
    let length = $('ul#g1_var_list li').length;
    while (length > numOfVarsRequired) {
        $('ul#g1_var_list li:last-child').remove();
        length--;
    }
};

const removeColumns = () => {
    // remove columns
    const numOfColsToKeep = numOfCols + 1;
    const table = document.getElementById('tableInput');
    const tbodies = table.tBodies;
    for (let t = 0; t < tbodies.length; t++) {
        const rows = tbodies[t].rows;
        if (t === 4) {
            rows[0].cells[0].colSpan = numOfCols + 1;
        } else {
            for (let r = 0; r < rows.length; r++) {
                while (rows[r].cells.length > numOfColsToKeep) {
                    rows[r].deleteCell(-1);
                }
            }
        }
    }

    // remove previous data files
    let colNum = currentNumOfCols;
    while (colNum > numOfCols) {
        totalFiles.delete(`c${colNum}_total`);
        comorbFiles.delete(`c${colNum}_comorb`);

        const demoFileId = `c${colNum}_demo`;
        demoFiles.delete(demoFileId);
        demoVarFiles.delete(demoFileId);

        colNum--;
    }

    // remove demographic variables
    if (isBreakdownQuery) {
        removeDemographicErrorNotifications();
    } else {
        removeExtraDemographicVars();
        removeDemographicVariableErrorNotifications();
    }
    removeComorbidityErrorNotifications();
    for (let groupNum = 1; groupNum <= numOfGroups; groupNum++) {
        const groupId = `g${groupNum}`;

        const groupFiles = addVarFiles.get(groupId);
        if (groupFiles && groupFiles.size > 0) {
            colNum = currentNumOfCols;
            while (colNum > numOfCols) {
                groupFiles.delete(`g${groupNum}c${colNum}_addvar`);

                colNum--;
            }
        }

        removeExtraGroupVars(groupId);
        removeGroupVariableErrorNotifications(groupId);
    }

    if (isCurrentlyMetRequirements()) {
        $('#dataErrorMsg').hide();
    }
};

const adjustNumberOfColumns = () => {
    numOfCols = parseInt($('#numOfCols').val());
    if (currentNumOfCols < numOfCols) {
        addColumns();
    } else if (currentNumOfCols > numOfCols) {
        removeColumns();
    }
    currentNumOfCols = numOfCols;
};

const addLabelEventListener = (name) => {
    $(`#${name}`).on('dblclick', () => switchToEditMode(name));
    $(`#${name}_input`).on('focusout', () => switchToLabelMode(name));
    $(`#${name}_input`).on('keypress', event => saveOnEnter(event, name));
};

const addWizardEventListeners = () => {
    $('#nextStep').on('click', generateTableOne);
    $('#prevStep').on('click', moveToPreviousTab);
};
const addLabelEventListeners = () => {
    for (let i = 1; i <= numOfCols; i++) {
        addLabelEventListener(`c${i}_label`);
    }

    addLabelEventListener('total_label');
    addLabelEventListener('demo_label');
    addLabelEventListener('comorb_label');

    for (let groupNum = 1; groupNum <= numOfGroups; groupNum++) {
        addLabelEventListener(`g${groupNum}_label`);
    }
};
const addSettingsEventListeners = () => {
    $('#numOfCols').on('change', adjustNumberOfColumns);
    $('input[name="datatype"]').on('change', adjustDataType);
    $('#selectPatientCounts').on('change', computeCounts);
};
const addEventListeners = () => {
    addWizardEventListeners();
    addLabelEventListeners();
    addSettingsEventListeners();

    for (let colNum = 1; colNum <= numOfCols; colNum++) {
        addFileEventListeners(colNum);
    }
    for (let groupNum = 1; groupNum <= numOfGroups; groupNum++) {
        for (let colNum = 1; colNum <= numOfCols; colNum++) {
            addGroupFileEventListeners(groupNum, colNum);
        }
    }

    $('#input_labels').on('submit', preventDefaults);
};

const resetToDefault = () => {
    $('#numOfCols option').eq(0).prop('selected', true);
    $('#selectPatientCounts option').eq(10).prop('selected', true);
    $('#demo_breakdown_query').prop('checked', true);
    //    $('#demo_reg_query').prop('checked', true);

    numOfCols = parseInt($('#numOfCols').val());
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

    numOfGroups = 1;
    groupVarIdNum = 0;
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