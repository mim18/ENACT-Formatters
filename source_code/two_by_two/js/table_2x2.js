const dropAreas = document.getElementsByClassName('dropArea');
const fileSelectors = document.getElementsByClassName('file_select');

const mapFiles = new Map();

const readInData = (fileId, csvFile) => {
    if (csvFile) {
        mapFiles.set(fileId, csvFile);

        const htmlCode = `<div class="alert alert-success" role="alert">
        <i class="bi bi-file-earmark-arrow-up"></i> ${csvFile.name}
</div>`;

        $(`#filename_${fileId}`).html(htmlCode);
    }
};

/**
 * Prevent default drag behaviors.
 */
const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
};
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
    for (const dropArea of dropAreas) {
        dropArea.addEventListener(event, preventDefaults, false);
    }
});

/**
 * Highlighting drop area when item is dragged over it.
 */
const highlight = (event) => event.target.classList.add('highlight');
['dragenter', 'dragover'].forEach(event => {
    for (const dropArea of dropAreas) {
        dropArea.addEventListener(event, highlight, false);
    }
});

/**
 * Remove highlighting from drop area when item is dropped.
 */
const unhighlight = (event) => event.target.classList.remove('highlight');
['dragleave'].forEach(event => {
    for (const dropArea of dropAreas) {
        dropArea.addEventListener(event, unhighlight, false);
    }
});

const handleDrop = (event) => {
    if (event.dataTransfer.items) {
        // use DataTransferItemList interface to access the file(s)
        [...event.dataTransfer.items].forEach((item, i) => {
            // If dropped items aren't files, reject them
            if (item.kind === "file") {
                const file = item.getAsFile();
                if (file.type === 'text/csv') {
                    const fileId = event.target.id.replace('droparea_', '');
                    readInData(fileId, file);
                }
            }
        });
    } else {
        // use DataTransfer interface to access the file(s)
        [...event.dataTransfer.files].forEach((file, i) => {
            const fileId = event.target.id.replace('droparea_', '');
            readInData(fileId, file);
        });
    }
};
['drop'].forEach(event => {
    for (const dropArea of dropAreas) {
        dropArea.addEventListener(event, handleDrop, false);
    }
});

const handleFileSelect = (event) => {
    if (event.target.files.length > 0) {
        const fileId = event.target.id.replace('file_', '');
        readInData(fileId, event.target.files[0]);
    }
    event.target.value = "";
};
for (const fileSelector of fileSelectors) {
    fileSelector.addEventListener('change', handleFileSelect, false);
}

const updateMainRowLabel = () => {
    const inputValue = $("#mainRowLabelInput").val();
    $("#mainRowLabel").text(inputValue);
};
const updateRow1Label = () => {
    const inputValue = $("#row1LabelInput").val();
    $("#row1Label").text(inputValue);
};
const updateRow2Label = () => {
    const inputValue = $("#row2LabelInput").val();
    $("#row2Label").text(inputValue);
};

const updateMainColumnLabel = () => {
    const inputValue = $("#mainColumnLabelInput").val();
    $("#mainColumnLabel").text(inputValue);
};
const updateColumn1Label = () => {
    const inputValue = $("#column1LabelInput").val();
    $("#column1Label").text(inputValue);
};
const updateColumn2Label = () => {
    const inputValue = $("#column2LabelInput").val();
    $("#column2Label").text(inputValue);
};