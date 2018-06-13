// LICENSES http://www.apache.org/licenses/LICENSE-2.0
var DOC_ID = '1BIq1lIODtIRUi5EhVz93XiOeN5AEJMPSlqv-jN8bMcY'; // Template File 
         
/**
 * Add data to sheet from Execution API call
 * @param {Object} parameters passed from script.
 * @return {Object} result.
 */
function setData(parameters) {  
  try {
    // next set where we write the data - you could write to multiple/alternate destinations
    var doc = SpreadsheetApp.openById(DOC_ID);//.copy('Execution API Example');
    var sheet = doc.getSheets()[0];
    var data = parameters.data;
    writeJSONtoSheet(data, sheet);
    //sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    return {"status":"ok", 'doc':doc.getUrl()};
  } catch(e){
    // if error return this
    Logger.log(e);
    return {"status": JSON.stringify(e)};
  }
}

// Written by Amit Agarwal www.ctrlq.org

function writeJSONtoSheet(json, sheet) {
  
  var parsedJson = JSON.parse(json);

  var keys = Object.keys(parsedJson).sort();
  var last = sheet.getLastColumn();
  var header = sheet.getRange(1, 1, 1, last).getValues()[0];
  var newCols = [];

  for (var k = 0; k < keys.length; k++) {
    if (header.indexOf(keys[k]) === -1) {
      newCols.push(keys[k]);
    }
  }

  if (newCols.length > 0) {
    sheet.insertColumnsAfter(last, newCols.length);
    sheet.getRange(1, last + 1, 1, newCols.length).setValues([newCols]);
    header = header.concat(newCols);
  }

  var row = [];

  for (var h = 0; h < header.length; h++) {
    row.push(header[h] in parsedJson ? parsedJson[header[h]] : "");
  }

  sheet.appendRow(row);

}
