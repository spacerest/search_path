var testText;
var testToken;

var updateContextMenu = function(searchTerm) {
  //update the rightclick option for someone to search here
  chrome.contextMenus.update("log-selection", {
    "title": "Log this selection to '" + searchTerm + "'",
  });
  console.log("context menu was updated");
};

/* context menus - start */
chrome.contextMenus.removeAll(function() {
  chrome.contextMenus.create({
    "title": "No search",
    "id": "log-selection",
    "contexts": ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    logSelection();
});

var google = new GoogleApiManager();
var logSelection = function() {
    google.updateGoogleSheet();
}
/* context menus - end */

/* variables - start */
let PLACEHOLDER_SEARCH_TERM = null;
let LOG_SELECTION_ID = "log-selection";
let lastOpenTabId = null;
let searchDict = new SearchDict();
let qualifyingProtocols = ["https:", "http:", "www:"];
let searchDomains = [/www.google.*/];
let newUrl = null;
let isNewSearch = false;
let currentSearchTerm = "test";
let currentUrl = null;
let tabManager = new TabManager();
let currentHostname;
/* variables - end */

/* GoogleApiManager class - start */
function GoogleApiManager() {
  var SCRIPT_ID='15uJJKus-863eXQy40-Cd6XBntQU80BAYAk_mCwfJeYjRR__BwMOu2Mob'; // Apps Script script id
  var STATE_START=1;
  var STATE_ACQUIRING_AUTHTOKEN=2;
  var STATE_AUTHTOKEN_ACQUIRED=3;
  var state = STATE_START;
  this.jsonToSend;
  this.token;
  
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
  
  this.getAuthTokenSilent = function() {
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

  /* Other google functions - start */  
  var googleAPIResponse = function(response) {
    var info;
    if (response.response.result.status == 'ok') {
      info = "Data has been enetered into " + response.response.result.doc; 
    } else {
      info = "Errorerrorerror..." + response.response.result.status;
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
    //updateGoogleSheet();
  }
  
  this.updateGoogleSheet = function() {
    //if not currently signed in, get auth
    google.getAuthTokenSilent();
    //then send data to API
    callGoogleSheets();
  }
  
  var callGoogleSheets = function() {
    getAuthToken({
      'interactive': false,
      'callback': callGoogleSheetsCallback,
    });
  }
 
  var callGoogleSheetsCallback = function(token) {
    console.log(token);
    testToken = token;
    //request the selected text with a callback to do something with it when received
    //get selected text from page
    chrome.tabs.executeScript( {
      code: "window.getSelection().toString();"
}, function(selection) {
      testText = selection[0];
      sendDataToGoogleSheets(testText);
    })
  }  

  var sendDataToGoogleSheets = function(selectedText) {
    var highlightToSend = new Highlight(
      tabManager.getSelectedSearchTerm(),
      tabManager.currentUrl.href,
      selectedText
    );
    console.log("token is ");
    console.log(testToken);
    this.jsonToSend = {msg: "new_highlight", data: highlightToSend};
    post({'url': 'https://script.googleapis.com/v1/scripts/' + SCRIPT_ID +
    ':run',
  	  'callback': googleAPIResponse,
  	  'token': testToken,
  	  'request': {'function': 'setData',
  		      'parameters': JSON.stringify(this.jsonToSend)} 
    });
    testToken = null;
  }

  /* Other google functions - end */  
}
/* GoogleApiManager class - end */

/* tabManager class - start */
function TabManager() {
  this.lastOpenTabId, this.previousSearchTerm, this.currentSearchTerm, 
  this.currentTabId, this.currentUrl, this.previousUrl;
  this.isNewUrl = function(tab) {
    return this.currentUrl.href != tab.url.href;
  }
 
  this.checkCurrentTabIsSearchPage = function() {
    console.log("checking if this is a search page");
    console.log(this.currentUrl.href + " " + this.currentUrl.hostname);
    currentHostName = this.currentUrl.hostname;
    var isDomainUrl = searchDomains.some(function(rx) { 
      return rx.test(currentHostName); 
    }); 
    console.log(isDomainUrl);
    return isDomainUrl;
  }

  this.updateTabInfo = function(tab) {
    this.previousUrl = this.currentUrl;
    this.previousTabId = this.currentTabId;
    this.currentTabId = tab.id;
    this.currentUrl = new URL(tab.url);
    this.previousSearchTerm = this.currentSearchTerm;
    this.currentSearchTerm = searchDict.getCurrentSearchTerm(tab.id, tab.url);
  };

  this.getSelectedSearchTerm = function() {
    return this.currentSearchTerm;  
  }

  this.updateData = function(tab) {
    //if this is a webpage and not a blank page
    if (tab.url) {
      //if this is a page update
      if(this.previousUrl.href != this.currentUrl.href) {
	      if (this.checkCurrentTabIsSearchPage()) {
	        var newSearchTerm = getSearchTerm(this.currentUrl);
	        if (newSearchTerm) {
	          this.currentSearchTerm = getSearchTerm(this.currentUrl);
	        }
        }
        searchDict.addUrlToTab(this.currentSearchTerm, this.currentTabId, this.currentUrl.href);
	      console.log(searchDict);
      }
    }
  }
  this.updateExtensionEnabled = function(tab) {
    if(qualifyingProtocols.indexOf(this.currentUrl.protocol) != -1) {
      chrome.browserAction.enable(tab.id); 
      updateContextMenu(this.currentSearchTerm);
    }
  } 
}

/* ui class - end */

/* main logic - start */
chrome.runtime.onInstalled.addListener(function() { 
  //ask if we already have authentication. if we don't, ask for it 
  google.getAuthTokenSilent();
  
  chrome.browserAction.disable(); //grey out our icon for now

  chrome.tabs.onHighlighted.addListener(function(highlightInfo) {
    chrome.tabs.query({"active": true, "lastFocusedWindow": true}, function(tabs) {
      /*make sure: 
	- extension isnt greyed out if we have a webpage
	- context menu is updated to have the current search term
      */
      tabManager.updateTabInfo(tabs[0]);
      tabManager.updateExtensionEnabled(tabs[0]);
    })
  })
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    /* if open a new tab to a blank page, don't enable anything;
       if open a new tab to a new page, check if it's a search, check
       if it comes from a search, and check if it's unrelated to searching */
      if (changeInfo.status === "loading" && tabManager.isNewUrl(tab)) {
	tabManager.updateTabInfo(tab);
      	tabManager.updateData(tab);
      	tabManager.updateExtensionEnabled(tab);
      }
  })

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
	      searchDict.addUrlToTab(request.search_term, request.tab_id, lastOpenTabId, request.tab_url, tabManager.previousUrl.href);
	      var updatedSearchTerms = searchDict.getAllSearchTerms();
	      chrome.runtime.sendMessage({
		msg: "added_search_term",
		status: "ok",
		search_terms: updatedSearchTerms,
		new_search_term: request.search_term
	      });
	    } else if (request.mst = "send_highlight_to_google_sheet") {
	      sendToGoogleSheets(newSearchTermData);
	    } else {
	      console.log("got a msg but dunno what");
	    }
        }
    );
});



/* main logic - end */

/* listeners - start */
/* listeners - end */

/* utility functions - start */
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
    if (pair[1] != undefined) {
      params[pair[0]] = decodeURIComponent(pair[1].replace(/\+/g, " "));
    } else {
      return null;
    }
  }
  return params;
};

var getSearchTerm = function (url) {
  var params = getParams(url);
  var query = null;
  if (params != null) {
    query = getParams(url).q;
  }

  return query;
}
/* utility functions - start */
 

/* highlight class - start */
var Highlight = function(searchTerm, pageResult, highlight) {
  this.search_term = searchTerm;
  this.page_result = pageResult;
  this.highlight = highlight;
}
/* highlight class - end */

/* searchdict class - start */
function SearchDict() {
  this.tab_ids = {};
  this.search_terms = [];
  this.addUrlToTab = function (searchTerm, tabId, urlHref) {
    if (!this.tab_ids[tabId]) {
      this.tab_ids[tabId] = {};
    }
    if (!this.tab_ids[tabId][urlHref]) {
      this.tab_ids[tabId][urlHref] = searchTerm;
    }
    //if we don't already have search term recorded, record it now
    if (this.search_terms.indexOf(searchTerm) == -1 && searchTerm != PLACEHOLDER_SEARCH_TERM) {
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
    if (this.tab_ids[tabId] != undefined) {
      if (this.tab_ids[tabId][url] != undefined) {
	return this.tab_ids[tabId][url]; 
      }
    }
    return PLACEHOLDER_SEARCH_TERM;
  }
}


/* searchdict class - end */

/* background class - start */
/* background class - end */



/* cleanup start */
var sendToGoogleSheets = function (data) {

 }
// cleanup end
