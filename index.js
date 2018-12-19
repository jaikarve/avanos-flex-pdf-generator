/**
 * sample to generate a pdf
 * inputs: 
 *      format: return the payload as a raw string vs base64 encoded (*raw/base64)
 *  prerequisites:
 * npm install --save kinvey-flex-sdk pdfkit memory-streams base-64
 * see http://pdfkit.org/ on how to generate PDF document
 * customer must process input data as per requirment and "render" the pdf
 */

const sdk = require('kinvey-flex-sdk');
const PDFDocument = require('pdfkit');
const ms = require('memory-streams');
const b64 = require('base-64');
const axios = require('axios');


function sendPDF(doc, context, complete) {
    authenticateRedox()
    .then((authResponse) => {

        let axiosConfig = {
            headers: {
                "Content-Type":"application/json",
                "Authorization":"Bearer " + authResponse.data.accessToken
            }
        }

        let responseStream =  new ms.WritableStream();
        let stream = doc.pipe(responseStream);
        stream.on('finish', function() {
            let pdfBytes = stream.toString();
            var encoded = Buffer.from(pdfBytes).toString('base64')

            //console.log("Encoded base64: " + encoded);

            console.log("PDF Bytes length: " + pdfBytes.length);
                
            let postData = {
                "Meta":{
                    "DataModel":"Media",
                    "EventType":"New"
                },
                "Patient":{
                    "Identifiers":[
                        {
                            "ID":"0000000001",
                            "IDType":"MR"
                        }
                    ]
                },
                "Media":{
                    "FileType":"PDF",
                    "FileName":"Sample",
                    "FileContents":encoded,
                    "DocumentType": "Feeding Tube Placement",
                        "DocumentID":"b124567",
                        "Provider":{
                            "ID":"8675309"
                        },
                    "Availability":"Available"
                }
            };

            axios.post("https://api.redoxengine.com/endpoint",
                postData, axiosConfig)
            .then((responseData) => {

                let kvFileConfig = {
                    headers: {
                        "Content-Type":"application/json",
                        "Authorization": "Basic a2lkX0h5SXNJMWtnRTpmY2Y0ZDQyZGI2MjY0ZTA1YWI4YTQwYzU4ZDg3NjE1ZA==",
                        "X-Kinvey-Content-Type":"application/pdf"
                    }
                }

                let kvFilePostData = {
                    "_filename": "myFilename.pdf",
                    "myProperty": "some metadata",
                    "someOtherProperty": "some more metadata",
                    "mimeType":"application/pdf"
                }

                axios.post("https://kvy-us2-baas.kinvey.com/blob/kid_HyIsI1kgE",
                    kvFilePostData, kvFileConfig)
                .then((resp) => {
                    //console.dir(resp);
                    let gcsFileConfig = {
                        headers: {
                            "Content-Length": pdfBytes.length,
                            "Content-Type":"application/pdf"
                        }
                    }

                    console.log("Upload URL: " + resp.data._uploadURL);

                    axios.put(resp.data._uploadURL, pdfBytes, gcsFileConfig)
                    .then((resp) => {
                        console.dir(resp);
                        return complete().setBody({
                            "statusCode":200,
                            "uga buga":true
                        }).ok().done();
                    })
                    .catch((err) => {
                        console.dir(err);
                        return complete().setBody(new Error("error")).badRequest().done();
                    })
                })
                .catch((err) => {
                    console.dir(err);
                    return complete().setBody(new Error("error")).badRequest().done();
                })
            })
            .catch((responseError) => {
                console.log("Response error: ");
                console.log(JSON.stringify(responseError.response.data.Meta));
                return complete().setBody(new Error("error")).badRequest().done();
            })
        });
    })
    .catch((authError) => {
        return complete().setBody(new Error(authError)).unauthorized().done();
    })
}

async function authenticateRedox() {

    let axiosConfig = {
        headers: {
            "Content-Type":"application/json"
        }
    };

    let postData = {
        "apiKey": "af349d10-5349-4f5a-93ca-ec314a0f5de5",
        "secret": "jVIS8DWse13xEhBxvT6vm7VU3kbuZr1bCj6CoG9EcAma13d9SKnZwJtUZVTHF5iua6AiwLua"
    };

    try {
        return await axios.post("https://api.redoxengine.com/auth/authenticate",
            postData, axiosConfig);
    }
    catch(authError) {
        throw new Error(authError.response.statusText);
    }
}

sdk.service((err, flex) => {
    if(err){
        console.log("could not initialize flex!");
        return;
    }

    let f = flex.functions;
    f.register('generate', function(context, complete, modules){
        let requestBody = context.body;

        if(requestBody == null) {
            return complete().setBody({ "error": "must provide payload to convert"}).badRequest().done();
        }
        let doc = new PDFDocument();
        if(doc == null){
            return complete().setBody({ "error": "could not instantiate pdf document"}).runtimeError().done();  
        }
        
        /** process the document here  */
        let lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam in suscipit purus.  Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Vivamus nec hendrerit felis. Morbi aliquam facilisis risus eu lacinia. Sed eu leo in turpis fringilla hendrerit. Ut nec accumsan nisl.'
        doc.fontSize(8);
        doc.text('This text is left aligned. ' + lorem, {
            width: 410,
            align: 'left'
        });

        doc.moveDown();
        doc.text('This text is left aligned. ' + lorem, {
            width: 410,
            align: 'center'
        });
        doc.moveDown();
        doc.text('This text is justified. ' + lorem, {
            width: 410,
            align: 'justify'
        });
            
        doc.rect(doc.x, 0, 410, doc.y).stroke();
        doc.end();
        /** end processing the document  */

        sendPDF(doc, context, complete);

        /*
        authenticateRedox()
        .then((redoxAuthResponse) => {
            //flex.logger.info("Response is: " + JSON.stringify(redoxAuthResponse));
            let responseStream =  new ms.WritableStream();
            let stream = doc.pipe(responseStream);
            stream.on('finish', function(){
                let pdfBytes = stream.toString();
                var encoded = Buffer.from(pdfBytes).toString('base64')

                    return complete().setBody(
                        {
                            "PDFBytes": encoded,
                            "accessToken":redoxAuthResponse.data.accessToken
                        }
                    ).ok().done();
            });
        })
        .catch((authError) => {
            return complete().setBody(new Error(authError)).unauthorized().done();
        });*/
    });
});