const totalFiles = new Map();

let additionalVarId = 0;
const additionalVarFiles = new Map();


const switchToEditMode = (name) => {
    const labelElement = $(`#${name}`);
    const inputElement = $(`#${name}Input`);

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
    const inputElement = $(`#${name}Input`);
    const textElement = $(`.${name}Text`);

    // update the label's text with the input's value
    const value = inputElement.val().trim();
    labelElement.html(`${value} <i class="bi bi-pencil"></i>`);
    textElement.text(value);

    if ($('#inputLabels').valid()) {
        // Hide the input and show the label
        inputElement.hide();
        labelElement.show();

        $('#step2btn').prop('disabled', false);
    } else {
        $('#step2btn').prop('disabled', true);
    }
};
const saveOnEnter = (event, name) => {
    if (event.key === 'Enter') {
        switchToLabelMode(name);
    }
};

const saveFileTotal = (fileId, csvFile) => {
    totalFiles.set(fileId, csvFile);

    const htmlCode = `<div class="alert alert-info p-2 m-0 mt-4" role="alert"><i class="bi bi-file-earmark-arrow-up"></i> ${csvFile.name}</div>`;
    $(`#filename_${fileId}`).html(htmlCode);
};
const saveFileDemographics = (fileId, csvFile) => {
    const htmlCode = `<div class="alert alert-info p-2 m-0 mt-4" role="alert"><i class="bi bi-file-earmark-arrow-up"></i> ${csvFile.name}</div>`;
    $(`#filename_${fileId}_query`).html(htmlCode);
};
const saveFileComorbidity = (fileId, csvFile) => {
    const htmlCode = `<div class="alert alert-info p-2 m-0 mt-4" role="alert"><i class="bi bi-file-earmark-arrow-up"></i> ${csvFile.name}</div>`;
    $(`#filename_${fileId}`).html(htmlCode);
};

const removeAddVar = (trashObj) => {
    const listItem = trashObj.parentElement;
    const addVarId = listItem.id;
    const list = listItem.parentElement;

    additionalVarFiles.delete(addVarId);

    list.removeChild(listItem);
};
const saveFileAdditionalVars = (fileId, csvFile) => {
    const addVarId = `addVar${additionalVarId++}`;
    const name = `${addVarId}Label`;

    const htmlList = document.getElementById('additional_var_list');
    const li = document.createElement('li');
    li.id = addVarId;
    li.className = 'list-group-item list-group-item-info bg-opacity-10 border border-info';
    li.innerHTML = `
<label for="${name}Input">
    <span class="h6" id="${name}">${csvFile.name} <i class="bi bi-pencil"></i></span>
    <input type="text" aria-label="Column 1 input label" class="form-control" id="${name}Input" name="${name}Input" value="" required="required" style="display: none;" />
</label>
<a class="text-danger float-end" title="Delete" onclick="removeAddVar(this);"><i class="bi bi-trash3"></i></a>
`;
    htmlList.appendChild(li);


    $(`#${name}`).on('dblclick', () => switchToEditMode(name));
    $(`#${name}Input`).on('focusout', () => switchToLabelMode(name));
    $(`#${name}Input`).on('keypress', event => saveOnEnter(event, name));

    additionalVarFiles.set(addVarId, csvFile);
};

const saveInputData = (dropAreaId, fileId, csvFile) => {
    if (fileId && csvFile) {
        switch (dropAreaId) {
            case 'droparea_total':
                saveFileTotal(fileId, csvFile);
                break;
            case 'droparea_demographics':
                saveFileDemographics(fileId, csvFile);
                break;
            case 'droparea_comorbidity':
                saveFileComorbidity(fileId, csvFile);
                break;
            case 'droparea_additional_var':
                saveFileAdditionalVars(fileId, csvFile);
                break;
        }
    }
};


const addWizardEventListeners = () => {
    $('#nextStep').on('click', () => {
        const nextTab = $('.nav-link.active').parent().next().find('button');
        nextTab.removeClass('disabled');

        (new bootstrap.Tab(nextTab)).show();
    });

    $('#prevStep').on('click', () => {
        const prevTab = $('.nav-link.active').parent().prev().find('button');

        (new bootstrap.Tab(prevTab)).show();
    });
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
        event.target.classList.remove('highlight');

        const dropAreaId = event.target.id;
        if (event.originalEvent.dataTransfer.items) {
            // use DataTransferItemList interface to access the file(s)
            [...event.originalEvent.dataTransfer.items].forEach(item => {
                // If dropped items aren't files, reject them
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file.type === 'text/csv') {
                        const fileId = event.target.id.replace('droparea_', '');
                        saveInputData(dropAreaId, fileId, file);
                    }
                }
            });
        } else {
            // use DataTransfer interface to access the file(s)
            [...event.originalEvent.dataTransfer.files].forEach(file => {
                const fileId = event.target.id.replace('droparea_', '');
                saveInputData(dropAreaId, fileId, file);
            });
        }
    };
    $('.dropArea').on('drop', handleFileDrop);

    $('#inputLabels').on('submit', preventDefaults);
};

const addEventListeners = () => {
    addWizardEventListeners();
    addFileDrapDropEventListeners();
};

$(document).ready(function () {
    addEventListeners();
});