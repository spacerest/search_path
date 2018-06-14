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
  var signin_button, xhr_button, revoke_button, highlight_info_div, highlight_data, show_result_div;
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
    	disableButton(xhr_button);
    	disableButton(revoke_button);
    	break;
      case STATE_ACQUIRING_AUTHTOKEN:
    	disableButton(signin_button);
    	disableButton(xhr_button);
    	disableButton(revoke_button);
    	break;
      case STATE_AUTHTOKEN_ACQUIRED:
    	disableButton(signin_button);
    	enableButton(xhr_button);
    	enableButton(revoke_button);
    	break;
}
  }

  var getAuthToken = function(options) {
    chrome.identity.getAuthToken(
  	  { 'interactive': options.interactive },
  	  options.callback);
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
            console.log(currentTab.id);
            chrome.runtime.sendMessage({msg: "get_data", tab_id: currentTab.id, url: currentTab.url, highlighted_text: highlightedText});
	  }
	}
      ); 
    })
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
  	  console.log('no token aqcuired');
	  //chrome.browserAction.setBadgeText({text: "no"});
	  changeState(STATE_START);
    } else {
  	  console.log('Token aquired');
	  //chrome.browserAction.setBadgeText({text: "yes"});
	  changeState(STATE_AUTHTOKEN_ACQUIRED);
    }
  }

  var sendDataToGoogleSheetsCallback = function(token) {
    console.log(document.getElementById("highlight_data").value);
    document.getElementById("sending_gif").style.display = "block";
    var highlightToSend = new Highlight(
      getSelectedSearchTerm(),
      dataFromBackground.page_result,
      document.getElementById("highlight_data").value
    );
    console.log("json to send is ");
    console.log(highlightToSend);
    post({ 'url':	  'https://script.googleapis.com/v1/scripts/' + SCRIPT_ID +
    ':run',
  		  'callback': googleAPIResponse,
  		  'token': token,
  		  'request': {'function':   'setData',
  					    'parameters': {'data': JSON.stringify(highlightToSend)}} 
  		  });
  }
  
  var googleAPIResponse = function(response) {
    document.getElementById("sending_gif").style.display = "none";
    var info;
    if (response.response.result.status == 'ok') {
      info = "Data has been entered into <a href='" + response.response.result.doc + "' target='_blank'>your google sheet</a>."; 
      document.getElementById("show_result_success").innerHTML = info; 
      document.getElementById("highlight_data").value = ""; 
    } else {
      info = "Error..." + response.response.result.status;
      document.getElementById("show_result_error").innerHTML = info; 
    }	
    console.log(info);
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
		console.log("should have updated interface");
	}
  }

  this.onWindowLoad = function () {
    signin_button = document.querySelector('#signin');
    signin_button.addEventListener('click', getAuthTokenInteractive);
    
    xhr_button = document.querySelector('#getxhr');
    xhr_button.addEventListener('click', sendDataToGoogleSheets.bind(xhr_button, true));
    
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

  var populateSearchTermOptions = function(langArray, selectedSearchTerm) {
    var index=0;
    var selectElement = document.getElementById("search-term-select");
    var opt = document.createElement("option");
    opt.value = "add-new";
    opt.innerHTML = "+ add custom";
    selectElement.appendChild(opt);
    for(index in langArray){
       opt = document.createElement("option");
       opt.value= index;
       opt.innerHTML = langArray[index]; // whatever property it has
    
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
      console.log(document.getElementById("search-term-select").value + "yup")
      document.getElementById("custom-search-term").classList.add("visible"); 
      document.getElementById("custom-search-term").classList.remove("hidden"); 
    } else {
      console.log(document.getElementById("search-term-select").value + "nope")
      document.getElementById("custom-search-term").classList.add("hidden"); 
      document.getElementById("custom-search-term").classList.remove("visible"); 
  
    }
  
  
  }

  this.useDataFromBackground = function(request) {
    if (request) {
      dataFromBackground = request.highlight;
      searchTermsFromBackground = request.search_terms;
      request.highlight ? highlight_data.innerHTML = request.highlight.highlight : null;
      populateSearchTermOptions(searchTermsFromBackground, request.highlight.search_term);	
      document.getElementById("loading_gif").style.display = "none";
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
    function(request, sender, sendResponse) {
      if (request.status == "ok" && request.msg == "send_data") {
	popup.useDataFromBackground(request);
      } else {
	console.log("there was issue getting info from background");
      }
    }
)
