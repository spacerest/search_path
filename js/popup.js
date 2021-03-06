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

function Popup() {
  var SCRIPT_ID='15uJJKus-863eXQy40-Cd6XBntQU80BAYAk_mCwfJeYjRR__BwMOu2Mob'; // Apps Script script id
  var STATE_START=1;
  var STATE_ACQUIRING_AUTHTOKEN=2;
  var STATE_AUTHTOKEN_ACQUIRED=3;
  var state = STATE_START;
  var jsonToSend = "";
  var dataFromBackground;
  var searchTermsFromBackground;
  var highlightedText;
  var currentTab;
  var signin_button, send_to_gs_button, revoke_button, highlight_info_div, highlight_data, show_result_div, add_custom_search_term_button;
  this.currentSearchTerm;

  var disableButton = function(button) {
    button.setAttribute('disabled', 'disabled');
  }
  var enableButton = function(button) {
    button.removeAttribute('disabled');
  }
	
  var changeState = function(newState) {
    var state = newState;
    switch (state) {
      case STATE_START:
    	enableButton(signin_button);
    	disableButton(send_to_gs_button);
    	disableButton(revoke_button);
    	break;
      case STATE_ACQUIRING_AUTHTOKEN:
    	disableButton(signin_button);
    	disableButton(send_to_gs_button);
    	disableButton(revoke_button);
    	break;
      case STATE_AUTHTOKEN_ACQUIRED:
    	disableButton(signin_button);
    	enableButton(send_to_gs_button);
    	enableButton(revoke_button);
    	break;
    }
  }

  var getAuthToken = function(options) {
    chrome.identity.getAuthToken(
  	  { 'interactive': options.interactive },
  	  options.callback);
  }

  var addCustomSearchTerm = function() {
    var customSearchTerm = document.getElementById("custom-text-input").value;
    var currentTabId = null;
    var currentTabHref = null;
    if (customSearchTerm != "") {
      
      //get the data of current tab
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
         currentTabId = tabs[0].id;
         currentTabHref = tabs[0].href;
      });
       
      //send this new searchterm to background script
      chrome.runtime.sendMessage({
	      msg: "send_new_search_term",
	      search_term: customSearchTerm,
	      tab_id: currentTabId,
	      tab_url: currentTabHref
      });

      //update the user interface
      
      //erase the search term the user gave previously
      
    }
  }
 
  this.requestHighlightInfoFromBackground = function() {
    //get selected text from page
    chrome.tabs.executeScript( {
      code: "window.getSelection().toString();"
}, function(selection) {
      highlight_data.innerHTML = selection[0];
      highlightedText = selection[0];
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
         currentTab = tabs[0];
         if (currentTab) { // Sanity check
            chrome.runtime.sendMessage({msg: "get_data", tab_id: currentTab.id, url: currentTab.url, highlighted_text: highlightedText});
	  }
	}
      ); 
    })
  } 

var sendDataToBackgroundForGoogleSheets = function () {
  chrome.runtime.sendMessage({
    msg: "send_new_search_term",
    search_term: customSearchTerm,
    tab_id: currentTabId,
    tab_url: currentTabHref
  });
}

 var sendDataToGoogleSheets = function() {
    getAuthToken({
  	'interactive': false,
  	'callback': sendDataToGoogleSheetsCallback,
    });
  }
  
  var getAuthTokenSilent = function() {
    getAuthToken({
      'interactive': false,
      'callback': getAuthTokenCallback,	  
    });
  }

  var getAuthTokenInteractive = function() {
    getAuthToken({
	'interactive': true,
	'callback': getAuthTokenCallback,
    });
  }
 
  var getAuthTokenCallback = function(token) {
    if (chrome.runtime.lastError) {
      console.log('no token acquired');
      //chrome.browserAction.setBadgeText({text: "no"});
      changeState(STATE_START);
    } else {
      console.log('Token aquired');
      //chrome.browserAction.setBadgeText({text: "yes"});
      changeState(STATE_AUTHTOKEN_ACQUIRED);
    }
  }

  var sendDataToGoogleSheetsCallback = function(token) {
    document.getElementById("sending_gif").style.visibility = "visible";
    document.getElementById("sending_gif").style.opacity = 1;
    var highlightToSend = new Highlight(
      getSelectedSearchTerm(),
      dataFromBackground.page_result,
      document.getElementById("highlight_data").value
    );
    //TODO check that selected isn't + add custom
    var jsonToSave = {msg: "new_highlight", data: highlightToSend};
    post({'url':	  'https://script.googleapis.com/v1/scripts/' + SCRIPT_ID +
    ':run',
  	  'callback': googleAPIResponse,
  	  'token': token,
  	  'request': {'function': 'setData',
  		      'parameters': JSON.stringify(jsonToSave)} 
    });
  }
  
  var googleAPIResponse = function(response) {
    document.getElementById("sending_gif").style.visibility = "hidden";
    var info;
    if (response.response.result.status == 'ok') {
      info = "Data has been entered into <a href='" + response.response.result.doc + "' target='_blank'>your google sheet</a>."; 
      document.getElementById("show_result_success").innerHTML = info; 
      document.getElementById("highlight_data").value = ""; 
    } else {
      info = "Error..." + response.response.result.status;
      document.getElementById("show_result_error").innerHTML = info; 
    }	
  }
  
  var updatePopup = function(info) {
     
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
	
  var revokeToken = function() {
	console.log("revoking token");
	getAuthToken({
		'interactive': false,
		'callback': revokeAuthTokenCallback,
	});
  }

  var revokeAuthTokenCallback = function(current_token) {
	if (!chrome.runtime.lastError) {

		// Remove the local cached token
		chrome.identity.removeCachedAuthToken({ token: current_token }, function() {});
		
		// Make a request to revoke token in the server
		var xhr = new XMLHttpRequest();
		xhr.open('GET', 'https://accounts.google.com/o/oauth2/revoke?token=' + current_token);
		xhr.send();

		// Update the user interface accordingly
		changeState(STATE_START);
	}
  }

  this.onWindowLoad = function () {
    signin_button = document.querySelector('#signin');
    signin_button.addEventListener('click', getAuthTokenInteractive);
    
    send_to_gs_button = document.querySelector('#getxhr');
    send_to_gs_button.addEventListener('click', sendDataToGoogleSheets.bind(send_to_gs_button, true));

    add_custom_search_term_button = document.querySelector('#add-new-search-term-button');
    add_custom_search_term_button.addEventListener('click', addCustomSearchTerm.bind(add_custom_search_term_button, true));
    
    revoke_button = document.querySelector('#revoke');
    revoke_button.addEventListener('click', revokeToken);
    
    highlight_info_div = document.querySelector('#highlight_info_div');
    highlight_data = document.querySelector('#highlight_data');
    show_result_div = document.querySelector('#show_result');
    
    // Trying to get access token without signing in, 
    // it will work if the application was previously 
    // authorized by the user.
    getAuthTokenSilent();
  }

  var getSelectedSearchTerm = function() {
    var list = document.getElementById("search-term-select");
    for (i = 0; i < list.length; i++) {
        if (list.options[i].selected) {
         	        return list.options[i].text;
	      };
    }
    return "no search term selected";
  }

  this.populateSearchTermOptions = function(langArray, selectedSearchTerm) {
    var index=0;
    var selectElement = document.getElementById("search-term-select");
    for (a in selectElement.options) { 
        selectElement.options.remove(0); 
    } 
    var opt = document.createElement("option");
    opt.value = "add-new";
    opt.innerHTML = "+ add custom";
    selectElement.appendChild(opt);
    for(index in langArray){
       opt = document.createElement("option");
       opt.value= index;
       opt.innerHTML = langArray[index];
    
       // then append it to the select element
       selectElement.appendChild(opt);
       if(langArray[index] == selectedSearchTerm) {
	  opt.selected = true;
	}
       index++;
    }
  }

  this.newSelectedSearchTerm = function() {
    if(document.getElementById("search-term-select").value == "add-new") {
      document.getElementById("custom-search-term").classList.add("visible"); 
      document.getElementById("custom-search-term").classList.remove("hidden"); 
    } else {
      var currentSearchTerm;
      var list = document.getElementById("search-term-select");
      for (i = 0; i < list.length; i++) {
        if (list.options[i].selected) {
          currentSearchTerm = list.options[i].text;
	      };
      }
      chrome.runtime.sendMessage({
        msg: "send_new_search_term",
        search_term: currentSearchTerm 
      });
      document.getElementById("custom-search-term").classList.add("hidden"); 
      document.getElementById("custom-search-term").classList.remove("visible");
    }
  }

  this.useDataFromBackground = function(request) {
    if (request) {
      dataFromBackground = request.highlight;
      searchTermsFromBackground = request.search_terms;
      request.highlight ? highlight_data.innerHTML = request.highlight.highlight : null;
      this.populateSearchTermOptions(searchTermsFromBackground, request.highlight.search_term);	
      document.getElementById("loading_gif").style.visibility = "hidden";
      document.getElementById("loading_gif").style.opacity =  0;
    }
  } 
}

var popup = new Popup();
document.addEventListener('DOMContentLoaded', function() {
    var link = document.getElementById('search-term-select');
    popup.onWindowLoad();
    popup.requestHighlightInfoFromBackground(); 
    // onClick's logic below:
    link.addEventListener('change', function() {
      popup.newSelectedSearchTerm();
    });
});

chrome.runtime.onMessage.addListener(
//this.populateSearchTermOptions = function(langArray, selectedSearchTerm) 
  function(request, sender, sendResponse) {
    if (request.status == "ok" && request.msg == "send_data") {
      popup.useDataFromBackground(request);
    } else if (request.status == "ok" && request.msg == "added_search_term") {
      popup.populateSearchTermOptions(request.search_terms, request.new_search_term);	
      document.getElementById("custom-text-input").value = "";
    } else {
      console.log("there was issue getting info from background");
    }
  }
)
