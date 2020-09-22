// Global data structures
const rooms = [];
const chatrooms = [];

// Functions that handle room events
// Create and add a new room to the server
const createRoom = (id, room) => {
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
    active: false,
    host: id,
    players: [],
    bets: [],
    dice: [],
    colors: colors,
    settings: { time: 30, rounds: 5, balance: 10 },
    round: 1,
    timer: 30,
  };

  const c = {
    roomId: room,
    messages: [],
  };

  rooms.push(r);
  chatrooms.push(c);
};

// Add a player to a room
const joinRoom = (id, name, room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  const color = gameroom.colors.shift();

  const user = {
    id,
    name,
    color,
    room,
    total: 0,
    net: 0,
    rank: 1,
    bankrupt: false,
    ready: false,
  };

  gameroom.players.push(user);

  return user;
};

const findRoom = (room) => rooms.filter((r) => r.roomId === room);

const checkRoom = ({ room }) => {
  const r = findRoom(room);
  if (r.length === 0) {
    return "The room you tried to enter does not exist.";
  } else if (r.length > 0 && r[0].players.length >= 8) {
    return "The room you tried to enter is already full.";
  } else if (r[0].active) {
    return "The room you tried to enter has already started.";
  }

  return false;
};

const changeRoomSettings = (room, setting, value) => {
  const gameroom = findRoom(room)[0];

  if (setting === "time") {
    gameroom.settings.time = value;
    gameroom.timer = value;
  } else if (setting === "rounds") {
    gameroom.settings.rounds = value;
  } else if (setting === "balance") {
    gameroom.settings.balance = value;
  }

  return gameroom;
};

const countdown = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined || allReady(gameroom)) {
    return null;
  }

  gameroom.timer -= 1;

  return gameroom.timer;
};

const resetTime = (room) => {
  const gameroom = findRoom(room)[0];
  gameroom.timer = gameroom.settings.time;
  return gameroom.timer;
};

// helper function for countdown
const allReady = (gameroom) => {
  const players = gameroom.players;

  for (let i = 0; i < players.length; i++) {
    if (players[i].ready === false) {
      return false;
    }
  }

  return true;
};

// Functions that handle balance and money interactions
const setInitialBalance = ({ room, balance }) => {
  const gameroom = findRoom(room)[0];

  gameroom.active = true;

  for (let i = 0; i < gameroom.players.length; i++) {
    gameroom.players[i].total = balance;
  }

  return gameroom;
};

const addBet = ({ room, id, amount, animal }) => {
  const gameroom = findRoom(room)[0];
  if (gameroom) {
    const player = gameroom.players.find((p) => p.id === id);

    if (gameroom && player) {
      const playerbet = gameroom.bets.find(
        (pb) => pb.id === id && pb.animal === animal
      );

      if (playerbet) {
        playerbet.amount += amount;
      } else {
        const bet = {
          id: player.id,
          animal: animal,
          amount: amount,
          color: player.color,
        };
        gameroom.bets.push(bet);
      }

      player.total -= amount;
      player.net -= amount;
    }

    return gameroom;
  }
};

const removeBet = ({ room, id, amount, animal }) => {
  const gameroom = findRoom(room)[0];
  if (gameroom) {
    const player = gameroom.players.find((p) => p.id === id);

    if (gameroom && player) {
      const playerbet = gameroom.bets.find(
        (pb) => pb.id === id && pb.animal === animal
      );

      if (playerbet) {
        const index = gameroom.bets.findIndex(
          (b) => b.id === id && b.animal === animal
        );
        gameroom.bets.splice(index, 1);
        player.total += amount;
        player.net += amount;
      }
    }

    return gameroom;
  }
};

const clearBets = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom) {
    gameroom.bets = [];
  }

  return gameroom;
};

const clearNets = (room) => {
  const gameroom = findRoom(room)[0];

  if (gameroom) {
    for (let i = 0; i < gameroom.players.length; i++) {
      gameroom.players[i].net = 0;
    }
  }

  return gameroom;
};

const calculateBets = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) {
    return null;
  }

  var prev_rolls = [];
  for (let die = 0; die < gameroom.dice.length; ++die) {
    const bets = gameroom.bets.filter((b) => b.animal === gameroom.dice[die]);

    if (bets.length > 0) {
      for (let win = 0; win < bets.length; ++win) {
        const player = gameroom.players.find((p) => p.id === bets[win].id);

        if (prev_rolls.find((d) => d === gameroom.dice[die])) {
          player.total += bets[win].amount;
        } else {
          player.total += bets[win].amount * 2;
        }
      }

      prev_rolls.push(gameroom.dice[die]);
    }
  }

  for (let p = 0; p < gameroom.players.length; ++p) {
    gameroom.players[p].ready = false;

    if (gameroom.players[p].total === 0) {
      gameroom.players[p].bankrupt = true;
      gameroom.players[p].ready = true;
    }
  }

  return setRankingsByTotal(room);
};

const calculateNets = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) {
    return null;
  }

  // what if player leaves right on this function call? might need to do some checking

  var prev_rolls = [];
  for (let die = 0; die < gameroom.dice.length; ++die) {
    const bets = gameroom.bets.filter((b) => b.animal === gameroom.dice[die]);

    if (bets.length > 0) {
      for (let win = 0; win < bets.length; ++win) {
        const player = gameroom.players.find((p) => p.id === bets[win].id);

        if (prev_rolls.find((d) => d === gameroom.dice[die])) {
          player.net += bets[win].amount;
        } else {
          player.net += bets[win].amount * 2;
        }
      }

      prev_rolls.push(gameroom.dice[die]);
    }
  }

  return setRankingsByNet(room);
};

const setRankingsByTotal = (room) => {
  const gameroom = findRoom(room)[0];

  const players = gameroom.players;

  const sorted_players = [...players].sort((a, b) => {
    return b.total - a.total;
  });

  sorted_players[0].rank = 1;
  for (let i = 1; i < sorted_players.length; i++) {
    if (sorted_players[i].total === sorted_players[i - 1].total) {
      sorted_players[i].rank = sorted_players[i - 1].rank;
    } else {
      sorted_players[i].rank = sorted_players[i - 1].rank + 1;
    }
  }

  return sorted_players;

  //return gameroom;
};

const setRankingsByNet = (room) => {
  const gameroom = findRoom(room)[0];

  const players = gameroom.players;

  const sorted_players = [...players].sort((a, b) => {
    return b.net - a.net;
  });

  return sorted_players;
};

const checkBankrupt = (room) => {
  const gameroom = findRoom(room)[0];
  const players = gameroom.players;

  for (let p = 0; p < players.length; p++) {
    if (!players[p].bankrupt) {
      return false;
    }
  }

  return true;
};

// Functions that handle the dice roll
const rollDice = ({ room }) => {
  const gameroom = findRoom(room)[0];

  if (gameroom === undefined) return null;
  const animals = ["deer", "gourd", "rooster", "fish", "crab", "shrimp"];

  // for extra randomness, will randomly resort the array before picking
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

  return gameroom;
};

// Functions that handle player ready
const setReady = ({ room, id }) => {
  const gameroom = findRoom(room)[0];
  if (gameroom) {
    const player = gameroom.players.find((user) => user.id === id);
    if (player) {
      player.ready = true;
      return gameroom;
    }
  }
};

const setAllReady = (room) => {
  const gameroom = findRoom(room)[0];
  const players = gameroom.players;

  for (let i = 0; i < players.length; i++) {
    if (players[i].ready === false) {
      players[i].ready = true;
    }
  }

  return gameroom;
};

// Functions that handle round transitions
const nextRound = (room) => {
  const gameroom = findRoom(room)[0];
  if (gameroom === undefined) return null;

  gameroom.round += 1;
  if (gameroom.round > gameroom.settings.rounds) {
    return -1;
  }
  return gameroom.round;
};

// Functions that handle reseting the gamestate on play again
const resetRoom = (room) => {
  const gameroom = findRoom(room)[0];
  // if it is undefined then return something else
  gameroom.active = false;
  gameroom.bets = [];
  gameroom.dice = [];
  gameroom.round = 1;

  for (let i = 0; i < gameroom.players.length; i++) {
    gameroom.players[i].total = 0;
    gameroom.players[i].net = 0;
    gameroom.players[i].rank = 1;
    gameroom.players[i].bankrupt = false;
    gameroom.players[i].ready = false;
  }

  return gameroom;
};

// Functions that handle the chat
const addMessage = ({ id, room, name, message }) => {
  const chatroom = chatrooms.find((c) => c.roomId === room);
  const gameroom = findRoom(room)[0];

  const player = gameroom.players.find((p) => p.id === id);

  const messageObject = {
    name: name,
    color: player.color,
    message: message,
  };

  chatroom.messages.push(messageObject);

  return chatroom.messages;
};

// Functions to handle user disconnection
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

// Module Exports
module.exports = {
  createRoom,
  joinRoom,
  findRoom,
  checkRoom,
  changeRoomSettings,
  setInitialBalance,
  addBet,
  removeBet,
  clearBets,
  clearNets,
  calculateBets,
  calculateNets,
  checkBankrupt,
  rollDice,
  setReady,
  setAllReady,
  nextRound,
  resetRoom,
  addMessage,
  removeUser,
  countdown,
  resetTime,
};
