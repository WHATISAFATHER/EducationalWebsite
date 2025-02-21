const CLIENT_ID = 'Ww9KIEXUL5KzVED0';

const drone = new ScaleDrone(CLIENT_ID, {
  data: { 
    name: getRandomName(),
    color: getRandomColor(),
  },
});

let members = [];

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
  DOM.membersList.innerHTML = '';
  members.forEach(member =>
    DOM.membersList.appendChild(createMemberElement(member))
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
    updateMembersDOM();
  });

  room.on('member_join', member => {
    members.push(member);
    updateMembersDOM();
  });

  room.on('member_leave', ({ id }) => {
    members = members.filter(member => member.id !== id);
    updateMembersDOM();
  });

  room.on('data', (message, member) => {
    if (member) {
      addMessageToListDOM(message, member);
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
  const adjs = ["autumn", "hidden", "bitter", "misty", "silent", "empty", "dry", "dark", "summer", "icy", "delicate", "quiet", "white", "cool", "spring", "winter"];
  const nouns = ["waterfall", "river", "breeze", "moon", "rain", "wind", "sea", "morning", "snow", "lake", "sunset"];
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

let canSend = true;
function sendMessage(event) {
  event.preventDefault();
  if (!canSend) return;

  const message = DOM.input.value.trim();
  const fileInput = DOM.form.querySelector('.message-form__file');
  const file = fileInput.files[0];

  if (!message && !file) {
    console.log("No message or file to send.");
    return;
  }

  canSend = false;

  if (file) {
    const fileType = file.type.split('/')[0];

    if (fileType === 'image') {
      resizeImage(file, (resizedBase64) => {
        sendFileMessage('image', resizedBase64);
      });
    } else if (fileType === 'video' || file.type === 'application/pdf' || file.type.startsWith('text/') || file.type.includes('word') || file.type.includes('excel')) {
      sendFile(file);
    } else {
      console.error('Unsupported file type.');
      canSend = true;
      return;
    }
  } else if (message) {
    sendTextMessage(message);
  }

  DOM.input.value = '';
  fileInput.value = '';

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

// Resize image before sending
function resizeImage(file, callback) {
  const reader = new FileReader();
  reader.onloadend = function () {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const maxHeight = 600; 
      const quality = 0.8;

      const ratio = img.width / img.height;
      const widthCalc = ratio * maxHeight;

      canvas.width = widthCalc;
      canvas.height = maxHeight;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const resizedBase64 = canvas.toDataURL('image/jpeg', quality);
      callback(resizedBase64);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// Send file (videos, documents)
function sendFile(file) {
  const reader = new FileReader();
  reader.onloadend = function () {
    drone.publish({
      room: 'observable-room',
      message: { type: 'file', name: file.name, content: reader.result, fileType: file.type },
    });
  };
  reader.readAsDataURL(file);
}

// Send image message
function sendFileMessage(type, content) {
  drone.publish({
    room: 'observable-room',
    message: { type, content },
  });
}

// Create message elements
function createMessageElement(message, member) {
  const el = document.createElement('div');
  const { name, color } = member.clientData;

  if (message.type === 'text') {
    el.className = 'message';
    el.appendChild(createMemberElement(member));
    el.appendChild(document.createTextNode(message.content));
  } else if (message.type === 'image') {
    const img = document.createElement('img');
    img.src = message.content;
    el.className = 'message image-message';
    el.appendChild(createMemberElement(member));
    el.appendChild(img);
  } else if (message.type === 'file') {
    const link = document.createElement('a');
    link.href = message.content;
    link.download = message.name;
    link.textContent = `Download ${message.name}`;
    el.className = 'message file-message';
    el.appendChild(createMemberElement(member));
    el.appendChild(link);
  }

  return el;
}

function addMessageToListDOM(message, member) {
  const el = DOM.messages;
  const wasTop = el.scrollTop === el.scrollHeight - el.clientHeight;
  el.appendChild(createMessageElement(message, member));
  if (wasTop) {
    el.scrollTop = el.scrollHeight - el.clientHeight;
  }
}
