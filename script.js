const CLIENT_ID = 'Ww9KIEXUL5KzVED0';

const drone = new ScaleDrone(CLIENT_ID, {
  data: { // Will be sent out as clientData via events
    name: getRandomName(),
    color: getRandomColor(),
  },
});

let members = [];

// Define createMemberElement before any other function that uses it
function createMemberElement(member) {
  const { name, color } = member.clientData;
  const el = document.createElement('div');
  el.appendChild(document.createTextNode(name));
  el.className = 'member';
  el.style.color = color;
  return el;
}

function updateMembersDOM() {
  DOM.membersCount.innerText = `${members.length} users in room:`;
  DOM.membersList.innerHTML = '';  // Clear current members list
  members.forEach(member =>
    DOM.membersList.appendChild(createMemberElement(member))  // Add each member to the list
  );
}

drone.on('open', error => {
  if (error) {
    return console.error(error);
  }
  console.log('Successfully connected to Scaledrone');

  const room = drone.subscribe('observable-room');
  room.on('open', error => {
    if (error) {
      return console.error(error);
    }
    console.log('Successfully joined room');
  });

  room.on('members', m => {
    members = m;
    updateMembersDOM();  // Call updateMembersDOM after getting the members
  });

  room.on('member_join', member => {
    members.push(member);
    updateMembersDOM();  // Update member list when someone joins
  });

  room.on('member_leave', ({ id }) => {
    const index = members.findIndex(member => member.id === id);
    members.splice(index, 1);
    updateMembersDOM();  // Update member list when someone leaves
  });

  room.on('data', (text, member) => {
    if (member) {
      addMessageToListDOM(text, member);  // Handle the incoming message
      // Send the message to Discord
      sendToDiscord(`${member.clientData.name}: ${text.content}`);
    } else {
      // Message is from server
    }
  });
});

drone.on('close', event => {
  console.log('Connection was closed', event);
});

drone.on('error', error => {
  console.error(error);
});

function getRandomName() {
  const adjs = ["autumn", "hidden", "bitter", "misty", "silent", "empty", "dry", "dark", "summer", "icy", "delicate", "quiet", "white", "cool", "spring", "winter", "patient", "twilight", "dawn", "crimson", "wispy", "weathered", "blue", "billowing", "broken", "cold", "damp", "falling", "frosty", "green", "long", "late", "lingering", "bold", "little", "morning", "muddy", "old", "red", "rough", "still", "small", "sparkling", "throbbing", "shy", "wandering", "withered", "wild", "black", "young", "holy", "solitary", "fragrant", "aged", "snowy", "proud", "floral", "restless", "divine", "polished", "ancient", "purple", "lively", "nameless"];
  const nouns = ["waterfall", "river", "breeze", "moon", "rain", "wind", "sea", "morning", "snow", "lake", "sunset", "pine", "shadow", "leaf", "dawn", "glitter", "forest", "hill", "cloud", "meadow", "sun", "glade", "bird", "brook", "butterfly", "bush", "dew", "dust", "field", "fire", "flower", "firefly", "feather", "grass", "haze", "mountain", "night", "pond", "darkness", "snowflake", "silence", "sound", "sky", "shape", "surf", "thunder", "violet", "water", "wildflower", "wave", "water", "resonance", "sun", "wood", "dream", "cherry", "tree", "fog", "frost", "voice", "paper", "frog", "smoke", "star"];
  return (
    adjs[Math.floor(Math.random() * adjs.length)] +
    "_" +
    nouns[Math.floor(Math.random() * nouns.length)]
  );
}

function getRandomColor() {
  return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16);
}

//------------- DOM STUFF

const DOM = {
  membersCount: document.querySelector('.members-count'),
  membersList: document.querySelector('.members-list'),
  messages: document.querySelector('.messages'),
  input: document.querySelector('.message-form__input'),
  form: document.querySelector('.message-form'),
};

DOM.form.addEventListener('submit', sendMessage);

//send message and or file
let canSend = true;  // Flag to control message sending
function sendMessage(event) {
  event.preventDefault();
  if (!canSend) return;  // Prevent sending if timeout hasn't passed

  const message = DOM.input.value.trim();
  const fileInput = DOM.form.querySelector('.message-form__file');
  const file = fileInput.files[0];  // Get the selected file

  if (!message && !file) {
    console.log("No message or image to send.");
    return;
  }

  canSend = false; // Throttle sending

  if (file) {
    // Ensure file is an image before proceeding
    if (!file.type.startsWith('image/')) {
      console.error('File must be an image.');
      canSend = true;  // Re-enable sending
      return;
    }

    // Resize and send image
    resizeImage(file, (resizedBase64) => {
      sendToDiscord(message || 'Image uploaded', resizedBase64);
      sendImageMessage(file);  // Publish to Scaledrone
    });
  } else if (message) {
    sendTextMessage(message);  // Send regular text
    sendToDiscord(message);   // Forward to Discord
  }

  DOM.input.value = '';  // Clear inputs
  fileInput.value = '';

  // Re-enable sending after 1 second
  setTimeout(() => {
    canSend = true;
  }, 1000);
}

function sendTextMessage(text) {
  drone.publish({
    room: 'observable-room',
    message: { type: 'text', content: text },
  });
}

// Function to resize the image
function resizeImage(file, callback) {
  const reader = new FileReader();

  reader.onloadend = function () {
    const img = new Image();

    img.onload = function () {
      // Create an HTML canvas element
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      //⚠️Settings⚠️
      const wantHeight = 300;
      const compression = 0.25;

      // Calc Ratios
      const ratio = img.width / img.height;
      const widthCalc = ratio * wantHeight;

      // Set Canvas Stuff
      canvas.width = widthCalc;
      canvas.height = wantHeight;

      // Draw the image on the canvas, automatically resized to fit
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Convert the resized image to a Base64 string
      const resizedBase64 = canvas.toDataURL('image/jpeg', compression); // File type: "image/png", "image/jpeg", etc.
      callback(resizedBase64);
    };

    img.src = reader.result;  // Set the image source to the file's data URL
  };

  reader.readAsDataURL(file);  // Read the file as a data URL
}

// Function to send image messages after resizing
function sendImageMessage(file) {
  resizeImage(file, function (resizedBase64) {
    drone.publish({
      room: 'observable-room',
      message: { type: 'image', content: resizedBase64 },
    });
  });
}

function createMessageElement(text, member) {
  const el = document.createElement('div');
  const { name, color } = member.clientData;

  if (text.type === 'text') {
    el.className = 'message';
    el.appendChild(createMemberElement(member));
    el.appendChild(document.createTextNode(text.content));
  } else if (text.type === 'image') {
    const img = document.createElement('img');
    img.src = text.content;  // Set the base64 image source
    el.className = 'message image-message';
    el.appendChild(createMemberElement(member));
    el.appendChild(img);
  }

  return el;
}

function addMessageToListDOM(text, member) {
  const el = DOM.messages;
  const wasTop = el.scrollTop === el.scrollHeight - el.clientHeight;
  el.appendChild(createMessageElement(text, member));
  if (wasTop) {
    el.scrollTop = el.scrollHeight - el.clientHeight;
  }
}

// Function to send message to Discord via webhook
const webhookURL = "https://discord.com/api/webhooks/1341949517414793307/WpGbQHA2OSkmkQ5McV9Hm79QyknLob4WD9G9r7_60UypNFp1pFuBICkEQgVDtW6pqzaI"; // Replace with your Discord webhook URL

function sendToDiscord(message, imageBase64 = null) {
  const formData = new FormData();
  formData.append("payload_json", JSON.stringify({ content: message }));

  if (imageBase64) {
    // Convert Base64 to Blob
    const byteString = atob(imageBase64.split(",")[1]); // Remove prefix
    const arrayBuffer = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      arrayBuffer[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([arrayBuffer], { type: "image/jpeg" }); // Change type as needed
    formData.append("file", blob, "image.jpg");
  }

  fetch(webhookURL, {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (response.ok) {
        console.log("Message and image sent to Discord!");
      } else {
        console.error("Failed to send message and image to Discord:", response.statusText);
      }
    })
    .catch((error) => {
      console.error("Error sending message to Discord:", error);
    });
}
