var getAuthToken = function(options) {
    console.log("get auth token - start");
    chrome.identity.getAuthToken(
      { 'interactive': options.interactive },
      options.callback);
    console.log("get auth token - end");
  }
 


var sendDataToGoogleSheets = function() {
    getAuthToken({
  	'interactive': false,
  	'callback': sendDataToGoogleSheetsCallback,
    });
  }
  
var sendDataToGoogleSheetsCallback = function(token) {
    post({ 'url':	  'https://script.googleapis.com/v1/scripts/' + SCRIPT_ID +
    ':run',
  		  'callback': googleAPIResponse,
  		  'token': token,
  		  'request': {'function':   'setData',
  					    'parameters': {'msg': 'new_highlight', 'data': JSON.stringify(dataToSend)}} 
  		  });
  }
  
var googleAPIResponse = function(response) {
    var info;
    if (response.response.result.status == 'ok') {
      info = "Data has been entered into <a href='" + response.response.result.doc + "' target='_blank'>your google sheet</a>."; 
    } else {
      info = "Error..." + response.response.result.status;
    }	
    console.log(info);
  }
  
console.log(dataToSend);

sendDataToGoogleSheets();


