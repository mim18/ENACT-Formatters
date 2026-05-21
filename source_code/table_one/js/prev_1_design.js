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

const addDemoVariable = () => {
    const textInput = document.getElementById('demVarInput');
    const item = textInput.value.trim();
    textInput.value = ''; // clear input text
    if (item !== '') {
        const table = document.getElementById('tableInput');
        const row = table.tBodies[1].insertRow();

        row.insertCell(-1).outerHTML = `<th scope="row">${item}</th>`;

        const numOfCols = parseInt($('#numOfCols').val());
        for (let colNum = 1; colNum < numOfCols; colNum++) {
            row.insertCell(-1);
        }
    }
};
const addLabelColumn = (column, colNum) => {
    column.classList.add('text-center');
    column.innerHTML = `
<label for="col${colNum}LabelInput">
    <span class="h6 fw-bold" id="col${colNum}Label">Column ${colNum} <i class="bi bi-pencil"></i></span>
    <input type="text" aria-label="Column ${colNum} label" class="form-control" id="col${colNum}LabelInput" name="col${colNum}LabelInput" value="" required="required" style="display: none;" />
</label>
`;

    const name = `col${colNum}Label`;
    $(`#${name}`).on('dblclick', () => switchToEditMode(name));
    $(`#${name}Input`).on('focusout', () => switchToLabelMode(name));
    $(`#${name}Input`).on('keypress', event => saveOnEnter(event, name));
};
const addColumns = (table, currNumOfCols, numOfCols) => {
    const tbodies = table.tBodies;
    for (let i = 0; i < tbodies.length; i++) {
        const rows = tbodies[i].rows;
        for (let r = 0; r < rows.length; r++) {
            if (i === 1 && r === 1) {
                continue;
            }

            for (let c = currNumOfCols; c < numOfCols; c++) {
                rows[r].insertCell(-1);
            }
        }
    }

    for (let colNum = currNumOfCols; colNum < numOfCols; colNum++) {
        addLabelColumn(tbodies[0].rows[0].cells[colNum], colNum);
    }

    tbodies[1].rows[1].cells[0].colSpan = numOfCols + 1;
};
const removeColumns = (table, numOfCols) => {
    const tbodies = table.tBodies;
    for (let i = 0; i < tbodies.length; i++) {
        const rows = tbodies[i].rows;
        for (let r = 0; r < rows.length; r++) {
            if (i === 1 && r === 1) {
                continue;
            }

            while (rows[r].cells.length > numOfCols) {
                rows[r].deleteCell(-1);
            }
        }
    }

    tbodies[1].rows[1].cells[0].colSpan = numOfCols + 1;
};

const adjustDataType = () => {
    const table = document.getElementById('tableInput');

    const isQueryData = $('input[name="datatype"]:checked').val() === 'query';
    if (isQueryData) {
        table.tBodies[1].style.display = '';
        table.tBodies[2].style.display = 'none';
    } else {
        table.tBodies[1].style.display = 'none';
        table.tBodies[2].style.display = '';
    }
};
const adjustNumOfCols = () => {
    const numOfCols = parseInt($('#numOfCols').val()) + 1;

    const table = document.getElementById('tableInput');
    const currNumOfCols = table.tBodies[0].rows[0].cells.length;
    if (currNumOfCols < numOfCols) {
        addColumns(table, currNumOfCols, numOfCols);
    } else if (currNumOfCols > numOfCols) {
        removeColumns(table, numOfCols);
    }
};

const addSettingsEventListeners = () => {
    $('input[name="datatype"]').on('change', adjustDataType);
    $('#numOfCols').on('change', adjustNumOfCols);
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
const addLabelEventListeners = () => {
    const numOfCols = parseInt($('#numOfCols').val());
    for (let i = 1; i <= numOfCols; i++) {
        const name = `col${i}Label`;
        $(`#${name}`).on('dblclick', () => switchToEditMode(name));
        $(`#${name}Input`).on('focusout', () => switchToLabelMode(name));
        $(`#${name}Input`).on('keypress', event => saveOnEnter(event, name));
    }
};

const addEventListeners = () => {
    addLabelEventListeners();
    addWizardEventListeners();
    addSettingsEventListeners();

    $('#inputLabels').on('submit', e => e.preventDefault());
};

const resetToDefault = () => {
    $('#numOfCols option').eq(0).prop('selected', true);
    $('#demQuery').prop('checked', true);
    $('#demVarInput').val('');

    adjustDataType();
    adjustNumOfCols();
};

$(document).ready(function () {
    addEventListeners();
    resetToDefault();
});