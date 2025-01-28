/**
 * enact-formatter.js
 * 
 * @description This file contains methods for formatting data for display and
 * export.
 * @author Kevin V. Bui
 */

const enrollments = [];
const rawInputData = [];

const dropArea = document.getElementById('dropArea');
const csvFileSelect = document.getElementById('selectCsvFile');
const formTypeSelect = document.getElementById('selectFormType');
const exportData = document.getElementById('exportData');
const patientCountsSelect = document.getElementById('selectPatientCounts');

const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
};
const highlight = (event) => event.target.classList.add('highlight');
const unhighlight = (event) => event.target.classList.remove('highlight');

const tallyCounts = (data) => {
    return data
            .filter(num => num !== '')
            .map(num => parseInt(num))
            .reduce((accumulator, currentValue) => accumulator + currentValue);
};
const getCounts = (line, enrollments, countsForTenOrLess) => {
    const data = Papa.parse(line).data[0]
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
    return  Array.from(enrollmentData, ([key, value]) => value);
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
    ethnicity = 'Ethnic Category: Total of All Subjects *';
    data[0] = ethnicity;
    enrollmentData.forEach((values, keys) => {
        // tally counts down rows
        for (let i = 1; i < values.length; i++) {
            data[i] += values[i];
        }
    });
    enrollmentData.set(ethnicity, data);

    // create enrollment data from map to array
    return  Array.from(enrollmentData, ([key, value]) => value);
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
    race = 'Racial Categories: Total of All Subjects *';
    data[0] = race;
    enrollmentData.forEach((values, keys) => {
        // tally counts down rows
        for (let i = 1; i < values.length; i++) {
            data[i] += values[i];
        }
    });
    enrollmentData.set(race, data);

    // create enrollment data from map to array
    return  Array.from(enrollmentData, ([key, value]) => value);
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
    const table = document.getElementById('cumulativeEnrollment');

    let tbody = table.getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    const lastIndex = data.length - 1;
    for (let i = 0; i < lastIndex; i++) {
        addRowToCumulativeTable(data[i], tbody);
    }

    let tfoot = table.getElementsByTagName('tfoot')[0];
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
    const table = document.getElementById('plannedEnrollment');

    let tbody = table.getElementsByTagName('tbody')[0];
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

    let tfoot = table.getElementsByTagName('tfoot')[0];
    tfoot.innerHTML = '';
    addRowToPlannedTable(racialPlannedData[lastIndex], tfoot);
};

const loadData = (rawInputData) => {
    // clear the array
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
const loadCsvFile = (event) => {
    // clear the array
    rawInputData.length = 0;

    // populate the enrollments array with the data
    event.target.result
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== '')
            .slice(2)
            .forEach(line => rawInputData.push(line));

    loadData(rawInputData);
};

const readInData = (csvFile) => {
    const reader = new FileReader();
    reader.onload = loadCsvFile;
    reader.readAsText(csvFile);
};

const handleDrop = (event) => {
    if (event.dataTransfer.items) {
        // use DataTransferItemList interface to access the file(s)
        [...event.dataTransfer.items].forEach((item, i) => {
            // If dropped items aren't files, reject them
            if (item.kind === "file") {
                const file = item.getAsFile();
                if (file.type === 'text/csv') {
                    readInData(file);
                }
            }
        });
    } else {
        // use DataTransfer interface to access the file(s)
        [...event.dataTransfer.files].forEach((file, i) => {
            readInData(file);
        });
    }
};
const handleFileSelect = (event) => {
    if (event.target.files.length > 0) {
        readInData(event.target.files[0]);
    }
    event.target.value = "";
};

const handleFormSwitch = (event) => {
    const cumulativeEnrollment = document.getElementById('cumulativeEnrollment');
    const plannedEnrollment = document.getElementById('plannedEnrollmentForm');

    const formTypeSelect = document.getElementById('selectFormType');
    const formType = formTypeSelect.options[formTypeSelect.selectedIndex].value;
    if (formType === 'cier') {
        plannedEnrollment.style.display = 'none';
        cumulativeEnrollment.style.display = 'table';
    } else {
        cumulativeEnrollment.style.display = 'none';
        plannedEnrollment.style.display = 'block';
    }
};

const handlePatientCountChange = (event) => {
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
    const formTypeSelect = document.getElementById('selectFormType');
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
 * Prevent default drag behaviors.
 */
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
    dropArea.addEventListener(event, preventDefaults, false);
});

/**
 * Highlighting drop area when item is dragged over it.
 */
['dragenter', 'dragover'].forEach(event => {
    dropArea.addEventListener(event, highlight, false);
});

/**
 * Remove highlighting from drop area when item is dropped.
 */
['dragleave', 'drop'].forEach(event => {
    dropArea.addEventListener(event, unhighlight, false);
});

/**
 * Add event listeners.
 */
dropArea.addEventListener('drop', handleDrop, false);
csvFileSelect.addEventListener('change', handleFileSelect, false);
formTypeSelect.addEventListener('change', handleFormSwitch, false);
patientCountsSelect.addEventListener('change', handlePatientCountChange, false);
exportData.addEventListener('click', handleExportData, false);

handleFormSwitch();