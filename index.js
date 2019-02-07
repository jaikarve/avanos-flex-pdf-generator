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
const fs = require('fs');
const {Base64Encode} = require('base64-stream');



function sendPDF(base64Doc, context, complete) {
    authenticateRedox()
    .then((authResponse) => {

        let axiosConfig = {
            headers: {
                "Content-Type":"application/json",
                "Authorization":"Bearer " + authResponse.data.accessToken
            }
        }
     
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
                "FileContents":base64Doc,
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
            //console.dir(responseData);
            var rawDataString = Buffer.from(base64Doc, 'base64');

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
                let fileId = resp.data._id;
                let gcsFileConfig = {
                    headers: {
                        "Content-Length": rawDataString.length,
                        "Content-Type":"application/pdf"
                    }
                }

                axios.put(resp.data._uploadURL, rawDataString, gcsFileConfig)
                .then((resp) => {
                    //console.dir(resp);
                    
                    let kvGetFileConfig = {
                        headers: {
                            "Authorization": "Basic a2lkX0h5SXNJMWtnRTpmY2Y0ZDQyZGI2MjY0ZTA1YWI4YTQwYzU4ZDg3NjE1ZA=="
                        }
                    }

                    let getURI = "https://kvy-us2-baas.kinvey.com/blob/kid_HyIsI1kgE/" + fileId;

                    axios.get(getURI, kvGetFileConfig)
                    .then((resp) => {
                        return complete().setBody({
                            "statusCode":200,
                            "downloadURL":resp.data._downloadURL
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
            .catch((err) => {
                console.dir(err);
                return complete().setBody(new Error("error")).badRequest().done();
            })
        })
        .catch((responseError) => {
            console.dir(responseError);
            //console.log(JSON.stringify(responseError.response));
            return complete().setBody(new Error("error")).badRequest().done();
        })
    })
    .catch((authError) => {
        console.log("Auth Error");
        return complete().setBody(new Error("Auth Error")).badRequest().done();
    });
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

        //console.dir("File upload: " + context.body.fileUpload);

        if(requestBody == null) {
            return complete().setBody({ "error": "must provide payload to convert"}).badRequest().done();
        }
        let doc = new PDFDocument();
        if(doc == null){
            return complete().setBody({ "error": "could not instantiate pdf document"}).runtimeError().done();  
        }
        
        
        /** process the document here  */
        //let lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam in suscipit purus.  Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Vivamus nec hendrerit felis. Morbi aliquam facilisis risus eu lacinia. Sed eu leo in turpis fringilla hendrerit. Ut nec accumsan nisl.'
        
        let finalString = ''; 
        var stream = doc.pipe(new Base64Encode());

        // draw some text

        doc.fontSize(25)
            .text('NG Tube Order Placement PDF', 
            {
                align: "center"    
            });
        doc.moveDown();
        doc.fontSize(25)
            .text(requestBody.patientName,
            {
                align: "center"
            });
        doc.moveDown();
        doc.fontSize(25)
            .text("Date Of Birth: " + requestBody.patientDOB,
            {
                align: "center"
            });
        doc.moveDown();
        doc.fontSize(16)
            .text("Placement Date: " + requestBody.placementDate,
            {
                align: "left"
            });
        doc.moveDown();
        doc.text("Placement Time: " + requestBody.placementTime);
        doc.moveDown();
        doc.text("Placement Site: " + requestBody.site);
        doc.moveDown();
        doc.text("Tube Length: " + requestBody.tubeLength);
        doc.moveDown();
        doc.text("French Size: " + requestBody.frenchSize);
        doc.moveDown();
        doc.text("Order ID: " + requestBody.orderId);
        doc.moveDown();
        doc.text("Lot Size: " + requestBody.lotNumber);
        doc.moveDown();
        doc.addPage();
        doc.fontSize(25)
            .text("Placement Images",
            {
                align: "center"
            });
        doc.moveDown();

        doc.image(context.body.imageUrl1);

        doc.moveDown();

        doc.image(context.body.imageUrl2);
   
        // end and display the document in the iframe to the right
        doc.end();

        stream.on('data', function(chunk) {
            finalString += chunk;
        });

        stream.on('end', function() {
            //let pdfBytes = stream.toString();

            sendPDF(finalString, context, complete);
        });
    });
});