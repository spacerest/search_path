/*

errors: - can't makea  new tab  right off bat (newSearchTerm is not defined);

*/


/**
* check that extension is authenticated?
*/



/**
 * use listeners to keep info updated
 */

let tabUrlDict = {};
let lastOpenTabId = null;

function SearchDict() {
  this.tab_ids = {};
  this.search_terms = [];
  this.addUrlToTab = function (searchTerm, tabId, tabUrl, previousTabId) {
    console.log("adding url to tab " + searchTerm + tabId + tabUrl)
    if (!this.tab_ids[tabId]) {
      this.tab_ids[tabId] = [];
    }
    if (!searchTerm || searchTerm === "") {
      var countUrls = this.tab_ids[tabId].length;
      console.log(countUrls + " is how many urls in this tab" );
      if (countUrls == 0) { //we have just opened a new tab
	var countPrevUrls = this.tab_ids[previousTabId].length;
	searchTerm = this.tab_ids[previousTabId][countPrevUrls - 1].search_term;
      } else {
	searchTerm = this.tab_ids[tabId][countUrls - 1].search_term;
	//if we don't already have search term recorded, record it now
	if (this.search_terms.indexOf(searchTerm) == -1) {
	  search_terms.push(searchTerm);
	}
      }
    }
    this.tab_ids[tabId].push({url: tabUrl, search_term: searchTerm});
    //if we don't already have search term recorded, record it now
	if (this.search_terms.indexOf(searchTerm) == -1 && searchTerm != "mystery search term") {
	  this.search_terms.push(searchTerm);
	}

  }
  this.getAllSearchTerms = function() {
    return this.search_terms;
  } 
  this.getCurrentSearchTerm = function(tabId, url) {
    var currentTabInfo = this.tab_ids[tabId];
    if (currentTabInfo) {
      for (var i = 0; i < currentTabInfo.length; i++) {
        var dict = currentTabInfo[i];
        console.log("url is " + dict.url + " and search term is " + dict.search_term);
        if (dict.url === url) {
          return dict.search_term;
        }
      }
    }
    return "mystery search term";
  }
}

/**
 * What should an entry look like
 * search_term: "search term"
 * page_result: "www.reddit.com"
 * highlight: "this is a highlight"
 */

var Highlight = function(searchTerm, pageResult, highlight) {
  this.search_term = searchTerm;
  this.page_result = pageResult;
  this.highlight = highlight;
}

/**
 * Get the URL parameters
 * source: https://css-tricks.com/snippets/javascript/get-url-variables/
 * @param  {String} url The URL
 * @return {Object}     The URL parameters
 */
var getParams = function (url) {
  var params = {};
  var parser = document.createElement('a');
  parser.href = url;
  var query = parser.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    params[pair[0]] = decodeURIComponent(pair[1].replace(/\+/g, " "));
  }
  return params;
};

var getSearchTerm = function (url) {
  query = getParams(url).q;
   
  return query ? query : "";
}
  chrome.runtime.onInstalled.addListener(function() { 
    let tokenAcquired = false;
   

    //ask if we already have authentication. if we don't, ask for it 
    getAuthTokenSilent();

    let searchDict = new SearchDict();
    let pluginEnabled = true;
    let newUrl = null;
    let isNewSearch = false;
    let currentSearchTerm = "test";
    if (pluginEnabled) {
      chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
      
      if (changeInfo.status == "complete" && newUrl) {
      //check if this was a new search
	newSearchTerm = "";
	if (newUrl.hostname == "www.google.at") {
	  newSearchTerm = getSearchTerm(newUrl);
	}
	searchDict.addUrlToTab(newSearchTerm, tabId, newUrl.href, lastOpenTabId);
	lastOpenTabId = tabId;
      } else if (changeInfo.status == "loading" && changeInfo.url){
	newUrl = new URL(changeInfo.url);
      }
      }
    )

    //add listener for when popup requests our collected info
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
	    console.log("got a msg!" + request.msg);
            if (request.msg === "get_data") {
		//get info about how we got to this tab id
		var currentSearchTerm = searchDict.getCurrentSearchTerm(request.tab_id, request.url);

		//make a new highlight object
		var highlightObj = new Highlight(currentSearchTerm, request.url, request.highlighted_text);//currentSearchTerm, request.url, request.highlighted_text);
	      var allSearchTerms = searchDict.getAllSearchTerms();
		console.log("background is sending a msg...");	
		chrome.runtime.sendMessage({
		  msg: "send_data",
		  status: "ok",
		  highlight: highlightObj,
		  search_terms: allSearchTerms
		});
                console.log(request.msg + sender);
            } else if (request.msg == "get_search_terms") {
	      chrome.runtime.sendMessage({
		msg: "send_search_terms",
		status: "ok",
		content: allSearchTerms
	      });
	    } else {
	      console.log("got a msg but dunno what");
	    }
        }
    );
  };
});

/* check Authentication functions - start  */

  var showAuthenticationNeeded = function() {
   chrome.browserAction.setBadgeText({text: "!"});  
  }

  var removeAuthenticationNeeded = function () {
    chrome.browserAction.setBadgeText({text: ""});
  }

  var getAuthToken = function(options) {
    console.log("get auth token - start");
    chrome.identity.getAuthToken(
      { 'interactive': options.interactive },
      options.callback);
    console.log("get auth token - end");
  }
 
  var getAuthTokenSilent = function() {
    console.log("get auth token silent - start");
    getAuthToken({
      'interactive': false,
      'callback': getAuthTokenSilentCallback,	  
    });
    console.log("get auth token silent - end");
  }
  
  var getAuthTokenSilentCallback = function(token) {
    console.log("get auth token callback - start");
    if (chrome.runtime.lastError) {
      console.log("gonna try interactive");
      //TODO show error message next to extension icon
      //getAuthTokenInteractive();
      showAuthenticationNeeded();
    } else {
      removeAuthenticationNeeded();
      return true;
    }
  }

  var getAuthTokenInteractiveCallback = function(token) {
    console.log("get auth token callback - start");
    if (chrome.runtime.lastError) {
      console.log("oops interactive auth didn't worked");
      //TODO tell the user this hasn't worked and give a link for some details 
      return false;
    } else {
      console.log("good, interactive worked, now gonna ask to remove badge");
      removeAuthenticationNeeded();
      return true;
    }
  }

  var getAuthTokenInteractive = function() {
    console.log("get auth token interactive - start");
    getAuthToken({
	'interactive': true,
	'callback': getAuthTokenInteractiveCallback,
    });
    console.log("get auth token interactive - end");
  }

/* Authenticaion checking - finished */
  

var sendToGoogleSheets = function (data) {

	var SCRIPT_ID='15uJJKus-863eXQy40-Cd6XBntQU80BAYAk_mCwfJeYjRR__BwMOu2Mob'; // Apps Script script id
	var STATE_START=1;
	var STATE_ACQUIRING_AUTHTOKEN=2;
	var STATE_AUTHTOKEN_ACQUIRED=3;

	var state = STATE_START;
	var jsonToSend = data;
 

  var updateGoogleSheet = function() {
    //if not currently signed in, get auth
    getAuthTokenSilent();
  
    //then send data to API
    sendDataToGoogleSheets();
  }
  
  var sendDataToGoogleSheets = function() {
    getAuthToken({
  	  'interactive': false,
  	  'callback': sendDataToGoogleSheetsCallback,
    });
  }
 
  var sendDataToGoogleSheetsCallback = function(token) {
    //console.log("json to send is " + jsonToSend);
    console.log("parsed is " + JSON.stringify(jsonToSend));
    post({ 'url':	  'https://script.googleapis.com/v1/scripts/' + SCRIPT_ID +
    ':run',
  		  'callback': googleAPIResponse,
  		  'token': token,
  		  'request': {'function':   'setData',
  					    'parameters': {'data': JSON.stringify(jsonToSend)}} 
  		  });
  }
  
  var googleAPIResponse = function(response) {
    var info;
    if (response.response.result.status == 'ok') {
      info = "Data has been enetered into " + response.response.result.doc; 
    } else {
      info = "Error..." + response.response.result.status;
    }	
    console.log(info);
  }
  
  var post = function(options) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        options.callback(JSON.parse(xhr.responseText));	    
      } else if (xhr.readyState === 4 && xhr.status !== 200) {
        console.log("post: " + xhr.readyState + " " + xhr.status + " " +
        xhr.responseText); 
      } 
    };
    xhr.open('POST', options.url, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + options.token);
    xhr.send(JSON.stringify(options.request));	
  	
  }
  updateGoogleSheet(jsonToSend);
}
