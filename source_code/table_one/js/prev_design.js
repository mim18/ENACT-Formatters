
const advanceToNextTab = () => {
    const nextTab = $('.nav-link.active').parent().next().find('button');
    nextTab.removeClass('disabled');

    (new bootstrap.Tab(nextTab)).show();
};
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
const addColumns = (table, startColumn, numOfCols) => {
    let rows = table.tBodies[0].rows;
    for (let colNum = startColumn; colNum < numOfCols; colNum++) {
        addLabelColumn(rows[0].insertCell(-1), colNum);
        for (let rowNum = 1; rowNum < rows.length; rowNum++) {
            let col = rows[rowNum].insertCell(-1);
        }
    }
};
const removeColumns = (table, currentCounts, numOfCols) => {
    let rows = table.tBodies[0].rows;
    while (currentCounts > numOfCols) {
        for (let rowNum = 0; rowNum < rows.length; rowNum++) {
            rows[rowNum].deleteCell(-1);
        }
        currentCounts--;
    }
};

const addTotalRow = (tbody) => {
    const row = tbody.insertRow(1);

    const cols = [];
    const numOfCols = parseInt($('#numOfCols').val());
    for (let colNum = 0; colNum < numOfCols; colNum++) {
        cols.push(row.insertCell(-1));
    }
    
    cols[0].outerHTML = `
<tr id="total">
    <th scope="row">Total</th>
    <td></td>
</tr>
`;
};

const addSettingsEventListeners = () => {
    $('input[name="datatype"]').on('change', () => {
        const table = document.getElementById('tableInput');
        const tbody = table.tBodies[0];
        const isQueryData = $('input[name="datatype"]:checked').val() === 'query';
        if (isQueryData) {
            addTotalRow(tbody);
        } else {
            tbody.deleteRow(1);
        }
    });

    $('#numOfCols').on('change', () => {
        const numOfCols = parseInt($('#numOfCols').val()) + 1;

        const table = document.getElementById('tableInput');
        const tbody = table.tBodies[0];
        const colCount = tbody.rows[0].cells.length;
        if (numOfCols < colCount) {
            removeColumns(table, colCount, numOfCols);
        } else if (numOfCols > colCount) {
            addColumns(table, colCount, numOfCols);
        }
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
const addWizardEventListeners = () => {
    $('#nextStep').on('click', () => {
        advanceToNextTab();
    });

    $('#prevStep').on('click', () => {
        const prevTab = $('.nav-link.active').parent().prev().find('button');

        (new bootstrap.Tab(prevTab)).show();
    });
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
    $('#noComorbidity').prop('checked', true);
};

$(document).ready(function () {
    addEventListeners();

    resetToDefault();
});