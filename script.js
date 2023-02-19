const tabs = document.querySelectorAll('[data-tab-target]')
const tabContents = document.querySelectorAll('[data-tab-content]')

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = document.querySelector(tab.dataset.tabTarget)
        tabContents.forEach(tabContent => {
            tabContent.classList.remove('active')
        })
        tabs.forEach(tab => {
            tab.classList.remove('active')
        })
        tab.classList.add('active')
        target.classList.add('active')
    })
})

filterObjects("all");

function filterObjects(c) {
    var x, i;
    x = document.getElementsByClassName("box");
    if (c == "all") c = "";
    for (i = 0; i < x.length; i++) {
        removeClass(x[i], "show");
        if(x[i].className.indexOf(c) > -1) addClass(x[i], "show")
    }
}

function addClass(element, name) {
    var i, arr1, arr2;
    arr1 = element.className.split(" ");
    arr2 = name.split(" ");
    for (i = 0; i < arr2.length; i++) {
        if (arr1.indexOf(arr2[i]) == -1) {
            element.className += " " + arr2[i];
        }
    }
}

function removeClass(element, name) {
    var i, arr1, arr2;
    arr1 = element.className.split(" ");
    arr2 = name.split(" ");
    for (i = 0; i < arr2.length; i++) {
        while (arr1.indexOf(arr2[i]) > -1) {
            arr1.splice(arr1.indexOf(arr2[i]), 1);
        }
    }
    element.className = arr1.join(" ");
}

// for twilio
const recipientForm = document.getElementById('recipientForm');
const sendNotificationForm = document.getElementById('sendNotificationForm');
const newRecipientInput = document.getElementById('newRecipientInput');
const recipientList = document.getElementById('recipients');
const resultSection = document.getElementById('resultSection');

const recipients = [];

function addRecipient(phoneNumber) {
  recipients.push(phoneNumber);
  const newListItem = document.createElement('li');
  newListItem.innerText = phoneNumber;
  recipientList.appendChild(newListItem);
}

function clearForm(form) {
  // only clearing the passcode and leaving the message for convience
  form.passcode.value = '';
}

recipientForm.addEventListener('submit', (evt) => {
  evt.preventDefault();

  if (newRecipientInput.value) {
    addRecipient(newRecipientInput.value);
    newRecipientInput.value = '';
  }
});

function sendMessages(form) {
  const data = {
    passcode: form.passcode.value,
    message: form.message.value,
    recipients: recipients.join(','),
  };

  clearForm(form);

  fetch('send-messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
    .then((resp) => {
      if (resp.ok) {
        return resp.json();
      }

      if (resp.status === 401) {
        throw new Error('Invalid Passcode');
      } else {
        throw new Error(
          'Unexpected error. Please check the logs for what went wrong.'
        );
      }
    })
    .then((body) => {
      const successCount = body.result.reduce((currentCount, resultItem) => {
        return resultItem.success ? currentCount + 1 : currentCount;
      }, 0);

      resultSection.innerText = `Sent ${successCount} of ${body.result.length} messages. Check logs for details`;
    })
    .catch((err) => {
      resultSection.innerText = err.message;
    });
}

sendNotificationForm.addEventListener('submit', (evt) => {
  evt.preventDefault();

  if (recipients.length === 0 && newRecipientInput.value) {
    addRecipient(newRecipientInput.value);
    newRecipientInput.value = '';
  }

  if (recipients.length === 0) {
    resultSection.innerText = 'Please enter at least one phone number';
  } else {
    resultSection.innerText = 'Sending messages. One moment';
    sendMessages(evt.target);
  }
});

exports.handler = function (context, event, callback) {
    const phoneNumbers = event.recipients.split(',').map((x) => x.trim());
    const { message, passcode } = event;
  
    if (passcode !== context.PASSCODE) {
      const response = new Twilio.Response();
      response.setStatusCode(401);
      response.setBody('Invalid passcode');
      return callback(null, response);
    }
  
    const client = context.getTwilioClient();
    const allMessageRequests = phoneNumbers.map((to) => {
      return client.messages
        .create({
          from: context.TWILIO_PHONE_NUMBER,
          to,
          body: message,
        })
        .then((msg) => {
          return { success: true, sid: msg.sid };
        })
        .catch((err) => {
          return { success: false, error: err.message };
        });
    });
  
    Promise.all(allMessageRequests)
      .then((result) => {
        return callback(null, { result });
      })
      .catch((err) => {
        console.error(err);
        return callback('Failed to fetch messages');
      });
  };