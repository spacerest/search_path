chrome.contextMenus.create({
  "title": "No search",
  "id": "log-selection",
  "contexts": ["selection"]
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId == "log-selection") {
  } else if (info.menuItemId == "what-command") {
  }
});

let tabUrlDict = {};

function SearchDict() {
  this.tab_ids = {};
  this.search_terms = [];
  this.addUrlToTab = function (searchTerm, tabId, tabUrl, previousTabId) {
    if (!this.tab_ids[tabId]) {
      this.tab_ids[tabId] = [];
    }
    if (!searchTerm || searchTerm === "") {
      var countUrls = this.tab_ids[tabId].length;
      if (countUrls == 0) { //we have just opened a new tab
	var countPrevUrls = this.tab_ids[previousTabId].length;
	searchTerm = this.tab_ids[previousTabId][countPrevUrls - 1].search_term;
      } else {
	searchTerm = this.tab_ids[tabId][countUrls - 1].search_term;
      }
    }
    this.tab_ids[tabId].push({url: tabUrl, search_term: searchTerm});
    //if we don't already have search term recorded, record it now
	if (this.search_terms.indexOf(searchTerm) == -1 && searchTerm != "mystery search term") {
	  this.search_terms.push(searchTerm);
	  var newSearchTermData = {msg: "new_search_term", data: {search_term: searchTerm}};
	  sendToGoogleSheets(newSearchTermData);

	}

  }
  this.getAllSearchTerms = function() {
    return this.search_terms;
  } 
  this.getCurrentSearchTerm = function(tabId, url) {
    console.log(tabId + " is tabId " + url + " is url" );
    var currentTabInfo = this.tab_ids[tabId];
    if (currentTabInfo) {
      for (var i = 0; i < currentTabInfo.length; i++) {
        var dict = currentTabInfo[i];
        if (dict.url === url) {
	  console.log(dict.search_term);
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
  
    let lastOpenTabId = null;
      getAuthTokenSilent();
      //chrome.browserAction.disable(); 

    //ask if we already have authentication. if we don't, ask for it 

    let searchDict = new SearchDict();
    let pluginEnabled = true;
    let newUrl = null;
    let isNewSearch = false;
    let currentSearchTerm = "test";
    let possibleSchemes = ["https:", "http:", "www:"];
    let lastUrlHref = "";
    let currentUrl = null;
    chrome.browserAction.disable();
    if (pluginEnabled) {
      chrome.tabs.onHighlighted.addListener(function(highlightInfo) {
	chrome.tabs.query({"active": true, "lastFocusedWindow": true}, function(tabs) {
	currentUrl = new URL(tabs[0].url);
	  if(possibleSchemes.indexOf(currentUrl.protocol) != -1) {
      	      chrome.browserAction.enable(tabs[0].id); 
	      var currentSearchTerm = searchDict.getCurrentSearchTerm(tabs[0].id, currentUrl.href); 
	      updateContextMenu(currentSearchTerm);
	     
	  }
	})
      })
      chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	if (tab.url) {
	    newUrl = new URL(tab.url);
	    if(possibleSchemes.indexOf(newUrl.protocol) != -1) {
      	      chrome.browserAction.enable(tabId); 
	      if(lastUrlHref != newUrl.href) {
		newSearchTerm = "";
	      	if (newUrl.hostname == "www.google.at") {
	      	  newSearchTerm = getSearchTerm(newUrl);
	      	}
	      	searchDict.addUrlToTab(newSearchTerm, tabId, newUrl.href, lastOpenTabId);
		lastUrlHref = newUrl.href;
		lastOpenTabId = tabId;
		updateContextMenu(newSearchTerm);
	
	      }
	    }
	  }
      }
    )

    //add listener for when popup requests our collected info
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            if (request.msg === "get_data") {
		//get info about how we got to this tab id
		var currentSearchTerm = searchDict.getCurrentSearchTerm(request.tab_id, request.url);

		//make a new highlight object
		var highlightObj = new Highlight(currentSearchTerm, request.url, request.highlighted_text);//currentSearchTerm, request.url, request.highlighted_text);
	      var allSearchTerms = searchDict.getAllSearchTerms();
		chrome.runtime.sendMessage({
		  msg: "send_data",
		  status: "ok",
		  highlight: highlightObj,
		  search_terms: allSearchTerms
		});
            } else if (request.msg == "get_search_terms") {
	      var allSearchTerms = searchDict.getAllSearchTerms();
	      chrome.runtime.sendMessage({ msg: "send_search_terms",
		status: "ok",
		content: allSearchTerms
	      });
	    } else if (request.msg == "send_new_search_term") {
	      searchDict.addUrlToTab(request.search_term, request.tab_id, request.tab_url, lastOpenTabId);
	      var updatedSearchTerms = searchDict.getAllSearchTerms();
	      chrome.runtime.sendMessage({
		msg: "added_search_term",
		status: "ok",
		search_terms: updatedSearchTerms,
		new_search_term: request.search_term
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
    chrome.identity.getAuthToken(
      { 'interactive': options.interactive },
      options.callback);
  }
 
  var getAuthTokenSilent = function() {
    getAuthToken({
      'interactive': false,
      'callback': getAuthTokenSilentCallback,	  
    });
  }
  
  var getAuthTokenSilentCallback = function(token) {
    if (chrome.runtime.lastError) {
      //TODO show error message next to extension icon
      //getAuthTokenInteractive();
      showAuthenticationNeeded();
    } else {
      removeAuthenticationNeeded();
    }
  }

  var getAuthTokenInteractiveCallback = function(token) {
    if (chrome.runtime.lastError) {
      //TODO tell the user this hasn't worked and give a link for some details 
      return false;
    } else {
      removeAuthenticationNeeded();
      return true;
    }
  }

  var getAuthTokenInteractive = function() {
    getAuthToken({
	'interactive': true,
	'callback': getAuthTokenInteractiveCallback,
    });
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
    post({ 'url':	  'https://script.googleapis.com/v1/scripts/' + SCRIPT_ID +
    ':run',
  		  'callback': googleAPIResponse,
  		  'token': token,
  		  'request': {'function':   'setData',
  					    'parameters': JSON.stringify(jsonToSend)} 
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
	console.log("error in post of background");
      } 
    };
    xhr.open('POST', options.url, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + options.token);
    xhr.send(JSON.stringify(options.request));	
  	
  }
  updateGoogleSheet(jsonToSend);
}

var updateContextMenu = function(searchTerm) {
  //update the rightclick option for someone to search here
  chrome.contextMenus.update("log-selection", {
    "title": "Log this selection to '" + searchTerm + "'",
  });
}
