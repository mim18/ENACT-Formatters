/**
 * enact-formatter.js
 *
 * @description This file contains methods for formatting data for display and
 * export.
 * @author Kevin V. Bui
 */

/**
 * HTML elements.
 */
const fileNameDisplay = document.getElementById('file_name');
const csvFileSelect = document.getElementById('select_csv_file');
const formTypeSelect = document.getElementById('select_form_type');
const exportData = document.getElementById('export_data');
const patientCountsSelect = document.getElementById('select_patient_counts');
const siteCounts = document.getElementById('site_counts');
const cumulativeEnrollmentTable = document.getElementById('cumulative_enrollment');
const plannedEnrollmentTable = document.getElementById('planned_enrollment');


// list of variables to exclude from data
const varsToExclude = [
    'NIH Enrollment American Indian or Alaska Native-Female-No Ethnicity Info',
    'NIH Enrollment White-No Sex Info-No Ethnicity Info',
    'NIH Enrollment White-No Sex Info-Not Hispanic'
];
const excludedVars = new Set(varsToExclude.map(item => item.replace('NIH Enrollment', '').trim()));

const rawInputData = [];
const enrollments = [];

const sitesIncluded = new Set();

const getBreakdownQueryValidSitesTask = (csvFile, sitesIncluded) => {
    // clear existing data
    sitesIncluded.clear();

    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            complete: function (results) {
                const rows = results.data;
                if (rows.length > 1) {
                    const sites = rows[0];
                    for (let r = 2; r < rows.length; r++) {
                        const cols = rows[r];
                        if (cols.length === sites.length) {
                            const variable = cols[0].replace('NIH Enrollment', '').trim();
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

                resolve();
            }
        });
    });
};
const readInBreakdownQueryData = (csvFile, validSites, rawInputData) => {
    // clear existing data
    rawInputData.length = 0;

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

                    for (let i = 2; i < lines.length; i++) {
                        const data = lines[i];
                        if (data.length !== sites.length) {
                            continue;
                        }

                        const variable = data[0].replace('NIH Enrollment', '').trim();
                        if (excludedVars.has(variable)) {
                            continue;
                        }

                        const lineData = [variable];
                        for (let j = 2; j < data.length; j++) {
                            if (isValidSites[j]) {
                                lineData.push(data[j].trim().toLowerCase());
                            }
                        }
                        rawInputData.push(lineData);
                    }
                }

                resolve();
            }
        });
    });
};

const populateSiteNames = (sites) => {
    siteCounts.textContent = sites.size;

    const data = [...sites].sort();

    const tbody = document.querySelector('#site_names tbody');
    tbody.innerHTML = '';
    data.forEach(name => tbody.insertRow(-1).insertCell(0).textContent = name);
};

const tallyCounts = (data) => {
    return data
            .filter(num => num !== '')
            .map(num => parseInt(num))
            .reduce((accumulator, currentValue) => accumulator + currentValue);
};
const getCounts = (line, enrollments, countsForTenOrLess) => {
    const data = line
            .map(line => line.trim())
            .filter(line => line !== '')
            .map(line => (line === 'unavailable') ? "0" : line)
            .map(line => (line === '10 patients or fewer') ? countsForTenOrLess : line);

    const counts = tallyCounts(data.slice(1));

    const category = data[0].replace('NIH Enrollment', '').trim();
    const categories = category.split('-');

    const race = categories[0]
            .replace('Multiple race', 'More than One Race')
            .replace('No Race Info', 'Unknown or Not Reported');
    const gender = categories[1].toLowerCase();
    const ethnicity = categories[2].toLowerCase();

    enrollments.push({
        race: categories[0]
                .replace('Multiple race', 'More than One Race')
                .replace('No Race Info', 'Unknown or Not Reported'),
        gender: categories[1].toLowerCase(),
        ethnicity: categories[2].toLowerCase(),
        counts: counts
    });
};

const getCumulativeInclusionData = (enrollments) => {
    const enrollmentData = new Map();
    for (const enrollment of enrollments) {
        const ethnicity = enrollment.ethnicity;
        const gender = enrollment.gender;
        const counts = enrollment.counts;

        let race = enrollment.race;
        if (!enrollmentData.has(race)) {
            const data = Array(11).fill(0);
            data[0] = race;
            enrollmentData.set(race, data);
        }
        const data = enrollmentData.get(race);
        if (ethnicity === 'not hispanic') {
            if (gender === 'female') {
                data[1] = counts;
            } else if (gender === 'male') {
                data[2] = counts;
            } else {
                data[3] = counts;
            }
        } else if (ethnicity === 'hispanic') {
            if (gender === 'female') {
                data[4] = counts;
            } else if (gender === 'male') {
                data[5] = counts;
            } else {
                data[6] = counts;
            }
        } else {
            if (gender === 'female') {
                data[7] = counts;
            } else if (gender === 'male') {
                data[8] = counts;
            } else {
                data[9] = counts;
            }
        }

        // tally the column counts
        data[10] += counts;
    }

    // tally the row counts
    const data = Array(11).fill(0);
    race = 'Total';
    data[0] = race;
    enrollmentData.forEach((values, keys) => {
        // tally counts down rows
        for (let i = 1; i < values.length; i++) {
            data[i] += values[i];
        }
    });
    enrollmentData.set(race, data);

    // create enrollment data from map to array
    return Array.from(enrollmentData, ([key, value]) => value);
};

const getEthnicPlannedData = (enrollments) => {
    const enrollmentData = new Map();
    for (const enrollment of enrollments) {
        const race = enrollment.race;
        if (race === 'More than One Race' || race === 'Unknown or Not Reported') {
            continue;
        }

        const gender = enrollment.gender;
        const counts = enrollment.counts;
        let ethnicity = enrollment.ethnicity;
        if (ethnicity === 'hispanic' || ethnicity === 'not hispanic') {
            if (ethnicity === 'hispanic') {
                ethnicity = 'Hispanic or Latino';
            } else {
                ethnicity = 'Not Hispanic or Latino';
            }

            if (!enrollmentData.has(ethnicity)) {
                const data = Array(4).fill(0);
                data[0] = ethnicity;
                enrollmentData.set(ethnicity, data);
            }

            const data = enrollmentData.get(ethnicity);
            if (gender === 'female') {
                data[1] += counts;
                data[3] += counts;
            } else if (gender === 'male') {
                data[2] += counts;
                data[3] += counts;
            }
        }
    }

    // tally the row counts
    const data = Array(4).fill(0);
    ethnicity = 'Ethnic Category: Total of All Subjects **';
    data[0] = ethnicity;
    enrollmentData.forEach((values, keys) => {
        // tally counts down rows
        for (let i = 1; i < values.length; i++) {
            data[i] += values[i];
        }
    });
    enrollmentData.set(ethnicity, data);

    // create enrollment data from map to array
    return Array.from(enrollmentData, ([key, value]) => value);
};

const getRacialPlannedData = (enrollments) => {
    const enrollmentData = new Map();
    for (const enrollment of enrollments) {
        const ethnicity = enrollment.ethnicity;
        if (ethnicity === 'no ethnicity info') {
            continue;
        }

        const gender = enrollment.gender;
        const counts = enrollment.counts;

        let race = enrollment.race;
        if (!enrollmentData.has(race)) {
            const data = Array(4).fill(0);
            data[0] = race;
            enrollmentData.set(race, data);
        }

        const data = enrollmentData.get(race);
        if (gender === 'female') {
            data[1] += counts;
            data[3] += counts;
        } else if (gender === 'male') {
            data[2] += counts;
            data[3] += counts;
        }
    }

    // remove unwanted data
    enrollmentData.delete('More than One Race');
    enrollmentData.delete('Unknown or Not Reported');

    // tally the row counts
    const data = Array(4).fill(0);
    race = 'Racial Categories: Total of All Subjects **';
    data[0] = race;
    enrollmentData.forEach((values, keys) => {
        // tally counts down rows
        for (let i = 1; i < values.length; i++) {
            data[i] += values[i];
        }
    });
    enrollmentData.set(race, data);

    // create enrollment data from map to array
    return Array.from(enrollmentData, ([key, value]) => value);
};

const addRowToCumulativeTable = (values, tbody) => {
    const columns = [];
    const row = tbody.insertRow(-1);
    for (let i = 0; i < values.length; i++) {
        columns[i] = row.insertCell(i);
        if (i === 0) {
            columns[i].outerHTML = `<th scope="row">${values[i]}</th>`;
        } else {
            columns[i].innerHTML = values[i];
        }
    }

    // add background color
    columns[1].classList.add('table-secondary');
    columns[2].classList.add('table-secondary');
    columns[3].classList.add('table-secondary');
    columns[7].classList.add('table-secondary');
    columns[8].classList.add('table-secondary');
    columns[9].classList.add('table-secondary');
};

const addToCumulativeTable = (data) => {
    let tbody = cumulativeEnrollmentTable.getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';

    const lastIndex = data.length - 1;
    for (let i = 0; i < lastIndex; i++) {
        addRowToCumulativeTable(data[i], tbody);
    }

    let tfoot = cumulativeEnrollmentTable.getElementsByTagName('tfoot')[0];
    tfoot.innerHTML = '';
    addRowToCumulativeTable(data[lastIndex], tfoot);
};

const addRowToPlannedTable = (values, tbody) => {
    const columns = [];
    const row = tbody.insertRow(-1);
    for (let i = 0; i < values.length; i++) {
        columns[i] = row.insertCell(i);
        if (i === 0) {
            columns[i].outerHTML = `<th scope="row">${values[i]}</th>`;
        } else {
            columns[i].innerHTML = values[i];
        }
    }
};

const addToPlannedTable = (ethnicPlannedData, racialPlannedData) => {
    let tbody = plannedEnrollmentTable.getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';

    let lastIndex = ethnicPlannedData.length - 1;
    for (let i = 0; i < lastIndex; i++) {
        addRowToPlannedTable(ethnicPlannedData[i], tbody);
    }

    const values = ethnicPlannedData[lastIndex];
    let row = tbody.insertRow(-1);
    row.classList.add('border');
    row.classList.add('border-2');
    row.classList.add('border-end-0');
    row.classList.add('border-bottom-0');
    row.classList.add('border-start-0');
    row.classList.add('border-black');
    for (let i = 0; i < values.length; i++) {
        let column = row.insertCell(i);
        if (i === 0) {
            column.outerHTML = `<th scope="row">${values[i]}</th>`;
        } else {
            column.innerHTML = values[i];
        }
    }

    row = tbody.insertRow(-1);
    column = row.insertCell(0);
    column.setAttribute('colspan', '4');
    column.classList.add('p-0');

    row = tbody.insertRow(-1);
    row.classList.add('border');
    row.classList.add('border-2');
    row.classList.add('border-top-0');
    row.classList.add('border-end-0');
    row.classList.add('border-start-0');
    row.classList.add('border-black');
    row.classList.add('text-center');
    row.classList.add('align-middle');
    column = row.insertCell(0);
    column.outerHTML = `<th scope="row">Racial Categories</th>`;
    column = row.insertCell(1);
    column.setAttribute('colspan', '3');

    lastIndex = racialPlannedData.length - 1;
    for (let i = 0; i < lastIndex; i++) {
        addRowToPlannedTable(racialPlannedData[i], tbody);
    }

    let tfoot = plannedEnrollmentTable.getElementsByTagName('tfoot')[0];
    tfoot.innerHTML = '';
    addRowToPlannedTable(racialPlannedData[lastIndex], tfoot);
};
const loadData = (rawInputData) => {
    // clear existing data
    enrollments.length = 0;

    const countsForTenOrLess = patientCountsSelect.options[patientCountsSelect.selectedIndex].value;
    for (const line of rawInputData) {
        getCounts(line, enrollments, countsForTenOrLess);
    }

    const cumulativeInclusionData = getCumulativeInclusionData(enrollments);
    addToCumulativeTable(cumulativeInclusionData);

    const ethnicPlannedData = getEthnicPlannedData(enrollments);
    const racialPlannedData = getRacialPlannedData(enrollments);
    addToPlannedTable(ethnicPlannedData, racialPlannedData);
};
const clearAllData = () => {
    sitesIncluded.clear();
    rawInputData.length = 0;
    enrollments.length = 0;

    if (cumulativeEnrollmentTable) {
        cumulativeEnrollmentTable.getElementsByTagName('tbody')[0].innerHTML = '';
        cumulativeEnrollmentTable.getElementsByTagName('tfoot')[0].innerHTML = '';
    }
    if (plannedEnrollmentTable) {
        plannedEnrollmentTable.getElementsByTagName('tbody')[0].innerHTML = '';
        plannedEnrollmentTable.getElementsByTagName('tfoot')[0].innerHTML = '';
    }
};
const buildForms = async (csvFile) => {
    // display file name
    fileNameDisplay.textContent = csvFile.name;
    fileNameDisplay.style.display = 'block';

    // clear existing data
    clearAllData();

    await getBreakdownQueryValidSitesTask(csvFile, sitesIncluded);
    await readInBreakdownQueryData(csvFile, sitesIncluded, rawInputData);

    populateSiteNames(sitesIncluded);

    try {
        loadData(rawInputData);
    } catch (err) {
        const messageModal = new bootstrap.Modal(document.getElementById('message_modal'));
        messageModal.show();
    }
};

const addFileDrapDropEventListeners = () => {
    const dropArea = document.getElementById('drop_area');
    if (!dropArea) {
        return;
    }

    // prevent default drag behaviors
    const preventDefaults = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => dropArea.addEventListener(event, preventDefaults, false));

    // highlighting drop area when item is dragged over it
    const highlight = (event) => event.target.classList.add('highlight');
    ['dragenter', 'dragover'].forEach(event => dropArea.addEventListener(event, highlight, false));

    // remove highlighting from drop area when item is dropped
    const unhighlight = (event) => event.target.classList.remove('highlight');
    dropArea.addEventListener('dragleave', unhighlight, false);

    const handleFileDrop = (event) => {
        event.target.classList.remove('highlight');

        if (event.dataTransfer.items) {
            // use DataTransferItemList interface to access the file(s)
            [...event.dataTransfer.items].forEach((item, i) => {
                // If dropped items aren't files, reject them
                if (item.kind === "file") {
                    const file = item.getAsFile();
                    if (file.type === 'text/csv') {
                        buildForms(file);
                    }
                }
            });
        } else {
            // use DataTransfer interface to access the file(s)
            [...event.dataTransfer.files].forEach((file, i) => {
                buildForms(file);
            });
        }
    };
    dropArea.addEventListener('drop', handleFileDrop, false);
};
const addFileSelectEventListeners = () => {
    const fileSelect = document.getElementById('select_csv_file');
    if (!fileSelect) {
        return;
    }

    const handleFileSelect = (event) => {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            if (file.type === 'text/csv') {
                buildForms(file);
            }
        }
    };
    fileSelect.addEventListener('change', handleFileSelect);
};

const handleFormSwitch = () => {
    const cumulativeEnrollment = document.getElementById('cumulative_enrollment_form');
    const plannedEnrollment = document.getElementById('planned_enrollment_form');

    const formType = formTypeSelect.options[formTypeSelect.selectedIndex].value;
    if (formType === 'cier') {
        cumulativeEnrollment.style.display = 'block';
        plannedEnrollment.style.display = 'none';
    } else {
        cumulativeEnrollment.style.display = 'none';
        plannedEnrollment.style.display = 'block';
    }
};
const handlePatientCountChange = () => {
    if (rawInputData.length > 0) {
        loadData(rawInputData);
    }
};

const exportCumulativeTableToCsv = (cumulativeInclusionData) => {
    const header1 = [
        '',
        'Not Hispanic',
        'Not Hispanic',
        'Not Hispanic',
        'Hispanic',
        'Hispanic',
        'Hispanic',
        'Unknown/Not Reported Ethnicity',
        'Unknown/Not Reported Ethnicity',
        'Unknown/Not Reported Ethnicity',
        ''
    ];
    const header2 = [
        'Racial Category',
        'Female',
        'Male',
        'Unknown/Not Reported',
        'Female',
        'Male',
        'Unknown/Not Reported',
        'Female',
        'Male',
        'Unknown/Not Reported',
        'Total'
    ];

    const rowData = [];
    rowData.push(header1.join(','));
    rowData.push(header2.join(','));

    cumulativeInclusionData.forEach(values => rowData.push(values.join(',')));

    return rowData.join('\r\n');
};

const exportPlannedTableToCsv = (ethnicPlannedData, racialPlannedData) => {
    const header1 = [
        'Ethnic Category',
        'Females',
        'Males',
        'Total'
    ];
    const header2 = [
        'Racial Categories',
        'Females',
        'Males',
        'Total'
    ];


    const rowData = [];
    rowData.push(header1.join(','));
    ethnicPlannedData.forEach(values => rowData.push(values.join(',')));

    rowData.push(header2.join(','));
    racialPlannedData.forEach(values => rowData.push(values.join(',')));

    rowData.push('');
    rowData.push('* The "Ethnic Category: Total of All Subjects" must be equal to the "Racial Categories: Total of All Subjects."');

    return rowData.join('\r\n');
};

const handleExportData = () => {
    const formType = formTypeSelect.options[formTypeSelect.selectedIndex].value;

    let content = (formType === 'cier')
            ? exportCumulativeTableToCsv(getCumulativeInclusionData(enrollments))
            : exportPlannedTableToCsv(getEthnicPlannedData(enrollments), getRacialPlannedData(enrollments));

    let blob = new Blob([content], {type: 'text/csv;charset=utf-8;'});

    const downloadLink = document.createElement("a");
    downloadLink.download = 'nih_enrollment.csv';
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.click();
};

/**
 * Add event listeners.
 */
const addEventListeners = () => {
    addFileDrapDropEventListeners();
    addFileSelectEventListeners();

    formTypeSelect.addEventListener('change', handleFormSwitch, false);
    patientCountsSelect.addEventListener('change', handlePatientCountChange, false);
    exportData.addEventListener('click', handleExportData, false);
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('copyright_year').textContent = new Date().getFullYear();

    addEventListeners();
    handleFormSwitch();
});