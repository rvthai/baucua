const rooms = [];
const chatrooms = [];

// Creates a new room
const createRoom = ({ id, room }) => {
  if (roomExists(room)) {
    return { error: "Room already exists" };
  }

  const colors = [
    "#c04e48", //red
    "#4a7eac", //blue
    "#d3c56e", //yellow
    "#4e9e58", //green
    "#ca7f3e", //orange
    "#7fc7b1", //teal
    "#ca709d", //pink
    "#903c9c", //purple
  ];

  const r = {
    roomId: room,
    host: id,
    active: false,
    players: [],
    bets: [],
    dice: [],
    colors: colors,
  };

  const c = {
    roomId: room,
    messages: [],
  };

  rooms.push(r);
  chatrooms.push(c);

  return { r };
};

const joinRoom = ({ id, name, room }) => {
  const index = rooms.findIndex((r) => r.roomId === room);

  if (index === -1 || name === null) {
    return { error: "Room does not exist" };
  }
  const color = rooms[index].colors.shift();
  const user = { id, name, room, total: 0, current: 0, color, ready: false };
  rooms[index].players.push(user);
  return { user };
};

const getUserInRoom = (room) => {
  const roomList = rooms.filter((r) => r.roomId === room);
  if (roomList.length === 0) {
    return { error: "Room does not exist" };
  }
  return roomList[0].players;
};

const removeUser = ({ id, room }) => {
  const index = rooms.findIndex((rm) => rm.roomId === room);

  if (index === -1) {
    return null;
  }

  const playerList = rooms[index].players;
  const playerIndex = playerList.findIndex((user) => user.id === id);

  if (playerIndex === -1) {
    return null;
  }

  const chatIndex = chatrooms.findIndex((cr) => cr.roomId === room);
  const user = playerList.splice(playerIndex, 1)[0];
  rooms[index].colors.unshift(user.color);
  if (rooms[index].players.length === 0) {
    rooms.splice(index, 1);
    chatrooms.splice(chatIndex, 1);
  }
  return user;
};

const findRoom = (room) => rooms.filter((r) => r.roomId === room);

// Check if a room exists
const roomExists = (room) => {
  const index = rooms.findIndex((r) => r.roomId === room);
  if (index === -1) {
    return false;
  }

  return true;
};

const getRoom = ({ room }) => {
  const index = rooms.findIndex((rm) => rm.roomId === room);
  if (index !== -1) {
    rooms[index].active = true;
    return rooms[index];
  }
  return { error: "Room does not exist" };
};

//GAME FUNCTIONS
const addBet = ({ room, id, amount, animal }) => {
  const gameroom = rooms.find((rm) => rm.roomId === room);
  if (gameroom) {
    const player = gameroom.players.find((pl) => pl.id === id);
    if (gameroom && player) {
      const playerbet = gameroom.bets.find(
        (pb) => pb.id === id && pb.animal === animal
      );
      if (playerbet) {
        playerbet.amount += amount;
      } else {
        const bet = { id: id, animal: animal, amount: amount };
        gameroom.bets.push(bet);
      }
      player.total -= amount;
      player.current += amount;
    }
    return gameroom;
  }
};

const setReady = ({ room, id }) => {
  const gameroom = rooms.find((rm) => rm.roomId === room);
  if (gameroom) {
    const player = gameroom.players.find((user) => user.id === id);
    if (player) {
      player.ready = true;
      return gameroom;
    }
  }
};

const rollDice = ({ room }) => {
  const gameroom = rooms.find((rm) => rm.roomId === room);
  const animals = ["deer", "bau", "chicken", "fish", "crab", "shrimp"];
  let a = animals.length,
    k,
    temp;
  while (--a > 0) {
    k = Math.floor(Math.random() * (a + 1));
    temp = animals[k];
    animals[k] = animals[a];
    animals[a] = temp;
  }
  const dice = [];
  let die;
  for (die = 0; die < 3; die++) {
    const index = Math.floor(Math.random() * 6);
    const d = animals[index];
    dice.push(d);
  }
  gameroom.dice = dice;
  return calculateProfit(room);
};

const calculateProfit = (room) => {
  const gameroom = rooms.find((rm) => rm.roomId === room);
  for (let die = 0; die < gameroom.dice.length; ++die) {
    const bet = gameroom.bets.filter((b) => b.animal === gameroom.dice[die]);
    if (bet.length > 0) {
      for (let win = 0; win < bet.length; ++win) {
        const player = gameroom.players.find((p) => p.id === bet[0].id);
        player.total += bet[0].amount * 2;
      }
    }
  }
  for (let p = 0; p < gameroom.players.length; ++p) {
    gameroom.players[p].current = 0;
    gameroom.players[p].ready = false;
  }
  gameroom.bets = [];
  return gameroom;
};

const addMessage = ({ room, name, message }) => {
  const index = chatrooms.findIndex((c) => c.roomId === room);
  if (index !== -1) {
    const messageObject = { name: name, message: message };
    chatrooms[index].messages.push(messageObject);
    return chatrooms[index];
  }
};

const getChatroom = ({ room }) => {
  const index = chatrooms.findIndex((rm) => rm.roomId === room);
  if (index !== -1) {
    return chatrooms[index];
  }
  return { error: "Chatroom does not exist" };
};

module.exports = {
  createRoom,
  joinRoom,
  getUserInRoom,
  removeUser,
  findRoom,
  getRoom,
  addBet,
  setReady,
  rollDice,
  addMessage,
  getChatroom,
};
