/**
 * Created by Ramy Eldesoky on 10/31/2016.
 */

//Reference document found at https://www.npmjs.com/package/google-spreadsheet
var GoogleSpreadsheet = require('google-spreadsheet');

var async = require('async');

module.exports = {
    "framework:google-sheets":['factory',function(config){
        var gsh_folder = config.basePath + '/test/.gsheets';

        //Preprocessor will read the document parameters from the written content and replace it with data from Google APIs
        config.preprocessors[gsh_folder + '/*.gsh'] = ['google-sheets'];

        //link the documents JSON to debug.html
        config.files.unshift({pattern: gsh_folder + '/*.gsh', included: true, served: true, watched: false});

        if( typeof config.gsheets !== 'object' ){
            return;//Not using config to define imported sheets
        }

        // re-create the data folder and add files containing documents with initial parameters
        var fse = require('fs-extra');
        fse.removeSync(gsh_folder);
        fse.mkdirSync(gsh_folder);

        for(var doc_ref in config.gsheets.docs){
            if(config.gsheets.docs.hasOwnProperty(doc_ref)) {
                fse.writeFileSync(gsh_folder + '/' + doc_ref + '.gsh', JSON.stringify(config.gsheets.docs[doc_ref],undefined,2));
            }
        }
    }],
    "preprocessor:google-sheets":['factory',function(config){
        return function(content,file,onFinish){
            var doc_ref = file.path.match(/(\w+)\.gsh$/)[1];
            file.path += '.js';// append .js to script->src
            var query = JSON.parse(content);
            var auth = query.auth || ( config.gsheets ? config.gsheets.auth : undefined );
            openDoc(query.doc_id, auth, function( err, reader ){
                if(err){
                    onFinish('window.gsheets=window.gsheets||{};\nwindow.gsheets.' + doc_ref + '=' + JSON.stringify({error:err}, undefined,2) + ';');
                    return;
                }
                reader.readSheet(query,function(err, sheet_data){
                    if(err){
                        onFinish('window.gsheets=window.gsheets||{};\nwindow.gsheets.' + doc_ref + '=' + JSON.stringify({error:err}, undefined,2) + ';');
                    }
                    else{
                        onFinish('window.gsheets=window.gsheets||{};\nwindow.gsheets.' + doc_ref + "=" + JSON.stringify(sheet_data,undefined,2) + ';');
                    }

                });
            });
        }
    }]
};

function openDoc(docID, auth_params, callback){
    // https://www.npmjs.com/package/google-spreadsheet#new-googlespreadsheetsheet_id-auth-options
    // spreadsheet key is the long id in the sheets URL
    var doc = new GoogleSpreadsheet(docID);
    var docInfo;

    async.waterfall([
        function(next){
            //Authenticate via service account
            //https://www.npmjs.com/package/google-spreadsheet#googlespreadsheetuseserviceaccountauthaccount_info-callback
            if(auth_params) {
                doc.useServiceAccountAuth(auth_params , next);
            }else{
                next('Authentication data is missing');
            }
        },
        function(next){
            doc.getInfo(function(err, info) {
                if(err){
                    console.error(err);
                    next(err);
                }else{
                    next(null, info);
                }
            });
        }
    ], function(err, info){
        docInfo=info;
        //return an interface to the sheet
        callback(err, {
            docInfo: info,
            readSheet: readSheet
        });
    });

    function readSheet(query, callback){
        //find the sheet with title==query.sheet
        var targetSheet = docInfo.worksheets.find(function(sheet,index,arr){
            return sheet.title.match(new RegExp(query.sheet, 'i'));
        });

        query.fields_row = query.fields_row || 1;

        //http://caolan.github.io/async/docs.html#waterfall
        async.waterfall([
            function readCells(next){
                //https://www.npmjs.com/package/google-spreadsheet#googlespreadsheetgetcellsworksheet_id-options-callback
                targetSheet.getCells({
                        'min-row': 1,
                        'max-row': targetSheet.rowCount,
                        'min-col': 1,
                        'max-col': targetSheet.colCount
                    }, next
                );
            },
            function loadLookupTable(cells, next){
                if(query.lookup){
                    loadSubstitutions(query.lookup, function(err,lookup){
                        next(null,cells,lookup);
                    });
                }else{
                    next(null,cells,null);
                }
            },
            function createIndex(cells, lookupTable, next) {
                if(lookupTable){
                    cells.filter(function(cell){
                        //exclude header
                        return (cell.row>query.fields_row);
                    }).forEach(function(cell){
                        var value=cell.value;
                        var sub_key = value.match(/(\$.+?)\b/);
                        if(sub_key){
                            if(lookupTable.hasOwnProperty(sub_key[1])){
                                var new_val = [];
                                lookupTable[sub_key[1]].forEach(function(sub){
                                    new_val.push(value.replace(sub_key[1],sub));
                                });
                                cell.value = new_val;
                            }
                        }
                    });
                }
                if(query.index_by) {

                    var row2uniqueID = {}, col2FieldName = {};
                    var ret_index = {};

                    var fields_row = cells.filter(function (cell) {
                        return cell.row == query.fields_row;
                    });

                    // map col number to fieldName
                    fields_row.forEach(function (cell) {
                        col2FieldName[cell.col] = cell.value;
                    });

                    var key_head_cell = fields_row.find(function (cell) {
                        return cell.value.match(RegExp(query.index_by, 'i'));
                    });


                    cells.filter(function (cell) {
                        //find uniqueID cells
                        return (cell.row > key_head_cell.row) && (cell.col == key_head_cell.col);
                    }).forEach(function (cell, index, arr) {
                        //map row numbers to uniqueID
                        row2uniqueID[cell.row] = cell.value;
                        ret_index[cell.value] = {};
                    });

                    // dump data into index
                    cells.forEach(function (cell) {
                        var uniqueID = row2uniqueID[cell.row];
                        if (uniqueID) {
                            var fieldName = col2FieldName[cell.col];
                            if (fieldName) {
                                ret_index[uniqueID][fieldName] = cell.value;
                            }
                        }
                    });
                    next(null,ret_index);
                }else{
                    next(null, cells);
                }

            }
        ], callback);
    }

    function loadSubstitutions( sheetName, callback ){
        var sub_sheet = docInfo.worksheets.find(function(sheet,index,arr){
            return sheet.title.match(RegExp('^' + sheetName + '$','i'));
        });

        if(!sub_sheet){
            callback({});
            return;
        }

        sub_sheet.getCells({
            'min-row': 1,
            'max-row': sub_sheet.rowCount,
            'min-col': 1,
            'max-col': sub_sheet.colCount
        }, function( err, cells ){
            var ret_hash = {};
            if(!err){
                var keys = {};
                cells.forEach(function(cell){
                    if(cell.row == 1){// found a key
                        keys[cell.col] = cell.value;
                        ret_hash[keys[cell.col]] = [];
                    }else{// found a value
                        ret_hash[keys[cell.col]].push( cell.value );
                    }
                })

            }
            callback(err, ret_hash);
        });
    }


}