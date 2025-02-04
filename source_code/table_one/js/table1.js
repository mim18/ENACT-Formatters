/**
 * table1.js
 *
 * @description This file contains methods for formatting data for display and
 * export.
 * @author Kevin V. Bui
 * November 29, 2024
 */

const columnNames = new Set();
let columns = [];

let isQueryData = false;
const demoVarNames = new Set();
let demoVars = [];

let comorbidity = '';
let hasComorbidity = false;
let comorbidVars = [];

const groupNames = new Set();
let groups = [];
const groupVarInputs = new Map();
const groupVarNames = new Map();
let groupInputCounts = 0;

const demographicRawData = new Map();
const comorbidityRawData = new Map();
const groupVarRawData = new Map();

let totalCounts = [];

const validSites = new Set();

const patientCountsSelect = document.getElementById('selectPatientCounts');
const exportData = document.getElementById('exportData');

const dataCounts = new Map();

// data readers
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
const readInDemographicBreakdownData = (csvFile, label, map) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            complete: function (results) {
                const sites = new Set();
                const lines = results.data;
                // at least 1 line
                if (lines.length > 1) {
                    // get valid columns (sites)
                    const sites = lines[0];
                    const isValidSites = [false, false];
                    for (let i = 2; i < sites.length; i++) {
                        const site = sites[i].trim();
                        isValidSites.push(validSites.has(site));
                    }

                    const addVar = (demoVars.length === 0);
                    const lineData = [];
                    for (let i = 1; i < lines.length; i++) {
                        const data = lines[i];
                        // requires at least 3 columns
                        if (data.length < 2) {
                            continue;
                        }

                        if (addVar) {
                            const variable = data[0].trim();
                            if (!variable.startsWith('All Patients')) {
                                demoVars.push(variable.replace('Demographic Distribution by', '').trim());
                            }
                        }

                        const counts = [];
                        for (let j = 2; j < data.length; j++) {
                            if (isValidSites[j]) {
                                const count = data[j].trim();
                                counts.push(count);
                            }
                        }
                        lineData.push(counts);
                    }
                    map.set(label, lineData);
                }

                resolve();
            }
        });
    });
};
const readInComorbidityBreakdownData = (csvFile, label, map) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            complete: function (results) {
                const sites = new Set();
                const lines = results.data;
                // at least 1 line
                if (lines.length > 1) {
                    // get valid columns (sites)
                    const sites = lines[0];
                    const isValidSites = [false, false];
                    for (let i = 2; i < sites.length; i++) {
                        const site = sites[i].trim();
                        isValidSites.push(validSites.has(site));
                    }

                    const addVar = (comorbidVars.length === 0);
                    const lineData = [];
                    for (let i = 1; i < lines.length; i++) {
                        const data = lines[i];
                        // requires at least 3 columns
                        if (data.length < 2) {
                            continue;
                        }

                        if (addVar) {
                            const variable = data[0].trim();
                            if (!variable.startsWith('All Patients')) {
                                comorbidVars.push(variable.replace(comorbidity, '').trim());
                            }
                        }

                        const counts = [];
                        for (let j = 2; j < data.length; j++) {
                            if (isValidSites[j]) {
                                const count = data[j].trim();
                                counts.push(count);
                            }
                        }
                        lineData.push(counts);
                    }
                    map.set(label, lineData);
                }

                resolve();
            }
        });
    });
};

// data loading
const getDemographicData = (tasks) => {
    for (let colNum = 0; colNum < columns.length; colNum++) {
        if (isQueryData) {
            // get total counts
            const id = `totalCountsCol${colNum}`;
            const totalCountFiles = document.getElementById(id).files;
            for (const file of totalCountFiles) {
                tasks.push(readIn2ColumnData(file, id, demographicRawData));
            }

            // get the query demographic counts
            for (let varNum = 0; varNum < demoVars.length; varNum++) {
                const id = `demoVar${varNum}Col${colNum}`;
                const demographicFiles = document.getElementById(id).files;
                for (const file of demographicFiles) {
                    tasks.push(readIn2ColumnData(file, id, demographicRawData));
                }
            }
        } else {
            demoVars = [];

            // get the breakdown demographic counts
            const id = `demoBreakdownCol${colNum}`;
            const breakdownFiles = document.getElementById(id).files;
            for (const file of breakdownFiles) {
                tasks.push(readInDemographicBreakdownData(file, id, demographicRawData));
            }
        }
    }
};
const getComorbidityData = (tasks) => {
    for (let colNum = 0; colNum < columns.length; colNum++) {
        const id = `comorbidityCol${colNum}`;
        const breakdownFiles = document.getElementById(id).files;
        for (const file of breakdownFiles) {
            tasks.push(readInComorbidityBreakdownData(file, id, comorbidityRawData));
        }
    }
};
const getGroupVarData = (tasks) => {
    for (let colNum = 0; colNum < columns.length; colNum++) {
        for (let varGroupNum = 0; varGroupNum < groups.length; varGroupNum++) {
            const group = groups[varGroupNum];

            const groupVars = groupVarNames.get(group);
            const additionalVars = Array.from(groupVars);
            for (let varNum = 0; varNum < additionalVars.length; varNum++) {
                const id = `additionalVarCol${colNum}Group${varGroupNum}Var${varNum}`;

                const groupVarFiles = document.getElementById(id).files;
                for (const file of groupVarFiles) {
                    tasks.push(readIn2ColumnData(file, id, groupVarRawData));
                }
            }
        }
    }
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
const getBreakdownDataValidSiteTask = (csvFile) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            complete: function (results) {
                const sites = new Set();
                const lines = results.data;
                if (lines.length > 1) {
                    const names = lines[0];
                    const availability = lines[1];
                    for (let i = 2; i < names.length; i++) {
                        const site = names[i].trim();
                        const count = availability[i].trim();
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
const getDemographicValidSites = (tasks) => {
    for (let colNum = 0; colNum < columns.length; colNum++) {
        if (isQueryData) {
            // total counts
            const id = `totalCountsCol${colNum}`;
            const totalCountFiles = document.getElementById(id).files;
            for (const file of totalCountFiles) {
                tasks.push(getColumnDataValidSiteTask(file));
            }

            // query demographic counts
            for (let varNum = 0; varNum < demoVars.length; varNum++) {
                const id = `demoVar${varNum}Col${colNum}`;
                const demographicFiles = document.getElementById(id).files;
                for (const file of demographicFiles) {
                    tasks.push(getColumnDataValidSiteTask(file));
                }
            }
        } else {
            // get the breakdown demographic counts
            const id = `demoBreakdownCol${colNum}`;
            const breakdownFiles = document.getElementById(id).files;
            for (const file of breakdownFiles) {
                tasks.push(getBreakdownDataValidSiteTask(file));
            }
        }
    }
};
const getComorbidityValidSites = (tasks) => {
    for (let colNum = 0; colNum < columns.length; colNum++) {
        const id = `comorbidityCol${colNum}`;
        const breakdownFiles = document.getElementById(id).files;
        for (const file of breakdownFiles) {
            tasks.push(getBreakdownDataValidSiteTask(file));
        }
    }
};
const getGroupVarValidSites = (tasks) => {
    for (let colNum = 0; colNum < columns.length; colNum++) {
        for (let varGroupNum = 0; varGroupNum < groups.length; varGroupNum++) {
            const group = groups[varGroupNum];

            const groupVars = groupVarNames.get(group);
            const additionalVars = Array.from(groupVars);
            for (let varNum = 0; varNum < additionalVars.length; varNum++) {
                const id = `additionalVarCol${colNum}Group${varGroupNum}Var${varNum}`;

                const groupVarFiles = document.getElementById(id).files;
                for (const file of groupVarFiles) {
                    tasks.push(getColumnDataValidSiteTask(file));
                }
            }
        }
    }
};
const analyzeAndLoadData = (callback) => {
    // clear previous data
    validSites.clear();
    demographicRawData.clear();
    comorbidityRawData.clear();
    comorbidVars = [];

    // get valid sites
    const tasks = [];
    getDemographicValidSites(tasks);
    if (hasComorbidity) {
        getComorbidityValidSites(tasks);
    }
    if (groups.length > 0) {
        getGroupVarValidSites(tasks);
    }

    Promise.all(tasks).then((results) => {
        let sites = new Set();
        for (let i = 0; i < results.length; i++) {
            sites = sites.size > 0 ? sites.intersection(results[i]) : sites.union(results[i]);
        }
        sites.forEach(e => validSites.add(e));

        loadData(callback);
    });
};
const loadData = (callback) => {
    const tasks = [];
    getDemographicData(tasks);
    if (hasComorbidity) {
        getComorbidityData(tasks);
    }
    if (groups.length > 0) {
        getGroupVarData(tasks);
    }

    Promise.all(tasks).then(() => {
        computeCounts();
        callback();
    });
};
const loadDataPrev = (callback) => {
    // clear previous data
    demographicRawData.clear();
    comorbidityRawData.clear();
    comorbidVars = [];

    const readers = [];
    getDemographicDataReaders(readers);
    if (hasComorbidity) {
        getComorbidityDataReaders(readers);
    }
    if (groups.length > 0) {
        getGroupVarDataReaders(readers);
    }

    Promise.all(readers).then(() => {
        computeCounts();
        callback();
    });
};

// tally counts
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
const tallyDemographicBreakdownCounts = (rawData, columnNum, countsForTenOrLess) => {
    for (let varNum = 1; varNum < rawData.length; varNum++) {
        const id = `demoVar${varNum - 1}Col${columnNum}`;
        let sum = rawData[varNum]
                .map(dat => (dat === '10 patients or fewer') ? countsForTenOrLess : dat)
                .map(dat => isNaN(dat) ? 0 : parseInt(dat))
                .reduce((n1, n2) => n1 + n2);
        dataCounts.set(id, sum);
    }
};
const tallyComorbidityBreakdownCounts = (rawData, colNum, countsForTenOrLess) => {
    for (let varNum = 1; varNum < rawData.length; varNum++) {
        const id = `comorbidVar${varNum - 1}Col${colNum}`;
        let sum = rawData[varNum]
                .map(dat => (dat === '10 patients or fewer') ? countsForTenOrLess : dat)
                .map(dat => isNaN(dat) ? 0 : parseInt(dat))
                .reduce((n1, n2) => n1 + n2);
        dataCounts.set(id, sum);
    }
};

// compute counts
const computeGroupVarCounts = (countsForTenOrLess) => {
    for (let colNum = 0; colNum < columns.length; colNum++) {
        for (let varGroupNum = 0; varGroupNum < groups.length; varGroupNum++) {
            const group = groups[varGroupNum];
            const groupVars = groupVarNames.get(group);
            const additionalVars = Array.from(groupVars);
            for (let varNum = 0; varNum < additionalVars.length; varNum++) {
                const id = `additionalVarCol${colNum}Group${varGroupNum}Var${varNum}`;
                const count = tallyCounts(groupVarRawData.get(id), countsForTenOrLess);
                dataCounts.set(id, count);
            }
        }
    }
};
const computeDemographicCounts = (countsForTenOrLess) => {
    if (isQueryData) {
        for (let colNum = 0; colNum < columns.length; colNum++) {
            const id = `totalCountsCol${colNum}`;
            totalCounts[colNum] = tallyCounts(demographicRawData.get(id), countsForTenOrLess);

            for (let varNum = 0; varNum < demoVars.length; varNum++) {
                const id = `demoVar${varNum}Col${colNum}`;
                const count = tallyCounts(demographicRawData.get(id), countsForTenOrLess);
                dataCounts.set(id, count);
            }
        }
    } else {
        for (let colNum = 0; colNum < columns.length; colNum++) {
            const id = `demoBreakdownCol${colNum}`;

            const lineData = demographicRawData.get(id);
            totalCounts[colNum] = lineData[0]
                    .map(dat => (dat === '10 patients or fewer') ? countsForTenOrLess : dat)
                    .map(dat => isNaN(dat) ? 0 : parseInt(dat))
                    .reduce((n1, n2) => n1 + n2);

            tallyDemographicBreakdownCounts(lineData, colNum, countsForTenOrLess);
        }
    }
};
const computeComorbidityCounts = (countsForTenOrLess) => {
    for (let colNum = 0; colNum < columns.length; colNum++) {
        const id = `comorbidityCol${colNum}`;

        const lineData = comorbidityRawData.get(id);
        tallyComorbidityBreakdownCounts(lineData, colNum, countsForTenOrLess);
    }
};
const addDemographicCounts = (tbody) => {
    const tableRows = [];

    // add demographic variables
    for (let varNum = 0; varNum < demoVars.length; varNum++) {
        const tbodyRow = tbody.insertRow(-1);
        tbodyRow.insertCell(0).outerHTML = `<td>${demoVars[varNum]}</td>`;
        tableRows.push(tbodyRow);
    }

    for (let colNum = 0; colNum < columns.length; colNum++) {
        let row = 0;
        for (let varNum = 0; varNum < demoVars.length; varNum++) {
            const id = `demoVar${varNum}Col${colNum}`;
            const count = dataCounts.get(id);
            const percentage = Math.round((count / totalCounts[colNum]) * 100);

            // add counts to table
            tableRows[row++].insertCell(colNum + 1).innerHTML = `<span class="me-2">${count}</span> (${percentage}%)`;
        }
    }
};
const addGroupVarCounts = (tbody, additionalVars, varGroupNum) => {
    const tableRows = [];

    for (let varNum = 0; varNum < additionalVars.length; varNum++) {
        const tbodyRow = tbody.insertRow(-1);
        tbodyRow.insertCell(0).outerHTML = `<td>${additionalVars[varNum]}</td>`;
        tableRows.push(tbodyRow);
    }

    for (let colNum = 0; colNum < columns.length; colNum++) {
        let row = 0;
        for (let varNum = 0; varNum < additionalVars.length; varNum++) {
            const id = `additionalVarCol${colNum}Group${varGroupNum}Var${varNum}`;
            const count = dataCounts.get(id);
            const percentage = Math.round((count / totalCounts[colNum]) * 100);

            // add counts to table
            tableRows[row++].insertCell(colNum + 1).innerHTML = `<span class="me-2">${count}</span> (${percentage}%)`;
        }
    }
};
const addComorbidityCounts = (tbody) => {
    const tableRows = [];

    // add comorbidity variables
    for (let varNum = 0; varNum < comorbidVars.length; varNum++) {
        const tbodyRow = tbody.insertRow(-1);
        tbodyRow.insertCell(0).outerHTML = `<td>${comorbidVars[varNum]}</td>`;

        tableRows.push(tbodyRow);
    }

    for (let colNum = 0; colNum < columns.length; colNum++) {
        let row = 0;
        for (let varNum = 0; varNum < comorbidVars.length; varNum++) {
            const id = `comorbidVar${varNum}Col${colNum}`;
            const count = dataCounts.get(id);
            const percentage = Math.round((count / totalCounts[colNum]) * 100);

            // add counts to table
            tableRows[row++].insertCell(colNum + 1).innerHTML = `<span class="me-2">${count}</span> (${percentage}%)`;
        }
    }
};
const computeCounts = () => {
    // clear data
    totalCounts = Array.from({length: columns.length}, () => 0); // create a new array of column length and initialize with zeros.
    dataCounts.clear();

    const countsForTenOrLess = parseInt(patientCountsSelect.options[patientCountsSelect.selectedIndex].value);
    computeDemographicCounts(countsForTenOrLess);
    if (hasComorbidity) {
        computeComorbidityCounts(countsForTenOrLess);
    }
    if (groupVarRawData.size > 0) {
        computeGroupVarCounts(countsForTenOrLess);
    }
};

// add item to HTML list
const deleteItemFromHtmlList = (trashObj) => {
    const item = trashObj.parentElement.innerText;
    const listItem = trashObj.parentElement;
    const list = trashObj.parentElement.parentElement;

    list.removeChild(listItem);

    return item;
};
const addItemToHtmlList = (item, htmlList, deleteFunction) => {
    // <li class="list-group-item list-group-item-info bg-opacity-10 border border-info">
    const li = document.createElement('li');
    li.className = 'list-group-item list-group-item-info bg-opacity-10 border border-info';
    li.innerHTML = `${item} <a class="text-danger float-end" title="Delete" onclick="${deleteFunction}"><i class="bi bi-trash3"></i></a>`;

    htmlList.appendChild(li);
};
const addToHtmlList = (input, htmlList, set, deleteFunction) => {
    const item = input.value.trim();
    input.value = ''; // clear input text
    if (!(item === '' || set.has(item))) {
        set.add(item);
        addItemToHtmlList(item, htmlList, deleteFunction);
    }

    return item;
};

// add or remove demographic variables
const removeDemoVariable = (trashObj) => {
    const item = deleteItemFromHtmlList(trashObj);
    demoVarNames.delete(item);

    if (demoVarNames.size > 0) {
        $('#demVarInput').prop('required', false);
    } else {
        $('#demVarInput').prop('required', true);
    }
};
const addDemoVariable = () => {
    const textInput = document.getElementById('demVarInput');
    const htmlList = document.getElementById('demVarList');
    const deleteFunction = 'removeDemoVariable(this);';
    addToHtmlList(textInput, htmlList, demoVarNames, deleteFunction);

    if (demoVarNames.size > 0) {
        $('#demVarInput').prop('required', false);
    } else {
        $('#demVarInput').prop('required', true);
    }
};

// add or remove column
const removeColumn = (trashObj) => {
    const item = deleteItemFromHtmlList(trashObj);
    columnNames.delete(item);

    if (columnNames.size > 0) {
        $('#columnInput').prop('required', false);
    } else {
        $('#columnInput').prop('required', true);
    }
};
const addColumn = () => {
    const textInput = document.getElementById('columnInput');
    const htmlList = document.getElementById('columnList');
    const deleteFunction = 'removeColumn(this);';
    addToHtmlList(textInput, htmlList, columnNames, deleteFunction);

    if (columnNames.size > 0) {
        $('#columnInput').prop('required', false);
    } else {
        $('#columnInput').prop('required', true);
    }
};

// add or remove group variables
const removeGroupVar = (trashObj, groupName, groupInputCount) => {
    const item = deleteItemFromHtmlList(trashObj);

    const varNames = groupVarNames.get(groupName);
    varNames.delete(item);

    const id = `group${groupInputCount}VarInput`;
    if (varNames.size > 0) {
        $(`#${id}`).prop('required', false);
    } else {
        $(`#${id}`).prop('required', true);
    }
};
const addGroupVar = (groupName, groupInputCount) => {
    const id = `group${groupInputCount}VarInput`;
    const listId = `group${groupInputCount}VarList`;
    const varNames = groupVarNames.get(groupName);

    const textInput = document.getElementById(id);
    const htmlList = document.getElementById(listId);
    const deleteFunction = `removeGroupVar(this, '${groupName}', ${groupInputCount});`;
    addToHtmlList(textInput, htmlList, varNames, deleteFunction);

    if (varNames.size > 0) {
        $(`#${id}`).prop('required', false);
    } else {
        $(`#${id}`).prop('required', true);
    }
};


// add or remove group
const removeGroup = (trashObj) => {
    const item = deleteItemFromHtmlList(trashObj);
    groupNames.delete(item);

    if (groupNames.size > 0) {
        $('#columnInput').prop('required', false);
    } else {
        $('#columnInput').prop('required', true);
    }

    const card = groupVarInputs.get(item);

    const groupVarsDiv = document.getElementById('groupVars');
    groupVarsDiv.removeChild(card);

    groupVarInputs.delete(item);
    groupVarNames.delete(item);
};
const addGroup = () => {
    const textInput = document.getElementById('groupInput');
    const htmlList = document.getElementById('groupList');
    const deleteFunction = 'removeGroup(this);';
    const groupName = addToHtmlList(textInput, htmlList, groupNames, deleteFunction);
    if (groupName !== '') {
        createGroupVarInput(groupName);
    }

    if (groupNames.size > 0) {
        $('#columnInput').prop('required', false);
    } else {
        $('#columnInput').prop('required', true);
    }
};

const createGroupVarInput = (groupName) => {
    const id = `group${groupInputCounts}VarInput`;
    const card = document.createElement('div');
    card.className = 'card border-primary-subtle mb-3';
    groupVarInputs.set(groupName, card);
    groupVarNames.set(groupName, new Set());

    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header bg-primary-subtle text-primary-emphasis';
    cardHeader.innerText = groupName;
    card.appendChild(cardHeader);

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';
    cardBody.innerHTML = `
<label class="col-form-label fw-bold" for="${id}">Additional Variables:</label>
<div class="input-group">
    <input type="text" class="form-control" id="${id}" name="${id}" placeholder="Variable name" value="" required="required" />
    <button class="btn btn-secondary btn-sm" type="button" onclick="addGroupVar('${groupName}', ${groupInputCounts});"><i class="bi bi-plus-circle-fill"></i> Add Variable</button>
</div>
<ul class="list-group mt-2" id="group${groupInputCounts}VarList"></ul>
`;
//    cardBody.appendChild(label);
    card.appendChild(cardBody);

    const groupVarsDiv = document.getElementById('groupVars');
    groupVarsDiv.appendChild(card);

    groupInputCounts++;
};

// file upload
const constructQueryDemographicTotalCountsFileUpload = (divContainer, columnNum) => {
    const id = `totalCountsCol${columnNum}`;

    const div = document.createElement('div');
    div.className = 'row g-2 align-items-center';
    div.innerHTML = `
        <hr class="m-2" />
        <div class="col-auto">
            <label for="${id}" class="col-form-label">Total Counts:</label>
        </div>
        <div class="col-auto">
            <input id="${id}" name="${id}" type="file" required="required" />
        </div>
`;
    divContainer.appendChild(div);
};
const constructDemographicFileUpload = (cardBody, colNum) => {
    // <div class="text-bg-warning p-3 bg-opacity-10 border border-warning"></div>
    const divContainer = document.createElement('div');
    divContainer.className = 'text-bg-warning p-3 bg-opacity-10 border border-warning';
    divContainer.style = 'max-width: 45rem;';

    if (isQueryData) {
        for (let varNum = 0; varNum < demoVars.length; varNum++) {
            const demoVar = demoVars[varNum];
            const id = `demoVar${varNum}Col${colNum}`;

            const div = document.createElement('div');
            div.className = 'row g-2 align-items-center mb-3';
            div.innerHTML = `
                <div class="col-auto">
                    <label for="${id}" class="col-form-label">${demoVar}:</label>
                </div>
                <div class="col-auto">
                    <input id="${id}" name="${id}" type="file" required="required" />
                </div>
`;
            divContainer.appendChild(div);
        }
        constructQueryDemographicTotalCountsFileUpload(divContainer, colNum);
    } else {
        const id = `demoBreakdownCol${colNum}`;

        const div = document.createElement('div');
        div.className = 'row g-2 align-items-center';
        div.innerHTML = `
                <div class="col-auto">
                    <label for="${id}" class="col-form-label">Demographic Breakdown:</label>
                </div>
                <div class="col-auto">
                    <input id="${id}" name="${id}" type="file" required="required" />
                </div>
`;
        divContainer.appendChild(div);
    }

    // card title
    // <h6 class="card-title fw-bold mb-2">Demographic Counts</h6>
    const cardTitle = document.createElement('h6');
    cardTitle.className = 'card-title fw-bold mb-2';
    cardTitle.innerText = 'Demographic Counts';

    const gridCol = document.createElement('div');
    gridCol.className = 'col-sm-12 col-md-12 col-lg-4 py-2';
    gridCol.appendChild(cardTitle);
    gridCol.appendChild(divContainer);

    cardBody.appendChild(gridCol);
};
const constructComorbidityFileUpload = (cardBody, colNum) => {
    const divContainer = document.createElement('div');
    divContainer.className = 'text-bg-warning p-3 bg-opacity-10 border border-warning';
    divContainer.style = 'max-width: 45rem;';

    const id = `comorbidityCol${colNum}`;

    const div = document.createElement('div');
    div.className = 'row g-2 align-items-center';
    div.innerHTML = `
        <div class="col-auto">
            <label for="${id}" class="col-form-label">${comorbidity}:</label>
        </div>
        <div class="col-auto">
            <input id="${id}" name="${id}" type="file" required="required" />
        </div>
`;
    divContainer.appendChild(div);

    // card title
    // <h6 class="card-title fw-bold mt-4 mb-2">Comorbidity</h6>
    const cardTitle = document.createElement('h6');
    cardTitle.className = 'card-title fw-bold mb-2';
    cardTitle.innerText = 'Comorbidity';

    const gridCol = document.createElement('div');
    gridCol.className = 'col-sm-12 col-md-12 col-lg-4 py-2';
    gridCol.appendChild(cardTitle);
    gridCol.appendChild(divContainer);

    cardBody.appendChild(gridCol);
};
const constructGroupVariableFileUpload = (cardBody, colNum) => {
    const divContainer = document.createElement('div');
    divContainer.className = 'text-bg-warning p-3 bg-opacity-10 border border-warning';
    divContainer.style = 'max-width: 45rem;';

    for (let varGroupNum = 0; varGroupNum < groups.length; varGroupNum++) {
        const group = groups[varGroupNum];

        const groupVars = groupVarNames.get(group);
        if (groupVars.size > 0) {
            const cardTitle = document.createElement('h6');
            cardTitle.className = 'card-title fw-bold mb-3';
            cardTitle.innerText = group;
            divContainer.appendChild(cardTitle);

            const additionalVars = Array.from(groupVars);
            for (let varNum = 0; varNum < additionalVars.length; varNum++) {
                const id = `additionalVarCol${colNum}Group${varGroupNum}Var${varNum}`;

                const div = document.createElement('div');
                div.className = 'row g-2 align-items-center mb-4';
                div.innerHTML = `
        <div class="col-auto">
            <label for="${id}" class="col-form-label">${additionalVars[varNum]}:</label>
        </div>
        <div class="col-auto">
            <input id="${id}" name="${id}" type="file" required="required" />
        </div>
`;
                divContainer.appendChild(div);
            }
        }
    }

    const cardTitle = document.createElement('h6');
    cardTitle.className = 'card-title fw-bold mb-2';
    cardTitle.innerText = 'Additional Variables';

    const gridCol = document.createElement('div');
    gridCol.className = 'col-sm-12 col-md-12 col-lg-4 py-2';
    gridCol.appendChild(cardTitle);
    gridCol.appendChild(divContainer);

    cardBody.appendChild(gridCol);
};
const constructFileUpload = () => {
    const fileUpload = document.getElementById('fileUpload');
    fileUpload.innerHTML = '';

    for (let colNum = 0; colNum < columns.length; colNum++) {
        const column = columns[colNum];

        // card header
        // <div class="card-header">
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';
        cardHeader.innerHTML = `Column: <span class="fw-bold">${column}</span>`;

        // card body
        // <div class="card-body">
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body row';

        constructDemographicFileUpload(cardBody, colNum);
        if (hasComorbidity) {
            constructComorbidityFileUpload(cardBody, colNum);
        }
        if (groups.length > 0) {
            constructGroupVariableFileUpload(cardBody, colNum);
        }

        // create card
        // <div class="card mb-4">
        const card = document.createElement('div');
        card.className = 'card mb-4';
        card.appendChild(cardHeader);
        card.appendChild(cardBody);

        // add card to div
        fileUpload.appendChild(card);
    }
};

const isValidStep1Form = () => {
    if (columnNames.size === 0) {
        return false;
    }
    if (isQueryData && demoVarNames.size === 0) {
        return false;
    }

    return true;
};

const collectVariables = () => {
    columns = Array.from(columnNames);
    demoVars = Array.from(demoVarNames);

    comorbidity = $('input[name="comorbidity"]:checked').val().trim();
    hasComorbidity = comorbidity !== 'none';
    if (hasComorbidity) {
        comorbidity = `${comorbidity} Comorbidities`;
    }


    groups = Array.from(groupNames);
};

// construct table 1
const addTableOneHeader = (thead) => {
    const theadRow = thead.insertRow(0);

    // first column header is empty
    theadRow.insertCell(0).outerHTML = '<th></th>';

    // add column labels
    for (let i = 0; i < columns.length; i++) {
        theadRow.insertCell(i + 1).outerHTML = `<th>${columns[i]}</th>`;
    }
};
const addTableOneRowTotal = (tbody) => {
    const tbodyRow = tbody.insertRow(0);

    tbodyRow.insertCell(0).outerHTML = '<th>Total</th>';

    for (let colNum = 0; colNum < columns.length; colNum++) {
        tbodyRow.insertCell(colNum + 1).innerText = `(n=${totalCounts[colNum]})`;
    }
};
const addTableOneRowDemographics = (table) => {
    const tbody = table.createTBody();
    tbody.className = 'table-group-divider';

    const tbodyRow = tbody.insertRow(-1);
    tbodyRow.className = 'table-info';
    tbodyRow.insertCell(0).outerHTML = `<th colspan="${columns.length + 1}">Demographic Distribution By</th>`;

    addDemographicCounts(tbody);
};
const addTableOneRowComorbidity = (table) => {
    const tbody = table.createTBody();
    tbody.className = 'table-group-divider';

    const tbodyRow = tbody.insertRow(-1);
    tbodyRow.className = 'table-info';
    tbodyRow.insertCell(0).outerHTML = `<th colspan="${columns.length + 1}">${comorbidity}</th>`;

    addComorbidityCounts(tbody);
};
const addTableOneRowGroupVars = (table) => {
    for (let varGroupNum = 0; varGroupNum < groups.length; varGroupNum++) {
        const group = groups[varGroupNum];

        const groupVars = groupVarNames.get(group);
        if (groupVars.size > 0) {
            const tbody = table.createTBody();
            tbody.className = 'table-group-divider';

            const tbodyRow = tbody.insertRow(-1);
            tbodyRow.className = 'table-info';
            tbodyRow.insertCell(0).outerHTML = `<th colspan="${columns.length + 1}">${group}</th>`;

            const additionalVars = Array.from(groupVars);
            addGroupVarCounts(tbody, additionalVars, varGroupNum);
        }
    }
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
    if (hasComorbidity) {
        addTableOneRowComorbidity(table);
    }
    if (groupVarRawData.size > 0) {
        addTableOneRowGroupVars(table);
    }

    $('#siteList').val(Array.from(validSites).join('\n'));
};

// wizard tabs
const showTab = (tab) => {
    // show the current tab and hide others
    const tabs = document.querySelectorAll('.tab-pane');
    tabs.forEach(tab => tab.classList.remove('show', 'active'));
    tabs[tab].classList.add('show', 'active');

    // update the navigation links
    const navLinks = document.querySelectorAll('.nav-link-tab');
    navLinks.forEach(link => {
        link.classList.remove('active');
        link.classList.add('disabled');
    });
    navLinks[tab].classList.add('active');
    navLinks[tab].classList.remove('disabled');
};
const showNextTab = (tab) => {
    switch (tab) {
        case 1:
            // clear all inputs
            $('#columnInput').val('');
            $('#demVarInput').val('');

            // validate form
            if (!isValidStep1Form()) {
                $('#setup1Form').valid();
                $('#demQuery').trigger('change');
                return;
            }

            collectVariables();
            constructFileUpload();

            break;
        case 2:
            if (!$('#step2Form').valid()) {
                return;
            }

            analyzeAndLoadData(constructTableOne);

            break;
    }

    showTab(tab);
};
const showPreviousTab = (tab) => {
    showTab(tab);
};

// jquery validation
const validateErrorPlacement = (error, element) => {
    error.addClass("invalid-feedback");
    if (element.prop("type") === "checkbox") {
        error.insertAfter(element.next("label"));
    } else {
        error.insertAfter(element.next('button'));
    }
};
const validateHighlight = (element) => {
    $(element).addClass("is-invalid").removeClass("is-valid");
};
const validateUnhighlight = (element) => {
    $(element).addClass("is-valid").removeClass("is-invalid");
};

// testing
const addToHtmlColumnList = (item) => {
    const htmlList = document.getElementById('columnList');
    const deleteFunction = 'removeColumn(this);';

    columnNames.add(item);
    addItemToHtmlList(item, htmlList, deleteFunction);
};
const addToHtmlVarList = (item) => {
    const htmlList = document.getElementById('demVarList');
    const deleteFunction = 'removeDemoVariable(this);';

    demoVarNames.add(item);
    addItemToHtmlList(item, htmlList, deleteFunction);
};
const addToGroup = (item) => {
    const htmlList = document.getElementById('groupList');
    const deleteFunction = 'removeGroup(this);';

    groupNames.add(item);
    addItemToHtmlList(item, htmlList, deleteFunction);
    if (item !== '') {
        createGroupVarInput(item);
    }
};

const getTable1HeaderContent = (rowData) => {
    const content = [];
    content.push('');
    for (let i = 0; i < columns.length; i++) {
        let val = columns[i];
        if (val.includes(',')) {
            val = `"${val}"`;
        }
        content.push(val);
    }

    rowData.push(content.join(','));
};
const getTable1TotalContent = (rowData) => {
    let content = [];
    content.push('Total');
    for (let colNum = 0; colNum < columns.length; colNum++) {
        content.push(`(n=${totalCounts[colNum]})`);
    }

    rowData.push(content.join(','));
};
const getTable1DemographicContents = (rowData) => {
    let content = [];
    content.push('Demographic Distribution By');
    for (let i = 0; i < columns.length; i++) {
        content.push('');
    }
    rowData.push(content.join(','));

    for (let varNum = 0; varNum < demoVars.length; varNum++) {
        content = [];

        let val = demoVars[varNum];
        if (val.includes(',')) {
            val = `"${val}"`;
        }
        content.push(val);

        for (let colNum = 0; colNum < columns.length; colNum++) {
            const id = `demoVar${varNum}Col${colNum}`;
            const count = dataCounts.get(id);
            const percentage = Math.round((count / totalCounts[colNum]) * 100);

            content.push(`${count} (${percentage}%)`);
        }
        rowData.push(content.join(','));
    }
};
const getTable1ComorbidityContents = (rowData) => {
    let content = [];
    content.push(comorbidity);
    for (let i = 0; i < columns.length; i++) {
        content.push('');
    }
    rowData.push(content.join(','));

    for (let varNum = 0; varNum < comorbidVars.length; varNum++) {
        content = [];

        let val = comorbidVars[varNum];
        if (val.includes(',')) {
            val = `"${val}"`;
        }
        content.push(val);

        for (let colNum = 0; colNum < columns.length; colNum++) {
            const id = `comorbidVar${varNum}Col${colNum}`;
            const count = dataCounts.get(id);
            const percentage = Math.round((count / totalCounts[colNum]) * 100);

            content.push(`${count} ${percentage}%`);
        }
        rowData.push(content.join(','));
    }
};
const getTable1GroupVarContents = (rowData) => {
    for (let varGroupNum = 0; varGroupNum < groups.length; varGroupNum++) {
        const group = groups[varGroupNum];

        const groupVars = groupVarNames.get(group);
        if (groupVars.size > 0) {
            content = [];
            content.push(group);
            for (let i = 0; i < columns.length; i++) {
                content.push('');
            }
            rowData.push(content.join(','));

            const additionalVars = Array.from(groupVars);
            for (let varNum = 0; varNum < additionalVars.length; varNum++) {
                content = [];
                content.push(additionalVars[varNum]);

                for (let colNum = 0; colNum < columns.length; colNum++) {
                    const id = `additionalVarCol${colNum}Group${varGroupNum}Var${varNum}`;
                    const count = dataCounts.get(id);
                    const percentage = Math.round((count / totalCounts[colNum]) * 100);

                    content.push(`${count} ${percentage}%`);
                }
                rowData.push(content.join(','));
            }
        }
    }
};
const getTable1Contents = () => {
    const rowData = [];
    getTable1HeaderContent(rowData);
    getTable1TotalContent(rowData);
    getTable1DemographicContents(rowData);
    if (hasComorbidity) {
        getTable1ComorbidityContents(rowData);
    }
    if (groupVarRawData.size > 0) {
        getTable1GroupVarContents(rowData);
    }

    return rowData.join('\r\n');
};
const handleExportData = (event) => {
    event.preventDefault();

    const content = getTable1Contents();
    const blob = new Blob([content], {type: 'text/csv;charset=utf-8;'});

    const downloadLink = document.createElement("a");
    downloadLink.download = 'table1.csv';
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.click();
};
const handlePatientCountChange = (event) => {
    computeCounts();
    constructTableOne();
};
$(document).ready(function () {
    groupInputCounts = 0;
    validSites.clear();

    patientCountsSelect.addEventListener('change', handlePatientCountChange, false);
    exportData.addEventListener('click', handleExportData, false);

    $('#setup1Form').validate({
        messages: {
            columnInput: 'Requires at least one column must be added.',
            demVarInput: 'Requires at least one variable must be added.'
        },
        errorElement: "em",
        errorClass: 'text-danger',
        errorPlacement: validateErrorPlacement,
        highlight: validateHighlight,
        unhighlight: validateUnhighlight
    });

    $('#step2Form').validate({
        errorElement: "em",
        errorClass: 'text-danger',
        highlight: validateHighlight,
        unhighlight: validateUnhighlight
    });

    $('input[name="datatype"]').on('change', function () {
        isQueryData = $('input[name="datatype"]:checked').val() === 'query';
        if (isQueryData) {
            $('#demQueryOpts').show();
            $('#demVarInput').prop('required', true);
        } else {
            $('#demQueryOpts').hide();
            $('#demVarInput').prop('required', false);
        }
    });
    $('#demQuery').trigger('change');

//    addToHtmlColumnList('vmat-2');
//    addToHtmlColumnList('no vmat-2');
//    addToHtmlVarList('age');
//    addToHtmlVarList('female');
//    addToHtmlVarList('male');
//    addToGroup('Repeat');
});