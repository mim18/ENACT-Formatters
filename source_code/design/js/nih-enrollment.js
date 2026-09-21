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

// list of variables to exclude from data
const varsToExclude = [
    'NIH Enrollment American Indian or Alaska Native-Female-No Ethnicity Info',
    'NIH Enrollment White-No Sex Info-No Ethnicity Info',
    'NIH Enrollment White-No Sex Info-Not Hispanic'
];
const excludedVars = new Set(varsToExclude.map(item => item.replace('NIH Enrollment', '').trim()));

const rawInputData = [];

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

                resolve(sitesIncluded);
            }
        });
    });
};
const readInBreakdownQueryData = (csvFile, validSites) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            complete: function (results) {
                const rawData = [];
                const lines = results.data;
                // at least 2 lines
                if (lines.length > 1) {
                    // get valid columns (sites)
                    const sites = lines[0];
                    const isValidSites = new Array(sites.length).fill(false);
                    for (let i = 2; i < sites.length; i++) {
                        isValidSites[i] = validSites.has(sites[i].trim());
                    }

                    const lineData = [];
                    for (let i = 2; i < lines.length; i++) {
                        const data = lines[i];
                        if (data.length !== sites.length) {
                            continue;
                        }

                        const variable = data[0].replace('NIH Enrollment', '').trim();
                        if (excludedVars.has(variable)) {
                            continue;
                        }

                        lineData.push(variable);
                        for (let j = 2; j < data.length; j++) {
                            if (isValidSites[j]) {
                                lineData.push(data[j].trim().toLowerCase());
                            }
                        }
                    }
                    rawData.push(lineData);
                }
                resolve(rawData);
            }
        });
    });
};

const buildForms = async (csvFile) => {
    // display file name
    fileNameDisplay.textContent = csvFile.name;
    fileNameDisplay.style.display = 'block';

    const sitesIncluded = await getBreakdownQueryValidSitesTask(csvFile);
    const rawData = await readInBreakdownQueryData(csvFile, sitesIncluded);
    
    rawInputData.length = 0;
//    rawInputData.push(...rawData);
    console.info(rawData.length);
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
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => dropArea.addEventListener(event, preventDefaults));

    // highlighting drop area when item is dragged over it
    const highlight = (event) => event.target.classList.add('highlight');
    ['dragenter', 'dragover'].forEach(event => dropArea.addEventListener(event, highlight));

    // remove highlighting from drop area when item is dropped
    const unhighlight = (event) => event.target.classList.remove('highlight');
    dropArea.addEventListener('dragleave', unhighlight);

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
    dropArea.addEventListener('drop', handleFileDrop);
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

/**
 * Add event listeners.
 */
const addEventListeners = () => {
    addFileDrapDropEventListeners();
    addFileSelectEventListeners();

    formTypeSelect.addEventListener('change', handleFormSwitch, false);
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('copyright_year').textContent = new Date().getFullYear();

    addEventListeners();
    handleFormSwitch();
});