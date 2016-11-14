# karma-google-sheets
A Karma plugin to access Google sheet data to use in unit testing

## Configuration Sample
```javascript
module.export = function(config){
    config.set({
        frameworks:['google-sheets'],
        gsheets:{
            auth:{//Sample service account authentication parameters
                "type": "service_account",
                "project_id": "??",
                "private_key_id": "??",
                "private_key": "-----BEGIN PRIVATE KEY-----\n????==\n-----END PRIVATE KEY-----\n",
                "client_email": "??@??.gserviceaccount.com",
                "client_id": "###",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://accounts.google.com/o/oauth2/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/??appspot.gserviceaccount.com"
            },
            docs:{
                "sheet1": {
                    doc_id: '{{google doc unique ID}}',
                    sheet: '{{sheet_name}}',
                    index_by: '{{optional indexing column name}}',
                    fields_row: 1, //If index_by is set, provide the header row that contains the field names ( default is 1 )
                    lookup: '{{optional substitution sheet name}}', // substitues values prefixed with $
                    //auth: {}//optional: if this document uses different authentication parmeters
                },
                "sheet2": {
                    doc_id: '{{google doc unique ID}}',
                    sheet: '{{sheet_name}}',
                    index_by: '{{optional indexing column name}}',
                    fields_row: 1, // the header row that contains the field names ( default is 1 )
                    lookup: '{{optional substitution sheet name}}', // substitues values prefixed with $
                    //auth: {}//optional: if this document uses different authentication parmeters
                }
            }
        }
    });
});
```
## Accessing Sheets data in unit test script
```javascript
    //process all cells
    gsheets.sheet1.forEach(function(cell){
        //read cell info
    });
    //extract the second row cells
    var second_row_cells = gsheets.sheet2.filter(function(cell){
        return cell.row === 2;
    });
    //read indexed table record
    var record = gsheets.sheet2[record_id];
```
## Google service account authentication guide
[Click here for more information](https://www.npmjs.com/package/google-spreadsheet#service-account-recommended-method)
