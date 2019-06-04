function OcrSubmitter(formId) {
    this.form = $("#" + formId);
    this.progressBar = this.form.find(".progress");
    this.previewImg = this.form.find(".preview_img");
    this.dropZone = this.form.find(".drop_zone");
    this.meta = this.form.find(".meta");
    this.result = this.form.find(".result");
    this.error = this.form.find(".error");

    this.displayError = function(error) {
        this.previewImg.hide();
        this.meta.show();
        this.progressBar.hide();
        this.error.show().find("[data-type='error-msg']").html(error);
    };

    this.errorHandler = function(evt) {
        switch (evt.target.error.code) {
        case evt.target.error.NOT_FOUND_ERR:
            this.displayError('Nie znaleziono pliku!');
            break;
        case evt.target.error.NOT_READABLE_ERR:
            this.displayError('Plik niemożliwy do odczytu');
            break;
        case evt.target.error.ABORT_ERR:
            break; // noop
        default:
            this.displayError('Wystąpił błąd podczas odczytywania pliku.');
        };
    };

    this.updateProgress = function(parent, percent) {
        parent.progressBar.find(".progress-bar").attr("aria-valuenow", percent);
        parent.progressBar.find(".progress-bar").width(percent + '%');
        parent.progressBar.find(".progress-bar").html(percent + '%');
    };

    this.updateLoadImageProgress = function(parent, evt) {
        if (evt.lengthComputable) {
            var percentLoaded = Math.round((evt.loaded / evt.total) * 100 * 8 / 10);
            if (percentLoaded < 100) {
                parent.updateProgress(parent, percentLoaded);
            }
        }
    };

    this.startReadingFile = function(parent) {
        parent.updateProgress(parent, 0);
        parent.dropZone.removeClass("hover");
        parent.progressBar.show();
        parent.meta.hide();
        parent.error.hide();
        parent.previewImg.hide();
        parent.result.html("<td colspan=\"2\">Brak wyniku</td>");
    };

    this.previewFile = function(file) {
        var parent = this;

        var reader = new FileReader();
        reader.onerror = this.errorHandler;
        reader.onprogress = function(evt) {
            parent.updateLoadImageProgress(parent, evt);
        };
        reader.onloadstart = function(e) {
            parent.startReadingFile(parent);
        };
        reader.onloadend = function() {
            parent.updateProgress(parent, 85);

            parent.preprocessImage(parent, reader.result).then(function(imgData) {
                parent.updateProgress(parent, 90);

                parent.submitImage(parent, imgData).then(function(data) {
                    parent.updateProgress(parent, 100);
                    parent.progressBar.hide();
                    parent.previewImg.attr("src", reader.result);
                    parent.previewImg.show();
                    
                    var result = parent.sortProperties(data.result).map(function(property) {
                        return "<tr><td>" + property[0] + "</td><td>" + property[1] + "</td></tr>";
                    }).join("<br>");

                    parent.result.html(result);
                }).catch(function(error) {
                    error = JSON.parse(error);
                    if(error.error != undefined)
                    {
                        parent.result.html('<tr><td colspan="2"><div class="alert alert-danger" role="alert" id="demo"><strong>BŁĄD: </strong>' + error.error.details + '</div></td></tr>');
                        parent.displayError("");
                    }
                    else{
                        parent.displayError(JSON.stringify(error));        
                    }
                });
            }).catch(function(error) {
                parent.displayError(error);
            });
        };

        if (file) {
            reader.readAsDataURL(file);
        } else {
            this.previewImg.attr("src", "");
        }
    };

    this.sortProperties = function(obj) {
        var sortable = [];
        for (var key in obj)
            if (obj.hasOwnProperty(key))
                sortable.push([key, obj[key]]);

        // sort items by value
        sortable.sort(function(a, b) {
            var x = a[0].toLowerCase(),
                y = b[0].toLowerCase();
            return x < y ? -1 : x > y ? 1 : 0;
        });
        return sortable;

    };

    this.preprocessImage = function(parent, src) {
        return new Promise(function(resolve, reject) {
            parent.getImage(src).then(function(image) {
                var canvas = document.createElement('canvas');

                parent.resizeImage(canvas, image);
                parent.grayscaleImage(canvas);

                var dataUrl = canvas.toDataURL('image/jpeg');
                var resizedImage = parent.dataURLToBlob(dataUrl);
                resolve({ url: dataUrl, blob: resizedImage });
            }).catch(function(error) {
                reject(error);
            });
        });
    };

    this.grayscaleImage = function(canvas) {
        var inputContext = canvas.getContext('2d');
        var imageData = inputContext.getImageData(0, 0, canvas.width, canvas.height);
        var data = imageData.data;
        var arrayLength = canvas.width * canvas.height * 4;

        for (var i = arrayLength - 1; i > 0; i -= 4) {
            var R = i - 3,
                G = i - 2,
                B = i - 1;

            var gray = 0.3 * data[R] + 0.59 * data[G] + 0.11 * data[B];

            data[i - 3] = gray;
            data[i - 2] = gray;
            data[i - 1] = gray;
        }

        inputContext.putImageData(imageData, 0, 0);
    };

    this.getImage = function(src) {
        return new Promise(function(resolve, reject) {
            var image = new Image();
            image.onload = function() {
                resolve(image);
            };
            image.onerror = function(e) {
                reject(e.responseText);
            };
            image.src = src;
        });
    };

    this.resizeImage = function(canvas, image) {
        var maxSize = 3000,
            width = image.width,
            height = image.height;
        if (width > height) {
            if (width > maxSize) {
                height *= maxSize / width;
                width = maxSize;
            }
        } else {
            if (height > maxSize) {
                width *= maxSize / height;
                height = maxSize;
            }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    };

    this.submitImage = function(parent, imageData) {
        return new Promise(function(resolve, reject) {
            console.log(parent.form);
            var fd = new FormData(parent.form[0]);
            fd.append("docfile", imageData.blob, "file.jpg");

            $.ajax({
                url: parent.form[0].action,
                type: parent.form[0].method,
                data: fd,
                crossDomain: true,
                processData: false,
                contentType: false,
                cache: false,
                success: function(data) {
                    resolve(data);
                },
                error: function(e) {
                    reject(e.responseText);
                }
            });
        });
    };

    this.dataURLToBlob = function(dataURL) {
        var BASE64_MARKER = ';base64,';
        if (dataURL.indexOf(BASE64_MARKER) == -1) {
            var parts = dataURL.split(',');
            var contentType = parts[0].split(':')[1];
            var raw = parts[1];

            return new Blob([raw], { type: contentType });
        }

        var parts = dataURL.split(BASE64_MARKER);
        var contentType = parts[0].split(':')[1];
        var raw = window.atob(parts[1]);
        var rawLength = raw.length;

        var uInt8Array = new Uint8Array(rawLength);

        for (var i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }

        return new Blob([uInt8Array], { type: contentType });
    };

    this.Run = function() {
        var parent = this;
        var imgInput = this.form.find(".choose_file").find("input");
        imgInput.on("change",
            function(e) {
                parent.previewFile(e.originalEvent.target.files[0]);
            });

        this.dropZone.on("dragover",
            function() {
                $(this).addClass("hover");
                return false;
            });

        this.dropZone.on("dragleave",
            function() {
                $(this).removeClass("hover");
                return false;
            });

        this.dropZone.on("drop",
            function(e) {
                e.preventDefault();
                e.stopPropagation();
                parent.previewFile(e.originalEvent.dataTransfer.files[0]);
            });
    };
}