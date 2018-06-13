var sendToGoogleSheets = (function () {

	var SCRIPT_ID='15uJJKus-863eXQy40-Cd6XBntQU80BAYAk_mCwfJeYjRR__BwMOu2Mob'; // Apps Script script id
	var STATE_START=1;
	var STATE_ACQUIRING_AUTHTOKEN=2;
	var STATE_AUTHTOKEN_ACQUIRED=3;

	var state = STATE_START;
	var jsonToSend = "";
	var dataFromBackground;
	var highlightedText;
	var currentTab;
	var signin_button, xhr_button, revoke_button, highlight_info_div, highlight_data;

	function disableButton(button) {
		button.setAttribute('disabled', 'disabled');
	}

	function enableButton(button) {
		button.removeAttribute('disabled');
	}

	function changeState(newState) {
		state = newState;
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
	
  function getAuthToken (options) {
  	chrome.identity.getAuthToken(
  	  { 'interactive': options.interactive },
  	  options.callback);
  }
 
  function requestInfoFromBackground() {
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

  function sendDataToGoogleSheets () {
    getAuthToken({
  	  'interactive': false,
  	  'callback': sendDataToGoogleSheetsCallback,
    });
  }
  
  function getAuthTokenSilent() {
    getAuthToken({
      'interactive': false,
      'callback': getAuthTokenCallback,	  
    });
  }

  function getAuthTokenInteractive() {
    getAuthToken({
	'interactive': true,
	'callback': getAuthTokenCallback,
    });
  }
  
  function getAuthTokenCallback (token) {
    if (chrome.runtime.lastError) {
  	  console.log('no token aqcuired');
	  changeState(STATE_START);
    } else {
  	  console.log('Token aquired');
	  changeState(STATE_AUTHTOKEN_ACQUIRED);
    }
  }

  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if (request.status == "ok") {
	dataFromBackground = request.content;
	highlight_data.innerHTML = "hi you just got this to popup js:";
	highlight_data.innerHTML = request.content;
	sendDataToGoogleSheets();
      } else {
	console.log("there was issue getting info from background");
      }
    }
  );
  
  function sendDataToGoogleSheetsCallback(token) {
    console.log("json to send is " + dataFromBackground);
    post({ 'url':	  'https://script.googleapis.com/v1/scripts/' + SCRIPT_ID +
    ':run',
  		  'callback': googleAPIResponse,
  		  'token': token,
  		  'request': {'function':   'setData',
  					    'parameters': {'data': JSON.stringify(dataFromBackground)}} 
  		  });
  }
  
  function googleAPIResponse (response) {
    var info;
    if (response.response.result.status == 'ok') {
      info = "Data has been enetered into " + response.response.result.doc; 
    } else {
      info = "Error..." + response.response.result.status;
    }	
    console.log(info);
  }
  
  function post(options) {
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
	  
	/**
	 * Revoking the access token.
	 */
	function revokeToken() {
		getAuthToken({
			'interactive': false,
			'callback': revokeAuthTokenCallback,
		});
	}
	
	/**
	 * Revoking the access token callback
	 */
	function revokeAuthTokenCallback(current_token) {
		if (!chrome.runtime.lastError) {

			// Remove the local cached token
			chrome.identity.removeCachedAuthToken({ token: current_token }, function() {});
			
			// Make a request to revoke token in the server
			var xhr = new XMLHttpRequest();
			xhr.open('GET', 'https://accounts.google.com/o/oauth2/revoke?token=' + current_token);
			xhr.send();

			// Update the user interface accordingly
			changeState(STATE_START);
			sampleSupport.log('Token revoked and removed from cache. '+
							'Check chrome://identity-internals to confirm.');
		}
	
	}
	

	return {
		onload: function () {
			signin_button = document.querySelector('#signin');
			signin_button.addEventListener('click', getAuthTokenInteractive);

			xhr_button = document.querySelector('#getxhr');
			xhr_button.addEventListener('click', requestInfoFromBackground.bind(xhr_button, true));// sendDataToGoogleSheets.bind(xhr_button, true));

			revoke_button = document.querySelector('#revoke');
			revoke_button.addEventListener('click', revokeToken);

			highlight_info_div = document.querySelector('#highlight_info_div');
			highlight_data = document.querySelector('#highlight_data');

			// Trying to get access token without signing in, 
			// it will work if the application was previously 
			// authorized by the user.
			getAuthTokenSilent();
		}
	};
})();

window.onload = sendToGoogleSheets.onload;

